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
            'plan'             => isset( $res['data']['plan'] ) ? (string) $res['data']['plan'] : '',
            'supports_avif'    => ! empty( $res['data']['supports_avif'] ),
            'images_limit'     => isset( $res['data']['images_limit'] ) ? (int) $res['data']['images_limit'] : 0,
            'sites_limit'      => isset( $res['data']['sites_limit'] ) ? (int) $res['data']['sites_limit'] : 0,
            'last_verified_at' => time(),
        ] );
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
            $patch['output_format'] = 'avif' === $p['outputFormat'] ? 'avif' : 'webp';
        }
        if ( array_key_exists( 'autoConvert', $p ) ) {
            $patch['auto_convert'] = ! empty( $p['autoConvert'] );
        }
        if ( array_key_exists( 'serveWebp', $p ) ) {
            $patch['serve_webp'] = ! empty( $p['serveWebp'] );
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
                    'imagesUsed'      => (int) ( $d['images_used']      ?? 0 ),
                    'imagesLimit'     => (int) ( $d['images_limit']     ?? 0 ),
                    'imagesRemaining' => (int) ( $d['images_remaining'] ?? 0 ),
                    'sitesUsed'       => (int) ( $d['sites_used']       ?? 0 ),
                    'sitesLimit'      => (int) ( $d['sites_limit']      ?? 0 ),
                    'periodStart'     => (string) ( $d['period_start']  ?? '' ),
                    'periodEnd'       => (string) ( $d['period_end']    ?? '' ),
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
                'supportsAvif'  => ! empty( $s['supports_avif'] ),
                'imagesLimit'   => (int) $s['images_limit'],
                'sitesLimit'    => (int) $s['sites_limit'],
            ],
            'quota'           => $quota,
            'quotaExceededAt' => $exceeded_at > 0 ? $exceeded_at : null,
            'apiHealth'       => $api_health,
            'retryQueue'      => Tempaloo_WebP_Retry_Queue::stats(),
            'settings' => [
                'quality'      => (int) $s['quality'],
                'outputFormat' => (string) $s['output_format'],
                'autoConvert'  => ! empty( $s['auto_convert'] ),
                'serveWebp'    => ! empty( $s['serve_webp'] ),
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
