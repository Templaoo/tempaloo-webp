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
        add_filter( 'wp_content_img_tag',             [ $this, 'replace_in_img_tag' ], 10, 3 );

        // Media library status column.
        add_filter( 'manage_upload_columns',        [ $this, 'media_column' ] );
        add_action( 'manage_media_custom_column',   [ $this, 'media_column_value' ], 10, 2 );

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
        $tw   = isset( $meta['tempaloo_webp'] ) ? $meta['tempaloo_webp'] : null;
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
        $fmt = isset( $tw['format'] ) ? $tw['format'] : 'webp';
        $in = 0; $out = 0; $count = 0;
        foreach ( $paths as $p ) {
            $alt = $p . '.' . $fmt;
            if ( file_exists( $p ) && file_exists( $alt ) ) {
                $in  += filesize( $p );
                $out += filesize( $alt );
                $count++;
            }
        }
        if ( $count === 0 || $in === 0 ) return null;
        return [
            'format'    => strtoupper( $fmt ),
            'sizes'     => $count,
            'bytes_in'  => $in,
            'bytes_out' => $out,
            'saved_pct' => max( 0, (int) round( ( 1 - ( $out / $in ) ) * 100 ) ),
            'at'        => isset( $tw['at'] ) ? (int) $tw['at'] : 0,
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
        $s = $this->compute_attachment_savings( $post_id );
        if ( ! $s ) {
            echo '<span style="color:#9a6700;">—</span>';
            return;
        }
        printf(
            '<span style="color:#1a7f37;font-weight:600;">✓ %s</span><br><span style="color:#555;font-size:11px;">−%d%% · %s → %s</span>',
            esc_html( $s['format'] ),
            (int) $s['saved_pct'],
            esc_html( size_format( $s['bytes_in'] ) ),
            esc_html( size_format( $s['bytes_out'] ) )
        );
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
     * Rewrites the literal `src="…"` attribute on every <img> in post
     * content. Runs once per tag, only on the frontend, only when the
     * URL points inside our uploads dir AND a sibling .webp/.avif file
     * exists. Doesn't touch anything else (lazyload attrs, classes,
     * width/height — left as-is).
     *
     * The srcset filter handles the multi-size attribute separately,
     * and the early-return below skips this work in admin contexts so
     * the media library keeps showing originals.
     */
    public function replace_in_img_tag( $filtered_image, $context, $attachment_id ) {
        if ( ! is_string( $filtered_image ) || '' === $filtered_image ) {
            return $filtered_image;
        }
        // Match the FIRST src="…" (single or double quotes). preg_replace_callback
        // is overkill for one expected match per tag; a single regex + str_replace
        // is faster on long contents.
        if ( ! preg_match( '/\bsrc\s*=\s*([\'"])([^\'"]+?)\1/i', $filtered_image, $m ) ) {
            return $filtered_image;
        }
        $original_url = $m[2];
        $alt = $this->alternate_url( $original_url );
        if ( ! $alt || $alt === $original_url ) {
            return $filtered_image;
        }
        // Replace ONLY the first occurrence of the exact URL — guards
        // against pathological cases where the URL also appears elsewhere
        // in the tag (e.g. inside a data-* attribute we don't own).
        $pos = strpos( $filtered_image, $original_url );
        if ( false === $pos ) {
            return $filtered_image;
        }
        return substr_replace( $filtered_image, $alt, $pos, strlen( $original_url ) );
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
