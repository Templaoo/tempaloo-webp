<?php
defined( 'ABSPATH' ) || exit;

final class Tempaloo_WebP_Plugin {

    const OPTION = 'tempaloo_webp_settings';

    private static $instance = null;

    public static function instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public static function default_settings() {
        return [
            'license_key'     => '',
            'license_valid'   => false,
            'plan'            => '',
            'supports_avif'   => false,
            'images_limit'    => 0,
            'sites_limit'     => 0,
            'quality'         => 82,
            'output_format'   => 'webp',   // webp | avif (avif only if supported)
            'auto_convert'    => true,
            'serve_webp'      => true,
            // Resize uploads larger than this width before conversion. 0 = off.
            // Hooks into core's big_image_size_threshold filter; the user's
            // original is kept as a -scaled-original copy by WordPress itself.
            'resize_max_width' => 2560,
            'last_verified_at' => 0,
        ];
    }

    public static function get_settings() {
        $stored = get_option( self::OPTION, [] );
        return array_merge( self::default_settings(), is_array( $stored ) ? $stored : [] );
    }

    public static function update_settings( array $patch ) {
        $current = self::get_settings();
        $next    = array_merge( $current, $patch );
        update_option( self::OPTION, $next, false );
        return $next;
    }

    public static function on_activate() {
        if ( false === get_option( self::OPTION ) ) {
            add_option( self::OPTION, self::default_settings(), '', false );
        }
    }

    public static function on_deactivate() {
        // Nothing destructive. Settings kept for convenience on reactivation.
    }

    public function boot() {
        if ( is_admin() ) {
            ( new Tempaloo_WebP_Settings() )->register();
        }
        ( new Tempaloo_WebP_Converter() )->register();
        ( new Tempaloo_WebP_URL_Filter() )->register();
        ( new Tempaloo_WebP_Bulk() )->register();
        ( new Tempaloo_WebP_REST() )->register();
        ( new Tempaloo_WebP_Retry_Queue() )->register();

        // Resize-on-upload: pipe the user's setting into WP core's built-in
        // big-image threshold (since WP 5.3). Returning 0 disables the
        // mechanism, which is exactly the behavior we want for "Off".
        add_filter( 'big_image_size_threshold', static function ( $threshold ) {
            $s = self::get_settings();
            $w = isset( $s['resize_max_width'] ) ? (int) $s['resize_max_width'] : 0;
            return $w > 0 ? $w : false; // false → disable, per WP docs
        }, 10, 1 );
    }
}
