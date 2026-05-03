<?php
/**
 * Avero Consulting — Built for Life widget
 *
 * Cinematic "world expands" pin section. The image starts as a rounded
 * card (88vw × 80vh), grows to fullscreen on scroll while the inner
 * image dezooms 1.15 → 1.0 and the title fades in + rises 40px during
 * the climax. The section pins for one viewport so the user can read,
 * then scroll continues. Auto-disabled below 800px.
 *
 * Built as a SELF-CONTAINED widget rather than a generic preset because
 * the animation requires very specific markup (.tw-bfl__sticky / __inner
 * / __media / __overlay) and a dedicated CSS-sticky scaffold. Trying to
 * apply this pattern to arbitrary clicked widgets via Animate Mode
 * deformed Elementor's nested flex/grid layouts; baking the markup into
 * a dedicated widget removes that ambiguity.
 *
 * The animation logic lives in this widget's script.js — it gracefully
 * degrades to a static card when GSAP is unavailable.
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

    /**
     * Force-enqueue this widget's script.js whenever it renders. The
     * runtime needs GSAP + ScrollTrigger; we don't list them as deps
     * here because Frontend\Assets only registers GSAP under the
     * lazy-load gate. Instead, the script.js detects GSAP at boot and
     * gracefully degrades to a static card if it's missing.
     */
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
            'default' => 'Built for life',
        ] );

        $this->add_control( 'title', [
            'label'   => esc_html__( 'Title', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXTAREA,
            'default' => 'Built for life,<br>not just the gym.',
            'description' => esc_html__( 'HTML allowed: <em>, <br>, <strong>.', 'tempaloo-studio' ),
        ] );

        $this->add_control( 'lead', [
            'label'   => esc_html__( 'Lead', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXTAREA,
            'default' => 'Your routine adapts to your week — not the other way around.',
        ] );

        $this->add_control( 'image', [
            'label'   => esc_html__( 'Background image', 'tempaloo-studio' ),
            'type'    => Controls_Manager::MEDIA,
            'default' => [
                // Mockup placeholder — Avero ships placeholder.svg with most widgets.
                'url' => $this->mockup_image_url(),
            ],
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
            'label'   => esc_html__( 'Pin scroll length (vh)', 'tempaloo-studio' ),
            'type'    => Controls_Manager::NUMBER,
            'min'     => 100, 'max' => 400, 'step' => 10,
            'default' => 250,
            'description' => esc_html__( 'Total scroll distance the section consumes — 250 = expand to fullscreen + ~1 viewport hold to read.', 'tempaloo-studio' ),
        ] );
        $this->add_control( 'mobile_breakpoint', [
            'label'   => esc_html__( 'Mobile breakpoint (px)', 'tempaloo-studio' ),
            'type'    => Controls_Manager::NUMBER,
            'min'     => 400, 'max' => 1200, 'step' => 10,
            'default' => 800,
            'description' => esc_html__( 'Below this width, the cinematic effect is disabled and the card renders as a static block.', 'tempaloo-studio' ),
        ] );

        $this->end_controls_section();
    }

    /**
     * Resolve a default mockup image URL — first preference is the
     * widget's bundled placeholder.svg, then the hero's, then a 1×1
     * transparent data URI. Keeps "drag widget into a fresh page" giving
     * a working preview without the user having to upload anything.
     */
    private function mockup_image_url(): string {
        $tpl_url = TEMPALOO_STUDIO_URL . 'templates/avero-consulting/widgets/';
        $tpl_dir = TEMPALOO_STUDIO_DIR . 'templates/avero-consulting/widgets/';
        if ( file_exists( $tpl_dir . 'built-for-life/placeholder.jpg' ) )  return $tpl_url . 'built-for-life/placeholder.jpg';
        if ( file_exists( $tpl_dir . 'built-for-life/placeholder.svg' ) )  return $tpl_url . 'built-for-life/placeholder.svg';
        if ( file_exists( $tpl_dir . 'hero/placeholder.jpg' ) )            return $tpl_url . 'hero/placeholder.jpg';
        if ( file_exists( $tpl_dir . 'hero/placeholder.svg' ) )            return $tpl_url . 'hero/placeholder.svg';
        return 'data:image/svg+xml;utf8,' . rawurlencode(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">'
          . '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
          . '<stop offset="0" stop-color="#1a1f1d"/><stop offset="1" stop-color="#2a615a"/>'
          . '</linearGradient></defs><rect width="1600" height="1000" fill="url(#g)"/>'
          . '<text x="800" y="500" fill="rgba(255,255,255,0.4)" font-size="40" font-family="sans-serif" text-anchor="middle">Mockup image</text>'
          . '</svg>'
        );
    }

    protected function render(): void {
        $s = $this->get_settings_for_display();

        // Sanitize numeric motion params with sensible defaults — Elementor
        // ships them as strings sometimes (when never edited).
        $card_w = (int)   ( $s['card_width_vw']    ?? 88 );  if ( $card_w < 50 || $card_w > 100 )  $card_w = 88;
        $card_h = (int)   ( $s['card_height_vh']   ?? 80 );  if ( $card_h < 40 || $card_h > 100 )  $card_h = 80;
        $rad    = (int)   ( $s['card_radius']      ?? 28 );  if ( $rad < 0  || $rad > 64 )         $rad = 28;
        $scale  = (float) ( $s['media_scale_from'] ?? 1.15 );if ( $scale < 1 || $scale > 2 )        $scale = 1.15;
        $pin_vh = (int)   ( $s['pin_duration_vh']  ?? 250 ); if ( $pin_vh < 100 || $pin_vh > 400 ) $pin_vh = 250;
        $bp     = (int)   ( $s['mobile_breakpoint'] ?? 800 );if ( $bp < 400 || $bp > 1200 )        $bp = 800;

        $img_url = $s['image']['url'] ?? $this->mockup_image_url();
        $img_alt = $s['image']['alt'] ?? esc_attr__( 'Built for life', 'tempaloo-studio' );

        // CSS — emitted ONCE per page. The id-guard prevents duplicates
        // when multiple instances of the widget render on the same page.
        ?>
        <style id="tw-bfl-css">
        .tw-bfl{position:relative;width:100%;}
        .tw-bfl__sticky{position:sticky;top:0;height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden;width:100%;}
        .tw-bfl__inner{
            position:relative;overflow:hidden;box-sizing:border-box;
            border-radius:var(--tw-bfl-radius,28px);
            box-shadow:0 60px 160px rgba(0,0,0,calc(0.5 - 0.5 * var(--tw-bfl-p,0)));
        }
        .tw-bfl__media{
            position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
            display:block;transform-origin:center center;
        }
        .tw-bfl__overlay{
            position:absolute;inset:0;display:flex;flex-direction:column;
            justify-content:center;align-items:center;text-align:center;
            padding:clamp(24px,5vw,64px);color:#fff;
            background:linear-gradient(180deg,rgba(0,0,0,0.10),rgba(0,0,0,0.55));
            pointer-events:none;
        }
        .tw-bfl__eyebrow{
            font-family:var(--tw-avero-font-body,inherit);
            font-size:11px;letter-spacing:0.18em;text-transform:uppercase;
            font-weight:600;color:rgba(255,255,255,0.78);margin-bottom:18px;
        }
        .tw-bfl__title{
            font-family:var(--tw-avero-font-heading,'Hedvig Letters Serif',serif);
            font-size:clamp(36px,5.4vw,80px);line-height:1.04;letter-spacing:-0.025em;
            font-weight:500;max-width:1100px;color:#fff;margin:0;
        }
        .tw-bfl__title em{font-style:italic;color:#E6FF55;}
        .tw-bfl__lead{
            font-family:var(--tw-avero-font-body,inherit);
            font-size:clamp(15px,1.6vw,19px);line-height:1.55;
            color:rgba(255,255,255,0.86);margin:18px 0 0;max-width:640px;
        }
        @media (max-width:<?php echo (int) $bp; ?>px){
            .tw-bfl{min-height:auto !important;}
            .tw-bfl__sticky{position:static;height:auto;display:block;overflow:visible;}
            .tw-bfl__inner{
                width:92vw !important;height:auto !important;aspect-ratio:4/3;
                margin:32px auto;border-radius:20px !important;
            }
            .tw-bfl__overlay{position:absolute;}
            .tw-bfl__title{font-size:clamp(28px,7vw,44px);}
            .tw-bfl__lead{font-size:14px;}
        }
        </style>

        <section class="tw-bfl" data-tw-anim-scope="built_for_life"
            data-tw-bfl-card-w="<?php echo esc_attr( (string) $card_w ); ?>"
            data-tw-bfl-card-h="<?php echo esc_attr( (string) $card_h ); ?>"
            data-tw-bfl-radius="<?php echo esc_attr( (string) $rad ); ?>"
            data-tw-bfl-scale="<?php echo esc_attr( (string) $scale ); ?>"
            data-tw-bfl-pin-vh="<?php echo esc_attr( (string) $pin_vh ); ?>"
            data-tw-bfl-bp="<?php echo esc_attr( (string) $bp ); ?>"
        >
            <div class="tw-bfl__sticky">
                <div class="tw-bfl__inner" style="border-radius:<?php echo (int) $rad; ?>px;">
                    <img class="tw-bfl__media"
                         src="<?php echo esc_url( $img_url ); ?>"
                         alt="<?php echo esc_attr( $img_alt ); ?>"
                         loading="lazy" />
                    <div class="tw-bfl__overlay">
                        <?php if ( ! empty( $s['eyebrow'] ) ) : ?>
                            <span class="tw-bfl__eyebrow"><?php echo esc_html( $s['eyebrow'] ); ?></span>
                        <?php endif; ?>
                        <h2 class="tw-bfl__title"><?php
                            echo wp_kses(
                                (string) ( $s['title'] ?? '' ),
                                [ 'em' => [], 'strong' => [], 'br' => [] ]
                            );
                        ?></h2>
                        <?php if ( ! empty( $s['lead'] ) ) : ?>
                            <p class="tw-bfl__lead"><?php echo wp_kses_post( $s['lead'] ); ?></p>
                        <?php endif; ?>
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
                <div class="tw-bfl__inner" style="width:{{ settings.card_width_vw || 88 }}vw;height:{{ settings.card_height_vh || 80 }}vh;border-radius:{{ settings.card_radius || 28 }}px;">
                    <# if (imgUrl) { #><img class="tw-bfl__media" src="{{ imgUrl }}" alt="" /><# } #>
                    <div class="tw-bfl__overlay">
                        <# if (settings.eyebrow) { #><span class="tw-bfl__eyebrow">{{ settings.eyebrow }}</span><# } #>
                        <h2 class="tw-bfl__title">{{{ safeTitle }}}</h2>
                        <# if (settings.lead) { #><p class="tw-bfl__lead">{{{ settings.lead }}}</p><# } #>
                    </div>
                </div>
            </div>
        </section>
        <?php
    }
}
