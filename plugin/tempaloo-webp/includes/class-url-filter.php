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

        // Media library status column.
        add_filter( 'manage_upload_columns',        [ $this, 'media_column' ] );
        add_action( 'manage_media_custom_column',   [ $this, 'media_column_value' ], 10, 2 );

        // Visual "WebP" badge on admin thumbnails (Media Library + block editor only).
        add_action( 'admin_enqueue_scripts',        [ $this, 'enqueue_admin_badge' ] );
        add_action( 'enqueue_block_editor_assets',  [ $this, 'enqueue_admin_badge' ] );
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
    }

    public function media_column( $cols ) {
        $cols['tempaloo_webp'] = __( 'Optimized', 'tempaloo-webp' );
        return $cols;
    }

    public function media_column_value( $column, $post_id ) {
        if ( 'tempaloo_webp' !== $column ) return;
        $meta = wp_get_attachment_metadata( $post_id );
        $tw   = isset( $meta['tempaloo_webp'] ) ? $meta['tempaloo_webp'] : null;
        if ( empty( $tw ) || ( empty( $tw['sizes'] ) && empty( $tw['path'] ) ) ) {
            echo '<span style="color:#9a6700;">—</span>';
            return;
        }

        $uploads   = wp_get_upload_dir();
        $base_dir  = trailingslashit( $uploads['basedir'] );
        $orig_file = get_attached_file( $post_id );

        // Gather all original sibling paths: main file + every generated size.
        $original_paths = [ $orig_file ];
        if ( ! empty( $meta['sizes'] ) && is_array( $meta['sizes'] ) ) {
            foreach ( $meta['sizes'] as $size ) {
                if ( ! empty( $size['file'] ) ) {
                    $original_paths[] = trailingslashit( dirname( $orig_file ) ) . $size['file'];
                }
            }
        }
        $total_in = 0; $total_out = 0; $count = 0;
        foreach ( $original_paths as $p ) {
            $alt = $p . '.' . ( isset( $tw['format'] ) ? $tw['format'] : 'webp' );
            if ( file_exists( $p ) && file_exists( $alt ) ) {
                $total_in  += filesize( $p );
                $total_out += filesize( $alt );
                $count++;
            }
        }
        $fmt = strtoupper( isset( $tw['format'] ) ? $tw['format'] : 'webp' );
        if ( $count === 0 || $total_in === 0 ) {
            echo '<span style="color:#1a7f37;">✓ ' . esc_html( $fmt ) . '</span>';
            return;
        }
        $saved_pct = max( 0, round( ( 1 - ( $total_out / $total_in ) ) * 100 ) );
        printf(
            '<span style="color:#1a7f37;font-weight:600;">✓ %s</span><br><span style="color:#555;font-size:11px;">−%d%% · %s → %s</span>',
            esc_html( $fmt ),
            (int) $saved_pct,
            esc_html( size_format( $total_in ) ),
            esc_html( size_format( $total_out ) )
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
        return $response;
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
        $uploads = wp_get_upload_dir();
        $base_url = $uploads['baseurl'];
        if ( 0 !== strpos( $url, $base_url ) ) {
            return null; // not one of ours
        }
        $relative  = substr( $url, strlen( $base_url ) );
        $base_dir  = $uploads['basedir'];
        $file_path = $base_dir . $relative;

        // Prefer AVIF if plan supports it AND client accepts it, else WebP.
        // In admin we always rewrite — WP admin targets modern browsers, and the real
        // image request sent by the browser will include "Accept: image/webp" natively.
        // On the frontend we respect the Accept header for HTML-context fetches.
        $accept = isset( $_SERVER['HTTP_ACCEPT'] )
            ? sanitize_text_field( wp_unslash( (string) $_SERVER['HTTP_ACCEPT'] ) )
            : '';
        $is_admin_ctx = is_admin() || wp_doing_ajax();
        $wants_avif   = ! empty( $s['supports_avif'] ) && ( $is_admin_ctx || false !== stripos( $accept, 'image/avif' ) );
        $wants_webp   = $is_admin_ctx
            || false !== stripos( $accept, 'image/webp' )
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
