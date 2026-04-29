<?php
defined( 'ABSPATH' ) || exit;

class Tempaloo_WebP_API_Client {

    const HEALTH_OPTION = 'tempaloo_webp_api_health';

    private $base;
    private $license_key;

    public function __construct( $license_key = '' ) {
        $this->base        = rtrim( TEMPALOO_WEBP_API_BASE, '/' );
        $this->license_key = (string) $license_key;
    }

    /**
     * Path-traversal guard for any local file we read before sending to
     * the API. Confirms the resolved real path lives under WordPress's
     * own upload base directory — so even if a future caller passes a
     * tainted path (filter override, REST input, etc.) we refuse to
     * read /etc/passwd or wp-config.php.
     *
     * Returns the resolved path on success, false if the path is unsafe
     * or doesn't exist. Callers must check the return.
     */
    private static function resolve_safe_upload_path( $path ) {
        if ( ! is_string( $path ) || '' === $path ) {
            return false;
        }
        $real = realpath( $path );
        if ( false === $real ) {
            return false; // file doesn't exist or is unreadable
        }
        $upload   = wp_get_upload_dir();
        $base     = isset( $upload['basedir'] ) ? realpath( (string) $upload['basedir'] ) : false;
        if ( false === $base ) {
            // No usable upload basedir — fail closed.
            return false;
        }
        // Normalize separators for Windows hosts (Local by Flywheel etc.)
        $real_norm = str_replace( '\\', '/', $real );
        $base_norm = str_replace( '\\', '/', $base );
        if ( 0 !== strpos( $real_norm, rtrim( $base_norm, '/' ) . '/' ) ) {
            return false; // outside the uploads tree
        }
        return $real;
    }

    /**
     * Records the outcome of an API call so the admin UI can surface
     * "API unreachable" without each caller having to remember.
     *
     * - On any network error / 5xx: stores { failed_at, code, message, attempts }.
     * - On 2xx: clears the option entirely.
     * - On 4xx (auth, quota, validation): treated as healthy — those are
     *   application-level signals, not infra outages.
     */
    public static function record_health( $ok, $code = null, $message = '' ) {
        if ( $ok ) {
            delete_option( self::HEALTH_OPTION );
            return;
        }
        $cur = get_option( self::HEALTH_OPTION );
        $attempts = is_array( $cur ) && isset( $cur['attempts'] ) ? (int) $cur['attempts'] + 1 : 1;
        update_option(
            self::HEALTH_OPTION,
            [
                'failed_at' => time(),
                'code'      => (string) $code,
                'message'   => substr( (string) $message, 0, 240 ),
                'attempts'  => $attempts,
            ],
            false
        );
    }


    public function verify_license( $site_url ) {
        $resp = wp_remote_post(
            $this->base . '/license/verify',
            [
                'timeout' => 15,
                'headers' => [ 'Content-Type' => 'application/json' ],
                'body'    => wp_json_encode( [
                    'license_key'    => $this->license_key,
                    'site_url'       => $site_url,
                    'wp_version'     => get_bloginfo( 'version' ),
                    'plugin_version' => TEMPALOO_WEBP_VERSION,
                ] ),
            ]
        );
        return $this->parse_json( $resp );
    }

    public function get_quota() {
        $resp = wp_remote_get(
            $this->base . '/quota',
            [
                'timeout' => 10,
                'headers' => [ 'X-License-Key' => $this->license_key ],
            ]
        );
        return $this->parse_json( $resp );
    }

    /**
     * Converts an image file and returns the binary data.
     *
     * @return array{ok:bool, body?:string, content_type?:string, used?:int, limit?:int, error?:array}
     */
    public function convert_file( $file_path, $format = 'webp', $quality = 82 ) {
        $safe_path = self::resolve_safe_upload_path( $file_path );
        if ( false === $safe_path ) {
            return [ 'ok' => false, 'error' => [ 'code' => 'missing_file', 'message' => 'File not found or outside uploads' ] ];
        }

        $boundary = wp_generate_password( 24, false );
        $eol      = "\r\n";
        $body     = '';
        $body .= "--{$boundary}{$eol}";
        $body .= 'Content-Disposition: form-data; name="format"' . $eol . $eol . $format . $eol;
        $body .= "--{$boundary}{$eol}";
        $body .= 'Content-Disposition: form-data; name="quality"' . $eol . $eol . (int) $quality . $eol;
        $body .= "--{$boundary}{$eol}";
        $body .= 'Content-Disposition: form-data; name="image"; filename="' . basename( $safe_path ) . '"' . $eol;
        $body .= 'Content-Type: ' . $this->guess_mime( $safe_path ) . $eol . $eol;
        // Reading a local file under wp-content/uploads, validated above by
        // resolve_safe_upload_path() — refuses anything outside the tree
        // so a tainted path can't leak /etc/passwd or wp-config.php.
        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
        $body .= file_get_contents( $safe_path ) . $eol;
        $body .= "--{$boundary}--{$eol}";

        $resp = wp_remote_post(
            $this->base . '/convert',
            [
                'timeout' => 60,
                'headers' => [
                    'X-License-Key' => $this->license_key,
                    'X-Site-Url'    => home_url(),
                    'Content-Type'  => "multipart/form-data; boundary={$boundary}",
                ],
                'body' => $body,
            ]
        );

        if ( is_wp_error( $resp ) ) {
            self::record_health( false, 'http_error', $resp->get_error_message() );
            return [ 'ok' => false, 'error' => [ 'code' => 'http_error', 'message' => $resp->get_error_message() ] ];
        }
        $code = (int) wp_remote_retrieve_response_code( $resp );
        if ( 200 !== $code ) {
            $data = json_decode( wp_remote_retrieve_body( $resp ), true );
            self::record_health( $code < 500, 'status_' . $code, 'Conversion failed' );
            return [ 'ok' => false, 'error' => isset( $data['error'] ) ? $data['error'] : [ 'code' => 'status_' . $code, 'message' => 'Conversion failed' ] ];
        }
        self::record_health( true );
        return [
            'ok'            => true,
            'body'          => wp_remote_retrieve_body( $resp ),
            'content_type'  => wp_remote_retrieve_header( $resp, 'content-type' ),
            'used'          => (int) wp_remote_retrieve_header( $resp, 'x-quota-used' ),
            'limit'         => (int) wp_remote_retrieve_header( $resp, 'x-quota-limit' ),
            'output_bytes'  => (int) wp_remote_retrieve_header( $resp, 'x-output-bytes' ),
        ];
    }

    private function parse_json( $resp ) {
        if ( is_wp_error( $resp ) ) {
            self::record_health( false, 'http_error', $resp->get_error_message() );
            return [ 'ok' => false, 'error' => [ 'code' => 'http_error', 'message' => $resp->get_error_message() ] ];
        }
        $code = (int) wp_remote_retrieve_response_code( $resp );
        $body = json_decode( wp_remote_retrieve_body( $resp ), true );
        if ( $code >= 200 && $code < 300 ) {
            self::record_health( true );
            return [ 'ok' => true, 'data' => $body ];
        }
        if ( $code >= 500 ) {
            self::record_health( false, 'status_' . $code, 'Server error' );
        } else {
            // 4xx = app-level (auth/quota/validation). The API is healthy.
            self::record_health( true );
        }
        return [
            'ok'    => false,
            'error' => isset( $body['error'] ) ? $body['error'] : [ 'code' => 'status_' . $code, 'message' => 'Request failed' ],
        ];
    }

    /**
     * Batch convert: send N files (all sizes of one attachment), consumes 1 credit.
     *
     * $mode is used by the API to enforce the Free-plan daily bulk cap:
     *   - 'auto' (default) → unlimited within monthly quota (new uploads)
     *   - 'bulk'           → counted against the daily bulk cap on Free
     *
     * @return array{ok:bool, files?:array, used?:int, limit?:int, error?:array}
     */
    public function convert_batch( array $file_paths, $format = 'webp', $quality = 82, $mode = 'auto' ) {
        // Same path-containment guard as convert_file(). Filters out
        // anything outside wp-content/uploads/ — wins on a per-path
        // basis, so a single bad path doesn't kill the whole batch.
        $paths = array();
        foreach ( $file_paths as $candidate ) {
            $resolved = self::resolve_safe_upload_path( $candidate );
            if ( false !== $resolved ) {
                $paths[] = $resolved;
            }
        }
        if ( empty( $paths ) ) {
            return [ 'ok' => false, 'error' => [ 'code' => 'no_files', 'message' => 'No source files' ] ];
        }

        $boundary = wp_generate_password( 24, false );
        $eol      = "\r\n";
        $body     = '';
        $body .= "--{$boundary}{$eol}";
        $body .= 'Content-Disposition: form-data; name="format"' . $eol . $eol . $format . $eol;
        $body .= "--{$boundary}{$eol}";
        $body .= 'Content-Disposition: form-data; name="quality"' . $eol . $eol . (int) $quality . $eol;
        foreach ( $paths as $p ) {
            $body .= "--{$boundary}{$eol}";
            $body .= 'Content-Disposition: form-data; name="image[]"; filename="' . basename( $p ) . '"' . $eol;
            $body .= 'Content-Type: ' . $this->guess_mime( $p ) . $eol . $eol;
            // Local read — path containment validated by resolve_safe_upload_path.
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
            $body .= file_get_contents( $p ) . $eol;
        }
        $body .= "--{$boundary}--{$eol}";

        $resp = wp_remote_post(
            $this->base . '/convert/batch',
            [
                'timeout' => 120,
                'headers' => [
                    'X-License-Key'   => $this->license_key,
                    'X-Site-Url'      => home_url(),
                    'X-Tempaloo-Mode' => $mode,
                    'Content-Type'    => "multipart/form-data; boundary={$boundary}",
                ],
                'body' => $body,
            ]
        );

        if ( is_wp_error( $resp ) ) {
            self::record_health( false, 'http_error', $resp->get_error_message() );
            return [ 'ok' => false, 'error' => [ 'code' => 'http_error', 'message' => $resp->get_error_message() ] ];
        }
        $code = (int) wp_remote_retrieve_response_code( $resp );
        $data = json_decode( wp_remote_retrieve_body( $resp ), true );
        if ( 200 !== $code ) {
            self::record_health( $code < 500, 'status_' . $code, 'Batch failed' );
            return [
                'ok'    => false,
                'error' => isset( $data['error'] ) ? $data['error'] : [ 'code' => 'status_' . $code, 'message' => 'Batch failed' ],
            ];
        }
        self::record_health( true );
        return [
            'ok'    => true,
            'files' => isset( $data['files'] ) ? $data['files'] : [],
            'used'  => (int) wp_remote_retrieve_header( $resp, 'x-quota-used' ),
            'limit' => (int) wp_remote_retrieve_header( $resp, 'x-quota-limit' ),
        ];
    }

    private function guess_mime( $path ) {
        $ext = strtolower( pathinfo( $path, PATHINFO_EXTENSION ) );
        switch ( $ext ) {
            case 'jpg':
            case 'jpeg': return 'image/jpeg';
            case 'png':  return 'image/png';
            case 'gif':  return 'image/gif';
            case 'webp': return 'image/webp';
            case 'avif': return 'image/avif';
            default:     return 'application/octet-stream';
        }
    }
}
