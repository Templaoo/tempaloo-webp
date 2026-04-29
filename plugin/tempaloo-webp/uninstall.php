<?php
/**
 * Fires when the plugin is deleted from the WordPress admin. Cleans up
 * every option the plugin ever wrote + unschedules the background cron
 * so nothing keeps running in the site's cron after the plugin is gone.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    exit;
}

// Plugin-prefixed local variable names — required by WPCS (no naked
// $options/$opt at file scope of an uninstaller file, since uninstall.php
// runs in WP's global scope and could collide with another plugin's vars).
$tempaloo_webp_options = array(
    'tempaloo_webp_settings',            // user settings (license key, quality, toggles)
    'tempaloo_webp_quota_exceeded_at',   // quota-reached flag
    'tempaloo_webp_api_health',          // API-down tracker
    'tempaloo_webp_retry_queue',         // queued attachments awaiting retry
    'tempaloo_webp_bulk_state',          // in-progress bulk job state
    'tempaloo_webp_license_alert_dismissed_until', // 7-day snooze for the license-watch notice
);
foreach ( $tempaloo_webp_options as $tempaloo_webp_opt ) {
    delete_option( $tempaloo_webp_opt );
    delete_site_option( $tempaloo_webp_opt ); // multisite safety
}

// Unschedule both cron events. Leaving them scheduled would keep firing
// do_action() calls with no listener — cheap but noisy in WP-Cron debug
// logs and shows up in tools like WP Crontrol as "no callback".
wp_clear_scheduled_hook( 'tempaloo_webp_retry_tick' );
wp_clear_scheduled_hook( 'tempaloo_webp_daily_verify' );
