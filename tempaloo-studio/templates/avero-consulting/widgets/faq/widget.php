<?php
/**
 * Avero Consulting — FAQ widget
 *
 * Accordion list. Smooth height transition via CSS Grid trick
 * (grid-template-rows 0fr → 1fr).
 *
 * @package Tempaloo\Studio\Templates\Avero_Consulting
 */

namespace Tempaloo\Studio\Templates\Avero_Consulting;

defined( 'ABSPATH' ) || exit;

use Elementor\Controls_Manager;
use Elementor\Repeater;
use Tempaloo\Studio\Elementor\Widget_Base;

class Faq extends Widget_Base {

    public function get_name(): string         { return 'faq'; }
    public function get_title(): string        { return esc_html__( 'Avero — FAQ', 'tempaloo-studio' ); }
    public function get_icon(): string         { return 'eicon-help-o'; }
    public function get_template_slug(): string { return 'avero-consulting'; }

    protected function register_controls(): void {
        $this->start_controls_section( 'section_intro', [
            'label' => esc_html__( 'Intro', 'tempaloo-studio' ),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $this->add_control( 'eyebrow', [ 'label' => esc_html__( 'Eyebrow', 'tempaloo-studio' ), 'type' => Controls_Manager::TEXT, 'default' => 'Common questions' ] );
        $this->add_control( 'title',   [ 'label' => esc_html__( 'Title',   'tempaloo-studio' ), 'type' => Controls_Manager::TEXTAREA, 'default' => "Things founders ask\nbefore they <em>commit</em>." ] );
        $this->add_control( 'lead',    [ 'label' => esc_html__( 'Lead',    'tempaloo-studio' ), 'type' => Controls_Manager::TEXTAREA, 'default' => "If your question isn't here, the fastest way to get an answer is a 20-minute call." ] );

        $this->end_controls_section();

        $this->start_controls_section( 'section_items', [
            'label' => esc_html__( 'Questions', 'tempaloo-studio' ),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $rep = new Repeater();
        $rep->add_control( 'q', [ 'label' => esc_html__( 'Question', 'tempaloo-studio' ), 'type' => Controls_Manager::TEXT, 'default' => 'How long is a typical engagement?' ] );
        $rep->add_control( 'a', [ 'label' => esc_html__( 'Answer',   'tempaloo-studio' ), 'type' => Controls_Manager::TEXTAREA, 'default' => 'Two weeks for a Starter sprint, three to twelve months for Growth retainers, twelve months minimum for Scale. We don\'t do open-ended retainers — every engagement has a defined end-state.' ] );

        $this->add_control( 'items', [
            'label'       => esc_html__( 'Items', 'tempaloo-studio' ),
            'type'        => Controls_Manager::REPEATER,
            'fields'      => $rep->get_controls(),
            'title_field' => '{{{ q }}}',
            'default' => [
                [ 'q' => 'How long is a typical engagement?',                  'a' => 'Two weeks for a Starter sprint, three to twelve months for Growth retainers, twelve months minimum for Scale. We don\'t do open-ended retainers.' ],
                [ 'q' => 'Do you only work with venture-backed companies?',    'a' => 'No. We work with profitable bootstrapped teams just as often. What matters is whether there\'s a clear next-12-months goal worth investing in.' ],
                [ 'q' => 'What\'s the smallest engagement you\'ll take on?',   'a' => 'The Starter sprint at €4.5k. It\'s deliberately scoped so you can decide whether to keep working with us with low risk on either side.' ],
                [ 'q' => 'Can you co-work with our existing agency or team?',  'a' => 'Yes. Most of our work is done alongside in-house teams or specialist agencies. We\'re upstream from execution, not in competition with it.' ],
                [ 'q' => 'How do you measure success?',                        'a' => 'We agree on 2–3 numbers in week one and track them weekly. Vanity metrics are out. Pipeline, payback period, and retention are usually in.' ],
            ],
        ] );

        $this->add_control( 'expand_first', [
            'label' => esc_html__( 'Expand first item by default', 'tempaloo-studio' ),
            'type'  => Controls_Manager::SWITCHER,
            'default' => 'yes', 'return_value' => 'yes',
        ] );

        $this->end_controls_section();
    }

    protected function render(): void {
        $s = $this->get_settings_for_display();
        $items = is_array( $s['items'] ?? null ) ? $s['items'] : [];
        $expand_first = ! empty( $s['expand_first'] ) && $s['expand_first'] === 'yes';
        ?>
        <section class="tw-avero-faq" data-tw-anim-scope="faq">
            <div class="tw-avero-faq__container">

                <header class="tw-avero-faq__intro" data-tw-anim-target>
                    <?php if ( ! empty( $s['eyebrow'] ) ) : ?>
                        <span class="tw-avero-faq__eyebrow"><?php echo esc_html( $s['eyebrow'] ); ?></span>
                    <?php endif; ?>
                    <h2 class="tw-avero-faq__title"><?php
                        echo wp_kses( nl2br( (string) $s['title'], false ), [ 'em' => [], 'br' => [] ] );
                    ?></h2>
                    <?php if ( ! empty( $s['lead'] ) ) : ?>
                        <p class="tw-avero-faq__lead"><?php echo wp_kses_post( $s['lead'] ); ?></p>
                    <?php endif; ?>
                </header>

                <ul class="tw-avero-faq__list" role="list" data-tw-anim-target>
                    <?php foreach ( $items as $i => $it ) :
                        $open = $expand_first && $i === 0;
                    ?>
                        <li class="tw-avero-faq__item <?php echo $open ? 'is-open' : ''; ?>">
                            <button type="button" class="tw-avero-faq__q" aria-expanded="<?php echo $open ? 'true' : 'false'; ?>">
                                <span><?php echo esc_html( $it['q'] ?? '' ); ?></span>
                                <svg class="tw-avero-faq__chevron" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <path d="M3 6l5 5 5-5"/>
                                </svg>
                            </button>
                            <div class="tw-avero-faq__a-wrap">
                                <div class="tw-avero-faq__a">
                                    <?php echo wp_kses_post( $it['a'] ?? '' ); ?>
                                </div>
                            </div>
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
            .replace(/&lt;em&gt;/g, '<em>').replace(/&lt;\/em&gt;/g, '</em>').replace(/\n/g, '<br>');
        var items = _.isArray(settings.items) ? settings.items : [];
        var expandFirst = settings.expand_first === 'yes';
        #>
        <section class="tw-avero-faq">
            <div class="tw-avero-faq__container">
                <header class="tw-avero-faq__intro">
                    <# if (settings.eyebrow) { #><span class="tw-avero-faq__eyebrow">{{ settings.eyebrow }}</span><# } #>
                    <h2 class="tw-avero-faq__title">{{{ safeTitle }}}</h2>
                    <# if (settings.lead) { #><p class="tw-avero-faq__lead">{{{ settings.lead }}}</p><# } #>
                </header>
                <ul class="tw-avero-faq__list">
                    <# _.each(items, function(it, i){ var open = expandFirst && i === 0; #>
                        <li class="tw-avero-faq__item {{ open ? 'is-open' : '' }}">
                            <button type="button" class="tw-avero-faq__q"><span>{{ it.q }}</span></button>
                            <div class="tw-avero-faq__a-wrap"><div class="tw-avero-faq__a">{{{ it.a }}}</div></div>
                        </li>
                    <# }); #>
                </ul>
            </div>
        </section>
        <?php
    }
}
