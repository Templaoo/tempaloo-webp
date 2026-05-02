<?php
/**
 * Native_Widget_Controls — Elementor Style-tab controls that map onto
 * the active template's design tokens.
 *
 * The bridge in Theme_Tokens redirects Elementor's 4 system colors
 * (Primary/Secondary/Text/Accent) to our --tw-{slug}-* tokens — but
 * authors are limited to those 4 slots. Real templates ship 15-20
 * tokens (bg, bg-soft, bg-strong, text, text-soft, text-muted,
 * accent, border, cta…). This class exposes the FULL palette as
 * native dropdown controls inside every widget's Style tab, so an
 * author dragging in a stock Heading / Text / Button / Image widget
 * can pick any token from the active template.
 *
 * UX:
 *   Style tab → "🎨 Theme palette" section appears at the bottom of
 *   the Style tab of every native widget.
 *   Three controls: Text color, Background, Border color.
 *   Options auto-built from the active template's tokens, with the
 *   resolved hex shown in the label so the author can see what they
 *   pick. The chosen value is `var(--tw-{slug}-{name})`, which
 *   automatically swaps light↔dark when the user toggles the page
 *   theme — one pick covers BOTH modes.
 *
 * Non-destructive:
 *   - Default value is "" (empty) → no override emitted.
 *   - User explicitly opts in by picking a token.
 *   - Stored as a per-widget setting in Elementor's standard format —
 *     deactivating Tempaloo Studio leaves the values intact (they just
 *     resolve to nothing if the template's CSS isn't loaded).
 *   - No effect on Tempaloo widgets (their root has class `tw-{tpl}-*`,
 *     and these controls bind to {{WRAPPER}} which is Elementor's own
 *     element wrapper — irrelevant for our widgets which style
 *     themselves via global.css).
 *
 * @package Tempaloo\Studio\Elementor
 */

namespace Tempaloo\Studio\Elementor;

defined( 'ABSPATH' ) || exit;

use Elementor\Controls_Manager;

final class Native_Widget_Controls {

    private Template_Manager $templates;

    public function __construct( Template_Manager $templates ) {
        $this->templates = $templates;
    }

    public function register(): void {
        // Register the custom palette control type used by the section.
        add_action( 'elementor/controls/controls_registered', [ $this, 'register_control_type' ] );

        // Enqueue the editor JS + CSS that drive the swatch UI.
        add_action( 'elementor/editor/before_enqueue_scripts', [ $this, 'enqueue_editor_assets' ] );

        // The "common" element is Elementor's pseudo-widget that holds
        // controls shared across every other widget. Adding to its
        // `_section_style` tab means our section shows up at the
        // bottom of EVERY native widget's Style tab — heading,
        // text-editor, button, image, icon, divider, spacer, etc.
        add_action(
            'elementor/element/common/_section_style/after_section_end',
            [ $this, 'add_palette_section' ],
            10,
            2
        );
    }

    public function register_control_type( $controls_manager ): void {
        if ( method_exists( $controls_manager, 'register' ) ) {
            $controls_manager->register( new Palette_Control() );
        } elseif ( method_exists( $controls_manager, 'register_control' ) ) {
            // Older Elementor (<3.5) compatibility.
            $controls_manager->register_control( Palette_Control::TYPE, new Palette_Control() );
        }
    }

    public function enqueue_editor_assets(): void {
        $js_file  = TEMPALOO_STUDIO_DIR . 'assets/js/palette-control.js';
        $css_file = TEMPALOO_STUDIO_DIR . 'assets/css/palette-control.css';

        if ( file_exists( $js_file ) ) {
            wp_enqueue_script(
                'tempaloo-studio-palette-control',
                TEMPALOO_STUDIO_URL . 'assets/js/palette-control.js',
                [ 'jquery', 'elementor-editor' ],
                TEMPALOO_STUDIO_VERSION . '-' . filemtime( $js_file ),
                true
            );
        }
        if ( file_exists( $css_file ) ) {
            wp_enqueue_style(
                'tempaloo-studio-palette-control',
                TEMPALOO_STUDIO_URL . 'assets/css/palette-control.css',
                [],
                TEMPALOO_STUDIO_VERSION . '-' . filemtime( $css_file )
            );
        }
    }

    /**
     * @param \Elementor\Element_Base $element The widget being modified.
     * @param array                   $args
     */
    public function add_palette_section( $element, $args ): void {
        $template = $this->templates->active();
        if ( ! $template ) return;

        $light = is_array( $template['tokens']['light'] ?? null ) ? $template['tokens']['light'] : [];
        $dark  = is_array( $template['tokens']['dark']  ?? null ) ? $template['tokens']['dark']  : [];
        if ( empty( $light ) ) return;

        // Build groups in the swatch format expected by Palette_Control
        // (Underscore template iterates over `palette_groups`).
        $groups = $this->build_palette_groups( $light, $dark );
        if ( empty( $groups ) ) return;

        $template_name = $template['name'] ?? 'Tempaloo Studio';

        $element->start_controls_section(
            'tempaloo_palette_section',
            [
                'label' => '🎨 ' . sprintf(
                    /* translators: %s: active template display name */
                    esc_html__( '%s palette', 'tempaloo-studio' ),
                    $template_name
                ),
                'tab'   => Controls_Manager::TAB_STYLE,
            ]
        );

        $element->add_control(
            'tempaloo_palette_intro',
            [
                'type' => Controls_Manager::RAW_HTML,
                'raw'  => '<p style="font-size:11px;line-height:1.5;color:#a4afb7;margin:0;">'
                        . esc_html__( 'Pick a token from the active template. Light/Dark variants are auto-resolved — one pick covers both modes. ☀ left half = light, ☾ right half = dark.', 'tempaloo-studio' )
                        . '</p>',
            ]
        );

        // ── Text color ─────────────────────────────────────────
        $element->add_control(
            'tempaloo_text_color',
            [
                'label'          => esc_html__( 'Text color', 'tempaloo-studio' ),
                'type'           => Palette_Control::TYPE,
                'palette_groups' => $groups,
                'default'        => '',
                'selectors'      => [
                    '{{WRAPPER}}, {{WRAPPER}} *' => 'color: {{VALUE}} !important;',
                ],
            ]
        );

        // ── Background color ───────────────────────────────────
        $element->add_control(
            'tempaloo_bg_color',
            [
                'label'          => esc_html__( 'Background color', 'tempaloo-studio' ),
                'type'           => Palette_Control::TYPE,
                'palette_groups' => $groups,
                'default'        => '',
                'selectors'      => [
                    '{{WRAPPER}} > .elementor-widget-container' => 'background-color: {{VALUE}} !important;',
                    '{{WRAPPER}} .elementor-button'             => 'background-color: {{VALUE}} !important;',
                ],
            ]
        );

        // ── Border color ───────────────────────────────────────
        $element->add_control(
            'tempaloo_border_color',
            [
                'label'          => esc_html__( 'Border color', 'tempaloo-studio' ),
                'type'           => Palette_Control::TYPE,
                'palette_groups' => $groups,
                'default'        => '',
                'selectors'      => [
                    '{{WRAPPER}} > .elementor-widget-container' => 'border-color: {{VALUE}} !important;',
                    '{{WRAPPER}} .elementor-button'             => 'border-color: {{VALUE}} !important;',
                ],
            ]
        );

        // ── Link / hover accent ────────────────────────────────
        $element->add_control(
            'tempaloo_link_color',
            [
                'label'          => esc_html__( 'Link / accent color', 'tempaloo-studio' ),
                'type'           => Palette_Control::TYPE,
                'palette_groups' => $groups,
                'default'        => '',
                'selectors'      => [
                    '{{WRAPPER}} a, {{WRAPPER}} a:visited' => 'color: {{VALUE}} !important;',
                ],
            ]
        );

        $element->end_controls_section();
    }

    /**
     * Group + format tokens for the dropdown.
     * Returns a map of group label → list of [value, label] rows.
     */
    private function build_palette_groups( array $light, array $dark ): array {
        $groups_meta = [
            'Backgrounds' => [
                'match' => [ '/^--tw-[^-]+-bg(-|$)/' ],
            ],
            'Text'        => [
                'match' => [ '/^--tw-[^-]+-text(-|$)/' ],
            ],
            'Accent'      => [
                'match' => [ '/^--tw-[^-]+-accent(-|$)/' ],
            ],
            'Borders'     => [
                'match' => [ '/^--tw-[^-]+-border(-|$)/' ],
            ],
            'Buttons'     => [
                'match' => [ '/^--tw-[^-]+-(btn|cta)-/' ],
            ],
        ];

        $out = [];
        foreach ( $groups_meta as $group => $cfg ) {
            $matches = [];
            foreach ( $light as $name => $value ) {
                if ( ! is_string( $name ) || strpos( $name, '--tw-' ) !== 0 ) continue;
                if ( ! $this->is_color_value( (string) $value ) ) continue;
                $hit = false;
                foreach ( $cfg['match'] as $rx ) {
                    if ( preg_match( $rx, $name ) ) { $hit = true; break; }
                }
                if ( ! $hit ) continue;

                $short_name = preg_replace( '/^--tw-[^-]+-/', '', $name );
                $light_val  = (string) $value;
                $dark_val   = isset( $dark[ $name ] ) ? (string) $dark[ $name ] : $light_val;

                $matches[] = [
                    'name'  => $short_name,
                    'value' => 'var(' . $name . ')',
                    'light' => $light_val,
                    'dark'  => $dark_val,
                ];
            }
            if ( ! empty( $matches ) ) {
                usort( $matches, static function ( $a, $b ) { return strcmp( $a['name'], $b['name'] ); } );
                $out[ $group ] = $matches;
            }
        }
        return $out;
    }

    private function is_color_value( string $v ): bool {
        $t = trim( $v );
        if ( $t === '' ) return false;
        if ( $t === 'transparent' || $t === 'currentColor' ) return true;
        return (bool) preg_match( '/^(#|rgb|hsl|color|linear-gradient|radial-gradient)/i', $t );
    }
}
