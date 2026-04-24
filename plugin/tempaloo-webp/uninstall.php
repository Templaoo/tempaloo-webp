<?php
/**
 * Fires when the plugin is deleted from the WordPress admin. Cleans up
 * every option the plugin ever wrote + unschedules the background cron
 * so nothing keeps running in the site's cron after the plugin is gone.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    exit;
}

$options = array(
    'tempaloo_webp_settings',            // user settings (license key, quality, toggles)
    'tempaloo_webp_quota_exceeded_at',   // quota-reached flag
    'tempaloo_webp_api_health',          // API-down tracker
    'tempaloo_webp_retry_queue',         // queued attachments awaiting retry
    'tempaloo_webp_bulk_state',          // in-progress bulk job state
);
foreach ( $options as $opt ) {
    delete_option( $opt );
    delete_site_option( $opt ); // multisite safety
}

// Unschedule the retry queue cron event. Leaving it scheduled would keep
// firing `do_action('tempaloo_webp_retry_tick')` with no listener — cheap
// but noisy in WP-Cron debug logs.
wp_clear_scheduled_hook( 'tempaloo_webp_retry_tick' );
