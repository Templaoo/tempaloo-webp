<?php
/**
 * Page_Importer — create the mockup pages declared in template.json::pages
 * when the user installs/activates a template.
 *
 * Phase 1 stub. Will be wired to the activate flow + the React admin
 * once we have at least one mockup page exported from a real Elementor
 * page (Day 5 of Phase 1).
 *
 * @package Tempaloo\Studio\Elementor
 */

namespace Tempaloo\Studio\Elementor;

defined( 'ABSPATH' ) || exit;

final class Page_Importer {

    private Template_Manager $templates;

    public function __construct( Template_Manager $templates ) {
        $this->templates = $templates;
    }

    public function register(): void {
        // Register theme nav-menu locations declared by the active
        // template so wp_nav_menu(['theme_location' => …]) calls work.
        add_action( 'after_setup_theme', [ $this, 'register_locations' ], 20 );
    }

    /**
     * Walk the active template's manifest and register every declared
     * nav-menu location. Must run on `after_setup_theme` so theme
     * mods are loaded by the time we set them.
     */
    public function register_locations(): void {
        $template = $this->templates->active();
        if ( ! $template || empty( $template['menus'] ) || ! is_array( $template['menus'] ) ) return;

        $locations = [];
        foreach ( $template['menus'] as $def ) {
            if ( empty( $def['location'] ) ) continue;
            $loc = sanitize_key( (string) $def['location'] );
            if ( $loc === '' ) continue;
            $locations[ $loc ] = (string) ( $def['name'] ?? $loc );
        }
        if ( $locations ) register_nav_menus( $locations );
    }

    /**
     * Import all pages declared in a template's manifest. Returns a
     * map of slug → [ id, action ] where action is 'created', 'replaced'
     * or 'skipped'.
     *
     * @param bool $replace When true, existing pages with a matching
     *                      slug are overwritten (Elementor data + page
     *                      template), keeping the same post ID and
     *                      URLs. When false (default), existing pages
     *                      are skipped — the safe behaviour for end
     *                      users who may have edited their pages.
     */
    public function import_template_pages( string $template_slug, bool $replace = false ): array {
        $tpl = $this->templates->get( $template_slug );
        if ( ! $tpl || empty( $tpl['pages'] ) || ! is_array( $tpl['pages'] ) ) return [];

        $out = [];
        foreach ( $tpl['pages'] as $page_def ) {
            if ( empty( $page_def['slug'] ) || empty( $page_def['title'] ) ) continue;
            $slug          = sanitize_title( (string) $page_def['slug'] );
            $title         = sanitize_text_field( (string) $page_def['title'] );
            $page_template = $page_def['page_template'] ?? 'elementor_canvas';
            $elementor_data = $this->load_page_data( $tpl['dir_path'], $page_def['elementor_data'] ?? '' );

            $existing = get_page_by_path( $slug, OBJECT, 'page' );

            if ( $existing && ! $replace ) {
                $out[ $slug ] = [ 'id' => $existing->ID, 'action' => 'skipped' ];
                continue;
            }

            if ( $existing && $replace ) {
                // Overwrite the existing page in place. Keep the post
                // ID + URL stable, just refresh the Elementor data and
                // the page-template meta.
                wp_update_post( [
                    'ID'         => $existing->ID,
                    'post_title' => $title,
                ] );
                $this->write_elementor_meta( $existing->ID, $elementor_data, $page_template );
                $this->bust_elementor_css_cache( $existing->ID );
                $out[ $slug ] = [ 'id' => $existing->ID, 'action' => 'replaced' ];
                continue;
            }

            $post_id = wp_insert_post( [
                'post_type'     => 'page',
                'post_status'   => 'publish',
                'post_title'    => $title,
                'post_name'     => $slug,
                'page_template' => $page_template,
            ], true );

            if ( is_wp_error( $post_id ) ) continue;

            $this->write_elementor_meta( $post_id, $elementor_data, $page_template );
            $out[ $slug ] = [ 'id' => $post_id, 'action' => 'created' ];
        }
        return $out;
    }

    /**
     * Persist the Elementor postmeta keys + the WP page template.
     * Elementor expects a slashed JSON string in `_elementor_data`.
     */
    private function write_elementor_meta( int $post_id, array $elementor_data, string $page_template ): void {
        update_post_meta( $post_id, '_wp_page_template', $page_template );
        update_post_meta( $post_id, '_elementor_edit_mode', 'builder' );
        update_post_meta( $post_id, '_elementor_template_type', 'wp-page' );
        if ( ! empty( $elementor_data ) ) {
            update_post_meta( $post_id, '_elementor_data', wp_slash( wp_json_encode( $elementor_data ) ) );
        }
    }

    /**
     * Tell Elementor to regenerate the post's cached CSS file. Without
     * this, replacing the data leaves the previous compiled stylesheet
     * referencing dead nodes and triggers PHP warnings.
     */
    private function bust_elementor_css_cache( int $post_id ): void {
        if ( class_exists( '\Elementor\Core\Files\CSS\Post' ) ) {
            try {
                $css = new \Elementor\Core\Files\CSS\Post( $post_id );
                $css->update();
            } catch ( \Throwable $e ) { /* best effort */ }
        }
        // Bump the post's elementor version meta so frontend caches refresh.
        update_post_meta( $post_id, '_elementor_data_changed', time() );
    }

    private function load_page_data( string $dir_path, $value ): array {
        if ( is_array( $value ) ) return $value;
        if ( ! is_string( $value ) || $value === '' ) return [];
        $path = $dir_path . ltrim( $value, '/' );
        if ( ! file_exists( $path ) ) return [];
        $raw = file_get_contents( $path );
        $decoded = json_decode( (string) $raw, true );
        return is_array( $decoded ) ? $decoded : [];
    }

    /**
     * Materialize every WP nav menu declared in `template.json::menus`
     * with its items + theme-location binding. Idempotent: existing
     * menus with the same slug are skipped (or replaced if requested).
     *
     * @return array<string, array{id:int, action:string}>
     */
    public function import_template_menus( string $template_slug, bool $replace = false ): array {
        $tpl = $this->templates->get( $template_slug );
        if ( ! $tpl || empty( $tpl['menus'] ) || ! is_array( $tpl['menus'] ) ) return [];

        $out       = [];
        $locations = get_theme_mod( 'nav_menu_locations', [] );
        if ( ! is_array( $locations ) ) $locations = [];

        foreach ( $tpl['menus'] as $def ) {
            if ( ! is_array( $def ) ) continue;
            $menu_slug = sanitize_title( (string) ( $def['slug'] ?? '' ) );
            $menu_name = sanitize_text_field( (string) ( $def['name'] ?? $menu_slug ) );
            if ( $menu_slug === '' || $menu_name === '' ) continue;

            $existing = wp_get_nav_menu_object( $menu_slug );

            if ( $existing && ! $replace ) {
                $out[ $menu_slug ] = [ 'id' => (int) $existing->term_id, 'action' => 'skipped' ];
                continue;
            }

            if ( $existing && $replace ) {
                // Wipe items but keep the term — preserves location bindings.
                $items = wp_get_nav_menu_items( $existing->term_id );
                if ( is_array( $items ) ) {
                    foreach ( $items as $item ) wp_delete_post( $item->ID, true );
                }
                $menu_id = (int) $existing->term_id;
                $action  = 'replaced';
                wp_update_nav_menu_object( $menu_id, [ 'menu-name' => $menu_name ] );
            } else {
                $created = wp_create_nav_menu( $menu_name );
                if ( is_wp_error( $created ) ) continue;
                $menu_id = (int) $created;
                $action  = 'created';
                // Set the slug so future lookups by slug work.
                wp_update_term( $menu_id, 'nav_menu', [ 'slug' => $menu_slug ] );
            }

            foreach ( (array) ( $def['items'] ?? [] ) as $item ) {
                if ( ! is_array( $item ) ) continue;
                wp_update_nav_menu_item( $menu_id, 0, [
                    'menu-item-title'   => sanitize_text_field( (string) ( $item['title'] ?? '' ) ),
                    'menu-item-url'     => esc_url_raw( (string) ( $item['url'] ?? '#' ) ),
                    'menu-item-status'  => 'publish',
                ] );
            }

            if ( ! empty( $def['location'] ) ) {
                $loc = sanitize_key( (string) $def['location'] );
                if ( $loc !== '' ) $locations[ $loc ] = $menu_id;
            }

            $out[ $menu_slug ] = [ 'id' => $menu_id, 'action' => $action ];
        }

        if ( ! empty( $locations ) ) set_theme_mod( 'nav_menu_locations', $locations );
        return $out;
    }
}
