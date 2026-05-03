<?php
/**
 * Animation — emits the user's animation config to the runtime so widget
 * markup can opt into entrance animations via data attributes alone.
 *
 * v2 hierarchical model — 3 levels of resolution at runtime:
 *
 *   0. GLOBALS              intensity, direction, reduce-motion strategy.
 *   1. ELEMENT TYPE RULES   per-tag presets (h1/h2/h3/p/img/button/container/link).
 *                            Driven by the active animation profile.
 *   2. SELECTOR OVERRIDES   per-CSS-selector overrides (click-driven Animate Mode).
 *
 * Payloads emitted in the head:
 *
 *   1. window.tempaloo.studio.animation = { intensity, direction }
 *   2. window.tempaloo.studio.animV2    = { globals, elementRules,
 *                                           selectorOverrides, elementTypes }
 *
 * The schema/library lives in assets/data/anim-presets.json — see
 * Animation_Presets for the loader. Adding a preset there exposes it to
 * PHP validation, runtime, and the React admin in one shot.
 *
 * @package Tempaloo\Studio\Elementor
 */

namespace Tempaloo\Studio\Elementor;

defined( 'ABSPATH' ) || exit;

final class Animation {

    // Legacy v1 options — kept so we can migrate gracefully.
    const OPTION_INTENSITY = 'tempaloo_studio_animation_intensity';
    const OPTION_PRESETS   = 'tempaloo_studio_animation_presets';
    const OPTION_DIRECTION = 'tempaloo_studio_animation_direction';

    // v2 option — single hashmap that holds the entire animation surface.
    const OPTION_V2 = 'tempaloo_studio_animation_v2';

    // Sprint 2 — cursor + smooth-scroll site-wide settings.
    const OPTION_CURSOR = 'tempaloo_studio_cursor';
    const OPTION_SCROLL = 'tempaloo_studio_scroll';

    /** Cursor types — runtime maps to assets/js/cursor.js implementations. */
    const CURSOR_TYPES = [ 'off', 'basic', 'outline', 'tooltip', 'text', 'media' ];

    /** Smooth-scroll engines. None = native scroll. */
    const SCROLL_ENGINES = [ 'none', 'lenis' ];

    /** GSAP source — local bundle (default) or jsDelivr CDN. */
    const GSAP_SOURCES = [ 'local', 'cdn' ];

    const DEFAULT_         = 'medium';
    const ALLOWED          = [ 'off', 'subtle', 'medium', 'bold' ];

    /** Direction model — how a scroll-triggered animation behaves
     *  when the user moves through it multiple times. See
     *  scheduleAnim() in assets/js/animations.js. */
    const DEFAULT_DIRECTION = 'bidirectional';
    const DIRECTIONS        = [ 'once', 'replay', 'bidirectional', 'scrub' ];

    /**
     * Reduce-motion strategy — what happens when the user has
     * `prefers-reduced-motion: reduce` set in their OS:
     *   - 'off'       : no animation at all (only opacity if any).
     *   - 'subtle'    : downgrade to opacity-only (default, accessible).
     *   - 'unchanged' : run animations as-is (NOT recommended; here for
     *                   parity with users who explicitly want it).
     */
    const REDUCE_MOTION = [ 'off', 'subtle', 'unchanged' ];

    /** Available preset names — frozen snapshot for callers that need a
     *  PHP constant (REST args validation). The authoritative live list
     *  comes from Animation_Presets::preset_ids() which reads the JSON
     *  schema. Keep this in sync when adding presets to the JSON. */
    const PRESETS = [
        'none', 'fade', 'fade-up', 'fade-down', 'fade-left', 'fade-right',
        'scale-in', 'blur-in', 'mask-reveal',
        'word-fade-up', 'word-fade-blur', 'word-slide-up-overflow',
        'char-up', 'line-fade-up-stagger',
        'text-typing', 'text-fill-sweep',
        'scroll-words-fill', 'editorial-stack',
    ];

    private ?Template_Manager $templates;

    public function __construct( ?Template_Manager $templates = null ) {
        $this->templates = $templates;
    }

    /* ─────────────────────────────────────────────────────────────
     * v2 hierarchical config — full read/write surface
     * ──────────────────────────────────────────────────────────── */

    /**
     * Read the v2 config (auto-migrates from v1 on first call).
     * Shape:
     * {
     *   globals: { intensity, direction, reduceMotion },
     *   elementRules: { h1: {preset, params, scrollTrigger}, ... },
     *   selectorOverrides: { "<css selector>": { rule, label?, savedAt? } }
     * }
     */
    public static function config_v2(): array {
        $v2 = get_option( self::OPTION_V2, null );
        if ( is_array( $v2 ) && ! empty( $v2['__version'] ) ) {
            $v2 = self::with_defaults( $v2 );
            // GC orphan selector overrides — when a preset is removed
            // from the schema (e.g. `world-expands` retired in favour
            // of a dedicated widget), any existing selectorOverride
            // referencing it becomes a "ghost rule" that does nothing
            // but also blocks Niveau 1 element rules from cascading.
            // Runs lazily on read, persists once on the next save.
            $v2 = self::gc_orphan_selector_overrides( $v2 );
            // One-time programmatic cleanup of selectors the user asked
            // to remove (Avero ↔ Built-for-Life refactor). Idempotent
            // via a wp_options flag; runs once then never again.
            $v2 = self::run_one_time_cleanup_avero_v1( $v2 );
            return $v2;
        }
        $migrated = self::migrate_from_v1();
        update_option( self::OPTION_V2, $migrated );
        return $migrated;
    }

    /**
     * One-time cleanup of orphan selectorOverrides explicitly retired
     * during the Avero ↔ Built-for-Life refactor. The presets these
     * selectors reference are still valid (blur-in / mask-reveal /
     * word-fade-blur), so the generic gc_orphan_selector_overrides
     * doesn't catch them — they were live rules the user asked to
     * scrap by name. Runs once, gated by a wp_options flag.
     */
    private static function run_one_time_cleanup_avero_v1( array $v2 ): array {
        if ( get_option( 'tempaloo_studio_cleanup_avero_v1_done', 0 ) ) {
            return $v2;
        }
        $remove = [
            '.tw-avero-cta__title',
            '.tw-avero-services',
            '.tw-avero-how-it-works__title',
            'div.tw-avero-hero__content',
            // Built-for-Life takeover — no longer applied via selectorOverride
            '.tw-avero-hero__title',
            '.tw-avero-services__card',
            'span.tw-char',
        ];
        if ( ! empty( $v2['selectorOverrides'] ) && is_array( $v2['selectorOverrides'] ) ) {
            $changed = false;
            foreach ( $remove as $sel ) {
                if ( isset( $v2['selectorOverrides'][ $sel ] ) ) {
                    unset( $v2['selectorOverrides'][ $sel ] );
                    $changed = true;
                }
            }
            if ( $changed ) update_option( self::OPTION_V2, $v2 );
        }
        update_option( 'tempaloo_studio_cleanup_avero_v1_done', 1 );
        return $v2;
    }

    /**
     * Remove any selector override whose preset id is no longer in the
     * schema. Idempotent: if the in-memory v2 already contains only
     * valid presets, returns it unchanged. Persists to the option ONLY
     * when at least one orphan was found, so we don't write on every
     * read.
     */
    private static function gc_orphan_selector_overrides( array $v2 ): array {
        if ( empty( $v2['selectorOverrides'] ) || ! is_array( $v2['selectorOverrides'] ) ) {
            return $v2;
        }
        $valid_ids = Animation_Presets::preset_ids();
        if ( ! is_array( $valid_ids ) || empty( $valid_ids ) ) return $v2;

        $cleaned = [];
        $removed = 0;
        foreach ( $v2['selectorOverrides'] as $sel => $entry ) {
            $preset = '';
            if ( is_array( $entry ) && isset( $entry['rule']['preset'] ) ) {
                $preset = (string) $entry['rule']['preset'];
            }
            if ( $preset !== '' && in_array( $preset, $valid_ids, true ) ) {
                $cleaned[ $sel ] = $entry;
            } else {
                $removed++;
            }
        }
        if ( $removed > 0 ) {
            $v2['selectorOverrides'] = $cleaned;
            update_option( self::OPTION_V2, $v2 );
        }
        return $v2;
    }

    /**
     * Apply schema defaults to a partial v2 config so callers always
     * see a fully-shaped object.
     */
    private static function with_defaults( array $v2 ): array {
        $globals = is_array( $v2['globals'] ?? null ) ? $v2['globals'] : [];
        $globals = array_merge( [
            'intensity'    => self::DEFAULT_,
            'direction'    => self::DEFAULT_DIRECTION,
            'reduceMotion' => 'subtle',
        ], $globals );

        return [
            '__version'         => '2.0.0',
            'globals'           => $globals,
            'elementRules'      => is_array( $v2['elementRules']      ?? null ) ? $v2['elementRules']      : self::default_element_rules(),
            // Selector-targeted overrides set via the click-driven Animate
            // Mode in the floating panel. Map: { "<css selector>": { rule, label?, savedAt? } }.
            // Always wins over elementRules because it's more specific.
            'selectorOverrides' => is_array( $v2['selectorOverrides'] ?? null ) ? $v2['selectorOverrides'] : new \stdClass(),
        ];
    }

    /**
     * Default Element Rules — one row per element type defined in the
     * JSON schema. Each row uses the type's recommendedPreset with that
     * preset's default params.
     */
    public static function default_element_rules(): array {
        $rules = [];
        foreach ( Animation_Presets::element_type_ids() as $type_id ) {
            $preset_id = Animation_Presets::recommended_for_element( $type_id );
            $rules[ $type_id ] = [
                'enabled'       => true,
                'preset'        => $preset_id,
                'params'        => Animation_Presets::preset_defaults( $preset_id ),
                'scrollTrigger' => Animation_Presets::preset_scrolltrigger_defaults( $preset_id ),
            ];
        }
        return $rules;
    }

    /**
     * Migrate the v1 storage (intensity / direction) into the v2
     * hierarchical shape. Idempotent: runs only when v2 doesn't exist yet.
     * Per-widget v1 presets are intentionally dropped — profiles now
     * cover that surface uniformly.
     */
    private static function migrate_from_v1(): array {
        $intensity = get_option( self::OPTION_INTENSITY, self::DEFAULT_ );
        $direction = get_option( self::OPTION_DIRECTION, self::DEFAULT_DIRECTION );

        return self::with_defaults( [
            '__version'    => '2.0.0',
            'globals'      => [
                'intensity'    => is_string( $intensity ) ? $intensity : self::DEFAULT_,
                'direction'    => is_string( $direction ) ? $direction : self::DEFAULT_DIRECTION,
                'reduceMotion' => 'subtle',
            ],
            'elementRules' => self::default_element_rules(),
        ] );
    }

    public static function save_v2( array $v2 ): void {
        update_option( self::OPTION_V2, self::with_defaults( $v2 ) );
    }

    /* ─────────────────────────────────────────────────────────────
     * Globals — accessors
     * ──────────────────────────────────────────────────────────── */

    public static function globals(): array {
        return self::config_v2()['globals'];
    }

    public static function intensity(): string {
        $v = self::globals()['intensity'];
        return in_array( $v, self::ALLOWED, true ) ? $v : self::DEFAULT_;
    }

    public static function set_intensity( string $value ): bool {
        if ( ! in_array( $value, self::ALLOWED, true ) ) return false;
        $v2 = self::config_v2();
        $v2['globals']['intensity'] = $value;
        self::save_v2( $v2 );
        // Mirror to legacy option for any code still reading it.
        update_option( self::OPTION_INTENSITY, $value );
        return true;
    }

    public static function direction(): string {
        $v = self::globals()['direction'];
        return in_array( $v, self::DIRECTIONS, true ) ? $v : self::DEFAULT_DIRECTION;
    }

    public static function set_direction( string $value ): bool {
        if ( ! in_array( $value, self::DIRECTIONS, true ) ) return false;
        $v2 = self::config_v2();
        $v2['globals']['direction'] = $value;
        self::save_v2( $v2 );
        update_option( self::OPTION_DIRECTION, $value );
        return true;
    }

    public static function reduce_motion(): string {
        $v = self::globals()['reduceMotion'];
        return in_array( $v, self::REDUCE_MOTION, true ) ? $v : 'subtle';
    }

    public static function set_reduce_motion( string $value ): bool {
        if ( ! in_array( $value, self::REDUCE_MOTION, true ) ) return false;
        $v2 = self::config_v2();
        $v2['globals']['reduceMotion'] = $value;
        self::save_v2( $v2 );
        return true;
    }

    /* ─────────────────────────────────────────────────────────────
     * Sprint 2 — Cursor / Scroll / GSAP source settings
     * ──────────────────────────────────────────────────────────── */

    public static function cursor_settings(): array {
        $stored = get_option( self::OPTION_CURSOR, [] );
        if ( ! is_array( $stored ) ) $stored = [];
        return array_merge( [
            'type'         => 'off',
            'smooth'       => 0.18,
            'accent'       => '#10b981',
            'bg'           => 'rgba(15, 23, 42, 0.92)',
            'size'         => 14,
            'mixBlendMode' => 'normal',
            'hover'        => [ 'scale' => 2.4 ],
        ], $stored );
    }

    public static function set_cursor_settings( array $patch ): bool {
        $current = self::cursor_settings();
        if ( isset( $patch['type'] ) ) {
            $t = (string) $patch['type'];
            if ( ! in_array( $t, self::CURSOR_TYPES, true ) ) return false;
            $current['type'] = $t;
        }
        if ( isset( $patch['smooth'] ) )       $current['smooth']       = max( 0, min( 0.95, (float) $patch['smooth'] ) );
        if ( isset( $patch['accent'] ) )       $current['accent']       = self::sanitize_color( (string) $patch['accent'] );
        if ( isset( $patch['bg'] ) )           $current['bg']           = self::sanitize_color( (string) $patch['bg'] );
        if ( isset( $patch['size'] ) )         $current['size']         = max( 4, min( 64, (int) $patch['size'] ) );
        if ( isset( $patch['mixBlendMode'] ) ) {
            $allowed = [ 'normal', 'difference', 'exclusion', 'multiply', 'screen', 'overlay' ];
            $m = (string) $patch['mixBlendMode'];
            if ( in_array( $m, $allowed, true ) ) $current['mixBlendMode'] = $m;
        }
        if ( isset( $patch['hover']['scale'] ) ) {
            $current['hover']['scale'] = max( 1, min( 6, (float) $patch['hover']['scale'] ) );
        }
        update_option( self::OPTION_CURSOR, $current );
        return true;
    }

    public static function scroll_settings(): array {
        $stored = get_option( self::OPTION_SCROLL, [] );
        if ( ! is_array( $stored ) ) $stored = [];
        return array_merge( [
            'engine'        => 'none',
            'duration'      => 1.2,    // Lenis duration (seconds for the smoothing curve)
            'lerp'          => 0.1,    // alternative to duration
            'wheelMultiplier' => 1.0,
            'excludePages'  => '',     // comma-separated post IDs
            'gsapSource'    => 'local',
        ], $stored );
    }

    public static function set_scroll_settings( array $patch ): bool {
        $current = self::scroll_settings();
        if ( isset( $patch['engine'] ) ) {
            $e = (string) $patch['engine'];
            if ( ! in_array( $e, self::SCROLL_ENGINES, true ) ) return false;
            $current['engine'] = $e;
        }
        if ( isset( $patch['duration'] ) )        $current['duration']        = max( 0.2, min( 4, (float) $patch['duration'] ) );
        if ( isset( $patch['lerp'] ) )            $current['lerp']            = max( 0.01, min( 1, (float) $patch['lerp'] ) );
        if ( isset( $patch['wheelMultiplier'] ) ) $current['wheelMultiplier'] = max( 0.1, min( 5, (float) $patch['wheelMultiplier'] ) );
        if ( isset( $patch['excludePages'] ) )    $current['excludePages']    = preg_replace( '/[^0-9, ]/', '', (string) $patch['excludePages'] );
        if ( isset( $patch['gsapSource'] ) ) {
            $g = (string) $patch['gsapSource'];
            if ( in_array( $g, self::GSAP_SOURCES, true ) ) $current['gsapSource'] = $g;
        }
        update_option( self::OPTION_SCROLL, $current );
        return true;
    }

    /** Lenis is enabled? Used by Frontend\Assets to lazy-load lenis.min.js. */
    public static function lenis_enabled_for_post( int $post_id = 0 ): bool {
        $s = self::scroll_settings();
        if ( $s['engine'] !== 'lenis' ) return false;
        $excludes = array_filter( array_map( 'intval', explode( ',', (string) $s['excludePages'] ) ) );
        if ( $post_id > 0 && in_array( $post_id, $excludes, true ) ) return false;
        return true;
    }

    /** Public — Frontend\Assets reads this to decide between local and CDN. */
    public static function gsap_source(): string {
        $s = self::scroll_settings();
        return ( $s['gsapSource'] === 'cdn' ) ? 'cdn' : 'local';
    }

    private static function sanitize_color( string $v ): string {
        $v = trim( $v );
        // Accept #RGB / #RRGGBB / #RRGGBBAA / rgb(...) / rgba(...) / hsl(...) / hsla(...) / named.
        if ( preg_match( '/^#([a-fA-F0-9]{3,4}|[a-fA-F0-9]{6}|[a-fA-F0-9]{8})$/', $v ) ) return $v;
        if ( preg_match( '/^(rgb|rgba|hsl|hsla)\([0-9.,%\s\/]+\)$/', $v ) ) return $v;
        if ( preg_match( '/^[a-zA-Z]+$/', $v ) )  return $v;
        return '#10b981';
    }

    /* ─────────────────────────────────────────────────────────────
     * Element Rules — Niveau 1 (driven by the active profile)
     * ──────────────────────────────────────────────────────────── */

    public static function element_rules(): array {
        return self::config_v2()['elementRules'];
    }

    /* ─────────────────────────────────────────────────────────────
     * Selector Overrides — Niveau 4 (click-driven Animate Mode)
     * ──────────────────────────────────────────────────────────── */

    public static function selector_overrides(): array {
        $v2 = self::config_v2();
        $so = $v2['selectorOverrides'] ?? [];
        if ( $so instanceof \stdClass ) $so = (array) $so;
        return is_array( $so ) ? $so : [];
    }

    /**
     * Returns true when ANY animation rule is active across the v2
     * config. Drives the lazy-loader in Frontend\Assets — if this is
     * false, GSAP / ScrollTrigger / animations.js are NEVER enqueued
     * on the front-end. Inspired by Motion.page's plugin-by-plugin
     * lazy-loading (Sprint 1 / point #1).
     */
    public static function has_active_rules(): bool {
        if ( self::intensity() === 'off' ) return false;

        $v2 = self::config_v2();

        // Niveau 4 — any selector override.
        $so = $v2['selectorOverrides'] ?? [];
        if ( $so instanceof \stdClass ) $so = (array) $so;
        if ( is_array( $so ) && ! empty( $so ) ) return true;

        // Niveau 1 — any element rule with a preset that's not "none".
        foreach ( (array) ( $v2['elementRules'] ?? [] ) as $rule ) {
            if ( ! is_array( $rule ) ) continue;
            if ( ( $rule['enabled'] ?? true ) === false ) continue;
            $p = (string) ( $rule['preset'] ?? '' );
            if ( $p !== '' && $p !== 'none' ) return true;
        }

        return false;
    }

    /**
     * Save (or replace) a selector-targeted rule.
     * @param string $selector  CSS selector (free-form, sanitised below).
     * @param array  $payload   { rule, label? }
     */
    public static function set_selector_override( string $selector, array $payload ): bool {
        $sel = self::sanitize_selector( $selector );
        if ( $sel === '' ) return false;
        $rule = is_array( $payload['rule'] ?? null ) ? self::sanitize_rule( $payload['rule'] ) : null;
        if ( ! is_array( $rule ) || empty( $rule['preset'] ) ) return false;

        $v2 = self::config_v2();
        $map = is_array( $v2['selectorOverrides'] ?? null ) ? $v2['selectorOverrides'] : [];
        $map[ $sel ] = [
            'rule'    => $rule,
            'label'   => isset( $payload['label'] ) ? sanitize_text_field( (string) $payload['label'] ) : '',
            'savedAt' => time(),
        ];
        $v2['selectorOverrides'] = $map;
        self::save_v2( $v2 );
        return true;
    }

    public static function delete_selector_override( string $selector ): bool {
        $sel = self::sanitize_selector( $selector );
        if ( $sel === '' ) return false;
        $v2 = self::config_v2();
        $map = is_array( $v2['selectorOverrides'] ?? null ) ? $v2['selectorOverrides'] : [];
        if ( ! isset( $map[ $sel ] ) ) return false;
        unset( $map[ $sel ] );
        $v2['selectorOverrides'] = $map;
        self::save_v2( $v2 );
        return true;
    }

    /**
     * Sanitise a CSS selector. Allowed: letters, digits, classes, ids,
     * descendant combinators, attribute selectors, :nth-child(...).
     * Rejects anything that smells like JS injection (<>, {}, ;, /*).
     */
    public static function sanitize_selector( string $sel ): string {
        $sel = trim( $sel );
        if ( $sel === '' ) return '';
        if ( strlen( $sel ) > 500 ) return '';
        if ( preg_match( '/[<>{};]/', $sel ) ) return '';
        if ( strpos( $sel, '/*' ) !== false || strpos( $sel, '*/' ) !== false ) return '';
        // Allow common selector chars: a-z 0-9 . # _ - * > + ~ , space [ ] = " ' : ( )
        if ( ! preg_match( '/^[a-zA-Z0-9_\-.#\s>+~,*\[\]=\'":()]+$/', $sel ) ) return '';
        return $sel;
    }

    /* ─────────────────────────────────────────────────────────────
     * Sanitizers
     * ──────────────────────────────────────────────────────────── */

    /**
     * Sanitize a rule (Element Rule or Widget Override). Both share
     * the same shape: { enabled?, preset, params, scrollTrigger, direction? }.
     */
    public static function sanitize_rule( array $rule, bool $allow_inherit = false ): array {
        $out = [];

        if ( isset( $rule['enabled'] ) ) {
            $out['enabled'] = (bool) $rule['enabled'];
        }

        $preset_id = (string) ( $rule['preset'] ?? '' );
        if ( $allow_inherit && ( $preset_id === '' || $preset_id === 'inherit' ) ) {
            $out['preset'] = '';
            $out['params'] = [];
            $out['scrollTrigger'] = [];
        } else {
            if ( ! in_array( $preset_id, Animation_Presets::preset_ids(), true ) ) {
                // Fallback: use "fade-up" if the user sent garbage.
                $preset_id = 'fade-up';
            }
            $out['preset'] = $preset_id;

            $params  = is_array( $rule['params'] ?? null ) ? $rule['params'] : [];
            $clean_p = Animation_Presets::sanitize_params( $preset_id, $params );
            // Re-apply defaults for keys the caller didn't send.
            $out['params'] = array_merge( Animation_Presets::preset_defaults( $preset_id ), $clean_p );

            $st = is_array( $rule['scrollTrigger'] ?? null ) ? $rule['scrollTrigger'] : [];
            $clean_st = Animation_Presets::sanitize_params( $preset_id, $st );
            $out['scrollTrigger'] = array_merge( Animation_Presets::preset_scrolltrigger_defaults( $preset_id ), $clean_st );
        }

        if ( isset( $rule['direction'] ) ) {
            $d = strtolower( trim( (string) $rule['direction'] ) );
            $out['direction'] = in_array( $d, self::DIRECTIONS, true ) ? $d : '';
        }

        return $out;
    }

    /* ─────────────────────────────────────────────────────────────
     * Emit — frontend payload
     * ──────────────────────────────────────────────────────────── */

    public function register(): void {
        add_action( 'wp_head',                   [ $this, 'emit' ], 7 );
        add_action( 'elementor/editor/wp_head',  [ $this, 'emit' ], 7 );
        add_action( 'elementor/preview/wp_head', [ $this, 'emit' ], 7 );

        // Sprint 1 / point #2 — Anti-FOUC. Hide the body until DCL when
        // animations are about to play, so the user never sees the
        // un-animated state for the few hundred ms before GSAP starts.
        // Inspired by Motion.page's pattern (the same 3-line snippet
        // they ship). Skipped for admin-bar users so it doesn't fight
        // with the WP toolbar layout flash.
        add_action( 'wp_head', [ $this, 'emit_anti_fouc' ], 1 );
    }

    /**
     * <style>body{visibility:hidden}</style> snippet that auto-clears on
     * DOMContentLoaded. The <noscript> fallback guarantees no-JS users
     * still see the page (accessibility).
     */
    public function emit_anti_fouc(): void {
        // Only when animations actually run. Skips when intensity = off
        // and when no rule is configured (lazy-load already skipped GSAP
        // → no animation will ever play → no FOUC to prevent).
        if ( ! self::has_active_rules() ) return;
        // Don't fight with the Elementor editor preview iframe — it
        // needs to render immediately for the user to see what they're
        // editing. The runtime's own scrollY-based "play above-the-fold"
        // patch handles entry animations there.
        if ( function_exists( 'is_admin' ) && is_admin() ) return;
        if ( class_exists( '\Elementor\Plugin' ) && \Elementor\Plugin::$instance->preview->is_preview_mode() ) return;

        // We DON'T unhide body on DCL anymore — that caused a brief
        // flash where un-animated content showed before GSAP applied
        // its fromState. The unhide trigger now lives in animations.js
        // (after first applyElementRules + applySelectorOverrides
        // pass). Safety net: unhide after 2.5s no matter what so the
        // user is never stuck on a blank page if the runtime fails.
        echo "\n<style id=\"tempaloo-studio-fouc\">body{visibility:hidden}</style>"
           . "<script id=\"tempaloo-studio-fouc-clear\">"
           . "(function(){var h=function(){document.body&&(document.body.style.visibility='inherit');};"
           . "window.__tw_unhide=h;"
           . "setTimeout(h,1500);" // safety net — release after 1.5s max even if GSAP boot is delayed (audit 2026-05-03)
           // Scroll restoration — disable browser's automatic scroll-restore
           // and force scrollTo(0,0) on reload. Without this, reloading a
           // page mid-scroll lands the user where they were, but our
           // anti-FOUC + scrub-tied animations boot expecting scrollY=0,
           // which produces visible jumps and stale ScrollTrigger states.
           // Runs as early as possible (in <head>) so the browser doesn't
           // have time to restore.
           . "if('scrollRestoration' in history){history.scrollRestoration='manual';}"
           . "if(performance&&performance.getEntriesByType){"
           .   "var navs=performance.getEntriesByType('navigation');"
           .   "if(navs&&navs[0]&&(navs[0].type==='reload'||navs[0].type==='back_forward')){window.scrollTo(0,0);}"
           . "}else if(performance&&performance.navigation&&performance.navigation.type===1){"
           .   "window.scrollTo(0,0);"
           . "}"
           . "})();"
           . "</script>"
           . "<noscript><style>body{visibility:inherit}</style></noscript>\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    }

    public function emit(): void {
        $v2 = self::config_v2();
        $intensity = self::intensity();

        $active_slug = '';
        if ( $this->templates ) {
            $active = $this->templates->active();
            if ( $active ) $active_slug = (string) $active['slug'];
        }

        // Slim element-types map (id → selectors) for the runtime
        // resolver. We don't ship the whole library for performance —
        // the React admin fetches it via /animation/library.
        $element_types = [];
        foreach ( (array) ( Animation_Presets::library()['elementTypes'] ?? [] ) as $t ) {
            if ( ! is_array( $t ) || empty( $t['id'] ) ) continue;
            $element_types[ (string) $t['id'] ] = [
                'selectors' => is_array( $t['selectors'] ?? null ) ? array_values( array_filter( $t['selectors'], 'is_string' ) ) : [],
            ];
        }

        $payload_legacy = wp_json_encode( [
            'intensity' => $intensity,
            'direction' => self::direction(),
            'cursor'    => self::cursor_settings(),
        ] );

        $payload_v2 = wp_json_encode( [
            'globals'           => $v2['globals'],
            'elementRules'      => $v2['elementRules'],
            'selectorOverrides' => self::selector_overrides() ?: new \stdClass(),
            'elementTypes'      => (object) $element_types,
            'templateSlug'      => $active_slug,
        ] );

        if ( ! is_string( $payload_legacy ) || ! is_string( $payload_v2 ) ) return;

        $cursor_payload = wp_json_encode( self::cursor_settings() );
        $scroll_payload = wp_json_encode( self::scroll_settings() );
        if ( ! is_string( $cursor_payload ) ) $cursor_payload = '{}';
        if ( ! is_string( $scroll_payload ) ) $scroll_payload = '{}';

        echo "\n<script id=\"tempaloo-studio-animation-config\">"
            . "window.tempaloo=window.tempaloo||{};"
            . "window.tempaloo.studio=window.tempaloo.studio||{};"
            . "window.tempaloo.studio.animation=" . $payload_legacy . ";"
            . "window.tempaloo.studio.animV2="    . $payload_v2     . ";"
            . "window.tempaloo.studio.cursor="    . $cursor_payload . ";"
            . "window.tempaloo.studio.scroll="    . $scroll_payload . ";"
            . "</script>\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    }
}
