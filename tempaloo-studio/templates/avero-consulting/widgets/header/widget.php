<?php
/**
 * Avero Consulting — Header widget
 *
 * Sticky top navigation. Transparent at the top of the page; fades in
 * a subtle backdrop-blur background once the user scrolls past 40px.
 * Brand wordmark left, navigation center, CTA right.
 *
 * @package Tempaloo\Studio\Templates\Avero_Consulting
 */

namespace Tempaloo\Studio\Templates\Avero_Consulting;

defined( 'ABSPATH' ) || exit;

use Elementor\Controls_Manager;
use Elementor\Repeater;
use Tempaloo\Studio\Elementor\Widget_Base;

class Header extends Widget_Base {

    public function get_name(): string         { return 'header'; }
    public function get_title(): string        { return esc_html__( 'Avero — Header', 'tempaloo-studio' ); }
    public function get_icon(): string         { return 'eicon-nav-menu'; }
    public function get_template_slug(): string { return 'avero-consulting'; }

    protected function register_controls(): void {

        $this->start_controls_section( 'section_brand', [
            'label' => esc_html__( 'Brand', 'tempaloo-studio' ),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $this->add_control( 'brand_text', [
            'label'   => esc_html__( 'Brand wordmark', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXT,
            'default' => 'Avero',
        ] );

        $this->add_control( 'brand_url', [
            'label'   => esc_html__( 'Brand link', 'tempaloo-studio' ),
            'type'    => Controls_Manager::URL,
            'default' => [ 'url' => '/', 'is_external' => false ],
        ] );

        $this->end_controls_section();

        $this->start_controls_section( 'section_nav', [
            'label' => esc_html__( 'Navigation', 'tempaloo-studio' ),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $repeater = new Repeater();
        $repeater->add_control( 'nav_label', [
            'label'   => esc_html__( 'Label', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXT,
            'default' => 'Services',
        ] );
        $repeater->add_control( 'nav_url', [
            'label'   => esc_html__( 'Link', 'tempaloo-studio' ),
            'type'    => Controls_Manager::URL,
            'default' => [ 'url' => '#services' ],
        ] );

        $this->add_control( 'nav_items', [
            'label'       => esc_html__( 'Links', 'tempaloo-studio' ),
            'type'        => Controls_Manager::REPEATER,
            'fields'      => $repeater->get_controls(),
            'title_field' => '{{{ nav_label }}}',
            'default'     => [
                [ 'nav_label' => 'Services',  'nav_url' => [ 'url' => '#services' ] ],
                [ 'nav_label' => 'Work',      'nav_url' => [ 'url' => '#work' ] ],
                [ 'nav_label' => 'Process',   'nav_url' => [ 'url' => '#process' ] ],
                [ 'nav_label' => 'Pricing',   'nav_url' => [ 'url' => '#pricing' ] ],
            ],
        ] );

        $this->end_controls_section();

        $this->start_controls_section( 'section_cta', [
            'label' => esc_html__( 'CTA', 'tempaloo-studio' ),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $this->add_control( 'cta_text', [
            'label'   => esc_html__( 'CTA text', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXT,
            'default' => 'Book a call',
        ] );

        $this->add_control( 'cta_url', [
            'label'   => esc_html__( 'CTA link', 'tempaloo-studio' ),
            'type'    => Controls_Manager::URL,
            'default' => [ 'url' => '#contact' ],
        ] );

        $this->add_control( 'show_theme_toggle', [
            'label'        => esc_html__( 'Show theme toggle', 'tempaloo-studio' ),
            'type'         => Controls_Manager::SWITCHER,
            'default'      => 'yes',
            'return_value' => 'yes',
            'description'  => esc_html__( 'Adds a sun/moon button that switches the page between light and dark mode.', 'tempaloo-studio' ),
        ] );

        $this->end_controls_section();
    }

    protected function render(): void {
        $s              = $this->get_settings_for_display();
        $brand          = $this->s( $s, 'brand_text', 'Avero' );
        $brand_url      = $s['brand_url']['url'] ?? '/';
        $items          = is_array( $s['nav_items'] ?? null ) ? $s['nav_items'] : [];
        $cta_text       = $this->s( $s, 'cta_text' );
        $cta_url        = $s['cta_url']['url'] ?? '#';
        $show_toggle    = ! empty( $s['show_theme_toggle'] ) && $s['show_theme_toggle'] === 'yes';
        ?>
        <header class="tw-avero-header">
            <div class="tw-avero-header__inner">
                <a class="tw-avero-header__brand" href="<?php echo esc_url( $brand_url ); ?>">
                    <?php echo esc_html( $brand ); ?>
                    <span class="tw-avero-header__brand-dot" aria-hidden="true"></span>
                </a>

                <button type="button" class="tw-avero-header__menu-btn" aria-label="<?php echo esc_attr__( 'Open menu', 'tempaloo-studio' ); ?>" aria-expanded="false">
                    <span></span><span></span><span></span>
                </button>

                <!-- Drawer — desktop: inline flex; mobile: off-canvas slide-in -->
                <div class="tw-avero-header__drawer" role="dialog" aria-label="<?php echo esc_attr__( 'Site navigation', 'tempaloo-studio' ); ?>">
                    <button type="button" class="tw-avero-header__close" aria-label="<?php echo esc_attr__( 'Close menu', 'tempaloo-studio' ); ?>">
                        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
                            <path d="M4 4l8 8M12 4l-8 8" />
                        </svg>
                    </button>

                    <nav class="tw-avero-header__nav" aria-label="<?php echo esc_attr__( 'Primary', 'tempaloo-studio' ); ?>">
                        <?php foreach ( $items as $item ) : ?>
                            <a class="tw-avero-header__navlink" href="<?php echo esc_url( $item['nav_url']['url'] ?? '#' ); ?>">
                                <?php echo esc_html( $item['nav_label'] ?? '' ); ?>
                            </a>
                        <?php endforeach; ?>
                    </nav>

                    <div class="tw-avero-header__drawer-actions">
                        <?php if ( $show_toggle ) : ?>
                            <button type="button" class="tw-avero-header__theme-toggle" aria-label="<?php echo esc_attr__( 'Toggle dark mode', 'tempaloo-studio' ); ?>" title="<?php echo esc_attr__( 'Toggle theme', 'tempaloo-studio' ); ?>">
                                <svg class="tw-avero-header__icon-moon" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <path d="M13.5 9.5A5.5 5.5 0 1 1 6.5 2.5a4.5 4.5 0 0 0 7 7Z" />
                                </svg>
                                <svg class="tw-avero-header__icon-sun" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <circle cx="8" cy="8" r="3" />
                                    <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" />
                                </svg>
                            </button>
                        <?php endif; ?>

                        <?php if ( $cta_text !== '' ) : ?>
                            <a class="tw-avero-header__cta" href="<?php echo esc_url( $cta_url ); ?>">
                                <?php echo esc_html( $cta_text ); ?>
                                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <path d="M3 8h10M9 4l4 4-4 4" />
                                </svg>
                            </a>
                        <?php endif; ?>
                    </div>
                </div>
            </div>

            <div class="tw-avero-header__backdrop" aria-hidden="true"></div>
        </header>
        <?php
    }

    protected function _content_template(): void {
        ?>
        <#
        var brand    = settings.brand_text || 'Avero';
        var brandUrl = (settings.brand_url && settings.brand_url.url) || '/';
        var ctaText  = settings.cta_text;
        var ctaUrl   = (settings.cta_url && settings.cta_url.url) || '#';
        var items    = _.isArray(settings.nav_items) ? settings.nav_items : [];
        #>
        <header class="tw-avero-header">
            <div class="tw-avero-header__inner">
                <a class="tw-avero-header__brand" href="{{ brandUrl }}">{{ brand }}<span class="tw-avero-header__brand-dot"></span></a>
                <button type="button" class="tw-avero-header__menu-btn"><span></span><span></span><span></span></button>
                <div class="tw-avero-header__drawer">
                    <button type="button" class="tw-avero-header__close">×</button>
                    <nav class="tw-avero-header__nav">
                        <# _.each(items, function(item){ var url = (item.nav_url && item.nav_url.url) || '#'; #>
                            <a class="tw-avero-header__navlink" href="{{ url }}">{{ item.nav_label }}</a>
                        <# }); #>
                    </nav>
                    <div class="tw-avero-header__drawer-actions">
                        <# if (settings.show_theme_toggle === 'yes') { #>
                            <button type="button" class="tw-avero-header__theme-toggle">
                                <span class="tw-avero-header__icon-moon">☾</span>
                                <span class="tw-avero-header__icon-sun">☀</span>
                            </button>
                        <# } #>
                        <# if (ctaText) { #>
                            <a class="tw-avero-header__cta" href="{{ ctaUrl }}">{{{ ctaText }}}</a>
                        <# } #>
                    </div>
                </div>
            </div>
            <div class="tw-avero-header__backdrop"></div>
        </header>
        <?php
    }
}
