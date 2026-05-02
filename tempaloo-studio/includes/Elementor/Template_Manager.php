<?php
/**
 * Template_Manager — discovery + caching of available templates.
 *
 * Each subdirectory of /templates that contains a template.json is
 * a Tempaloo Studio template. The manager parses them, caches the
 * result in a transient, and exposes lookup helpers for everywhere
 * else in the plugin.
 *
 * @package Tempaloo\Studio\Elementor
 */

namespace Tempaloo\Studio\Elementor;

defined( 'ABSPATH' ) || exit;

final class Template_Manager {

    const ACTIVE_OPTION   = 'tempaloo_studio_active_template';
    const CACHE_KEY       = 'tempaloo_studio_templates_cache';
    const FINGERPRINT_KEY = 'tempaloo_studio_templates_fingerprint';
    const CACHE_TTL       = DAY_IN_SECONDS;

    private static ?Template_Manager $instance = null;
    private ?array $cache = null;

    public static function instance(): Template_Manager {
        return self::$instance ??= new self();
    }

    private function __construct() {}

    /**
     * @return array<string, array> Map slug → parsed template.json data
     *                              with extra keys: dir_path, dir_url, slug.
     */
    public function all(): array {
        if ( null !== $this->cache ) return $this->cache;

        // Bypass transient in WP_DEBUG so authoring tweaks show up
        // immediately. Production sites use the cache.
        $debug = defined( 'WP_DEBUG' ) && WP_DEBUG;

        if ( ! $debug ) {
            $cached      = get_transient( self::CACHE_KEY );
            $cached_fp   = get_transient( self::FINGERPRINT_KEY );
            $current_fp  = $this->fingerprint();
            if ( is_array( $cached ) && $cached_fp === $current_fp ) {
                $this->cache = $cached;
                return $this->cache;
            }
        }

        $this->cache = $this->scan();

        /**
         * Filter — let third-party plugins inject additional templates
         * or modify discovered ones. Receives the slug→manifest map,
         * must return the same shape. Use sparingly: this runs on most
         * page loads (cached), so heavy work here will hurt perf.
         *
         * @param array $templates  slug → manifest data
         */
        $this->cache = (array) apply_filters( 'tempaloo_studio_templates', $this->cache );

        if ( ! $debug ) {
            set_transient( self::CACHE_KEY,       $this->cache,        self::CACHE_TTL );
            set_transient( self::FINGERPRINT_KEY, $this->fingerprint(), self::CACHE_TTL );
        }
        return $this->cache;
    }

    public function get( string $slug ): ?array {
        $all = $this->all();
        $tpl = $all[ $slug ] ?? null;
        if ( $tpl === null ) return null;
        /**
         * Filter — modify a single template's data before consumers
         * receive it. Useful for whitelabel forks or per-site theming.
         *
         * @param array  $tpl   parsed template.json + dir_path / dir_url
         * @param string $slug  template slug
         */
        return (array) apply_filters( 'tempaloo_studio_template', $tpl, $slug );
    }

    public function active(): ?array {
        $slug = (string) get_option( self::ACTIVE_OPTION, '' );
        return $slug !== '' ? $this->get( $slug ) : null;
    }

    public function set_active( string $slug ): bool {
        if ( $slug !== '' && ! $this->get( $slug ) ) return false;
        update_option( self::ACTIVE_OPTION, $slug );
        return true;
    }

    /**
     * Walk /templates and parse every template.json found.
     */
    private function scan(): array {
        $base = TEMPALOO_STUDIO_TEMPLATES;
        if ( ! is_dir( $base ) ) return [];

        $out = [];
        foreach ( (array) glob( $base . '*/template.json' ) as $manifest_path ) {
            $raw = file_get_contents( $manifest_path );
            if ( ! is_string( $raw ) ) continue;
            $data = json_decode( $raw, true );
            if ( ! is_array( $data ) || empty( $data['slug'] ) ) continue;

            $slug = sanitize_key( $data['slug'] );
            $dir  = dirname( $manifest_path );

            // Confirm the folder name matches the slug — refusing to
            // load a misnamed template prevents subtle "I edited foo
            // but bar/template.json doesn't reflect it" bugs during
            // authoring.
            if ( basename( $dir ) !== $slug ) continue;

            $data['slug']     = $slug;
            $data['dir_path'] = trailingslashit( $dir );
            $data['dir_url']  = trailingslashit( TEMPALOO_STUDIO_TEMPLATES_URL . $slug );
            $out[ $slug ]     = $data;
        }
        return $out;
    }

    /**
     * Cheap content-fingerprint of every template.json on disk —
     * used to bust the cache when an author edits a manifest.
     */
    private function fingerprint(): string {
        $parts = [];
        foreach ( (array) glob( TEMPALOO_STUDIO_TEMPLATES . '*/template.json' ) as $f ) {
            $parts[] = $f . ':' . filemtime( $f );
        }
        return md5( implode( '|', $parts ) );
    }
}
