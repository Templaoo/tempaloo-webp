<?php
/**
 * Floating_Panel — surface a color-editing panel on the frontend +
 * inside the Elementor preview iframe, for logged-in admins only.
 *
 * Why a separate mount point (not the React admin page):
 *   - The admin page (wp-admin/admin.php?page=tempaloo-studio) is a
 *     standalone screen — you can't see the page you're editing.
 *   - The floating panel renders WHERE the user is looking — on the
 *     actual Avero pages or inside Elementor's preview. Live preview
 *     via document.documentElement.style.setProperty() reflects edits
 *     instantly on whatever's behind the panel.
 *
 * Bundle reuse: enqueues the existing build/admin.{js,css}. The React
 * entry detects which mount point exists (admin-root vs floating-root)
 * and renders the appropriate UI. No second bundle to maintain.
 *
 * Capability gate: manage_options ONLY. Visitors and editors never
 * see the panel — they don't even get the bundle enqueued, so zero
 * frontend bloat for non-admins.
 *
 * @package Tempaloo\Studio\Frontend
 */

namespace Tempaloo\Studio\Frontend;

defined( 'ABSPATH' ) || exit;

final class Floating_Panel {

    public function register(): void {
        // wp_enqueue_scripts + wp_footer cover BOTH the public frontend
        // AND the Elementor preview iframe (the iframe loads the post
        // URL with elementor-preview=1 — it's still a frontend render).
        // No need for separate elementor/preview/* hooks here, which
        // would double-mount the React root.
        add_action( 'wp_enqueue_scripts', [ $this, 'enqueue' ],     20 );
        add_action( 'wp_footer',          [ $this, 'render_mount' ], 5 );
    }

    /**
     * Gate every output behind manage_options. Logged-in editors do
     * not see the panel — there's no risk of a non-admin discovering
     * it via DevTools either, because the assets are never enqueued.
     */
    private function user_allowed(): bool {
        return is_user_logged_in() && current_user_can( 'manage_options' );
    }

    public function enqueue(): void {
        if ( ! $this->user_allowed() ) return;

        $js  = TEMPALOO_STUDIO_DIR . 'build/admin.js';
        $css = TEMPALOO_STUDIO_DIR . 'build/admin.css';
        if ( ! file_exists( $js ) ) return;

        wp_enqueue_script(
            'tempaloo-studio-floating',
            TEMPALOO_STUDIO_URL . 'build/admin.js',
            [ 'wp-element' ],
            TEMPALOO_STUDIO_VERSION . '-' . filemtime( $js ),
            true
        );
        wp_localize_script( 'tempaloo-studio-floating', 'TempalooStudioBoot', [
            'rest'   => [ 'root' => esc_url_raw( rest_url() ), 'nonce' => wp_create_nonce( 'wp_rest' ) ],
            'admin'  => [ 'url' => admin_url() ],
            'mode'   => 'floating',
            // Shadow-DOM isolation — main.tsx fetches this URL and
            // injects <link rel="stylesheet"> INSIDE the shadow root
            // instead of letting it leak to the document head where
            // the WP theme's `body strong { color: x }` rules can
            // bleed in. The CSS file URL stays the same; only its
            // injection location changes.
            'cssUrl' => file_exists( $css )
                ? TEMPALOO_STUDIO_URL . 'build/admin.css?ver=' . TEMPALOO_STUDIO_VERSION . '-' . filemtime( $css )
                : '',
        ] );

        // We STILL enqueue admin.css in the document head — not for
        // styling (CSS in head can't reach into shadow DOM), but so
        // the browser pre-fetches it. The shadow-root injection in
        // main.tsx then loads it instantly from cache, eliminating
        // the unstyled-flash window.
        if ( file_exists( $css ) ) {
            wp_enqueue_style(
                'tempaloo-studio-floating-css',
                TEMPALOO_STUDIO_URL . 'build/admin.css',
                [],
                TEMPALOO_STUDIO_VERSION . '-' . filemtime( $css )
            );
        }
    }

    public function render_mount(): void {
        if ( ! $this->user_allowed() ) return;
        // Mount point with default dark theme — the panel always uses
        // dark chrome so it stays consistent regardless of the page's
        // light/dark mode underneath.
        echo '<div id="tempaloo-studio-floating-root" data-tsa-theme="dark"></div>';
    }
}
