<?php
defined( 'ABSPATH' ) || exit;

class Tempaloo_WebP_Settings {

    const PAGE  = 'tempaloo-webp';
    const NONCE = 'tempaloo_webp_save';

    public function register() {
        add_action( 'admin_menu', [ $this, 'menu' ] );
        add_action( 'admin_enqueue_scripts', [ $this, 'enqueue' ] );
    }

    public function menu() {
        add_menu_page(
            __( 'Tempaloo WebP', 'tempaloo-webp' ),
            __( 'Tempaloo WebP', 'tempaloo-webp' ),
            'manage_options',
            self::PAGE,
            [ $this, 'render' ],
            self::menu_icon_data_uri(),
            61
        );
        // Keep legacy URL working.
        add_submenu_page(
            'options-general.php',
            __( 'Tempaloo WebP', 'tempaloo-webp' ),
            __( 'Tempaloo WebP', 'tempaloo-webp' ),
            'manage_options',
            self::PAGE,
            [ $this, 'render' ]
        );
    }

    /**
     * Brand-mark SVG encoded for use as a wp-admin menu icon URL.
     *
     * WP renders the data-URI SVG via CSS `mask-image`, which means it
     * COLORIZES automatically based on the user's admin color scheme
     * (light theme → grey-ish, midnight → white, etc.) — exactly like
     * a Dashicon. Two requirements for that to work:
     *   1. The SVG fill must be a real color (we use `#a7aaad`, the
     *      default WP sidebar text tone). If we used `currentColor`
     *      the mask wouldn't apply.
     *   2. No <style> block, no `viewBox=` overrides, no animation —
     *      WP's mask path is destroyed by anything fancy.
     *
     * Same paths as web/public/favicon.svg + web LogoMark "brand".
     */
    private static function menu_icon_data_uri() {
        // viewBox cropped to the actual glyph bbox (300,540 → 1820,1500)
        // so the 20px sidebar slot actually shows a glyph that fills
        // 20×~12.6 px — was ~12×8 px with the original 2048×2048 canvas.
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="300 540 1520 960">'
            . '<path fill="#a7aaad" transform="translate(338,570)" d="m0 0h345l36 3 38 5 26 5 24 6 31 10 21 8 28 12 24 12 18 10 23 14 16 11 19 14 16 13 13 11 15 14 12 11 18 18 7 8 1 3h2l9 11 9 10 14 19 12 16 12 19 15 25 12 23 7 14 13 31 10 28 8 26 9 39 5 30 3 26 2 32v35l-2 30-4 31-7 36-8 30-11 33-11 27-14 32-16 34-13 28-14 30-11 24-1 1h-395l3-9 17-35 13-28 19-40 28-60 16-34 13-28 16-34 13-28 32-68 13-28 13-27 11-24 19-40 14-30 10-22 11-22h-422l-4-4-10-17-12-21-13-22-14-24-15-26-10-17-15-26-8-13-9-16-10-17-15-26-11-18-13-23-8-13-12-21-10-17-10-18-6-10z"/>'
            . '<path fill="#a7aaad" transform="translate(1112,570)" d="m0 0h394l6 9 12 21 7 12 8 13 16 28 17 29 16 27 14 24 13 23 8 13 12 20 11 20 28 48 13 22 16 28 6 11v3h-215l-24-2-29-5-20-5-25-8-22-9-28-14-18-11-18-13-13-10-11-10-8-7-18-18-9-11-11-13-13-18-11-18-16-28-10-17-16-28-8-13-8-14-10-17-13-22-10-17-11-19z"/>'
            . '</svg>';
        return 'data:image/svg+xml;base64,' . base64_encode( $svg );
    }

    public function enqueue( $hook ) {
        if ( ! $this->is_plugin_page( $hook ) ) {
            // Only enqueue bulk/license admin assets on our page.
            return;
        }
        $build = TEMPALOO_WEBP_DIR . 'build/';
        if ( ! file_exists( $build . 'admin.js' ) ) {
            return; // build not ran yet
        }
        wp_enqueue_script(
            'tempaloo-webp-app',
            TEMPALOO_WEBP_URL . 'build/admin.js',
            [],
            TEMPALOO_WEBP_VERSION,
            true
        );
        wp_enqueue_style(
            'tempaloo-webp-app',
            TEMPALOO_WEBP_URL . 'build/admin.css',
            [],
            TEMPALOO_WEBP_VERSION
        );

        $state = ( new Tempaloo_WebP_REST() )->state_response()->get_data();

        wp_add_inline_script(
            'tempaloo-webp-app',
            'window.TempalooBoot = ' . wp_json_encode( [
                'rest' => [
                    'root'  => esc_url_raw( rest_url() ),
                    'nonce' => wp_create_nonce( 'wp_rest' ),
                ],
                'ajax' => [
                    'url'   => admin_url( 'admin-ajax.php' ),
                    'nonce' => wp_create_nonce( Tempaloo_WebP_Bulk::NONCE ),
                ],
                'activateUrl' => add_query_arg(
                    [
                        'site'   => rawurlencode( home_url() ),
                        'return' => rawurlencode( admin_url( 'admin.php?page=' . self::PAGE ) ),
                    ],
                    TEMPALOO_WEBP_ACTIVATE_URL
                ),
                // Exposed so the React admin can fetch the public plans feed
                // (GET /v1/plans) directly instead of hardcoding pricing.
                'apiBase' => esc_url_raw( TEMPALOO_WEBP_API_BASE ),
                'siteUrl' => home_url(),
                'state'   => $state,
            ] ) . ';',
            'before'
        );
    }

    private function is_plugin_page( $hook ) {
        return in_array( $hook, [
            'toplevel_page_' . self::PAGE,
            'settings_page_' . self::PAGE,
        ], true );
    }

    public function render() {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }
        $build_exists = file_exists( TEMPALOO_WEBP_DIR . 'build/admin.js' );
        ?>
        <div id="tempaloo-app-root">
            <div id="tempaloo-app"></div>
            <?php if ( ! $build_exists ) : ?>
                <div class="notice notice-error" style="margin:20px;">
                    <p>
                        <strong>Tempaloo WebP:</strong> UI bundle not found. Run
                        <code>cd plugin/tempaloo-webp/admin-app &amp;&amp; npm install &amp;&amp; npm run build</code>
                        to generate it.
                    </p>
                </div>
            <?php endif; ?>
        </div>
        <?php
    }
}
