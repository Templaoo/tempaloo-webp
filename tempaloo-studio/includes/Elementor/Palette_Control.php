<?php
/**
 * Palette_Control — custom Elementor control type that renders the
 * active template's design tokens as visual swatches with both
 * light AND dark hex previews side-by-side.
 *
 * Replaces the previous SELECT dropdown with a clickable grid: each
 * token shows a split-color swatch (top-left half = light hex,
 * bottom-right half = dark hex) plus the token name underneath.
 * Click a swatch → its `var(--tw-{slug}-{name})` value lands in the
 * hidden setting that the widget's `selectors:` config consumes.
 *
 * Why a custom control:
 *   - Stock SELECT only renders text, no color preview at all.
 *   - Elementor's GLOBAL_COLOR control is tied to the Active Kit's
 *     own palette, can't display a third-party token system.
 *   - This control is purely additive — no kit modification, no
 *     destructive writes, opt-in per widget.
 *
 * Pairs with assets/js/palette-control.js (handles click → setting
 * sync) and assets/css/palette-control.css (swatch styling).
 *
 * @package Tempaloo\Studio\Elementor
 */

namespace Tempaloo\Studio\Elementor;

defined( 'ABSPATH' ) || exit;

use Elementor\Base_Data_Control;

class Palette_Control extends Base_Data_Control {

    const TYPE = 'tempaloo_palette';

    public function get_type(): string {
        return self::TYPE;
    }

    /**
     * Default values merged into every control instance. `palette_groups`
     * is supplied per-instance by Native_Widget_Controls — we just
     * declare the shape here so the editor template doesn't choke when
     * a control is added without explicit groups.
     */
    public function get_default_settings(): array {
        return [
            'palette_groups' => [], // [ group_label => [ { name, value, light, dark } ] ]
            'description'    => '',
        ];
    }

    /**
     * Underscore.js template rendered inside the Elementor editor for
     * this control. `data` is the merged control config + the current
     * setting value (`data.controlValue`).
     *
     * The hidden input carrying `data-setting="{{ data.name }}"` is
     * what Elementor reads to persist the selection — the JS file
     * (palette-control.js) wires button clicks to that input.
     */
    public function content_template(): void {
        ?>
        <div class="elementor-control-field tps-palette-field">
            <label class="elementor-control-title">{{{ data.label }}}</label>

            <div class="elementor-control-input-wrapper">
                <input type="hidden" data-setting="{{ data.name }}" />

                <div class="tps-palette" data-control-name="{{ data.name }}">

                    <# _.each( data.palette_groups, function ( rows, groupLabel ) { #>
                        <div class="tps-palette-group">
                            <div class="tps-palette-group__label">{{ groupLabel }}</div>
                            <div class="tps-palette-group__grid">
                                <# _.each( rows, function ( row ) {
                                    var isActive = data.controlValue === row.value;
                                #>
                                    <button
                                        type="button"
                                        class="tps-palette-swatch <# if ( isActive ) { #>is-active<# } #>"
                                        data-value="{{ row.value }}"
                                        title="{{ row.name }} — ☀ {{ row.light }} / ☾ {{ row.dark }}"
                                    >
                                        <span class="tps-palette-swatch__chip">
                                            <span class="tps-palette-swatch__chip-light" style="background:{{ row.light }}"></span>
                                            <span class="tps-palette-swatch__chip-dark"  style="background:{{ row.dark  }}"></span>
                                        </span>
                                        <span class="tps-palette-swatch__name">{{ row.name }}</span>
                                    </button>
                                <# } ); #>
                            </div>
                        </div>
                    <# } ); #>

                    <button type="button" class="tps-palette-clear" data-value="">
                        × <?php echo esc_html__( 'Clear', 'tempaloo-studio' ); ?>
                    </button>
                </div>
            </div>

            <# if ( data.description ) { #>
                <div class="elementor-control-field-description">{{{ data.description }}}</div>
            <# } #>
        </div>
        <?php
    }
}
