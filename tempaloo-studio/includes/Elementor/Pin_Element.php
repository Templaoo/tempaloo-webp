<?php
/**
 * Pin_Element — Sticky / Pin Element + Header Sticky extensions on
 * native Elementor section + container (flex) + ".e-con" elements.
 *
 * Verbatim port of Animation Addons Pro v2.6.3
 * (`inc/extensions/wcf-pin-element.php`, 649 lines), with three changes:
 *
 *   1. Namespace + text-domain swapped to Tempaloo Studio.
 *   2. Control IDs prefixed `tw_pin_*` / `tw_hsticky_*` to avoid
 *      collision if Animation Addons is co-installed on the same site.
 *   3. `assets[scripts][name]` references our own registered handle
 *      `tempaloo-studio-pin` (registered in Frontend\Assets).
 *
 * Everything else — control structure, options, conditions, tabs,
 * defaults, group controls, render filters — matches the source 1:1.
 *
 * UX surface (visible to the user in Elementor's Advanced tab):
 *
 *   Section / Container > Advanced
 *     ├─ Sticky / Pin Element
 *     │   Tab 1: Content
 *     │     • Pin Trigger (Default | Custom selector)
 *     │     • End Trigger (Default | Custom .class)
 *     │     • Pin (True | False | Custom)
 *     │     • Pin Start (10 enum + Custom)
 *     │     • Pin End (10 enum + Custom)
 *     │     • Pin Spacing (True | False | Custom)
 *     │     • Pin Markers (True | False) — debug only
 *     │   Tab 2: Active Style
 *     │     • Toggle Class (CSS class added when pin engages)
 *     │     • Background (Group_Control_Background on .tw-pin-active)
 *     │
 *     └─ Header Sticky
 *         Tab 1: Content
 *           • End Trigger (CSS class)
 *           • Start Position (px from viewport top)
 *           • Z-Index
 *           • Up Scroll Sticky (toggle — header reveals on scroll-up)
 *           • Ease (8 options: power2.out / bounce / back / elastic / etc.)
 *           • Duration
 *         Tab 2: Style
 *           • Style Class (added on the cloned sticky element)
 *
 * @package Tempaloo\Studio\Elementor
 */

namespace Tempaloo\Studio\Elementor;

defined( 'ABSPATH' ) || exit;

use Elementor\Controls_Manager;
use Elementor\Group_Control_Background;

final class Pin_Element {

    public static function register(): void {

        // ── Sticky/Pin Element controls — both legacy section & flex container.
        add_action( 'elementor/element/section/section_advanced/after_section_end',
            [ __CLASS__, 'register_pin_area_controls' ], 1 );
        add_action( 'elementor/element/container/section_layout/after_section_end',
            [ __CLASS__, 'register_pin_area_controls' ], 1 );

        // ── Header Sticky controls — same hosts.
        add_action( 'elementor/element/section/section_advanced/after_section_end',
            [ __CLASS__, 'register_header_sticky_controls' ], 1 );
        add_action( 'elementor/element/container/section_layout/after_section_end',
            [ __CLASS__, 'register_header_sticky_controls' ], 1 );

        // ── Footer marker for header-sticky end-trigger fallback.
        add_action( 'wp_footer', [ __CLASS__, 'render_footer_sticky_trigger' ] );

        // ── Render-time filter — write user-typed end-trigger class
        //    onto the wrapper as `data-tw-pin-end-trigger` so the JS
        //    can pick it up even when the control isn't in REST scope.
        add_action( 'elementor/frontend/before_render',
            [ __CLASS__, 'fix_default_end_trigger' ] );
    }

    /**
     * Mirror the End-Trigger control onto a data-attribute on the
     * element's wrapper. Lets the JS handler read it without
     * needing `frontend_available => true` in the editor (which is
     * already set, but this provides a backward-compat path for
     * server-rendered pages that bypass the editor).
     */
    public static function fix_default_end_trigger( $element ): void {
        if ( 'container' !== $element->get_name() ) return;

        $settings = $element->get_settings();

        if ( isset( $settings['tw_pin_enable_pin_area'] ) &&
             $settings['tw_pin_enable_pin_area'] === 'yes' &&
             isset( $settings['tw_pin_pin_end_trigger'] ) &&
             $settings['tw_pin_pin_end_trigger'] !== '' ) {

            $element->add_render_attribute(
                '_wrapper',
                'data-tw-pin-end-trigger',
                $settings['tw_pin_pin_end_trigger']
            );
        }
    }

    /**
     * Footer hidden div that acts as a default end-trigger for
     * header-sticky pins. Animation Addons appends it inside
     * `#smooth-wrapper` (their ScrollSmoother host); we keep the
     * same approach so users migrating between plugins get the same
     * behaviour.
     */
    public static function render_footer_sticky_trigger(): void {
        ?>
        <script>
            document.addEventListener("DOMContentLoaded", function () {
                var smootherWrapper = document.getElementById('smooth-wrapper');
                var host = smootherWrapper || document.body;
                if ( host && ! document.querySelector('.tw-pin-footer-sticky-trigger') ) {
                    var div = document.createElement("div");
                    div.className = "tw-pin-footer-sticky-trigger aae_footer_sticky_header_trigger";
                    div.hidden = true;
                    host.appendChild(div);
                }
            });
        </script>
        <?php
    }

    /* =========================================================
     * STICKY / PIN ELEMENT — 14 controls in 2 tabs
     * ======================================================== */
    public static function register_pin_area_controls( $element ): void {

        $element->start_controls_section(
            '_section_tw_pin_area',
            [
                'label' => esc_html__( 'Sticky / Pin Element', 'tempaloo-studio' ),
                'tab'   => Controls_Manager::TAB_ADVANCED,
            ]
        );

        // Master Enable
        $element->add_responsive_control(
            'tw_pin_enable_pin_area',
            [
                'label'              => esc_html__( 'Enable', 'tempaloo-studio' ),
                'type'               => Controls_Manager::SELECT,
                'default'            => 'no',
                'separator'          => 'before',
                'return_value'       => 'yes',
                'options'            => [
                    'no'  => esc_html__( 'No',  'tempaloo-studio' ),
                    'yes' => esc_html__( 'Yes', 'tempaloo-studio' ),
                ],
                'render_type'        => 'ui',
                'frontend_available' => true,
            ]
        );

        $element->start_controls_tabs( 'tw_pin_style_tabs' );

        /* ───── Tab 1 — Content ───── */
        $element->start_controls_tab(
            'tw_pin_content_tab',
            [
                'label'     => esc_html__( 'Content', 'tempaloo-studio' ),
                'condition' => [ 'tw_pin_enable_pin_area' => [ 'yes' ] ],
            ]
        );

        $element->add_responsive_control(
            'tw_pin_pin_area_trigger',
            [
                'label'       => esc_html__( 'Pin Trigger', 'tempaloo-studio' ),
                'type'        => Controls_Manager::SELECT,
                'default'     => '',
                'options'     => [
                    ''       => esc_html__( 'Default', 'tempaloo-studio' ),
                    'custom' => esc_html__( 'Custom',  'tempaloo-studio' ),
                ],
                'condition'   => [ 'tw_pin_enable_pin_area' => 'yes' ],
                'render_type' => 'none',
                // Conditional script enqueue — Elementor 3.27+ only loads
                // the pin handler JS when at least one element on the
                // page has `tw_pin_enable_pin_area === 'yes'`.
                'assets'      => [
                    'scripts' => [
                        [
                            'name'       => 'tempaloo-studio-pin',
                            'conditions' => [
                                'terms' => [
                                    [
                                        'name'     => 'tw_pin_enable_pin_area',
                                        'operator' => '===',
                                        'value'    => 'yes',
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ]
        );

        $element->add_responsive_control(
            'tw_pin_custom_pin_area',
            [
                'label'              => esc_html__( 'Custom Pin Area', 'tempaloo-studio' ),
                'description'        => esc_html__( 'Class of the parent section/container the element will be pinned to. Both `.my-class` and `my-class` work.', 'tempaloo-studio' ),
                'type'               => Controls_Manager::TEXT,
                'ai'                 => false,
                'placeholder'        => esc_html__( '.pin_area', 'tempaloo-studio' ),
                'frontend_available' => true,
                'render_type'        => 'none',
                'condition'          => [
                    'tw_pin_pin_area_trigger' => 'custom',
                    'tw_pin_enable_pin_area'  => 'yes',
                ],
            ]
        );

        $element->add_responsive_control(
            'tw_pin_pin_end_trigger_type',
            [
                'label'              => esc_html__( 'End Trigger', 'tempaloo-studio' ),
                'type'               => Controls_Manager::SELECT,
                'default'            => 'default',
                'separator'          => 'before',
                'condition'          => [ 'tw_pin_enable_pin_area' => 'yes' ],
                'options'            => [
                    'default' => esc_html__( 'Default', 'tempaloo-studio' ),
                    'custom'  => esc_html__( 'Custom',  'tempaloo-studio' ),
                ],
                'render_type'        => 'ui',
                'frontend_available' => true,
            ]
        );

        $element->add_responsive_control(
            'tw_pin_pin_end_trigger',
            [
                'type'               => Controls_Manager::TEXT,
                'ai'                 => false,
                'placeholder'        => esc_html__( '.my-end-trigger', 'tempaloo-studio' ),
                'frontend_available' => true,
                'render_type'        => 'none',
                'default'            => '',
                'condition'          => [
                    'tw_pin_enable_pin_area'      => 'yes',
                    'tw_pin_pin_end_trigger_type' => 'custom',
                ],
                'separator'          => 'after',
                'show_label'         => false,
            ]
        );

        $element->add_responsive_control(
            'tw_pin_pin_status',
            [
                'label'              => esc_html__( 'Pin', 'tempaloo-studio' ),
                'type'               => Controls_Manager::SELECT,
                'default'            => 'true',
                'options'            => [
                    'true'   => esc_html__( 'True',   'tempaloo-studio' ),
                    'false'  => esc_html__( 'False',  'tempaloo-studio' ),
                    'custom' => esc_html__( 'Custom', 'tempaloo-studio' ),
                ],
                'frontend_available' => true,
                'render_type'        => 'none',
                'condition'          => [ 'tw_pin_enable_pin_area' => 'yes' ],
            ]
        );

        $element->add_responsive_control(
            'tw_pin_pin_custom',
            [
                'type'               => Controls_Manager::TEXT,
                'frontend_available' => true,
                'render_type'        => 'none',
                'placeholder'        => esc_html__( '.pin_class', 'tempaloo-studio' ),
                'condition'          => [
                    'tw_pin_pin_status'      => 'custom',
                    'tw_pin_enable_pin_area' => 'yes',
                ],
                'show_label'         => false,
            ]
        );

        // 10-option enum used by both Pin Start and Pin End.
        $pin_position_options = [
            'top top'       => esc_html__( 'Top Top',       'tempaloo-studio' ),
            'top center'    => esc_html__( 'Top Center',    'tempaloo-studio' ),
            'top bottom'    => esc_html__( 'Top Bottom',    'tempaloo-studio' ),
            'center top'    => esc_html__( 'Center Top',    'tempaloo-studio' ),
            'center center' => esc_html__( 'Center Center', 'tempaloo-studio' ),
            'center bottom' => esc_html__( 'Center Bottom', 'tempaloo-studio' ),
            'bottom top'    => esc_html__( 'Bottom Top',    'tempaloo-studio' ),
            'bottom center' => esc_html__( 'Bottom Center', 'tempaloo-studio' ),
            'bottom bottom' => esc_html__( 'Bottom Bottom', 'tempaloo-studio' ),
            'custom'        => esc_html__( 'Custom',        'tempaloo-studio' ),
        ];

        $element->add_responsive_control(
            'tw_pin_pin_area_start',
            [
                'label'              => esc_html__( 'Pin Start', 'tempaloo-studio' ),
                'description'        => esc_html__( 'First value is element position, second value is viewport position.', 'tempaloo-studio' ),
                'type'               => Controls_Manager::SELECT,
                'separator'          => 'before',
                'default'            => 'top top',
                'frontend_available' => true,
                'options'            => $pin_position_options,
                'render_type'        => 'none',
                'condition'          => [ 'tw_pin_enable_pin_area' => 'yes' ],
            ]
        );

        $element->add_responsive_control(
            'tw_pin_pin_area_start_custom',
            [
                'type'               => Controls_Manager::TEXT,
                'default'            => 'top top',
                'placeholder'        => 'top top+=100',
                'frontend_available' => true,
                'render_type'        => 'none',
                'condition'          => [
                    'tw_pin_enable_pin_area' => 'yes',
                    'tw_pin_pin_area_start'  => 'custom',
                ],
                'show_label'         => false,
            ]
        );

        $element->add_responsive_control(
            'tw_pin_pin_area_end',
            [
                'label'              => esc_html__( 'Pin End', 'tempaloo-studio' ),
                'description'        => esc_html__( 'First value is element position, second value is viewport position.', 'tempaloo-studio' ),
                'type'               => Controls_Manager::SELECT,
                'separator'          => 'before',
                'default'            => 'bottom bottom',
                'frontend_available' => true,
                'render_type'        => 'none',
                'options'            => $pin_position_options,
                'condition'          => [ 'tw_pin_enable_pin_area' => 'yes' ],
            ]
        );

        $element->add_responsive_control(
            'tw_pin_pin_area_end_custom',
            [
                'type'               => Controls_Manager::TEXT,
                'frontend_available' => true,
                'render_type'        => 'none',
                'default'            => 'bottom top',
                'placeholder'        => '+=50% center',
                'condition'          => [
                    'tw_pin_enable_pin_area' => 'yes',
                    'tw_pin_pin_area_end'    => 'custom',
                ],
                'show_label'         => false,
            ]
        );

        $element->add_responsive_control(
            'tw_pin_pin_spacing',
            [
                'label'              => esc_html__( 'Pin Spacing', 'tempaloo-studio' ),
                'type'               => Controls_Manager::SELECT,
                'default'            => 'false',
                'options'            => [
                    'true'   => esc_html__( 'True',   'tempaloo-studio' ),
                    'false'  => esc_html__( 'False',  'tempaloo-studio' ),
                    'custom' => esc_html__( 'Custom', 'tempaloo-studio' ),
                ],
                'frontend_available' => true,
                'render_type'        => 'none',
                'condition'          => [ 'tw_pin_enable_pin_area' => 'yes' ],
            ]
        );

        $element->add_responsive_control(
            'tw_pin_pin_spacing_custom',
            [
                'label'              => esc_html__( 'Custom Pin Spacing', 'tempaloo-studio' ),
                'type'               => Controls_Manager::TEXT,
                'frontend_available' => true,
                'render_type'        => 'none',
                'condition'          => [
                    'tw_pin_pin_spacing'     => 'custom',
                    'tw_pin_enable_pin_area' => 'yes',
                ],
                'placeholder'        => 'margin',
                'description'        => esc_html__(
                    'Custom spacing behavior for pinned elements. Use "margin" → adds margin instead of padding.',
                    'tempaloo-studio'
                ),
            ]
        );

        $element->add_control(
            'tw_pin_pin_markers',
            [
                'label'              => esc_html__( 'Pin Markers', 'tempaloo-studio' ),
                'type'               => Controls_Manager::SELECT,
                'default'            => 'false',
                'options'            => [
                    'true'  => esc_html__( 'True',  'tempaloo-studio' ),
                    'false' => esc_html__( 'False', 'tempaloo-studio' ),
                ],
                'frontend_available' => true,
                'render_type'        => 'none',
                'condition'          => [ 'tw_pin_enable_pin_area' => [ 'yes' ] ],
            ]
        );

        $element->end_controls_tab();

        /* ───── Tab 2 — Active Style ───── */
        $element->start_controls_tab(
            'tw_pin_active_style_tab',
            [
                'label'     => esc_html__( 'Active Style', 'tempaloo-studio' ),
                'condition' => [ 'tw_pin_enable_pin_area' => [ 'yes' ] ],
            ]
        );

        $element->add_control(
            'tw_pin_pin_active_cls',
            [
                'label'              => esc_html__( 'Toggle Class', 'tempaloo-studio' ),
                'type'               => Controls_Manager::TEXT,
                'default'            => '',
                'frontend_available' => true,
                'placeholder'        => esc_html__( 'sticky-style-active', 'tempaloo-studio' ),
                'description'        => esc_html__( 'Custom CSS class added on the element while the pin is active. The default class `tw-pin-active` is also added automatically.', 'tempaloo-studio' ),
            ]
        );

        $element->add_group_control(
            Group_Control_Background::get_type(),
            [
                'name'     => 'tw_pin_active_background',
                'types'    => [ 'classic', 'gradient', 'video' ],
                'selector' => '{{WRAPPER}}.tw-pin-active',
            ]
        );

        $element->end_controls_tab();

        $element->end_controls_tabs();
        $element->end_controls_section();
    }

    /* =========================================================
     * HEADER STICKY — 7 controls in 2 tabs
     * ======================================================== */
    public static function register_header_sticky_controls( $element ): void {

        $element->start_controls_section(
            'tw_hsticky_section',
            [
                'label' => esc_html__( 'Header Sticky', 'tempaloo-studio' ),
                'tab'   => Controls_Manager::TAB_ADVANCED,
            ]
        );

        $element->add_responsive_control(
            'tw_hsticky_enable',
            [
                'label'              => esc_html__( 'Enable', 'tempaloo-studio' ),
                'type'               => Controls_Manager::SELECT,
                'default'            => 'no',
                'separator'          => 'before',
                'options'            => [
                    'no'  => esc_html__( 'No',  'tempaloo-studio' ),
                    'yes' => esc_html__( 'Yes', 'tempaloo-studio' ),
                ],
                'render_type'        => 'ui',
                'frontend_available' => true,
            ]
        );

        $element->start_controls_tabs( 'tw_hsticky_tabs' );

        /* ───── Tab 1 — Content ───── */
        $element->start_controls_tab(
            'tw_hsticky_content_tab',
            [
                'label'     => esc_html__( 'Content', 'tempaloo-studio' ),
                'condition' => [ 'tw_hsticky_enable' => [ 'yes' ] ],
            ]
        );

        $element->add_responsive_control(
            'tw_hsticky_end_trigger',
            [
                'label'              => esc_html__( 'End Trigger', 'tempaloo-studio' ),
                'type'               => Controls_Manager::TEXT,
                'ai'                 => false,
                'placeholder'        => esc_html__( '.my-end-trigger', 'tempaloo-studio' ),
                'frontend_available' => true,
                'render_type'        => 'none',
                'default'            => '',
                'condition'          => [ 'tw_hsticky_enable' => 'yes' ],
            ]
        );

        $element->add_responsive_control(
            'tw_hsticky_start_position',
            [
                'label'              => esc_html__( 'Start Position', 'tempaloo-studio' ),
                'type'               => Controls_Manager::TEXT,
                'ai'                 => false,
                'placeholder'        => 300,
                'frontend_available' => true,
                'render_type'        => 'none',
                'default'            => 300,
                'condition'          => [ 'tw_hsticky_enable' => 'yes' ],
                // Same conditional script enqueue as the pin extension —
                // only loads sticky-pin.js when this feature is active.
                'assets' => [
                    'scripts' => [
                        [
                            'name'       => 'tempaloo-studio-pin',
                            'conditions' => [
                                'terms' => [
                                    [
                                        'name'     => 'tw_hsticky_enable',
                                        'operator' => '===',
                                        'value'    => 'yes',
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ]
        );

        $element->add_responsive_control(
            'tw_hsticky_z_index',
            [
                'label'              => esc_html__( 'Z-Index', 'tempaloo-studio' ),
                'type'               => Controls_Manager::NUMBER,
                'default'            => 9999,
                'ai'                 => false,
                'frontend_available' => true,
                'render_type'        => 'none',
                'condition'          => [ 'tw_hsticky_enable' => 'yes' ],
            ]
        );

        $element->add_responsive_control(
            'tw_hsticky_up_scroll_sticky',
            [
                'label'              => esc_html__( 'Up Scroll Sticky', 'tempaloo-studio' ),
                'type'               => Controls_Manager::SWITCHER,
                'label_on'           => esc_html__( 'Yes', 'tempaloo-studio' ),
                'label_off'          => esc_html__( 'No',  'tempaloo-studio' ),
                'return_value'       => 'yes',
                'default'            => 'yes',
                'ai'                 => false,
                'frontend_available' => true,
                'render_type'        => 'none',
                'condition'          => [ 'tw_hsticky_enable' => 'yes' ],
            ]
        );

        $element->add_responsive_control(
            'tw_hsticky_ease',
            [
                'label'              => esc_html__( 'Ease', 'tempaloo-studio' ),
                'type'               => Controls_Manager::SELECT,
                'default'            => 'power2.out',
                'render_type'        => 'none',
                'options'            => [
                    'power2.out' => esc_html__( 'Power2.out', 'tempaloo-studio' ),
                    'bounce'     => esc_html__( 'Bounce',     'tempaloo-studio' ),
                    'back'       => esc_html__( 'Back',       'tempaloo-studio' ),
                    'elastic'    => esc_html__( 'Elastic',    'tempaloo-studio' ),
                    'slowmo'     => esc_html__( 'Slowmo',     'tempaloo-studio' ),
                    'stepped'    => esc_html__( 'Stepped',    'tempaloo-studio' ),
                    'sine'       => esc_html__( 'Sine',       'tempaloo-studio' ),
                    'expo'       => esc_html__( 'Expo',       'tempaloo-studio' ),
                ],
                'condition'          => [ 'tw_hsticky_enable' => 'yes' ],
                'frontend_available' => true,
            ]
        );

        $element->add_responsive_control(
            'tw_hsticky_duration',
            [
                'label'              => esc_html__( 'Duration', 'tempaloo-studio' ),
                'type'               => Controls_Manager::NUMBER,
                'min'                => 0,
                'default'            => 0.8,
                'ai'                 => false,
                'frontend_available' => true,
                'render_type'        => 'none',
                'condition'          => [ 'tw_hsticky_enable' => 'yes' ],
            ]
        );

        $element->end_controls_tab();

        /* ───── Tab 2 — Style ───── */
        $element->start_controls_tab(
            'tw_hsticky_style_tab',
            [
                'label'     => esc_html__( 'Style', 'tempaloo-studio' ),
                'condition' => [ 'tw_hsticky_enable' => [ 'yes' ] ],
            ]
        );

        $element->add_control(
            'tw_hsticky_style_cls',
            [
                'label'              => esc_html__( 'Style Class', 'tempaloo-studio' ),
                'type'               => Controls_Manager::TEXT,
                'default'            => '',
                'frontend_available' => true,
                'placeholder'        => esc_html__( 'sticky-style', 'tempaloo-studio' ),
                'description'        => esc_html__( 'CSS class added on the cloned sticky header element. Use it to style the revealed-state separately from the static header.', 'tempaloo-studio' ),
            ]
        );

        $element->end_controls_tab();

        $element->end_controls_tabs();
        $element->end_controls_section();
    }
}
