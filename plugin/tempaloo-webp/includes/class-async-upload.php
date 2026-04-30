<?php
defined( 'ABSPATH' ) || exit;

/**
 * Async upload conversion. Mirrors the WP Smush / 10up wp-async-task
 * pattern (core/modules/async/class-abstract-async.php in Smush).
 *
 * Why async: sync conversion inside `wp_generate_attachment_metadata`
 * runs while every other image-optimizer (LiteSpeed Image Opt,
 * Wordfence, Imagify, ShortPixel, host security scanners) is also
 * hooked on the same filter. Even at priority 10 vs 12 vs 99, we end up
 * stepping on each other inside one PHP request — the converter writes
 * a .webp, an inotify-driven scanner fires on the upload event,
 * quarantines it, and the user sees "converted=2" in Activity but
 * empty .webp slots on disk on reload.
 *
 * Pattern:
 *  1. On upload, we hook `wp_generate_attachment_metadata` at priority
 *     999 (after every other plugin), capture the attachment_id, queue
 *     it in the `tempaloo_webp_async_pending` option with a timestamp,
 *     and **return the metadata unchanged**. No conversion in this
 *     request.
 *  2. On `shutdown` (after WP has finished responding to the user),
 *     we fire one non-blocking `wp_remote_post` per queued attachment
 *     to admin-post.php?action=tempaloo_webp_async_convert. The
 *     request is fire-and-forget (timeout=0.01, blocking=false).
 *  3. The loopback request lands in a fresh PHP process. Our
 *     `admin_post_tempaloo_webp_async_convert` handler validates the
 *     nonce + attachment_id and runs Tempaloo_WebP_Converter::
 *     convert_for_upload() — the exact same code path as the bulk
 *     converter, which is known to work. By now the upload-time
 *     hook chain has finished, no other plugin is racing us, and
 *     security scanners have already done their pass on the original.
 *  4. After the convert, we persist the updated metadata via
 *     wp_update_attachment_metadata, mark the attachment done, and
 *     wp_die so the loopback returns 200 cleanly.
 *
 * Fallbacks:
 *  · WP-CLI / WP-Cron / XML-RPC requests have no admin-post.php
 *    loopback path (or it'd auth-fail). For those we run sync inline
 *    via convert_for_upload() — same behavior as pre-1.9.0.
 *  · Hosts that block loopback HTTP entirely (Hostinger sometimes,
 *    plus any site behind aggressive WAFs) will leave attachments in
 *    `tempaloo_webp_async_pending` forever. The reconcile step below
 *    runs on the existing retry-queue cron (every 5 min), pushes any
 *    pending older than 10 minutes into the retry queue, and
 *    eventually they get converted via WP-cron — slower path, but
 *    converges.
 */
class Tempaloo_WebP_Async_Upload {

    const ACTION_NAME    = 'tempaloo_webp_async_convert';
    const PENDING_OPTION = 'tempaloo_webp_async_pending';
    const NONCE_ACTION   = 'tempaloo_webp_async_convert_nonce';

    /**
     * Reconciliation pickup window. Loopback should land within
     * seconds; if an attachment has been pending longer than this,
     * something dropped it (host blocked the HTTP, server died after
     * shutdown fired, etc.) and we hand it off to the retry queue.
     */
    const RECONCILE_AFTER = 600; // 10 minutes

    /** @var int[] IDs to dispatch on the current request's shutdown. */
    private static $shutdown_queue = [];

    /** @var bool Avoid registering the shutdown action twice. */
    private static $shutdown_hooked = false;

    public static function register() {
        // Priority 999 — runs AFTER every other plugin hooked on the
        // same filter. We never modify the metadata array here, so
        // running last is safe and keeps competing image-optimizers
        // from invalidating our enqueue.
        add_filter( 'wp_generate_attachment_metadata', [ __CLASS__, 'on_generate_metadata' ], 999, 2 );

        // Loopback handler. Auth'd endpoint only — Media Library uploads
        // always come from a logged-in user, so we don't need the
        // _nopriv variant. Unauth'd requests get a 403 from WP itself
        // before ever reaching our handler.
        add_action( 'admin_post_' . self::ACTION_NAME, [ __CLASS__, 'handle_loopback' ] );

        // Reconciliation: piggyback on the existing retry-queue cron
        // tick so we don't add yet another wp-cron entry.
        add_action( Tempaloo_WebP_Retry_Queue::CRON_HOOK, [ __CLASS__, 'reconcile_pending' ], 20 );
    }

    /**
     * Decide whether async dispatch is appropriate for this request
     * context. Anything that's not a real HTTP request from a browser
     * runs sync: the loopback either won't authenticate (cron),
     * doesn't make sense (CLI), or would deadlock (XMLRPC). REST
     * uploads via wp.media in the block editor DO go through normal
     * HTTP, so they're fine on the async path.
     */
    private static function should_run_async() {
        if ( defined( 'WP_CLI' ) && WP_CLI ) return false;
        if ( defined( 'DOING_CRON' ) && DOING_CRON ) return false;
        if ( defined( 'XMLRPC_REQUEST' ) && XMLRPC_REQUEST ) return false;
        // Allow disabling via a constant for emergency rollback —
        // user can drop `define('TEMPALOO_WEBP_DISABLE_ASYNC', true);`
        // in wp-config.php and immediately revert to v1.8.x sync.
        if ( defined( 'TEMPALOO_WEBP_DISABLE_ASYNC' ) && TEMPALOO_WEBP_DISABLE_ASYNC ) return false;
        return true;
    }

    /**
     * Sole `wp_generate_attachment_metadata` filter for the plugin.
     * Decides between three paths: skip (gates fail), sync fallback
     * (non-async context), or async dispatch (normal upload).
     */
    public static function on_generate_metadata( $metadata, $attachment_id ) {
        $attachment_id = (int) $attachment_id;
        $s = Tempaloo_WebP_Plugin::get_settings();

        list( $ok, $reason ) = Tempaloo_WebP_Converter::should_run_for_upload( $attachment_id, $s );
        if ( ! $ok ) {
            // Log gate misses — same behavior as the old sync hook,
            // so the Activity panel stays useful for "why isn't this
            // converting?" support questions. auto_convert_off stays
            // silent on purpose (intentional user choice, no signal).
            if ( 'no_license' === $reason ) {
                Tempaloo_WebP_Activity::log(
                    'auto_convert', 'warn',
                    sprintf(
                        /* translators: %d: attachment ID */
                        __( 'Auto-convert skipped for #%d — license is not active', 'tempaloo-webp' ),
                        $attachment_id
                    ),
                    [ 'attachment_id' => $attachment_id, 'reason' => 'no_license' ]
                );
            } elseif ( 'unsupported_mime' === $reason ) {
                $mime = (string) get_post_mime_type( $attachment_id );
                Tempaloo_WebP_Activity::log(
                    'auto_convert', 'info',
                    sprintf(
                        /* translators: 1: attachment ID, 2: mime type */
                        __( 'Auto-convert skipped for #%1$d — mime %2$s is not convertible (only JPEG/PNG/GIF)', 'tempaloo-webp' ),
                        $attachment_id, $mime
                    ),
                    [ 'attachment_id' => $attachment_id, 'reason' => 'unsupported_mime', 'mime' => $mime ]
                );
            }
            return $metadata;
        }

        // Idempotency. wp_generate_attachment_metadata can fire more
        // than once for the same attachment (Regenerate Thumbnails,
        // bulk re-imports). If we already have meta for this ID,
        // don't burn a credit on a re-fire.
        if ( ! empty( Tempaloo_WebP_Plugin::get_conversion_meta( $attachment_id ) ) ) {
            return $metadata;
        }

        if ( ! self::should_run_async() ) {
            // Sync fallback — CLI/cron/XMLRPC. Run the converter
            // inline and return the modified metadata so WP persists
            // it to the standard meta key (the pre-1.9.0 behavior).
            $result = Tempaloo_WebP_Converter::convert_for_upload( $attachment_id, $metadata, $s, 'auto' );
            return $result['metadata'];
        }

        // Async path. Mark pending + queue for shutdown dispatch.
        self::mark_pending( $attachment_id );
        self::$shutdown_queue[] = $attachment_id;
        if ( ! self::$shutdown_hooked ) {
            self::$shutdown_hooked = true;
            // Priority 99 — fire late so anything else on shutdown
            // (object cache flush, query log) has a chance to run
            // first. We don't depend on them, but this keeps our
            // loopback HTTP pop after WP's normal teardown.
            add_action( 'shutdown', [ __CLASS__, 'dispatch_pending_on_shutdown' ], 99 );
        }
        return $metadata;
    }

    /**
     * Fire the loopback HTTP requests. Called once per request, at
     * shutdown, with all attachment_ids queued during this request.
     *
     * Each request is non-blocking + sub-second timeout so we don't
     * delay the user's response. The cookies header forwards the
     * user's WP auth so admin_post.php authenticates the loopback
     * as the same user that just uploaded.
     */
    public static function dispatch_pending_on_shutdown() {
        if ( empty( self::$shutdown_queue ) ) return;

        $url     = admin_url( 'admin-post.php' );
        $cookies = isset( $_COOKIE ) ? wp_unslash( $_COOKIE ) : [];

        // Build cookie objects in the format wp_remote_post expects.
        $cookie_jar = [];
        foreach ( (array) $cookies as $name => $value ) {
            $cookie_jar[] = new WP_Http_Cookie( [
                'name'  => $name,
                'value' => $value,
            ] );
        }

        foreach ( array_unique( self::$shutdown_queue ) as $aid ) {
            $aid  = (int) $aid;
            $body = [
                'action'        => self::ACTION_NAME,
                'attachment_id' => $aid,
                '_nonce'        => wp_create_nonce( self::NONCE_ACTION . '_' . $aid ),
            ];
            // sslverify default false: this is a fire-and-forget
            // loopback to the SAME site (admin-post.php) for the
            // async-upload trick. Self-signed certs on local dev
            // (Local, MAMP, Valet) would otherwise break every
            // upload. Filterable via tempaloo_webp_async_sslverify so
            // production sites with strict policies can opt back in.
            wp_remote_post( $url, [
                'timeout'   => 0.01,
                'blocking'  => false,
                'sslverify' => apply_filters( 'tempaloo_webp_async_sslverify', false ),
                'body'      => $body,
                'cookies'   => $cookie_jar,
            ] );
        }
    }

    /**
     * Loopback handler. Runs in a fresh PHP process triggered by
     * dispatch_pending_on_shutdown(). Responsible for the actual
     * conversion, metadata update, and pending cleanup.
     *
     * Status responses are returned as plaintext so logs in
     * admin-post.php access logs (or a debug toolbar) make the
     * outcome easy to diff.
     */
    public static function handle_loopback() {
        $aid   = isset( $_POST['attachment_id'] ) ? (int) $_POST['attachment_id'] : 0;
        $nonce = isset( $_POST['_nonce'] ) ? (string) $_POST['_nonce'] : '';
        if ( $aid <= 0 || ! wp_verify_nonce( $nonce, self::NONCE_ACTION . '_' . $aid ) ) {
            wp_die( 'invalid', 'invalid', [ 'response' => 403 ] );
        }

        // Re-check gates on every loopback. Settings (license,
        // auto_convert) might have changed between the upload and
        // this loopback firing — race window is small but real on
        // multisite admins toggling settings during bulk imports.
        $s = Tempaloo_WebP_Plugin::get_settings();
        list( $ok, $reason ) = Tempaloo_WebP_Converter::should_run_for_upload( $aid, $s );
        if ( ! $ok ) {
            self::mark_done( $aid );
            wp_die( 'skipped:' . $reason, '', [ 'response' => 200 ] );
        }
        if ( ! empty( Tempaloo_WebP_Plugin::get_conversion_meta( $aid ) ) ) {
            self::mark_done( $aid );
            wp_die( 'skipped:already_converted', '', [ 'response' => 200 ] );
        }

        $metadata = wp_get_attachment_metadata( $aid );
        if ( ! is_array( $metadata ) ) $metadata = [];

        $result = Tempaloo_WebP_Converter::convert_for_upload( $aid, $metadata, $s, 'auto' );

        // Persist the updated metadata array even on failure — the
        // converter's mirror of skipped/oversized entries lives in
        // there too. set_conversion_meta() on the dedicated post_meta
        // key was already called inside convert_all_sizes; this just
        // syncs the legacy mirror in $metadata['tempaloo_webp'] so
        // anything reading the standard meta sees the same picture.
        if ( $result['converted'] > 0 ) {
            wp_update_attachment_metadata( $aid, $result['metadata'] );
        }

        self::mark_done( $aid );
        wp_die( $result['converted'] > 0 ? 'ok' : 'failed:' . ( $result['error_code'] ?? 'unknown' ), '', [ 'response' => 200 ] );
    }

    /**
     * Reconciliation tick. Anything still pending past
     * RECONCILE_AFTER didn't get a loopback (host blocked it,
     * server crashed after shutdown, dispatch failed). Push it to
     * the existing retry queue, which has its own exponential
     * backoff + max-attempts logic, so the attachment converges
     * without us building a parallel state machine.
     */
    public static function reconcile_pending() {
        $pending = get_option( self::PENDING_OPTION, [] );
        if ( ! is_array( $pending ) || empty( $pending ) ) return;

        $cutoff = time() - self::RECONCILE_AFTER;
        $picked_up = 0;
        foreach ( $pending as $aid => $queued_at ) {
            if ( (int) $queued_at > $cutoff ) continue;
            Tempaloo_WebP_Retry_Queue::enqueue( (int) $aid, 'async_loopback_timeout' );
            self::mark_done( (int) $aid );
            $picked_up++;
        }

        if ( $picked_up > 0 ) {
            Tempaloo_WebP_Activity::log(
                'auto_convert', 'warn',
                sprintf(
                    /* translators: %d: number of attachments handed off */
                    __( 'Async loopback timed out for %d uploads — handed off to retry queue', 'tempaloo-webp' ),
                    $picked_up
                ),
                [ 'reason' => 'loopback_timeout', 'count' => $picked_up ]
            );
        }
    }

    private static function mark_pending( $attachment_id ) {
        $pending = get_option( self::PENDING_OPTION, [] );
        if ( ! is_array( $pending ) ) $pending = [];
        $pending[ (int) $attachment_id ] = time();
        // autoload=false — pending list shouldn't bloat every page load.
        update_option( self::PENDING_OPTION, $pending, false );
    }

    private static function mark_done( $attachment_id ) {
        $pending = get_option( self::PENDING_OPTION, [] );
        if ( ! is_array( $pending ) || ! isset( $pending[ (int) $attachment_id ] ) ) return;
        unset( $pending[ (int) $attachment_id ] );
        update_option( self::PENDING_OPTION, $pending, false );
    }

    /** Diagnostic helper — exposed for the Diagnostic tab. */
    public static function get_pending() {
        $pending = get_option( self::PENDING_OPTION, [] );
        return is_array( $pending ) ? $pending : [];
    }

    /**
     * Inline drain for stalled pending uploads — called from
     * state_response() so the user's "this month" counter reflects
     * post-conversion truth on the very next /state poll instead
     * of waiting for the 5-min retry-cron tick.
     *
     * Behavior:
     *  · Picks up to $max attachments whose pending timestamp is
     *    older than $stale_after_seconds (default 5s — gives a
     *    healthy host enough time to fire the loopback first).
     *  · Runs convert_for_upload() on each, synchronously, then
     *    persists metadata + clears them from the pending option.
     *  · Bounded so an upload bulk doesn't turn /state into a
     *    multi-minute request — leftover items wait for the next
     *    /state call or the retry-cron tick.
     *
     * @return int Number of attachments drained this call.
     */
    public static function drain_stalled_inline( $max = 3, $stale_after_seconds = 5 ) {
        $pending = self::get_pending();
        if ( empty( $pending ) ) return 0;

        $cutoff = time() - (int) $stale_after_seconds;
        // Pull stalled items ordered by oldest-first.
        asort( $pending );
        $drained = 0;
        $s = Tempaloo_WebP_Plugin::get_settings();
        foreach ( $pending as $aid => $queued_at ) {
            if ( $drained >= $max ) break;
            if ( (int) $queued_at > $cutoff ) continue; // not stale yet
            $aid = (int) $aid;

            // Re-validate gates — settings may have changed since enqueue.
            list( $ok, $reason ) = Tempaloo_WebP_Converter::should_run_for_upload( $aid, $s );
            if ( ! $ok ) {
                self::mark_done( $aid );
                continue;
            }
            if ( ! empty( Tempaloo_WebP_Plugin::get_conversion_meta( $aid ) ) ) {
                self::mark_done( $aid );
                continue;
            }

            $metadata = wp_get_attachment_metadata( $aid );
            if ( ! is_array( $metadata ) ) $metadata = [];

            $result = Tempaloo_WebP_Converter::convert_for_upload( $aid, $metadata, $s, 'auto' );
            if ( ( $result['converted'] ?? 0 ) > 0 ) {
                wp_update_attachment_metadata( $aid, $result['metadata'] );
            }
            self::mark_done( $aid );
            $drained++;
        }

        if ( $drained > 0 ) {
            Tempaloo_WebP_Activity::log(
                'auto_convert', 'info',
                sprintf(
                    /* translators: %d: number of attachments drained */
                    __( 'Drained %d stalled upload(s) inline during /state poll', 'tempaloo-webp' ),
                    $drained
                ),
                [ 'reason' => 'inline_drain', 'count' => $drained ]
            );
        }
        return $drained;
    }
}
