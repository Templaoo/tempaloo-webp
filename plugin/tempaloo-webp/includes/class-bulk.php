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
        $ids = $this->find_pending_ids( 5000 ); // cap upfront to avoid huge scans
        wp_send_json_success( [ 'pending' => count( $ids ) ] );
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
            wp_send_json_error( [ 'message' => 'No running job' ], 409 );
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
            wp_send_json_error( [ 'message' => 'No paused job to resume' ], 409 );
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
            wp_send_json_error( [ 'message' => 'Forbidden' ], 403 );
        }
        check_ajax_referer( self::NONCE, 'nonce' );
    }

    /**
     * Finds attachment IDs that are supported types and don't have a sibling
     * converted file yet.
     */
    private function find_pending_ids( $limit = 5000 ) {
        global $wpdb;
        $limit = (int) $limit;
        // MIME list is hardcoded (no user input), but going through prepare()
        // keeps WordPress.org's coding-standards review happy and makes the
        // intent explicit.
        $sql = $wpdb->prepare(
            "SELECT ID FROM {$wpdb->posts}
              WHERE post_type = %s AND post_status = %s
                AND post_mime_type IN ('image/jpeg','image/png','image/gif')
              ORDER BY ID ASC
              LIMIT %d",
            'attachment',
            'inherit',
            $limit
        );
        $ids = $wpdb->get_col( $sql );

        if ( empty( $ids ) ) {
            return [];
        }

        // Filter out those already converted.
        $pending = [];
        foreach ( $ids as $id ) {
            $meta = wp_get_attachment_metadata( (int) $id );
            if ( empty( $meta['tempaloo_webp']['sizes'] ) && empty( $meta['tempaloo_webp']['path'] ) ) {
                $pending[] = (int) $id;
            }
        }
        return $pending;
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
