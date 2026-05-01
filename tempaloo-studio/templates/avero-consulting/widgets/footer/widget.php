<?php
/**
 * Avero Consulting — Footer widget
 *
 * Multi-column footer with brand block, link columns, social row,
 * legal bar.
 *
 * @package Tempaloo\Studio\Templates\Avero_Consulting
 */

namespace Tempaloo\Studio\Templates\Avero_Consulting;

defined( 'ABSPATH' ) || exit;

use Elementor\Controls_Manager;
use Elementor\Repeater;
use Tempaloo\Studio\Elementor\Widget_Base;

class Footer extends Widget_Base {

    public function get_name(): string         { return 'footer'; }
    public function get_title(): string        { return esc_html__( 'Avero — Footer', 'tempaloo-studio' ); }
    public function get_icon(): string         { return 'eicon-footer'; }
    public function get_template_slug(): string { return 'avero-consulting'; }

    protected function register_controls(): void {
        $this->start_controls_section( 'section_brand', [
            'label' => esc_html__( 'Brand', 'tempaloo-studio' ),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $this->add_control( 'brand_text', [ 'label' => esc_html__( 'Brand', 'tempaloo-studio' ), 'type' => Controls_Manager::TEXT, 'default' => 'Avero' ] );
        $this->add_control( 'tagline',    [ 'label' => esc_html__( 'Tagline', 'tempaloo-studio' ), 'type' => Controls_Manager::TEXTAREA,
            'default' => 'A senior consulting partner for ambitious founder-led teams. Operating from Stockholm, working everywhere.' ] );

        $this->end_controls_section();

        $this->start_controls_section( 'section_columns', [ 'label' => esc_html__( 'Link columns', 'tempaloo-studio' ), 'tab' => Controls_Manager::TAB_CONTENT ] );

        $linkRep = new Repeater();
        $linkRep->add_control( 'col_label', [ 'label' => esc_html__( 'Label', 'tempaloo-studio' ), 'type' => Controls_Manager::TEXT, 'default' => 'Services' ] );
        $linkRep->add_control( 'col_url',   [ 'label' => esc_html__( 'Link',  'tempaloo-studio' ), 'type' => Controls_Manager::URL, 'default' => [ 'url' => '#' ] ] );

        $colRep = new Repeater();
        $colRep->add_control( 'col_title', [ 'label' => esc_html__( 'Column title', 'tempaloo-studio' ), 'type' => Controls_Manager::TEXT, 'default' => 'Product' ] );
        $colRep->add_control( 'col_links', [
            'label'       => esc_html__( 'Links', 'tempaloo-studio' ),
            'type'        => Controls_Manager::REPEATER,
            'fields'      => $linkRep->get_controls(),
            'title_field' => '{{{ col_label }}}',
        ] );

        $this->add_control( 'columns', [
            'label'       => esc_html__( 'Columns', 'tempaloo-studio' ),
            'type'        => Controls_Manager::REPEATER,
            'fields'      => $colRep->get_controls(),
            'title_field' => '{{{ col_title }}}',
            'default'     => [
                [ 'col_title' => 'Engagements', 'col_links' => [
                    [ 'col_label' => 'Starter sprint', 'col_url' => [ 'url' => '#starter' ] ],
                    [ 'col_label' => 'Growth retainer','col_url' => [ 'url' => '#growth' ] ],
                    [ 'col_label' => 'Scale partner',  'col_url' => [ 'url' => '#scale' ] ],
                ] ],
                [ 'col_title' => 'Studio', 'col_links' => [
                    [ 'col_label' => 'About',     'col_url' => [ 'url' => '#about' ] ],
                    [ 'col_label' => 'Process',   'col_url' => [ 'url' => '#process' ] ],
                    [ 'col_label' => 'Case work', 'col_url' => [ 'url' => '#work' ] ],
                ] ],
                [ 'col_title' => 'Resources', 'col_links' => [
                    [ 'col_label' => 'Field notes',  'col_url' => [ 'url' => '#notes' ] ],
                    [ 'col_label' => 'Annual report','col_url' => [ 'url' => '#report' ] ],
                    [ 'col_label' => 'Contact',      'col_url' => [ 'url' => '#contact' ] ],
                ] ],
            ],
        ] );

        $this->end_controls_section();

        $this->start_controls_section( 'section_legal', [ 'label' => esc_html__( 'Legal bar', 'tempaloo-studio' ), 'tab' => Controls_Manager::TAB_CONTENT ] );

        $this->add_control( 'copyright', [ 'label' => esc_html__( 'Copyright', 'tempaloo-studio' ), 'type' => Controls_Manager::TEXT, 'default' => '© Avero Studios. All rights reserved.' ] );

        $this->end_controls_section();
    }

    protected function render(): void {
        $s        = $this->get_settings_for_display();
        $columns  = is_array( $s['columns'] ?? null ) ? $s['columns'] : [];
        ?>
        <footer class="tw-avero-footer" data-tw-anim-scope="footer">
            <div class="tw-avero-footer__container">
                <div class="tw-avero-footer__top">
                    <div class="tw-avero-footer__brand-block">
                        <span class="tw-avero-footer__brand"><?php echo esc_html( $s['brand_text'] ?? '' ); ?><span class="tw-avero-footer__brand-dot" aria-hidden="true"></span></span>
                        <?php if ( ! empty( $s['tagline'] ) ) : ?>
                            <p class="tw-avero-footer__tagline"><?php echo wp_kses_post( $s['tagline'] ); ?></p>
                        <?php endif; ?>
                    </div>

                    <div class="tw-avero-footer__cols">
                        <?php foreach ( $columns as $col ) : ?>
                            <div class="tw-avero-footer__col">
                                <span class="tw-avero-footer__col-title"><?php echo esc_html( $col['col_title'] ?? '' ); ?></span>
                                <ul role="list">
                                    <?php
                                    $links = is_array( $col['col_links'] ?? null ) ? $col['col_links'] : [];
                                    foreach ( $links as $l ) :
                                    ?>
                                        <li><a href="<?php echo esc_url( $l['col_url']['url'] ?? '#' ); ?>"><?php echo esc_html( $l['col_label'] ?? '' ); ?></a></li>
                                    <?php endforeach; ?>
                                </ul>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>

                <div class="tw-avero-footer__bottom">
                    <span class="tw-avero-footer__copy"><?php echo esc_html( $s['copyright'] ?? '' ); ?></span>
                    <span class="tw-avero-footer__powered">Crafted with <span aria-hidden="true">◆</span> Tempaloo Studio</span>
                </div>
            </div>
        </footer>
        <?php
    }

    protected function _content_template(): void {
        ?>
        <#
        var columns = _.isArray(settings.columns) ? settings.columns : [];
        #>
        <footer class="tw-avero-footer">
            <div class="tw-avero-footer__container">
                <div class="tw-avero-footer__top">
                    <div class="tw-avero-footer__brand-block">
                        <span class="tw-avero-footer__brand">{{ settings.brand_text }}<span class="tw-avero-footer__brand-dot"></span></span>
                        <# if (settings.tagline) { #><p class="tw-avero-footer__tagline">{{{ settings.tagline }}}</p><# } #>
                    </div>
                    <div class="tw-avero-footer__cols">
                        <# _.each(columns, function(col){
                            var links = _.isArray(col.col_links) ? col.col_links : [];
                        #>
                            <div class="tw-avero-footer__col">
                                <span class="tw-avero-footer__col-title">{{ col.col_title }}</span>
                                <ul>
                                    <# _.each(links, function(l){ var url = (l.col_url && l.col_url.url) || '#'; #>
                                        <li><a href="{{ url }}">{{ l.col_label }}</a></li>
                                    <# }); #>
                                </ul>
                            </div>
                        <# }); #>
                    </div>
                </div>
                <div class="tw-avero-footer__bottom">
                    <span class="tw-avero-footer__copy">{{ settings.copyright }}</span>
                    <span class="tw-avero-footer__powered">Crafted with ◆ Tempaloo Studio</span>
                </div>
            </div>
        </footer>
        <?php
    }
}
