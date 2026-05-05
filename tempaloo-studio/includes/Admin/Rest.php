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
use Tempaloo\Studio\Elementor\Animation_Presets;
use Tempaloo\Studio\Elementor\Animation_Profiles;
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
        // ── v2 endpoints — typed schema-driven config (Plan A) ──────
        register_rest_route( self::NS, '/animation/library', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'get_library' ],
            'permission_callback' => [ $this, 'can_manage' ],
        ] );
        register_rest_route( self::NS, '/animation/v2', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'get_animation_v2' ],
            'permission_callback' => [ $this, 'can_manage' ],
        ] );
        // ── Niveau 4 — selector-targeted overrides (Animate Mode) ──
        register_rest_route( self::NS, '/animation/v2/selector-override', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'set_selector_override' ],
            'permission_callback' => [ $this, 'can_manage' ],
            'args'                => [
                'selector' => [
                    'required'    => true,
                    'type'        => 'string',
                    'description' => 'CSS selector to target (sanitised server-side).',
                ],
                'rule' => [
                    'required'    => true,
                    'type'        => 'object',
                    'description' => '{ preset, params, scrollTrigger, direction? }',
                ],
                'label' => [
                    'type'        => 'string',
                    'description' => 'Human-friendly label for the audit list.',
                ],
            ],
        ] );
        register_rest_route( self::NS, '/animation/v2/selector-override/delete', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'delete_selector_override' ],
            'permission_callback' => [ $this, 'can_manage' ],
            'args'                => [
                'selector' => [
                    'required' => true,
                    'type'     => 'string',
                ],
            ],
        ] );

        // Bulk delete — accepts an array of selector strings, kills them
        // all in a single round-trip. Used by the floating panel's
        // "Delete selected (N)" action.
        register_rest_route( self::NS, '/animation/v2/selector-override/delete-bulk', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'delete_selector_overrides_bulk' ],
            'permission_callback' => [ $this, 'can_manage' ],
            'args'                => [
                'selectors' => [
                    'required' => true,
                    'type'     => 'array',
                    'items'    => [ 'type' => 'string' ],
                ],
            ],
        ] );

        // Master enable/disable — toggles `globals.intensity`. Setting
        // intensity to "off" disables every animation site-wide
        // (Animation::has_active_rules() returns false → GSAP no-ops
        // every preset). Restoring to "medium" / "bold" / etc. brings
        // the active profile's animations back without reapplying.
        register_rest_route( self::NS, '/animation/v2/intensity', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'set_intensity' ],
            'permission_callback' => [ $this, 'can_manage' ],
            'args'                => [
                'intensity' => [
                    'required' => true,
                    'type'     => 'string',
                    'enum'     => Animation::ALLOWED,
                ],
            ],
        ] );

        // ── Plan B — profiles ───────────────────────────────────
        register_rest_route( self::NS, '/animation/profiles', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'list_profiles' ],
            'permission_callback' => [ $this, 'can_manage' ],
        ] );
        register_rest_route( self::NS, '/animation/profiles/apply', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'apply_profile' ],
            'permission_callback' => [ $this, 'can_manage' ],
            'args'                => [
                'id' => [
                    'required'          => true,
                    'type'              => 'string',
                    'sanitize_callback' => 'sanitize_key',
                ],
            ],
        ] );
        register_rest_route( self::NS, '/animation/profiles/save', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'save_user_profile' ],
            'permission_callback' => [ $this, 'can_manage' ],
            'args'                => [
                'profile' => [
                    'required' => true,
                    'type'     => 'object',
                ],
            ],
        ] );
        register_rest_route( self::NS, '/animation/profiles/snapshot', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'snapshot_profile' ],
            'permission_callback' => [ $this, 'can_manage' ],
            'args'                => [
                'id'          => [ 'required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_key' ],
                'label'       => [ 'required' => true, 'type' => 'string' ],
                'description' => [ 'type' => 'string' ],
            ],
        ] );
        register_rest_route( self::NS, '/animation/profiles/delete', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'delete_user_profile' ],
            'permission_callback' => [ $this, 'can_manage' ],
            'args'                => [
                'id' => [
                    'required'          => true,
                    'type'              => 'string',
                    'sanitize_callback' => 'sanitize_key',
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

    /* ─────────────────────────────────────────────────────────────
     * v2 endpoints — Plan A typed schema
     * ──────────────────────────────────────────────────────────── */

    /**
     * GET /animation/library — full preset schema (presets, enums,
     * element types, behaviors). The React admin auto-generates UI
     * controls from this.
     */
    public function get_library(): \WP_REST_Response {
        return rest_ensure_response( Animation_Presets::library() );
    }

    /**
     * GET /animation/v2 — full v2 config (globals + element rules +
     * selector overrides) plus context the admin needs.
     */
    public function get_animation_v2(): \WP_REST_Response {
        $v2     = Animation::config_v2();
        $active = $this->templates->active();
        $slug   = $active ? (string) $active['slug'] : '';

        $widget_list = ( $active && is_array( $active['widgets'] ?? null ) )
                            ? array_values( $active['widgets'] )
                            : [];

        return rest_ensure_response( [
            'version'           => $v2['__version'] ?? '2.0.0',
            'globals'           => $v2['globals'],
            'elementRules'      => $v2['elementRules'],
            'selectorOverrides' => (object) Animation::selector_overrides(),
            'templateSlug'      => $slug,
            'widgets'           => $widget_list,
            'activeProfile'     => Animation_Profiles::active_id(),
            'allowed'           => [
                'intensity'    => Animation::ALLOWED,
                'direction'    => Animation::DIRECTIONS,
                'reduceMotion' => Animation::REDUCE_MOTION,
                'elementTypes' => Animation_Presets::element_type_ids(),
                'presets'      => Animation_Presets::preset_ids(),
            ],
        ] );
    }

    /* ─────────────────────────────────────────────────────────────
     * Niveau 4 — selector-targeted overrides (click-driven Animate)
     * ──────────────────────────────────────────────────────────── */

    public function set_selector_override( \WP_REST_Request $req ) {
        $selector = (string) $req->get_param( 'selector' );
        $rule     = $req->get_param( 'rule' );
        $label    = (string) ( $req->get_param( 'label' ) ?? '' );
        if ( ! is_array( $rule ) ) {
            return new \WP_Error( 'bad_rule', 'rule must be an object', [ 'status' => 400 ] );
        }
        if ( ! Animation::set_selector_override( $selector, [ 'rule' => $rule, 'label' => $label ] ) ) {
            return new \WP_Error( 'bad_selector', 'Invalid selector or rule', [ 'status' => 400 ] );
        }
        return $this->get_animation_v2();
    }

    public function delete_selector_override( \WP_REST_Request $req ) {
        $selector = (string) $req->get_param( 'selector' );
        if ( ! Animation::delete_selector_override( $selector ) ) {
            return new \WP_Error( 'not_found', 'Selector override not found', [ 'status' => 404 ] );
        }
        return $this->get_animation_v2();
    }

    /**
     * Bulk-delete selector overrides — best-effort: each selector that
     * fails to delete is reported in `failed[]` but doesn't abort the
     * batch. Useful for the floating panel's multi-select bulk delete.
     */
    public function delete_selector_overrides_bulk( \WP_REST_Request $req ) {
        $selectors = (array) $req->get_param( 'selectors' );
        $deleted   = [];
        $failed    = [];
        foreach ( $selectors as $sel ) {
            $sel = (string) $sel;
            if ( $sel === '' ) continue;
            if ( Animation::delete_selector_override( $sel ) ) {
                $deleted[] = $sel;
            } else {
                $failed[] = $sel;
            }
        }
        $state = $this->get_animation_v2()->get_data();
        $state['_bulk'] = [ 'deleted' => $deleted, 'failed' => $failed ];
        return rest_ensure_response( $state );
    }

    /**
     * POST /animation/v2/intensity — toggle the global animation
     * intensity. Setting to "off" disables every animation on the
     * site (has_active_rules → false, GSAP enqueue gates skip the
     * scripts entirely). Setting to "medium" / "subtle" / "bold"
     * brings them back instantly — no profile re-apply needed.
     */
    public function set_intensity( \WP_REST_Request $req ) {
        $intensity = (string) $req->get_param( 'intensity' );
        if ( ! Animation::set_intensity( $intensity ) ) {
            return new \WP_Error( 'bad_intensity', 'Invalid intensity value', [ 'status' => 400 ] );
        }
        return $this->get_animation_v2();
    }

    /* ─────────────────────────────────────────────────────────────
     * Plan B — Animation Profiles
     * ──────────────────────────────────────────────────────────── */

    public function list_profiles(): \WP_REST_Response {
        return rest_ensure_response( [
            'profiles' => Animation_Profiles::all(),
            'active'   => Animation_Profiles::active_id(),
        ] );
    }

    public function apply_profile( \WP_REST_Request $req ) {
        $id = (string) $req->get_param( 'id' );
        if ( ! Animation_Profiles::apply( $id ) ) {
            return new \WP_Error( 'not_found', 'Profile not found', [ 'status' => 404 ] );
        }
        return $this->get_animation_v2();
    }

    public function save_user_profile( \WP_REST_Request $req ) {
        $profile = $req->get_param( 'profile' );
        if ( ! is_array( $profile ) || empty( $profile['id'] ) ) {
            return new \WP_Error( 'bad_profile', 'profile.id required', [ 'status' => 400 ] );
        }
        if ( ! Animation_Profiles::save_user_profile( $profile ) ) {
            return new \WP_Error( 'save_failed', 'Could not save profile', [ 'status' => 400 ] );
        }
        return $this->list_profiles();
    }

    public function snapshot_profile( \WP_REST_Request $req ) {
        $id    = (string) $req->get_param( 'id' );
        $label = (string) $req->get_param( 'label' );
        $desc  = (string) ( $req->get_param( 'description' ) ?? '' );
        $snap  = Animation_Profiles::snapshot_current( $id, $label, $desc );
        if ( ! Animation_Profiles::save_user_profile( $snap ) ) {
            return new \WP_Error( 'save_failed', 'Could not snapshot', [ 'status' => 400 ] );
        }
        return $this->list_profiles();
    }

    public function delete_user_profile( \WP_REST_Request $req ) {
        $id = (string) $req->get_param( 'id' );
        if ( ! Animation_Profiles::delete_user_profile( $id ) ) {
            return new \WP_Error( 'not_found', 'Profile not found', [ 'status' => 404 ] );
        }
        return $this->list_profiles();
    }
}
