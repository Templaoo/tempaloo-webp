<?php
defined( 'ABSPATH' ) || exit;

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
    return;
}

/**
 * WP-CLI commands for Tempaloo WebP.
 *
 * Designed for the agency segment: scriptable management of license,
 * bulk conversion, restore, and quota checks across many sites.
 *
 *     wp tempaloo status
 *     wp tempaloo activate <license-key>
 *     wp tempaloo bulk [--dry-run] [--limit=N]
 *     wp tempaloo restore [--ids=1,2,3] [--yes]
 *     wp tempaloo quota
 *     wp tempaloo settings get|set <key> [<value>]
 */
class Tempaloo_WebP_CLI {

    /**
     * Show plugin status: license, plan, quota, API health.
     *
     * ## EXAMPLES
     *
     *     wp tempaloo status
     *     wp tempaloo status --format=json
     *
     * @when after_wp_load
     */
    public function status( $args, $assoc_args ) {
        $s = Tempaloo_WebP_Plugin::get_settings();
        $health = get_option( Tempaloo_WebP_API_Client::HEALTH_OPTION );
        $row = [
            'license_valid'  => ! empty( $s['license_valid'] ) ? 'yes' : 'no',
            'plan'           => $s['plan'] ?: '—',
            'images_limit'   => (int) $s['images_limit'] === -1 ? 'unlimited' : (int) $s['images_limit'],
            'sites_limit'    => (int) $s['sites_limit'] === -1 ? 'unlimited' : (int) $s['sites_limit'],
            'output_format'  => (string) $s['output_format'],
            'quality'        => (int) $s['quality'],
            'auto_convert'   => ! empty( $s['auto_convert'] ) ? 'yes' : 'no',
            'serve_webp'     => ! empty( $s['serve_webp'] ) ? 'yes' : 'no',
            'resize_max_px'  => (int) ( $s['resize_max_width'] ?? 0 ) ?: 'off',
            'api_health'     => is_array( $health ) ? 'down (' . ( $health['code'] ?? '?' ) . ')' : 'ok',
        ];
        WP_CLI\Utils\format_items(
            isset( $assoc_args['format'] ) ? $assoc_args['format'] : 'table',
            [ $row ],
            array_keys( $row )
        );
    }

    /**
     * Activate a license key.
     *
     * ## OPTIONS
     *
     * <license-key>
     * : The license key from tempaloo.com/webp/activate
     *
     * ## EXAMPLES
     *
     *     wp tempaloo activate tw_live_abc123…
     *
     * @when after_wp_load
     */
    public function activate( $args, $assoc_args ) {
        $key = isset( $args[0] ) ? trim( (string) $args[0] ) : '';
        if ( '' === $key ) {
            WP_CLI::error( 'License key is required.' );
        }
        $client = new Tempaloo_WebP_API_Client( $key );
        $res    = $client->verify_license( home_url() );
        if ( empty( $res['ok'] ) || empty( $res['data']['valid'] ) ) {
            $msg = isset( $res['error']['message'] ) ? $res['error']['message'] : 'Invalid license key';
            WP_CLI::error( $msg );
        }
        Tempaloo_WebP_Plugin::update_settings( [
            'license_key'      => $key,
            'license_valid'    => true,
            'plan'             => isset( $res['data']['plan'] ) ? (string) $res['data']['plan'] : '',
            'supports_avif'    => ! empty( $res['data']['supports_avif'] ),
            'images_limit'     => isset( $res['data']['images_limit'] ) ? (int) $res['data']['images_limit'] : 0,
            'sites_limit'      => isset( $res['data']['sites_limit'] ) ? (int) $res['data']['sites_limit'] : 0,
            'last_verified_at' => time(),
        ] );
        $plan = isset( $res['data']['plan'] ) ? (string) $res['data']['plan'] : 'free';
        WP_CLI::success( "License activated on {$plan} plan." );
    }

    /**
     * Show monthly quota and usage.
     *
     * @when after_wp_load
     */
    public function quota( $args, $assoc_args ) {
        $s = Tempaloo_WebP_Plugin::get_settings();
        if ( empty( $s['license_valid'] ) ) {
            WP_CLI::error( 'No license activated. Run `wp tempaloo activate <key>` first.' );
        }
        $client = new Tempaloo_WebP_API_Client( $s['license_key'] );
        $q = $client->get_quota();
        if ( empty( $q['ok'] ) ) {
            WP_CLI::error( 'Could not reach the API: ' . ( $q['error']['message'] ?? 'unknown error' ) );
        }
        $d = $q['data'];
        $row = [
            'plan'             => (string) $s['plan'],
            'images_used'      => (int) ( $d['images_used'] ?? 0 ),
            'images_limit'     => (int) ( $d['images_limit'] ?? 0 ) === -1 ? 'unlimited' : (int) ( $d['images_limit'] ?? 0 ),
            'images_remaining' => (int) ( $d['images_remaining'] ?? 0 ) === -1 ? 'unlimited' : (int) ( $d['images_remaining'] ?? 0 ),
            'sites_used'       => (int) ( $d['sites_used'] ?? 0 ),
            'period_end'       => (string) ( $d['period_end'] ?? '' ),
        ];
        WP_CLI\Utils\format_items(
            isset( $assoc_args['format'] ) ? $assoc_args['format'] : 'table',
            [ $row ],
            array_keys( $row )
        );
    }

    /**
     * Bulk-convert every unprocessed attachment.
     *
     * ## OPTIONS
     *
     * [--dry-run]
     * : Print the count of pending attachments without converting anything.
     *
     * [--limit=<n>]
     * : Cap the number of attachments processed in this run.
     * ---
     * default: 0
     * ---
     *
     * ## EXAMPLES
     *
     *     wp tempaloo bulk --dry-run
     *     wp tempaloo bulk --limit=100
     *
     * @when after_wp_load
     */
    public function bulk( $args, $assoc_args ) {
        $s = Tempaloo_WebP_Plugin::get_settings();
        if ( empty( $s['license_valid'] ) ) {
            WP_CLI::error( 'No license activated.' );
        }
        $dry   = isset( $assoc_args['dry-run'] );
        $limit = isset( $assoc_args['limit'] ) ? (int) $assoc_args['limit'] : 0;

        $ids = $this->find_pending_ids( $limit > 0 ? $limit : 5000 );
        if ( empty( $ids ) ) {
            WP_CLI::success( 'Nothing to do — every supported attachment is already converted.' );
            return;
        }
        if ( $dry ) {
            WP_CLI::log( sprintf( '%d pending attachment(s) would be converted.', count( $ids ) ) );
            return;
        }

        $progress = WP_CLI\Utils\make_progress_bar( 'Converting', count( $ids ) );
        $succeeded = 0; $failed = 0; $stopped = false;

        foreach ( $ids as $id ) {
            $meta = wp_get_attachment_metadata( $id );
            if ( ! is_array( $meta ) ) $meta = [];
            $r = Tempaloo_WebP_Converter::convert_all_sizes( $id, $meta, $s, 'bulk' );
            if ( $r['converted'] > 0 ) {
                wp_update_attachment_metadata( $id, $r['metadata'] );
                $succeeded++;
            } else {
                $failed++;
                if ( 'quota_exceeded' === $r['error_code'] ) {
                    $progress->finish();
                    WP_CLI::warning( 'Monthly quota reached — stopping. Remaining: ' . ( count( $ids ) - $succeeded - $failed ) );
                    $stopped = true;
                    break;
                }
            }
            $progress->tick();
        }
        if ( ! $stopped ) $progress->finish();
        WP_CLI::success( sprintf( '%d converted, %d failed.', $succeeded, $failed ) );
    }

    /**
     * Restore originals: deletes every .webp/.avif sibling we wrote.
     *
     * ## OPTIONS
     *
     * [--ids=<list>]
     * : Comma-separated attachment IDs. If omitted, restores ALL converted images.
     *
     * [--yes]
     * : Skip the confirmation prompt.
     *
     * ## EXAMPLES
     *
     *     wp tempaloo restore --ids=12,34,56
     *     wp tempaloo restore --yes
     *
     * @when after_wp_load
     */
    public function restore( $args, $assoc_args ) {
        $ids = [];
        if ( isset( $assoc_args['ids'] ) ) {
            $ids = array_filter( array_map( 'absint', explode( ',', (string) $assoc_args['ids'] ) ) );
        }
        if ( empty( $ids ) ) {
            $ids = get_posts( [
                'post_type'      => 'attachment',
                'post_status'    => 'inherit',
                'post_mime_type' => [ 'image/jpeg', 'image/png', 'image/gif' ],
                'numberposts'    => 5000,
                'fields'         => 'ids',
                'meta_query'     => [
                    [ 'key' => '_wp_attachment_metadata', 'value' => 'tempaloo_webp', 'compare' => 'LIKE' ],
                ],
            ] );
        }
        if ( empty( $ids ) ) {
            WP_CLI::success( 'Nothing to restore.' );
            return;
        }
        WP_CLI::confirm(
            sprintf( 'Delete .webp/.avif siblings for %d attachment(s)? Originals are NOT touched.', count( $ids ) ),
            $assoc_args
        );

        $restored = 0; $files_removed = 0;
        $progress = WP_CLI\Utils\make_progress_bar( 'Restoring', count( $ids ) );
        foreach ( $ids as $id ) {
            $meta = wp_get_attachment_metadata( $id );
            if ( empty( $meta['tempaloo_webp'] ) ) { $progress->tick(); continue; }
            $original = get_attached_file( $id );
            if ( $original ) {
                $dir = trailingslashit( dirname( $original ) );
                $names = [ basename( $original ) ];
                if ( ! empty( $meta['sizes'] ) && is_array( $meta['sizes'] ) ) {
                    foreach ( $meta['sizes'] as $size ) {
                        if ( ! empty( $size['file'] ) ) $names[] = $size['file'];
                    }
                }
                foreach ( $names as $name ) {
                    foreach ( [ '.webp', '.avif' ] as $ext ) {
                        $sibling = $dir . $name . $ext;
                        if ( file_exists( $sibling ) ) {
                            wp_delete_file( $sibling );
                            $files_removed++;
                        }
                    }
                }
            }
            unset( $meta['tempaloo_webp'] );
            wp_update_attachment_metadata( $id, $meta );
            $restored++;
            $progress->tick();
        }
        $progress->finish();
        WP_CLI::success( sprintf( 'Restored %d attachment(s); removed %d sibling file(s).', $restored, $files_removed ) );
    }

    /**
     * Read or update a setting.
     *
     * ## OPTIONS
     *
     * <action>
     * : 'get' or 'set'.
     *
     * <key>
     * : Setting key: quality, output_format, auto_convert, serve_webp, resize_max_width.
     *
     * [<value>]
     * : New value (required for 'set').
     *
     * ## EXAMPLES
     *
     *     wp tempaloo settings get quality
     *     wp tempaloo settings set quality 75
     *     wp tempaloo settings set resize_max_width 2560
     *     wp tempaloo settings set auto_convert false
     *
     * @when after_wp_load
     */
    public function settings( $args, $assoc_args ) {
        $action = isset( $args[0] ) ? $args[0] : '';
        $key    = isset( $args[1] ) ? $args[1] : '';
        if ( ! in_array( $action, [ 'get', 'set' ], true ) || '' === $key ) {
            WP_CLI::error( 'Usage: wp tempaloo settings get|set <key> [<value>]' );
        }
        $allowed = [ 'quality', 'output_format', 'auto_convert', 'serve_webp', 'resize_max_width' ];
        if ( ! in_array( $key, $allowed, true ) ) {
            WP_CLI::error( 'Unknown key. Allowed: ' . implode( ', ', $allowed ) );
        }
        $s = Tempaloo_WebP_Plugin::get_settings();
        if ( 'get' === $action ) {
            WP_CLI::log( var_export( $s[ $key ] ?? null, true ) );
            return;
        }
        $value = isset( $args[2] ) ? $args[2] : null;
        if ( null === $value ) {
            WP_CLI::error( 'Value is required for `set`.' );
        }
        // Coerce types per key — WP-CLI gives us strings.
        switch ( $key ) {
            case 'quality':
                $value = max( 1, min( 100, (int) $value ) );
                break;
            case 'resize_max_width':
                $v = (int) $value;
                $value = $v <= 0 ? 0 : max( 320, min( 7680, $v ) );
                break;
            case 'output_format':
                $value = 'avif' === strtolower( (string) $value ) ? 'avif' : 'webp';
                break;
            case 'auto_convert':
            case 'serve_webp':
                $value = in_array( strtolower( (string) $value ), [ '1', 'true', 'yes', 'on' ], true );
                break;
        }
        Tempaloo_WebP_Plugin::update_settings( [ $key => $value ] );
        WP_CLI::success( "Set {$key} = " . var_export( $value, true ) );
    }

    /**
     * Find attachment IDs that don't yet have a tempaloo_webp meta block.
     * Same query as the AJAX bulk job, kept inline here so the CLI command
     * doesn't depend on the (private) Bulk class internals.
     */
    private function find_pending_ids( $limit = 5000 ) {
        global $wpdb;
        $limit = (int) $limit;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $ids = $wpdb->get_col(
            $wpdb->prepare(
                "SELECT ID FROM {$wpdb->posts}
                  WHERE post_type = %s AND post_status = %s
                    AND post_mime_type IN ('image/jpeg','image/png','image/gif')
                  ORDER BY ID ASC
                  LIMIT %d",
                'attachment',
                'inherit',
                $limit
            )
        );
        if ( empty( $ids ) ) return [];

        $pending = [];
        foreach ( $ids as $id ) {
            $meta = wp_get_attachment_metadata( (int) $id );
            if ( empty( $meta['tempaloo_webp']['sizes'] ) && empty( $meta['tempaloo_webp']['path'] ) ) {
                $pending[] = (int) $id;
            }
        }
        return $pending;
    }
}

WP_CLI::add_command( 'tempaloo', 'Tempaloo_WebP_CLI' );
