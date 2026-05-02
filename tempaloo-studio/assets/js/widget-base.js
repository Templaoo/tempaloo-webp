/* ============================================================
 * Tempaloo Studio — widget runtime (loaded for every template)
 *
 * Provides plugin-wide utilities every widget script can rely on.
 * The big one is `delegate()` — document-level event delegation —
 * which IS the canonical way to bind clicks/etc. on widget DOM.
 *
 * Why delegation over per-element listeners:
 *   1. Survives Elementor editor re-renders. Every keystroke in a
 *      control replaces the widget DOM via underscore template; old
 *      element-bound listeners are lost. Delegation on document is
 *      bound ONCE and dispatches via closest() at click time.
 *   2. Survives Elementor's editor click-swallowers. We bind on the
 *      capture phase so handlers run BEFORE Elementor's "select for
 *      edit" interceptor.
 *   3. No timing race. The handler is registered before the widget
 *      DOM exists; clicks on widgets that mount later still work.
 *
 * Required reading: WIDGET-SPEC §14 (delegation pattern).
 * ============================================================ */
(function () {
    'use strict';

    window.tempaloo        = window.tempaloo || {};
    window.tempaloo.studio = window.tempaloo.studio || {};
    var ts = window.tempaloo.studio;

    // Single document-level dispatcher per (event-type) so we don't
    // attach 50 listeners to document. Each call to delegate() pushes
    // onto an internal table; the dispatcher walks the table.
    var TABLE = ts.__delegateTable = ts.__delegateTable || {};

    function ensureDispatcher(type) {
        if (TABLE[type]) return;
        TABLE[type] = [];
        document.addEventListener(type, function (e) {
            var entries = TABLE[type];
            for (var i = 0; i < entries.length; i++) {
                var ent = entries[i];
                var match = e.target && e.target.closest && e.target.closest(ent.selector);
                if (match) ent.handler.call(match, e, match);
            }
        }, true /* capture phase — beat Elementor's editor click swallowers */);
    }

    /**
     * Bind a delegated listener.
     *
     * @param {string}   selector  CSS selector of the elements to match.
     *                             Widget rules SHOULD use the tw-…
     *                             class prefix to stay scoped.
     * @param {string}   eventType e.g. 'click', 'submit', 'change'.
     * @param {Function} handler   (event, matchedElement) => void.
     *                             `matchedElement` is whatever the
     *                             closest() resolved to.
     */
    ts.delegate = function (selector, eventType, handler) {
        if (typeof selector !== 'string' || typeof handler !== 'function') return;
        eventType = eventType || 'click';
        ensureDispatcher(eventType);
        TABLE[eventType].push({ selector: selector, handler: handler });
    };

    /**
     * Run `fn(rootEl)` for every existing element that matches selector,
     * AND register the same fn to run again whenever Elementor's
     * frontend renders a NEW instance of that selector (editor preview).
     * Use this for per-instance setup that NEEDS the rootEl (scroll
     * listeners, GSAP timelines).
     *
     * Why the deferred hook registration:
     *   `window.elementorFrontend` is loaded by Elementor's frontend.js,
     *   which can boot AFTER our widget scripts inside the editor preview
     *   iframe. A naive `if (window.elementorFrontend) { addAction(...) }`
     *   silently no-ops in that case → widgets never get their per-instance
     *   init when Elementor mounts them dynamically. We detect that case
     *   and defer the registration until the `elementor/frontend/init`
     *   jQuery event fires (which Elementor guarantees when it's ready).
     */
    ts.onReady = function (selector, fn) {
        if (typeof selector !== 'string' || typeof fn !== 'function') return;

        var run = function (root) {
            try { fn(root); } catch (e) { /* swallow per-widget errors so one bug doesn't kill the page */ }
        };

        function bootAll() {
            document.querySelectorAll(selector).forEach(run);
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bootAll);
        } else {
            bootAll();
        }

        // Hook registration on Elementor's per-widget mount event. The
        // hook fires for EVERY widget mount (existing instances at boot
        // + newly dragged-in widgets in the editor) — we filter to ours
        // by selector match.
        function registerElementorHook() {
            if (!window.elementorFrontend || !window.elementorFrontend.hooks) return false;
            window.elementorFrontend.hooks.addAction('frontend/element_ready/global', function ($el) {
                if (!$el || !$el[0]) return;
                if ($el[0].matches && $el[0].matches(selector)) {
                    run($el[0]);
                } else {
                    // The widget root passed by Elementor wraps our element.
                    // Try inner querySelector.
                    var inner = $el[0].querySelector(selector);
                    if (inner) run(inner);
                }
            });
            return true;
        }

        if (!registerElementorHook()) {
            // elementorFrontend not ready yet — defer until it is. Elementor
            // fires `elementor/frontend/init` on jQuery(window) when its
            // frontend.js bootstrap completes; that's the canonical signal.
            var attempt = function () { registerElementorHook(); };
            if (window.jQuery) {
                window.jQuery(window).on('elementor/frontend/init', attempt);
            }
            // Fallback: poll every 100ms for up to 10s in case jQuery isn't
            // ready either, OR the event fires before our handler binds.
            // 10s is plenty — Elementor frontend.js is loaded with the iframe.
            var tries = 0;
            var poll  = setInterval(function () {
                if (registerElementorHook() || ++tries > 100) clearInterval(poll);
            }, 100);
        }
    };

    /** Detect prefers-reduced-motion. */
    ts.prefersReducedMotion = function () {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    };

    /**
     * Are we inside Elementor's editor preview iframe?
     *
     * Two signals checked, EITHER returns true:
     *
     *   1. PHP-set body class `tempaloo-studio-edit-mode` — added by
     *      Frontend\Assets::body_class() based on Elementor's PHP-side
     *      `Plugin::$instance->preview->is_preview_mode()`. Available
     *      from the very first byte of HTML the browser parses, so
     *      every script (including ours, including animations.js) sees
     *      it on initial execution.
     *
     *   2. JS-side `elementorFrontend.isEditMode()` — only becomes
     *      true after Elementor's frontend.js has loaded and booted,
     *      which can happen AFTER our scripts. Kept as a fallback so
     *      we still detect edit mode if the PHP path fails for any
     *      reason (very old Elementor, custom preview render, etc.).
     */
    ts.isEditMode = function () {
        if (document.body && document.body.classList && document.body.classList.contains('tempaloo-studio-edit-mode')) {
            return true;
        }
        return !!(window.elementorFrontend && window.elementorFrontend.isEditMode && window.elementorFrontend.isEditMode());
    };

    /**
     * editAware(scrollTriggerCfg)
     *
     * Universal helper for any widget script that uses GSAP ScrollTrigger.
     * Returns the cfg unchanged on the public frontend, OR null when we're
     * inside Elementor's editor preview iframe — so the caller can skip
     * `ScrollTrigger.create()` entirely and play the tween immediately.
     *
     * The recurring bug this fixes: a widget with scroll-reveal sets
     * `opacity:0` / `transform: translate(...)` as the CSS initial state,
     * relying on the ScrollTrigger callback to clear it. In the editor,
     * the widget is often outside the iframe viewport at mount time →
     * the trigger never fires → the widget stays blank.
     *
     * Pattern (use this in every widget script.js):
     *
     *     var cfg = ts.editAware({ trigger: el, start: 'top 85%' });
     *     if (cfg) {
     *         ScrollTrigger.create(Object.assign({}, cfg, { onEnter: play }));
     *     } else {
     *         play(); // editor — show content immediately
     *     }
     *
     * For animations.js's central applyEntrance, the same gate is wired
     * via the `opts.scrollTrigger` field — null = play now.
     */
    ts.editAware = function (scrollTriggerCfg) {
        return ts.isEditMode() ? null : scrollTriggerCfg;
    };

    /**
     * Mark the document with `tempaloo-edit-mode` class when running
     * inside the Elementor editor preview. CSS can then target this
     * class to neutralize CSS-only initial-state hides — a defensive
     * second line so users always see content even if a widget script
     * crashes mid-init.
     *
     * Idempotent: safe to call multiple times.
     */
    function markEditMode() {
        if (!ts.isEditMode()) return;
        var html = document.documentElement;
        var body = document.body;
        if (html && !html.classList.contains('tempaloo-edit-mode')) html.classList.add('tempaloo-edit-mode');
        if (body && !body.classList.contains('tempaloo-edit-mode')) body.classList.add('tempaloo-edit-mode');
    }
    // elementorFrontend is loaded by Elementor's frontend.js, which
    // boots after our runtime. Run on every plausible signal so we
    // catch edit mode whenever it materializes.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', markEditMode);
    } else {
        markEditMode();
    }
    window.addEventListener('load', markEditMode);
    if (window.jQuery) {
        // Elementor exposes its hooks API via jQuery once it boots.
        window.jQuery(window).on('elementor/frontend/init', markEditMode);
    }
})();
