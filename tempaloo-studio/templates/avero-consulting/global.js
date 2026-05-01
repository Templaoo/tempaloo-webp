/* ============================================================
 * Avero Consulting — global JS
 * Tempaloo Studio v0.1.0
 *
 * - Boots the shared `window.tempaloo.avero` namespace where each
 *   widget hangs its init function (e.g. window.tempaloo.avero.hero).
 * - Registers GSAP plugins ONCE per page (ScrollTrigger when present).
 * - Provides `runOnReady(rootEl, fn)` helper that runs `fn(rootEl)`
 *   immediately if GSAP is loaded, otherwise queues the call for when
 *   GSAP arrives.
 *
 * Per the Tempaloo Studio WIDGET-SPEC §1.9: every widget JS file
 * relies on this namespace existing. Loaded BEFORE any per-widget
 * script via wp_register_script dependency chain.
 * ============================================================ */

(function () {
    'use strict';

    window.tempaloo = window.tempaloo || {};
    window.tempaloo.avero = window.tempaloo.avero || {};

    var ns = window.tempaloo.avero;

    // GSAP boot — guarded so we don't blow up if GSAP didn't load
    // (e.g. a CSP policy stripped it). Widgets must check
    // `if (!window.gsap) return;` at the top of their init.
    if (window.gsap) {
        // ScrollTrigger ships with GSAP UMD; register if present so
        // ScrollTrigger.create(...) works in widget JS without each
        // widget having to call gsap.registerPlugin itself.
        if (window.ScrollTrigger && typeof window.gsap.registerPlugin === 'function') {
            window.gsap.registerPlugin(window.ScrollTrigger);
        }
        ns.ready = true;
    } else {
        ns.ready = false;
    }

    /**
     * Run an init function against a root element. Idempotent — calling
     * twice on the same root is harmless because each widget's init
     * is responsible for cleaning up its own state.
     */
    ns.runOnReady = function (rootEl, fn) {
        if (!rootEl || typeof fn !== 'function') return;
        if (ns.ready) {
            fn(rootEl);
        } else {
            // Defer until next tick — gives the GSAP <script> tag a
            // chance to finish parsing if the loader order was bad.
            setTimeout(function () {
                if (window.gsap) { ns.ready = true; fn(rootEl); }
            }, 50);
        }
    };

    /**
     * Detect prefers-reduced-motion. Widgets use this to bail out of
     * complex transforms and only emit opacity 0→1 fades, per spec.
     */
    ns.prefersReducedMotion = function () {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    };

    /**
     * Read the user-configured animation intensity, factoring in
     * prefers-reduced-motion. Widgets call this once at init and
     * branch on the result.
     *
     *   off    → return 'off'   (skip GSAP entirely)
     *   subtle → opacity-only, fast
     *   medium → designed look (DEFAULT)
     *   bold   → bigger transforms, slower
     *
     * If the OS is in reduced-motion mode, downgrade anything above
     * 'subtle' to 'subtle' — never override the user's accessibility
     * preference.
     */
    ns.animationLevel = function () {
        var cfg = (window.tempaloo && window.tempaloo.studio && window.tempaloo.studio.animation) || {};
        var lvl = cfg.intensity || 'medium';
        if (ns.prefersReducedMotion() && lvl !== 'off') return 'subtle';
        return lvl;
    };

    /**
     * Theme management — single source of truth for light/dark mode.
     * The header widget's toggle button calls ns.toggleTheme(); any
     * other widget can read ns.currentTheme() or call ns.applyTheme().
     * Persistence: localStorage 'tempaloo-studio-theme'. First-paint
     * detection runs earlier via Theme_Tokens' inline-head script
     * (FOUC prevention).
     */
    var THEME_KEY = 'tempaloo-studio-theme';

    ns.currentTheme = function () {
        return document.documentElement.getAttribute('data-theme') || 'light';
    };

    ns.applyTheme = function (mode) {
        if (mode !== 'dark' && mode !== 'light') return;
        document.documentElement.setAttribute('data-theme', mode);
        try { localStorage.setItem(THEME_KEY, mode); } catch (e) { /* ignore */ }
        document.dispatchEvent(new CustomEvent('tempaloo:theme', { detail: { mode: mode } }));
    };

    ns.toggleTheme = function () {
        ns.applyTheme(ns.currentTheme() === 'dark' ? 'light' : 'dark');
    };

    // Belt-and-suspenders fallback if the FOUC-prevention <head> script
    // didn't run for any reason (CSP, head priority race, etc.).
    if (!document.documentElement.getAttribute('data-theme')) {
        var stored = null;
        try { stored = localStorage.getItem(THEME_KEY); } catch (e) {}
        var fallback = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
        ns.applyTheme((stored === 'dark' || stored === 'light') ? stored : fallback);
    }
})();
