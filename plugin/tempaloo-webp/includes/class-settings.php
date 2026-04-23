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
            'dashicons-images-alt2',
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
