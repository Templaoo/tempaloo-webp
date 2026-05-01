<?php
/**
 * Avero Consulting — Pricing widget
 *
 * Editorial intro + 3 tier cards with optional "featured" emphasis.
 *
 * @package Tempaloo\Studio\Templates\Avero_Consulting
 */

namespace Tempaloo\Studio\Templates\Avero_Consulting;

defined( 'ABSPATH' ) || exit;

use Elementor\Controls_Manager;
use Elementor\Repeater;
use Tempaloo\Studio\Elementor\Widget_Base;

class Pricing extends Widget_Base {

    public function get_name(): string         { return 'pricing'; }
    public function get_title(): string        { return esc_html__( 'Avero — Pricing', 'tempaloo-studio' ); }
    public function get_icon(): string         { return 'eicon-price-table'; }
    public function get_template_slug(): string { return 'avero-consulting'; }

    protected function register_controls(): void {

        $this->start_controls_section( 'section_intro', [
            'label' => esc_html__( 'Intro', 'tempaloo-studio' ),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $this->add_control( 'eyebrow', [
            'label'   => esc_html__( 'Eyebrow', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXT,
            'default' => 'Engagement models',
        ] );
        $this->add_control( 'title', [
            'label'   => esc_html__( 'Title', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXTAREA,
            'default' => "Predictable pricing.\nOutcomes you can <em>actually</em> bank on.",
        ] );
        $this->add_control( 'lead', [
            'label'   => esc_html__( 'Lead', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXTAREA,
            'default' => 'No vague retainers, no scope creep. Pick the engagement that fits where you are, not where a deck thinks you should be.',
        ] );

        $this->end_controls_section();

        $this->start_controls_section( 'section_tiers', [
            'label' => esc_html__( 'Tiers', 'tempaloo-studio' ),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $rep = new Repeater();
        $rep->add_control( 'tier_name', [
            'label' => esc_html__( 'Tier name', 'tempaloo-studio' ), 'type' => Controls_Manager::TEXT, 'default' => 'Starter',
        ] );
        $rep->add_control( 'tier_price', [
            'label' => esc_html__( 'Price', 'tempaloo-studio' ), 'type' => Controls_Manager::TEXT, 'default' => '€4.5k',
        ] );
        $rep->add_control( 'tier_suffix', [
            'label' => esc_html__( 'Price suffix', 'tempaloo-studio' ), 'type' => Controls_Manager::TEXT, 'default' => 'one-time',
        ] );
        $rep->add_control( 'tier_desc', [
            'label' => esc_html__( 'Tagline', 'tempaloo-studio' ), 'type' => Controls_Manager::TEXTAREA, 'default' => 'A focused 2-week sprint to surface your highest-leverage move.',
        ] );
        $rep->add_control( 'tier_features', [
            'label' => esc_html__( 'Features (one per line)', 'tempaloo-studio' ), 'type' => Controls_Manager::TEXTAREA,
            'default' => "Discovery + audit\nCompetitive teardown\nGrowth thesis doc\n90-day roadmap\n1 working session",
        ] );
        $rep->add_control( 'tier_cta_text', [
            'label' => esc_html__( 'CTA text', 'tempaloo-studio' ), 'type' => Controls_Manager::TEXT, 'default' => 'Book intro call',
        ] );
        $rep->add_control( 'tier_cta_url', [
            'label' => esc_html__( 'CTA link', 'tempaloo-studio' ), 'type' => Controls_Manager::URL, 'default' => [ 'url' => '#contact' ],
        ] );
        $rep->add_control( 'tier_featured', [
            'label' => esc_html__( 'Mark as featured', 'tempaloo-studio' ), 'type' => Controls_Manager::SWITCHER, 'return_value' => 'yes', 'default' => '',
        ] );
        $rep->add_control( 'tier_badge', [
            'label' => esc_html__( 'Featured badge', 'tempaloo-studio' ), 'type' => Controls_Manager::TEXT, 'default' => 'Most chosen',
            'condition' => [ 'tier_featured' => 'yes' ],
        ] );

        $this->add_control( 'tiers', [
            'label'       => esc_html__( 'Tiers', 'tempaloo-studio' ),
            'type'        => Controls_Manager::REPEATER,
            'fields'      => $rep->get_controls(),
            'title_field' => '{{{ tier_name }}}',
            'default'     => [
                [ 'tier_name' => 'Starter', 'tier_price' => '€4.5k', 'tier_suffix' => 'one-time', 'tier_desc' => 'A focused 2-week sprint to surface your highest-leverage move.', 'tier_features' => "Discovery + audit\nCompetitive teardown\nGrowth thesis doc\n90-day roadmap\n1 working session", 'tier_cta_text' => 'Book intro call' ],
                [ 'tier_name' => 'Growth',  'tier_price' => '€12k',  'tier_suffix' => '/ month',   'tier_desc' => 'Ongoing strategy + execution support for serious founder-led teams.',     'tier_features' => "Everything in Starter\nWeekly working sessions\nMonthly board memo\nUnblocked Slack access\n2 quarterly priorities", 'tier_cta_text' => 'See if we fit', 'tier_featured' => 'yes', 'tier_badge' => 'Most chosen' ],
                [ 'tier_name' => 'Scale',   'tier_price' => '€28k',  'tier_suffix' => '/ month',   'tier_desc' => 'Embedded operating partner for the high-stakes 12-month window.',         'tier_features' => "Everything in Growth\nFractional Head of Strategy\nDirect access to senior partners\nBoard prep + investor decks\nUnlimited working sessions", 'tier_cta_text' => 'Talk to a partner' ],
            ],
        ] );

        $this->end_controls_section();
    }

    protected function render(): void {
        $s       = $this->get_settings_for_display();
        $eyebrow = $this->s( $s, 'eyebrow' );
        $title   = $this->s( $s, 'title' );
        $lead    = $this->s( $s, 'lead' );
        $tiers   = is_array( $s['tiers'] ?? null ) ? $s['tiers'] : [];
        ?>
        <section class="tw-avero-pricing" data-tw-anim-scope="pricing">
            <div class="tw-avero-pricing__container">

                <header class="tw-avero-pricing__intro" data-tw-anim-target>
                    <?php if ( $eyebrow !== '' ) : ?>
                        <span class="tw-avero-pricing__eyebrow"><?php echo esc_html( $eyebrow ); ?></span>
                    <?php endif; ?>
                    <h2 class="tw-avero-pricing__title"><?php
                        echo wp_kses( nl2br( $title, false ), [ 'em' => [], 'br' => [] ] );
                    ?></h2>
                    <?php if ( $lead !== '' ) : ?>
                        <p class="tw-avero-pricing__lead"><?php echo wp_kses_post( $lead ); ?></p>
                    <?php endif; ?>
                </header>

                <div class="tw-avero-pricing__grid">
                    <?php foreach ( $tiers as $tier ) :
                        $is_featured = ! empty( $tier['tier_featured'] ) && $tier['tier_featured'] === 'yes';
                        $features    = preg_split( "/\r\n|\r|\n/", (string) ( $tier['tier_features'] ?? '' ) );
                        $features    = array_filter( array_map( 'trim', $features ) );
                    ?>
                        <article class="tw-avero-pricing__tier <?php echo $is_featured ? 'tw-avero-pricing__tier--featured' : ''; ?>" data-tw-anim-target>
                            <?php if ( $is_featured && ! empty( $tier['tier_badge'] ) ) : ?>
                                <span class="tw-avero-pricing__badge"><?php echo esc_html( $tier['tier_badge'] ); ?></span>
                            <?php endif; ?>

                            <h3 class="tw-avero-pricing__tier-name"><?php echo esc_html( $tier['tier_name'] ?? '' ); ?></h3>

                            <div class="tw-avero-pricing__price">
                                <span class="tw-avero-pricing__price-amount"><?php echo esc_html( $tier['tier_price'] ?? '' ); ?></span>
                                <?php if ( ! empty( $tier['tier_suffix'] ) ) : ?>
                                    <span class="tw-avero-pricing__price-suffix"><?php echo esc_html( $tier['tier_suffix'] ); ?></span>
                                <?php endif; ?>
                            </div>

                            <?php if ( ! empty( $tier['tier_desc'] ) ) : ?>
                                <p class="tw-avero-pricing__tier-desc"><?php echo wp_kses_post( $tier['tier_desc'] ); ?></p>
                            <?php endif; ?>

                            <ul class="tw-avero-pricing__features" role="list">
                                <?php foreach ( $features as $f ) : ?>
                                    <li>
                                        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3 3 7-7"/></svg>
                                        <span><?php echo esc_html( $f ); ?></span>
                                    </li>
                                <?php endforeach; ?>
                            </ul>

                            <?php if ( ! empty( $tier['tier_cta_text'] ) ) : ?>
                                <a class="tw-avero-pricing__cta" href="<?php echo esc_url( $tier['tier_cta_url']['url'] ?? '#' ); ?>">
                                    <?php echo esc_html( $tier['tier_cta_text'] ); ?>
                                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                                </a>
                            <?php endif; ?>
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
        var safeTitle = _.escape(settings.title || '')
            .replace(/&lt;em&gt;/g, '<em>')
            .replace(/&lt;\/em&gt;/g, '</em>')
            .replace(/\n/g, '<br>');
        var tiers = _.isArray(settings.tiers) ? settings.tiers : [];
        #>
        <section class="tw-avero-pricing">
            <div class="tw-avero-pricing__container">
                <header class="tw-avero-pricing__intro">
                    <# if (settings.eyebrow) { #><span class="tw-avero-pricing__eyebrow">{{ settings.eyebrow }}</span><# } #>
                    <h2 class="tw-avero-pricing__title">{{{ safeTitle }}}</h2>
                    <# if (settings.lead) { #><p class="tw-avero-pricing__lead">{{{ settings.lead }}}</p><# } #>
                </header>
                <div class="tw-avero-pricing__grid">
                    <# _.each(tiers, function(t){
                        var feat = t.tier_featured === 'yes';
                        var features = (t.tier_features || '').split(/\r\n|\r|\n/).filter(Boolean);
                    #>
                        <article class="tw-avero-pricing__tier {{ feat ? 'tw-avero-pricing__tier--featured' : '' }}">
                            <# if (feat && t.tier_badge) { #><span class="tw-avero-pricing__badge">{{ t.tier_badge }}</span><# } #>
                            <h3 class="tw-avero-pricing__tier-name">{{ t.tier_name }}</h3>
                            <div class="tw-avero-pricing__price">
                                <span class="tw-avero-pricing__price-amount">{{ t.tier_price }}</span>
                                <# if (t.tier_suffix) { #><span class="tw-avero-pricing__price-suffix">{{ t.tier_suffix }}</span><# } #>
                            </div>
                            <# if (t.tier_desc) { #><p class="tw-avero-pricing__tier-desc">{{{ t.tier_desc }}}</p><# } #>
                            <ul class="tw-avero-pricing__features">
                                <# _.each(features, function(f){ #><li><span>{{ f }}</span></li><# }); #>
                            </ul>
                            <# if (t.tier_cta_text) { var u = (t.tier_cta_url && t.tier_cta_url.url) || '#'; #>
                                <a class="tw-avero-pricing__cta" href="{{ u }}">{{ t.tier_cta_text }}</a>
                            <# } #>
                        </article>
                    <# }); #>
                </div>
            </div>
        </section>
        <?php
    }
}
