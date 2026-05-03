<?php
/**
 * Animation — emits the user's animation config to the runtime so widget
 * markup can opt into entrance animations via data attributes alone.
 *
 * v2 (Plan A) hierarchical model — 4 levels of resolution at runtime:
 *
 *   0. GLOBALS                  intensity, direction, reduce-motion strategy.
 *   1. ELEMENT TYPE RULES       per-tag presets (h1/h2/h3/p/img/button/container/link).
 *   2. WIDGET SCOPE OVERRIDES   per-widget overrides (hero/services/faq/...).
 *   3. TARGETED OVERRIDES       per-selector overrides (Plan A++ slot, see todo).
 *
 * Two payloads emitted in the head:
 *
 *   1. window.tempaloo.studio.animation = { intensity, direction }
 *   2. window.tempaloo.studio.anims     = legacy widget config (kept for
 *                                          backward compatibility while we
 *                                          migrate runtime callers to v2).
 *   3. window.tempaloo.studio.animV2    = { globals, elementRules,
 *                                           widgetOverrides, library }
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
     *   widgetOverrides: { template_slug: { widget_slug: {preset, params, scrollTrigger, direction} } }
     * }
     */
    public static function config_v2(): array {
        $v2 = get_option( self::OPTION_V2, null );
        if ( is_array( $v2 ) && ! empty( $v2['__version'] ) ) {
            return self::with_defaults( $v2 );
        }
        // Auto-migrate from v1.
        $migrated = self::migrate_from_v1();
        update_option( self::OPTION_V2, $migrated );
        return $migrated;
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
            'widgetOverrides'   => is_array( $v2['widgetOverrides']   ?? null ) ? $v2['widgetOverrides']   : [],
            // Niveau 4 (Plan A++) — selector-targeted overrides set via
            // the click-driven Animate Mode in the floating panel.
            // Map shape: { "<css selector>": { rule, label?, savedAt? } }.
            // Always wins over Niveau 1/2 because it's the most specific.
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
     * Migrate the v1 storage (intensity / direction / per-widget presets)
     * into the v2 hierarchical shape. Idempotent: runs only when v2
     * doesn't exist yet.
     */
    private static function migrate_from_v1(): array {
        $intensity = get_option( self::OPTION_INTENSITY, self::DEFAULT_ );
        $direction = get_option( self::OPTION_DIRECTION, self::DEFAULT_DIRECTION );
        $presets_v1 = get_option( self::OPTION_PRESETS, [] );

        $widget_overrides = [];
        if ( is_array( $presets_v1 ) ) {
            foreach ( $presets_v1 as $template_slug => $widget_map ) {
                if ( ! is_array( $widget_map ) ) continue;
                $clean_template = sanitize_key( (string) $template_slug );
                if ( $clean_template === '' ) continue;
                foreach ( $widget_map as $widget_slug => $cfg ) {
                    if ( ! is_array( $cfg ) ) continue;
                    $clean_widget = sanitize_key( (string) $widget_slug );
                    if ( $clean_widget === '' ) continue;
                    // v1 stored { entrance, stagger, duration, trigger, direction }
                    // → translate to v2 { preset, params, scrollTrigger, direction }
                    $entrance = (string) ( $cfg['entrance'] ?? '' );
                    if ( $entrance === '' || ! in_array( $entrance, Animation_Presets::preset_ids(), true ) ) continue;

                    $params = Animation_Presets::preset_defaults( $entrance );
                    if ( isset( $cfg['stagger'] ) && is_numeric( $cfg['stagger'] ) ) {
                        // v1 was milliseconds, schema is seconds.
                        $s = max( 0, min( 0.5, ( (float) $cfg['stagger'] ) / 1000 ) );
                        if ( array_key_exists( 'stagger', $params ) ) $params['stagger'] = $s;
                    }
                    if ( isset( $cfg['duration'] ) && is_numeric( $cfg['duration'] ) ) {
                        if ( array_key_exists( 'duration', $params ) ) $params['duration'] = (float) $cfg['duration'];
                    }

                    $st = Animation_Presets::preset_scrolltrigger_defaults( $entrance );
                    if ( isset( $cfg['trigger'] ) && is_string( $cfg['trigger'] ) ) {
                        $st['start'] = (string) $cfg['trigger'];
                    }

                    $widget_overrides[ $clean_template ][ $clean_widget ] = [
                        'preset'        => $entrance,
                        'params'        => $params,
                        'scrollTrigger' => $st,
                        'direction'     => isset( $cfg['direction'] ) ? (string) $cfg['direction'] : '',
                    ];
                }
            }
        }

        return self::with_defaults( [
            '__version'       => '2.0.0',
            'globals'         => [
                'intensity'    => is_string( $intensity ) ? $intensity : self::DEFAULT_,
                'direction'    => is_string( $direction ) ? $direction : self::DEFAULT_DIRECTION,
                'reduceMotion' => 'subtle',
            ],
            'elementRules'    => self::default_element_rules(),
            'widgetOverrides' => $widget_overrides,
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
     * Element Rules — Niveau 1
     * ──────────────────────────────────────────────────────────── */

    public static function element_rules(): array {
        return self::config_v2()['elementRules'];
    }

    /**
     * Replace the whole rule for one element type. The caller is
     * expected to send a sanitized payload (see Rest::set_element_rule).
     */
    public static function set_element_rule( string $type_id, array $rule ): bool {
        if ( ! in_array( $type_id, Animation_Presets::element_type_ids(), true ) ) return false;
        $v2 = self::config_v2();
        $v2['elementRules'][ $type_id ] = self::sanitize_rule( $rule );
        self::save_v2( $v2 );
        return true;
    }

    public static function reset_element_rule( string $type_id ): bool {
        if ( ! in_array( $type_id, Animation_Presets::element_type_ids(), true ) ) return false;
        $v2 = self::config_v2();
        $defaults = self::default_element_rules();
        $v2['elementRules'][ $type_id ] = $defaults[ $type_id ] ?? [];
        self::save_v2( $v2 );
        return true;
    }

    /* ─────────────────────────────────────────────────────────────
     * Widget Overrides — Niveau 2
     * ──────────────────────────────────────────────────────────── */

    /**
     * Per-template widget overrides, merged with template.json defaults.
     */
    public function widget_overrides_for( string $template_slug ): array {
        $v2 = self::config_v2();
        $stored = is_array( $v2['widgetOverrides'][ $template_slug ] ?? null )
                ? $v2['widgetOverrides'][ $template_slug ]
                : [];

        // Merge template.json defaults — template.animations.presets[widget].
        $tpl_defaults = [];
        if ( $this->templates ) {
            $tpl = $this->templates->get( $template_slug );
            if ( $tpl ) {
                $defaults = is_array( $tpl['animations']['presets'] ?? null ) ? $tpl['animations']['presets'] : [];
                foreach ( $defaults as $widget => $cfg ) {
                    if ( ! is_array( $cfg ) ) continue;
                    $entrance = (string) ( $cfg['entrance'] ?? '' );
                    if ( $entrance === '' ) continue;
                    $params = Animation_Presets::preset_defaults( $entrance );
                    if ( isset( $cfg['stagger'] ) && array_key_exists( 'stagger', $params ) ) {
                        $params['stagger'] = max( 0, min( 0.5, ( (float) $cfg['stagger'] ) / 1000 ) );
                    }
                    if ( isset( $cfg['duration'] ) && array_key_exists( 'duration', $params ) ) {
                        $params['duration'] = (float) $cfg['duration'];
                    }
                    $st = Animation_Presets::preset_scrolltrigger_defaults( $entrance );
                    if ( isset( $cfg['trigger'] ) ) $st['start'] = (string) $cfg['trigger'];

                    $tpl_defaults[ (string) $widget ] = [
                        'preset'        => $entrance,
                        'params'        => $params,
                        'scrollTrigger' => $st,
                        'direction'     => '',
                    ];
                }
            }
        }

        $out = $tpl_defaults;
        foreach ( $stored as $widget => $cfg ) {
            if ( ! is_array( $cfg ) ) continue;
            $out[ (string) $widget ] = array_merge( $out[ (string) $widget ] ?? [], $cfg );
        }
        return $out;
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

    public function set_widget_override( string $template_slug, string $widget, array $cfg ): bool {
        $template_slug = sanitize_key( $template_slug );
        $widget        = sanitize_key( $widget );
        if ( $template_slug === '' || $widget === '' ) return false;
        $v2 = self::config_v2();
        if ( ! isset( $v2['widgetOverrides'][ $template_slug ] ) || ! is_array( $v2['widgetOverrides'][ $template_slug ] ) ) {
            $v2['widgetOverrides'][ $template_slug ] = [];
        }
        $v2['widgetOverrides'][ $template_slug ][ $widget ] = self::sanitize_rule( $cfg, true );
        self::save_v2( $v2 );
        return true;
    }

    /**
     * Legacy v1 shim — keeps the front-end PHP path that emits
     * `window.tempaloo.studio.anims` working until the runtime fully
     * adopts v2. Maps v2 widget overrides → v1 shape.
     */
    public function presets_for( string $template_slug ): array {
        $overrides = $this->widget_overrides_for( $template_slug );
        $out = [];
        foreach ( $overrides as $widget => $rule ) {
            if ( empty( $rule['preset'] ) ) continue;
            $params = is_array( $rule['params'] ?? null ) ? $rule['params'] : [];
            $st     = is_array( $rule['scrollTrigger'] ?? null ) ? $rule['scrollTrigger'] : [];
            $out[ (string) $widget ] = [
                'entrance'  => (string) $rule['preset'],
                'stagger'   => isset( $params['stagger'] )  ? (int) round( ( (float) $params['stagger'] ) * 1000 ) : 0,
                'duration'  => isset( $params['duration'] ) ? (float) $params['duration'] : 0.7,
                'trigger'   => isset( $st['start'] ) ? (string) $st['start'] : 'top 85%',
                'direction' => isset( $rule['direction'] ) ? (string) $rule['direction'] : '',
            ];
        }
        return $out;
    }

    /**
     * Legacy v1 shim for existing callers (Rest::set_animation old path).
     */
    public function set_preset( string $template_slug, string $widget, array $cfg ): bool {
        $entrance = (string) ( $cfg['entrance'] ?? '' );
        if ( $entrance === '' || ! in_array( $entrance, Animation_Presets::preset_ids(), true ) ) return false;
        $params = Animation_Presets::preset_defaults( $entrance );
        if ( isset( $cfg['stagger'] ) && is_numeric( $cfg['stagger'] ) && array_key_exists( 'stagger', $params ) ) {
            $params['stagger'] = max( 0, min( 0.5, ( (float) $cfg['stagger'] ) / 1000 ) );
        }
        if ( isset( $cfg['duration'] ) && is_numeric( $cfg['duration'] ) && array_key_exists( 'duration', $params ) ) {
            $params['duration'] = (float) $cfg['duration'];
        }
        $st = Animation_Presets::preset_scrolltrigger_defaults( $entrance );
        if ( isset( $cfg['trigger'] ) && is_string( $cfg['trigger'] ) ) $st['start'] = (string) $cfg['trigger'];

        $rule = [
            'preset'        => $entrance,
            'params'        => $params,
            'scrollTrigger' => $st,
            'direction'     => isset( $cfg['direction'] ) && is_string( $cfg['direction'] ) ? (string) $cfg['direction'] : '',
        ];
        return $this->set_widget_override( $template_slug, $widget, $rule );
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
    }

    public function emit(): void {
        $v2 = self::config_v2();
        $intensity = self::intensity();

        // Resolve per-widget config for the active template (v1 shim).
        $anims = [];
        $active_slug = '';
        if ( $this->templates ) {
            $active = $this->templates->active();
            if ( $active ) {
                $active_slug = (string) $active['slug'];
                $anims       = $this->presets_for( $active_slug );
            }
        }

        /**
         * Filter — modify per-widget animation config before serialize.
         * @param array  $anims        widget_slug => { entrance, stagger, trigger, duration }
         * @param string $active_slug  active template slug (or '')
         * @param string $intensity    resolved intensity
         */
        $anims = (array) apply_filters( 'tempaloo_studio_anims', $anims, $active_slug, $intensity );

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
        ] );
        $payload_anims = wp_json_encode( (object) $anims );

        // v2 runtime payload — consumed by the new resolver in animations.js.
        // Includes element rules + widget overrides for the active template
        // + the slim element-types selector map. Capped to active template
        // to avoid leaking unrelated slugs to the front-end.
        $payload_v2 = wp_json_encode( [
            'globals'           => $v2['globals'],
            'elementRules'      => $v2['elementRules'],
            'widgetOverrides'   => $active_slug !== '' && isset( $v2['widgetOverrides'][ $active_slug ] )
                                        ? $v2['widgetOverrides'][ $active_slug ]
                                        : new \stdClass(),
            'selectorOverrides' => self::selector_overrides() ?: new \stdClass(),
            'elementTypes'      => (object) $element_types,
            'templateSlug'      => $active_slug,
        ] );

        if ( ! is_string( $payload_legacy ) || ! is_string( $payload_anims ) || ! is_string( $payload_v2 ) ) return;

        echo "\n<script id=\"tempaloo-studio-animation-config\">"
            . "window.tempaloo=window.tempaloo||{};"
            . "window.tempaloo.studio=window.tempaloo.studio||{};"
            . "window.tempaloo.studio.animation=" . $payload_legacy . ";"
            . "window.tempaloo.studio.anims="     . $payload_anims  . ";"
            . "window.tempaloo.studio.animV2="    . $payload_v2     . ";"
            . "</script>\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    }
}
