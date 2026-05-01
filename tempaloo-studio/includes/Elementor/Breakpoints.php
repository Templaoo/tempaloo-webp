<?php
/**
 * Breakpoints — sync the active site's Elementor breakpoints with
 * Tempaloo Studio templates so widgets respond natively to whatever
 * the user configured in Site Settings → Layout → Breakpoints.
 *
 * Elementor ships SIX breakpoint slots; only some are active by default:
 *
 *   alias          | default value | direction | active by default
 *   ---------------|---------------|-----------|-------------------
 *   mobile         |  767px        | max-width | yes
 *   mobile_extra   |  880px        | max-width | NO (user-toggle)
 *   tablet         | 1024px        | max-width | yes
 *   tablet_extra   | 1200px        | max-width | NO
 *   laptop         | 1366px        | max-width | NO
 *   widescreen     | 2400px        | MIN-width | NO  (note direction)
 *
 * Two outputs:
 *   1. <style id="tempaloo-studio-breakpoints"> — exposes each ACTIVE
 *      breakpoint's value as a CSS custom property
 *      (--tw-bp-{alias}). Informational + usable in calc().
 *   2. <script id="tempaloo-studio-breakpoints-js"> — exposes the
 *      same map at window.tempaloo.studio.breakpoints, AND a
 *      helper window.tempaloo.studio.bpQuery(alias) that returns
 *      a ready-to-use matchMedia string ("(max-width: 767px)").
 *
 * Plus: when an active breakpoint's value differs from Tempaloo's
 * stock defaults that `global.css` is authored against, we emit a
 * parallel set of rules at the user's custom thresholds. Opt-in
 * per-template via `template.json::responsive_overrides` so we don't
 * blindly try to parse arbitrary CSS at runtime.
 *
 * @package Tempaloo\Studio\Elementor
 */

namespace Tempaloo\Studio\Elementor;

defined( 'ABSPATH' ) || exit;

final class Breakpoints {

    /**
     * Stock Elementor breakpoint values + their direction.
     * Used as fallback when the Elementor API isn't available
     * (early hooks, version mismatch, plugin disabled).
     *
     * "active_default" = whether Elementor activates this slot
     * out of the box (the user can toggle the others on).
     */
    const STOCK = [
        'mobile'       => [ 'value' =>  767, 'direction' => 'max', 'active_default' => true  ],
        'mobile_extra' => [ 'value' =>  880, 'direction' => 'max', 'active_default' => false ],
        'tablet'       => [ 'value' => 1024, 'direction' => 'max', 'active_default' => true  ],
        'tablet_extra' => [ 'value' => 1200, 'direction' => 'max', 'active_default' => false ],
        'laptop'       => [ 'value' => 1366, 'direction' => 'max', 'active_default' => false ],
        'widescreen'   => [ 'value' => 2400, 'direction' => 'min', 'active_default' => false ],
    ];

    private Template_Manager $templates;

    public function __construct( Template_Manager $templates ) {
        $this->templates = $templates;
    }

    public function register(): void {
        // Emit before global.css so custom-property fallbacks resolve early.
        add_action( 'wp_head',                   [ $this, 'emit' ], 6 );
        add_action( 'elementor/editor/wp_head',  [ $this, 'emit' ], 6 );
        add_action( 'elementor/preview/wp_head', [ $this, 'emit' ], 6 );
    }

    public function emit(): void {
        $template = $this->templates->active();
        if ( ! $template ) return;

        $active = $this->active_breakpoints();

        $this->emit_css( $active, $template );
        $this->emit_js( $active );
    }

    /**
     * Build the active breakpoint map: alias → { value, direction }.
     * Returns whichever breakpoints Elementor reports as active. If
     * the API is unavailable, falls back to the stock defaults that
     * Elementor ships ON out of the box (mobile + tablet only).
     *
     * @return array<string, array{value:int,direction:string}>
     */
    private function active_breakpoints(): array {
        $stock_active = array_filter( self::STOCK, static fn( $b ) => $b['active_default'] );
        $fallback = [];
        foreach ( $stock_active as $alias => $b ) {
            $fallback[ $alias ] = [ 'value' => $b['value'], 'direction' => $b['direction'] ];
        }

        if ( ! class_exists( '\Elementor\Plugin' ) ) return $fallback;
        $plugin = \Elementor\Plugin::$instance;
        if ( ! $plugin || empty( $plugin->breakpoints ) ) return $fallback;
        if ( ! method_exists( $plugin->breakpoints, 'get_active_breakpoints' ) ) return $fallback;

        $bps = $plugin->breakpoints->get_active_breakpoints();
        if ( ! is_array( $bps ) || empty( $bps ) ) return $fallback;

        $out = [];
        foreach ( $bps as $alias => $bp ) {
            if ( ! is_object( $bp ) ) continue;
            $value = method_exists( $bp, 'get_value' )     ? (int)    $bp->get_value()     : 0;
            $dir   = method_exists( $bp, 'get_direction' ) ? (string) $bp->get_direction() : 'max';
            if ( $value <= 0 ) continue;
            $alias_clean = sanitize_key( (string) $alias );
            if ( $alias_clean === '' ) continue;
            // Only allow 'min' or 'max' — anything else gets canonicalized
            // to 'max' which is by far the common case.
            $dir = in_array( $dir, [ 'min', 'max' ], true ) ? $dir : 'max';
            $out[ $alias_clean ] = [ 'value' => $value, 'direction' => $dir ];
        }
        return empty( $out ) ? $fallback : $out;
    }

    /**
     * Emit:
     *   - :root { --tw-bp-{alias}: {value}px; ... }
     *   - per-template responsive overrides if any active breakpoint
     *     value differs from the template's authored defaults.
     */
    private function emit_css( array $bps, array $template ): void {
        $vars = '';
        foreach ( $bps as $alias => $bp ) {
            $vars .= '--tw-bp-' . $alias . ':' . (int) $bp['value'] . 'px;';
        }

        $overrides = $this->build_responsive_overrides( $bps, $template );

        if ( $vars === '' && $overrides === '' ) return;

        echo "\n<style id=\"tempaloo-studio-breakpoints\">\n";
        if ( $vars !== '' ) echo ':root{' . $vars . "}\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        if ( $overrides !== '' ) echo $overrides; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        echo "</style>\n";
    }

    /**
     * Walk template.json::responsive_overrides and emit re-applied rules
     * at the active site's breakpoint values when they differ from the
     * stock values that global.css was authored against.
     *
     * Schema (declared per-template, supports both directions):
     *   "responsive_overrides": [
     *     {
     *       "alias":     "tablet",        // any of the 6 Elementor slots
     *       "direction": "max",           // "max" or "min" (defaults to "max")
     *       "default":   1024,            // value used in global.css authoring
     *       "rules":     ".tw-... { ... }"
     *     }
     *   ]
     *
     * If the alias isn't currently active (e.g., template defines a rule
     * for `widescreen` but the site hasn't enabled it), we skip — there's
     * nothing to override against. If the alias IS active and its value
     * matches the template default, we skip too (no override needed).
     */
    private function build_responsive_overrides( array $bps, array $template ): string {
        $defs = $template['responsive_overrides'] ?? null;
        if ( ! is_array( $defs ) || empty( $defs ) ) return '';

        $out = '';
        foreach ( $defs as $def ) {
            if ( ! is_array( $def ) ) continue;
            $alias    = sanitize_key( (string) ( $def['alias'] ?? '' ) );
            // Back-compat: accept legacy `default_max` as `default` + max direction.
            $default  = (int) ( $def['default'] ?? $def['default_max'] ?? 0 );
            $tpl_dir  = (string) ( $def['direction'] ?? 'max' );
            $tpl_dir  = in_array( $tpl_dir, [ 'min', 'max' ], true ) ? $tpl_dir : 'max';
            $rules    = (string) ( $def['rules'] ?? '' );

            if ( $alias === '' || $default <= 0 || trim( $rules ) === '' ) continue;
            if ( ! isset( $bps[ $alias ] ) ) continue;

            $active_val = (int)    $bps[ $alias ]['value'];
            $active_dir = (string) $bps[ $alias ]['direction'];

            // If the user changed direction (rare — would mean Elementor
            // redefined what `widescreen` means), don't second-guess.
            if ( $active_dir !== $tpl_dir ) continue;
            if ( $active_val === $default ) continue;

            // Sanity check: only allow the same set of CSS chars Theme_Tokens
            // accepts plus { } @ for selectors / blocks. Strips < > " ' which
            // could break out of the <style> block.
            if ( ! preg_match( '/^[a-zA-Z0-9_\-#.,():%\s\/{}@\[\]=*~+>!]+$/', $rules ) ) continue;

            $out .= '@media (' . $active_dir . '-width:' . $active_val . 'px){' . trim( $rules ) . '}';
        }
        return $out;
    }

    /**
     * Expose the breakpoint map to widget JS:
     *   window.tempaloo.studio.breakpoints[alias] = { value, direction }
     *   window.tempaloo.studio.bpQuery(alias)     → "(max-width: 767px)"
     *   window.tempaloo.studio.bpMatches(alias)   → boolean
     *
     * Widgets that want to coordinate with breakpoints (e.g., disable a
     * parallax timeline on mobile) read these instead of hardcoding pixels.
     */
    private function emit_js( array $bps ): void {
        $payload = wp_json_encode( $bps );
        if ( ! is_string( $payload ) ) return;

        $script  = "window.tempaloo=window.tempaloo||{};";
        $script .= "window.tempaloo.studio=window.tempaloo.studio||{};";
        $script .= "window.tempaloo.studio.breakpoints=" . $payload . ";";
        $script .= "window.tempaloo.studio.bpQuery=function(a){"
                .  "var b=(window.tempaloo.studio.breakpoints||{})[a];"
                .  "if(!b)return null;"
                .  "return '('+b.direction+'-width: '+b.value+'px)';"
                .  "};";
        $script .= "window.tempaloo.studio.bpMatches=function(a){"
                .  "var q=window.tempaloo.studio.bpQuery(a);"
                .  "return !!(q&&window.matchMedia&&window.matchMedia(q).matches);"
                .  "};";

        echo "\n<script id=\"tempaloo-studio-breakpoints-js\">" . $script . "</script>\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    }
}
