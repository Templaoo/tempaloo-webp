<?php
/**
 * Widget_Registry — register the active template's widgets with Elementor.
 *
 * Convention (mandatory, validated on load):
 *   Widget slug:  template-slug-widget-slug   e.g. "avero-consulting-hero"
 *   Folder:       templates/{template}/widgets/{widget}/widget.php
 *   PHP class:    Tempaloo\Studio\Templates\{TemplateClass}\{WidgetClass}
 *
 * Only the ACTIVE template's widgets get registered. Switching templates
 * unregisters the old ones (Elementor handles this naturally — we just
 * stop adding them).
 *
 * @package Tempaloo\Studio\Elementor
 */

namespace Tempaloo\Studio\Elementor;

defined( 'ABSPATH' ) || exit;

final class Widget_Registry {

    private Template_Manager $templates;

    public function __construct( Template_Manager $templates ) {
        $this->templates = $templates;
    }

    public function register(): void {
        add_action( 'elementor/elements/categories_registered', [ $this, 'register_category' ] );
        add_action( 'elementor/widgets/register',               [ $this, 'register_widgets' ] );
    }

    public function register_category( \Elementor\Elements_Manager $elements_manager ): void {
        // Always register the meta-bucket so legacy widgets that opted
        // into 'tempaloo-studio' still find a home.
        $elements_manager->add_category( 'tempaloo-studio', [
            'title' => esc_html__( 'Tempaloo Studio', 'tempaloo-studio' ),
            'icon'  => 'eicon-favorite',
        ] );

        // Per-active-template category. Named after the template's
        // display name so the Elementor panel reads "Avero Consulting"
        // (premium feel) rather than "tempaloo-studio".
        $template = $this->templates->active();
        if ( ! $template ) return;
        $slug  = $template['slug'];
        $name  = isset( $template['name'] ) && is_string( $template['name'] ) ? $template['name'] : $slug;
        $elements_manager->add_category( 'tempaloo-studio-' . $slug, [
            'title' => esc_html( $name ),
            'icon'  => 'eicon-typography',
        ] );
    }

    public function register_widgets( \Elementor\Widgets_Manager $widgets_manager ): void {
        $template = $this->templates->active();
        if ( ! $template ) return;

        $template_slug = $template['slug'];
        $widgets_dir   = $template['dir_path'] . 'widgets/';
        if ( ! is_dir( $widgets_dir ) ) return;

        $declared = is_array( $template['widgets'] ?? null ) ? $template['widgets'] : [];
        /**
         * Filter — modify which widgets get registered for a template.
         * Useful for white-label forks that want to hide certain
         * widgets, OR for premium add-ons that ship extra widgets.
         *
         * @param array  $declared       array of widget slugs
         * @param string $template_slug  active template slug
         */
        $declared = (array) apply_filters( 'tempaloo_studio_widgets', $declared, $template_slug );

        foreach ( $declared as $widget_slug ) {
            $widget_slug = sanitize_key( $widget_slug );
            $widget_php  = $widgets_dir . $widget_slug . '/widget.php';
            if ( ! file_exists( $widget_php ) ) continue;

            require_once $widget_php;

            // Class name convention: Pascal-snake of full slug.
            // template "avero-consulting" + widget "hero"
            //   → class Tempaloo\Studio\Templates\Avero_Consulting\Hero
            $template_pascal = $this->pascalize( $template_slug );
            $widget_pascal   = $this->pascalize( $widget_slug );
            $fqcn = '\\Tempaloo\\Studio\\Templates\\' . $template_pascal . '\\' . $widget_pascal;
            if ( ! class_exists( $fqcn ) ) continue;

            $widgets_manager->register( new $fqcn() );
        }
    }

    /**
     * "avero-consulting" → "Avero_Consulting"
     */
    private function pascalize( string $slug ): string {
        return implode( '_', array_map(
            'ucfirst',
            explode( '-', strtolower( $slug ) )
        ) );
    }
}
