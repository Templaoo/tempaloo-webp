<?php
/**
 * Avero Consulting — Testimonials widget
 *
 * Editorial header (rating + serif headline) over an infinite
 * horizontal marquee of testimonial cards. The marquee is built
 * with GSAP so we keep playback control (pause on hover, slow
 * tempo on prefers-reduced-motion) instead of a CSS keyframe.
 *
 * Concept lifted from exemples/index.html (the original Avero
 * Consulting reference page) and reskinned with the template's
 * existing --tw-avero-* tokens so it stays in lockstep with the
 * rest of the bundle.
 *
 * @package Tempaloo\Studio\Templates\Avero_Consulting
 */

namespace Tempaloo\Studio\Templates\Avero_Consulting;

defined( 'ABSPATH' ) || exit;

use Elementor\Controls_Manager;
use Elementor\Repeater;
use Tempaloo\Studio\Elementor\Widget_Base;

class Testimonials extends Widget_Base {

    public function get_name(): string          { return 'testimonials'; }
    public function get_title(): string         { return esc_html__( 'Avero — Testimonials', 'tempaloo-studio' ); }
    public function get_icon(): string          { return 'eicon-testimonial'; }
    public function get_template_slug(): string { return 'avero-consulting'; }

    protected function register_controls(): void {

        /* ── Header (rating + intro headline) ────────────────── */
        $this->start_controls_section( 'section_header', [
            'label' => esc_html__( 'Header', 'tempaloo-studio' ),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $this->add_control( 'rating_stars', [
            'label'   => esc_html__( 'Stars (1–5)', 'tempaloo-studio' ),
            'type'    => Controls_Manager::NUMBER,
            'default' => 5,
            'min'     => 0,
            'max'     => 5,
        ] );

        $this->add_control( 'rating_text', [
            'label'   => esc_html__( 'Rating text', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXT,
            'default' => 'Rated 4.9/5',
        ] );

        $this->add_control( 'intro', [
            'label'   => esc_html__( 'Headline', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXTAREA,
            'default' => "Avero revolutionized our customer\nunderstanding, boosting retention like\nnever before.",
            'description' => esc_html__( 'Newlines render as <br>.', 'tempaloo-studio' ),
        ] );

        $this->end_controls_section();

        /* ── Items (repeater) ────────────────────────────────── */
        $this->start_controls_section( 'section_items', [
            'label' => esc_html__( 'Quotes', 'tempaloo-studio' ),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $rep = new Repeater();
        $rep->add_control( 't_quote', [
            'label'   => esc_html__( 'Quote', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXTAREA,
            'default' => 'Avero turned our messy GTM into a system the team actually trusts. Pipeline is 3× — and we know exactly why.',
        ] );
        $rep->add_control( 't_name', [
            'label'   => esc_html__( 'Name', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXT,
            'default' => 'Mira Halvorsen',
        ] );
        $rep->add_control( 't_photo', [
            'label'   => esc_html__( 'Photo', 'tempaloo-studio' ),
            'type'    => Controls_Manager::MEDIA,
            'default' => [ 'url' => '' ],
        ] );
        $rep->add_control( 't_badge_1', [
            'label'   => esc_html__( 'Badge 1', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXT,
            'default' => 'High conversion',
        ] );
        $rep->add_control( 't_badge_2', [
            'label'   => esc_html__( 'Badge 2', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXT,
            'default' => '2x sales',
        ] );

        $this->add_control( 'items', [
            'label'       => esc_html__( 'Items', 'tempaloo-studio' ),
            'type'        => Controls_Manager::REPEATER,
            'fields'      => $rep->get_controls(),
            'title_field' => '{{{ t_name }}}',
            'default'     => [
                [
                    't_quote'   => "Avero's strategies completely transformed our operational efficiency. We saw a 40% increase in productivity within three months.",
                    't_name'    => 'Sarah Jenkins',
                    't_badge_1' => 'High conversion',
                    't_badge_2' => '2x sales',
                    // Unsplash editorial portraits — sized 200w q=85 for the
                    // 56×56 avatar slot. WebP auto-served, retina-friendly.
                    't_photo'   => [ 'url' => 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=85&auto=format&fit=crop' ],
                ],
                [
                    't_quote'   => 'The level of strategic foresight provided is unmatched. Our logistics have never run smoother, saving us countless hours.',
                    't_name'    => "David O'Connor",
                    't_badge_1' => 'Supply chain',
                    't_badge_2' => 'Cost reduction',
                    't_photo'   => [ 'url' => 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=85&auto=format&fit=crop' ],
                ],
                [
                    't_quote'   => 'Digital transformation seemed daunting until we partnered with them. Now our tech stack is future-proof, agile, and secure.',
                    't_name'    => 'Elena Rostova',
                    't_badge_1' => 'Tech adoption',
                    't_badge_2' => 'Agility',
                    't_photo'   => [ 'url' => 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&q=85&auto=format&fit=crop' ],
                ],
                [
                    't_quote'   => 'Unparalleled market research. We entered a new demographic with absolute confidence and immediately captured market share.',
                    't_name'    => 'Marcus Chen',
                    't_badge_1' => 'Market expansion',
                    't_badge_2' => 'Deep insights',
                    't_photo'   => [ 'url' => 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&q=85&auto=format&fit=crop' ],
                ],
                [
                    't_quote'   => 'Their team felt like an extension of ours. Dedicated, transparent, and ruthlessly focused on driving our revenue upwards.',
                    't_name'    => 'Amira Khalid',
                    't_badge_1' => 'Revenue growth',
                    't_badge_2' => 'Partnership',
                    't_photo'   => [ 'url' => 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=85&auto=format&fit=crop' ],
                ],
                [
                    't_quote'   => 'We redefined our core business model thanks to their consulting. The direct impact on our bottom line was evident by Q2.',
                    't_name'    => 'Thomas Wright',
                    't_badge_1' => 'Strategic pivot',
                    't_badge_2' => 'High ROI',
                    't_photo'   => [ 'url' => 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=85&auto=format&fit=crop' ],
                ],
            ],
        ] );

        $this->add_control( 'marquee_seconds', [
            'label'       => esc_html__( 'Loop duration (seconds)', 'tempaloo-studio' ),
            'description' => esc_html__( 'Total time for one full pass — slower = calmer feel.', 'tempaloo-studio' ),
            'type'        => Controls_Manager::NUMBER,
            'default'     => 50,
            'min'         => 15,
            'max'         => 120,
        ] );

        $this->end_controls_section();
    }

    /** Render five-pointed star SVGs based on the stars setting. */
    private function render_stars( int $count ): string {
        $count = max( 0, min( 5, $count ) );
        $out = '<div class="tw-avero-testimonials__stars" aria-label="' . esc_attr( sprintf( __( '%d out of 5 stars', 'tempaloo-studio' ), $count ) ) . '">';
        for ( $i = 0; $i < 5; $i++ ) {
            $cls = 'tw-avero-testimonials__star' . ( $i < $count ? '' : ' tw-avero-testimonials__star--empty' );
            $out .= '<svg class="' . esc_attr( $cls ) . '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
                  .   '<path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />'
                  . '</svg>';
        }
        $out .= '</div>';
        return $out;
    }

    protected function render(): void {
        $s        = $this->get_settings_for_display();
        $stars    = (int) ( $s['rating_stars'] ?? 5 );
        $rate_txt = $this->s( $s, 'rating_text' );
        $intro    = (string) ( $s['intro'] ?? '' );
        $items    = is_array( $s['items'] ?? null ) ? $s['items'] : [];
        $duration = (int) ( $s['marquee_seconds'] ?? 50 );

        // Convert author-typed newlines into <br> while keeping the
        // text safely escaped — wp_kses_post would let HTML through,
        // but for an editorial headline we just want line breaks.
        $intro_html = nl2br( esc_html( $intro ), false );
        ?>
        <section class="tw-avero-testimonials" data-tw-anim-scope="testimonials" data-tw-duration="<?php echo (int) $duration; ?>">
            <div class="tw-avero-testimonials__inner">

                <header class="tw-avero-testimonials__header">
                    <div class="tw-avero-testimonials__rating">
                        <?php echo $this->render_stars( $stars ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped — built from sanitized ints + esc_attr ?>
                        <?php if ( $rate_txt !== '' ) : ?>
                            <span class="tw-avero-testimonials__rating-text"><?php echo esc_html( $rate_txt ); ?></span>
                        <?php endif; ?>
                    </div>
                    <h2 class="tw-avero-testimonials__intro" data-tw-anim-target="intro"><?php echo $intro_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped — escaped above ?></h2>
                </header>

                <div class="tw-avero-testimonials__track-wrap" aria-roledescription="carousel" aria-label="<?php echo esc_attr__( 'Customer testimonials', 'tempaloo-studio' ); ?>">
                    <div class="tw-avero-testimonials__track">
                        <?php foreach ( $items as $i => $t ) : ?>
                            <article class="tw-avero-testimonials__item">
                                <p class="tw-avero-testimonials__quote">&ldquo;<?php echo esc_html( $t['t_quote'] ?? '' ); ?>&rdquo;</p>
                                <footer class="tw-avero-testimonials__author">
                                    <?php if ( ! empty( $t['t_photo']['url'] ) ) : ?>
                                        <img class="tw-avero-testimonials__avatar" src="<?php echo esc_url( $t['t_photo']['url'] ); ?>" alt="" width="56" height="56" loading="lazy" />
                                    <?php else : ?>
                                        <span class="tw-avero-testimonials__avatar tw-avero-testimonials__avatar--initial" aria-hidden="true">
                                            <?php echo esc_html( mb_substr( (string) ( $t['t_name'] ?? '?' ), 0, 1 ) ); ?>
                                        </span>
                                    <?php endif; ?>
                                    <div class="tw-avero-testimonials__meta">
                                        <span class="tw-avero-testimonials__name"><?php echo esc_html( $t['t_name'] ?? '' ); ?></span>
                                        <?php if ( ! empty( $t['t_badge_1'] ) || ! empty( $t['t_badge_2'] ) ) : ?>
                                            <div class="tw-avero-testimonials__badges">
                                                <?php if ( ! empty( $t['t_badge_1'] ) ) : ?>
                                                    <span class="tw-avero-testimonials__badge"><?php echo esc_html( $t['t_badge_1'] ); ?></span>
                                                <?php endif; ?>
                                                <?php if ( ! empty( $t['t_badge_2'] ) ) : ?>
                                                    <span class="tw-avero-testimonials__badge"><?php echo esc_html( $t['t_badge_2'] ); ?></span>
                                                <?php endif; ?>
                                            </div>
                                        <?php endif; ?>
                                    </div>
                                </footer>
                            </article>
                        <?php endforeach; ?>
                    </div>
                </div>

            </div>
        </section>
        <?php
    }

    protected function _content_template(): void {
        ?>
        <#
        var items = _.isArray(settings.items) ? settings.items : [];
        var stars = Math.max(0, Math.min(5, parseInt(settings.rating_stars || 5, 10)));
        var introHtml = (settings.intro || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
        #>
        <section class="tw-avero-testimonials">
            <div class="tw-avero-testimonials__inner">
                <header class="tw-avero-testimonials__header">
                    <div class="tw-avero-testimonials__rating">
                        <div class="tw-avero-testimonials__stars">
                            <# for (var s = 0; s < 5; s++) { #>
                                <svg class="tw-avero-testimonials__star {{ s < stars ? '' : 'tw-avero-testimonials__star--empty' }}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                                </svg>
                            <# } #>
                        </div>
                        <# if (settings.rating_text) { #><span class="tw-avero-testimonials__rating-text">{{ settings.rating_text }}</span><# } #>
                    </div>
                    <h2 class="tw-avero-testimonials__intro">{{{ introHtml }}}</h2>
                </header>
                <div class="tw-avero-testimonials__track-wrap">
                    <div class="tw-avero-testimonials__track">
                        <# _.each(items, function(t){ #>
                            <article class="tw-avero-testimonials__item">
                                <p class="tw-avero-testimonials__quote">&ldquo;{{ t.t_quote }}&rdquo;</p>
                                <footer class="tw-avero-testimonials__author">
                                    <# if (t.t_photo && t.t_photo.url) { #>
                                        <img class="tw-avero-testimonials__avatar" src="{{ t.t_photo.url }}" alt="" width="56" height="56" />
                                    <# } else { #>
                                        <span class="tw-avero-testimonials__avatar tw-avero-testimonials__avatar--initial">{{ (t.t_name || '?').charAt(0) }}</span>
                                    <# } #>
                                    <div class="tw-avero-testimonials__meta">
                                        <span class="tw-avero-testimonials__name">{{ t.t_name }}</span>
                                        <# if (t.t_badge_1 || t.t_badge_2) { #>
                                            <div class="tw-avero-testimonials__badges">
                                                <# if (t.t_badge_1) { #><span class="tw-avero-testimonials__badge">{{ t.t_badge_1 }}</span><# } #>
                                                <# if (t.t_badge_2) { #><span class="tw-avero-testimonials__badge">{{ t.t_badge_2 }}</span><# } #>
                                            </div>
                                        <# } #>
                                    </div>
                                </footer>
                            </article>
                        <# }); #>
                    </div>
                </div>
            </div>
        </section>
        <?php
    }
}
