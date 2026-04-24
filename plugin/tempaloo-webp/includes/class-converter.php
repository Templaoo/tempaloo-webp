<?php
defined( 'ABSPATH' ) || exit;

class Tempaloo_WebP_Converter {

    public function register() {
        add_filter( 'wp_generate_attachment_metadata', [ $this, 'on_generate_metadata' ], 10, 2 );
    }

    /**
     * Fires after WP generates metadata (resizes) for a new upload.
     * Converts the original + every generated size to WebP/AVIF.
     */
    public function on_generate_metadata( $metadata, $attachment_id ) {
        $s = Tempaloo_WebP_Plugin::get_settings();
        if ( empty( $s['license_valid'] ) || empty( $s['auto_convert'] ) ) {
            return $metadata;
        }
        if ( ! self::is_supported_attachment( $attachment_id ) ) {
            return $metadata;
        }

        $result = self::convert_all_sizes( $attachment_id, $metadata, $s );

        // Conversion failed for an infra reason → enqueue for cron retry.
        // Quota / auth failures stay out of the queue (need user action).
        if ( $result['converted'] === 0 && self::is_retryable( $result['error_code'] ?? '' ) ) {
            Tempaloo_WebP_Retry_Queue::enqueue( $attachment_id, $result['error_code'] );
        }

        return $result['metadata'];
    }

    private static function is_retryable( $code ) {
        if ( '' === $code ) return false;
        $non_retryable = [ 'quota_exceeded', 'unauthorized', 'forbidden', 'site_limit_reached', 'missing_file', 'unprocessable_image' ];
        return ! in_array( $code, $non_retryable, true );
    }

    /**
     * Converts the original + every size in $metadata['sizes'] in ONE API call.
     * Consumes exactly 1 credit from the user's quota (regardless of sizes count).
     *
     * Returns ['metadata' => updated_meta, 'converted' => n, 'failed' => n, 'error_code' => '…'].
     */
    public static function convert_all_sizes( $attachment_id, $metadata, array $settings, $mode = 'auto' ) {
        $file = get_attached_file( $attachment_id );
        if ( ! $file || ! file_exists( $file ) ) {
            return [ 'metadata' => $metadata, 'converted' => 0, 'failed' => 0, 'error_code' => 'missing_file' ];
        }

        $format = $settings['output_format'];
        if ( 'avif' === $format && empty( $settings['supports_avif'] ) ) {
            $format = 'webp';
        }
        $quality = (int) $settings['quality'];
        $client  = new Tempaloo_WebP_API_Client( $settings['license_key'] );

        if ( ! is_array( $metadata ) ) {
            $metadata = [];
        }

        // Collect paths: original + each size.
        $original_dir = dirname( $file );
        $paths = [ $file ];
        if ( ! empty( $metadata['sizes'] ) && is_array( $metadata['sizes'] ) ) {
            foreach ( $metadata['sizes'] as $size ) {
                if ( ! empty( $size['file'] ) ) {
                    $paths[] = trailingslashit( $original_dir ) . $size['file'];
                }
            }
        }
        $paths = array_values( array_unique( $paths ) );

        $res = $client->convert_batch( $paths, $format, $quality, $mode );
        if ( empty( $res['ok'] ) ) {
            $code = isset( $res['error']['code'] ) ? $res['error']['code'] : 'error';
            if ( 'quota_exceeded' === $code ) {
                update_option( 'tempaloo_webp_quota_exceeded_at', time(), false );
            }
            return [ 'metadata' => $metadata, 'converted' => 0, 'failed' => count( $paths ), 'error_code' => $code ];
        }

        // Write returned files back next to their originals.
        $by_name = [];
        foreach ( $paths as $p ) {
            $by_name[ basename( $p ) ] = $p;
        }

        $converted = 0;
        $failed    = 0;
        $generated = [];
        foreach ( $res['files'] as $f ) {
            if ( empty( $f['name'] ) || empty( $f['data'] ) ) { $failed++; continue; }
            $src_path = isset( $by_name[ $f['name'] ] ) ? $by_name[ $f['name'] ] : null;
            if ( ! $src_path ) { $failed++; continue; }
            $target   = $src_path . '.' . $format;
            $binary   = base64_decode( $f['data'], true );
            if ( false === $binary || ! @file_put_contents( $target, $binary ) ) {
                $failed++;
                continue;
            }
            $converted++;
            $generated[ $f['name'] ] = [
                'file'  => basename( $target ),
                'bytes' => isset( $f['output_bytes'] ) ? (int) $f['output_bytes'] : strlen( $binary ),
            ];
        }

        $metadata['tempaloo_webp'] = [
            'format'    => $format,
            'sizes'     => $generated,
            'converted' => $converted,
            'at'        => time(),
        ];

        return [ 'metadata' => $metadata, 'converted' => $converted, 'failed' => $failed, 'error_code' => '' ];
    }

    public static function is_supported_attachment( $attachment_id ) {
        $mime = get_post_mime_type( $attachment_id );
        return in_array( $mime, [ 'image/jpeg', 'image/png', 'image/gif' ], true );
    }
}
