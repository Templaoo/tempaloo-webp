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
        // MIME list is hardcoded so we can safely inline it (no user input).
        $sql = "SELECT ID FROM {$wpdb->posts}
                 WHERE post_type = 'attachment' AND post_status = 'inherit'
                   AND post_mime_type IN ('image/jpeg','image/png','image/gif')
                 ORDER BY ID ASC
                 LIMIT {$limit}";
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

        $result = Tempaloo_WebP_Converter::convert_all_sizes( $attachment_id, $meta, $settings );

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
