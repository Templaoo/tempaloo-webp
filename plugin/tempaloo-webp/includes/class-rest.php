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

        // ─── Diagnostics & state reconciliation ─────────────────────────
        // The plugin holds 4 sources of truth that MUST agree but
        // historically have drifted (filesystem, attachment meta,
        // bulk_state option, retry_queue option). These two routes
        // surface the drift and let the user fix it without touching DB.
        register_rest_route( self::NS, '/state-audit', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'get_state_audit' ],
            'permission_callback' => [ $this, 'perm_manage' ],
        ] );
        register_rest_route( self::NS, '/state-reconcile', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'post_state_reconcile' ],
            'permission_callback' => [ $this, 'perm_manage' ],
        ] );

        // Per-attachment forensic. Returns everything we know about a
        // single image: meta in both locations, original + every size,
        // sibling existence per (size × format), bytes per file. The
        // diagnostic ground truth when "Activity says converted but
        // the column says no".
        register_rest_route( self::NS, '/attachment-debug', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'get_attachment_debug' ],
            'permission_callback' => [ $this, 'perm_manage' ],
            'args'                => [
                'id' => [ 'required' => true, 'type' => 'integer' ],
            ],
        ] );

        // Filesystem self-test. Writes a tiny .webp marker into
        // wp-content/uploads/, immediately re-checks existence, then
        // sleeps 5s and re-checks again. Confirms whether something
        // active on the host (LiteSpeed image optimization, security
        // plugin scanner, mod_security, host-level WAF) is silently
        // deleting our .webp siblings between conversion and serve time.
        register_rest_route( self::NS, '/filesystem-test', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'post_filesystem_test' ],
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
            $tw   = Tempaloo_WebP_Plugin::get_conversion_meta( $id );
            if ( empty( $tw ) ) continue;

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

            // Helper handles BOTH _tempaloo_webp post_meta AND legacy
            // in-metadata key, plus dual cache invalidation. Single
            // source of truth for "drop our marks from this attachment".
            Tempaloo_WebP_Plugin::delete_conversion_meta( $id );
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

    // ─── State audit + reconciliation ───────────────────────────────────
    //
    // The plugin's "is this image converted?" state lives in 4 places:
    //   1. Filesystem      — .jpg.webp / .jpg.avif siblings on disk
    //   2. Attachment meta — wp_postmeta._wp_attachment_metadata.tempaloo_webp
    //   3. Bulk state      — option tempaloo_webp_bulk_state
    //   4. Retry queue     — option tempaloo_webp_retry_queue
    //
    // For Overview, Bulk and Activity to tell the same story, all four
    // must agree. They drift in real-world failure modes:
    //   · A failed Restore leaves siblings on disk but clears the meta
    //     → orphaned siblings.
    //   · A bulk_state stuck on "running" because a tab was closed
    //     mid-tick → stale running state.
    //   · A retry queue with attempts > MAX after a network outage
    //     → ghost queue items.
    //
    // get_state_audit walks all 4 sources, returns the per-source counts
    // side-by-side + flags for drift. post_state_reconcile fixes them
    // without destroying user data.

    /**
     * Returns the full state inventory across the 4 sources of truth.
     * Read-only — safe to call from a UI auto-refresh.
     *
     * Heavy on disk I/O for big libraries (one stat() per size per
     * attachment). Capped at 5000 attachments — enough for the MVP, the
     * audit becomes a custom-table problem past that scale anyway.
     */
    public function get_state_audit( WP_REST_Request $req ) {
        global $wpdb;

        $start = microtime( true );

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $ids = $wpdb->get_col(
            $wpdb->prepare(
                "SELECT ID FROM {$wpdb->posts}
                  WHERE post_type = %s AND post_status = %s
                    AND post_mime_type IN ('image/jpeg','image/png','image/gif')
                  ORDER BY ID ASC
                  LIMIT 5000",
                'attachment', 'inherit'
            )
        );

        $report = [
            'attachments' => [
                'total'              => count( (array) $ids ),
                'withMeta'           => 0,
                'withConverted'      => 0,  // tempaloo_webp.converted > 0
                'withSkipped'        => 0,  // tempaloo_webp.skipped non-empty
                'brokenPaths'        => 0,  // get_attached_file returns false / file missing
            ],
            'filesystem' => [
                'webpSiblings'       => 0,
                'avifSiblings'       => 0,
                'orphans'            => 0,  // siblings on disk, no tempaloo_webp meta
                'orphanSamples'      => [],
                'ghosts'             => 0,  // meta exists, no siblings on disk
                'ghostSamples'       => [],
            ],
            'bulkState' => [],
            'retryQueue' => [],
            'settings' => [
                'outputFormat'       => '',
                'autoConvert'        => false,
                'serveWebp'          => false,
                'deliveryMode'       => '',
                'cdnPassthrough'     => false,
                'licenseValid'       => false,
                'plan'               => '',
                'supportsAvif'       => false,
            ],
            'durationMs' => 0,
        ];

        $expected_exts = [ '.webp' ]; // we always count both, regardless of setting
        $expected_avif = [ '.avif' ];

        foreach ( (array) $ids as $id ) {
            $orig = get_attached_file( (int) $id );
            if ( ! $orig || ! file_exists( $orig ) ) {
                $report['attachments']['brokenPaths']++;
                continue;
            }
            $meta = wp_get_attachment_metadata( (int) $id );
            // Read via helper — picks up _tempaloo_webp post_meta first,
            // falls back to legacy. Lets the audit reflect reality
            // even when LiteSpeed/Smush/etc. stripped our key from
            // the standard metadata array.
            $tw            = Tempaloo_WebP_Plugin::get_conversion_meta( (int) $id );
            $has_meta      = ! empty( $tw );
            $has_converted = $has_meta && ! empty( $tw['converted'] );
            $has_skipped   = $has_meta && ! empty( $tw['skipped'] );
            if ( $has_meta )      $report['attachments']['withMeta']++;
            if ( $has_converted ) $report['attachments']['withConverted']++;
            if ( $has_skipped )   $report['attachments']['withSkipped']++;

            $paths = [ $orig ];
            if ( ! empty( $meta['sizes'] ) && is_array( $meta['sizes'] ) ) {
                foreach ( $meta['sizes'] as $size ) {
                    if ( ! empty( $size['file'] ) ) {
                        $paths[] = trailingslashit( dirname( $orig ) ) . $size['file'];
                    }
                }
            }

            $any_webp = false; $any_avif = false; $missing_for_meta = false;
            foreach ( $paths as $p ) {
                if ( file_exists( $p . '.webp' ) ) { $report['filesystem']['webpSiblings']++; $any_webp = true; }
                if ( file_exists( $p . '.avif' ) ) { $report['filesystem']['avifSiblings']++; $any_avif = true; }
                // For ghost detection: meta says it's converted, but at
                // least one expected sibling for "converted" is missing.
                if ( $has_converted && ! file_exists( $p . '.webp' ) && ! file_exists( $p . '.avif' ) ) {
                    $missing_for_meta = true;
                }
            }

            // Orphan = siblings on disk but tempaloo_webp meta absent.
            if ( ! $has_meta && ( $any_webp || $any_avif ) ) {
                $report['filesystem']['orphans']++;
                if ( count( $report['filesystem']['orphanSamples'] ) < 10 ) {
                    $report['filesystem']['orphanSamples'][] = [
                        'id'    => (int) $id,
                        'title' => get_the_title( (int) $id ),
                        'file'  => str_replace( ABSPATH, '/', $orig ),
                    ];
                }
            }
            // Ghost = meta says converted but no siblings exist for at
            // least one expected size.
            if ( $missing_for_meta ) {
                $report['filesystem']['ghosts']++;
                if ( count( $report['filesystem']['ghostSamples'] ) < 10 ) {
                    $report['filesystem']['ghostSamples'][] = [
                        'id'    => (int) $id,
                        'title' => get_the_title( (int) $id ),
                        'file'  => str_replace( ABSPATH, '/', $orig ),
                    ];
                }
            }
        }

        // Bulk state snapshot
        $bulk = get_option( Tempaloo_WebP_Bulk::STATE_OPTION );
        if ( is_array( $bulk ) ) {
            $started   = (int) ( $bulk['started_at'] ?? 0 );
            $finished  = (int) ( $bulk['finished_at'] ?? 0 );
            $report['bulkState'] = [
                'status'        => (string) ( $bulk['status'] ?? 'idle' ),
                'total'         => (int) ( $bulk['total'] ?? 0 ),
                'processed'     => (int) ( $bulk['processed'] ?? 0 ),
                'remaining'     => is_array( $bulk['remaining'] ?? null ) ? count( $bulk['remaining'] ) : 0,
                'errors'        => is_array( $bulk['errors'] ?? null ) ? count( $bulk['errors'] ) : 0,
                'startedAt'     => $started,
                'finishedAt'    => $finished,
                // "Stuck running" — a bulk_state where status='running'
                // but no tick has updated it in 30 minutes. Almost
                // always a closed tab mid-run; reconcile resets to idle.
                'stuckRunning'  => ( 'running' === ( $bulk['status'] ?? '' ) ) && ( $started > 0 ) && ( time() - $started > 1800 ),
            ];
        } else {
            $report['bulkState'] = [
                'status' => 'idle', 'total' => 0, 'processed' => 0,
                'remaining' => 0, 'errors' => 0,
                'startedAt' => 0, 'finishedAt' => 0, 'stuckRunning' => false,
            ];
        }

        // Retry queue snapshot — class-retry-queue exposes stats() but
        // it lacks the "oldest enqueued" field useful for diagnostics.
        $rq_stats = Tempaloo_WebP_Retry_Queue::stats();
        $rq_raw   = get_option( 'tempaloo_webp_retry_queue', [] );
        if ( ! is_array( $rq_raw ) ) $rq_raw = [];
        $oldest = 0;
        foreach ( $rq_raw as $entry ) {
            $added = (int) ( $entry['added_at'] ?? 0 );
            if ( $added > 0 && ( $oldest === 0 || $added < $oldest ) ) $oldest = $added;
        }
        $report['retryQueue'] = array_merge( $rq_stats, [
            'oldestEnqueuedAt' => $oldest,
            // "Past max attempts" entries — these should be auto-dropped
            // by enqueue() but a manual MAX_ATTEMPTS bump leaves stragglers.
            'overMaxAttempts'  => count( array_filter( $rq_raw, static function ( $e ) {
                return (int) ( $e['attempts'] ?? 0 ) > Tempaloo_WebP_Retry_Queue::MAX_ATTEMPTS;
            } ) ),
        ] );

        // Settings snapshot — the values that drive every other code
        // path. If license is invalid or auto_convert is false, the
        // user thinks "nothing converts" but the plugin is doing
        // exactly what they asked. Surface it in the audit.
        $s = Tempaloo_WebP_Plugin::get_settings();
        $report['settings'] = [
            'outputFormat'   => (string) ( $s['output_format'] ?? 'webp' ),
            'autoConvert'    => ! empty( $s['auto_convert'] ),
            'serveWebp'      => ! empty( $s['serve_webp'] ),
            'deliveryMode'   => (string) ( $s['delivery_mode'] ?? 'url_rewrite' ),
            'cdnPassthrough' => ! empty( $s['cdn_passthrough'] ),
            'licenseValid'   => ! empty( $s['license_valid'] ),
            'plan'           => (string) ( $s['plan'] ?? '' ),
            'supportsAvif'   => ! empty( $s['supports_avif'] ),
        ];

        $report['durationMs'] = (int) round( ( microtime( true ) - $start ) * 1000 );

        return rest_ensure_response( $report );
    }

    /**
     * Reconciles the 4 sources of truth so they agree.
     *
     * Operations performed (each independent, all idempotent):
     *   · stuck-running bulk → reset status to idle, drop remaining queue
     *   · retry queue past MAX_ATTEMPTS → drop entries
     *   · orphaned siblings → optionally delete (dry-run by default)
     *   · ghost meta → drop tempaloo_webp from meta so next bulk re-flags
     *
     * Body params:
     *   · dry_run (bool, default true) — when true, returns what WOULD
     *     change without touching anything.
     *   · fix (array of strings, default ['stuck_bulk','overage_retries','ghost_meta'])
     *     Subset of operations to perform. Orphan deletion requires the
     *     explicit 'orphan_files' flag because it touches user data.
     */
    public function post_state_reconcile( WP_REST_Request $req ) {
        $body = $req->get_json_params();
        if ( ! is_array( $body ) ) $body = [];
        $dry_run = isset( $body['dry_run'] ) ? (bool) $body['dry_run'] : true;
        $fix     = isset( $body['fix'] ) && is_array( $body['fix'] )
            ? array_map( 'strval', $body['fix'] )
            : [ 'stuck_bulk', 'overage_retries', 'ghost_meta' ];

        $changes = [
            'stuckBulkReset'   => 0,
            'retriesDropped'   => 0,
            'ghostMetaCleared' => 0,
            'orphanFilesRemoved' => 0,
            'dryRun' => $dry_run,
        ];

        // 1. Stuck-running bulk
        if ( in_array( 'stuck_bulk', $fix, true ) ) {
            $bulk = get_option( Tempaloo_WebP_Bulk::STATE_OPTION );
            if ( is_array( $bulk )
                && 'running' === ( $bulk['status'] ?? '' )
                && (int) ( $bulk['started_at'] ?? 0 ) > 0
                && time() - (int) $bulk['started_at'] > 1800 ) {
                if ( ! $dry_run ) {
                    $bulk['status']    = 'canceled';
                    $bulk['remaining'] = [];
                    update_option( Tempaloo_WebP_Bulk::STATE_OPTION, $bulk, false );
                }
                $changes['stuckBulkReset'] = 1;
            }
        }

        // 2. Retry queue entries past MAX_ATTEMPTS
        if ( in_array( 'overage_retries', $fix, true ) ) {
            $rq = get_option( 'tempaloo_webp_retry_queue', [] );
            if ( is_array( $rq ) ) {
                $cleaned = $rq;
                $dropped = 0;
                foreach ( $rq as $att_id => $entry ) {
                    if ( (int) ( $entry['attempts'] ?? 0 ) > Tempaloo_WebP_Retry_Queue::MAX_ATTEMPTS ) {
                        unset( $cleaned[ $att_id ] );
                        $dropped++;
                    }
                }
                if ( $dropped > 0 && ! $dry_run ) {
                    if ( empty( $cleaned ) ) delete_option( 'tempaloo_webp_retry_queue' );
                    else update_option( 'tempaloo_webp_retry_queue', $cleaned, false );
                }
                $changes['retriesDropped'] = $dropped;
            }
        }

        // 3. Ghost meta — meta says converted but at least one expected
        //    sibling is missing on disk. Aligned with the audit's ghost
        //    definition (was inconsistent in v1.7.0 — audit flagged
        //    "any missing", reconcile only cleared "all missing", so
        //    partially-broken attachments showed up as ghosts forever).
        //    Aggressive on purpose: clearing the meta makes the next
        //    bulk scan re-flag the whole attachment as pending and
        //    re-converts every size cleanly, instead of trying to
        //    reason about partial state. Bulk path is idempotent for
        //    the sizes already converted (file_put_contents overwrites
        //    with same bytes), so the cost is one extra credit per
        //    affected attachment vs leaving the drift indefinitely.
        if ( in_array( 'ghost_meta', $fix, true ) ) {
            global $wpdb;
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $ids = $wpdb->get_col(
                $wpdb->prepare(
                    "SELECT ID FROM {$wpdb->posts}
                      WHERE post_type=%s AND post_status=%s
                        AND post_mime_type IN ('image/jpeg','image/png','image/gif')
                      LIMIT 5000",
                    'attachment', 'inherit'
                )
            );
            $cleared = 0;
            foreach ( (array) $ids as $id ) {
                $orig = get_attached_file( (int) $id );
                if ( ! $orig || ! file_exists( $orig ) ) continue;
                $meta = wp_get_attachment_metadata( (int) $id );
                $tw   = Tempaloo_WebP_Plugin::get_conversion_meta( (int) $id );
                if ( empty( $tw ) || empty( $tw['converted'] ) ) continue;

                $paths = [ $orig ];
                if ( ! empty( $meta['sizes'] ) && is_array( $meta['sizes'] ) ) {
                    foreach ( $meta['sizes'] as $size ) {
                        if ( ! empty( $size['file'] ) ) {
                            $paths[] = trailingslashit( dirname( $orig ) ) . $size['file'];
                        }
                    }
                }

                // Drift = at least one size has no sibling. Matches the
                // audit. Catches "partial" ghosts (some sizes converted
                // but others lost to a Restore mid-flight).
                $missing_any = false;
                foreach ( $paths as $p ) {
                    if ( ! file_exists( $p . '.webp' ) && ! file_exists( $p . '.avif' ) ) {
                        $missing_any = true;
                        break;
                    }
                }

                if ( $missing_any ) {
                    if ( ! $dry_run ) {
                        // Helper drops BOTH _tempaloo_webp post_meta AND
                        // the legacy in-metadata key, plus runs the dual
                        // cache invalidation needed for persistent object
                        // caches.
                        Tempaloo_WebP_Plugin::delete_conversion_meta( (int) $id );
                    }
                    $cleared++;
                }
            }
            $changes['ghostMetaCleared'] = $cleared;
        }

        // 4. Orphan files (siblings on disk, no meta) — destructive,
        //    explicit opt-in only.
        if ( in_array( 'orphan_files', $fix, true ) ) {
            global $wpdb;
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $ids = $wpdb->get_col(
                $wpdb->prepare(
                    "SELECT ID FROM {$wpdb->posts}
                      WHERE post_type=%s AND post_status=%s
                        AND post_mime_type IN ('image/jpeg','image/png','image/gif')
                      LIMIT 5000",
                    'attachment', 'inherit'
                )
            );
            $removed = 0;
            foreach ( (array) $ids as $id ) {
                $orig = get_attached_file( (int) $id );
                if ( ! $orig || ! file_exists( $orig ) ) continue;
                $meta = wp_get_attachment_metadata( (int) $id );
                $tw   = Tempaloo_WebP_Plugin::get_conversion_meta( (int) $id );
                if ( ! empty( $tw ) ) continue;  // not orphan if conversion meta present

                $paths = [ $orig ];
                if ( ! empty( $meta['sizes'] ) && is_array( $meta['sizes'] ) ) {
                    foreach ( $meta['sizes'] as $size ) {
                        if ( ! empty( $size['file'] ) ) {
                            $paths[] = trailingslashit( dirname( $orig ) ) . $size['file'];
                        }
                    }
                }
                foreach ( $paths as $p ) {
                    foreach ( [ '.webp', '.avif' ] as $ext ) {
                        $sibling = $p . $ext;
                        if ( file_exists( $sibling ) ) {
                            if ( ! $dry_run ) {
                                wp_delete_file( $sibling );
                                clearstatcache( true, $sibling );
                            }
                            $removed++;
                        }
                    }
                }
            }
            $changes['orphanFilesRemoved'] = $removed;
        }

        if ( ! $dry_run ) {
            Tempaloo_WebP_Activity::log(
                'reconcile',
                'warn',
                __( 'State reconcile applied', 'tempaloo-webp' ),
                $changes
            );
        }

        return rest_ensure_response( $changes );
    }

    /**
     * Per-attachment forensic. Returns the full picture: WP attachment
     * record, both meta storage locations, every expected size + the
     * actual disk state of every (size × format) pair. The "is this
     * really converted?" answer surfaces immediately — no guessing
     * between Activity log success and a Convert-now button on the
     * same row.
     *
     * GET /tempaloo-webp/v1/attachment-debug?id=45
     */
    public function get_attachment_debug( WP_REST_Request $req ) {
        $id = (int) $req->get_param( 'id' );
        if ( $id <= 0 ) {
            return new WP_Error( 'bad_id', 'Missing or invalid attachment id', [ 'status' => 400 ] );
        }
        $post = get_post( $id );
        if ( ! $post || 'attachment' !== $post->post_type ) {
            return new WP_Error( 'not_attachment', "ID {$id} is not an attachment", [ 'status' => 404 ] );
        }

        clearstatcache(); // disk state must be fresh, not cached
        $attached = get_attached_file( $id );
        $att_exists = $attached && file_exists( $attached );
        $att_size   = $att_exists ? filesize( $attached ) : 0;

        $meta = wp_get_attachment_metadata( $id );

        // Both meta locations exposed side-by-side so the user can see
        // when one is set and not the other (= LiteSpeed-strip footprint).
        $meta_via_post_meta = get_post_meta( $id, Tempaloo_WebP_Plugin::META_KEY, true );
        $meta_via_metadata  = is_array( $meta ) && ! empty( $meta['tempaloo_webp'] ) ? $meta['tempaloo_webp'] : null;
        $meta_effective     = Tempaloo_WebP_Plugin::get_conversion_meta( $id );

        // Build the per-size disk state. Each entry: original path +
        // existence + bytes; .webp sibling existence + bytes;
        // .avif sibling existence + bytes.
        $entries = [];
        $entries[] = $this->size_debug_entry( 'original', $attached, $att_exists ? $att_size : 0 );
        if ( is_array( $meta ) && ! empty( $meta['sizes'] ) && is_array( $meta['sizes'] ) ) {
            foreach ( $meta['sizes'] as $size_name => $size_meta ) {
                if ( empty( $size_meta['file'] ) ) continue;
                $size_path = trailingslashit( dirname( (string) $attached ) ) . $size_meta['file'];
                clearstatcache( true, $size_path );
                $size_exists = file_exists( $size_path );
                $entries[] = $this->size_debug_entry(
                    (string) $size_name,
                    $size_path,
                    $size_exists ? filesize( $size_path ) : 0
                );
            }
        }

        // Settings snapshot — same data the user sees in Diagnostic
        // settings card, repeated here so support tickets carry one
        // self-contained dump.
        $s = Tempaloo_WebP_Plugin::get_settings();

        return rest_ensure_response( [
            'attachmentId'      => $id,
            'title'             => get_the_title( $id ),
            'mime'              => get_post_mime_type( $id ),
            'attachedFile'      => is_string( $attached ) ? str_replace( ABSPATH, '/', $attached ) : null,
            'attachedExists'    => $att_exists,
            'attachedBytes'     => $att_size,
            'metaPostMetaKey'   => $meta_via_post_meta ?: null,
            'metaInsideMetadata' => $meta_via_metadata,
            'metaEffective'     => $meta_effective,
            'sizes'             => $entries,
            'settings'          => [
                'licenseValid'  => ! empty( $s['license_valid'] ),
                'autoConvert'   => ! empty( $s['auto_convert'] ),
                'serveWebp'     => ! empty( $s['serve_webp'] ),
                'outputFormat'  => (string) ( $s['output_format'] ?? 'webp' ),
                'deliveryMode'  => (string) ( $s['delivery_mode'] ?? 'url_rewrite' ),
                'cdnPassthrough' => ! empty( $s['cdn_passthrough'] ),
                'supportsAvif'  => ! empty( $s['supports_avif'] ),
            ],
        ] );
    }

    /**
     * Filesystem self-test. Verifies that the host actually persists
     * .webp files we write into the uploads directory, by emulating
     * what the converter does on every attachment:
     *
     *   1. Write a marker file foo.png.webp containing valid (tiny)
     *      WebP bytes. Same double-extension scheme as a real sibling.
     *   2. file_exists() check immediately after write.
     *   3. Sleep 5s.
     *   4. file_exists() check again.
     *   5. Report each step + clean up.
     *
     * If step 4 says "missing" while step 2 said "exists" → something
     * on the host (LiteSpeed image optimization plugin, security
     * scanner, mod_security cleanup, WAF) is actively deleting WebP
     * files between conversion and serve. The user knows exactly
     * which fix applies (disable LiteSpeed image-opt, allowlist .webp
     * in WAF, etc.) instead of guessing.
     *
     * Limited to admin caller via perm_manage, sleeps server-side
     * (max 5s) — won't tie up workers. Cleans up the marker even
     * on early return.
     */
    public function post_filesystem_test( WP_REST_Request $req ) {
        $uploads = wp_get_upload_dir();
        if ( empty( $uploads['basedir'] ) || empty( $uploads['baseurl'] ) ) {
            return new WP_Error( 'no_uploads_dir', 'wp_get_upload_dir returned no basedir', [ 'status' => 500 ] );
        }
        // Smallest valid WebP — 26 bytes lossy VP8 1×1 pixel. Real
        // bytes (not "fake_webp_marker") so a strict WAF/image-scanner
        // sees an actual WebP file, not a sus payload.
        $payload = base64_decode(
            'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
            true
        );
        if ( false === $payload ) {
            return new WP_Error( 'payload_error', 'failed to build test payload', [ 'status' => 500 ] );
        }

        // Write into the uploads root with a randomized name so we
        // never clobber a real file. Double-extension on purpose —
        // we want to test exactly what the converter produces.
        $token   = 'tempaloo-fstest-' . wp_generate_password( 12, false ) . '.png.webp';
        $abspath = trailingslashit( $uploads['basedir'] ) . $token;
        $url     = trailingslashit( $uploads['baseurl'] ) . $token;

        $report = [
            'targetPath'     => str_replace( ABSPATH, '/', $abspath ),
            'targetUrl'      => $url,
            'payloadBytes'   => strlen( $payload ),
            'writeOk'        => false,
            'writtenBytes'   => 0,
            'existsAfterWrite' => false,
            'sizeAfterWrite' => 0,
            'existsAfter5s'  => false,
            'sizeAfter5s'    => 0,
            'fetchHttpCode'  => 0,
            'fetchContentType' => '',
            'cleanupOk'      => false,
            'verdict'        => '',
        ];

        // Step 1: write
        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
        $bytes = @file_put_contents( $abspath, $payload );
        $report['writeOk']      = ( false !== $bytes && $bytes > 0 );
        $report['writtenBytes'] = (int) $bytes;
        clearstatcache( true, $abspath );
        $report['existsAfterWrite'] = file_exists( $abspath );
        $report['sizeAfterWrite']   = $report['existsAfterWrite'] ? (int) filesize( $abspath ) : 0;

        // Step 2: HTTP fetch via the public URL — does the host actually
        // serve .webp double-extension files with the right Content-Type?
        // This is the OTHER half of "is the .webp working" that a pure
        // filesystem check misses. If the file persists on disk but
        // returns 404 / image/jpeg / WAF block, the URL filter +
        // <picture> will appear correct but the browser receives nothing.
        if ( $report['existsAfterWrite'] ) {
            $resp = wp_remote_head(
                $url,
                [ 'timeout' => 8, 'redirection' => 2, 'sslverify' => false ]
            );
            if ( ! is_wp_error( $resp ) ) {
                $report['fetchHttpCode']    = (int) wp_remote_retrieve_response_code( $resp );
                $report['fetchContentType'] = (string) wp_remote_retrieve_header( $resp, 'content-type' );
            }
        }

        // Step 3: wait — let any host-level scanner / image-opt plugin
        // fire its async cleanup pass. 5s is enough for LiteSpeed Cache
        // image-opt and most WAFs.
        // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
        @sleep( 5 );

        // Step 4: re-check
        clearstatcache( true, $abspath );
        $report['existsAfter5s'] = file_exists( $abspath );
        $report['sizeAfter5s']   = $report['existsAfter5s'] ? (int) filesize( $abspath ) : 0;

        // Step 5: cleanup
        if ( file_exists( $abspath ) ) {
            wp_delete_file( $abspath );
            clearstatcache( true, $abspath );
            $report['cleanupOk'] = ! file_exists( $abspath );
        } else {
            $report['cleanupOk'] = true; // already gone
        }

        // Verdict — the actionable summary the user reads first.
        if ( ! $report['writeOk'] ) {
            $report['verdict'] = 'WRITE_FAILED — uploads directory is not writable. Check filesystem permissions on wp-content/uploads/.';
        } elseif ( ! $report['existsAfterWrite'] ) {
            $report['verdict'] = 'POST_WRITE_VANISH — file_put_contents reported success but file_exists() right after returns false. Host-level write interception (mod_security, security plugin pre-flight scanner). Contact host support.';
        } elseif ( ! $report['existsAfter5s'] ) {
            $report['verdict'] = 'PERSISTENCE_FAILURE — file existed right after write but was deleted within 5 seconds. Almost always a host-level WebP cleanup process: LiteSpeed Image Optimization wiping non-LiteSpeed WebPs, Wordfence/iThemes Security flagging double-extension files, or Hostinger WAF removing .webp uploads. Disable LiteSpeed Image Optimization and re-test.';
        } elseif ( $report['fetchHttpCode'] !== 200 ) {
            $report['verdict'] = 'SERVE_FAILURE — file is on disk but HTTP fetch returned ' . $report['fetchHttpCode'] . '. Either the WebPs are not being served (host config, .htaccess deny, CDN config) or our test URL is wrong.';
        } elseif ( false === stripos( $report['fetchContentType'], 'image/webp' ) ) {
            $report['verdict'] = 'WRONG_MIME — file served but Content-Type is "' . $report['fetchContentType'] . '" instead of image/webp. Browser cannot decode the .webp body; the <picture> source falls back to JPG. Add an .htaccess rule forcing image/webp on .webp files.';
        } else {
            $report['verdict'] = 'OK — write, persistence and serve all healthy. If conversion still fails for real attachments, investigate the converter / API path specifically.';
        }

        return rest_ensure_response( $report );
    }

    /**
     * Builds one entry of the per-size disk-state table. Reports the
     * original file's existence + bytes, then for each format we
     * support (webp + avif) reports whether the .webp / .avif
     * sibling exists and its bytes.
     */
    private function size_debug_entry( $label, $path, $bytes ) {
        $entry = [
            'size'   => $label,
            'path'   => is_string( $path ) ? str_replace( ABSPATH, '/', (string) $path ) : null,
            'exists' => is_string( $path ) && file_exists( $path ),
            'bytes'  => (int) $bytes,
            'webp'   => null,
            'avif'   => null,
        ];
        if ( is_string( $path ) ) {
            foreach ( [ 'webp', 'avif' ] as $f ) {
                $sibling = $path . '.' . $f;
                clearstatcache( true, $sibling );
                $exists = file_exists( $sibling );
                $entry[ $f ] = [
                    'path'   => str_replace( ABSPATH, '/', $sibling ),
                    'exists' => $exists,
                    'bytes'  => $exists ? (int) filesize( $sibling ) : 0,
                ];
            }
        }
        return $entry;
    }
}


