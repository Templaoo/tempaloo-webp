<?php
/**
 * Frontend\Assets — register the active template's global CSS / JS
 * + each widget's optional script.js.
 *
 * Registration happens at boot, but enqueueing is gated by Elementor:
 * a script gets actually loaded ONLY when a widget that declares it
 * via get_script_depends() / get_style_depends() is rendered on the
 * page. This is the standard Elementor pattern for performance —
 * plugins that just enqueue everything upfront on every page are
 * the #1 cause of bloated wp_head.
 *
 * @package Tempaloo\Studio\Frontend
 */

namespace Tempaloo\Studio\Frontend;

defined( 'ABSPATH' ) || exit;

use Tempaloo\Studio\Elementor\Template_Manager;

final class Assets {

    private Template_Manager $templates;

    public function __construct( Template_Manager $templates ) {
        $this->templates = $templates;
    }

    public function register(): void {
        // Elementor fires this when it's about to enqueue assets for
        // a page. We declare our handles here so individual widgets
        // can list them via get_script_depends() / get_style_depends().
        add_action( 'wp_enqueue_scripts',                 [ $this, 'register_handles' ], 5 );
        add_action( 'elementor/editor/before_enqueue_scripts', [ $this, 'register_handles' ], 5 );
        add_action( 'elementor/preview/enqueue_styles',   [ $this, 'register_handles' ], 5 );

        // Body class so widget-base.css can apply page-level styles
        // (background + font-family) only when our active template is
        // in scope.
        add_filter( 'body_class',                  [ $this, 'body_class' ] );
        add_filter( 'admin_body_class',            [ $this, 'admin_body_class' ] );
    }

    public function body_class( $classes ) {
        $template = $this->templates->active();
        if ( ! $template ) return $classes;
        $classes[] = 'tempaloo-studio-active';
        $classes[] = 'tempaloo-studio-' . $template['slug'];
        return $classes;
    }

    public function admin_body_class( $classes ) {
        // Returned as a string in admin context.
        $template = $this->templates->active();
        if ( ! $template ) return $classes;
        return $classes . ' tempaloo-studio-active tempaloo-studio-' . $template['slug'];
    }

    public function register_handles(): void {
        $template = $this->templates->active();
        if ( ! $template ) return;

        $slug = $template['slug'];
        $dir  = $template['dir_path'];
        $url  = $template['dir_url'];

        // Plugin-wide widget reset — loaded BEFORE the template's
        // global.css so the template can ride on top. Hikes the
        // specificity floor for every tw-* widget so theme defaults
        // (a, p, h2, ul, …) don't bleed in.
        $base_css = TEMPALOO_STUDIO_DIR . 'assets/css/widget-base.css';
        if ( file_exists( $base_css ) ) {
            wp_register_style(
                'tempaloo-studio-base',
                TEMPALOO_STUDIO_URL . 'assets/css/widget-base.css',
                [],
                TEMPALOO_STUDIO_VERSION . '-' . filemtime( $base_css )
            );
        }

        // Google Fonts — register + force-enqueue the URL declared in
        // the template manifest. Without this, the --tw-{slug}-font-*
        // CSS vars resolve to whatever the browser falls back to
        // (typically Times New Roman / Arial), making heading
        // typography look nothing like the design. Force-enqueue
        // (rather than dep chain) because fonts are page-wide and
        // useful even on pages that contain only one of our widgets.
        $gfonts_url = $template['fonts']['google_fonts_url'] ?? '';
        if ( is_string( $gfonts_url ) && $gfonts_url !== '' && wp_http_validate_url( $gfonts_url ) ) {
            wp_register_style(
                'tempaloo-studio-' . $slug . '-fonts',
                $gfonts_url,
                [],
                null
            );
            wp_enqueue_style( 'tempaloo-studio-' . $slug . '-fonts' );
        }

        // Template global CSS (always one file, named in template.json
        // or defaulting to global.css). Depends on the base layer so
        // it always loads after.
        $global_css = $template['global_css'] ?? 'global.css';
        if ( file_exists( $dir . $global_css ) ) {
            wp_register_style(
                'tempaloo-studio-' . $slug . '-global',
                $url . $global_css,
                [ 'tempaloo-studio-base' ],
                TEMPALOO_STUDIO_VERSION . '-' . filemtime( $dir . $global_css )
            );
        }

        // Template global JS (GSAP boot, ScrollTrigger registration,
        // shared helper namespace window.tempaloo.{template} = {…}).
        $global_js = $template['global_js'] ?? 'global.js';
        if ( file_exists( $dir . $global_js ) ) {
            // GSAP source: CDN by default (lighter dev loop, browser-
            // cache shared with thousands of other GSAP-powered sites,
            // always-fresh version). Switch to bundled local copy by
            // dropping a one-liner in wp-config.php for ThemeForest /
            // CSP-strict / offline production builds:
            //
            //   define( 'TEMPALOO_STUDIO_GSAP_LOCAL', true );
            //
            // When the constant is true, we load assets/vendor/gsap.min.js
            // (must be present in the plugin ZIP — we'll bundle it in
            // the final ship script).
            $use_local_gsap = defined( 'TEMPALOO_STUDIO_GSAP_LOCAL' ) && TEMPALOO_STUDIO_GSAP_LOCAL;
            $gsap_src       = $use_local_gsap
                ? TEMPALOO_STUDIO_URL . 'assets/vendor/gsap.min.js'
                : 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js';
            $st_src         = $use_local_gsap
                ? TEMPALOO_STUDIO_URL . 'assets/vendor/ScrollTrigger.min.js'
                : 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js';

            wp_register_script( 'tempaloo-studio-gsap',          $gsap_src, [],                              '3.12.5', true );
            wp_register_script( 'tempaloo-studio-scrolltrigger', $st_src,   [ 'tempaloo-studio-gsap' ],      '3.12.5', true );

            // Plugin-wide JS runtime — provides delegate(), onReady(),
            // prefersReducedMotion(), isEditMode(). Every widget script
            // depends on this so document-level click delegation is the
            // single place we wire interactivity (see WIDGET-SPEC §14).
            $runtime_js = TEMPALOO_STUDIO_DIR . 'assets/js/widget-base.js';
            if ( file_exists( $runtime_js ) ) {
                wp_register_script(
                    'tempaloo-studio-runtime',
                    TEMPALOO_STUDIO_URL . 'assets/js/widget-base.js',
                    [],
                    TEMPALOO_STUDIO_VERSION . '-' . filemtime( $runtime_js ),
                    true
                );
            }

            wp_register_script(
                'tempaloo-studio-' . $slug . '-global',
                $url . $global_js,
                [ 'tempaloo-studio-runtime', 'tempaloo-studio-gsap', 'tempaloo-studio-scrolltrigger' ],
                TEMPALOO_STUDIO_VERSION . '-' . filemtime( $dir . $global_js ),
                true
            );
        }

        // Per-widget scripts. Convention: widgets/{widget}/script.js
        // gets registered as tempaloo-studio-{widget-slug} so the
        // widget class can return that handle from get_script_depends().
        $declared = is_array( $template['widgets'] ?? null ) ? $template['widgets'] : [];
        foreach ( $declared as $widget_slug ) {
            $widget_slug = sanitize_key( $widget_slug );
            $script      = $dir . 'widgets/' . $widget_slug . '/script.js';
            if ( file_exists( $script ) ) {
                wp_register_script(
                    'tempaloo-studio-' . $widget_slug,
                    $url . 'widgets/' . $widget_slug . '/script.js',
                    [ 'tempaloo-studio-' . $slug . '-global' ],
                    TEMPALOO_STUDIO_VERSION . '-' . filemtime( $script ),
                    true
                );
            }
        }
    }
}
