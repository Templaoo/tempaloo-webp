<?php
/**
 * Theme_Tokens — inject the active template's CSS custom properties at runtime.
 *
 * Every value (color, spacing, font, radius, shadow) shipped by a
 * template lives as a CSS variable. The variables come from
 * template.json::tokens.light + tokens.dark, optionally overridden by
 * the user via the React admin's "Settings" tab (stored in option
 * `tempaloo_studio_theme_overrides`).
 *
 * We emit ONE inline <style> block in the document head, so the
 * runtime cost is zero extra HTTP request and the cascade is fully
 * controlled.
 *
 * @package Tempaloo\Studio\Elementor
 */

namespace Tempaloo\Studio\Elementor;

defined( 'ABSPATH' ) || exit;

final class Theme_Tokens {

    const OVERRIDES_OPTION = 'tempaloo_studio_theme_overrides';

    private Template_Manager $templates;

    public function __construct( Template_Manager $templates ) {
        $this->templates = $templates;
    }

    public function register(): void {
        // FOUC prevention — runs first so data-theme is on <html>
        // before the body even paints.
        add_action( 'wp_head',                   [ $this, 'emit_theme_boot' ], 4 );
        add_action( 'elementor/editor/wp_head',  [ $this, 'emit_theme_boot' ], 4 );
        add_action( 'elementor/preview/wp_head', [ $this, 'emit_theme_boot' ], 4 );

        // Frontend: high priority so the variables are available
        // before the active template's global.css starts consuming them.
        add_action( 'wp_head',       [ $this, 'emit' ], 5 );
        // Editor: same, so the editor preview matches the live site.
        add_action( 'elementor/editor/wp_head',  [ $this, 'emit' ], 5 );
        add_action( 'elementor/preview/wp_head', [ $this, 'emit' ], 5 );

        // Elementor globals bridge — runs LATE (priority 100) so it
        // wins over Elementor's own kit CSS, which is enqueued via
        // wp_print_styles at priority 8. Maps native Elementor system
        // tokens (--e-global-color-*, --e-global-typography-*) onto
        // our --tw-{slug}-* tokens, so when the user adds a native
        // Elementor widget (Heading, Text Editor, Button, …) and
        // assigns a "Global" color or typography to it, the widget
        // automatically picks up the active template's design system
        // — without touching Elementor's stored Active Kit data.
        add_action( 'wp_head',                   [ $this, 'emit_elementor_bridge' ], 100 );
        add_action( 'elementor/editor/wp_head',  [ $this, 'emit_elementor_bridge' ], 100 );
        add_action( 'elementor/preview/wp_head', [ $this, 'emit_elementor_bridge' ], 100 );
    }

    /**
     * Tiny synchronous script injected at the top of <head>. Reads the
     * persisted theme from localStorage (or prefers-color-scheme), then
     * sets data-theme on <html> BEFORE the body renders → no flash of
     * incorrect theme on first paint.
     */
    public function emit_theme_boot(): void {
        $script = "(function(){try{var s=localStorage.getItem('tempaloo-studio-theme');"
                . "var m=(s==='dark'||s==='light')?s:"
                . "((window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');"
                . "document.documentElement.setAttribute('data-theme',m);"
                . "}catch(e){document.documentElement.setAttribute('data-theme','light');}})();";
        echo "\n<script id=\"tempaloo-studio-theme-boot\">" . $script . "</script>\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    }

    public function emit(): void {
        $template = $this->templates->active();
        if ( ! $template ) return;

        $tokens = $template['tokens'] ?? [];
        $light  = $this->merge_overrides( $tokens['light'] ?? [], $template['slug'], 'light' );
        $dark   = $this->merge_overrides( $tokens['dark']  ?? [], $template['slug'], 'dark' );
        $dark_selector = isset( $tokens['dark_selector'] ) && is_string( $tokens['dark_selector'] )
            ? $tokens['dark_selector']
            : '[data-theme="dark"]';

        $css  = ":root{" . $this->vars_to_css( $light ) . "}";
        $css .= $dark_selector . "{" . $this->vars_to_css( $dark ) . "}";

        // Page-level baseline: when our template is active, body
        // background + text color + body font follow the same tokens
        // as the widgets so the area surrounding our widgets matches.
        // Slugified prefix — works for any template, light or dark
        // because it consumes the same vars the widgets consume.
        $slug   = $template['slug'];
        $prefix = '--tw-' . $this->short_slug( $slug );
        $css   .= "body.tempaloo-studio-" . $slug . "{"
                . "background:var(" . $prefix . "-bg);"
                . "color:var(" . $prefix . "-text);"
                . "font-family:var(" . $prefix . "-font-body, inherit);"
                . "}";

        echo "\n<style id=\"tempaloo-studio-tokens\">\n" . $css . "\n</style>\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    }

    /**
     * Bridge between native Elementor widget styles and our token system.
     *
     * Elementor stores its 4 system colors + 4 system typographies in the
     * Active Kit (a special elementor_library post). It compiles them
     * into CSS variables every native widget reads via "Global Color" /
     * "Global Typography" pickers:
     *
     *   --e-global-color-primary | -secondary | -text | -accent
     *   --e-global-typography-{primary|secondary|text|accent}-font-family
     *   --e-global-typography-{...}-font-size
     *   --e-global-typography-{...}-font-weight
     *   --e-global-typography-{...}-line-height
     *
     * Without this bridge, those vars resolve to whatever the user has
     * (or hasn't) configured in Site Settings — usually Elementor's
     * factory defaults that look NOTHING like our Avero design system.
     *
     * What we do: emit a `:root{}` block that REDIRECTS the e-global-*
     * vars to our --tw-{slug}-* tokens. Source order matters — we run
     * at wp_head priority 100, AFTER Elementor's kit CSS (which loads
     * with wp_print_styles around priority 8). Native widgets that use
     * "Global" pickers now pick up the active template's design system
     * automatically. Widgets with manually-set values (Custom color,
     * Custom typography) keep their explicit value — we don't touch
     * that path.
     *
     * Filterable via `tempaloo_studio_elementor_bridge` (return false to
     * disable for sites that prefer Elementor's own kit).
     */
    public function emit_elementor_bridge(): void {
        $template = $this->templates->active();
        if ( ! $template ) return;

        /**
         * Filter — opt out of the Elementor globals bridge.
         *
         * @param bool   $enabled  Defaults to true. Return false to skip emission.
         * @param string $slug     Active template slug.
         */
        $enabled = apply_filters( 'tempaloo_studio_elementor_bridge', true, (string) $template['slug'] );
        if ( ! $enabled ) return;

        $slug   = $template['slug'];
        $prefix = '--tw-' . $this->short_slug( $slug );

        // Map Elementor's 4 system colors onto our semantic tokens.
        // The choice of which --tw-* corresponds to which e-global is
        // a deliberate UX decision: when a user picks "Primary" in
        // Elementor's color picker, they expect the brand color → we
        // map to --tw-{slug}-accent. "Text" → text. "Secondary" gets
        // the soft text shade so headings vs body have hierarchy.
        $map_colors = [
            'primary'   => $prefix . '-accent',
            'secondary' => $prefix . '-text-soft',
            'text'      => $prefix . '-text',
            'accent'    => $prefix . '-accent-hover',
        ];
        // Map Elementor's 4 system typographies onto our 2 font tokens.
        // Primary + Secondary → heading font (most users put H1/H2 on
        // these). Text + Accent → body font. Authors who want different
        // splits can opt out via the filter and configure manually.
        $map_fonts = [
            'primary'   => $prefix . '-font-heading',
            'secondary' => $prefix . '-font-heading',
            'text'      => $prefix . '-font-body',
            'accent'    => $prefix . '-font-body',
        ];

        $decls = '';
        foreach ( $map_colors as $key => $var ) {
            $decls .= '--e-global-color-' . $key . ':var(' . $var . ');';
        }
        foreach ( $map_fonts as $key => $var ) {
            $decls .= '--e-global-typography-' . $key . '-font-family:var(' . $var . ');';
        }

        // Sensible default sizes / weights / line-heights so authors
        // don't have to set them manually for the bridge to look good.
        // These can be overridden in Site Settings → Design System
        // (those values land in :root via Elementor's kit CSS at lower
        // priority and lose to our :root here — but the user can still
        // opt out of the whole bridge via the filter above).
        $decls .= '--e-global-typography-primary-font-weight:600;';
        $decls .= '--e-global-typography-primary-line-height:1.15;';
        $decls .= '--e-global-typography-secondary-font-weight:500;';
        $decls .= '--e-global-typography-secondary-line-height:1.25;';
        $decls .= '--e-global-typography-text-font-weight:400;';
        $decls .= '--e-global-typography-text-line-height:1.55;';
        $decls .= '--e-global-typography-accent-font-weight:500;';
        $decls .= '--e-global-typography-accent-line-height:1.45;';

        $body_class = 'body.tempaloo-studio-' . $slug;
        $css  = ':root{' . $decls . '}';

        // Belt-and-suspenders: also force the font-family on native
        // Elementor widgets that DON'T use Global Typography (their
        // "Default" setting). Scoped under the active-template body
        // class so it only kicks in on pages that ship our design.
        // Selectors target the inner element Elementor renders the
        // text into — using `:where()` to keep specificity at 0,0,1,2
        // so author overrides on individual widgets still win.
        $css .= $body_class . ' :where(.elementor-widget-heading .elementor-heading-title){'
              . 'font-family:var(' . $prefix . '-font-heading,inherit);}';
        $css .= $body_class . ' :where(.elementor-widget-text-editor,.elementor-widget-text-editor p,.elementor-widget-text-editor li){'
              . 'font-family:var(' . $prefix . '-font-body,inherit);}';
        $css .= $body_class . ' :where(.elementor-widget-button .elementor-button){'
              . 'font-family:var(' . $prefix . '-font-body,inherit);}';

        echo "\n<style id=\"tempaloo-studio-elementor-bridge\">\n" . $css . "\n</style>\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    }

    /**
     * Templates declare CSS variables under a SHORT slug so the
     * variable name doesn't get verbose: token prefix is the first
     * segment of the template slug. e.g. avero-consulting → "avero".
     * Falls back to the full slug if there's no dash.
     */
    private function short_slug( string $slug ): string {
        $first = explode( '-', $slug )[0] ?? $slug;
        return preg_replace( '/[^a-z0-9-]/', '', strtolower( $first ) );
    }

    /**
     * Apply user overrides on top of the template defaults.
     * Overrides are stored as: [template_slug => [mode => [var_name => value]]]
     */
    private function merge_overrides( array $defaults, string $template_slug, string $mode ): array {
        $all = get_option( self::OVERRIDES_OPTION, [] );
        $overrides = $all[ $template_slug ][ $mode ] ?? [];
        if ( ! is_array( $overrides ) ) $overrides = [];
        $merged = $overrides ? array_merge( $defaults, $overrides ) : $defaults;
        /**
         * Filter — final say on the token map for a (template, mode)
         * pair right before it's compiled to CSS. Use cases: temporary
         * branding on holidays, A/B-testing colors, white-label forks.
         *
         * @param array  $merged          var_name => value
         * @param string $template_slug   active template slug
         * @param string $mode            "light" | "dark"
         * @param array  $defaults        template's shipped defaults (no overrides)
         * @param array  $overrides       user-saved overrides only
         */
        return (array) apply_filters( 'tempaloo_studio_tokens', $merged, $template_slug, $mode, $defaults, $overrides );
    }

    /**
     * Render { --var: value; --var2: value2; } sanitizing values
     * against an allowlist regex (hex, rgb/rgba, hsl/hsla, var(),
     * calc(), keywords, plain numeric+unit). XSS-safe by construction.
     */
    private function vars_to_css( array $vars ): string {
        $out = '';
        foreach ( $vars as $name => $value ) {
            if ( ! is_string( $name ) || strpos( $name, '--' ) !== 0 ) continue;
            $name  = preg_replace( '/[^a-zA-Z0-9_-]/', '', $name );
            $value = (string) $value;
            // Allowlist: hex / rgb / hsl / var() / calc() / linear-gradient(…) /
            // numeric+unit / keywords / quoted font-family lists. Quotes are
            // SAFE inside a CSS value (they don't terminate the <style>
            // block — that requires the literal "</style>" sequence). What
            // we still ban: < > ; { } which could break the rule structure.
            if ( ! preg_match( '/^[a-zA-Z0-9_\-#.,():%\s\/\'"]+$/', $value ) ) continue;
            // Defense in depth: kill any literal closing-style-tag attempt.
            if ( stripos( $value, '</style' ) !== false ) continue;
            $out .= $name . ':' . $value . ';';
        }
        return $out;
    }
}
