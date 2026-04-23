<?php
defined( 'ABSPATH' ) || exit;

class Tempaloo_WebP_API_Client {

    private $base;
    private $license_key;

    public function __construct( $license_key = '' ) {
        $this->base        = rtrim( TEMPALOO_WEBP_API_BASE, '/' );
        $this->license_key = (string) $license_key;
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
        if ( ! file_exists( $file_path ) ) {
            return [ 'ok' => false, 'error' => [ 'code' => 'missing_file', 'message' => 'File not found' ] ];
        }

        $boundary = wp_generate_password( 24, false );
        $eol      = "\r\n";
        $body     = '';
        $body .= "--{$boundary}{$eol}";
        $body .= 'Content-Disposition: form-data; name="format"' . $eol . $eol . $format . $eol;
        $body .= "--{$boundary}{$eol}";
        $body .= 'Content-Disposition: form-data; name="quality"' . $eol . $eol . (int) $quality . $eol;
        $body .= "--{$boundary}{$eol}";
        $body .= 'Content-Disposition: form-data; name="image"; filename="' . basename( $file_path ) . '"' . $eol;
        $body .= 'Content-Type: ' . $this->guess_mime( $file_path ) . $eol . $eol;
        $body .= file_get_contents( $file_path ) . $eol;
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
            return [ 'ok' => false, 'error' => [ 'code' => 'http_error', 'message' => $resp->get_error_message() ] ];
        }
        $code = wp_remote_retrieve_response_code( $resp );
        if ( 200 !== (int) $code ) {
            $data = json_decode( wp_remote_retrieve_body( $resp ), true );
            return [ 'ok' => false, 'error' => isset( $data['error'] ) ? $data['error'] : [ 'code' => 'status_' . $code, 'message' => 'Conversion failed' ] ];
        }
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
            return [ 'ok' => false, 'error' => [ 'code' => 'http_error', 'message' => $resp->get_error_message() ] ];
        }
        $code = (int) wp_remote_retrieve_response_code( $resp );
        $body = json_decode( wp_remote_retrieve_body( $resp ), true );
        if ( $code >= 200 && $code < 300 ) {
            return [ 'ok' => true, 'data' => $body ];
        }
        return [
            'ok'    => false,
            'error' => isset( $body['error'] ) ? $body['error'] : [ 'code' => 'status_' . $code, 'message' => 'Request failed' ],
        ];
    }

    /**
     * Batch convert: send N files (all sizes of one attachment), consumes 1 credit.
     *
     * @return array{ok:bool, files?:array, used?:int, limit?:int, error?:array}
     */
    public function convert_batch( array $file_paths, $format = 'webp', $quality = 82 ) {
        $paths = array_values( array_filter( $file_paths, 'file_exists' ) );
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
            $body .= file_get_contents( $p ) . $eol;
        }
        $body .= "--{$boundary}--{$eol}";

        $resp = wp_remote_post(
            $this->base . '/convert/batch',
            [
                'timeout' => 120,
                'headers' => [
                    'X-License-Key' => $this->license_key,
                    'X-Site-Url'    => home_url(),
                    'Content-Type'  => "multipart/form-data; boundary={$boundary}",
                ],
                'body' => $body,
            ]
        );

        if ( is_wp_error( $resp ) ) {
            return [ 'ok' => false, 'error' => [ 'code' => 'http_error', 'message' => $resp->get_error_message() ] ];
        }
        $code = (int) wp_remote_retrieve_response_code( $resp );
        $data = json_decode( wp_remote_retrieve_body( $resp ), true );
        if ( 200 !== $code ) {
            return [
                'ok'    => false,
                'error' => isset( $data['error'] ) ? $data['error'] : [ 'code' => 'status_' . $code, 'message' => 'Batch failed' ],
            ];
        }
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
