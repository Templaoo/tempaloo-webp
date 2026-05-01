<?php
/**
 * Widget_Base — abstract every Tempaloo Studio widget extends.
 *
 * Bakes in:
 *   - The shared "tempaloo-studio" Elementor category
 *   - Auto-discovery of script.js inside the widget folder
 *   - get_template() override mechanism so each widget knows which
 *     template it ships with (used by Frontend\Assets to gate enqueues)
 *
 * Per the WIDGET-SPEC: each widget keeps NO per-widget CSS — the
 * styles live in the active template's global.css. Likewise no
 * per-widget script unless the widget actually needs animation, in
 * which case it places `script.js` next to widget.php and this
 * base class auto-registers the handle.
 *
 * @package Tempaloo\Studio\Elementor
 */

namespace Tempaloo\Studio\Elementor;

defined( 'ABSPATH' ) || exit;

abstract class Widget_Base extends \Elementor\Widget_Base {

    /**
     * Template slug the widget ships with (e.g. "avero-consulting").
     * Concrete widget classes MUST override.
     */
    abstract public function get_template_slug(): string;

    public function get_categories(): array {
        // One category per template: when Avero is active, its widgets
        // appear under "Avero Consulting" in Elementor's panel — not a
        // generic "Tempaloo Studio" bucket. Future templates each get
        // their own panel section.
        return [ 'tempaloo-studio-' . $this->get_template_slug() ];
    }

    public function get_keywords(): array {
        return [ 'tempaloo', 'studio', $this->get_template_slug(), $this->get_name() ];
    }

    /**
     * Auto-register the widget's script.js when it exists. Frontend\Assets
     * actually enqueues the file; we just declare the handle here so
     * Elementor knows to load it on pages that include this widget.
     */
    public function get_script_depends(): array {
        return [ 'tempaloo-studio-' . $this->get_name() ];
    }

    /**
     * Tempaloo Studio widgets share a single global stylesheet per
     * template. Frontend\Assets enqueues it once when the active
     * template's first widget renders. Widgets declare no per-widget
     * style.
     */
    public function get_style_depends(): array {
        return [ 'tempaloo-studio-' . $this->get_template_slug() . '-global' ];
    }

    /**
     * Convenience: build an asset URL from the widget folder, e.g.
     * `$this->asset('img/hero.png')` → http://site/.../widgets/avero-hero/img/hero.png
     */
    protected function asset( string $relative ): string {
        return TEMPALOO_STUDIO_TEMPLATES_URL
            . $this->get_template_slug() . '/widgets/'
            . $this->get_name() . '/' . ltrim( $relative, '/' );
    }

    /**
     * Convenience: pull a setting with a default. Defends against
     * missing keys without forcing render() to scatter null-coalesces.
     */
    protected function s( array $settings, string $key, $default = '' ) {
        return isset( $settings[ $key ] ) && $settings[ $key ] !== '' ? $settings[ $key ] : $default;
    }
}
