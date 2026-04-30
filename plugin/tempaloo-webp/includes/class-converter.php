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
        $attachment_id = (int) $attachment_id;
        $s = Tempaloo_WebP_Plugin::get_settings();

        // Every branch below logs to Activity so the user can audit
        // exactly what happened to a freshly-uploaded image. Without
        // this log, an early-return (no license, mime not supported,
        // auto_convert toggled off) was completely silent — the
        // Optimized column just showed "—" and the user had no way
        // to know WHY no conversion fired.

        if ( empty( $s['license_valid'] ) ) {
            Tempaloo_WebP_Activity::log(
                'auto_convert', 'warn',
                sprintf(
                    /* translators: %d: attachment ID */
                    __( 'Auto-convert skipped for #%d — license is not active', 'tempaloo-webp' ),
                    $attachment_id
                ),
                [ 'attachment_id' => $attachment_id, 'reason' => 'no_license' ]
            );
            return $metadata;
        }
        if ( empty( $s['auto_convert'] ) ) {
            // User deliberately turned this off — don't pollute the log
            // every upload. The Diagnostic tab surfaces the toggle state.
            return $metadata;
        }
        if ( ! self::is_supported_attachment( $attachment_id ) ) {
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
            return $metadata;
        }

        $result = self::convert_all_sizes( $attachment_id, $metadata, $s );

        if ( $result['converted'] > 0 ) {
            Tempaloo_WebP_Activity::log(
                'auto_convert', 'success',
                sprintf(
                    /* translators: 1: attachment ID, 2: number of sizes converted */
                    __( 'Auto-convert #%1$d — %2$d sizes converted', 'tempaloo-webp' ),
                    $attachment_id, (int) $result['converted']
                ),
                [
                    'attachment_id' => $attachment_id,
                    'converted'     => (int) $result['converted'],
                    'failed'        => (int) ( $result['failed'] ?? 0 ),
                ]
            );
        } else {
            $code = isset( $result['error_code'] ) && '' !== $result['error_code']
                ? (string) $result['error_code']
                : 'no_output';
            Tempaloo_WebP_Activity::log(
                'auto_convert', 'error',
                sprintf(
                    /* translators: 1: attachment ID, 2: error code */
                    __( 'Auto-convert FAILED for #%1$d — %2$s', 'tempaloo-webp' ),
                    $attachment_id, $code
                ),
                [
                    'attachment_id' => $attachment_id,
                    'error_code'    => $code,
                    'failed'        => (int) ( $result['failed'] ?? 0 ),
                ]
            );
        }

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

        /**
         * Filter: tempaloo_skip_attachment
         *
         * Return true to bypass conversion for this attachment. Fires on both
         * the auto-convert-on-upload path AND the bulk path, so a "skip"
         * decision is honored everywhere (useful for excluding a folder, a
         * post type, a CPT-bound image, etc.).
         *
         * @param bool   $skip          Default false.
         * @param int    $attachment_id The attachment being processed.
         * @param string $mode          'auto' (on upload) or 'bulk' (CLI / bulk job).
         */
        // The hook prefix matches the plugin slug (`tempaloo_webp`), per
        // WP coding standards. Old `tempaloo_skip_attachment` callers are
        // not preserved — the hook was never publicly documented; safe
        // to rename pre-1.x.
        if ( apply_filters( 'tempaloo_webp_skip_attachment', false, $attachment_id, $mode ) ) {
            return [ 'metadata' => $metadata, 'converted' => 0, 'failed' => 0, 'error_code' => 'skipped' ];
        }

        // Output format selection. 'both' generates AVIF + WebP siblings
        // in a single batch (1 credit, ShortPixel-style coverage). Free
        // and unverified plans don't include AVIF, so anything that asks
        // for it gets gracefully demoted to WebP.
        $format = isset( $settings['output_format'] ) ? (string) $settings['output_format'] : 'webp';
        if ( 'both' === $format && empty( $settings['supports_avif'] ) ) {
            $format = 'webp';
        } elseif ( 'avif' === $format && empty( $settings['supports_avif'] ) ) {
            $format = 'webp';
        } elseif ( ! in_array( $format, [ 'webp', 'avif', 'both' ], true ) ) {
            $format = 'webp';
        }

        /**
         * Filter: tempaloo_quality_for
         *
         * Override the quality value (1–100) for a specific attachment. Lets
         * devs lift quality on portfolio shots, drop it on product thumbs,
         * or branch by mime type / CPT.
         *
         * @param int    $quality       The current quality (default from settings).
         * @param int    $attachment_id The attachment being processed.
         * @param string $format        'webp' or 'avif' — the target format chosen above.
         */
        $quality = (int) apply_filters( 'tempaloo_webp_quality_for', (int) $settings['quality'], $attachment_id, $format );
        $quality = max( 1, min( 100, $quality ) ); // clamp — defends against stray filter values
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
            // Per-file format from the API response (set when format='both'
            // returns two entries per source — one webp, one avif). Falls
            // back to the requested format for legacy single-format batches.
            $entry_fmt = isset( $f['format'] ) && in_array( $f['format'], [ 'webp', 'avif' ], true )
                ? $f['format']
                : ( 'both' === $format ? 'webp' : $format );
            $target   = $src_path . '.' . $entry_fmt;
            $binary   = base64_decode( $f['data'], true );
            // Writing a WebP/AVIF sibling next to the original on the same
            // disk — WP_Filesystem is for remote/credentialed writes and
            // doesn't apply here. The @ silences a benign E_WARNING on
            // read-only hosts; we already return a failed++ below if the
            // write fails.
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
            if ( false === $binary || ! @file_put_contents( $target, $binary ) ) {
                $failed++;
                continue;
            }
            $converted++;
            // Key by name+format so that for 'both' both formats live in
            // the meta block and the savings calc can find each sibling.
            $generated[ $f['name'] . '|' . $entry_fmt ] = [
                'name'   => $f['name'],
                'format' => $entry_fmt,
                'file'   => basename( $target ),
                'bytes'  => isset( $f['output_bytes'] ) ? (int) $f['output_bytes'] : strlen( $binary ),
            ];
        }

        // Server-side skipped encodes (currently only AVIF inputs that
        // exceeded the dyno memory budget). Persist on the attachment so
        // the next bulk scan stops flagging this file as pending forever
        // — without this, every scan re-queues these and we burn one
        // credit per attempt for a result we already know we can't get.
        // Cleared by Restore (which removes the whole tempaloo_webp meta
        // block) or by manually upgrading the API and re-bulking.
        $skipped_pairs = [];
        if ( ! empty( $res['skipped'] ) && is_array( $res['skipped'] ) ) {
            foreach ( $res['skipped'] as $sk ) {
                if ( empty( $sk['name'] ) || empty( $sk['format'] ) ) continue;
                $key = (string) $sk['name'] . '|' . (string) $sk['format'];
                $skipped_pairs[ $key ] = isset( $sk['reason'] ) ? (string) $sk['reason'] : 'skipped';
            }
        }

        $tempaloo_meta = [
            'format'    => $format,
            'sizes'     => $generated,
            'converted' => $converted,
            'at'        => time(),
        ];
        if ( ! empty( $skipped_pairs ) ) {
            $tempaloo_meta['skipped'] = $skipped_pairs;
        }

        // Persist into our dedicated post_meta key — _tempaloo_webp —
        // bypassing the wp_generate_attachment_metadata filter chain
        // entirely. Image-optimizer plugins hooked there (LiteSpeed
        // Cache, Smush, Imagify, ShortPixel) sometimes rebuild the
        // standard metadata array for their own queues and strip
        // unknown sub-keys in the process; we lose the audit trail
        // and the user sees "not converted" right after the converter
        // logs success. Direct update_post_meta is immune.
        Tempaloo_WebP_Plugin::set_conversion_meta( $attachment_id, $tempaloo_meta );

        // ALSO mirror into $metadata['tempaloo_webp'] for backward
        // compatibility — older code paths or third-party plugins
        // looking at the standard metadata key still see the data,
        // even if it's not authoritative anymore.
        $metadata['tempaloo_webp'] = $tempaloo_meta;

        /**
         * Action: tempaloo_after_convert
         *
         * Fired after a successful conversion (one or more sizes written).
         * Use cases: bust a CDN cache, log to a custom system, push a webhook,
         * update an analytics counter, regenerate a JSON manifest, etc.
         *
         * @param int   $attachment_id   The attachment that was converted.
         * @param array $info {
         *     @type string $format     'webp' | 'avif'
         *     @type int    $converted  Number of sizes converted (1 + thumbs).
         *     @type int    $failed     Number of sizes that failed.
         *     @type string $mode       'auto' | 'bulk'.
         *     @type int    $quality    Quality used (post-filter).
         *     @type array  $sizes      Generated sizes map: orig_basename => { file, bytes }.
         * }
         */
        do_action( 'tempaloo_webp_after_convert', $attachment_id, [
            'format'    => $format,
            'converted' => $converted,
            'failed'    => $failed,
            'mode'      => $mode,
            'quality'   => $quality,
            'sizes'     => $generated,
        ] );

        return [ 'metadata' => $metadata, 'converted' => $converted, 'failed' => $failed, 'error_code' => '' ];
    }

    public static function is_supported_attachment( $attachment_id ) {
        $mime = get_post_mime_type( $attachment_id );
        return in_array( $mime, [ 'image/jpeg', 'image/png', 'image/gif' ], true );
    }
}
