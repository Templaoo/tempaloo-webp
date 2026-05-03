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
use Tempaloo\Studio\Elementor\Animation;

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

        // ── Editor preview detection — PHP-side, before any JS runs.
        //
        // The recurring "live preview is blank" bug came from a JS
        // timing race: widget-base.js detected edit mode via
        // `elementorFrontend.isEditMode()`, but elementorFrontend.js
        // loads AFTER our runtime, so on first DOMContentLoaded the
        // body class was never added → CSS safety net inactive →
        // widgets stuck at opacity:0 from gsap.set().
        //
        // Detecting edit mode in PHP via Elementor's preview API runs
        // BEFORE any JS executes, so the body class is on the markup
        // the browser parses. Zero timing race possible.
        if ( $this->is_elementor_preview() ) {
            $classes[] = 'tempaloo-edit-mode';            // matches the JS-set class for parity
            $classes[] = 'tempaloo-studio-edit-mode';     // PHP-prefixed twin so debug audits can tell them apart
        }
        return $classes;
    }

    /**
     * Are we currently rendering inside Elementor's editor preview
     * iframe? Defensively guarded so a missing/old Elementor version
     * (or running on the public frontend) returns false safely.
     */
    private function is_elementor_preview(): bool {
        if ( ! did_action( 'elementor/loaded' ) ) return false;
        if ( ! class_exists( '\\Elementor\\Plugin' ) ) return false;
        $instance = \Elementor\Plugin::$instance ?? null;
        if ( ! $instance || empty( $instance->preview ) ) return false;
        if ( ! method_exists( $instance->preview, 'is_preview_mode' ) ) return false;
        return (bool) $instance->preview->is_preview_mode();
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

        // ── Plugin-wide JS runtime (ALWAYS loaded) ─────────────
        // Provides delegate() + onReady() — needed even when animation
        // is disabled because widgets bind clicks (header drawer, FAQ
        // accordion, testimonials dots) through this layer.
        $runtime_js = TEMPALOO_STUDIO_DIR . 'assets/js/widget-base.js';
        if ( file_exists( $runtime_js ) ) {
            wp_register_script(
                'tempaloo-studio-runtime',
                TEMPALOO_STUDIO_URL . 'assets/js/widget-base.js',
                [],
                TEMPALOO_STUDIO_VERSION . '-' . filemtime( $runtime_js ),
                true
            );
            wp_enqueue_script( 'tempaloo-studio-runtime' );
        }

        // PERF — Lazy plugin loading (Sprint 1 / point #1, inspired by
        // Motion.page). Three reasons to NOT load GSAP at all:
        //
        //   1. intensity = off → user explicitly disabled motion.
        //   2. has_active_rules() = false → no Element Rule / Widget
        //      Override / Selector Override has been configured. Loading
        //      120 KB of JS to animate nothing is pure waste.
        //   3. Builders / editor preview iframes — handled below by the
        //      ts.editAware safety net.
        //
        // EXCEPTION — admins with `manage_options` always get GSAP +
        // animations.js so the floating-panel "Animate Mode" picker can
        // call applyRuleToElement() interactively. This is the
        // "always-loaded for editors" rule from the gsap-react skill.
        $animation_off = ( Animation::intensity() === 'off' );
        $has_rules     = Animation::has_active_rules();
        $is_admin_user = function_exists( 'current_user_can' ) && current_user_can( 'manage_options' );

        $skip_animations = $animation_off || ( ! $has_rules && ! $is_admin_user );

        $global_js = $template['global_js'] ?? 'global.js';
        if ( file_exists( $dir . $global_js ) && ! $skip_animations ) {
            // GSAP source: LOCAL by default — bundled with the plugin
            // at assets/vendor/. This is the right default for shipped
            // premium plugins:
            //   - No external dependency (jsdelivr.net) — passes
            //     ThemeForest / WordPress.org review without flags.
            //   - No GDPR concern (privacy auditors flag CDN requests).
            //   - Works in restrictive networks (China firewall, strict
            //     corporate CSPs, offline / staging environments).
            //   - Saves ~150ms on first paint (no DNS + TLS to jsdelivr).
            //
            // Opt-in CDN fallback for sites that prefer the shared cache:
            //
            //   define( 'TEMPALOO_STUDIO_GSAP_CDN', true );
            //
            // GSAP version pinned: 3.12.5 (Free license — no Club plugins).
            $local_gsap = TEMPALOO_STUDIO_DIR . 'assets/vendor/gsap.min.js';
            $local_st   = TEMPALOO_STUDIO_DIR . 'assets/vendor/ScrollTrigger.min.js';
            $use_cdn    = ( defined( 'TEMPALOO_STUDIO_GSAP_CDN' ) && TEMPALOO_STUDIO_GSAP_CDN )
                       || ! file_exists( $local_gsap )
                       || ! file_exists( $local_st );

            $gsap_src = $use_cdn
                ? 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js'
                : TEMPALOO_STUDIO_URL . 'assets/vendor/gsap.min.js';
            $st_src   = $use_cdn
                ? 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js'
                : TEMPALOO_STUDIO_URL . 'assets/vendor/ScrollTrigger.min.js';

            wp_register_script( 'tempaloo-studio-gsap',          $gsap_src, [],                              '3.12.5', true );
            wp_register_script( 'tempaloo-studio-scrolltrigger', $st_src,   [ 'tempaloo-studio-gsap' ],      '3.12.5', true );

            // Plugin-wide animation engine — driven by data-attributes on
            // widget markup + window.tempaloo.studio.anims config. Adds
            // entrance presets (fade-up / scale-in / blur-in / mask /
            // …) and behavioral animations (counter, magnetic, marquee).
            $anim_js = TEMPALOO_STUDIO_DIR . 'assets/js/animations.js';
            if ( file_exists( $anim_js ) ) {
                wp_register_script(
                    'tempaloo-studio-animations',
                    TEMPALOO_STUDIO_URL . 'assets/js/animations.js',
                    [ 'tempaloo-studio-runtime', 'tempaloo-studio-gsap', 'tempaloo-studio-scrolltrigger' ],
                    TEMPALOO_STUDIO_VERSION . '-' . filemtime( $anim_js ),
                    true
                );
                // Force-enqueue so animations work on every page that
                // hosts a Tempaloo widget — no need for each widget to
                // re-declare the dep.
                wp_enqueue_script( 'tempaloo-studio-animations' );
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
