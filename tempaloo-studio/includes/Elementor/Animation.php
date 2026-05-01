<?php
/**
 * Animation — emits the user's animation intensity to the runtime so
 * widget JS can branch on it.
 *
 * Phase 0.2 scope: ONE knob — `intensity` ∈ off | subtle | medium | bold.
 * Stored in the option `tempaloo_studio_animation_intensity`.
 *
 *   off    → no GSAP, no scroll triggers, no motion. Pure static render.
 *   subtle → opacity-only fades, short durations. Reduced-motion friendly.
 *   medium → DEFAULT. Designed look — translateY, stagger, scroll triggers.
 *   bold   → bigger transforms, longer durations, more dramatic entrances.
 *
 * Future phases will add per-widget overrides + custom timelines; the data
 * shape stays compatible (everything additive).
 *
 * @package Tempaloo\Studio\Elementor
 */

namespace Tempaloo\Studio\Elementor;

defined( 'ABSPATH' ) || exit;

final class Animation {

    const OPTION    = 'tempaloo_studio_animation_intensity';
    const DEFAULT_  = 'medium';
    const ALLOWED   = [ 'off', 'subtle', 'medium', 'bold' ];

    public static function intensity(): string {
        $v = get_option( self::OPTION, self::DEFAULT_ );
        return in_array( $v, self::ALLOWED, true ) ? $v : self::DEFAULT_;
    }

    public static function set_intensity( string $value ): bool {
        if ( ! in_array( $value, self::ALLOWED, true ) ) return false;
        update_option( self::OPTION, $value );
        return true;
    }

    public function register(): void {
        // Inline-emit on every page so widget JS can read intensity.
        add_action( 'wp_head',                   [ $this, 'emit' ], 7 );
        add_action( 'elementor/editor/wp_head',  [ $this, 'emit' ], 7 );
        add_action( 'elementor/preview/wp_head', [ $this, 'emit' ], 7 );
    }

    public function emit(): void {
        $intensity = self::intensity();
        $payload   = wp_json_encode( [ 'intensity' => $intensity ] );
        if ( ! is_string( $payload ) ) return;
        echo "\n<script id=\"tempaloo-studio-animation-config\">"
            . "window.tempaloo=window.tempaloo||{};"
            . "window.tempaloo.studio=window.tempaloo.studio||{};"
            . "window.tempaloo.studio.animation=" . $payload . ";"
            . "</script>\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    }
}
