<?php
/**
 * Avero Consulting — Testimonials widget
 *
 * Editorial single-quote layout with cross-fade between N testimonials.
 * Auto-cycles every 8s, pauses on hover, paginated by dots.
 *
 * @package Tempaloo\Studio\Templates\Avero_Consulting
 */

namespace Tempaloo\Studio\Templates\Avero_Consulting;

defined( 'ABSPATH' ) || exit;

use Elementor\Controls_Manager;
use Elementor\Repeater;
use Tempaloo\Studio\Elementor\Widget_Base;

class Testimonials extends Widget_Base {

    public function get_name(): string         { return 'testimonials'; }
    public function get_title(): string        { return esc_html__( 'Avero — Testimonials', 'tempaloo-studio' ); }
    public function get_icon(): string         { return 'eicon-testimonial'; }
    public function get_template_slug(): string { return 'avero-consulting'; }

    protected function register_controls(): void {

        $this->start_controls_section( 'section_intro', [
            'label' => esc_html__( 'Intro', 'tempaloo-studio' ),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $this->add_control( 'eyebrow', [
            'label'   => esc_html__( 'Eyebrow', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXT,
            'default' => 'Founder feedback',
        ] );

        $this->end_controls_section();

        $this->start_controls_section( 'section_items', [
            'label' => esc_html__( 'Quotes', 'tempaloo-studio' ),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $rep = new Repeater();
        $rep->add_control( 't_quote', [
            'label' => esc_html__( 'Quote', 'tempaloo-studio' ), 'type' => Controls_Manager::TEXTAREA,
            'default' => 'Avero turned our messy GTM into a system the team actually trusts. Six months in, our pipeline is 3× what it was — and we know exactly why.',
        ] );
        $rep->add_control( 't_name', [
            'label' => esc_html__( 'Name', 'tempaloo-studio' ), 'type' => Controls_Manager::TEXT, 'default' => 'Mira Halvorsen',
        ] );
        $rep->add_control( 't_role', [
            'label' => esc_html__( 'Role', 'tempaloo-studio' ), 'type' => Controls_Manager::TEXT, 'default' => 'Founder & CEO',
        ] );
        $rep->add_control( 't_company', [
            'label' => esc_html__( 'Company', 'tempaloo-studio' ), 'type' => Controls_Manager::TEXT, 'default' => 'Vermont & Co',
        ] );
        $rep->add_control( 't_photo', [
            'label' => esc_html__( 'Photo', 'tempaloo-studio' ), 'type' => Controls_Manager::MEDIA,
            'default' => [ 'url' => '' ],
        ] );

        $this->add_control( 'items', [
            'label' => esc_html__( 'Items', 'tempaloo-studio' ),
            'type'        => Controls_Manager::REPEATER,
            'fields'      => $rep->get_controls(),
            'title_field' => '{{{ t_name }}} — {{{ t_company }}}',
            'default'     => [
                [ 't_quote' => 'Avero turned our messy GTM into a system the team actually trusts. Six months in, our pipeline is 3× what it was — and we know exactly why.', 't_name' => 'Mira Halvorsen', 't_role' => 'Founder & CEO',  't_company' => 'Vermont & Co' ],
                [ 't_quote' => "We hired Avero expecting a deck. We got an operating manual we still use 18 months later. Best money we've spent.", 't_name' => 'Daniel Okafor',   't_role' => 'Co-founder',     't_company' => 'Northbeam' ],
                [ 't_quote' => "Most consultants want to look smart. Avero just want you to win. The difference shows in week two.",                't_name' => 'Sasha Reinholt',   't_role' => 'Head of Growth', 't_company' => 'Kestrel Studio' ],
            ],
        ] );

        $this->add_control( 'autoplay_seconds', [
            'label'       => esc_html__( 'Auto-rotate every (seconds, 0 to disable)', 'tempaloo-studio' ),
            'type'        => Controls_Manager::NUMBER,
            'default'     => 8,
            'min'         => 0,
            'max'         => 30,
        ] );

        $this->end_controls_section();
    }

    protected function render(): void {
        $s        = $this->get_settings_for_display();
        $eyebrow  = $this->s( $s, 'eyebrow' );
        $items    = is_array( $s['items'] ?? null ) ? $s['items'] : [];
        $autoplay = (int) ( $s['autoplay_seconds'] ?? 8 );
        ?>
        <section class="tw-avero-testimonials" data-tw-autoplay="<?php echo (int) $autoplay; ?>" data-tw-anim-scope="testimonials">
            <div class="tw-avero-testimonials__container">

                <?php if ( $eyebrow !== '' ) : ?>
                    <span class="tw-avero-testimonials__eyebrow"><?php echo esc_html( $eyebrow ); ?></span>
                <?php endif; ?>

                <div class="tw-avero-testimonials__stage">
                    <?php foreach ( $items as $i => $t ) : ?>
                        <article
                            class="tw-avero-testimonials__quote <?php echo $i === 0 ? 'is-active' : ''; ?>"
                            data-tw-i="<?php echo (int) $i; ?>"
                        >
                            <svg class="tw-avero-testimonials__mark" viewBox="0 0 32 24" aria-hidden="true">
                                <path d="M0 24V14C0 6 4 1 13 0v4c-5 1-7 4-7 9h6v11H0Zm19 0V14c0-8 4-13 13-14v4c-5 1-7 4-7 9h6v11H19Z" fill="currentColor"/>
                            </svg>
                            <blockquote class="tw-avero-testimonials__text">
                                <?php echo wp_kses_post( $t['t_quote'] ?? '' ); ?>
                            </blockquote>
                            <footer class="tw-avero-testimonials__cite">
                                <?php if ( ! empty( $t['t_photo']['url'] ) ) : ?>
                                    <img class="tw-avero-testimonials__photo" src="<?php echo esc_url( $t['t_photo']['url'] ); ?>" alt="" loading="lazy" />
                                <?php else : ?>
                                    <span class="tw-avero-testimonials__photo tw-avero-testimonials__photo--initial" aria-hidden="true">
                                        <?php echo esc_html( mb_substr( (string) ( $t['t_name'] ?? '?' ), 0, 1 ) ); ?>
                                    </span>
                                <?php endif; ?>
                                <span class="tw-avero-testimonials__cite-text">
                                    <span class="tw-avero-testimonials__name"><?php echo esc_html( $t['t_name'] ?? '' ); ?></span>
                                    <span class="tw-avero-testimonials__role">
                                        <?php echo esc_html( trim( ( $t['t_role'] ?? '' ) . ( ! empty( $t['t_role'] ) && ! empty( $t['t_company'] ) ? ', ' : '' ) . ( $t['t_company'] ?? '' ) ) ); ?>
                                    </span>
                                </span>
                            </footer>
                        </article>
                    <?php endforeach; ?>
                </div>

                <?php if ( count( $items ) > 1 ) : ?>
                    <div class="tw-avero-testimonials__dots" role="tablist" aria-label="<?php echo esc_attr__( 'Choose testimonial', 'tempaloo-studio' ); ?>">
                        <?php foreach ( $items as $i => $t ) : ?>
                            <button
                                type="button"
                                class="tw-avero-testimonials__dot <?php echo $i === 0 ? 'is-active' : ''; ?>"
                                data-tw-target="<?php echo (int) $i; ?>"
                                aria-label="<?php echo esc_attr( sprintf( __( 'Show testimonial %d', 'tempaloo-studio' ), $i + 1 ) ); ?>"
                            ></button>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>

            </div>
        </section>
        <?php
    }

    protected function _content_template(): void {
        ?>
        <#
        var items = _.isArray(settings.items) ? settings.items : [];
        #>
        <section class="tw-avero-testimonials">
            <div class="tw-avero-testimonials__container">
                <# if (settings.eyebrow) { #><span class="tw-avero-testimonials__eyebrow">{{ settings.eyebrow }}</span><# } #>
                <div class="tw-avero-testimonials__stage">
                    <# _.each(items, function(t, i){ #>
                        <article class="tw-avero-testimonials__quote {{ i === 0 ? 'is-active' : '' }}">
                            <blockquote class="tw-avero-testimonials__text">{{{ t.t_quote }}}</blockquote>
                            <footer class="tw-avero-testimonials__cite">
                                <span class="tw-avero-testimonials__cite-text">
                                    <span class="tw-avero-testimonials__name">{{ t.t_name }}</span>
                                    <span class="tw-avero-testimonials__role">{{ t.t_role }}{{ t.t_role && t.t_company ? ', ' : '' }}{{ t.t_company }}</span>
                                </span>
                            </footer>
                        </article>
                    <# }); #>
                </div>
            </div>
        </section>
        <?php
    }
}
