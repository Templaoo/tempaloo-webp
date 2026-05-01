<?php
/**
 * Plugin Name:       Tempaloo Studio
 * Plugin URI:        https://tempaloo.com/studio
 * Description:       Premium Elementor template kits with bespoke widgets, light/dark theme tokens, and a React admin to install and tune them in seconds.
 * Version:           0.1.0-alpha
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Tempaloo
 * Author URI:        https://tempaloo.com
 * License:           Proprietary — see LICENSE.txt
 * Text Domain:       tempaloo-studio
 * Elementor tested up to: 3.25.0
 *
 * @package Tempaloo\Studio
 */

defined( 'ABSPATH' ) || exit;

define( 'TEMPALOO_STUDIO_VERSION',   '0.1.0-alpha' );
define( 'TEMPALOO_STUDIO_FILE',      __FILE__ );
define( 'TEMPALOO_STUDIO_DIR',       plugin_dir_path( __FILE__ ) );
define( 'TEMPALOO_STUDIO_URL',       plugin_dir_url( __FILE__ ) );
define( 'TEMPALOO_STUDIO_TEMPLATES', TEMPALOO_STUDIO_DIR . 'templates/' );
define( 'TEMPALOO_STUDIO_TEMPLATES_URL', TEMPALOO_STUDIO_URL . 'templates/' );

// PSR-4 autoloader. Composer-free for Phase 1 — gets us shippable
// without a vendor/ dir or a build step. We'll switch to Composer
// once the include surface gets bigger than ~15 files.
spl_autoload_register( static function ( $class ) {
    $prefix   = 'Tempaloo\\Studio\\';
    $base_dir = TEMPALOO_STUDIO_DIR . 'includes/';
    $len      = strlen( $prefix );
    if ( strncmp( $prefix, $class, $len ) !== 0 ) return;
    $relative = substr( $class, $len );
    $file     = $base_dir . str_replace( '\\', '/', $relative ) . '.php';
    if ( file_exists( $file ) ) require $file;
} );

register_activation_hook( __FILE__, static function () {
    add_option( 'tempaloo_studio_active_template', '', '', true );
    add_option( 'tempaloo_studio_active_widgets',  [], '', true );
    add_option( 'tempaloo_studio_theme_overrides', [], '', true );
    add_option( 'tempaloo_studio_license_key',     '', '', true );
} );

register_deactivation_hook( __FILE__, static function () {
    delete_transient( 'tempaloo_studio_templates_cache' );
} );

add_action( 'plugins_loaded', static function () {
    // Bail early with a clear admin notice if Elementor isn't active —
    // the plugin is meaningless without it.
    if ( ! did_action( 'elementor/loaded' ) ) {
        add_action( 'admin_notices', static function () {
            if ( ! current_user_can( 'activate_plugins' ) ) return;
            echo '<div class="notice notice-error"><p>'
                . esc_html__( 'Tempaloo Studio requires Elementor to be installed and active.', 'tempaloo-studio' )
                . '</p></div>';
        } );
        return;
    }
    Tempaloo\Studio\Plugin::instance()->boot();
} );
