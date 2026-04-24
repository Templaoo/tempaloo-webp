<?php
/**
 * Plugin Name:       Tempaloo WebP – Image Optimizer & AVIF Converter
 * Plugin URI:        https://tempaloo.com/webp
 * Description:       Convert images to WebP & AVIF automatically. Faster sites, no setup.
 * Version:           0.1.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Tempaloo
 * Author URI:        https://tempaloo.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       tempaloo-webp
 */

defined( 'ABSPATH' ) || exit;

define( 'TEMPALOO_WEBP_VERSION', '0.1.0' );
define( 'TEMPALOO_WEBP_FILE', __FILE__ );
define( 'TEMPALOO_WEBP_DIR', plugin_dir_path( __FILE__ ) );
define( 'TEMPALOO_WEBP_URL', plugin_dir_url( __FILE__ ) );
define( 'TEMPALOO_WEBP_API_BASE', defined( 'TEMPALOO_WEBP_API_BASE_OVERRIDE' )
    ? TEMPALOO_WEBP_API_BASE_OVERRIDE
    : 'https://api.tempaloo.com/v1' );
define( 'TEMPALOO_WEBP_ACTIVATE_URL', defined( 'TEMPALOO_WEBP_ACTIVATE_URL_OVERRIDE' )
    ? TEMPALOO_WEBP_ACTIVATE_URL_OVERRIDE
    : 'https://tempaloo.com/webp/activate' );

require_once TEMPALOO_WEBP_DIR . 'includes/class-plugin.php';
require_once TEMPALOO_WEBP_DIR . 'includes/class-api-client.php';
require_once TEMPALOO_WEBP_DIR . 'includes/class-settings.php';
require_once TEMPALOO_WEBP_DIR . 'includes/class-converter.php';
require_once TEMPALOO_WEBP_DIR . 'includes/class-url-filter.php';
require_once TEMPALOO_WEBP_DIR . 'includes/class-bulk.php';
require_once TEMPALOO_WEBP_DIR . 'includes/class-rest.php';
require_once TEMPALOO_WEBP_DIR . 'includes/class-retry-queue.php';

register_activation_hook( __FILE__, [ 'Tempaloo_WebP_Plugin', 'on_activate' ] );
register_activation_hook( __FILE__, [ 'Tempaloo_WebP_Retry_Queue', 'on_activate' ] );
register_deactivation_hook( __FILE__, [ 'Tempaloo_WebP_Plugin', 'on_deactivate' ] );
register_deactivation_hook( __FILE__, [ 'Tempaloo_WebP_Retry_Queue', 'on_deactivate' ] );

add_action( 'plugins_loaded', static function () {
    Tempaloo_WebP_Plugin::instance()->boot();
} );
