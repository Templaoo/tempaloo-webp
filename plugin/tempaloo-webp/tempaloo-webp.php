<?php
/**
 * Plugin Name:       Tempaloo WebP – Image Optimizer & AVIF Converter
 * Plugin URI:        https://tempaloo.com/webp
 * Description:       Convert images to WebP & AVIF automatically. Faster sites, no setup.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Tempaloo
 * Author URI:        https://tempaloo.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       tempaloo-webp
 */

defined( 'ABSPATH' ) || exit;

define( 'TEMPALOO_WEBP_VERSION', '1.0.0' );
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
require_once TEMPALOO_WEBP_DIR . 'includes/class-activity.php';
require_once TEMPALOO_WEBP_DIR . 'includes/class-license-watch.php';

// CLI commands self-register at file load when WP_CLI is defined; the file
// is harmless to require unconditionally (it returns early otherwise).
require_once TEMPALOO_WEBP_DIR . 'includes/class-cli.php';

// WP only fires one callback per plugin for each of these hooks. Wrap both
// handlers in a single closure so nothing gets silently overridden.
register_activation_hook( __FILE__, static function () {
    Tempaloo_WebP_Plugin::on_activate();
    Tempaloo_WebP_Retry_Queue::on_activate();
    Tempaloo_WebP_License_Watch::on_activate();
} );
register_deactivation_hook( __FILE__, static function () {
    Tempaloo_WebP_Plugin::on_deactivate();
    Tempaloo_WebP_Retry_Queue::on_deactivate();
    Tempaloo_WebP_License_Watch::on_deactivate();
} );

add_action( 'plugins_loaded', static function () {
    // Translations. WordPress.org will auto-generate .po/.mo files from the
    // plugin's text domain once it's published on the directory.
    load_plugin_textdomain(
        'tempaloo-webp',
        false,
        dirname( plugin_basename( __FILE__ ) ) . '/languages'
    );
    Tempaloo_WebP_Plugin::instance()->boot();
} );
