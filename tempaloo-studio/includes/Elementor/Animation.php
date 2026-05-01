<?php
/**
 * Animation — emits the user's animation intensity AND per-widget
 * preset config to the runtime so widget markup can opt into entrance
 * animations via data attributes alone.
 *
 * Two payloads emitted in the head:
 *
 *   1. window.tempaloo.studio.animation = { intensity }
 *      Global knob: off | subtle | medium | bold.
 *
 *   2. window.tempaloo.studio.anims = {
 *        hero:         { entrance: 'fade-up', stagger: 80, trigger: 'top 85%' },
 *        services:     { entrance: 'fade-up', stagger: 120, trigger: 'top 75%' },
 *        testimonials: { entrance: 'fade', trigger: 'top 80%' },
 *        ...
 *      }
 *      Per-widget presets resolved from:
 *        a. template.json::animations.presets[widget]   (template default)
 *        b. tempaloo_studio_animation_presets[slug][widget] option (user override)
 *
 * Adding a new preset: drop a function in `assets/js/animations.js`'s
 * PRESETS table — no PHP change needed.
 *
 * @package Tempaloo\Studio\Elementor
 */

namespace Tempaloo\Studio\Elementor;

defined( 'ABSPATH' ) || exit;

final class Animation {

    const OPTION_INTENSITY = 'tempaloo_studio_animation_intensity';
    const OPTION_PRESETS   = 'tempaloo_studio_animation_presets';
    const DEFAULT_         = 'medium';
    const ALLOWED          = [ 'off', 'subtle', 'medium', 'bold' ];

    /** Available preset names — must match keys in animations.js PRESETS table. */
    const PRESETS = [
        'none', 'fade', 'fade-up', 'fade-down', 'fade-left', 'fade-right',
        'scale-in', 'blur-in', 'mask-reveal',
    ];

    private ?Template_Manager $templates;

    public function __construct( ?Template_Manager $templates = null ) {
        $this->templates = $templates;
    }

    public static function intensity(): string {
        $v = get_option( self::OPTION_INTENSITY, self::DEFAULT_ );
        return in_array( $v, self::ALLOWED, true ) ? $v : self::DEFAULT_;
    }

    public static function set_intensity( string $value ): bool {
        if ( ! in_array( $value, self::ALLOWED, true ) ) return false;
        update_option( self::OPTION_INTENSITY, $value );
        return true;
    }

    /**
     * Read the resolved per-widget preset config for a template:
     * defaults from template.json overlaid with user overrides.
     */
    public function presets_for( string $template_slug ): array {
        if ( ! $this->templates ) return [];
        $tpl = $this->templates->get( $template_slug );
        if ( ! $tpl ) return [];

        $defaults = is_array( $tpl['animations']['presets'] ?? null ) ? $tpl['animations']['presets'] : [];
        $all      = get_option( self::OPTION_PRESETS, [] );
        if ( ! is_array( $all ) ) $all = [];
        $overrides = is_array( $all[ $template_slug ] ?? null ) ? $all[ $template_slug ] : [];

        $out = [];
        foreach ( $defaults as $widget => $cfg ) {
            $out[ (string) $widget ] = is_array( $cfg ) ? $cfg : [];
        }
        foreach ( $overrides as $widget => $cfg ) {
            if ( ! is_array( $cfg ) ) continue;
            $out[ (string) $widget ] = array_merge( $out[ (string) $widget ] ?? [], $cfg );
        }
        return $out;
    }

    public function set_preset( string $template_slug, string $widget, array $cfg ): bool {
        $clean = $this->sanitize_preset( $cfg );
        $all   = get_option( self::OPTION_PRESETS, [] );
        if ( ! is_array( $all ) ) $all = [];
        if ( ! isset( $all[ $template_slug ] ) || ! is_array( $all[ $template_slug ] ) ) {
            $all[ $template_slug ] = [];
        }
        $all[ $template_slug ][ sanitize_key( $widget ) ] = $clean;
        update_option( self::OPTION_PRESETS, $all );
        return true;
    }

    private function sanitize_preset( array $cfg ): array {
        $out = [];
        if ( ! empty( $cfg['entrance'] ) && in_array( (string) $cfg['entrance'], self::PRESETS, true ) ) {
            $out['entrance'] = (string) $cfg['entrance'];
        }
        if ( isset( $cfg['stagger'] ) ) {
            $s = (int) $cfg['stagger'];
            if ( $s >= 0 && $s <= 1000 ) $out['stagger'] = $s;
        }
        if ( isset( $cfg['duration'] ) ) {
            $d = (float) $cfg['duration'];
            if ( $d >= 0 && $d <= 4 ) $out['duration'] = $d;
        }
        if ( isset( $cfg['trigger'] ) && is_string( $cfg['trigger'] ) ) {
            $t = trim( $cfg['trigger'] );
            // Allow "top 85%", "center 75%", or "none".
            if ( preg_match( '/^(top|center|bottom|none)(\s+\d+%)?$/', $t ) ) {
                $out['trigger'] = $t;
            }
        }
        return $out;
    }

    public function register(): void {
        add_action( 'wp_head',                   [ $this, 'emit' ], 7 );
        add_action( 'elementor/editor/wp_head',  [ $this, 'emit' ], 7 );
        add_action( 'elementor/preview/wp_head', [ $this, 'emit' ], 7 );
    }

    public function emit(): void {
        $intensity = self::intensity();

        // Resolve per-widget config for the active template (if any).
        $anims = [];
        if ( $this->templates ) {
            $active = $this->templates->active();
            if ( $active ) {
                $anims = $this->presets_for( $active['slug'] );
            }
        }

        $payloadIntensity = wp_json_encode( [ 'intensity' => $intensity ] );
        $payloadAnims     = wp_json_encode( (object) $anims );
        if ( ! is_string( $payloadIntensity ) || ! is_string( $payloadAnims ) ) return;

        echo "\n<script id=\"tempaloo-studio-animation-config\">"
            . "window.tempaloo=window.tempaloo||{};"
            . "window.tempaloo.studio=window.tempaloo.studio||{};"
            . "window.tempaloo.studio.animation=" . $payloadIntensity . ";"
            . "window.tempaloo.studio.anims=" . $payloadAnims . ";"
            . "</script>\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    }
}
