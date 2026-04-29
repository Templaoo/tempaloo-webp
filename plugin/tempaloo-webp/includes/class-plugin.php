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
            // 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired' | 'unknown'
            // Set by daily verify cron + activation. Drives the WP admin
            // notice in class-license-watch + the React banner.
            'license_status'  => 'unknown',
            // Email of the Tempaloo account that owns this license — shown
            // in the plugin top bar so a site owner can see "I'm using
            // foo@bar.com here, my partner is using baz@bar.com on the
            // other site". Filled by /license/verify, refreshed by the
            // daily License Watch cron.
            'license_email'   => '',
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
            // Per-CPT quality overrides: { post_type_slug: int 1..100 }.
            // Applied via the tempaloo_quality_for filter — devs who set this
            // setting don't have to write a single line of PHP.
            'cpt_quality'      => (object) [],
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
        Tempaloo_WebP_Activity::register();
        Tempaloo_WebP_License_Watch::register();

        // Resize-on-upload: pipe the user's setting into WP core's built-in
        // big-image threshold (since WP 5.3). Returning 0 disables the
        // mechanism, which is exactly the behavior we want for "Off".
        add_filter( 'big_image_size_threshold', static function ( $threshold ) {
            $s = self::get_settings();
            $w = isset( $s['resize_max_width'] ) ? (int) $s['resize_max_width'] : 0;
            return $w > 0 ? $w : false; // false → disable, per WP docs
        }, 10, 1 );

        // Per-CPT quality overrides: when an attachment is attached to a
        // post of type X and X has a saved override, use that quality.
        add_filter( 'tempaloo_webp_quality_for', static function ( $quality, $attachment_id ) {
            $s = self::get_settings();
            $map = is_array( $s['cpt_quality'] ?? null ) ? $s['cpt_quality'] : (array) ( $s['cpt_quality'] ?? [] );
            if ( empty( $map ) ) return $quality;
            $parent = wp_get_post_parent_id( (int) $attachment_id );
            if ( ! $parent ) return $quality;
            $type = get_post_type( $parent );
            if ( $type && isset( $map[ $type ] ) && $map[ $type ] > 0 ) {
                return (int) $map[ $type ];
            }
            return $quality;
        }, 10, 2 );
    }
}
