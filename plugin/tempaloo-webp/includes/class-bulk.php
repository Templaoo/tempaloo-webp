<?php
defined( 'ABSPATH' ) || exit;

/**
 * Bulk conversion of the existing media library.
 *
 * Strategy: the client-side JS drives the loop. Each AJAX tick processes a
 * small batch (default 3 attachments), so long jobs survive refreshes and
 * PHP timeouts. State lives in an option for resumability.
 */
class Tempaloo_WebP_Bulk {

    const STATE_OPTION = 'tempaloo_webp_bulk_state';
    const NONCE        = 'tempaloo_webp_bulk';
    const BATCH_SIZE   = 3;

    public function register() {
        add_action( 'wp_ajax_tempaloo_webp_bulk_scan',    [ $this, 'ajax_scan' ] );
        add_action( 'wp_ajax_tempaloo_webp_bulk_start',   [ $this, 'ajax_start' ] );
        add_action( 'wp_ajax_tempaloo_webp_bulk_tick',    [ $this, 'ajax_tick' ] );
        add_action( 'wp_ajax_tempaloo_webp_bulk_cancel',  [ $this, 'ajax_cancel' ] );
        add_action( 'wp_ajax_tempaloo_webp_bulk_status',  [ $this, 'ajax_status' ] );
        add_action( 'wp_ajax_tempaloo_webp_bulk_resume',  [ $this, 'ajax_resume' ] );
    }

    public function ajax_scan() {
        $this->check_caps();
        $report = $this->scan_breakdown( 5000 );
        // Strip the internal id list — only counters travel over the wire.
        unset( $report['pendingIds'] );
        wp_send_json_success( $report );
    }

    public function ajax_start() {
        $this->check_caps();
        $s = Tempaloo_WebP_Plugin::get_settings();
        if ( empty( $s['license_valid'] ) ) {
            wp_send_json_error( [ 'message' => __( 'Activate a license first.', 'tempaloo-webp' ) ], 400 );
        }

        $ids = $this->find_pending_ids( 5000 );
        $state = [
            'status'    => empty( $ids ) ? 'done' : 'running',
            'total'     => count( $ids ),
            'processed' => 0,
            'succeeded' => 0,
            'failed'    => 0,
            'remaining' => array_values( $ids ),
            'errors'    => [],
            'started_at' => time(),
        ];
        update_option( self::STATE_OPTION, $state, false );
        wp_send_json_success( $this->public_state( $state ) );
    }

    public function ajax_tick() {
        $this->check_caps();
        $state = get_option( self::STATE_OPTION );
        if ( ! is_array( $state ) || 'running' !== ( $state['status'] ?? '' ) ) {
            wp_send_json_error( [ 'message' => __( 'No running job.', 'tempaloo-webp' ) ], 409 );
        }

        $s = Tempaloo_WebP_Plugin::get_settings();

        $batch = array_splice( $state['remaining'], 0, self::BATCH_SIZE );
        foreach ( $batch as $attachment_id ) {
            $res = $this->convert_attachment( (int) $attachment_id, $s );
            $state['processed']++;
            if ( $res['ok'] ) {
                $state['succeeded']++;
            } else {
                $state['failed']++;
                if ( count( $state['errors'] ) < 20 ) {
                    $state['errors'][] = [
                        'id'      => (int) $attachment_id,
                        'code'    => $res['code'],
                        'message' => $res['message'],
                    ];
                }
                if ( 'quota_exceeded' === $res['code'] ) {
                    $state['status'] = 'paused_quota';
                    break;
                }
                if ( 'daily_bulk_limit_reached' === $res['code'] ) {
                    $state['status'] = 'paused_daily_limit';
                    break;
                }
                // Infra failure during bulk → enqueue for background retry.
                if ( in_array( $res['code'], [ 'http_error', 'no_output' ], true )
                  || ( is_string( $res['code'] ) && 0 === strpos( $res['code'], 'status_5' ) ) ) {
                    Tempaloo_WebP_Retry_Queue::enqueue( (int) $attachment_id, $res['code'] );
                }
            }
        }

        if ( empty( $state['remaining'] ) && 'running' === $state['status'] ) {
            $state['status']      = 'done';
            $state['finished_at'] = time();
        }

        update_option( self::STATE_OPTION, $state, false );
        wp_send_json_success( $this->public_state( $state ) );
    }

    public function ajax_cancel() {
        $this->check_caps();
        $state = get_option( self::STATE_OPTION );
        if ( is_array( $state ) ) {
            $state['status'] = 'canceled';
            $state['remaining'] = [];
            update_option( self::STATE_OPTION, $state, false );
            wp_send_json_success( $this->public_state( $state ) );
            return;
        }
        wp_send_json_success( $this->public_state( [] ) );
    }

    public function ajax_status() {
        $this->check_caps();
        $state = get_option( self::STATE_OPTION );
        // Always return the full public shape so the React client can rely on every key.
        wp_send_json_success( $this->public_state( is_array( $state ) ? $state : [] ) );
    }

    /**
     * Resume a job that was paused on quota_exceeded. We probe the API once
     * to confirm the user actually has credits again — avoids replaying the
     * loop just to hit 402 again on the very next attachment.
     */
    public function ajax_resume() {
        $this->check_caps();
        $state  = get_option( self::STATE_OPTION );
        $status = is_array( $state ) ? ( $state['status'] ?? '' ) : '';
        if ( ! in_array( $status, [ 'paused_quota', 'paused_daily_limit' ], true ) || empty( $state['remaining'] ) ) {
            wp_send_json_error( [ 'message' => __( 'No paused job to resume.', 'tempaloo-webp' ) ], 409 );
        }
        $s = Tempaloo_WebP_Plugin::get_settings();
        if ( empty( $s['license_valid'] ) ) {
            wp_send_json_error( [ 'message' => __( 'Activate a license first.', 'tempaloo-webp' ) ], 400 );
        }

        if ( 'paused_quota' === $status ) {
            // Verify credits before replaying the loop.
            $client = new Tempaloo_WebP_API_Client( $s['license_key'] );
            $q = $client->get_quota();
            $remaining = ( ! empty( $q['ok'] ) && isset( $q['data']['images_remaining'] ) )
                ? (int) $q['data']['images_remaining']
                : 0;
            if ( $remaining <= 0 ) {
                wp_send_json_error( [
                    'message' => __( 'Still out of credits. Upgrade your plan or wait for the monthly reset.', 'tempaloo-webp' ),
                    'code'    => 'quota_exceeded',
                ], 402 );
            }
            delete_option( 'tempaloo_webp_quota_exceeded_at' );
        }
        // For paused_daily_limit we let the loop re-call the API — if the
        // UTC day has rolled over, the next tick succeeds; otherwise it
        // immediately pauses again, which is the correct signal.

        $state['status'] = 'running';
        update_option( self::STATE_OPTION, $state, false );
        wp_send_json_success( $this->public_state( $state ) );
    }

    private function public_state( array $state ) {
        return [
            'status'    => $state['status'] ?? 'idle',
            'total'     => (int) ( $state['total'] ?? 0 ),
            'processed' => (int) ( $state['processed'] ?? 0 ),
            'succeeded' => (int) ( $state['succeeded'] ?? 0 ),
            'failed'    => (int) ( $state['failed'] ?? 0 ),
            'errors'    => array_values( $state['errors'] ?? [] ),
        ];
    }

    private function check_caps() {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( [ 'message' => __( 'Forbidden.', 'tempaloo-webp' ) ], 403 );
        }
        check_ajax_referer( self::NONCE, 'nonce' );
    }

    /**
     * Resolves which output formats the bulk scan should consider an
     * attachment "complete" against. Mirrors the converter's downgrade
     * logic so the bulk view never asks the user to convert into a
     * format their plan doesn't support.
     *
     * @return array{0: array<string>, 1: string} [extensions to expect, resolved format label]
     */
    private function expected_extensions() {
        $s = Tempaloo_WebP_Plugin::get_settings();
        $fmt = isset( $s['output_format'] ) ? (string) $s['output_format'] : 'webp';
        if ( 'both' === $fmt && empty( $s['supports_avif'] ) ) $fmt = 'webp';
        if ( 'avif' === $fmt && empty( $s['supports_avif'] ) ) $fmt = 'webp';
        if ( ! in_array( $fmt, [ 'webp', 'avif', 'both' ], true ) )  $fmt = 'webp';

        if ( 'both' === $fmt ) return [ [ '.webp', '.avif' ], 'both' ];
        if ( 'avif' === $fmt ) return [ [ '.avif' ], 'avif' ];
        return [ [ '.webp' ], 'webp' ];
    }

    /**
     * Returns the list of attachment IDs the user's CURRENT format setting
     * considers "incomplete". An image converted only to WebP becomes
     * pending again the moment the user switches to "Both" or "AVIF only" —
     * the missing sibling is what bulk is for.
     *
     * Existence is checked on disk per-size (original + every WP-generated
     * size), so the scan reflects reality even if the meta block claims
     * something different (e.g. a sibling was hand-deleted).
     */
    private function find_pending_ids( $limit = 5000 ) {
        $report = $this->scan_breakdown( $limit );
        return $report['pendingIds'];
    }

    /**
     * Detailed inventory used by ajax_scan to drive the pre-flight panel
     * and by ajax_start to seed the running queue. Single source of truth
     * — both code paths agree on what "pending" means for the current
     * output_format setting.
     *
     * The returned `pendingIds` is intentionally NOT exposed to the
     * client; only the counters travel over JSON.
     *
     * @param int $limit
     * @return array{
     *   total:int, fullyConverted:int, pending:int,
     *   missingWebp:int, missingAvif:int,
     *   targetFormat:string, expectedExts:array<string>,
     *   pendingIds:array<int>
     * }
     */
    private function scan_breakdown( $limit = 5000 ) {
        global $wpdb;
        $limit = (int) $limit;

        list( $expected_exts, $target_fmt ) = $this->expected_extensions();

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

        $report = [
            'total'          => count( (array) $ids ),
            'fullyConverted' => 0,
            'pending'        => 0,
            'missingWebp'    => 0,
            'missingAvif'    => 0,
            // Orphans: attachments where siblings sit on disk but the
            // tempaloo_webp meta block is gone. Almost always the
            // signature of a Restore that didn't fully clean up
            // (LiteSpeed object cache lock, permission glitch, etc.).
            // Counted separately so the user can spot the drift instead
            // of the scan silently treating these as "fully converted".
            'orphanedSiblings' => 0,
            // Attachments with NO original on disk (broken WP record,
            // CDN-pulled attachment whose file was never downloaded).
            // Skipped — surfaced so the user understands why the total
            // and fullyConverted+pending may not add up.
            'brokenPaths'    => 0,
            // Attachments where the API declined at least one AVIF encode
            // because the input exceeded the dyno memory budget (>2.25 MP
            // on the 512 MB Render Starter). The user can ignore — these
            // images already have WebP coverage and the AVIF gap is
            // tracked separately so re-bulks don't burn credits trying.
            'avifSkippedTier' => 0,
            'targetFormat'   => $target_fmt,
            'expectedExts'   => $expected_exts,
            'pendingIds'     => [],
        ];

        if ( empty( $ids ) ) {
            return $report;
        }

        foreach ( $ids as $id ) {
            $orig = get_attached_file( (int) $id );
            if ( ! $orig || ! file_exists( $orig ) ) {
                $report['brokenPaths']++;
                continue;
            }

            $meta = wp_get_attachment_metadata( (int) $id );
            $paths = [ $orig ];
            if ( ! empty( $meta['sizes'] ) && is_array( $meta['sizes'] ) ) {
                foreach ( $meta['sizes'] as $size ) {
                    if ( ! empty( $size['file'] ) ) {
                        $paths[] = trailingslashit( dirname( $orig ) ) . $size['file'];
                    }
                }
            }

            // Server-side skipped encodes recorded after a previous bulk
            // (e.g. AVIF inputs the API tier couldn't fit in heap). Those
            // (filename × format) pairs MUST be excluded from the pending
            // check — otherwise the scan re-queues them every time and
            // each retry burns 1 credit for a known-bad encode.
            $skipped_map = [];
            if ( ! empty( $meta['tempaloo_webp']['skipped'] ) && is_array( $meta['tempaloo_webp']['skipped'] ) ) {
                foreach ( $meta['tempaloo_webp']['skipped'] as $key => $_reason ) {
                    $skipped_map[ (string) $key ] = true;
                }
            }

            // Pending = at least one (path, expected_ext) pair is missing
            // AND not server-side-skipped. Also track which extension is
            // missing for the breakdown and whether ANY sibling exists
            // (orphan detection).
            $needs_webp      = false;
            $needs_avif      = false;
            $is_pending      = false;
            $has_any_sibling = false;
            foreach ( $paths as $p ) {
                $base = basename( $p );
                if ( in_array( '.webp', $expected_exts, true )
                  && ! file_exists( $p . '.webp' )
                  && empty( $skipped_map[ $base . '|webp' ] ) ) {
                    $needs_webp = true;
                    $is_pending = true;
                }
                if ( in_array( '.avif', $expected_exts, true )
                  && ! file_exists( $p . '.avif' )
                  && empty( $skipped_map[ $base . '|avif' ] ) ) {
                    $needs_avif = true;
                    $is_pending = true;
                }
                if ( file_exists( $p . '.webp' ) || file_exists( $p . '.avif' ) ) {
                    $has_any_sibling = true;
                }
            }

            if ( $is_pending ) {
                $report['pendingIds'][] = (int) $id;
                $report['pending']++;
                if ( $needs_webp ) $report['missingWebp']++;
                if ( $needs_avif ) $report['missingAvif']++;
            } else {
                $report['fullyConverted']++;
            }

            // Orphan = no tempaloo_webp meta but siblings still on disk.
            // Independent of pending/done: an orphan can be either, since
            // its siblings might happen to match the user's current format
            // selection or not. Either way, it's a sign that meta and disk
            // got out of sync.
            if ( $has_any_sibling && empty( $meta['tempaloo_webp'] ) ) {
                $report['orphanedSiblings']++;
            }

            // Track attachments where AVIF was skipped server-side (input
            // too big for the API's heap budget). Helps the user understand
            // why "Need AVIF" stays at zero when most images are fully
            // converted but the originals are too large.
            if ( ! empty( $skipped_map ) ) {
                $has_avif_skip = false;
                foreach ( array_keys( $skipped_map ) as $k ) {
                    if ( substr( $k, -5 ) === '|avif' ) { $has_avif_skip = true; break; }
                }
                if ( $has_avif_skip ) {
                    $report['avifSkippedTier']++;
                }
            }
        }

        return $report;
    }

    private function convert_attachment( $attachment_id, array $settings ) {
        $meta = wp_get_attachment_metadata( $attachment_id );
        if ( ! is_array( $meta ) ) $meta = [];

        // The bulk loop always runs in "bulk" mode so the API can enforce
        // the Free-plan daily cap (auto-convert on upload stays "auto").
        $result = Tempaloo_WebP_Converter::convert_all_sizes( $attachment_id, $meta, $settings, 'bulk' );

        if ( $result['converted'] > 0 ) {
            wp_update_attachment_metadata( $attachment_id, $result['metadata'] );
            return [ 'ok' => true, 'code' => 'ok', 'message' => sprintf( '%d sizes converted', $result['converted'] ) ];
        }

        $code    = $result['error_code'] !== '' ? $result['error_code'] : 'no_output';
        $message = 'quota_exceeded' === $code
            ? 'Quota reached'
            : ( $result['failed'] > 0 ? 'All sizes failed' : 'Nothing to convert' );
        return [ 'ok' => false, 'code' => $code, 'message' => $message ];
    }
}
