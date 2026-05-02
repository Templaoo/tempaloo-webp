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

        // Filter + group tokens into useful palette groups for the
        // dropdown. We expose only color tokens — fonts / radii /
        // shadows are handled by the Theme_Tokens bridge already.
        $groups = $this->build_palette_groups( $light, $dark );
        if ( empty( $groups ) ) return;

        // Flatten with section labels — Elementor's SELECT control
        // doesn't render <optgroup>, so the best we can do is prefix
        // each option with its group name. Keeps the list scannable.
        $options = [ '' => esc_html__( '— Default —', 'tempaloo-studio' ) ];
        foreach ( $groups as $group_label => $rows ) {
            $options[ '__group_' . $group_label ] = '──── ' . $group_label . ' ────';
            foreach ( $rows as $row ) {
                // $row = [ 'value' => 'var(...)', 'label' => '...' ]
                $options[ $row['value'] ] = $row['label'];
            }
        }

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
                        . esc_html__( 'Pick a token from the active template. Light/Dark variants are auto-resolved when the page theme switches — one pick covers both modes.', 'tempaloo-studio' )
                        . '</p>',
            ]
        );

        // ── Text color ─────────────────────────────────────────
        $element->add_control(
            'tempaloo_text_color',
            [
                'label'     => esc_html__( 'Text color', 'tempaloo-studio' ),
                'type'      => Controls_Manager::SELECT,
                'options'   => $options,
                'default'   => '',
                'selectors' => [
                    '{{WRAPPER}}, {{WRAPPER}} *' => 'color: {{VALUE}};',
                ],
                'condition' => [],
            ]
        );

        // ── Background color ───────────────────────────────────
        $element->add_control(
            'tempaloo_bg_color',
            [
                'label'     => esc_html__( 'Background color', 'tempaloo-studio' ),
                'type'      => Controls_Manager::SELECT,
                'options'   => $options,
                'default'   => '',
                'selectors' => [
                    '{{WRAPPER}} > .elementor-widget-container' => 'background-color: {{VALUE}};',
                    '{{WRAPPER}} .elementor-button'             => 'background-color: {{VALUE}};',
                ],
            ]
        );

        // ── Border color ───────────────────────────────────────
        $element->add_control(
            'tempaloo_border_color',
            [
                'label'     => esc_html__( 'Border color', 'tempaloo-studio' ),
                'type'      => Controls_Manager::SELECT,
                'options'   => $options,
                'default'   => '',
                'selectors' => [
                    '{{WRAPPER}} > .elementor-widget-container' => 'border-color: {{VALUE}};',
                    '{{WRAPPER}} .elementor-button'             => 'border-color: {{VALUE}};',
                ],
            ]
        );

        // ── Link / hover accent ────────────────────────────────
        $element->add_control(
            'tempaloo_link_color',
            [
                'label'     => esc_html__( 'Link / accent color', 'tempaloo-studio' ),
                'type'      => Controls_Manager::SELECT,
                'options'   => $options,
                'default'   => '',
                'selectors' => [
                    '{{WRAPPER}} a, {{WRAPPER}} a:visited' => 'color: {{VALUE}};',
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
                // Compact label that fits the dropdown width: token name +
                // light hex + dark hex. The user sees both modes at a
                // glance. e.g. "accent  ☀ #214d47  ☾ #3fb2a2"
                $label = $short_name
                       . '  ☀ ' . $this->short_color( $light_val )
                       . '  ☾ ' . $this->short_color( $dark_val );

                $matches[] = [
                    'value' => 'var(' . $name . ')',
                    'label' => $label,
                ];
            }
            if ( ! empty( $matches ) ) {
                // Sort each group alphabetically by token name.
                usort( $matches, static function ( $a, $b ) { return strcmp( $a['label'], $b['label'] ); } );
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

    /**
     * Trim long color values so the dropdown stays readable. Hex/rgb
     * stays; gradients & longer values get a "…" ellipsis.
     */
    private function short_color( string $v ): string {
        $t = trim( $v );
        if ( strlen( $t ) <= 16 ) return $t;
        return substr( $t, 0, 14 ) . '…';
    }
}
