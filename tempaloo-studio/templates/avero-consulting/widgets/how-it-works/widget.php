<?php
/**
 * Avero Consulting — How it works widget
 *
 * Process timeline with N steps, central vertical guide line that
 * fills as the user scrolls, and per-step reveal (marker pop +
 * content/media slide-in). Concept lifted from
 * exemples/index.html (the "A proven process" section) and
 * reskinned with the avero --tw-* tokens.
 *
 * @package Tempaloo\Studio\Templates\Avero_Consulting
 */

namespace Tempaloo\Studio\Templates\Avero_Consulting;

defined( 'ABSPATH' ) || exit;

use Elementor\Controls_Manager;
use Elementor\Repeater;
use Tempaloo\Studio\Elementor\Widget_Base;

class How_It_Works extends Widget_Base {

    public function get_name(): string          { return 'how-it-works'; }
    public function get_title(): string         { return esc_html__( 'Avero — How it works', 'tempaloo-studio' ); }
    public function get_icon(): string          { return 'eicon-time-line'; }
    public function get_template_slug(): string { return 'avero-consulting'; }

    protected function register_controls(): void {

        /* ── Header ──────────────────────────────────────────── */
        $this->start_controls_section( 'section_header', [
            'label' => esc_html__( 'Header', 'tempaloo-studio' ),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $this->add_control( 'eyebrow', [
            'label'   => esc_html__( 'Eyebrow', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXT,
            'default' => 'How it works',
        ] );

        $this->add_control( 'title', [
            'label'       => esc_html__( 'Title', 'tempaloo-studio' ),
            'type'        => Controls_Manager::TEXTAREA,
            'default'     => "A proven process to achieve\nyour biggest goals",
            'description' => esc_html__( 'Newlines render as <br>.', 'tempaloo-studio' ),
        ] );

        $this->add_control( 'cta_text', [
            'label'   => esc_html__( 'CTA label', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXT,
            'default' => 'Get in touch',
        ] );

        $this->add_control( 'cta_url', [
            'label'   => esc_html__( 'CTA link', 'tempaloo-studio' ),
            'type'    => Controls_Manager::URL,
            'default' => [ 'url' => '#contact', 'is_external' => false, 'nofollow' => false ],
        ] );

        $this->end_controls_section();

        /* ── Steps (repeater) ────────────────────────────────── */
        $this->start_controls_section( 'section_items', [
            'label' => esc_html__( 'Steps', 'tempaloo-studio' ),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $rep = new Repeater();
        $rep->add_control( 'i_marker', [
            'label'   => esc_html__( 'Marker (e.g. 01)', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXT,
            'default' => '01',
        ] );
        $rep->add_control( 'i_title', [
            'label'   => esc_html__( 'Step title', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXT,
            'default' => 'Simple Booking',
        ] );
        $rep->add_control( 'i_desc', [
            'label'   => esc_html__( 'Description', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXTAREA,
            'default' => 'Effortlessly schedule a consultation to discuss your business needs and challenges. We streamline the process to get started quickly.',
        ] );
        $rep->add_control( 'i_link_text', [
            'label'   => esc_html__( 'Link label', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXT,
            'default' => 'Discover More',
        ] );
        $rep->add_control( 'i_link_url', [
            'label'   => esc_html__( 'Link URL', 'tempaloo-studio' ),
            'type'    => Controls_Manager::URL,
            'default' => [ 'url' => '#', 'is_external' => false, 'nofollow' => false ],
        ] );
        $rep->add_control( 'i_image', [
            'label'   => esc_html__( 'Image', 'tempaloo-studio' ),
            'type'    => Controls_Manager::MEDIA,
            'default' => [ 'url' => '' ],
        ] );

        $this->add_control( 'items', [
            'label'       => esc_html__( 'Steps', 'tempaloo-studio' ),
            'type'        => Controls_Manager::REPEATER,
            'fields'      => $rep->get_controls(),
            'title_field' => '{{{ i_marker }}} — {{{ i_title }}}',
            'default'     => [
                [ 'i_marker' => '01', 'i_title' => 'Simple Booking',     'i_desc' => 'Effortlessly schedule a consultation to discuss your business needs and challenges. We streamline the process to get started quickly.', 'i_link_text' => 'Discover More' ],
                [ 'i_marker' => '02', 'i_title' => 'Tailored Strategy',  'i_desc' => 'We analyze your goals and create a customized strategy designed to drive measurable success for your business needs.',                  'i_link_text' => 'Discover More' ],
                [ 'i_marker' => '03', 'i_title' => 'Continuous Support', 'i_desc' => 'From implementation to optimization, we provide ongoing guidance and adjustments to ensure long-term growth for your business.',          'i_link_text' => 'Discover More' ],
            ],
        ] );

        $this->end_controls_section();
    }

    protected function render(): void {
        $s         = $this->get_settings_for_display();
        $eyebrow   = $this->s( $s, 'eyebrow' );
        $title     = (string) ( $s['title'] ?? '' );
        $cta_text  = $this->s( $s, 'cta_text' );
        $cta_url   = $s['cta_url'] ?? [ 'url' => '' ];
        $items     = is_array( $s['items'] ?? null ) ? $s['items'] : [];

        $title_html = nl2br( esc_html( $title ), false );

        $cta_attrs = '';
        if ( ! empty( $cta_url['is_external'] ) ) $cta_attrs .= ' target="_blank" rel="noopener"';
        if ( ! empty( $cta_url['nofollow'] ) )   $cta_attrs .= ' rel="nofollow"';
        ?>
        <section class="tw-avero-how-it-works" data-tw-anim-scope="how_it_works">
            <div class="tw-avero-how-it-works__inner">

                <header class="tw-avero-how-it-works__header">
                    <?php if ( $eyebrow !== '' ) : ?>
                        <span class="tw-avero-how-it-works__eyebrow">
                            <span class="tw-avero-how-it-works__eyebrow-dot" aria-hidden="true"></span>
                            <?php echo esc_html( $eyebrow ); ?>
                        </span>
                    <?php endif; ?>
                    <h2 class="tw-avero-how-it-works__title" data-tw-anim-target="title"><?php echo $title_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped — escaped via esc_html + nl2br ?></h2>
                    <?php if ( $cta_text !== '' && ! empty( $cta_url['url'] ) ) : ?>
                        <a class="tw-avero-how-it-works__cta" href="<?php echo esc_url( $cta_url['url'] ); ?>"<?php echo $cta_attrs; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped — built from booleans ?>>
                            <span><?php echo esc_html( $cta_text ); ?></span>
                            <span class="tw-avero-how-it-works__cta-arrow" aria-hidden="true">→</span>
                        </a>
                    <?php endif; ?>
                </header>

                <div class="tw-avero-how-it-works__timeline">
                    <span class="tw-avero-how-it-works__line-active" aria-hidden="true"></span>

                    <?php foreach ( $items as $i => $it ) :
                        $reverse   = ( (int) $i % 2 === 1 ); // alternate sides
                        $link_url  = $it['i_link_url']['url'] ?? '#';
                        $link_attr = '';
                        if ( ! empty( $it['i_link_url']['is_external'] ) ) $link_attr .= ' target="_blank" rel="noopener"';
                        if ( ! empty( $it['i_link_url']['nofollow'] ) )   $link_attr .= ' rel="nofollow"';
                    ?>
                        <article class="tw-avero-how-it-works__item<?php echo $reverse ? ' tw-avero-how-it-works__item--reverse' : ''; ?>">
                            <div class="tw-avero-how-it-works__item-media">
                                <div class="tw-avero-how-it-works__image-box">
                                    <?php if ( ! empty( $it['i_image']['url'] ) ) : ?>
                                        <img class="tw-avero-how-it-works__image" src="<?php echo esc_url( $it['i_image']['url'] ); ?>" alt="<?php echo esc_attr( $it['i_title'] ?? '' ); ?>" loading="lazy" />
                                    <?php endif; ?>
                                </div>
                            </div>
                            <div class="tw-avero-how-it-works__item-marker" aria-hidden="true"><?php echo esc_html( $it['i_marker'] ?? '' ); ?></div>
                            <div class="tw-avero-how-it-works__item-content">
                                <h3 class="tw-avero-how-it-works__item-title"><?php echo esc_html( $it['i_title'] ?? '' ); ?></h3>
                                <p class="tw-avero-how-it-works__item-desc"><?php echo esc_html( $it['i_desc'] ?? '' ); ?></p>
                                <?php if ( ! empty( $it['i_link_text'] ) ) : ?>
                                    <a class="tw-avero-how-it-works__link" href="<?php echo esc_url( $link_url ); ?>"<?php echo $link_attr; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped — built from booleans ?>>
                                        <span><?php echo esc_html( $it['i_link_text'] ); ?></span>
                                        <span class="tw-avero-how-it-works__link-icon" aria-hidden="true">→</span>
                                    </a>
                                <?php endif; ?>
                            </div>
                        </article>
                    <?php endforeach; ?>
                </div>
            </div>
        </section>
        <?php
    }

    protected function _content_template(): void {
        ?>
        <#
        var items = _.isArray(settings.items) ? settings.items : [];
        var titleHtml = (settings.title || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
        #>
        <section class="tw-avero-how-it-works">
            <div class="tw-avero-how-it-works__inner">
                <header class="tw-avero-how-it-works__header">
                    <# if (settings.eyebrow) { #>
                        <span class="tw-avero-how-it-works__eyebrow">
                            <span class="tw-avero-how-it-works__eyebrow-dot"></span>
                            {{ settings.eyebrow }}
                        </span>
                    <# } #>
                    <h2 class="tw-avero-how-it-works__title">{{{ titleHtml }}}</h2>
                    <# if (settings.cta_text && settings.cta_url && settings.cta_url.url) { #>
                        <a class="tw-avero-how-it-works__cta" href="{{ settings.cta_url.url }}">
                            <span>{{ settings.cta_text }}</span>
                            <span class="tw-avero-how-it-works__cta-arrow">→</span>
                        </a>
                    <# } #>
                </header>
                <div class="tw-avero-how-it-works__timeline">
                    <span class="tw-avero-how-it-works__line-active"></span>
                    <# _.each(items, function(it, i){ var reverse = (i % 2) === 1; #>
                        <article class="tw-avero-how-it-works__item {{ reverse ? 'tw-avero-how-it-works__item--reverse' : '' }}">
                            <div class="tw-avero-how-it-works__item-media">
                                <div class="tw-avero-how-it-works__image-box">
                                    <# if (it.i_image && it.i_image.url) { #>
                                        <img class="tw-avero-how-it-works__image" src="{{ it.i_image.url }}" alt="{{ it.i_title }}" />
                                    <# } #>
                                </div>
                            </div>
                            <div class="tw-avero-how-it-works__item-marker">{{ it.i_marker }}</div>
                            <div class="tw-avero-how-it-works__item-content">
                                <h3 class="tw-avero-how-it-works__item-title">{{ it.i_title }}</h3>
                                <p class="tw-avero-how-it-works__item-desc">{{ it.i_desc }}</p>
                                <# if (it.i_link_text) { #>
                                    <a class="tw-avero-how-it-works__link" href="{{ it.i_link_url ? it.i_link_url.url : '#' }}">
                                        <span>{{ it.i_link_text }}</span>
                                        <span class="tw-avero-how-it-works__link-icon">→</span>
                                    </a>
                                <# } #>
                            </div>
                        </article>
                    <# }); #>
                </div>
            </div>
        </section>
        <?php
    }
}
