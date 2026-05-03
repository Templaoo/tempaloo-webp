<?php
/**
 * Avero Consulting — Built for Life widget (Forma pin-scale clone)
 *
 * Copies the Forma reference verbatim:
 *
 *   • Container with a background image (full-bleed inside the inner card)
 *   • Eyebrow "Built for life, not just the gym"
 *   • h2 "Your routine adapts to your week — not the other way around."
 *   • Both centered horizontally + vertically on the image overlay
 *   • Card 88vw × 80vh → 100vw × 100vh on scroll
 *   • Image dezooms 1.15 → 1.0
 *   • Eyebrow + h2 fade in + rise 40px during the climax
 *   • Section pins for one viewport, then releases
 *   • Mobile (≤800px) — static card, full text visible
 *
 * Implementation strategy (Forma's exact pattern):
 *   - The animation is driven entirely by a single CSS custom property
 *     `--p` that goes 0 → 1 across the section's scroll.
 *   - All visual interpolation (width/height/border-radius/scale/opacity/
 *     translateY) is done in CSS via calc(... * var(--p)).
 *   - JS does only ONE thing: read scroll position, compute eased p,
 *     write `style.setProperty('--p', value)`.
 *   - Zero GSAP / ScrollTrigger dependency for this widget. No timeline
 *     conflicts, no pin spacers, no matchMedia — just CSS sticky and
 *     a passive scroll listener inside requestAnimationFrame.
 *
 * Why this beats the GSAP-based version inside Elementor:
 *   - CSS sticky is a layout concern, not a JS concern → unaffected by
 *     Elementor's deeply-nested flex/grid wrappers
 *   - No pin spacer creation, no position:fixed escape attempts
 *   - rAF-throttled scroll listener is cheaper than ScrollTrigger scrub
 *   - If JS fails, the CSS fallback (--p:1, static card) still works
 *
 * @package Tempaloo\Studio\Templates\Avero_Consulting
 */

namespace Tempaloo\Studio\Templates\Avero_Consulting;

defined( 'ABSPATH' ) || exit;

use Elementor\Controls_Manager;
use Tempaloo\Studio\Elementor\Widget_Base;

class Built_For_Life extends Widget_Base {

    public function get_name(): string         { return 'built-for-life'; }
    public function get_title(): string        { return esc_html__( 'Avero — Built for Life (cinematic pin)', 'tempaloo-studio' ); }
    public function get_icon(): string         { return 'eicon-image-rollover'; }
    public function get_template_slug(): string { return 'avero-consulting'; }

    public function get_script_depends(): array {
        return [ 'tempaloo-studio-built-for-life' ];
    }

    protected function register_controls(): void {
        $this->start_controls_section( 'section_content', [
            'label' => esc_html__( 'Content', 'tempaloo-studio' ),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $this->add_control( 'eyebrow', [
            'label'   => esc_html__( 'Eyebrow', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXT,
            'default' => 'Built for life, not just the gym',
        ] );

        $this->add_control( 'title', [
            'label'   => esc_html__( 'Title', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXTAREA,
            'default' => 'Your routine adapts to <em>your week</em> — not the other way around.',
            'description' => esc_html__( 'Wrap a key phrase in <em>…</em> to render it in italic accent color (Forma serif-i style).', 'tempaloo-studio' ),
        ] );

        $this->add_control( 'image', [
            'label'   => esc_html__( 'Background image', 'tempaloo-studio' ),
            'type'    => Controls_Manager::MEDIA,
            'default' => [ 'url' => $this->mockup_image_url() ],
        ] );

        $this->end_controls_section();

        $this->start_controls_section( 'section_motion', [
            'label' => esc_html__( 'Motion', 'tempaloo-studio' ),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $this->add_control( 'card_width_vw', [
            'label'   => esc_html__( 'Card width (vw)', 'tempaloo-studio' ),
            'type'    => Controls_Manager::NUMBER,
            'min'     => 50, 'max' => 100, 'step' => 1,
            // Forma's exact starting card size — 88vw × 80vh grows to
            // fullscreen during scrub. Section background is transparent
            // so the visible margins inherit the page bg cleanly.
            'default' => 88,
        ] );
        $this->add_control( 'card_height_vh', [
            'label'   => esc_html__( 'Card height (vh)', 'tempaloo-studio' ),
            'type'    => Controls_Manager::NUMBER,
            'min'     => 40, 'max' => 100, 'step' => 1,
            'default' => 80,
        ] );
        $this->add_control( 'card_radius', [
            'label'   => esc_html__( 'Card radius (px)', 'tempaloo-studio' ),
            'type'    => Controls_Manager::NUMBER,
            'min'     => 0, 'max' => 64, 'step' => 1,
            'default' => 28,
        ] );
        $this->add_control( 'media_scale_from', [
            'label'   => esc_html__( 'Image dezoom from', 'tempaloo-studio' ),
            'type'    => Controls_Manager::NUMBER,
            'min'     => 1, 'max' => 2, 'step' => 0.05,
            'default' => 1.15,
        ] );
        $this->add_control( 'pin_duration_vh', [
            'label'   => esc_html__( 'Section height (vh)', 'tempaloo-studio' ),
            'type'    => Controls_Manager::NUMBER,
            'min'     => 150, 'max' => 400, 'step' => 10,
            'default' => 250,
            'description' => esc_html__( 'Total height of the section (Forma uses 250vh = 100vh sticky + 150vh of scroll travel: ~70% for the unfurl, ~30% to read).', 'tempaloo-studio' ),
        ] );
        $this->add_control( 'mobile_breakpoint', [
            'label'   => esc_html__( 'Mobile breakpoint (px)', 'tempaloo-studio' ),
            'type'    => Controls_Manager::NUMBER,
            'min'     => 400, 'max' => 1200, 'step' => 10,
            'default' => 800,
        ] );

        $this->end_controls_section();
    }

    /**
     * Unsplash CDN URL for the default mockup. Same gym/fitness photo
     * Forma uses in its `pin-scale` reference section. Sized 2000w q=85
     * for the cinematic fullscreen state. Unsplash's CDN serves WebP
     * with HTTP/2 — no need to bundle a local placeholder.
     */
    private function mockup_image_url(): string {
        return 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=2000&q=85&auto=format&fit=crop';
    }

    protected function render(): void {
        $s = $this->get_settings_for_display();

        $card_w = (int)   ( $s['card_width_vw']    ?? 88 );  if ( $card_w < 50 || $card_w > 100 )  $card_w = 88;
        $card_h = (int)   ( $s['card_height_vh']   ?? 80 );  if ( $card_h < 40 || $card_h > 100 )  $card_h = 80;
        $rad    = (int)   ( $s['card_radius']      ?? 28 );  if ( $rad < 0  || $rad > 64 )         $rad = 28;
        $scale  = (float) ( $s['media_scale_from'] ?? 1.15 );if ( $scale < 1 || $scale > 2 )       $scale = 1.15;
        $sec_vh = (int)   ( $s['pin_duration_vh']  ?? 250 ); if ( $sec_vh < 150 || $sec_vh > 400 ) $sec_vh = 250;
        $bp     = (int)   ( $s['mobile_breakpoint'] ?? 800 );if ( $bp < 400 || $bp > 1200 )        $bp = 800;

        $img_url = $s['image']['url'] ?? $this->mockup_image_url();
        $img_alt = $s['image']['alt'] ?? esc_attr__( 'Built for life background', 'tempaloo-studio' );

        $scale_delta = $scale - 1.0;

        // CSS — emitted ONCE per page (id-guarded). All visual changes
        // are CSS calc() interpolations driven by a single var(--p).
        // Mobile fallback inside the same <style>: --p:1 + static layout.
        ?>
        <?php
        // Build a responsive srcset from the Unsplash URL (or any URL
        // with a `w=` query param). Fallback to a plain src if the URL
        // shape doesn't match.
        $srcset_attr = '';
        if ( preg_match( '#\bw=\d+#i', $img_url ) ) {
            $widths = [ 800, 1200, 1600, 2000 ];
            $parts  = [];
            foreach ( $widths as $w ) {
                $u = preg_replace( '#\bw=\d+#i', 'w=' . $w, $img_url );
                $parts[] = esc_url( $u ) . ' ' . $w . 'w';
            }
            $srcset_attr = implode( ', ', $parts );
        }
        ?>
        <style id="tw-avero-built-for-life-css">
        /* No-JS / pre-script fallback — when --p hasn't been driven by JS
           yet (initial paint OR JS disabled), pin the canvas at p:1 so
           the section is at least readable. The script.js sets --p back
           to 0 only AFTER it has wired the scroll listener. */
        /* Section background is transparent so the body / parent
           Elementor section color shows through any visible margins
           when the card is configured smaller than 100vw/100vh. By
           default the canvas fills the viewport so no margins are
           visible at all. */
        /* Full-bleed escape from .elementor-container max-width.
           Without this, the section inherits the 1140px container
           limit. When GSAP pins .__sticky, the inline position:fixed
           freezes the element at width:1140px / left:36px → user sees
           36px white margins on each side instead of a true fullscreen
           pin. The `width:100vw + margin-left:calc(50% - 50vw)` pattern
           is the canonical CSS escape — section's box now matches the
           viewport edges regardless of any wrapper's max-width. */
        .tw-avero-built-for-life{
            position:relative;
            width:100vw;
            max-width:100vw;
            margin-left:calc(50% - 50vw);
            margin-right:calc(50% - 50vw);
            box-sizing:border-box;
            background:transparent;
            height:<?php echo (int) $sec_vh; ?>vh;
            contain:layout paint;
        }
        /* Sticky child gets full viewport width — when GSAP pin engages,
           the inline position:fixed freezes it at width:100vw / left:0. */
        .tw-avero-built-for-life__sticky{
            position:sticky;
            top:0;
            left:0;
            width:100vw;
            height:100vh;
            display:flex;
            align-items:center;
            justify-content:center;
            overflow:hidden;
        }
        .tw-avero-built-for-life__canvas{
            --p:0;
            position:relative;overflow:hidden;
            margin:0 auto;
            width:calc(<?php echo (int) $card_w; ?>vw + (100vw - <?php echo (int) $card_w; ?>vw) * var(--p));
            height:calc(<?php echo (int) $card_h; ?>vh + (100vh - <?php echo (int) $card_h; ?>vh) * var(--p));
            border-radius:calc(<?php echo (int) $rad; ?>px - <?php echo (int) $rad; ?>px * var(--p));
            box-shadow:0 60px 160px rgba(0,0,0,calc(0.5 - 0.5 * var(--p)));
            transition:none;
            will-change:width,height,border-radius;
        }
        .tw-avero-built-for-life__media{
            display:block;width:100%;height:100%;object-fit:cover;
            transform:scale(calc(<?php echo number_format( $scale, 4, '.', '' ); ?> - <?php echo number_format( $scale_delta, 4, '.', '' ); ?> * var(--p)));
            transform-origin:center center;
            transition:none;
            will-change:transform;
            backface-visibility:hidden;
        }
        .tw-avero-built-for-life__text{
            position:absolute;inset:0;
            display:flex;flex-direction:column;justify-content:center;align-items:center;
            text-align:center;color:#fff;
            padding:clamp(24px,5vw,64px);
            /* Gradient overlay removed — text-shadow on .tw-avero-built-for-life__eyebrow
               and .tw-avero-built-for-life__title alone keeps the type legible against any
               photo. Cleaner edit-mode preview, no dark wash on the image. */
            background:transparent;
            opacity:var(--p);
            transform:translateY(calc(40px - 40px * var(--p)));
            pointer-events:none;
            will-change:opacity,transform;
        }
        .tw-avero-built-for-life__eyebrow{
            font-family:var(--tw-avero-font-body,'Inter',sans-serif);
            font-size:clamp(11px,1.1vw,13px);
            letter-spacing:0.18em;text-transform:uppercase;
            font-weight:600;
            color:var(--tw-avero-accent,#E6FF55);
            margin-bottom:24px;
            /* Stronger shadow now that the gradient overlay is gone.
               Two layers: a tight close shadow for edge definition and
               a wider soft glow for ambient contrast against any photo. */
            text-shadow:0 2px 4px rgba(0,0,0,0.85), 0 4px 24px rgba(0,0,0,0.55);
        }
        .tw-avero-built-for-life__title{
            font-family:var(--tw-avero-font-heading,'Hedvig Letters Serif',serif);
            font-size:clamp(36px,5.4vw,80px);
            line-height:1.04;letter-spacing:-0.025em;
            font-weight:500;
            color:#fff;
            max-width:1100px;margin:0;
            /* Stronger shadow stack to compensate for the removed
               gradient overlay. Tight + wide pair anchors the serif
               italic against any photo, including bright backgrounds
               where a single shadow alone gets washed out. */
            text-shadow:0 2px 6px rgba(0,0,0,0.80), 0 8px 36px rgba(0,0,0,0.55);
        }
        .tw-avero-built-for-life__title em{
            font-style:italic;
            color:var(--tw-avero-accent,#E6FF55);
        }
        /* prefers-reduced-motion — pin --p at 1 site-wide so users with
           vestibular sensitivity see the section in its readable end-state
           with no scroll-coupled motion. */
        @media (prefers-reduced-motion:reduce){
            .tw-avero-built-for-life__canvas{--p:1 !important;}
            .tw-avero-built-for-life__media{transform:scale(1) !important;}
            .tw-avero-built-for-life__text{opacity:1 !important;transform:none !important;}
        }
        @media (max-width:<?php echo (int) $bp; ?>px){
            /* Disable the pin entirely on mobile: section reverts to its
               natural height, sticky becomes static, the canvas locks at
               --p:1 (full text visible, image at scale 1, no border-radius
               growth needed since the card is already full-width). */
            .tw-avero-built-for-life{height:auto;padding:64px 0;}
            .tw-avero-built-for-life__sticky{position:static;height:auto;display:block;overflow:visible;}
            .tw-avero-built-for-life__canvas{
                --p:1;
                width:92vw !important;height:auto !important;
                aspect-ratio:4/3;border-radius:20px !important;
                box-shadow:0 24px 48px -12px rgba(0,0,0,0.4) !important;
            }
            .tw-avero-built-for-life__media{transform:scale(1) !important;}
            .tw-avero-built-for-life__text{opacity:1 !important;transform:none !important;padding:24px !important;}
            .tw-avero-built-for-life__title{font-size:clamp(28px,7vw,44px);}
        }
        </style>

        <noscript>
            <style>
            /* JS disabled — show the section in its end-state. The script
               below would otherwise leave --p at 0, hiding the text
               entirely and stranding the user with an invisible card. */
            .tw-avero-built-for-life__canvas{--p:1 !important;}
            .tw-avero-built-for-life__media{transform:scale(1) !important;}
            .tw-avero-built-for-life__text{opacity:1 !important;transform:none !important;}
            </style>
        </noscript>

        <section class="tw-avero-built-for-life"
            data-tw-anim-scope="built_for_life"
            data-tw-anim-skip
            data-bp="<?php echo esc_attr( (string) $bp ); ?>">
            <div class="tw-avero-built-for-life__sticky">
                <div class="tw-avero-built-for-life__canvas">
                    <img class="tw-avero-built-for-life__media"
                         src="<?php echo esc_url( $img_url ); ?>"
                         <?php if ( $srcset_attr !== '' ) : ?>srcset="<?php echo $srcset_attr; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped — pre-escaped above ?>"<?php endif; ?>
                         sizes="100vw"
                         alt=""
                         loading="eager"
                         fetchpriority="high"
                         decoding="async" />
                    <div class="tw-avero-built-for-life__text">
                        <?php if ( ! empty( $s['eyebrow'] ) ) : ?>
                            <div class="tw-avero-built-for-life__eyebrow"><?php echo esc_html( $s['eyebrow'] ); ?></div>
                        <?php endif; ?>
                        <h2 class="tw-avero-built-for-life__title"><?php
                            echo wp_kses(
                                (string) ( $s['title'] ?? '' ),
                                [ 'em' => [], 'strong' => [], 'br' => [] ]
                            );
                        ?></h2>
                    </div>
                </div>
            </div>
        </section>
        <?php
    }

    protected function _content_template(): void {
        ?>
        <#
        var safeTitle = (settings.title || '')
            .replace(/&lt;em&gt;/g, '<em>').replace(/&lt;\/em&gt;/g, '</em>')
            .replace(/&lt;br\s*\/?&gt;/g, '<br>');
        var imgUrl = (settings.image && settings.image.url) ? settings.image.url : '';
        #>
        <section class="tw-avero-built-for-life">
            <div class="tw-avero-built-for-life__sticky">
                <div class="tw-avero-built-for-life__canvas" style="--p:1">
                    <# if (imgUrl) { #><img class="tw-avero-built-for-life__media" src="{{ imgUrl }}" alt="" /><# } #>
                    <div class="tw-avero-built-for-life__text">
                        <# if (settings.eyebrow) { #><div class="tw-avero-built-for-life__eyebrow">{{ settings.eyebrow }}</div><# } #>
                        <h2 class="tw-avero-built-for-life__title">{{{ safeTitle }}}</h2>
                    </div>
                </div>
            </div>
        </section>
        <?php
    }
}
