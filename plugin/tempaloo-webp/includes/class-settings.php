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
        // Synced with web/public/favicon.svg + plugin React Logo
        // component. Source paths from logos/logo templaoo (1).svg.
        // viewBox tightened to the glyph bbox; WP sidebar uses
        // background-size: 20px auto so the icon ends up 20 × ~14 px.
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 240 1560 1080">'
            . '<path fill="#a7aaad" transform="translate(3,259)" d="m0 0h385l33 2 34 4 32 5 28 6 26 7 25 8 24 9 26 11 25 12 21 11 21 12 19 12 20 14 16 12 9 7 10 8 14 12 24 22 8 8 2 1v2h2l7 8 11 11 7 8 10 11 9 11 12 15 14 19 14 20 17 28 9 16 15 29 12 26 13 34 12 36 10 41 7 36 4 31 3 37v56l-4 44-4 27-7 34-10 37-13 38-11 27-11 25-12 26-13 28-14 30-16 34-11 24-1 1h-448l-1-2 13-28 17-35 13-28 16-34 17-36 16-34 9-20 18-38 16-34 19-41 17-36 16-34 12-26 19-40 16-34 13-28 18-38 13-28 15-31 3-8-480-1-5-6-13-22-16-28-9-15-17-29-15-26-10-17-12-21-13-22-15-26-8-13-11-20-14-23-15-26-16-27-15-26-10-17-10-18-6-11z"/>'
            . '<path fill="#a7aaad" transform="translate(884,259)" d="m0 0h446l8 13 16 28 13 22 17 29 16 28 15 25 13 22 13 23 17 29 17 28 15 27 14 24 17 29 13 22 14 24 10 18 2 4v4h-234l-33-2-27-4-23-5-33-10-21-8-20-9-28-15-17-11-17-12-12-9-10-9-8-7-7-7-8-7-9-9-7-8-11-13-10-13-13-18-13-21-12-21-15-26-12-21-12-20-11-19-34-58-20-34z"/>'
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
        // Belt-and-suspenders against page-cache plugins.
        //
        // wp-admin is normally not cached because logged-in cookies bypass
        // most cache layers. But on hosts running LiteSpeed Cache with
        // aggressive defaults, the inline `window.TempalooBoot` script
        // injected via wp_add_inline_script can end up in a stale snapshot
        // of the page — the user saves a setting, refreshes, and the React
        // app boots from a cached state where their change never happened.
        // nocache_headers() emits Cache-Control: no-cache, no-store,
        // must-revalidate + Pragma: no-cache, which every major cache
        // plugin honors as "skip this page".
        nocache_headers();
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
