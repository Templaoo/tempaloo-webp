<?php
defined( 'ABSPATH' ) || exit;

/**
 * Rewrites any image URL inside the uploads directory to its .webp/.avif sibling
 * when: (a) the sibling file exists, (b) the client's Accept header indicates support.
 *
 * Works for the original AND every generated size, because we check the filesystem
 * directly rather than relying on a single metadata entry.
 */
class Tempaloo_WebP_URL_Filter {

    public function register() {
        add_filter( 'wp_get_attachment_url',          [ $this, 'maybe_replace_url' ], 10, 2 );
        add_filter( 'wp_get_attachment_image_src',    [ $this, 'maybe_replace_src' ], 10, 4 );
        add_filter( 'wp_calculate_image_srcset',      [ $this, 'maybe_replace_srcset' ], 10, 5 );
        // Admin media library (grid + modal) uses this to build previews.
        add_filter( 'wp_prepare_attachment_for_js',   [ $this, 'maybe_replace_js_data' ], 10, 3 );

        // Block-editor / classic-editor static HTML doesn't pass through
        // wp_get_attachment_image_src — Gutenberg saves the <img src="…">
        // straight into post_content, and core only recalculates srcset
        // at render time. Without this hook, the visible `src` stays on
        // the original JPG/PNG even when every srcset URL was rewritten,
        // which makes it LOOK like the bulk did nothing in source view.
        // Available since WP 6.0 (matches our Requires at least header).
        // url_rewrite mode → rewrites the literal src attribute.
        // picture_tag mode → no-op (the buffer hook below handles
        //                    everything page-wide, including page-builder
        //                    output that bypasses this filter).
        add_filter( 'wp_content_img_tag',             [ $this, 'replace_in_img_tag' ], 10, 3 );

        // Page-wide output buffer for picture_tag mode. WordPress's content
        // filters (wp_content_img_tag, wp_filter_content_tags) only fire
        // on output that goes through the_content() — Gutenberg, classic
        // editor, some theme code. Page builders like Elementor, Bricks,
        // Divi, Beaver Builder render their <img> tags directly to the
        // browser without ever touching those filters, so a pure-hook
        // picture wrapper would silently miss every image on every page
        // builder site.
        //
        // The fix used by Imagify, ShortPixel and other mature WebP
        // plugins: capture the entire HTML response in an output buffer
        // on template_redirect (priority 1, before anything else can
        // start its own ob_start) and post-process it in one pass when
        // the response flushes. Cost is small (regex over the response
        // body, typically <10 ms) and the coverage is total.
        //
        // We don't register this in admin / AJAX / REST / feed — same
        // exclusions as the URL-rewrite filters.
        add_action( 'template_redirect', [ $this, 'maybe_start_picture_buffer' ], 1 );

        // Media library status column.
        add_filter( 'manage_upload_columns',        [ $this, 'media_column' ] );
        add_action( 'manage_media_custom_column',   [ $this, 'media_column_value' ], 10, 2 );

        // Bulk row-actions on wp-admin/upload.php list view. Native
        // WordPress pattern: filter to register the actions in the
        // dropdown, action to handle the redirect with selected ids.
        // Lets users optimize / restore N attachments at once via
        // the standard "Bulk actions" dropdown above the list.
        add_filter( 'bulk_actions-upload',          [ $this, 'register_bulk_actions' ] );
        add_filter( 'handle_bulk_actions-upload',   [ $this, 'handle_bulk_actions' ], 10, 3 );
        // Renders a notice on the redirect-back showing how many
        // attachments were processed in the last bulk action.
        add_action( 'admin_notices',                [ $this, 'render_bulk_notice' ] );

        // "Tempaloo optimization" field in the attachment edit panel — shown
        // both in the post.php?post=N edit screen AND in the right sidebar
        // of the Media Library modal (the one that pops up after an upload
        // on media-new.php and any time you click an image).
        add_filter( 'attachment_fields_to_edit',    [ $this, 'attachment_field' ], 10, 2 );

        // Mirror the same payload onto the REST API attachment response. WP's
        // wp.media.attachment(id).fetch() goes through /wp/v2/media/{id}, NOT
        // wp_prepare_attachment_for_js, so without this filter the inline
        // upload stats can't see our `tempaloo` data after a page reload or
        // from any non-uploader context.
        add_filter( 'rest_prepare_attachment',      [ $this, 'rest_inject_stats' ], 10, 2 );

        // Visual "WebP" badge on admin thumbnails (Media Library + block editor only).
        add_action( 'admin_enqueue_scripts',        [ $this, 'enqueue_admin_badge' ] );
        add_action( 'enqueue_block_editor_assets',  [ $this, 'enqueue_admin_badge' ] );

        // admin-ajax handler that backs the post-upload stats JS.
        add_action( 'wp_ajax_tempaloo_stats',       [ $this, 'ajax_stats' ] );
        // Per-row "Convert now" button on wp-admin/upload.php — converts
        // a single attachment in-place without leaving the Media Library.
        add_action( 'wp_ajax_tempaloo_convert_one', [ $this, 'ajax_convert_one' ] );
        // Per-row "Restore original" button — symmetric to convert_one,
        // deletes our .webp / .avif siblings and clears conversion meta
        // for one attachment without leaving the Media Library.
        add_action( 'wp_ajax_tempaloo_restore_one', [ $this, 'ajax_restore_one' ] );
    }

    /**
     * One-click conversion of a single attachment from the Media Library
     * "Optimized" column. Same code path as Bulk (convert_all_sizes in
     * 'auto' mode → 1 credit, every WP-generated size in one batch),
     * just kicked off per-row instead of in a loop.
     */
    public function ajax_convert_one() {
        $post_id = isset( $_POST['id'] ) ? absint( wp_unslash( $_POST['id'] ) ) : 0;
        if ( $post_id <= 0 ) {
            wp_send_json_error( [ 'message' => __( 'Missing attachment id', 'tempaloo-webp' ) ], 400 );
        }
        check_ajax_referer( 'tempaloo_convert_one_' . $post_id, 'nonce' );
        if ( ! current_user_can( 'upload_files' ) ) {
            wp_send_json_error( [ 'message' => __( 'Not allowed', 'tempaloo-webp' ) ], 403 );
        }

        $settings = Tempaloo_WebP_Plugin::get_settings();
        if ( empty( $settings['license_valid'] ) ) {
            wp_send_json_error( [
                'message' => __( 'License is not active. Activate from the Tempaloo settings page.', 'tempaloo-webp' ),
                'code'    => 'no_license',
            ], 400 );
        }
        if ( ! Tempaloo_WebP_Converter::is_supported_attachment( $post_id ) ) {
            wp_send_json_error( [
                'message' => __( 'Attachment type not supported (only JPEG / PNG / GIF).', 'tempaloo-webp' ),
                'code'    => 'unsupported_mime',
            ], 400 );
        }

        $metadata = wp_get_attachment_metadata( $post_id );
        if ( ! is_array( $metadata ) ) $metadata = [];

        $result = Tempaloo_WebP_Converter::convert_all_sizes( $post_id, $metadata, $settings, 'auto' );

        if ( $result['converted'] > 0 ) {
            wp_update_attachment_metadata( $post_id, $result['metadata'] );
            $savings = $this->compute_attachment_savings( $post_id );
            wp_send_json_success( [
                'converted' => (int) $result['converted'],
                'failed'    => (int) $result['failed'],
                'savings'   => $savings,
            ] );
        }

        $code = $result['error_code'] !== '' ? $result['error_code'] : 'no_output';
        // Quota / auth errors → keep the "Convert now" button so the
        // user sees the cause and can act. Infra errors → already
        // enqueued in the retry queue by class-converter.
        $message = 'quota_exceeded' === $code
            ? __( 'Monthly quota reached — upgrade plan or wait for reset', 'tempaloo-webp' )
            : ( 'unauthorized' === $code || 'forbidden' === $code
                ? __( 'License inactive or AVIF not in plan', 'tempaloo-webp' )
                : sprintf(
                    /* translators: %s: error code from the conversion API (http_error, status_502, etc.) */
                    __( 'Conversion failed (%s). Retry will fire automatically in the background.', 'tempaloo-webp' ),
                    $code
                )
            );
        wp_send_json_error( [
            'message' => $message,
            'code'    => $code,
        ], 500 );
    }

    /**
     * One-click restore of a single attachment from the Media Library
     * "Optimized" column. Symmetric counterpart to ajax_convert_one:
     * same nonce/capability shape, same admin-ajax action prefix, same
     * shaped JSON response. Delegates the actual work to
     * Tempaloo_WebP_REST::restore_single_attachment so the bulk
     * /restore endpoint, the per-image /restore-one REST endpoint, and
     * this Media Library button all run identical code — no risk of
     * "restore via X works, restore via Y leaves orphans" drift.
     */
    public function ajax_restore_one() {
        $post_id = isset( $_POST['id'] ) ? absint( wp_unslash( $_POST['id'] ) ) : 0;
        if ( $post_id <= 0 ) {
            wp_send_json_error( [ 'message' => __( 'Missing attachment id', 'tempaloo-webp' ) ], 400 );
        }
        // Per-attachment nonce — same scheme as convert_one. Means a
        // page that lists 50 attachments has 50 distinct nonces, so
        // CSRFing one row doesn't compromise the others.
        check_ajax_referer( 'tempaloo_restore_one_' . $post_id, 'nonce' );
        if ( ! current_user_can( 'upload_files' ) ) {
            wp_send_json_error( [ 'message' => __( 'Not allowed', 'tempaloo-webp' ) ], 403 );
        }

        $r = Tempaloo_WebP_REST::restore_single_attachment( $post_id );

        // Page-cache bust + Activity log only when something actually
        // changed. Restoring an already-restored image stays silent
        // so a frantic user who clicks twice doesn't pollute the log
        // with empty events.
        if ( $r['restored'] > 0 || $r['files_removed'] > 0 ) {
            if ( method_exists( 'Tempaloo_WebP_Plugin', 'purge_page_caches' ) ) {
                Tempaloo_WebP_Plugin::purge_page_caches();
            }
            Tempaloo_WebP_Activity::log(
                'restore',
                $r['delete_failures'] > 0 ? 'error' : 'warn',
                $r['delete_failures'] > 0
                    ? sprintf(
                        /* translators: 1: attachment id, 2: files removed, 3: delete failures */
                        __( 'Restored #%1$d · %2$d files removed · %3$d delete failure(s)', 'tempaloo-webp' ),
                        $post_id, $r['files_removed'], $r['delete_failures']
                    )
                    : sprintf(
                        /* translators: 1: attachment id, 2: files removed */
                        __( 'Restored #%1$d · %2$d files removed', 'tempaloo-webp' ),
                        $post_id, $r['files_removed']
                    ),
                [
                    'attachment_id'   => $post_id,
                    'files_removed'   => $r['files_removed'],
                    'delete_failures' => $r['delete_failures'],
                    'failure_samples' => $r['failure_samples'],
                    'source'          => 'media_library_button',
                ]
            );
        }

        wp_send_json_success( [
            'restored'       => (int) $r['restored'],
            'filesRemoved'   => (int) $r['files_removed'],
            'deleteFailures' => (int) $r['delete_failures'],
            'failureSamples' => $r['failure_samples'],
            // Empty=true when the attachment had no conversion meta —
            // UI renders "Already restored" instead of "0 files removed"
            // which feels like a silent failure.
            'wasNoOp'        => $r['restored'] === 0,
        ] );
    }

    /**
     * Sums original vs converted bytes across the original + every generated
     * size for a single attachment. Returns null if nothing was converted.
     *
     * Reused by the "Optimized" column, the attachment edit field, and the
     * JS data block — one place to maintain the "saved X%" math.
     */
    private function compute_attachment_savings( $post_id ) {
        $meta = wp_get_attachment_metadata( $post_id );
        // Authoritative read goes through the helper which prefers
        // _tempaloo_webp post_meta and falls back to the legacy
        // in-metadata key. Sidesteps any filter-chain stripping.
        $tw = Tempaloo_WebP_Plugin::get_conversion_meta( $post_id );
        if ( empty( $tw ) ) return null;

        $orig_file = get_attached_file( $post_id );
        if ( ! $orig_file ) return null;

        $paths = [ $orig_file ];
        if ( ! empty( $meta['sizes'] ) && is_array( $meta['sizes'] ) ) {
            foreach ( $meta['sizes'] as $size ) {
                if ( ! empty( $size['file'] ) ) {
                    $paths[] = trailingslashit( dirname( $orig_file ) ) . $size['file'];
                }
            }
        }
        // Setting may say 'webp', 'avif' or 'both'. The savings figure
        // shown in the admin column reflects what most browsers see, so
        // we pick whichever sibling exists per source path — preferring
        // WebP when both exist (broader audience), falling back to AVIF.
        // For 'both' we ALSO sum the avif bytes so the meta panel can
        // surface "WebP & AVIF · saved X%".
        $stored_fmt = isset( $tw['format'] ) ? (string) $tw['format'] : 'webp';
        $is_dual = ( 'both' === $stored_fmt );
        $check_order = $is_dual ? [ 'webp', 'avif' ] : [ $stored_fmt ];

        $in = 0; $out = 0; $count = 0;
        $avif_out = 0; $avif_count = 0;
        foreach ( $paths as $p ) {
            if ( ! file_exists( $p ) ) continue;
            // Primary metric uses the first format we find. WebP wins on
            // ties (broader browser support).
            $picked = null;
            foreach ( $check_order as $f ) {
                if ( file_exists( $p . '.' . $f ) ) { $picked = $f; break; }
            }
            if ( null === $picked ) continue;
            $in  += filesize( $p );
            $out += filesize( $p . '.' . $picked );
            $count++;
            // For 'both' track AVIF separately so the UI can show the
            // bonus tier when applicable.
            if ( $is_dual && file_exists( $p . '.avif' ) ) {
                $avif_out += filesize( $p . '.avif' );
                $avif_count++;
            }
        }
        if ( $count === 0 || $in === 0 ) return null;

        $display_fmt = $is_dual && $avif_count > 0
            ? 'WEBP+AVIF'
            : strtoupper( $check_order[0] ?? 'webp' );

        return [
            'format'      => $display_fmt,
            'sizes'       => $count,
            'bytes_in'    => $in,
            'bytes_out'   => $out,
            'saved_pct'   => max( 0, (int) round( ( 1 - ( $out / $in ) ) * 100 ) ),
            'at'          => isset( $tw['at'] ) ? (int) $tw['at'] : 0,
            // Bonus AVIF coverage when stored_fmt='both'. Zero otherwise
            // so the React side can simply test the field and skip rendering.
            'avif_bytes'  => $avif_out,
            'avif_sizes'  => $avif_count,
        ];
    }

    /**
     * Adds a read-only "Tempaloo" field to the attachment edit panel.
     * Renders a green "Converted" block with savings, or a neutral hint
     * if the file hasn't been processed yet (gives the user a clear
     * affordance for what's happening with their upload).
     */
    public function attachment_field( $form_fields, $post ) {
        if ( ! Tempaloo_WebP_Converter::is_supported_attachment( $post->ID ) ) {
            return $form_fields;
        }
        $s = $this->compute_attachment_savings( $post->ID );
        if ( $s ) {
            $html = sprintf(
                '<div style="display:flex;align-items:center;gap:8px;line-height:1.4;">'
                . '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:4px;background:#dcfce7;color:#166534;font-weight:600;font-size:11px;">✓ %s</span>'
                . '<span style="color:#166534;font-weight:600;">−%d%%</span>'
                . '<span style="color:#555;font-size:12px;">%s → %s · %d sizes</span>'
                . '</div>',
                esc_html( $s['format'] ),
                (int) $s['saved_pct'],
                esc_html( size_format( $s['bytes_in'] ) ),
                esc_html( size_format( $s['bytes_out'] ) ),
                (int) $s['sizes']
            );
        } else {
            $html = '<span style="color:#6b7280;font-size:12px;">Not converted yet — runs automatically on upload, or use the Bulk tab to process existing images.</span>';
        }
        $form_fields['tempaloo_webp'] = [
            'label' => __( 'Tempaloo', 'tempaloo-webp' ),
            'input' => 'html',
            'html'  => $html,
        ];
        return $form_fields;
    }

    public function rest_inject_stats( $response, $post ) {
        if ( ! ( $response instanceof WP_REST_Response ) || ! $post ) {
            return $response;
        }
        $s = $this->compute_attachment_savings( $post->ID );
        if ( ! $s ) return $response;
        $data = $response->get_data();
        $data['tempaloo'] = [
            'format'      => $s['format'],
            'savedPct'    => $s['saved_pct'],
            'bytesIn'     => $s['bytes_in'],
            'bytesOut'    => $s['bytes_out'],
            'sizes'       => $s['sizes'],
            'convertedAt' => $s['at'],
        ];
        $response->set_data( $data );
        return $response;
    }

    public function enqueue_admin_badge( $hook = '' ) {
        // Never on our own settings page — our React app manages its own visuals.
        if ( 'toplevel_page_tempaloo-webp' === $hook || 'settings_page_tempaloo-webp' === $hook ) {
            return;
        }
        wp_enqueue_script(
            'tempaloo-webp-badge',
            TEMPALOO_WEBP_URL . 'assets/admin-badge.js',
            [],
            TEMPALOO_WEBP_VERSION,
            true
        );
        wp_enqueue_style(
            'tempaloo-webp-badge',
            TEMPALOO_WEBP_URL . 'assets/admin-badge.css',
            [],
            TEMPALOO_WEBP_VERSION
        );

        // Inline post-upload stats: only useful where WP renders media-item
        // rows after an upload (media-new.php, upload.php list view).
        // Zero JS dependency — calls admin-ajax directly via vanilla fetch
        // because wp.media.attachment() isn't reliably loaded on the legacy
        // /wp-admin/media-new.php uploader.
        if ( in_array( $hook, [ 'media-new.php', 'upload.php' ], true ) ) {
            wp_enqueue_script(
                'tempaloo-webp-upload-stats',
                TEMPALOO_WEBP_URL . 'assets/upload-stats.js',
                [],
                TEMPALOO_WEBP_VERSION,
                true
            );
            wp_localize_script(
                'tempaloo-webp-upload-stats',
                'TempalooStatsBoot',
                [
                    'ajaxUrl' => admin_url( 'admin-ajax.php' ),
                    'nonce'   => wp_create_nonce( 'tempaloo_stats' ),
                ]
            );
        }

        // Per-row "Convert now" button — only on the list view of the
        // Media Library where the Optimized column is visible.
        if ( 'upload.php' === $hook ) {
            wp_enqueue_script(
                'tempaloo-webp-media-convert',
                TEMPALOO_WEBP_URL . 'assets/media-convert-button.js',
                [],
                TEMPALOO_WEBP_VERSION,
                true
            );
            wp_localize_script(
                'tempaloo-webp-media-convert',
                'TempalooConvertOneBoot',
                [
                    'ajaxUrl' => admin_url( 'admin-ajax.php' ),
                ]
            );
            // Pro design styles for the Optimized column — badge,
            // detail accordion, inline confirm panel, flash messages.
            wp_enqueue_style(
                'tempaloo-webp-media-column',
                TEMPALOO_WEBP_URL . 'assets/media-column.css',
                [],
                TEMPALOO_WEBP_VERSION
            );
        }
    }

    /**
     * admin-ajax endpoint: returns compression stats for one attachment.
     * Bypasses the REST permissions / wp.media model loading entirely so
     * the post-upload row JS can grab data with a single fetch.
     */
    public function ajax_stats() {
        check_ajax_referer( 'tempaloo_stats', 'nonce' );
        if ( ! current_user_can( 'upload_files' ) ) {
            wp_send_json_error( [ 'message' => 'forbidden' ], 403 );
        }
        $id = isset( $_REQUEST['id'] ) ? absint( $_REQUEST['id'] ) : 0;
        if ( $id <= 0 ) {
            wp_send_json_error( [ 'message' => 'missing_id' ], 400 );
        }
        $s = $this->compute_attachment_savings( $id );
        if ( ! $s ) {
            // 200 OK with `ready=false` lets the JS know to retry
            // (conversion may finish a few hundred ms after the upload row
            // appears for big images).
            wp_send_json_success( [ 'ready' => false ] );
        }
        wp_send_json_success( [
            'ready'       => true,
            'format'      => $s['format'],
            'savedPct'    => $s['saved_pct'],
            'bytesIn'     => $s['bytes_in'],
            'bytesOut'    => $s['bytes_out'],
            'sizes'       => $s['sizes'],
            'convertedAt' => $s['at'],
        ] );
    }

    public function media_column( $cols ) {
        $cols['tempaloo_webp'] = __( 'Optimized', 'tempaloo-webp' );
        return $cols;
    }

    public function media_column_value( $column, $post_id ) {
        if ( 'tempaloo_webp' !== $column ) return;
        $post_id = (int) $post_id;

        // Both nonces emitted on every row so the JS can flip between
        // convert ↔ restore in-place without a server round-trip to
        // refresh the action token after each click.
        $licensed   = ! empty( Tempaloo_WebP_Plugin::get_settings()['license_valid'] );
        $supported  = Tempaloo_WebP_Converter::is_supported_attachment( $post_id );
        $convert_nonce = ( $licensed && $supported ) ? wp_create_nonce( 'tempaloo_convert_one_' . $post_id ) : '';
        $restore_nonce = wp_create_nonce( 'tempaloo_restore_one_' . $post_id );

        $s = $this->compute_attachment_savings( $post_id );

        printf(
            '<div class="tempaloo-media-cell" data-id="%d" data-convert-nonce="%s" data-restore-nonce="%s">',
            $post_id,
            esc_attr( $convert_nonce ),
            esc_attr( $restore_nonce )
        );

        if ( ! $s ) {
            if ( ! $licensed || ! $supported ) {
                echo '<span class="tempaloo-cell-na">—</span></div>';
                return;
            }
            printf(
                '<button type="button" class="button button-small tempaloo-convert-now" data-id="%d" data-nonce="%s">%s</button></div>',
                $post_id,
                esc_attr( $convert_nonce ),
                esc_html__( 'Convert now', 'tempaloo-webp' )
            );
            return;
        }

        // Converted state — full pro layout. Renders three regions:
        //
        //   1. Summary (always visible) — format badge, savings %,
        //      bytes line, action buttons (Detail toggle + Restore).
        //   2. Detail accordion (hidden by default) — per-size
        //      breakdown table + meta footer (format, conversion time).
        //      Toggled by the chevron button.
        //   3. Confirm panel (hidden) — destructive-action confirmation
        //      shown when the user clicks Restore. Replaces the native
        //      confirm() dialog with an inline, themed dialog that
        //      stays scoped to the row.
        //
        // All three regions are server-rendered with `hidden` attributes
        // so the JS only flips visibility — no innerHTML rebuilds, no
        // chance of leaving the cell in an inconsistent state.
        $format_raw = isset( $s['format'] ) ? (string) $s['format'] : 'webp';
        $format     = strtoupper( $format_raw );
        $badge_class = 'tempaloo-badge-webp';
        if ( 'AVIF' === $format )      $badge_class = 'tempaloo-badge-avif';
        if ( 'BOTH' === $format
            || 'WEBP+AVIF' === $format ) $badge_class = 'tempaloo-badge-both';

        // Per-size breakdown for the Detail accordion. Walks the same
        // (original + WP sizes) source list compute_attachment_savings
        // walked, but tracks each path individually so the UI can
        // render one row per size with its bytes_in / bytes_out / pct.
        $rows = [];
        $orig_file = get_attached_file( $post_id );
        $meta_full = wp_get_attachment_metadata( $post_id );
        if ( $orig_file ) {
            $size_paths = [ [ 'label' => 'original', 'path' => $orig_file ] ];
            if ( is_array( $meta_full ) && ! empty( $meta_full['sizes'] ) ) {
                foreach ( $meta_full['sizes'] as $size_key => $size_meta ) {
                    if ( empty( $size_meta['file'] ) ) continue;
                    $size_paths[] = [
                        'label' => (string) $size_key,
                        'path'  => trailingslashit( dirname( $orig_file ) ) . $size_meta['file'],
                    ];
                }
            }
            $picked_fmt = ( 'AVIF' === $format ) ? 'avif' : 'webp';
            foreach ( $size_paths as $sp ) {
                if ( ! file_exists( $sp['path'] ) ) continue;
                $sib = $sp['path'] . '.' . $picked_fmt;
                if ( ! file_exists( $sib ) ) {
                    // Try the other format if the primary picked is absent
                    // (dual-format edge case where WebP missed for one size).
                    $alt = ( $picked_fmt === 'webp' ) ? 'avif' : 'webp';
                    if ( file_exists( $sp['path'] . '.' . $alt ) ) {
                        $sib = $sp['path'] . '.' . $alt;
                    } else {
                        continue;
                    }
                }
                $rows[] = [
                    'label' => $sp['label'],
                    'in'    => filesize( $sp['path'] ),
                    'out'   => filesize( $sib ),
                ];
            }
        }
        // Pre-build the breakdown rows HTML so the printf() below stays readable.
        $rows_html = '';
        foreach ( $rows as $r ) {
            $pct = $r['in'] > 0 ? max( 0, (int) round( ( 1 - ( $r['out'] / $r['in'] ) ) * 100 ) ) : 0;
            $rows_html .= sprintf(
                '<div class="tempaloo-detail-row">' .
                    '<span class="tempaloo-detail-name">%s</span>' .
                    '<span class="tempaloo-detail-bytes">%s → <strong>%s</strong></span>' .
                    '<span class="tempaloo-detail-pct">−%d%%</span>' .
                '</div>',
                esc_html( $r['label'] ),
                esc_html( size_format( $r['in'] ) ),
                esc_html( size_format( $r['out'] ) ),
                $pct
            );
        }

        $converted_at = isset( $s['at'] ) ? (int) $s['at'] : 0;
        $when_label = $converted_at > 0
            ? sprintf(
                /* translators: %s: human-readable time difference, e.g. "2 hours" */
                __( 'Converted %s ago', 'tempaloo-webp' ),
                human_time_diff( $converted_at )
            )
            : __( 'Converted', 'tempaloo-webp' );

        printf(
            '<div class="tempaloo-cell-summary">' .
                '<div class="tempaloo-cell-row">' .
                    '<span class="tempaloo-badge %s">%s</span>' .
                    '<span class="tempaloo-saved">−%d%%</span>' .
                    '<button type="button" class="tempaloo-detail-toggle" aria-expanded="false" aria-label="%s">' .
                        '<span class="tempaloo-detail-toggle-label">%s</span>' .
                        '<svg class="tempaloo-chevron" width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' .
                            '<polyline points="3 5 6 8 9 5" />' .
                        '</svg>' .
                    '</button>' .
                '</div>' .
                '<div class="tempaloo-cell-bytes">%s → <strong>%s</strong></div>' .
                '<div class="tempaloo-cell-actions">' .
                    '<button type="button" class="tempaloo-restore-now" data-id="%d" data-nonce="%s" title="%s">' .
                        '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' .
                            '<polyline points="1 4 1 10 7 10" />' .
                            '<path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />' .
                        '</svg>' .
                        '<span>%s</span>' .
                    '</button>' .
                '</div>' .
            '</div>' .
            '<div class="tempaloo-cell-detail" hidden>' .
                '%s' .
                '<div class="tempaloo-detail-meta">%s · %d %s</div>' .
            '</div>' .
            '<div class="tempaloo-cell-confirm" hidden role="dialog" aria-label="%s">' .
                '<div class="tempaloo-confirm-icon">' .
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' .
                        '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />' .
                        '<line x1="12" y1="9" x2="12" y2="13" />' .
                        '<line x1="12" y1="17" x2="12.01" y2="17" />' .
                    '</svg>' .
                '</div>' .
                '<div class="tempaloo-confirm-body">' .
                    '<div class="tempaloo-confirm-title">%s</div>' .
                    '<div class="tempaloo-confirm-text">%s</div>' .
                    '<div class="tempaloo-confirm-actions">' .
                        '<button type="button" class="tempaloo-confirm-cancel">%s</button>' .
                        '<button type="button" class="tempaloo-confirm-yes" data-id="%d" data-nonce="%s">%s</button>' .
                    '</div>' .
                '</div>' .
            '</div>' .
        '</div>',
            // .tempaloo-cell-summary
            esc_attr( $badge_class ), esc_html( $format ),
            (int) $s['saved_pct'],
            esc_attr__( 'Toggle conversion details', 'tempaloo-webp' ),
            esc_html__( 'Detail', 'tempaloo-webp' ),
            esc_html( size_format( $s['bytes_in'] ) ),
            esc_html( size_format( $s['bytes_out'] ) ),
            $post_id, esc_attr( $restore_nonce ),
            esc_attr__( 'Delete the .webp / .avif siblings and revert this image to its uploaded state.', 'tempaloo-webp' ),
            esc_html__( 'Restore', 'tempaloo-webp' ),
            // .tempaloo-cell-detail
            $rows_html, // already escaped above
            esc_html( $when_label ),
            (int) $s['sizes'],
            esc_html( _n( 'size', 'sizes', (int) $s['sizes'], 'tempaloo-webp' ) ),
            // .tempaloo-cell-confirm
            esc_attr__( 'Confirm restore', 'tempaloo-webp' ),
            esc_html__( 'Restore this image?', 'tempaloo-webp' ),
            esc_html__( 'This deletes the .webp / .avif siblings and clears the conversion record. Your original image stays untouched.', 'tempaloo-webp' ),
            esc_html__( 'Cancel', 'tempaloo-webp' ),
            $post_id, esc_attr( $restore_nonce ),
            esc_html__( 'Yes, restore', 'tempaloo-webp' )
        );
    }

    /**
     * Adds our two entries to the wp-admin/upload.php "Bulk actions"
     * dropdown above the list view. Inserted alongside (not replacing)
     * the default Trash / Permanently delete actions.
     */
    public function register_bulk_actions( $actions ) {
        if ( ! is_array( $actions ) ) $actions = [];
        $actions['tempaloo_optimize'] = __( 'Optimize with Tempaloo', 'tempaloo-webp' );
        $actions['tempaloo_restore']  = __( 'Restore originals (Tempaloo)', 'tempaloo-webp' );
        return $actions;
    }

    /**
     * Handles the form submit when a user picks one of our bulk
     * actions and clicks Apply on wp-admin/upload.php.
     *
     * Native WP contract: receives the action slug, the array of
     * selected post IDs, and the current redirect-to URL. We process
     * the IDs synchronously, then return a URL with our own query
     * params so render_bulk_notice() can show a summary banner on
     * the redirect-back.
     *
     * Capability gate: WP core already requires `upload_files` for
     * the surrounding screen, but we double-check here so a
     * forwarded URL with malicious post_ids can't execute without
     * the right user.
     */
    public function handle_bulk_actions( $redirect, $action, $post_ids ) {
        if ( ! is_array( $post_ids ) || empty( $post_ids ) ) return $redirect;
        if ( 'tempaloo_optimize' !== $action && 'tempaloo_restore' !== $action ) {
            return $redirect;
        }
        if ( ! current_user_can( 'upload_files' ) ) return $redirect;

        // Cap to a sane upper bound so a thousand-image bulk submit
        // doesn't blow the PHP timeout on shared hosting. The bulk
        // page (with its retry queue + progress bar) is the better
        // path for libraries that big — this is for "select 30,
        // click apply, done in 30s".
        $post_ids = array_slice( array_map( 'absint', $post_ids ), 0, 100 );

        $settings = Tempaloo_WebP_Plugin::get_settings();

        if ( 'tempaloo_optimize' === $action ) {
            $converted = 0; $failed = 0; $skipped = 0;
            // Stop pre-emptively if no license — every iteration
            // would just hit the same gate inside convert_all_sizes.
            if ( empty( $settings['license_valid'] ) ) {
                return add_query_arg( [
                    'tempaloo_bulk'   => 'optimize',
                    'tempaloo_failed' => count( $post_ids ),
                    'tempaloo_reason' => 'no_license',
                ], $redirect );
            }
            foreach ( $post_ids as $aid ) {
                if ( ! Tempaloo_WebP_Converter::is_supported_attachment( $aid ) ) {
                    $skipped++;
                    continue;
                }
                // Idempotency: if it's already converted, don't burn
                // a credit running the same conversion again. The
                // user can use Restore + Optimize to force a redo.
                if ( ! empty( Tempaloo_WebP_Plugin::get_conversion_meta( $aid ) ) ) {
                    $skipped++;
                    continue;
                }
                $meta = wp_get_attachment_metadata( $aid );
                if ( ! is_array( $meta ) ) $meta = [];
                $r = Tempaloo_WebP_Converter::convert_for_upload( $aid, $meta, $settings, 'auto' );
                if ( $r['converted'] > 0 ) {
                    wp_update_attachment_metadata( $aid, $r['metadata'] );
                    $converted++;
                } else {
                    $failed++;
                }
            }
            return add_query_arg( [
                'tempaloo_bulk'      => 'optimize',
                'tempaloo_converted' => $converted,
                'tempaloo_failed'    => $failed,
                'tempaloo_skipped'   => $skipped,
            ], $redirect );
        }

        // Restore path — uses the same per-attachment helper as the
        // /restore-one REST endpoint and the Media Library row button,
        // so behavior stays in lockstep across all callers.
        $restored = 0; $files_removed = 0; $delete_failures = 0;
        foreach ( $post_ids as $aid ) {
            $r = Tempaloo_WebP_REST::restore_single_attachment( $aid );
            $restored        += $r['restored'];
            $files_removed   += $r['files_removed'];
            $delete_failures += $r['delete_failures'];
        }
        if ( $restored > 0 || $files_removed > 0 ) {
            if ( method_exists( 'Tempaloo_WebP_Plugin', 'purge_page_caches' ) ) {
                Tempaloo_WebP_Plugin::purge_page_caches();
            }
            Tempaloo_WebP_Activity::log(
                'restore',
                $delete_failures > 0 ? 'error' : 'warn',
                sprintf(
                    /* translators: 1: attachments restored, 2: files removed, 3: delete failures */
                    __( 'Bulk restore · %1$d attachments · %2$d files removed · %3$d failure(s)', 'tempaloo-webp' ),
                    $restored, $files_removed, $delete_failures
                ),
                [
                    'restored'        => $restored,
                    'files_removed'   => $files_removed,
                    'delete_failures' => $delete_failures,
                    'source'          => 'media_library_bulk_action',
                ]
            );
        }
        return add_query_arg( [
            'tempaloo_bulk'      => 'restore',
            'tempaloo_restored'  => $restored,
            'tempaloo_removed'   => $files_removed,
            'tempaloo_failures'  => $delete_failures,
        ], $redirect );
    }

    /**
     * Renders a single dismissible admin notice on wp-admin/upload.php
     * after a bulk action redirects back. Reads our query params,
     * formats a human summary, then bails — so the notice doesn't
     * leak onto every page load. Native WP look (notice-success /
     * notice-warning) so it blends with the surrounding UI.
     */
    public function render_bulk_notice() {
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        if ( empty( $_GET['tempaloo_bulk'] ) ) return;
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        $kind = sanitize_key( wp_unslash( $_GET['tempaloo_bulk'] ) );
        $screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
        if ( $screen && 'upload' !== $screen->base ) return;

        if ( 'optimize' === $kind ) {
            $reason   = isset( $_GET['tempaloo_reason'] )    ? sanitize_key( wp_unslash( $_GET['tempaloo_reason'] ) ) : '';
            $converted = isset( $_GET['tempaloo_converted'] ) ? (int) $_GET['tempaloo_converted'] : 0;
            $failed    = isset( $_GET['tempaloo_failed'] )    ? (int) $_GET['tempaloo_failed']    : 0;
            $skipped   = isset( $_GET['tempaloo_skipped'] )   ? (int) $_GET['tempaloo_skipped']   : 0;

            if ( 'no_license' === $reason ) {
                printf(
                    '<div class="notice notice-warning is-dismissible"><p>%s</p></div>',
                    esc_html__( 'Tempaloo: activate a license to optimize images.', 'tempaloo-webp' )
                );
                return;
            }

            $class = $failed > 0 ? 'notice-warning' : 'notice-success';
            printf(
                '<div class="notice %s is-dismissible"><p>%s</p></div>',
                esc_attr( $class ),
                esc_html( sprintf(
                    /* translators: 1: converted count, 2: skipped count, 3: failed count */
                    __( 'Tempaloo: %1$d optimized · %2$d skipped (already done or unsupported) · %3$d failed', 'tempaloo-webp' ),
                    $converted, $skipped, $failed
                ) )
            );
            return;
        }

        if ( 'restore' === $kind ) {
            $restored = isset( $_GET['tempaloo_restored'] ) ? (int) $_GET['tempaloo_restored'] : 0;
            $removed  = isset( $_GET['tempaloo_removed'] )  ? (int) $_GET['tempaloo_removed']  : 0;
            $failures = isset( $_GET['tempaloo_failures'] ) ? (int) $_GET['tempaloo_failures'] : 0;

            $class = $failures > 0 ? 'notice-warning' : 'notice-success';
            printf(
                '<div class="notice %s is-dismissible"><p>%s</p></div>',
                esc_attr( $class ),
                esc_html( sprintf(
                    /* translators: 1: attachments restored, 2: files removed, 3: delete failures */
                    __( 'Tempaloo: %1$d images restored · %2$d files removed · %3$d delete failure(s)', 'tempaloo-webp' ),
                    $restored, $removed, $failures
                ) )
            );
        }
    }

    public function maybe_replace_url( $url, $attachment_id ) {
        $alt = $this->alternate_url( $url );
        return $alt ? $alt : $url;
    }

    public function maybe_replace_src( $image, $attachment_id, $size, $icon ) {
        // $icon is true when WP returns a file-type icon (non-image attachments).
        // Don't rewrite icons — only rewrite actual image URLs from the uploads dir.
        if ( ! is_array( $image ) ) {
            return $image;
        }
        $alt = $this->alternate_url( $image[0] );
        if ( $alt ) {
            $image[0] = $alt;
        }
        return $image;
    }

    public function maybe_replace_js_data( $response, $attachment, $meta ) {
        if ( ! is_array( $response ) ) return $response;

        if ( ! empty( $response['url'] ) ) {
            $alt = $this->alternate_url( $response['url'] );
            if ( $alt ) $response['url'] = $alt;
        }
        if ( ! empty( $response['sizes'] ) && is_array( $response['sizes'] ) ) {
            foreach ( $response['sizes'] as $key => $size ) {
                if ( empty( $size['url'] ) ) continue;
                $alt = $this->alternate_url( $size['url'] );
                if ( $alt ) $response['sizes'][ $key ]['url'] = $alt;
            }
        }

        // Surface compression stats so the block editor + any custom UI can
        // read response.tempaloo without parsing the WP meta themselves.
        if ( ! empty( $attachment->ID ) ) {
            $s = $this->compute_attachment_savings( $attachment->ID );
            if ( $s ) {
                $response['tempaloo'] = [
                    'format'      => $s['format'],
                    'savedPct'    => $s['saved_pct'],
                    'bytesIn'     => $s['bytes_in'],
                    'bytesOut'    => $s['bytes_out'],
                    'sizes'       => $s['sizes'],
                    'convertedAt' => $s['at'],
                ];
            }
        }
        return $response;
    }

    /**
     * Per-img dispatcher run on every <img> in post content.
     *
     * In url_rewrite mode  — rewrites the literal src="…" to its
     *                        .webp/.avif sibling (existing behavior).
     * In picture_tag mode  — wraps the <img> in <picture> with
     *                        <source type="image/avif"> + <source
     *                        type="image/webp">, leaves the inner
     *                        <img src="…jpg"> intact as the fallback.
     *
     * Both modes are no-op in admin / AJAX / REST contexts.
     */
    public function replace_in_img_tag( $filtered_image, $context, $attachment_id ) {
        if ( ! is_string( $filtered_image ) || '' === $filtered_image ) {
            return $filtered_image;
        }
        $s = Tempaloo_WebP_Plugin::get_settings();
        if ( empty( $s['serve_webp'] ) ) {
            return $filtered_image;
        }
        // CDN passthrough — stay out of the way.
        if ( ! empty( $s['cdn_passthrough'] ) ) {
            return $filtered_image;
        }
        if ( is_admin() || wp_doing_ajax() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
            return $filtered_image;
        }

        $mode = isset( $s['delivery_mode'] ) && 'picture_tag' === $s['delivery_mode']
            ? 'picture_tag'
            : 'url_rewrite';

        // picture_tag mode is handled page-wide by maybe_start_picture_buffer
        // so this hook becomes a no-op. Wrapping HERE would only catch
        // <img> from the_content() — page-builder output (Elementor,
        // Bricks, Divi…) bypasses the_content() and the wrapper would
        // silently miss most images.
        if ( 'picture_tag' === $mode ) {
            return $filtered_image;
        }

        // url_rewrite mode — rewrite the literal src attribute.
        if ( ! preg_match( '/\bsrc\s*=\s*([\'"])([^\'"]+?)\1/i', $filtered_image, $m ) ) {
            return $filtered_image;
        }
        $original_url = $m[2];
        $alt = $this->alternate_url( $original_url );
        if ( ! $alt || $alt === $original_url ) {
            return $filtered_image;
        }
        $pos = strpos( $filtered_image, $original_url );
        if ( false === $pos ) {
            return $filtered_image;
        }
        return substr_replace( $filtered_image, $alt, $pos, strlen( $original_url ) );
    }

    /**
     * Starts an output buffer on template_redirect when picture_tag
     * mode is on. The callback (process_picture_buffer) runs once when
     * the response flushes and wraps every <img> in /uploads/ that
     * isn't already inside a <picture>. This is the only reliable way
     * to cover page-builder output that bypasses WordPress content
     * filters.
     *
     * Skipped on admin, AJAX, REST, feeds, and embed routes — those
     * either don't render full HTML or are explicitly NOT meant to be
     * rewritten.
     */
    public function maybe_start_picture_buffer() {
        $s = Tempaloo_WebP_Plugin::get_settings();
        if ( empty( $s['serve_webp'] ) ) return;
        if ( ! empty( $s['cdn_passthrough'] ) ) return;
        if ( 'picture_tag' !== ( $s['delivery_mode'] ?? 'url_rewrite' ) ) return;
        if ( is_admin() || wp_doing_ajax() ) return;
        if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) return;
        if ( is_feed() || is_embed() ) return;
        // 404 pages, robots.txt, anything not full HTML — buffer is harmless
        // but we can save the work.
        if ( is_robots() || is_trackback() ) return;

        ob_start( [ $this, 'process_picture_buffer' ] );
    }

    /**
     * Output-buffer callback. Rewrites every <img> in /uploads/ that
     * isn't already inside a <picture> by wrapping it in a <picture>
     * with <source type="image/avif"> + <source type="image/webp"> entries.
     *
     * Strategy: split the response on <picture>…</picture> blocks, then
     * process the chunks BETWEEN them. Anything inside a <picture> the
     * theme/page-builder wrote intentionally is left alone, so we never
     * produce nested <picture> markup or steamroll a designer's choice.
     *
     * Returns the original buffer untouched if:
     *   - response doesn't contain our uploads URL (nothing to do)
     *   - response is too short to be a real page (under 200 bytes)
     *   - response looks like an XML/JSON document (we never modify those)
     */
    public function process_picture_buffer( $html ) {
        if ( ! is_string( $html ) || strlen( $html ) < 200 ) {
            return $html;
        }
        // Don't touch non-HTML responses. Cheap heuristic: the first
        // ~256 bytes should look HTML-like for us to be in scope.
        $head = ltrim( substr( $html, 0, 256 ) );
        if ( '' === $head ) return $html;
        $first_char = $head[0] ?? '';
        if ( '<' !== $first_char ) {
            return $html;
        }
        // <?xml or <rss or <feed → not our problem.
        if ( 0 === strncasecmp( $head, '<?xml', 5 )
            || false !== stripos( substr( $head, 0, 64 ), '<rss' )
            || false !== stripos( substr( $head, 0, 64 ), '<feed' ) ) {
            return $html;
        }

        $uploads = wp_get_upload_dir();
        $base_url = isset( $uploads['baseurl'] ) ? (string) $uploads['baseurl'] : '';
        if ( '' === $base_url || false === stripos( $html, $base_url ) ) {
            return $html;
        }

        $settings = Tempaloo_WebP_Plugin::get_settings();

        // Split on <picture>…</picture> blocks. Even-indexed chunks are
        // OUTSIDE picture (process them); odd-indexed are INSIDE (leave
        // alone). PREG_SPLIT_DELIM_CAPTURE keeps the picture blocks in
        // the result so re-joining is exact.
        $chunks = preg_split(
            '/(<picture\b[^>]*>.*?<\/picture\s*>)/is',
            $html,
            -1,
            PREG_SPLIT_DELIM_CAPTURE
        );
        if ( ! is_array( $chunks ) || empty( $chunks ) ) {
            return $html;
        }

        $self = $this;
        foreach ( $chunks as $i => $chunk ) {
            if ( ( $i % 2 ) !== 0 ) continue;          // inside <picture> — skip
            if ( false === stripos( $chunk, $base_url ) ) continue; // no work
            $chunks[ $i ] = preg_replace_callback(
                '/<img\b[^>]*>/i',
                static function ( $m ) use ( $self, $settings ) {
                    return $self->wrap_img_in_picture( $m[0], $settings );
                },
                $chunk
            );
        }

        return implode( '', $chunks );
    }

    /**
     * picture_tag mode — wraps a single <img> tag in a <picture> with
     * <source> entries pointing at the WebP and AVIF siblings of every
     * URL in src + srcset. The original <img> stays untouched as the
     * universal fallback (legacy browsers, broken CDN headers, etc.).
     *
     * Returns the original $img unchanged if no siblings exist (so the
     * page never gets `<picture>` wrapper churn for nothing).
     *
     * Why this is run from wp_content_img_tag rather than the_content:
     * core hands us each <img> already isolated, with a stable parser,
     * and runs ONCE per render cycle — so we can't double-wrap. Themes
     * that emit their own <picture> manually live outside post_content
     * and aren't reached by this filter.
     */
    public function wrap_img_in_picture( $img, $settings ) {
        // Need both a src AND a path inside our uploads dir. If either
        // fails we abort — never wrap an image we can't safely match
        // to a sibling on disk.
        if ( ! preg_match( '/\bsrc\s*=\s*([\'"])([^\'"]+?)\1/i', $img, $src_m ) ) {
            return $img;
        }
        $src = $src_m[2];
        $uploads = wp_get_upload_dir();
        $base_url = $uploads['baseurl'];
        $base_dir = $uploads['basedir'];
        if ( 0 !== strpos( $src, $base_url ) ) {
            return $img;
        }

        $supports_avif = ! empty( $settings['supports_avif'] );

        // Build sibling srcsets. Two paths: the <img> already has a
        // srcset (typical for sized media in Gutenberg) → transform every
        // entry; or only a bare src → derive a single-entry srcset.
        $avif_parts = [];
        $webp_parts = [];

        if ( preg_match( '/\bsrcset\s*=\s*([\'"])([^\'"]+?)\1/i', $img, $srcset_m ) ) {
            $entries = explode( ',', $srcset_m[2] );
            foreach ( $entries as $entry ) {
                $entry = trim( $entry );
                if ( '' === $entry ) continue;
                // Format: "url 1024w" or "url 2x" — split on first whitespace.
                $space = strpos( $entry, ' ' );
                $entry_url = false === $space ? $entry : substr( $entry, 0, $space );
                $entry_descriptor = false === $space ? '' : substr( $entry, $space );
                if ( 0 !== strpos( $entry_url, $base_url ) ) continue;
                $entry_path = $base_dir . substr( $entry_url, strlen( $base_url ) );
                if ( $supports_avif && file_exists( $entry_path . '.avif' ) ) {
                    $avif_parts[] = $entry_url . '.avif' . $entry_descriptor;
                }
                if ( file_exists( $entry_path . '.webp' ) ) {
                    $webp_parts[] = $entry_url . '.webp' . $entry_descriptor;
                }
            }
        } else {
            $src_path = $base_dir . substr( $src, strlen( $base_url ) );
            if ( $supports_avif && file_exists( $src_path . '.avif' ) ) {
                $avif_parts[] = $src . '.avif';
            }
            if ( file_exists( $src_path . '.webp' ) ) {
                $webp_parts[] = $src . '.webp';
            }
        }

        if ( empty( $avif_parts ) && empty( $webp_parts ) ) {
            return $img;
        }

        // Mirror the <img>'s sizes attribute on each <source> so the
        // browser picks the right candidate at the same breakpoints.
        $sizes_attr = '';
        if ( preg_match( '/\bsizes\s*=\s*([\'"])([^\'"]+?)\1/i', $img, $sizes_m ) ) {
            $sizes_attr = ' sizes="' . esc_attr( $sizes_m[2] ) . '"';
        }

        // Order matters — browsers pick the FIRST matching <source>.
        // AVIF first (better compression where supported), then WebP,
        // then the bare <img> as a final fallback for legacy clients.
        $sources = '';
        if ( ! empty( $avif_parts ) ) {
            $sources .= '<source srcset="' . esc_attr( implode( ', ', $avif_parts ) ) . '"' . $sizes_attr . ' type="image/avif">';
        }
        if ( ! empty( $webp_parts ) ) {
            $sources .= '<source srcset="' . esc_attr( implode( ', ', $webp_parts ) ) . '"' . $sizes_attr . ' type="image/webp">';
        }

        return '<picture>' . $sources . $img . '</picture>';
    }

    public function maybe_replace_srcset( $sources, $size_array, $image_src, $image_meta, $attachment_id ) {
        if ( ! is_array( $sources ) ) {
            return $sources;
        }
        foreach ( $sources as $key => $source ) {
            if ( empty( $source['url'] ) ) continue;
            $alt = $this->alternate_url( $source['url'] );
            if ( $alt ) {
                $sources[ $key ]['url'] = $alt;
            }
        }
        return $sources;
    }

    /**
     * Returns the .webp/.avif sibling URL if (a) its file exists and (b) the
     * client indicates support via the Accept header. Otherwise null.
     */
    private function alternate_url( $url ) {
        $s = Tempaloo_WebP_Plugin::get_settings();
        if ( empty( $s['serve_webp'] ) ) {
            return null;
        }
        // CDN passthrough — stay out of the way (see comment in
        // replace_in_img_tag for the full rationale).
        if ( ! empty( $s['cdn_passthrough'] ) ) {
            return null;
        }

        // picture_tag mode owns the <img> output via wrap_img_in_picture —
        // the URL-rewrite filters (wp_get_attachment_url, srcset, image_src,
        // js_data) all become no-op here so we don't double-process. We
        // can't unhook them at register() time because the option might
        // change after boot, so the cheapest gate is a single early-return.
        $mode = isset( $s['delivery_mode'] ) ? (string) $s['delivery_mode'] : 'url_rewrite';
        if ( 'url_rewrite' !== $mode ) {
            return null;
        }

        // Never rewrite in admin / AJAX / REST contexts. We use a
        // double-extension scheme (`foo.jpg.webp`) and many web servers —
        // including some nginx defaults and shared hosts — pick the MIME
        // type from the FIRST recognized extension (`.jpg`) and serve our
        // WebP body with `Content-Type: image/jpeg`, which the browser
        // can't decode. Result: blank/blue tiles in the media library.
        // The frontend `<img>` requests still benefit because they go
        // through the proper Accept-header negotiation, and admin doesn't
        // need WebP for performance anyway (logged-in, low-traffic).
        if ( is_admin() || wp_doing_ajax() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
            return null;
        }

        $uploads = wp_get_upload_dir();
        $base_url = $uploads['baseurl'];
        if ( 0 !== strpos( $url, $base_url ) ) {
            return null; // not one of ours
        }
        $relative  = substr( $url, strlen( $base_url ) );
        $base_dir  = $uploads['basedir'];
        $file_path = $base_dir . $relative;

        // Prefer AVIF if plan supports it AND client accepts it, else WebP.
        $accept = isset( $_SERVER['HTTP_ACCEPT'] )
            ? sanitize_text_field( wp_unslash( (string) $_SERVER['HTTP_ACCEPT'] ) )
            : '';
        $wants_avif = ! empty( $s['supports_avif'] ) && false !== stripos( $accept, 'image/avif' );
        $wants_webp = false !== stripos( $accept, 'image/webp' )
            || false !== stripos( $accept, 'image/*' )
            || false !== stripos( $accept, '*/*' )
            || '' === $accept;

        if ( $wants_avif && file_exists( $file_path . '.avif' ) ) {
            return $url . '.avif';
        }
        if ( $wants_webp && file_exists( $file_path . '.webp' ) ) {
            return $url . '.webp';
        }
        return null;
    }
}
