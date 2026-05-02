<?php
/**
 * Animation_Profiles — Plan B.
 *
 * A "profile" is a complete bundle of v2 config (globals + element
 * rules) that can be applied to the site in one click. Reusable across
 * all installed templates: the user installs Avero + Bauhaus + a future
 * template, picks "cinematic" once, and the look propagates everywhere.
 *
 * Two sources, merged (file profiles win on id clash to keep authored
 * defaults stable across upgrades):
 *
 *   1. Built-in (file)   — assets/data/anim-profiles.json (4 profiles
 *                          shipped with the plugin: editorial, cinematic,
 *                          minimal, bold).
 *   2. User profiles     — wp_options 'tempaloo_studio_animation_profiles'
 *                          (importable JSON, custom-built profiles).
 *
 * @package Tempaloo\Studio\Elementor
 */

namespace Tempaloo\Studio\Elementor;

defined( 'ABSPATH' ) || exit;

final class Animation_Profiles {

    const OPTION_USER       = 'tempaloo_studio_animation_profiles';
    const OPTION_ACTIVE     = 'tempaloo_studio_animation_profile';   // currently applied profile id

    /** Read the built-in profiles bundled with the plugin. */
    public static function builtins(): array {
        $path = TEMPALOO_STUDIO_PATH . 'assets/data/anim-profiles.json';
        if ( ! is_readable( $path ) ) return [];
        $raw = file_get_contents( $path );
        $lib = json_decode( (string) $raw, true );
        return is_array( $lib['profiles'] ?? null ) ? $lib['profiles'] : [];
    }

    /** Read user-saved profiles from options. */
    public static function user_profiles(): array {
        $stored = get_option( self::OPTION_USER, [] );
        if ( ! is_array( $stored ) ) return [];
        $out = [];
        foreach ( $stored as $p ) {
            if ( is_array( $p ) && ! empty( $p['id'] ) ) $out[] = $p;
        }
        return $out;
    }

    /**
     * All profiles — builtins first, then user profiles. Indexed for
     * fast lookup. User can shadow a builtin id (their copy wins).
     */
    public static function all(): array {
        $by_id = [];
        foreach ( self::builtins() as $p ) {
            if ( is_array( $p ) && ! empty( $p['id'] ) ) {
                $p['source']    = 'builtin';
                $by_id[ $p['id'] ] = $p;
            }
        }
        foreach ( self::user_profiles() as $p ) {
            $p['source']      = 'user';
            $by_id[ $p['id'] ] = $p;
        }
        return array_values( $by_id );
    }

    public static function get( string $id ): ?array {
        foreach ( self::all() as $p ) {
            if ( ( $p['id'] ?? '' ) === $id ) return $p;
        }
        return null;
    }

    /**
     * Apply a profile — merges its globals + elementRules into the v2
     * config and persists. Widget overrides are preserved (user-specific
     * customizations should not vanish on profile switch).
     */
    public static function apply( string $id ): bool {
        $profile = self::get( $id );
        if ( ! $profile ) return false;

        $v2 = Animation::config_v2();

        if ( is_array( $profile['globals'] ?? null ) ) {
            $v2['globals'] = array_merge( $v2['globals'], $profile['globals'] );
        }
        if ( is_array( $profile['elementRules'] ?? null ) ) {
            // Sanitize each rule against the schema before saving.
            $rules = [];
            foreach ( $profile['elementRules'] as $type_id => $rule ) {
                if ( ! is_array( $rule ) ) continue;
                $rules[ (string) $type_id ] = Animation::sanitize_rule( $rule );
            }
            $v2['elementRules'] = $rules;
        }

        Animation::save_v2( $v2 );
        update_option( self::OPTION_ACTIVE, $id );
        return true;
    }

    public static function active_id(): string {
        $id = get_option( self::OPTION_ACTIVE, '' );
        return is_string( $id ) ? $id : '';
    }

    /**
     * Save a custom profile to user storage. Replaces if id matches.
     */
    public static function save_user_profile( array $profile ): bool {
        if ( empty( $profile['id'] ) ) return false;
        $id   = sanitize_key( (string) $profile['id'] );
        if ( $id === '' ) return false;

        $clean = [
            'id'           => $id,
            'label'        => isset( $profile['label'] )       ? sanitize_text_field( (string) $profile['label'] )       : $id,
            'description'  => isset( $profile['description'] ) ? sanitize_text_field( (string) $profile['description'] ) : '',
            'globals'      => is_array( $profile['globals'] ?? null )      ? $profile['globals']      : [],
            'elementRules' => is_array( $profile['elementRules'] ?? null ) ? $profile['elementRules'] : [],
        ];

        // Sanitize element rules.
        $rules_clean = [];
        foreach ( $clean['elementRules'] as $type_id => $rule ) {
            if ( ! is_array( $rule ) ) continue;
            $rules_clean[ (string) $type_id ] = Animation::sanitize_rule( $rule );
        }
        $clean['elementRules'] = $rules_clean;

        $stored = get_option( self::OPTION_USER, [] );
        if ( ! is_array( $stored ) ) $stored = [];

        $found = false;
        foreach ( $stored as &$existing ) {
            if ( is_array( $existing ) && ( $existing['id'] ?? '' ) === $id ) {
                $existing = $clean;
                $found    = true;
                break;
            }
        }
        unset( $existing );
        if ( ! $found ) $stored[] = $clean;

        update_option( self::OPTION_USER, $stored );
        return true;
    }

    public static function delete_user_profile( string $id ): bool {
        $id = sanitize_key( $id );
        if ( $id === '' ) return false;
        $stored = get_option( self::OPTION_USER, [] );
        if ( ! is_array( $stored ) ) return false;
        $next = array_values( array_filter( $stored, function ( $p ) use ( $id ) {
            return is_array( $p ) && ( $p['id'] ?? '' ) !== $id;
        } ) );
        update_option( self::OPTION_USER, $next );
        return true;
    }

    /**
     * Build a profile from the current v2 config — useful for
     * "Save current as profile" UI.
     */
    public static function snapshot_current( string $id, string $label, string $description = '' ): array {
        $v2 = Animation::config_v2();
        return [
            'id'           => sanitize_key( $id ),
            'label'        => sanitize_text_field( $label ),
            'description'  => sanitize_text_field( $description ),
            'globals'      => $v2['globals'],
            'elementRules' => $v2['elementRules'],
        ];
    }
}
