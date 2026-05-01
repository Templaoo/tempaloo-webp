<?php
/**
 * Plugin orchestrator (singleton). Lazy-loads subsystems by context.
 *
 * @package Tempaloo\Studio
 */

namespace Tempaloo\Studio;

defined( 'ABSPATH' ) || exit;

use Tempaloo\Studio\Elementor\Template_Manager;
use Tempaloo\Studio\Elementor\Widget_Registry;
use Tempaloo\Studio\Elementor\Theme_Tokens;
use Tempaloo\Studio\Elementor\Breakpoints;
use Tempaloo\Studio\Elementor\Animation;
use Tempaloo\Studio\Elementor\Page_Importer;
use Tempaloo\Studio\Frontend\Assets;
use Tempaloo\Studio\Admin\Menu;
use Tempaloo\Studio\Admin\Rest;

final class Plugin {

    private static ?Plugin $instance = null;

    public static function instance(): Plugin {
        return self::$instance ??= new self();
    }

    private function __construct() {}

    public function boot(): void {
        // Always-on subsystems. The Template_Manager is shared between
        // admin (lists available templates) and frontend (knows which
        // template is active to inject tokens).
        $templates = Template_Manager::instance();

        // Frontend: inject theme tokens + breakpoint sync + enqueue
        // active template's global.css/global.js. Skipped on admin
        // requests where the editor handles its own asset pipeline.
        ( new Theme_Tokens( $templates ) )->register();
        ( new Breakpoints( $templates ) )->register();
        ( new Animation( $templates ) )->register();
        ( new Assets( $templates ) )->register();

        // Elementor: register the active template's widgets. Hooks
        // fire on every request because Elementor's editor may load
        // even on otherwise-public requests (preview, REST).
        ( new Widget_Registry( $templates ) )->register();

        // REST routes must be registered on every request — wp-json
        // requests do NOT pass through is_admin(). Permission_callback
        // gates each route with current_user_can('manage_options').
        ( new Rest( $templates ) )->register();

        // Page_Importer also registers theme nav-menu locations on
        // `after_setup_theme`, which runs for both frontend AND admin
        // requests. Must register everywhere so wp_nav_menu() calls
        // can resolve the active template's locations.
        ( new Page_Importer( $templates ) )->register();

        // Admin-only surfaces (the menu page + scaffolds that only need
        // to load inside wp-admin).
        if ( is_admin() ) {
            ( new Menu() )->register();
        }
    }
}
