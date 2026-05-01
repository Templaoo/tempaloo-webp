<?php
/**
 * Avero Consulting — Services widget
 *
 * Editorial intro (eyebrow + H2 + lead) followed by a row of service
 * cards. Cards stagger in via GSAP ScrollTrigger when entering view.
 *
 * @package Tempaloo\Studio\Templates\Avero_Consulting
 */

namespace Tempaloo\Studio\Templates\Avero_Consulting;

defined( 'ABSPATH' ) || exit;

use Elementor\Controls_Manager;
use Elementor\Repeater;
use Tempaloo\Studio\Elementor\Widget_Base;

class Services extends Widget_Base {

    public function get_name(): string         { return 'services'; }
    public function get_title(): string        { return esc_html__( 'Avero — Services', 'tempaloo-studio' ); }
    public function get_icon(): string         { return 'eicon-info-box'; }
    public function get_template_slug(): string { return 'avero-consulting'; }

    protected function register_controls(): void {

        $this->start_controls_section( 'section_intro', [
            'label' => esc_html__( 'Intro', 'tempaloo-studio' ),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $this->add_control( 'eyebrow', [
            'label'   => esc_html__( 'Eyebrow', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXT,
            'default' => 'What we do',
        ] );

        $this->add_control( 'title', [
            'label'   => esc_html__( 'Title', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXTAREA,
            'default' => "Three disciplines.\nOne objective: <em>compounding growth</em>.",
        ] );

        $this->add_control( 'lead', [
            'label'   => esc_html__( 'Lead', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXTAREA,
            'default' => 'Strategy without execution is theory. Execution without strategy is busywork. We do both, and we do them in lockstep with your team.',
        ] );

        $this->end_controls_section();

        $this->start_controls_section( 'section_items', [
            'label' => esc_html__( 'Services', 'tempaloo-studio' ),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $rep = new Repeater();
        $rep->add_control( 'svc_icon', [
            'label'       => esc_html__( 'Icon', 'tempaloo-studio' ),
            'type'        => Controls_Manager::ICONS,
            'default'     => [ 'value' => 'eicon-info-box', 'library' => 'eicons' ],
        ] );
        $rep->add_control( 'svc_title', [
            'label'   => esc_html__( 'Title', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXT,
            'default' => 'Growth strategy',
        ] );
        $rep->add_control( 'svc_desc', [
            'label'   => esc_html__( 'Description', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXTAREA,
            'default' => 'Position, price, and play. We work backwards from a number you trust to a plan you can execute Monday morning.',
        ] );
        $rep->add_control( 'svc_link_text', [
            'label'   => esc_html__( 'Link text', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXT,
            'default' => 'See engagement',
        ] );
        $rep->add_control( 'svc_link_url', [
            'label'   => esc_html__( 'Link URL', 'tempaloo-studio' ),
            'type'    => Controls_Manager::URL,
            'default' => [ 'url' => '#' ],
        ] );

        // Defaults reference eicons confirmed to ship with Elementor's
        // free icon font (eicon-strategy, used previously, doesn't
        // exist → empty squares).
        $this->add_control( 'services', [
            'label'       => esc_html__( 'Items', 'tempaloo-studio' ),
            'type'        => Controls_Manager::REPEATER,
            'fields'      => $rep->get_controls(),
            'title_field' => '{{{ svc_title }}}',
            'default'     => [
                [ 'svc_icon' => [ 'value' => 'eicon-info-box',       'library' => 'eicons' ], 'svc_title' => 'Growth strategy',   'svc_desc' => 'Position, price, and play. We work backwards from a number you trust to a plan you can execute Monday morning.', 'svc_link_text' => 'See engagement', 'svc_link_url' => [ 'url' => '#' ] ],
                [ 'svc_icon' => [ 'value' => 'eicon-text-area',      'library' => 'eicons' ], 'svc_title' => 'Brand & narrative', 'svc_desc' => 'A story that compounds. Verbal and visual identity that earns attention without buying it.',                       'svc_link_text' => 'See engagement', 'svc_link_url' => [ 'url' => '#' ] ],
                [ 'svc_icon' => [ 'value' => 'eicon-call-to-action', 'library' => 'eicons' ], 'svc_title' => 'Demand engine',     'svc_desc' => 'Channels that pay back. We design the funnel, then ship the ads, content, and ops to feed it.',                  'svc_link_text' => 'See engagement', 'svc_link_url' => [ 'url' => '#' ] ],
            ],
        ] );

        $this->end_controls_section();
    }

    protected function render(): void {
        $s        = $this->get_settings_for_display();
        $eyebrow  = $this->s( $s, 'eyebrow' );
        $title    = $this->s( $s, 'title' );
        $lead     = $this->s( $s, 'lead' );
        $services = is_array( $s['services'] ?? null ) ? $s['services'] : [];
        ?>
        <section class="tw-avero-services" data-tw-anim-scope="services">
            <div class="tw-avero-services__container">

                <header class="tw-avero-services__intro" data-tw-anim-target>
                    <?php if ( $eyebrow !== '' ) : ?>
                        <span class="tw-avero-services__eyebrow"><?php echo esc_html( $eyebrow ); ?></span>
                    <?php endif; ?>
                    <h2 class="tw-avero-services__title"><?php
                        echo wp_kses(
                            nl2br( $title, false ),
                            [ 'em' => [], 'br' => [] ]
                        );
                    ?></h2>
                    <?php if ( $lead !== '' ) : ?>
                        <p class="tw-avero-services__lead"><?php echo wp_kses_post( $lead ); ?></p>
                    <?php endif; ?>
                </header>

                <ul class="tw-avero-services__grid" role="list">
                    <?php foreach ( $services as $i => $svc ) : ?>
                        <li class="tw-avero-services__card" data-tw-i="<?php echo (int) $i; ?>" data-tw-anim-target>
                            <span class="tw-avero-services__num">0<?php echo (int) ( $i + 1 ); ?></span>

                            <span class="tw-avero-services__icon" aria-hidden="true">
                                <?php
                                if ( ! empty( $svc['svc_icon']['value'] ) ) {
                                    \Elementor\Icons_Manager::render_icon( $svc['svc_icon'], [ 'aria-hidden' => 'true' ] );
                                }
                                ?>
                            </span>

                            <h3 class="tw-avero-services__name"><?php echo esc_html( $svc['svc_title'] ?? '' ); ?></h3>
                            <p class="tw-avero-services__desc"><?php echo wp_kses_post( $svc['svc_desc'] ?? '' ); ?></p>

                            <?php if ( ! empty( $svc['svc_link_text'] ) ) : ?>
                                <a class="tw-avero-services__link" href="<?php echo esc_url( $svc['svc_link_url']['url'] ?? '#' ); ?>">
                                    <?php echo esc_html( $svc['svc_link_text'] ); ?>
                                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                        <path d="M3 8h10M9 4l4 4-4 4" />
                                    </svg>
                                </a>
                            <?php endif; ?>
                        </li>
                    <?php endforeach; ?>
                </ul>

            </div>
        </section>
        <?php
    }

    protected function _content_template(): void {
        ?>
        <#
        var safeTitle = _.escape(settings.title || '')
            .replace(/&lt;em&gt;/g, '<em>')
            .replace(/&lt;\/em&gt;/g, '</em>')
            .replace(/\n/g, '<br>');
        var services = _.isArray(settings.services) ? settings.services : [];
        #>
        <section class="tw-avero-services">
            <div class="tw-avero-services__container">
                <header class="tw-avero-services__intro">
                    <# if ( settings.eyebrow ) { #><span class="tw-avero-services__eyebrow">{{ settings.eyebrow }}</span><# } #>
                    <h2 class="tw-avero-services__title">{{{ safeTitle }}}</h2>
                    <# if ( settings.lead ) { #><p class="tw-avero-services__lead">{{{ settings.lead }}}</p><# } #>
                </header>
                <ul class="tw-avero-services__grid">
                    <# _.each(services, function(svc, i){ #>
                        <li class="tw-avero-services__card">
                            <span class="tw-avero-services__num">0{{ i + 1 }}</span>
                            <h3 class="tw-avero-services__name">{{ svc.svc_title }}</h3>
                            <p class="tw-avero-services__desc">{{{ svc.svc_desc }}}</p>
                            <# if ( svc.svc_link_text ) { var url = (svc.svc_link_url && svc.svc_link_url.url) || '#'; #>
                                <a class="tw-avero-services__link" href="{{ url }}">{{ svc.svc_link_text }}</a>
                            <# } #>
                        </li>
                    <# }); #>
                </ul>
            </div>
        </section>
        <?php
    }
}
