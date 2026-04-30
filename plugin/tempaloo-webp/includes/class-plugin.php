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
            // How the plugin tells the browser about the optimized version:
            //   'url_rewrite' — replace .jpg URLs with .jpg.webp at PHP filter
            //                   level. Lighter HTML, depends on the host serving
            //                   the right MIME type for double-extension files.
            //                   Original behavior up to 1.1.x; default for
            //                   upgrades to avoid breaking sites that already work.
            //   'picture_tag' — wrap <img> in <picture><source type="image/avif">
            //                   <source type="image/webp">…</picture>. The browser
            //                   negotiates at HTML level. CDN-friendly, theme-
            //                   tolerant. Default for fresh installs (set in
            //                   on_activate when the option doesn't exist yet).
            'delivery_mode'   => 'url_rewrite',
            // CDN passthrough: when on, the plugin stops rewriting URLs
            // and stops wrapping <img> in <picture>. The CDN (Cloudflare
            // Polish, BunnyCDN Optimizer, ImageKit, Cloudinary…) is
            // expected to serve WebP/AVIF transparently from the SAME
            // .jpg URL based on the client's Accept header + Vary.
            // Conversion still runs server-side so siblings exist if the
            // user later disables passthrough — no need to re-bulk.
            'cdn_passthrough' => false,
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

        // Settings like serve_webp / delivery_mode / cdn_passthrough change
        // how every rendered page looks, so any cached HTML out there is
        // immediately stale. Without this, users on LiteSpeed / WP Rocket /
        // SG Optimizer have to manually "Purge all" every time they tweak
        // a toggle — exactly the friction we're trying to remove.
        self::purge_page_caches();

        return $next;
    }

    /**
     * Best-effort purge of frontend caches across the popular plugins.
     * Each branch is a no-op when the relevant plugin isn't installed,
     * so this is safe to call unconditionally on every settings change.
     */
    public static function purge_page_caches() {
        // LiteSpeed Cache (most common on Hostinger / managed-WP hosts).
        do_action( 'litespeed_purge_all' );
        // WP Rocket
        if ( function_exists( 'rocket_clean_domain' ) ) {
            rocket_clean_domain();
        }
        // W3 Total Cache
        if ( function_exists( 'w3tc_flush_all' ) ) {
            w3tc_flush_all();
        }
        // WP Super Cache
        if ( function_exists( 'wp_cache_clear_cache' ) ) {
            wp_cache_clear_cache();
        }
        // SiteGround Optimizer
        if ( function_exists( 'sg_cachepress_purge_cache' ) ) {
            sg_cachepress_purge_cache();
        }
        // Cache Enabler
        do_action( 'cache_enabler_clear_complete_cache' );
        // Hummingbird
        do_action( 'wphb_clear_page_cache' );
        // Autoptimize
        if ( class_exists( 'autoptimizeCache' ) ) {
            // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.NotCamelCaps
            autoptimizeCache::clearall();
        }
    }

    public static function on_activate() {
        if ( false === get_option( self::OPTION ) ) {
            // Fresh install — default to picture_tag, the more robust mode.
            // Existing installs whose option already exists keep whatever
            // they had (default_settings() returns 'url_rewrite' for the
            // missing-key fallback, so reactivation doesn't switch them).
            $defaults = self::default_settings();
            $defaults['delivery_mode'] = 'picture_tag';
            add_option( self::OPTION, $defaults, '', false );
        }
    }

    // ─── Conversion meta storage ────────────────────────────────────────
    //
    // Up to v1.7.x we kept our per-attachment conversion record inside
    // the standard _wp_attachment_metadata array, under a tempaloo_webp
    // sub-key. That worked until we ran on a site where LiteSpeed Cache
    // (Hostinger default) hooked the same wp_generate_attachment_metadata
    // filter at a later priority and rebuilt the metadata array for its
    // own queue — without our sub-key. WP saved their version, ours
    // got stripped, and downstream code (compute_attachment_savings,
    // scan_breakdown, etc.) had no idea conversion had succeeded.
    //
    // v1.8.0 stores conversion state in a SEPARATE post_meta key
    // (_tempaloo_webp). No other plugin can touch what they don't know
    // exists. Reads still fall back to the legacy in-metadata key, so
    // attachments converted before this release keep working until they
    // get re-converted.
    const META_KEY = '_tempaloo_webp';

    /**
     * Returns the conversion record for an attachment, or null if not
     * converted. Always check `_tempaloo_webp` first (the new home),
     * then fall back to `$attachment_metadata['tempaloo_webp']` for
     * backward compatibility with installs that haven't re-bulked yet.
     */
    public static function get_conversion_meta( $attachment_id ) {
        $direct = get_post_meta( (int) $attachment_id, self::META_KEY, true );
        if ( is_array( $direct ) && ! empty( $direct ) ) {
            return $direct;
        }
        $att = wp_get_attachment_metadata( (int) $attachment_id );
        if ( is_array( $att ) && ! empty( $att['tempaloo_webp'] ) ) {
            return $att['tempaloo_webp'];
        }
        return null;
    }

    /**
     * Persists the conversion record. Goes through update_post_meta
     * directly — sidesteps wp_generate_attachment_metadata, the
     * filter chain image optimizers love to hook into.
     */
    public static function set_conversion_meta( $attachment_id, array $data ) {
        if ( $attachment_id <= 0 || empty( $data ) ) return;
        update_post_meta( (int) $attachment_id, self::META_KEY, $data );
    }

    /**
     * Removes our conversion record from BOTH locations. Used by the
     * Restore flow and the Reconcile-ghost-meta operation. Drops the
     * legacy in-metadata key too so the attachment is clean.
     */
    public static function delete_conversion_meta( $attachment_id ) {
        $attachment_id = (int) $attachment_id;
        if ( $attachment_id <= 0 ) return;
        delete_post_meta( $attachment_id, self::META_KEY );
        $att = wp_get_attachment_metadata( $attachment_id );
        if ( is_array( $att ) && isset( $att['tempaloo_webp'] ) ) {
            unset( $att['tempaloo_webp'] );
            wp_update_attachment_metadata( $attachment_id, $att );
        }
        clean_post_cache( $attachment_id );
        wp_cache_delete( $attachment_id, 'post_meta' );
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
