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

        // Also re-run after Elementor's editor mounts a new instance.
        // The widget-name segment of the hook matches the element's
        // data-widget_type — best we can do here is intersect by selector.
        if (window.elementorFrontend && window.elementorFrontend.hooks) {
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
        }
    };

    /** Detect prefers-reduced-motion. */
    ts.prefersReducedMotion = function () {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    };

    /** Are we inside Elementor's editor preview iframe? */
    ts.isEditMode = function () {
        return !!(window.elementorFrontend && window.elementorFrontend.isEditMode && window.elementorFrontend.isEditMode());
    };
})();
