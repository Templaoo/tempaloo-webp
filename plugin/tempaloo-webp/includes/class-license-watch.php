<?php
/**
 * License Watch — daily re-verify + WP admin notice when a license
 * goes inactive (canceled / expired / past_due).
 *
 * Why a separate class:
 *   · The /license/verify endpoint is now lenient — it returns the real
 *     status even for non-active licenses. Without a periodic re-check,
 *     the user would see a green "active" badge in the plugin even after
 *     their subscription was cancelled in Freemius.
 *   · WP admin notices are global; we want this one to render on every
 *     screen, not just our plugin page, so the admin notices the issue.
 *
 * Storage:
 *   · settings.license_status      — last known status (string)
 *   · settings.last_verified_at    — last successful verify (unix ts)
 *   · option `tempaloo_webp_license_alert_dismissed_until` — soft snooze
 *
 * Source of truth:
 *   The plugin trusts the API — if /license/verify says 'expired', the
 *   notice fires regardless of what Freemius "thinks" client-side. The
 *   webhooks_events table on the API is the upstream truth.
 */

defined( 'ABSPATH' ) || exit;

final class Tempaloo_WebP_License_Watch {

    const CRON_HOOK         = 'tempaloo_webp_daily_verify';
    const DISMISS_OPTION    = 'tempaloo_webp_license_alert_dismissed_until';
    const DISMISS_NONCE     = 'tempaloo_webp_dismiss_license_alert';
    const SNOOZE_DAYS       = 7;

    /** Statuses that should trigger the inactive-license alert. */
    const BAD_STATUSES = [ 'canceled', 'expired', 'past_due' ];

    public static function register() {
        add_action( self::CRON_HOOK, [ __CLASS__, 'run_daily_verify' ] );
        if ( is_admin() ) {
            add_action( 'admin_notices', [ __CLASS__, 'render_notice' ] );
            add_action( 'admin_post_' . self::DISMISS_NONCE, [ __CLASS__, 'handle_dismiss' ] );
        }
    }

    public static function on_activate() {
        if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
            // Run daily at a random hour to spread load on the API across
            // all sites that install the plugin.
            wp_schedule_event(
                time() + wp_rand( 60, 600 ),
                'daily',
                self::CRON_HOOK
            );
        }
    }

    public static function on_deactivate() {
        $ts = wp_next_scheduled( self::CRON_HOOK );
        if ( $ts ) {
            wp_unschedule_event( $ts, self::CRON_HOOK );
        }
    }

    /**
     * Daily re-verify: ask the API "is this license still good?" and
     * persist the latest status. Failure is non-fatal — we keep the
     * previous known status so a transient outage doesn't trigger a
     * scary notice.
     */
    public static function run_daily_verify() {
        $s = Tempaloo_WebP_Plugin::get_settings();
        $key = (string) ( $s['license_key'] ?? '' );
        if ( '' === $key ) {
            return;
        }

        $client = new Tempaloo_WebP_API_Client( $key );
        $res    = $client->verify_license( home_url() );
        if ( empty( $res['ok'] ) || ! is_array( $res['data'] ?? null ) ) {
            return;
        }
        $data = $res['data'];

        $patch = [
            'license_status'   => isset( $data['status'] ) ? (string) $data['status'] : ( ! empty( $data['valid'] ) ? 'active' : 'unknown' ),
            'license_valid'    => ! empty( $data['valid'] ),
            'plan'             => isset( $data['plan'] ) ? (string) $data['plan'] : (string) ( $s['plan'] ?? '' ),
            'last_verified_at' => time(),
        ];
        if ( isset( $data['supports_avif'] ) ) $patch['supports_avif'] = ! empty( $data['supports_avif'] );
        if ( isset( $data['images_limit'] ) )  $patch['images_limit']  = (int) $data['images_limit'];
        if ( isset( $data['sites_limit'] ) )   $patch['sites_limit']   = (int) $data['sites_limit'];
        Tempaloo_WebP_Plugin::update_settings( $patch );

        // Status crossing into BAD reset the dismissal — a fresh cancel
        // deserves a fresh notice even if the user dismissed an older one.
        $prev_status = (string) ( $s['license_status'] ?? '' );
        $next_status = (string) $patch['license_status'];
        $was_bad = in_array( $prev_status, self::BAD_STATUSES, true );
        $is_bad  = in_array( $next_status, self::BAD_STATUSES, true );
        if ( $is_bad && ! $was_bad ) {
            delete_option( self::DISMISS_OPTION );
        }
    }

    /**
     * WP admin notice — only renders for users who can do something
     * about it (manage_options) AND only when the latest status is bad
     * AND the dismissal hasn't snoozed it.
     */
    public static function render_notice() {
        if ( ! current_user_can( 'manage_options' ) ) return;

        $s = Tempaloo_WebP_Plugin::get_settings();
        $status = (string) ( $s['license_status'] ?? '' );
        if ( ! in_array( $status, self::BAD_STATUSES, true ) ) return;

        $until = (int) get_option( self::DISMISS_OPTION, 0 );
        if ( $until > time() ) return;

        $headline = self::headline_for( $status );
        $cta_url  = 'https://users.freemius.com/';
        $upgrade  = admin_url( 'options-general.php?page=tempaloo-webp&tab=upgrade' );

        $dismiss_url = wp_nonce_url(
            admin_url( 'admin-post.php?action=' . self::DISMISS_NONCE ),
            self::DISMISS_NONCE
        );

        ?>
        <div class="notice notice-error" style="border-left-color:#E5484D;padding:14px 18px 14px 14px;display:flex;gap:14px;align-items:flex-start;">
            <span style="font-size:18px;line-height:1;color:#E5484D;">⚠</span>
            <div style="flex:1;">
                <p style="margin:0;font-weight:600;color:#0A0A0A;">
                    <?php echo esc_html( $headline ); ?>
                </p>
                <p style="margin:6px 0 10px;color:#3A3A3A;font-size:13px;">
                    <?php echo esc_html__( 'New uploads are no longer being optimized. Reactivate your subscription to keep AVIF and your full plan benefits.', 'tempaloo-webp' ); ?>
                </p>
                <p style="margin:0;display:flex;gap:8px;align-items:center;">
                    <a href="<?php echo esc_url( $cta_url ); ?>" target="_blank" rel="noopener"
                       class="button button-primary"
                       style="background:#0A0A0A;border-color:#0A0A0A;color:#fff;">
                        <?php echo esc_html__( 'Reactivate ↗', 'tempaloo-webp' ); ?>
                    </a>
                    <a href="<?php echo esc_url( $upgrade ); ?>" class="button button-secondary">
                        <?php echo esc_html__( 'Upgrade plan', 'tempaloo-webp' ); ?>
                    </a>
                    <a href="<?php echo esc_url( $dismiss_url ); ?>"
                       style="margin-left:auto;font-size:12px;color:#6E6E6E;text-decoration:underline;">
                        <?php echo esc_html__( "I'll do it later (snooze 7 days)", 'tempaloo-webp' ); ?>
                    </a>
                </p>
            </div>
        </div>
        <?php
    }

    public static function handle_dismiss() {
        if ( ! current_user_can( 'manage_options' ) ) wp_die( '', '', [ 'response' => 403 ] );
        check_admin_referer( self::DISMISS_NONCE );
        update_option( self::DISMISS_OPTION, time() + ( self::SNOOZE_DAYS * DAY_IN_SECONDS ), false );
        wp_safe_redirect( wp_get_referer() ?: admin_url() );
        exit;
    }

    private static function headline_for( $status ) {
        switch ( $status ) {
            case 'expired':  return __( 'Your Tempaloo WebP license has expired.', 'tempaloo-webp' );
            case 'canceled': return __( 'Your Tempaloo WebP subscription was cancelled.', 'tempaloo-webp' );
            case 'past_due': return __( 'Your Tempaloo WebP payment is past due.', 'tempaloo-webp' );
            default:         return __( 'Your Tempaloo WebP license is inactive.', 'tempaloo-webp' );
        }
    }
}
