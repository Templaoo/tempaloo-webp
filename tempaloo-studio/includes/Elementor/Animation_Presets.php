<?php
/**
 * Animation_Presets — single source of truth loader for the typed
 * preset library (assets/data/anim-presets.json).
 *
 * Read by:
 *   - Animation::sanitize_*() — validate user input against the schema.
 *   - Rest::library() — expose the full schema to the React admin so
 *     UI controls auto-generate from preset.params instead of being
 *     hard-coded.
 *   - Theme/runtime — emit the schema (or a slim version) to the
 *     browser so animations.js resolves param values at runtime.
 *
 * @package Tempaloo\Studio\Elementor
 */

namespace Tempaloo\Studio\Elementor;

defined( 'ABSPATH' ) || exit;

final class Animation_Presets {

    private static ?array $cache = null;

    /**
     * Load (and cache) the full preset library.
     */
    public static function library(): array {
        if ( is_array( self::$cache ) ) return self::$cache;
        $path = self::path();
        if ( ! is_readable( $path ) ) {
            self::$cache = self::empty_library();
            return self::$cache;
        }
        $raw = file_get_contents( $path );
        $lib = json_decode( (string) $raw, true );
        if ( ! is_array( $lib ) ) {
            self::$cache = self::empty_library();
            return self::$cache;
        }
        self::$cache = $lib;
        return self::$cache;
    }

    public static function path(): string {
        return \TEMPALOO_STUDIO_PATH . 'assets/data/anim-presets.json';
    }

    public static function url(): string {
        return \TEMPALOO_STUDIO_URL . 'assets/data/anim-presets.json';
    }

    /**
     * IDs of all presets (element + text), keys for whitelisting user
     * input. Also the legacy Animation::PRESETS source — keep in sync.
     */
    public static function preset_ids(): array {
        $lib = self::library();
        $ids = [];
        foreach ( (array) ( $lib['presets'] ?? [] ) as $p ) {
            if ( is_array( $p ) && ! empty( $p['id'] ) ) $ids[] = (string) $p['id'];
        }
        return $ids;
    }

    /**
     * Behavior IDs (lift, magnetic, counter, marquee, parallax-mouse).
     */
    public static function behavior_ids(): array {
        $lib = self::library();
        $ids = [];
        foreach ( (array) ( $lib['behaviors'] ?? [] ) as $b ) {
            if ( is_array( $b ) && ! empty( $b['id'] ) ) $ids[] = (string) $b['id'];
        }
        return $ids;
    }

    /**
     * Element-type IDs (h1, h2, p, img, button, container, link).
     */
    public static function element_type_ids(): array {
        $lib = self::library();
        $ids = [];
        foreach ( (array) ( $lib['elementTypes'] ?? [] ) as $t ) {
            if ( is_array( $t ) && ! empty( $t['id'] ) ) $ids[] = (string) $t['id'];
        }
        return $ids;
    }

    /**
     * Lookup preset definition by id.
     */
    public static function preset( string $id ): ?array {
        foreach ( (array) ( self::library()['presets'] ?? [] ) as $p ) {
            if ( is_array( $p ) && ( $p['id'] ?? '' ) === $id ) return $p;
        }
        return null;
    }

    /**
     * Lookup element-type definition by id.
     */
    public static function element_type( string $id ): ?array {
        foreach ( (array) ( self::library()['elementTypes'] ?? [] ) as $t ) {
            if ( is_array( $t ) && ( $t['id'] ?? '' ) === $id ) return $t;
        }
        return null;
    }

    /**
     * Default param values for a preset id, ready to merge with a
     * user-supplied override. Does NOT include the scrollTrigger block.
     */
    public static function preset_defaults( string $id ): array {
        $p = self::preset( $id );
        if ( ! $p ) return [];
        $out = [];
        foreach ( (array) ( $p['params'] ?? [] ) as $key => $spec ) {
            if ( is_array( $spec ) && array_key_exists( 'value', $spec ) ) {
                $out[ $key ] = $spec['value'];
            }
        }
        return $out;
    }

    /**
     * Default scrollTrigger config for a preset id.
     */
    public static function preset_scrolltrigger_defaults( string $id ): array {
        $p = self::preset( $id );
        if ( ! $p || empty( $p['scrollTrigger'] ) ) return [];
        $out = [];
        foreach ( (array) $p['scrollTrigger'] as $key => $spec ) {
            if ( is_array( $spec ) && array_key_exists( 'value', $spec ) ) {
                $out[ $key ] = $spec['value'];
            }
        }
        return $out;
    }

    /**
     * Recommended preset for an element type (used as default when the
     * admin first installs the system / a new template).
     */
    public static function recommended_for_element( string $type_id ): string {
        $t = self::element_type( $type_id );
        if ( ! $t ) return 'fade-up';
        return (string) ( $t['recommendedPreset'] ?? 'fade-up' );
    }

    /**
     * Validate a user-submitted param value against the preset's schema.
     * Returns the cleaned value, or null if invalid.
     */
    public static function sanitize_param( string $preset_id, string $param, $value ) {
        $p = self::preset( $preset_id );
        if ( ! $p ) return null;
        $spec = $p['params'][ $param ] ?? $p['scrollTrigger'][ $param ] ?? null;
        if ( ! is_array( $spec ) ) return null;

        $type = (string) ( $spec['type'] ?? '' );

        if ( 'number' === $type ) {
            $n = is_numeric( $value ) ? (float) $value : null;
            if ( $n === null ) return null;
            $min = isset( $spec['min'] ) ? (float) $spec['min'] : null;
            $max = isset( $spec['max'] ) ? (float) $spec['max'] : null;
            if ( $min !== null && $n < $min ) return null;
            if ( $max !== null && $n > $max ) return null;
            return $n;
        }
        if ( 'boolean' === $type ) {
            return (bool) $value;
        }
        if ( 'enum' === $type ) {
            $enum_id = (string) ( $spec['enum'] ?? '' );
            $allowed = self::enum_values( $enum_id );
            $str = (string) $value;
            return in_array( $str, $allowed, true ) ? $str : null;
        }
        if ( 'string' === $type ) {
            return is_string( $value ) ? trim( $value ) : null;
        }
        return null;
    }

    /**
     * Sanitize a full param map for a given preset. Drops keys not in
     * the schema and out-of-range values silently.
     */
    public static function sanitize_params( string $preset_id, array $params ): array {
        $out = [];
        foreach ( $params as $key => $value ) {
            $clean = self::sanitize_param( $preset_id, (string) $key, $value );
            if ( $clean !== null ) $out[ (string) $key ] = $clean;
        }
        return $out;
    }

    /**
     * Allowed values for an enum id (EASE, TRIGGER_START, etc.).
     */
    public static function enum_values( string $enum_id ): array {
        $lib = self::library();
        $items = (array) ( $lib['enums'][ $enum_id ] ?? [] );
        $out = [];
        foreach ( $items as $it ) {
            if ( is_array( $it ) && isset( $it['id'] ) ) $out[] = (string) $it['id'];
        }
        return $out;
    }

    private static function empty_library(): array {
        return [
            'version'      => '0.0.0',
            'enums'        => [],
            'elementTypes' => [],
            'presets'      => [],
            'behaviors'    => [],
        ];
    }
}
