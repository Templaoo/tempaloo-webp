<?php
defined( 'ABSPATH' ) || exit;

class Tempaloo_WebP_Converter {

    /**
     * Conversion-on-upload registration. **Intentionally a no-op since
     * v1.9.0** — the upload hook is now owned exclusively by
     * Tempaloo_WebP_Async_Upload, which decides between the async
     * (loopback) path and the sync fallback (CLI / cron / XML-RPC) and
     * calls convert_for_upload() in both cases. Keeping the method so
     * the boot sequence in class-plugin.php stays unchanged.
     */
    public function register() {
        // No-op. See Tempaloo_WebP_Async_Upload::register().
    }

    /**
     * Pre-flight gate for the upload path. Centralises the three
     * conditions that must hold before we even consider converting an
     * attachment on upload: an active license, the auto-convert toggle
     * on, and a mime type we can actually transcode. Returns
     * [ true, '' ] on green light, [ false, $reason ] otherwise — the
     * caller decides whether to log or stay silent based on the reason.
     */
    public static function should_run_for_upload( $attachment_id, array $settings ) {
        if ( empty( $settings['license_valid'] ) ) {
            return [ false, 'no_license' ];
        }
        if ( empty( $settings['auto_convert'] ) ) {
            return [ false, 'auto_convert_off' ];
        }
        if ( ! self::is_supported_attachment( $attachment_id ) ) {
            return [ false, 'unsupported_mime' ];
        }
        return [ true, '' ];
    }

    /**
     * Run conversion + activity log + retry-queue enqueue for an
     * attachment uploaded into the Media Library. Extracted from the
     * old on_generate_metadata so both the sync fallback and the
     * async loopback handler can reuse the exact same code path.
     *
     * Returns convert_all_sizes()'s shape with one extra guarantee:
     * activity has been logged (success / error) and retry-queue has
     * been notified for retryable infra errors. The caller still
     * decides what to do with $result['metadata'] (return it from a
     * filter, or persist it via wp_update_attachment_metadata).
     */
    public static function convert_for_upload( $attachment_id, $metadata, array $settings, $mode = 'auto' ) {
        $attachment_id = (int) $attachment_id;
        $result = self::convert_all_sizes( $attachment_id, $metadata, $settings, $mode );

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
                    'mode'          => $mode,
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
                    'mode'          => $mode,
                ]
            );
        }

        // Conversion failed for an infra reason → enqueue for cron retry.
        // Quota / auth failures stay out of the queue (need user action).
        if ( $result['converted'] === 0 && self::is_retryable( $result['error_code'] ?? '' ) ) {
            Tempaloo_WebP_Retry_Queue::enqueue( $attachment_id, $result['error_code'] );
        }

        return $result;
    }

    public static function is_retryable( $code ) {
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
            // Atomic write via temp file + rename. Inspired by WP Smush
            // (core/smush/class-smusher.php put_image_using_temp_file).
            //
            // Why not direct file_put_contents to $target:
            //  · A direct write goes through several states the scanner
            //    can catch — file open, partial write, close. Wordfence /
            //    iThemes Security / mod_security image scanners that
            //    fire on inotify events can see a 0-byte or half-written
            //    .webp and quarantine it. Temp+rename means the final
            //    .webp materialises atomically at its finished size; no
            //    half-state ever exists at the .webp path.
            //  · The .tmp suffix is ignored by most security heuristics
            //    (it's "transient"). By the time the rename completes,
            //    the file is fully formed and matches all WebP magic
            //    byte signatures, so even an immediate scan post-rename
            //    sees a valid .webp.
            $temp = $target . '.tmp';
            $bytes_written = ( false === $binary ) ? false : @file_put_contents( $temp, $binary );
            if ( false === $bytes_written || $bytes_written === 0 ) {
                wp_delete_file( $temp ); // best-effort cleanup if we wrote 0 bytes
                $failed++;
                continue;
            }
            // Atomic rename. WP_Filesystem::move() does NOT guarantee
            // atomicity across all FS backends — direct rename() is the
            // ONLY way to make sure scanners can never see a half-written
            // .webp at the final path. This is the entire point of the
            // temp+rename pattern (Smush uses identical code). Falls back
            // to copy+delete when rename crosses a filesystem boundary
            // (e.g., uploads on a separate mount on some hosts).
            // phpcs:ignore WordPress.WP.AlternativeFunctions.rename_rename
            $renamed = @rename( $temp, $target );
            if ( ! $renamed ) {
                $copied = @copy( $temp, $target );
                wp_delete_file( $temp );
                if ( ! $copied ) {
                    $failed++;
                    continue;
                }
            }

            // Post-write verification. clearstatcache forces a fresh
            // read — without it PHP's stat cache might still remember
            // the temp path and lie about $target. If $target is
            // missing despite the rename succeeding, something on the
            // host is actively removing .webp siblings (LiteSpeed
            // image-opt, security scanner, host WAF). Log + count as
            // failed so the user sees the real outcome instead of
            // converted=N with nothing on disk.
            clearstatcache( true, $target );
            if ( ! file_exists( $target ) ) {
                $failed++;
                Tempaloo_WebP_Activity::log(
                    'auto_convert', 'error',
                    sprintf(
                        /* translators: 1: bytes written, 2: attachment ID */
                        __( 'Wrote %1$d bytes for #%2$d but file vanished after rename — host or another plugin removed it', 'tempaloo-webp' ),
                        (int) $bytes_written,
                        (int) $attachment_id
                    ),
                    [
                        'attachment_id' => (int) $attachment_id,
                        'target'        => str_replace( ABSPATH, '/', $target ),
                        'bytes_written' => (int) $bytes_written,
                        'reason'        => 'post_write_disappeared',
                    ]
                );
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

        // Invalidate the Overview "Space saved" cache so the next
        // poll reflects the new bytes immediately. The 60s transient
        // would otherwise hold a stale value briefly after every
        // conversion — visible to the user, fixable here for free.
        if ( $converted > 0 ) {
            delete_transient( 'tempaloo_webp_savings_cache' );
        }

        return [ 'metadata' => $metadata, 'converted' => $converted, 'failed' => $failed, 'error_code' => '' ];
    }

    public static function is_supported_attachment( $attachment_id ) {
        $mime = get_post_mime_type( $attachment_id );
        return in_array( $mime, [ 'image/jpeg', 'image/png', 'image/gif' ], true );
    }
}
