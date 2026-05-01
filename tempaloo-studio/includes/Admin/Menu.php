<?php
/**
 * Admin\Menu — top-level WP admin menu page that mounts the React app.
 *
 * Phase 1 scope: just the menu entry and the React mount point. The
 * React app itself is wired in a later sprint. For now the page
 * shows a "Phase 1 — coming soon" placeholder so we can verify the
 * plugin boots cleanly inside wp-admin.
 *
 * @package Tempaloo\Studio\Admin
 */

namespace Tempaloo\Studio\Admin;

defined( 'ABSPATH' ) || exit;

final class Menu {

    public function register(): void {
        add_action( 'admin_menu',            [ $this, 'add_menu' ] );
        add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_admin_assets' ] );
    }

    public function add_menu(): void {
        add_menu_page(
            esc_html__( 'Tempaloo Studio', 'tempaloo-studio' ),
            esc_html__( 'Tempaloo Studio', 'tempaloo-studio' ),
            'manage_options',
            'tempaloo-studio',
            [ $this, 'render_root' ],
            $this->menu_icon(),
            58
        );
    }

    /**
     * Build a base64 data URI of the brand iconmark for the admin
     * sidebar. WordPress applies a CSS filter to recolor the SVG to
     * match the sidebar palette, so the source SVG just needs to be
     * a single-color silhouette (fill="black"). Falls back to a
     * neutral dashicon if the asset is missing for any reason.
     */
    private function menu_icon(): string {
        $path = TEMPALOO_STUDIO_DIR . 'assets/admin/menu-icon.svg';
        if ( ! file_exists( $path ) ) return 'dashicons-art';
        $svg = file_get_contents( $path );
        if ( ! is_string( $svg ) || $svg === '' ) return 'dashicons-art';
        return 'data:image/svg+xml;base64,' . base64_encode( $svg );
    }

    public function render_root(): void {
        echo '<div class="wrap"><div id="tempaloo-studio-admin-root"></div></div>';
    }

    public function enqueue_admin_assets( string $hook ): void {
        if ( $hook !== 'toplevel_page_tempaloo-studio' ) return;
        // React bundle will land at build/admin.{js,css} once the
        // admin-app is wired up. Until then we no-op gracefully.
        $js  = TEMPALOO_STUDIO_DIR . 'build/admin.js';
        $css = TEMPALOO_STUDIO_DIR . 'build/admin.css';
        if ( file_exists( $js ) ) {
            wp_enqueue_script(
                'tempaloo-studio-admin',
                TEMPALOO_STUDIO_URL . 'build/admin.js',
                [ 'wp-element' ],
                TEMPALOO_STUDIO_VERSION . '-' . filemtime( $js ),
                true
            );
            wp_localize_script( 'tempaloo-studio-admin', 'TempalooStudioBoot', [
                'rest'  => [ 'root' => esc_url_raw( rest_url() ), 'nonce' => wp_create_nonce( 'wp_rest' ) ],
                'admin' => [ 'url' => admin_url() ],
            ] );
        }
        if ( file_exists( $css ) ) {
            wp_enqueue_style(
                'tempaloo-studio-admin',
                TEMPALOO_STUDIO_URL . 'build/admin.css',
                [],
                TEMPALOO_STUDIO_VERSION . '-' . filemtime( $css )
            );
        }
    }
}
