<?php
/**
 * Avero Consulting — CTA widget
 *
 * Final-conversion section. Centered editorial title + lead + dual CTA.
 * Subtle accent gradient overlay on bg-soft. GSAP entrance.
 *
 * @package Tempaloo\Studio\Templates\Avero_Consulting
 */

namespace Tempaloo\Studio\Templates\Avero_Consulting;

defined( 'ABSPATH' ) || exit;

use Elementor\Controls_Manager;
use Tempaloo\Studio\Elementor\Widget_Base;

class Cta extends Widget_Base {

    public function get_name(): string         { return 'cta'; }
    public function get_title(): string        { return esc_html__( 'Avero — CTA', 'tempaloo-studio' ); }
    public function get_icon(): string         { return 'eicon-call-to-action'; }
    public function get_template_slug(): string { return 'avero-consulting'; }

    protected function register_controls(): void {
        $this->start_controls_section( 'section_content', [
            'label' => esc_html__( 'Content', 'tempaloo-studio' ),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $this->add_control( 'eyebrow', [ 'label' => esc_html__( 'Eyebrow', 'tempaloo-studio' ), 'type' => Controls_Manager::TEXT, 'default' => 'Ready when you are' ] );
        $this->add_control( 'title',   [ 'label' => esc_html__( 'Title',   'tempaloo-studio' ), 'type' => Controls_Manager::TEXTAREA, 'default' => "A 20-minute call.\nA <em>much</em> shorter to-do list." ] );
        $this->add_control( 'lead',    [ 'label' => esc_html__( 'Lead',    'tempaloo-studio' ), 'type' => Controls_Manager::TEXTAREA, 'default' => 'Tell us where you are, and we\'ll tell you — honestly — whether we\'re the right next step.' ] );

        $this->add_control( 'cta1_text', [ 'label' => esc_html__( 'Primary CTA', 'tempaloo-studio' ),   'type' => Controls_Manager::TEXT, 'default' => 'Book intro call' ] );
        $this->add_control( 'cta1_url',  [ 'label' => esc_html__( 'Primary URL', 'tempaloo-studio' ),   'type' => Controls_Manager::URL,  'default' => [ 'url' => '#contact' ] ] );
        $this->add_control( 'cta2_text', [ 'label' => esc_html__( 'Secondary link', 'tempaloo-studio' ),'type' => Controls_Manager::TEXT, 'default' => 'or read our process' ] );
        $this->add_control( 'cta2_url',  [ 'label' => esc_html__( 'Secondary URL', 'tempaloo-studio' ), 'type' => Controls_Manager::URL,  'default' => [ 'url' => '#process' ] ] );

        $this->end_controls_section();
    }

    protected function render(): void {
        $s = $this->get_settings_for_display();
        ?>
        <section class="tw-avero-cta">
            <div class="tw-avero-cta__container">
                <span class="tw-avero-cta__halo" aria-hidden="true"></span>

                <?php if ( ! empty( $s['eyebrow'] ) ) : ?>
                    <span class="tw-avero-cta__eyebrow"><?php echo esc_html( $s['eyebrow'] ); ?></span>
                <?php endif; ?>

                <h2 class="tw-avero-cta__title"><?php
                    echo wp_kses( nl2br( (string) ( $s['title'] ?? '' ), false ), [ 'em' => [], 'br' => [] ] );
                ?></h2>

                <?php if ( ! empty( $s['lead'] ) ) : ?>
                    <p class="tw-avero-cta__lead"><?php echo wp_kses_post( $s['lead'] ); ?></p>
                <?php endif; ?>

                <div class="tw-avero-cta__row">
                    <?php if ( ! empty( $s['cta1_text'] ) ) : ?>
                        <a class="tw-avero-cta__btn tw-avero-cta__btn--primary" href="<?php echo esc_url( $s['cta1_url']['url'] ?? '#' ); ?>">
                            <?php echo esc_html( $s['cta1_text'] ); ?>
                            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                        </a>
                    <?php endif; ?>
                    <?php if ( ! empty( $s['cta2_text'] ) ) : ?>
                        <a class="tw-avero-cta__btn tw-avero-cta__btn--ghost" href="<?php echo esc_url( $s['cta2_url']['url'] ?? '#' ); ?>">
                            <?php echo esc_html( $s['cta2_text'] ); ?>
                        </a>
                    <?php endif; ?>
                </div>
            </div>
        </section>
        <?php
    }

    protected function _content_template(): void {
        ?>
        <#
        var safeTitle = _.escape(settings.title || '')
            .replace(/&lt;em&gt;/g, '<em>').replace(/&lt;\/em&gt;/g, '</em>').replace(/\n/g, '<br>');
        #>
        <section class="tw-avero-cta">
            <div class="tw-avero-cta__container">
                <span class="tw-avero-cta__halo"></span>
                <# if (settings.eyebrow) { #><span class="tw-avero-cta__eyebrow">{{ settings.eyebrow }}</span><# } #>
                <h2 class="tw-avero-cta__title">{{{ safeTitle }}}</h2>
                <# if (settings.lead) { #><p class="tw-avero-cta__lead">{{{ settings.lead }}}</p><# } #>
                <div class="tw-avero-cta__row">
                    <# if (settings.cta1_text) { var u1 = (settings.cta1_url && settings.cta1_url.url) || '#'; #>
                        <a class="tw-avero-cta__btn tw-avero-cta__btn--primary" href="{{ u1 }}">{{ settings.cta1_text }}</a>
                    <# } #>
                    <# if (settings.cta2_text) { var u2 = (settings.cta2_url && settings.cta2_url.url) || '#'; #>
                        <a class="tw-avero-cta__btn tw-avero-cta__btn--ghost" href="{{ u2 }}">{{ settings.cta2_text }}</a>
                    <# } #>
                </div>
            </div>
        </section>
        <?php
    }
}
