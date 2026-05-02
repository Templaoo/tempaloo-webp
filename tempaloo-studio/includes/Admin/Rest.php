<?php
/**
 * Admin\Rest — REST endpoints the React admin will call in Phase 1.
 *
 * Phase 1 surface (minimal, enough to validate the pipe):
 *   GET  /tempaloo-studio/v1/templates           list available templates
 *   GET  /tempaloo-studio/v1/template/{slug}     full manifest for a single template
 *   POST /tempaloo-studio/v1/activate            { slug } → set active
 *   POST /tempaloo-studio/v1/deactivate          → clear active
 *   GET  /tempaloo-studio/v1/state               consolidated read for the React app
 *   POST /tempaloo-studio/v1/tokens/override     { slug, mode, vars } → save user-tuned tokens
 *
 * @package Tempaloo\Studio\Admin
 */

namespace Tempaloo\Studio\Admin;

defined( 'ABSPATH' ) || exit;

use Tempaloo\Studio\Elementor\Template_Manager;
use Tempaloo\Studio\Elementor\Theme_Tokens;
use Tempaloo\Studio\Elementor\Animation;
use Tempaloo\Studio\Elementor\Page_Importer;

final class Rest {

    const NS = 'tempaloo-studio/v1';

    private Template_Manager $templates;

    public function __construct( Template_Manager $templates ) {
        $this->templates = $templates;
    }

    public function register(): void {
        add_action( 'rest_api_init', [ $this, 'routes' ] );
    }

    public function routes(): void {
        // Args declarations below add type hints + sanitize_callbacks
        // for self-documenting endpoints. We deliberately AVOID strict
        // validate_callbacks here — handlers already do defensive
        // filtering and rejecting payloads earlier would break the
        // current React admin contract.
        $slug_arg = [
            'required'          => true,
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_key',
            'description'       => 'Template slug (a-z 0-9 hyphens only).',
        ];

        register_rest_route( self::NS, '/templates', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'list_templates' ],
            'permission_callback' => [ $this, 'can_manage' ],
        ] );
        register_rest_route( self::NS, '/template/(?P<slug>[a-z0-9-]+)', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'get_template' ],
            'permission_callback' => [ $this, 'can_manage' ],
            'args'                => [ 'slug' => $slug_arg ],
        ] );
        register_rest_route( self::NS, '/activate', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'activate' ],
            'permission_callback' => [ $this, 'can_manage' ],
            'args'                => [ 'slug' => $slug_arg ],
        ] );
        register_rest_route( self::NS, '/deactivate', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'deactivate' ],
            'permission_callback' => [ $this, 'can_manage' ],
        ] );
        register_rest_route( self::NS, '/state', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'state' ],
            'permission_callback' => [ $this, 'can_manage' ],
        ] );
        register_rest_route( self::NS, '/tokens/override', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'save_tokens' ],
            'permission_callback' => [ $this, 'can_manage' ],
            'args'                => [
                'slug' => $slug_arg,
                'mode' => [
                    'required'    => true,
                    'type'        => 'string',
                    'enum'        => [ 'light', 'dark' ],
                    'description' => 'Theme mode this override applies to.',
                ],
                'vars' => [
                    'required'    => true,
                    'type'        => 'object',
                    'description' => 'Map of CSS custom property names → values. Server-side allowlist filters bad keys/values.',
                ],
            ],
        ] );
        register_rest_route( self::NS, '/import-pages', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'import_pages' ],
            'permission_callback' => [ $this, 'can_manage' ],
            'args'                => [
                'slug'    => $slug_arg,
                'replace' => [
                    'type'        => 'boolean',
                    'default'     => false,
                    'description' => 'When true, overwrite existing pages of the same slug.',
                ],
            ],
        ] );
        register_rest_route( self::NS, '/animation', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'get_animation' ],
            'permission_callback' => [ $this, 'can_manage' ],
        ] );
        register_rest_route( self::NS, '/animation', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'set_animation' ],
            'permission_callback' => [ $this, 'can_manage' ],
            'args'                => [
                'intensity'     => [
                    'type'        => 'string',
                    'enum'        => Animation::ALLOWED,
                    'description' => 'Global animation intensity: off | subtle | medium | bold.',
                ],
                'template_slug' => [
                    'type'              => 'string',
                    'sanitize_callback' => 'sanitize_key',
                    'description'       => 'Template these per-widget presets belong to.',
                ],
                'presets'       => [
                    'type'        => 'object',
                    'description' => 'widget_slug → { entrance, stagger, duration, trigger }.',
                ],
            ],
        ] );
    }

    public function can_manage(): bool {
        return current_user_can( 'manage_options' );
    }

    public function list_templates(): \WP_REST_Response {
        $out = [];
        foreach ( $this->templates->all() as $slug => $tpl ) {
            $out[] = [
                'slug'        => $slug,
                'name'        => $tpl['name'] ?? $slug,
                'category'    => $tpl['category'] ?? '',
                'version'     => $tpl['version'] ?? '0',
                'description' => $tpl['description'] ?? '',
                'thumbnail'   => $tpl['thumbnail'] ?? '',
                'widgets_count' => is_array( $tpl['widgets'] ?? null ) ? count( $tpl['widgets'] ) : 0,
            ];
        }
        return rest_ensure_response( [ 'templates' => $out ] );
    }

    public function get_template( \WP_REST_Request $req ) {
        $slug = sanitize_key( (string) $req->get_param( 'slug' ) );
        $tpl  = $this->templates->get( $slug );
        if ( ! $tpl ) return new \WP_Error( 'not_found', 'Template not found', [ 'status' => 404 ] );
        return rest_ensure_response( $tpl );
    }

    public function activate( \WP_REST_Request $req ) {
        $slug = sanitize_key( (string) $req->get_param( 'slug' ) );
        if ( ! $this->templates->set_active( $slug ) ) {
            return new \WP_Error( 'invalid_slug', 'Unknown template', [ 'status' => 400 ] );
        }
        return $this->state();
    }

    public function deactivate(): \WP_REST_Response {
        $this->templates->set_active( '' );
        return $this->state();
    }

    public function state(): \WP_REST_Response {
        $active = $this->templates->active();
        $overrides = get_option( Theme_Tokens::OVERRIDES_OPTION, [] );
        return rest_ensure_response( [
            'active_slug' => $active ? $active['slug'] : null,
            'active'      => $active,
            'overrides'   => is_array( $overrides ) ? $overrides : [],
        ] );
    }

    public function save_tokens( \WP_REST_Request $req ) {
        $slug = sanitize_key( (string) $req->get_param( 'slug' ) );
        $mode = (string) $req->get_param( 'mode' );
        $vars = $req->get_param( 'vars' );
        if ( ! in_array( $mode, [ 'light', 'dark' ], true ) ) {
            return new \WP_Error( 'bad_mode', 'mode must be light or dark', [ 'status' => 400 ] );
        }
        if ( ! is_array( $vars ) ) {
            return new \WP_Error( 'bad_vars', 'vars must be an object', [ 'status' => 400 ] );
        }
        // Sanitize: only --tw-* keys, value matches the same allowlist
        // as Theme_Tokens emit. Defence in depth — UI-side validation
        // is not enough, an attacker could bypass it via curl.
        $clean = [];
        foreach ( $vars as $name => $value ) {
            if ( strpos( $name, '--' ) !== 0 ) continue;
            $name  = preg_replace( '/[^a-zA-Z0-9_-]/', '', $name );
            $value = (string) $value;
            // Same allowlist as Theme_Tokens::vars_to_css() — keep both
            // in sync. Allows quoted font-family lists, hex/rgb/hsl,
            // var()/calc(), gradients, plain numerics + units.
            if ( ! preg_match( '/^[a-zA-Z0-9_\-#.,():%\s\/\'"]+$/', $value ) ) continue;
            if ( stripos( $value, '</style' ) !== false ) continue;
            $clean[ $name ] = $value;
        }
        $all = get_option( Theme_Tokens::OVERRIDES_OPTION, [] );
        if ( ! is_array( $all ) ) $all = [];
        $all[ $slug ][ $mode ] = $clean;
        update_option( Theme_Tokens::OVERRIDES_OPTION, $all );
        return $this->state();
    }

    /**
     * POST /import-pages — body: { slug }. Triggers the Page_Importer
     * to materialize every page declared in the template's manifest as
     * actual WP_Posts (idempotent: skips existing slugs).
     */
    public function import_pages( \WP_REST_Request $req ) {
        $slug    = sanitize_key( (string) $req->get_param( 'slug' ) );
        $replace = (bool) $req->get_param( 'replace' );
        if ( ! $this->templates->get( $slug ) ) {
            return new \WP_Error( 'not_found', 'Unknown template', [ 'status' => 404 ] );
        }
        $importer = new Page_Importer( $this->templates );

        $page_results = $importer->import_template_pages( $slug, $replace );
        $menu_results = $importer->import_template_menus( $slug, $replace );

        $pages = [];
        foreach ( $page_results as $page_slug => $info ) {
            $id = (int) ( $info['id'] ?? 0 );
            if ( ! $id ) continue;
            $pages[ $page_slug ] = [
                'id'       => $id,
                'action'   => $info['action'] ?? 'created',
                'edit_url' => admin_url( 'post.php?post=' . $id . '&action=elementor' ),
                'view_url' => get_permalink( $id ),
            ];
        }

        $menus = [];
        foreach ( $menu_results as $menu_slug => $info ) {
            $id = (int) ( $info['id'] ?? 0 );
            if ( ! $id ) continue;
            $menus[ $menu_slug ] = [
                'id'       => $id,
                'action'   => $info['action'] ?? 'created',
                'edit_url' => admin_url( 'nav-menus.php?action=edit&menu=' . $id ),
            ];
        }

        return rest_ensure_response( [ 'pages' => $pages, 'menus' => $menus ] );
    }

    public function get_animation(): \WP_REST_Response {
        $active = $this->templates->active();
        $slug   = $active ? (string) $active['slug'] : '';

        $animation = new Animation( $this->templates );
        $presets   = $slug !== '' ? $animation->presets_for( $slug ) : [];

        // Group preset names by category for nicer dropdowns in the admin.
        $entrance_text = [
            'word-fade-up', 'word-fade-blur', 'word-slide-up-overflow',
            'char-up', 'line-fade-up-stagger', 'text-typing', 'text-fill-sweep',
            'scroll-words-fill', 'editorial-stack',
        ];
        $entrance_element = array_values( array_diff( Animation::PRESETS, $entrance_text ) );

        return rest_ensure_response( [
            'intensity'        => Animation::intensity(),
            'allowed'          => Animation::ALLOWED,
            'presets_allowed'  => Animation::PRESETS,
            'presets_grouped'  => [
                'element' => $entrance_element,
                'text'    => $entrance_text,
            ],
            'template_slug'    => $slug,
            'widgets'          => $active && is_array( $active['widgets'] ?? null ) ? array_values( $active['widgets'] ) : [],
            'presets'          => (object) $presets,
        ] );
    }

    public function set_animation( \WP_REST_Request $req ) {
        $intensity     = $req->get_param( 'intensity' );
        $presets       = $req->get_param( 'presets' );
        $template_slug = sanitize_key( (string) ( $req->get_param( 'template_slug' ) ?? '' ) );

        if ( $intensity !== null && $intensity !== '' ) {
            if ( ! Animation::set_intensity( (string) $intensity ) ) {
                return new \WP_Error( 'bad_intensity', 'Allowed values: ' . implode( ', ', Animation::ALLOWED ), [ 'status' => 400 ] );
            }
        }

        if ( is_array( $presets ) && $template_slug !== '' ) {
            $animation = new Animation( $this->templates );
            foreach ( $presets as $widget => $cfg ) {
                if ( ! is_array( $cfg ) ) continue;
                $animation->set_preset( $template_slug, (string) $widget, $cfg );
            }
        }

        return $this->get_animation();
    }
}
