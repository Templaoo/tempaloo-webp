<?php
defined( 'ABSPATH' ) || exit;

/**
 * Retry queue for conversions that failed because the API was unreachable
 * or returned a 5xx. Quota / auth failures are NOT enqueued — those need
 * user action, not blind retries.
 *
 * Storage: a single option indexed by attachment_id:
 *   [ attachment_id => { added_at, attempts, next_at, last_error } ]
 *
 * Scale note: WP options cap at 4MB (LONGTEXT). At ~150 bytes per entry
 * we comfortably hold ~25k pending items — fine for the MVP. Beyond that,
 * promote to a custom table.
 */
class Tempaloo_WebP_Retry_Queue {

    const OPTION       = 'tempaloo_webp_retry_queue';
    const CRON_HOOK    = 'tempaloo_webp_retry_tick';
    const CRON_SCHED   = 'tempaloo_webp_5min';
    const MAX_ATTEMPTS = 6;
    const BATCH_LIMIT  = 5;   // attachments per cron tick — keep WP cron snappy

    /** Backoff in seconds, indexed by attempts-already-made. */
    const BACKOFF = [
        0 => 60,         // first failure → retry in 1 min
        1 => 300,        // 5 min
        2 => 900,        // 15 min
        3 => 3_600,      // 1 h
        4 => 21_600,     // 6 h
        5 => 86_400,     // 24 h (last chance)
    ];

    public function register() {
        add_filter( 'cron_schedules', [ __CLASS__, 'add_schedule' ] );
        add_action( self::CRON_HOOK, [ __CLASS__, 'process_due' ] );
        // Make sure the cron exists every page load (cheap, idempotent).
        if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
            wp_schedule_event( time() + 60, self::CRON_SCHED, self::CRON_HOOK );
        }
    }

    public static function add_schedule( $schedules ) {
        $schedules[ self::CRON_SCHED ] = [
            'interval' => 5 * MINUTE_IN_SECONDS,
            'display'  => __( 'Every 5 minutes (Tempaloo retry)', 'tempaloo-webp' ),
        ];
        return $schedules;
    }

    public static function on_activate() {
        if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
            wp_schedule_event( time() + 60, self::CRON_SCHED, self::CRON_HOOK );
        }
    }

    public static function on_deactivate() {
        wp_clear_scheduled_hook( self::CRON_HOOK );
    }

    /**
     * Enqueue an attachment that failed conversion due to infra issues.
     * Idempotent: re-enqueueing an existing item just bumps attempts/next_at.
     */
    public static function enqueue( $attachment_id, $error_code = 'http_error' ) {
        $attachment_id = (int) $attachment_id;
        if ( $attachment_id <= 0 ) return;

        $queue = self::get_queue();
        $entry = isset( $queue[ $attachment_id ] ) ? $queue[ $attachment_id ] : [
            'added_at' => time(),
            'attempts' => 0,
        ];
        $entry['attempts']    = (int) ( $entry['attempts'] ?? 0 ) + 1;
        $entry['last_error']  = (string) $error_code;
        $entry['next_at']     = time() + self::backoff_for( (int) $entry['attempts'] - 1 );

        if ( $entry['attempts'] > self::MAX_ATTEMPTS ) {
            // Give up — drop from queue. Logged via PHP error_log so admins on
            // a real WP install can grep the debug.log if they care.
            error_log( sprintf(
                '[tempaloo-webp] Retry queue: giving up on attachment %d after %d attempts (last: %s)',
                $attachment_id, $entry['attempts'], $error_code
            ) );
            unset( $queue[ $attachment_id ] );
            self::save_queue( $queue );
            return;
        }
        $queue[ $attachment_id ] = $entry;
        self::save_queue( $queue );
    }

    public static function dequeue( $attachment_id ) {
        $queue = self::get_queue();
        if ( isset( $queue[ (int) $attachment_id ] ) ) {
            unset( $queue[ (int) $attachment_id ] );
            self::save_queue( $queue );
        }
    }

    /** Cron entrypoint — picks up to BATCH_LIMIT items whose next_at <= now. */
    public static function process_due() {
        self::process( /* due_only */ true );
    }

    /** Manual "retry all now" — ignores backoff. */
    public static function process_all() {
        return self::process( /* due_only */ false );
    }

    // Tracks the running tally for the email-on-completion notice.
    // We persist the "we still owe the user a wrap-up email" state in a
    // dedicated option so that across multiple cron ticks we know how
    // many attachments were recovered and can fire ONE summary email
    // when the queue finally drains, instead of one per tick or none.
    const RUN_OPTION = 'tempaloo_webp_retry_run';

    /** Returns ['ran' => n, 'succeeded' => n, 'failed' => n]. */
    private static function process( $due_only ) {
        $queue = self::get_queue();
        $size_before = count( $queue );
        if ( empty( $queue ) ) return [ 'ran' => 0, 'succeeded' => 0, 'failed' => 0 ];

        $settings = Tempaloo_WebP_Plugin::get_settings();
        if ( empty( $settings['license_valid'] ) ) {
            return [ 'ran' => 0, 'succeeded' => 0, 'failed' => 0 ];
        }

        $now = time();
        $ran = 0; $ok = 0; $ko = 0;
        $abandoned = 0;

        foreach ( $queue as $attachment_id => $entry ) {
            if ( $ran >= self::BATCH_LIMIT ) break;
            if ( $due_only && (int) ( $entry['next_at'] ?? 0 ) > $now ) continue;
            $ran++;

            $metadata = wp_get_attachment_metadata( (int) $attachment_id );
            if ( ! is_array( $metadata ) ) {
                self::dequeue( $attachment_id );
                continue;
            }
            $result = Tempaloo_WebP_Converter::convert_all_sizes( (int) $attachment_id, $metadata, $settings );

            if ( $result['converted'] > 0 ) {
                wp_update_attachment_metadata( (int) $attachment_id, $result['metadata'] );
                self::dequeue( $attachment_id );
                $ok++;
            } else {
                $code = $result['error_code'] !== '' ? $result['error_code'] : 'no_output';
                // App-level failures (quota, auth) → drop from queue, they need user action.
                if ( in_array( $code, [ 'quota_exceeded', 'unauthorized', 'forbidden', 'site_limit_reached' ], true ) ) {
                    self::dequeue( $attachment_id );
                    $abandoned++;
                } else {
                    // enqueue() bumps attempts; if we just hit MAX_ATTEMPTS
                    // it self-removes. Compare queue size before/after to
                    // tell whether the row still exists.
                    self::enqueue( $attachment_id, $code );
                    $cur_queue = self::get_queue();
                    if ( ! isset( $cur_queue[ (int) $attachment_id ] ) ) {
                        $abandoned++;
                    }
                }
                $ko++;
            }
        }

        // Tally for the wrap-up email. We accumulate `recovered` and
        // `abandoned` across every tick that had work, so the user gets
        // a single accurate summary at the end ("28 recovered, 1
        // couldn't be converted") rather than per-tick noise.
        if ( $size_before > 0 && ( $ok > 0 || $abandoned > 0 ) ) {
            self::accumulate_run_tally( $ok, $abandoned );
        }

        // Did this tick fully drain the queue? If so, fire the
        // wrap-up email exactly once and reset the running tally.
        $size_after = count( self::get_queue() );
        if ( $size_before > 0 && $size_after === 0 ) {
            self::flush_completion_email();
        }

        return [ 'ran' => $ran, 'succeeded' => $ok, 'failed' => $ko ];
    }

    /**
     * Adds the latest tick's outcome to the running tally. Persisted
     * in a separate option so completion is durable across cron ticks
     * (a single bulk run typically takes 5–30 mins of background work
     * before the queue drains, and the option lives across PHP requests).
     */
    private static function accumulate_run_tally( $recovered, $abandoned ) {
        $cur = get_option( self::RUN_OPTION, [] );
        if ( ! is_array( $cur ) ) $cur = [];
        $cur['recovered'] = (int) ( $cur['recovered'] ?? 0 ) + (int) $recovered;
        $cur['abandoned'] = (int) ( $cur['abandoned'] ?? 0 ) + (int) $abandoned;
        $cur['updated_at'] = time();
        update_option( self::RUN_OPTION, $cur, false );
    }

    /**
     * Queue just drained — ask the API to email the user a summary
     * of what was recovered, then reset the running tally. The API
     * dedups per-license per-day (claimNotification), so even if the
     * user Cancel-and-restarts bulk a few times today they get one
     * email for the day's work.
     */
    private static function flush_completion_email() {
        $tally = get_option( self::RUN_OPTION );
        delete_option( self::RUN_OPTION );
        if ( ! is_array( $tally ) || ( ( $tally['recovered'] ?? 0 ) + ( $tally['abandoned'] ?? 0 ) ) === 0 ) {
            return;
        }

        $settings = Tempaloo_WebP_Plugin::get_settings();
        $license_key = (string) ( $settings['license_key'] ?? '' );
        if ( '' === $license_key ) return;

        $base = rtrim( TEMPALOO_WEBP_API_BASE, '/' );
        wp_remote_post(
            $base . '/notify/bulk-retry-complete',
            [
                'timeout' => 8,
                'headers' => [
                    'Content-Type'  => 'application/json',
                    'X-License-Key' => $license_key,
                ],
                'body'    => wp_json_encode( [
                    'converted' => (int) ( $tally['recovered'] ?? 0 ),
                    'abandoned' => (int) ( $tally['abandoned'] ?? 0 ),
                    'site_url'  => home_url(),
                ] ),
                // Fire-and-forget; we don't want a Brevo blip to leave
                // the user's site spinning waiting for the cron tick
                // to return. The API also dedupes server-side so a
                // missed call here just means no email — never a
                // duplicate one.
                'blocking' => false,
            ]
        );

        // Activity log so the admin sees the wrap-up event in their
        // own UI even if Brevo is misconfigured / mail failed silently.
        Tempaloo_WebP_Activity::log(
            'retry_queue',
            'success',
            sprintf(
                /* translators: 1: images recovered by background retries, 2: images abandoned after 6 attempts */
                __( 'Background retries finished · %1$d recovered · %2$d abandoned', 'tempaloo-webp' ),
                (int) ( $tally['recovered'] ?? 0 ),
                (int) ( $tally['abandoned'] ?? 0 )
            ),
            [
                'recovered' => (int) ( $tally['recovered'] ?? 0 ),
                'abandoned' => (int) ( $tally['abandoned'] ?? 0 ),
            ]
        );
    }

    public static function stats() {
        $queue = self::get_queue();
        $now = time();
        $pending = count( $queue );
        $due = 0;
        $next_at = 0;
        foreach ( $queue as $entry ) {
            if ( (int) ( $entry['next_at'] ?? 0 ) <= $now ) $due++;
            $n = (int) ( $entry['next_at'] ?? 0 );
            if ( $n > $now && ( $next_at === 0 || $n < $next_at ) ) $next_at = $n;
        }
        return [
            'pending'       => $pending,
            'dueNow'        => $due,
            'nextRetryAt'   => $next_at,
        ];
    }

    private static function backoff_for( $attempt_index ) {
        $i = max( 0, (int) $attempt_index );
        if ( isset( self::BACKOFF[ $i ] ) ) return self::BACKOFF[ $i ];
        // Past the table, repeat the last value until MAX_ATTEMPTS.
        return end( self::BACKOFF );
    }

    private static function get_queue() {
        $q = get_option( self::OPTION, [] );
        return is_array( $q ) ? $q : [];
    }

    private static function save_queue( array $queue ) {
        if ( empty( $queue ) ) {
            delete_option( self::OPTION );
            return;
        }
        update_option( self::OPTION, $queue, false );
    }
}
