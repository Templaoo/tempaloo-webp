<?php
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    exit;
}
delete_option( 'tempaloo_webp_settings' );
delete_option( 'tempaloo_webp_quota_exceeded_at' );
