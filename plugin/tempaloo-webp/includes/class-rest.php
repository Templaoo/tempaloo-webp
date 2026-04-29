<?php
defined( 'ABSPATH' ) || exit;

class Tempaloo_WebP_REST {

    const NS = 'tempaloo-webp/v1';

    public function register() {
        add_action( 'rest_api_init', [ $this, 'routes' ] );
    }

    public function routes() {
        register_rest_route( self::NS, '/state', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'get_state' ],
            'permission_callback' => [ $this, 'perm_manage' ],
        ] );
        register_rest_route( self::NS, '/activate', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'post_activate' ],
            'permission_callback' => [ $this, 'perm_manage' ],
            'args'                => [ 'license_key' => [ 'required' => true, 'type' => 'string' ] ],
        ] );
        register_rest_route( self::NS, '/settings', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'post_settings' ],
            'permission_callback' => [ $this, 'perm_manage' ],
        ] );
        register_rest_route( self::NS, '/retry/run', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'post_retry' ],
            'permission_callback' => [ $this, 'perm_manage' ],
        ] );
        register_rest_route( self::NS, '/restore', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'post_restore' ],
            'permission_callback' => [ $this, 'perm_manage' ],
            'args'                => [
                // Empty / omitted → restore all converted attachments. An
                // explicit list lets a future per-row UI restore one at a time.
                'ids' => [ 'required' => false, 'type' => 'array' ],
            ],
        ] );

        register_rest_route( self::NS, '/activity', [
            [
                'methods'             => 'GET',
                'callback'            => [ $this, 'get_activity' ],
                'permission_callback' => [ $this, 'perm_manage' ],
            ],
            [
                'methods'             => 'DELETE',
                'callback'            => [ $this, 'delete_activity' ],
                'permission_callback' => [ $this, 'perm_manage' ],
            ],
        ] );

        register_rest_route( self::NS, '/cpts', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'get_cpts' ],
            'permission_callback' => [ $this, 'perm_manage' ],
        ] );

        // Force a fresh /license/verify roundtrip on demand. Same logic
        // as the daily License Watch cron, but triggered manually so
        // a user can sync immediately after upgrading on tempaloo.com
        // instead of waiting up to 24h for the cron.
        register_rest_route( self::NS, '/refresh-license', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'post_refresh_license' ],
            'permission_callback' => [ $this, 'perm_manage' ],
        ] );

        // Wipes license_key + every derived field on the local install.
        // Useful when the upstream license was deleted/replaced and the
        // plugin keeps showing as "active" because of cached settings.
        // No upstream call — purely local. The user re-activates by
        // pasting a fresh license_key.
        register_rest_route( self::NS, '/disconnect-license', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'post_disconnect_license' ],
            'permission_callback' => [ $this, 'perm_manage' ],
        ] );
    }

    public function get_activity( WP_REST_Request $req ) {
        $limit = isset( $req['limit'] ) ? max( 1, min( 200, (int) $req['limit'] ) ) : 100;
        return rest_ensure_response( [ 'events' => Tempaloo_WebP_Activity::recent( $limit ) ] );
    }

    public function delete_activity() {
        Tempaloo_WebP_Activity::clear();
        return rest_ensure_response( [ 'ok' => true ] );
    }

    /**
     * Returns the public custom-post-types on the site so the per-CPT
     * quality picker can render dropdowns without the user typing slugs.
     */
    public function get_cpts() {
        $types = get_post_types( [ 'public' => true ], 'objects' );
        $list = [];
        foreach ( $types as $slug => $obj ) {
            // Skip attachment + nav_menu_item — they're irrelevant for image quality
            if ( in_array( $slug, [ 'attachment', 'nav_menu_item', 'revision' ], true ) ) continue;
            $list[] = [
                'slug'  => $slug,
                'label' => isset( $obj->labels->name ) ? (string) $obj->labels->name : $slug,
            ];
        }
        return rest_ensure_response( [ 'cpts' => $list ] );
    }

    /**
     * Restore originals: deletes every .webp/.avif sibling we wrote and
     * strips the tempaloo_webp meta block. The original JPEG/PNG/GIF on
     * disk was never touched, so users get back exactly what they uploaded.
     */
    public function post_restore( WP_REST_Request $req ) {
        $ids = $req->get_param( 'ids' );
        if ( ! is_array( $ids ) || empty( $ids ) ) {
            // Slow-query warning acknowledged: same trade-off as the CLI
            // restore — this only runs on the explicit /restore REST
            // endpoint (admin button, never a page render), capped at
            // 5000 ids. Acceptable cost for a destructive admin op.
            // phpcs:disable WordPress.DB.SlowDBQuery.slow_db_query_meta_query
            $ids = get_posts( [
                'post_type'      => 'attachment',
                'post_status'    => 'inherit',
                'post_mime_type' => [ 'image/jpeg', 'image/png', 'image/gif' ],
                'numberposts'    => 5000,
                'fields'         => 'ids',
                'meta_query'     => [
                    [
                        'key'     => '_wp_attachment_metadata',
                        'value'   => 'tempaloo_webp',
                        'compare' => 'LIKE',
                    ],
                ],
            ] );
            // phpcs:enable WordPress.DB.SlowDBQuery.slow_db_query_meta_query
        } else {
            $ids = array_map( 'absint', $ids );
        }

        $restored        = 0;
        $files_removed   = 0;
        $delete_failures = 0;
        $failure_samples = [];

        foreach ( $ids as $id ) {
            $meta = wp_get_attachment_metadata( $id );
            if ( empty( $meta['tempaloo_webp'] ) ) continue;

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
                        if ( ! file_exists( $sibling ) ) continue;

                        // wp_delete_file returns void — it can silently
                        // swallow permission errors, file-in-use locks
                        // (LiteSpeed object cache holding a handle, etc.)
                        // and we'd report a phantom success. Verify by
                        // checking existence AFTER, then fall back to a
                        // raw @unlink so a permission glitch in the WP
                        // wrapper doesn't strand the file forever.
                        wp_delete_file( $sibling );
                        clearstatcache( true, $sibling );
                        if ( file_exists( $sibling ) ) {
                            // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink
                            @unlink( $sibling );
                            clearstatcache( true, $sibling );
                        }
                        if ( file_exists( $sibling ) ) {
                            $delete_failures++;
                            if ( count( $failure_samples ) < 5 ) {
                                $failure_samples[] = str_replace(
                                    trailingslashit( ABSPATH ),
                                    '/',
                                    $sibling
                                );
                            }
                            continue; // don't count as removed
                        }
                        $files_removed++;
                    }
                }
            }

            unset( $meta['tempaloo_webp'] );
            wp_update_attachment_metadata( $id, $meta );
            // Drop the per-attachment metadata cache so any subsequent
            // call (savings panel, scan, REST attachment) sees the
            // post-restore truth instead of the pre-restore cached copy.
            clean_post_cache( (int) $id );
            $restored++;
        }

        // Page-cache purge — Cache Enabler / LiteSpeed / Rocket can hold
        // pages whose <picture> tags point at the just-deleted siblings.
        // Without a purge those visitors get a 404 on every <source>
        // until the cache rolls over naturally.
        if ( method_exists( 'Tempaloo_WebP_Plugin', 'purge_page_caches' ) ) {
            Tempaloo_WebP_Plugin::purge_page_caches();
        }

        $log_message = $delete_failures > 0
            ? sprintf(
                /* translators: 1: attachments restored, 2: files removed, 3: files that failed to delete */
                __( 'Restored %1$d attachments · %2$d files removed · %3$d delete failure(s)', 'tempaloo-webp' ),
                $restored,
                $files_removed,
                $delete_failures
            )
            : sprintf(
                /* translators: 1: attachments restored, 2: files removed */
                __( 'Restored %1$d attachments · %2$d files removed', 'tempaloo-webp' ),
                $restored,
                $files_removed
            );

        Tempaloo_WebP_Activity::log(
            'restore',
            $delete_failures > 0 ? 'error' : 'warn',
            $log_message,
            [
                'restored'        => $restored,
                'files_removed'   => $files_removed,
                'delete_failures' => $delete_failures,
                'failure_samples' => $failure_samples,
            ]
        );

        return rest_ensure_response( [
            'state'          => $this->state_response()->get_data(),
            'restored'       => $restored,
            'filesRemoved'   => $files_removed,
            'deleteFailures' => $delete_failures,
            'failureSamples' => $failure_samples,
        ] );
    }

    public function post_retry() {
        $r = Tempaloo_WebP_Retry_Queue::process_all();
        return rest_ensure_response( array_merge( [ 'state' => $this->state_response()->get_data() ], $r ) );
    }

    public function perm_manage() {
        return current_user_can( 'manage_options' );
    }

    public function get_state() {
        return $this->state_response();
    }

    public function post_activate( WP_REST_Request $req ) {
        $key = trim( (string) $req->get_param( 'license_key' ) );
        if ( '' === $key ) {
            return new WP_Error( 'missing_key', 'License key is required', [ 'status' => 400 ] );
        }
        $client = new Tempaloo_WebP_API_Client( $key );
        $res    = $client->verify_license( home_url() );
        if ( empty( $res['ok'] ) || empty( $res['data']['valid'] ) ) {
            $code = isset( $res['error']['code'] ) ? $res['error']['code'] : 'invalid_key';
            $msg  = isset( $res['error']['message'] ) ? $res['error']['message'] : 'Invalid license key';
            return new WP_Error( $code, $msg, [ 'status' => 400 ] );
        }
        Tempaloo_WebP_Plugin::update_settings( [
            'license_key'      => $key,
            'license_valid'    => true,
            'license_status'   => isset( $res['data']['status'] ) ? (string) $res['data']['status'] : 'active',
            'license_email'    => isset( $res['data']['user_email'] ) ? (string) $res['data']['user_email'] : '',
            'plan'             => isset( $res['data']['plan'] ) ? (string) $res['data']['plan'] : '',
            'supports_avif'    => ! empty( $res['data']['supports_avif'] ),
            'images_limit'     => isset( $res['data']['images_limit'] ) ? (int) $res['data']['images_limit'] : 0,
            'sites_limit'      => isset( $res['data']['sites_limit'] ) ? (int) $res['data']['sites_limit'] : 0,
            'last_verified_at' => time(),
        ] );
        Tempaloo_WebP_Activity::log( 'license', 'success',
            sprintf(
                /* translators: %s: plan name in upper-case (FREE / STARTER / GROWTH / BUSINESS / UNLIMITED) */
                __( 'License activated · %s plan', 'tempaloo-webp' ),
                strtoupper( (string) ( $res['data']['plan'] ?? 'free' ) )
            ),
            [ 'plan' => (string) ( $res['data']['plan'] ?? 'free' ) ]
        );
        return $this->state_response();
    }

    /**
     * On-demand license re-verify. Calls /license/verify with the saved
     * license_key, persists the latest plan / status / email, returns
     * the same shape as state_response() so the React app can replace
     * its store atomically.
     */
    public function post_refresh_license() {
        $s = Tempaloo_WebP_Plugin::get_settings();
        $key = (string) ( $s['license_key'] ?? '' );
        if ( '' === $key ) {
            return new WP_Error( 'no_license', 'No license key on file', [ 'status' => 400 ] );
        }
        $client = new Tempaloo_WebP_API_Client( $key );
        $res    = $client->verify_license( home_url() );
        if ( empty( $res['ok'] ) || ! is_array( $res['data'] ?? null ) ) {
            $code = isset( $res['error']['code'] ) ? $res['error']['code'] : 'verify_failed';
            $msg  = isset( $res['error']['message'] ) ? $res['error']['message'] : 'License verify failed';
            return new WP_Error( $code, $msg, [ 'status' => 502 ] );
        }
        $data = $res['data'];

        $patch = [
            'license_status'   => isset( $data['status'] ) ? (string) $data['status'] : ( ! empty( $data['valid'] ) ? 'active' : 'unknown' ),
            'license_valid'    => ! empty( $data['valid'] ),
            'plan'             => isset( $data['plan'] ) ? (string) $data['plan'] : (string) ( $s['plan'] ?? '' ),
            'last_verified_at' => time(),
        ];
        if ( isset( $data['user_email'] ) )    $patch['license_email'] = (string) $data['user_email'];
        if ( isset( $data['supports_avif'] ) ) $patch['supports_avif'] = ! empty( $data['supports_avif'] );
        if ( isset( $data['images_limit'] ) )  $patch['images_limit']  = (int) $data['images_limit'];
        if ( isset( $data['sites_limit'] ) )   $patch['sites_limit']   = (int) $data['sites_limit'];
        Tempaloo_WebP_Plugin::update_settings( $patch );

        return $this->state_response();
    }

    /**
     * Wipes every derived license field on the local install. Returns a
     * fresh state with the React app's empty defaults, so the UI flips
     * back to the "Activate license" affordance immediately.
     *
     * Quota cache, site links, retry queue and per-CPT settings are
     * preserved — they survive a key swap, a user wouldn't expect them
     * to reset just because they re-activated under a new key.
     */
    public function post_disconnect_license() {
        Tempaloo_WebP_Plugin::update_settings( [
            'license_key'      => '',
            'license_valid'    => false,
            'license_status'   => 'unknown',
            'license_email'    => '',
            'plan'             => '',
            'supports_avif'    => false,
            'images_limit'     => 0,
            'sites_limit'      => 0,
            'last_verified_at' => 0,
        ] );
        // Drop any pending license-alert snooze so a future bad status
        // surfaces cleanly on the next verify.
        delete_option( Tempaloo_WebP_License_Watch::DISMISS_OPTION );
        Tempaloo_WebP_Activity::log( 'license', 'info', __( 'License disconnected', 'tempaloo-webp' ) );
        return $this->state_response();
    }

    public function post_settings( WP_REST_Request $req ) {
        $p = $req->get_json_params();
        if ( ! is_array( $p ) ) $p = [];
        $patch = [];
        if ( isset( $p['quality'] ) ) {
            $patch['quality'] = max( 1, min( 100, (int) $p['quality'] ) );
        }
        if ( isset( $p['outputFormat'] ) ) {
            // 'both' generates AVIF + WebP siblings in one batch (still
            // 1 credit per upload). Anything else falls back to WebP.
            $requested = in_array( $p['outputFormat'], [ 'webp', 'avif', 'both' ], true )
                ? $p['outputFormat']
                : 'webp';
            // Server-side gate: free plan (and any plan whose license
            // doesn't include AVIF) is forced to WebP. The UI already
            // disables the AVIF + Both buttons when supports_avif=false,
            // but enforcing here covers cases where the local cache is
            // stale, the user pokes the option directly, or a future
            // refactor breaks the UI gate.
            $cur = Tempaloo_WebP_Plugin::get_settings();
            if ( ( 'avif' === $requested || 'both' === $requested ) && empty( $cur['supports_avif'] ) ) {
                $requested = 'webp';
            }
            $patch['output_format'] = $requested;
        }
        if ( array_key_exists( 'autoConvert', $p ) ) {
            $patch['auto_convert'] = ! empty( $p['autoConvert'] );
        }
        if ( array_key_exists( 'serveWebp', $p ) ) {
            $patch['serve_webp'] = ! empty( $p['serveWebp'] );
        }
        if ( isset( $p['deliveryMode'] ) ) {
            // Whitelisted enum — anything else falls back to url_rewrite
            // so a stray client value can never wedge the rendering path.
            $patch['delivery_mode'] = 'picture_tag' === $p['deliveryMode'] ? 'picture_tag' : 'url_rewrite';
        }
        if ( array_key_exists( 'cdnPassthrough', $p ) ) {
            $patch['cdn_passthrough'] = ! empty( $p['cdnPassthrough'] );
        }
        if ( array_key_exists( 'resizeMaxWidth', $p ) ) {
            $w = (int) $p['resizeMaxWidth'];
            // 0 = off; clamp the max so a typo can't turn off the resize
            // feature by setting an absurd value (we top out at 8K).
            $patch['resize_max_width'] = $w <= 0 ? 0 : max( 320, min( 7680, $w ) );
        }
        if ( array_key_exists( 'cptQuality', $p ) && is_array( $p['cptQuality'] ) ) {
            $clean = [];
            foreach ( $p['cptQuality'] as $slug => $q ) {
                $slug = sanitize_key( (string) $slug );
                $q = (int) $q;
                if ( $slug && $q > 0 && $q <= 100 ) {
                    $clean[ $slug ] = $q;
                }
            }
            $patch['cpt_quality'] = $clean;
        }
        if ( ! empty( $patch ) ) {
            Tempaloo_WebP_Plugin::update_settings( $patch );
        }
        return $this->state_response();
    }

    /**
     * Builds the camelCase state blob consumed by the React app.
     */
    public function state_response() {
        $s = Tempaloo_WebP_Plugin::get_settings();

        $quota = null;
        if ( ! empty( $s['license_valid'] ) ) {
            $client = new Tempaloo_WebP_API_Client( $s['license_key'] );
            $q      = $client->get_quota();
            if ( ! empty( $q['ok'] ) && isset( $q['data'] ) ) {
                $d = $q['data'];
                $quota = [
                    'imagesUsed'        => (int) ( $d['images_used']        ?? 0 ),
                    'imagesLimit'       => (int) ( $d['images_limit']       ?? 0 ),
                    // Effective monthly cap = base limit + unused rollover
                    // (capped at 1× plan). What the user can actually
                    // consume this month — the React side prefers this
                    // over imagesLimit for "of N" displays.
                    'imagesEffective'   => (int) ( $d['images_effective']   ?? ( $d['images_limit'] ?? 0 ) ),
                    'imagesRollover'    => (int) ( $d['images_rollover']    ?? 0 ),
                    'imagesRemaining'   => (int) ( $d['images_remaining']   ?? 0 ),
                    'sitesUsed'         => (int) ( $d['sites_used']         ?? 0 ),
                    'sitesLimit'        => (int) ( $d['sites_limit']        ?? 0 ),
                    'periodStart'       => (string) ( $d['period_start']    ?? '' ),
                    'periodEnd'         => (string) ( $d['period_end']      ?? '' ),
                    // Daily bulk cap from server config (was hardcoded
                    // as "50/day" in the React preflight modal). 0 means
                    // "no daily cap" (paid plans).
                    'dailyBulkLimit'    => (int) ( $d['daily_bulk_limit']   ?? 0 ),
                ];
            }
        }

        // Self-clear the "quota exceeded" flag if the API confirms credits
        // are available again (rollover, upgrade, or new period).
        $exceeded_at = (int) get_option( 'tempaloo_webp_quota_exceeded_at', 0 );
        if ( $exceeded_at > 0 && $quota && $quota['imagesRemaining'] > 0 ) {
            delete_option( 'tempaloo_webp_quota_exceeded_at' );
            $exceeded_at = 0;
        }

        $health = get_option( Tempaloo_WebP_API_Client::HEALTH_OPTION );
        $api_health = is_array( $health )
            ? [
                'ok'        => false,
                'failedAt'  => (int) ( $health['failed_at'] ?? 0 ),
                'code'      => (string) ( $health['code'] ?? '' ),
                'message'   => (string) ( $health['message'] ?? '' ),
                'attempts'  => (int) ( $health['attempts'] ?? 0 ),
              ]
            : [ 'ok' => true, 'failedAt' => 0, 'code' => '', 'message' => '', 'attempts' => 0 ];

        return rest_ensure_response( [
            'license'  => [
                'valid'         => ! empty( $s['license_valid'] ),
                'key'           => (string) $s['license_key'],
                'plan'          => (string) $s['plan'],
                // Drives the inactive-license banner in the React app.
                // Default 'unknown' on legacy installs that haven't run
                // the daily verify cron yet — treated as harmless by UI.
                'status'        => (string) ( $s['license_status'] ?? 'unknown' ),
                // Email of the Tempaloo account that owns this license.
                // Empty string until the next /license/verify roundtrip.
                'email'         => (string) ( $s['license_email'] ?? '' ),
                'supportsAvif'  => ! empty( $s['supports_avif'] ),
                'imagesLimit'   => (int) $s['images_limit'],
                'sitesLimit'    => (int) $s['sites_limit'],
            ],
            'quota'           => $quota,
            'quotaExceededAt' => $exceeded_at > 0 ? $exceeded_at : null,
            'apiHealth'       => $api_health,
            'retryQueue'      => Tempaloo_WebP_Retry_Queue::stats(),
            'settings' => [
                'quality'        => (int) $s['quality'],
                'outputFormat'   => (string) $s['output_format'],
                'autoConvert'    => ! empty( $s['auto_convert'] ),
                'serveWebp'      => ! empty( $s['serve_webp'] ),
                'deliveryMode'   => 'picture_tag' === ( $s['delivery_mode'] ?? '' ) ? 'picture_tag' : 'url_rewrite',
                'cdnPassthrough' => ! empty( $s['cdn_passthrough'] ),
                'resizeMaxWidth' => (int) ( $s['resize_max_width'] ?? 0 ),
                'cptQuality'     => is_array( $s['cpt_quality'] ?? null ) ? $s['cpt_quality'] : (object) [],
            ],
            'savings'  => $this->compute_savings(),
        ] );
    }

    /**
     * Sums original vs converted size across every attachment with optimization meta.
     * Cheap for MVP libraries (<10k attachments). For larger sites, cache this.
     */
    private function compute_savings() {
        $ids = get_posts( [
            'post_type'      => 'attachment',
            'post_status'    => 'inherit',
            'post_mime_type' => [ 'image/jpeg', 'image/png', 'image/gif' ],
            'numberposts'    => 5000,
            'fields'         => 'ids',
        ] );
        $in = 0; $out = 0; $converted = 0;
        foreach ( $ids as $id ) {
            $meta = wp_get_attachment_metadata( $id );
            if ( empty( $meta['tempaloo_webp']['sizes'] ) ) continue;
            $converted++;
            $original = get_attached_file( $id );
            if ( ! $original ) continue;
            $dir = dirname( $original );
            $sources = [ $original ];
            if ( ! empty( $meta['sizes'] ) ) {
                foreach ( $meta['sizes'] as $size ) {
                    if ( ! empty( $size['file'] ) ) {
                        $sources[] = trailingslashit( $dir ) . $size['file'];
                    }
                }
            }
            $fmt = isset( $meta['tempaloo_webp']['format'] ) ? $meta['tempaloo_webp']['format'] : 'webp';
            foreach ( $sources as $src ) {
                $alt = $src . '.' . $fmt;
                if ( file_exists( $src ) && file_exists( $alt ) ) {
                    $in  += filesize( $src );
                    $out += filesize( $alt );
                }
            }
        }
        return [
            'bytesIn'   => $in,
            'bytesOut'  => $out,
            'converted' => $converted,
        ];
    }
}


