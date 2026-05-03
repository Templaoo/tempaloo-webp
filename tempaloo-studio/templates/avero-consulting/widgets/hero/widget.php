<?php
/**
 * Avero Consulting — Hero widget
 *
 * Two-column hero: editorial content + media card with floating callout.
 * Light + dark via tokens. GSAP entrance + hover micro-interactions.
 *
 * @package Tempaloo\Studio\Templates\Avero_Consulting
 */

namespace Tempaloo\Studio\Templates\Avero_Consulting;

defined( 'ABSPATH' ) || exit;

use Elementor\Controls_Manager;
use Tempaloo\Studio\Elementor\Widget_Base;

class Hero extends Widget_Base {

    public function get_name(): string {
        return 'hero';
    }

    public function get_title(): string {
        return esc_html__( 'Avero — Hero', 'tempaloo-studio' );
    }

    public function get_icon(): string {
        return 'eicon-banner';
    }

    public function get_template_slug(): string {
        return 'avero-consulting';
    }

    protected function register_controls(): void {

        // ── Content ─────────────────────────────────────────────
        $this->start_controls_section( 'section_content', [
            'label' => esc_html__( 'Content', 'tempaloo-studio' ),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $this->add_control( 'rating_text', [
            'label'   => esc_html__( 'Rating label', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXT,
            'default' => 'Rated 4.9/5 by 200+ founders',
        ] );

        $this->add_control( 'title', [
            'label'       => esc_html__( 'Title', 'tempaloo-studio' ),
            'type'        => Controls_Manager::TEXTAREA,
            'default'     => "Strategy that\nactually <em>moves</em>\nthe needle.",
            'description' => esc_html__( 'Wrap one or two key words in <em>…</em> to render them in italic accent color.', 'tempaloo-studio' ),
        ] );

        $this->add_control( 'lead', [
            'label'   => esc_html__( 'Lead paragraph', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXTAREA,
            'default' => 'We help ambitious teams turn fuzzy goals into clear plans, repeatable systems, and measurable revenue. No fluff, no decks-as-deliverables.',
        ] );

        $this->add_control( 'cta_primary_text', [
            'label'   => esc_html__( 'Primary CTA — text', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXT,
            'default' => 'Book a discovery call',
        ] );

        $this->add_control( 'cta_primary_url', [
            'label'   => esc_html__( 'Primary CTA — link', 'tempaloo-studio' ),
            'type'    => Controls_Manager::URL,
            'default' => [ 'url' => '#contact', 'is_external' => false, 'nofollow' => false ],
        ] );

        $this->add_control( 'cta_secondary_text', [
            'label'   => esc_html__( 'Secondary CTA — text', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXT,
            'default' => 'Our process',
        ] );

        $this->add_control( 'cta_secondary_url', [
            'label'   => esc_html__( 'Secondary CTA — link', 'tempaloo-studio' ),
            'type'    => Controls_Manager::URL,
            'default' => [ 'url' => '#process', 'is_external' => false, 'nofollow' => false ],
        ] );

        $this->add_control( 'trust_text', [
            'label'   => esc_html__( 'Trust strip text', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXTAREA,
            'default' => 'Trusted by teams at <strong>Stripe</strong>, <strong>Notion</strong>, <strong>Linear</strong> and 200+ growing studios.',
        ] );

        $this->end_controls_section();

        // ── Media ───────────────────────────────────────────────
        $this->start_controls_section( 'section_media', [
            'label' => esc_html__( 'Media', 'tempaloo-studio' ),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $this->add_control( 'hero_image', [
            'label'   => esc_html__( 'Hero image', 'tempaloo-studio' ),
            'type'    => Controls_Manager::MEDIA,
            // Editorial consulting / workshop scene — modern office,
            // people collaborating around a laptop. Unsplash CDN, WebP
            // auto-served, sized 1600w for the hero card.
            'default' => [ 'url' => 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1600&q=85&auto=format&fit=crop' ],
        ] );

        $this->add_control( 'hero_image_alt', [
            'label'   => esc_html__( 'Image alt text', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXT,
            'default' => 'Avero consulting team in workshop',
        ] );

        $this->add_control( 'show_floating_card', [
            'label'        => esc_html__( 'Show floating card', 'tempaloo-studio' ),
            'type'         => Controls_Manager::SWITCHER,
            'default'      => 'yes',
            'return_value' => 'yes',
        ] );

        $this->add_control( 'floating_title', [
            'label'     => esc_html__( 'Floating title', 'tempaloo-studio' ),
            'type'      => Controls_Manager::TEXT,
            'default'   => '+38% revenue in 90 days',
            'condition' => [ 'show_floating_card' => 'yes' ],
        ] );

        $this->add_control( 'floating_subtitle', [
            'label'     => esc_html__( 'Floating subtitle', 'tempaloo-studio' ),
            'type'      => Controls_Manager::TEXT,
            'default'   => 'avg. result, last 12 client engagements',
            'condition' => [ 'show_floating_card' => 'yes' ],
        ] );

        $this->end_controls_section();

        // ── Animation ───────────────────────────────────────────
        $this->start_controls_section( 'section_animation', [
            'label' => esc_html__( 'Animation', 'tempaloo-studio' ),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $this->add_control( 'enable_animation', [
            'label'        => esc_html__( 'Enable entrance animations', 'tempaloo-studio' ),
            'type'         => Controls_Manager::SWITCHER,
            'default'      => 'yes',
            'return_value' => 'yes',
            'description'  => esc_html__( 'Disabled automatically when the visitor prefers reduced motion.', 'tempaloo-studio' ),
        ] );

        $this->end_controls_section();
    }

    protected function render(): void {
        $s                  = $this->get_settings_for_display();
        $rating             = $this->s( $s, 'rating_text' );
        $title              = $this->s( $s, 'title' );
        $lead               = $this->s( $s, 'lead' );
        $cta1_text          = $this->s( $s, 'cta_primary_text' );
        $cta1_url           = $s['cta_primary_url']['url'] ?? '#';
        $cta1_external      = ! empty( $s['cta_primary_url']['is_external'] );
        $cta1_nofollow      = ! empty( $s['cta_primary_url']['nofollow'] );
        $cta2_text          = $this->s( $s, 'cta_secondary_text' );
        $cta2_url           = $s['cta_secondary_url']['url'] ?? '#';
        $cta2_external      = ! empty( $s['cta_secondary_url']['is_external'] );
        $cta2_nofollow      = ! empty( $s['cta_secondary_url']['nofollow'] );
        $trust              = $this->s( $s, 'trust_text' );
        $image_url          = $s['hero_image']['url'] ?? '';
        $image_alt          = $this->s( $s, 'hero_image_alt', 'Hero image' );
        $show_card          = ! empty( $s['show_floating_card'] ) && $s['show_floating_card'] === 'yes';
        $card_title         = $this->s( $s, 'floating_title' );
        $card_subtitle      = $this->s( $s, 'floating_subtitle' );
        $animate            = ! empty( $s['enable_animation'] ) && $s['enable_animation'] === 'yes';

        // Build link rel attributes once.
        $cta1_rel = $cta1_nofollow ? ' rel="nofollow noopener"' : ( $cta1_external ? ' rel="noopener"' : '' );
        $cta2_rel = $cta2_nofollow ? ' rel="nofollow noopener"' : ( $cta2_external ? ' rel="noopener"' : '' );
        $cta1_target = $cta1_external ? ' target="_blank"' : '';
        $cta2_target = $cta2_external ? ' target="_blank"' : '';
        ?>
        <section
            class="tw-avero-hero"
            <?php echo $animate ? 'data-tw-anim-scope="hero"' : ''; ?>
        >
            <div class="tw-avero-hero__container">

                <!-- Content column -->
                <div class="tw-avero-hero__content">

                    <?php if ( $rating !== '' ) : ?>
                        <span class="tw-avero-hero__rating" data-tw-anim-target>
                            <span class="tw-avero-hero__rating-stars" aria-hidden="true">★★★★★</span>
                            <?php echo esc_html( $rating ); ?>
                        </span>
                    <?php endif; ?>

                    <h1 class="tw-avero-hero__title" data-tw-anim-target><?php
                        // Allow <em> for italic accent + plain line breaks.
                        echo wp_kses(
                            nl2br( $title, false ),
                            [ 'em' => [ 'class' => true ], 'br' => [] ]
                        );
                    ?></h1>

                    <?php if ( $lead !== '' ) : ?>
                        <p class="tw-avero-hero__lead" data-tw-anim-target><?php echo wp_kses_post( $lead ); ?></p>
                    <?php endif; ?>

                    <div class="tw-avero-hero__cta-row" data-tw-anim-target>
                        <?php if ( $cta1_text !== '' ) : ?>
                            <a class="tw-avero-hero__cta tw-avero-hero__cta--primary"
                               href="<?php echo esc_url( $cta1_url ); ?>"<?php echo $cta1_target . $cta1_rel; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
                                <?php echo esc_html( $cta1_text ); ?>
                                <svg class="tw-avero-hero__cta-arrow" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <path d="M3.5 9 H14.5 M10 4.5 L14.5 9 L10 13.5" />
                                </svg>
                            </a>
                        <?php endif; ?>

                        <?php if ( $cta2_text !== '' ) : ?>
                            <a class="tw-avero-hero__cta tw-avero-hero__cta--secondary"
                               href="<?php echo esc_url( $cta2_url ); ?>"<?php echo $cta2_target . $cta2_rel; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
                                <?php echo esc_html( $cta2_text ); ?>
                            </a>
                        <?php endif; ?>
                    </div>

                    <?php if ( $trust !== '' ) : ?>
                        <div class="tw-avero-hero__trust" data-tw-anim-target>
                            <div class="tw-avero-hero__trust-avatars" aria-hidden="true">
                                <span class="tw-avero-hero__trust-avatar" style="background:linear-gradient(135deg,#3fb2a2,#214d47)"></span>
                                <span class="tw-avero-hero__trust-avatar" style="background:linear-gradient(135deg,#f5c453,#c08a2b)"></span>
                                <span class="tw-avero-hero__trust-avatar" style="background:linear-gradient(135deg,#7c4dff,#3f2c8a)"></span>
                                <span class="tw-avero-hero__trust-avatar" style="background:linear-gradient(135deg,#e88aaa,#a8556a)"></span>
                            </div>
                            <span class="tw-avero-hero__trust-text"><?php echo wp_kses_post( $trust ); ?></span>
                        </div>
                    <?php endif; ?>

                </div>

                <!-- Media column -->
                <div class="tw-avero-hero__media" data-tw-anim-target>
                    <?php if ( $image_url !== '' ) : ?>
                        <img class="tw-avero-hero__image"
                             src="<?php echo esc_url( $image_url ); ?>"
                             alt="<?php echo esc_attr( $image_alt ); ?>"
                             loading="eager" />
                    <?php endif; ?>

                    <?php if ( $show_card && ( $card_title !== '' || $card_subtitle !== '' ) ) : ?>
                        <div class="tw-avero-hero__floating-card">
                            <span class="tw-avero-hero__floating-icon" aria-hidden="true">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M3 14 L7 10 L11 13 L17 5" />
                                    <path d="M13 5 L17 5 L17 9" />
                                </svg>
                            </span>
                            <div class="tw-avero-hero__floating-text">
                                <?php if ( $card_title !== '' ) : ?>
                                    <p class="tw-avero-hero__floating-title"><?php echo esc_html( $card_title ); ?></p>
                                <?php endif; ?>
                                <?php if ( $card_subtitle !== '' ) : ?>
                                    <p class="tw-avero-hero__floating-subtitle"><?php echo esc_html( $card_subtitle ); ?></p>
                                <?php endif; ?>
                            </div>
                        </div>
                    <?php endif; ?>
                </div>

            </div>
        </section>
        <?php
    }

    /**
     * Underscore.js template — runs inside the Elementor editor iframe
     * so text/url/switcher/media changes preview LIVE without an iframe
     * reload. Must mirror the structure of render() above.
     *
     * Per WIDGET-SPEC §1.13: every text-heavy widget ships a
     * _content_template() so users see typing reflected immediately.
     */
    protected function _content_template(): void {
        ?>
        <#
        var rating         = settings.rating_text;
        var lead           = settings.lead;
        var cta1Text       = settings.cta_primary_text;
        var cta1Url        = ( settings.cta_primary_url && settings.cta_primary_url.url ) ? settings.cta_primary_url.url : '#';
        var cta1External   = settings.cta_primary_url && settings.cta_primary_url.is_external ? ' target="_blank"' : '';
        var cta2Text       = settings.cta_secondary_text;
        var cta2Url        = ( settings.cta_secondary_url && settings.cta_secondary_url.url ) ? settings.cta_secondary_url.url : '#';
        var cta2External   = settings.cta_secondary_url && settings.cta_secondary_url.is_external ? ' target="_blank"' : '';
        var imageUrl       = ( settings.hero_image && settings.hero_image.url ) ? settings.hero_image.url : '';
        var imageAlt       = settings.hero_image_alt || 'Hero image';
        var showCard       = settings.show_floating_card === 'yes';
        var cardTitle      = settings.floating_title;
        var cardSubtitle   = settings.floating_subtitle;
        var animate        = settings.enable_animation === 'yes' ? '1' : '0';

        // Title: convert <em>…</em> from raw input + newlines → <br>.
        // We escape everything first, then re-allow <em> by un-escaping
        // those tags only. Keeps the live preview safe-ish without
        // pulling in a full sanitizer in the editor iframe.
        var rawTitle  = settings.title || '';
        var safeTitle = _.escape( rawTitle )
            .replace( /&lt;em&gt;/g, '<em>' )
            .replace( /&lt;\/em&gt;/g, '</em>' )
            .replace( /\n/g, '<br>' );

        // Trust strip allows a small subset of HTML (<strong>) — same
        // un-escape trick.
        var safeTrust = _.escape( settings.trust_text || '' )
            .replace( /&lt;strong&gt;/g, '<strong>' )
            .replace( /&lt;\/strong&gt;/g, '</strong>' );
        #>
        <section class="tw-avero-hero" data-tw-animate="{{ animate }}">
            <div class="tw-avero-hero__container">

                <div class="tw-avero-hero__content">

                    <# if ( rating ) { #>
                        <span class="tw-avero-hero__rating">
                            <span class="tw-avero-hero__rating-stars" aria-hidden="true">★★★★★</span>
                            {{{ rating }}}
                        </span>
                    <# } #>

                    <h1 class="tw-avero-hero__title">{{{ safeTitle }}}</h1>

                    <# if ( lead ) { #>
                        <p class="tw-avero-hero__lead">{{{ lead }}}</p>
                    <# } #>

                    <div class="tw-avero-hero__cta-row">
                        <# if ( cta1Text ) { #>
                            <a class="tw-avero-hero__cta tw-avero-hero__cta--primary" href="{{ cta1Url }}"{{{ cta1External }}}>
                                {{{ cta1Text }}}
                                <svg class="tw-avero-hero__cta-arrow" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <path d="M3.5 9 H14.5 M10 4.5 L14.5 9 L10 13.5" />
                                </svg>
                            </a>
                        <# } #>
                        <# if ( cta2Text ) { #>
                            <a class="tw-avero-hero__cta tw-avero-hero__cta--secondary" href="{{ cta2Url }}"{{{ cta2External }}}>
                                {{{ cta2Text }}}
                            </a>
                        <# } #>
                    </div>

                    <# if ( settings.trust_text ) { #>
                        <div class="tw-avero-hero__trust">
                            <div class="tw-avero-hero__trust-avatars" aria-hidden="true">
                                <span class="tw-avero-hero__trust-avatar" style="background:linear-gradient(135deg,#3fb2a2,#214d47)"></span>
                                <span class="tw-avero-hero__trust-avatar" style="background:linear-gradient(135deg,#f5c453,#c08a2b)"></span>
                                <span class="tw-avero-hero__trust-avatar" style="background:linear-gradient(135deg,#7c4dff,#3f2c8a)"></span>
                                <span class="tw-avero-hero__trust-avatar" style="background:linear-gradient(135deg,#e88aaa,#a8556a)"></span>
                            </div>
                            <span class="tw-avero-hero__trust-text">{{{ safeTrust }}}</span>
                        </div>
                    <# } #>

                </div>

                <div class="tw-avero-hero__media">
                    <# if ( imageUrl ) { #>
                        <img class="tw-avero-hero__image" src="{{ imageUrl }}" alt="{{ imageAlt }}" loading="eager" />
                    <# } #>

                    <# if ( showCard && ( cardTitle || cardSubtitle ) ) { #>
                        <div class="tw-avero-hero__floating-card">
                            <span class="tw-avero-hero__floating-icon" aria-hidden="true">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M3 14 L7 10 L11 13 L17 5" />
                                    <path d="M13 5 L17 5 L17 9" />
                                </svg>
                            </span>
                            <div class="tw-avero-hero__floating-text">
                                <# if ( cardTitle ) { #>
                                    <p class="tw-avero-hero__floating-title">{{{ cardTitle }}}</p>
                                <# } #>
                                <# if ( cardSubtitle ) { #>
                                    <p class="tw-avero-hero__floating-subtitle">{{{ cardSubtitle }}}</p>
                                <# } #>
                            </div>
                        </div>
                    <# } #>
                </div>

            </div>
        </section>
        <?php
    }
}
