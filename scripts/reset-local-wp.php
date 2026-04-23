<?php
/**
 * Local-only reset script. Run from the browser:
 *   http://web.local/wp-tempaloo-reset.php
 *
 * Wipes the plugin option, strips tempaloo_webp metadata from every attachment,
 * and deletes sibling .webp/.avif files so you can rerun the full flow from scratch.
 *
 * Copy this file into the site root as `wp-tempaloo-reset.php`, hit the URL,
 * then delete the file. NEVER deploy this to production.
 */

define( 'ABSPATH', __DIR__ . '/' );
define( 'WP_USE_THEMES', false );
require __DIR__ . '/wp-load.php';

if ( ! current_user_can( 'manage_options' ) && ! ( defined( 'WP_CLI' ) && WP_CLI ) ) {
    // Relaxed: also accept a secret token for quick dev use.
    $token = isset( $_GET['t'] ) ? (string) $_GET['t'] : '';
    if ( 'tempaloo-reset' !== $token ) {
        status_header( 403 );
        exit( 'Forbidden — log in as admin, or append ?t=tempaloo-reset' );
    }
}

echo "Tempaloo WebP — reset\n";
echo "---------------------\n";

// 1. Delete plugin options.
delete_option( 'tempaloo_webp_settings' );
delete_option( 'tempaloo_webp_bulk_state' );
delete_option( 'tempaloo_webp_quota_exceeded_at' );
echo "✓ Options wiped.\n";

// 2. Strip tempaloo_webp metadata from every attachment.
$ids = get_posts( [
    'post_type'      => 'attachment',
    'post_status'    => 'inherit',
    'post_mime_type' => [ 'image/jpeg', 'image/png', 'image/gif' ],
    'numberposts'    => -1,
    'fields'         => 'ids',
] );
$stripped = 0;
foreach ( $ids as $id ) {
    $meta = wp_get_attachment_metadata( $id );
    if ( is_array( $meta ) && isset( $meta['tempaloo_webp'] ) ) {
        unset( $meta['tempaloo_webp'] );
        wp_update_attachment_metadata( $id, $meta );
        $stripped++;
    }
}
echo "✓ Metadata stripped from {$stripped} attachments.\n";

// 3. Delete sibling .webp / .avif files next to originals.
$deleted = 0;
foreach ( $ids as $id ) {
    $file = get_attached_file( $id );
    if ( ! $file ) continue;
    $dir = dirname( $file );
    $stem = basename( $file );
    // Walk all files in that dir that begin with the attachment's stem (covers all sizes).
    $all = glob( trailingslashit( $dir ) . pathinfo( $stem, PATHINFO_FILENAME ) . '*' );
    if ( ! is_array( $all ) ) continue;
    foreach ( $all as $candidate ) {
        if ( preg_match( '/\.(webp|avif)$/i', $candidate ) ) {
            if ( @unlink( $candidate ) ) $deleted++;
        }
    }
}
echo "✓ Removed {$deleted} .webp/.avif sibling files.\n";

echo "\nDone. You can now re-test the plugin from zero.\n";
