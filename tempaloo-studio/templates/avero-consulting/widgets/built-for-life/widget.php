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
            'description' => esc_html__( 'Total height of the section (Forma uses 250vh = 100vh sticky + 150vh of scroll travel, with the unfurl compressed into the first 70%).', 'tempaloo-studio' ),
        ] );
        $this->add_control( 'mobile_breakpoint', [
            'label'   => esc_html__( 'Mobile breakpoint (px)', 'tempaloo-studio' ),
            'type'    => Controls_Manager::NUMBER,
            'min'     => 400, 'max' => 1200, 'step' => 10,
            'default' => 800,
        ] );

        $this->end_controls_section();
    }

    private function mockup_image_url(): string {
        $tpl_url = TEMPALOO_STUDIO_URL . 'templates/avero-consulting/widgets/';
        $tpl_dir = TEMPALOO_STUDIO_DIR . 'templates/avero-consulting/widgets/';
        if ( file_exists( $tpl_dir . 'built-for-life/placeholder.jpg' ) )  return $tpl_url . 'built-for-life/placeholder.jpg';
        if ( file_exists( $tpl_dir . 'built-for-life/placeholder.svg' ) )  return $tpl_url . 'built-for-life/placeholder.svg';
        if ( file_exists( $tpl_dir . 'hero/placeholder.jpg' ) )            return $tpl_url . 'hero/placeholder.jpg';
        if ( file_exists( $tpl_dir . 'hero/placeholder.svg' ) )            return $tpl_url . 'hero/placeholder.svg';
        // SVG mockup — gym-vibe gradient with a centered subject silhouette
        // so the user sees a meaningful preview before uploading their image.
        return 'data:image/svg+xml;utf8,' . rawurlencode(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">'
          . '<defs><linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1">'
          . '<stop offset="0" stop-color="#1a1f1d"/><stop offset="0.5" stop-color="#2a615a"/><stop offset="1" stop-color="#0e0e0c"/>'
          . '</linearGradient></defs>'
          . '<rect width="1600" height="1000" fill="url(#g)"/>'
          . '<circle cx="1100" cy="500" r="220" fill="rgba(230,255,85,0.06)"/>'
          . '<text x="800" y="510" fill="rgba(255,255,255,0.35)" font-size="48" font-family="serif" font-style="italic" text-anchor="middle">mockup background image</text>'
          . '</svg>'
        );
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
        <style id="tw-bfl-css">
        .tw-bfl{position:relative;width:100%;background:var(--tw-avero-bg,#0c100f);height:<?php echo (int) $sec_vh; ?>vh;}
        .tw-bfl__sticky{position:sticky;top:0;height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden;}
        .tw-bfl__canvas{
            --p:0;
            position:relative;overflow:hidden;
            margin:0 auto;
            width:calc(<?php echo (int) $card_w; ?>vw + (100vw - <?php echo (int) $card_w; ?>vw) * var(--p));
            height:calc(<?php echo (int) $card_h; ?>vh + (100vh - <?php echo (int) $card_h; ?>vh) * var(--p));
            border-radius:calc(<?php echo (int) $rad; ?>px - <?php echo (int) $rad; ?>px * var(--p));
            box-shadow:0 60px 160px rgba(0,0,0,calc(0.5 - 0.5 * var(--p)));
            transition:none;
        }
        .tw-bfl__media{
            display:block;width:100%;height:100%;object-fit:cover;
            transform:scale(calc(<?php echo number_format( $scale, 4, '.', '' ); ?> - <?php echo number_format( $scale_delta, 4, '.', '' ); ?> * var(--p)));
            transform-origin:center center;
            transition:none;
        }
        .tw-bfl__text{
            position:absolute;inset:0;
            display:flex;flex-direction:column;justify-content:center;align-items:center;
            text-align:center;color:#fff;
            padding:clamp(24px,5vw,64px);
            background:linear-gradient(180deg,rgba(0,0,0,0.10),rgba(0,0,0,0.55));
            opacity:var(--p);
            transform:translateY(calc(40px - 40px * var(--p)));
            pointer-events:none;
        }
        .tw-bfl__eyebrow{
            font-family:var(--tw-avero-font-body,'Inter',sans-serif);
            font-size:clamp(11px,1.1vw,13px);
            letter-spacing:0.18em;text-transform:uppercase;
            font-weight:600;
            color:var(--tw-avero-accent,#E6FF55);
            margin-bottom:24px;
        }
        .tw-bfl__title{
            font-family:var(--tw-avero-font-heading,'Hedvig Letters Serif',serif);
            font-size:clamp(36px,5.4vw,80px);
            line-height:1.04;letter-spacing:-0.025em;
            font-weight:500;
            color:#fff;
            max-width:1100px;margin:0;
        }
        .tw-bfl__title em{
            font-style:italic;
            color:var(--tw-avero-accent,#E6FF55);
        }
        @media (max-width:<?php echo (int) $bp; ?>px){
            /* Disable the pin entirely on mobile: section reverts to its
               natural height, sticky becomes static, the canvas locks at
               --p:1 (full text visible, image at scale 1, no border-radius
               growth needed since the card is already full-width). */
            .tw-bfl{height:auto;padding:64px 0;}
            .tw-bfl__sticky{position:static;height:auto;display:block;overflow:visible;}
            .tw-bfl__canvas{
                --p:1;
                width:92vw !important;height:auto !important;
                aspect-ratio:4/3;border-radius:20px !important;
                box-shadow:0 24px 48px -12px rgba(0,0,0,0.4) !important;
            }
            .tw-bfl__media{transform:scale(1) !important;}
            .tw-bfl__text{opacity:1 !important;transform:none !important;padding:24px !important;}
            .tw-bfl__title{font-size:clamp(28px,7vw,44px);}
        }
        </style>

        <section class="tw-bfl" data-tw-anim-scope="built_for_life" data-bp="<?php echo esc_attr( (string) $bp ); ?>">
            <div class="tw-bfl__sticky">
                <div class="tw-bfl__canvas">
                    <img class="tw-bfl__media"
                         src="<?php echo esc_url( $img_url ); ?>"
                         alt="<?php echo esc_attr( $img_alt ); ?>"
                         loading="lazy" />
                    <div class="tw-bfl__text">
                        <?php if ( ! empty( $s['eyebrow'] ) ) : ?>
                            <div class="tw-bfl__eyebrow"><?php echo esc_html( $s['eyebrow'] ); ?></div>
                        <?php endif; ?>
                        <h2 class="tw-bfl__title"><?php
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
        <section class="tw-bfl">
            <div class="tw-bfl__sticky">
                <div class="tw-bfl__canvas" style="--p:1">
                    <# if (imgUrl) { #><img class="tw-bfl__media" src="{{ imgUrl }}" alt="" /><# } #>
                    <div class="tw-bfl__text">
                        <# if (settings.eyebrow) { #><div class="tw-bfl__eyebrow">{{ settings.eyebrow }}</div><# } #>
                        <h2 class="tw-bfl__title">{{{ safeTitle }}}</h2>
                    </div>
                </div>
            </div>
        </section>
        <?php
    }
}
