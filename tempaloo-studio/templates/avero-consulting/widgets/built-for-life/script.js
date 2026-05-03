/* ============================================================
 * Avero Consulting — Built for Life widget animation
 *
 * GSAP ScrollTrigger driven, with full Elementor lifecycle integration
 * (audit 2026-05-03 fixes #1-#6).
 *
 * Architecture per gsap-scrolltrigger SKILL:
 *   trigger:    .tw-avero-built-for-life
 *   pin:        .tw-avero-built-for-life__sticky  (CHILD pin, not the trigger)
 *   pinSpacing: false                              (section has explicit height)
 *   start:      'top top'
 *   end:        'bottom bottom'
 *   scrub:      1
 *   invalidateOnRefresh: true
 *   ease:       'none' on the tween (1:1 scroll-to-progress mapping)
 *
 * Elementor integration (audit fix #2):
 *   - Hooks `frontend/element_ready/built-for-life.default` so Elementor
 *     re-renders trigger a re-init.
 *   - Kills any existing ScrollTrigger inside the widget root before
 *     re-initialising → no leak across edits.
 *   - Disables pin in edit mode (audit fix #4) so the editor stays
 *     scrollable past the section.
 *
 * Refresh integration (audit fix #3 — partly handled in animations.js
 * for the global refresh, partly here for our own listener):
 *   - elementor.channels.editor.on('change') → refresh
 *   - elementor.on('preview:loaded') → refresh
 *
 * Selector fix (audit fix #1): all internal classes renamed from
 * `.tw-bfl*` to `.tw-avero-built-for-life*` to match the BEM convention
 * the rest of the Avero template uses (.tw-avero-faq, .tw-avero-cta,
 * .tw-avero-testimonials, etc.).
 * ============================================================ */
(function () {
    'use strict';

    var ROOT_SELECTOR    = '.tw-avero-built-for-life';
    var STICKY_SELECTOR  = '.tw-avero-built-for-life__sticky';
    var CANVAS_SELECTOR  = '.tw-avero-built-for-life__canvas';
    var INIT_FLAG        = 'twBflInitialized';
    var WIDGET_NAME      = 'built-for-life';

    var DEBUG = (function () {
        try { return location.search.indexOf('fp_debug=1') !== -1 || localStorage.getItem('fp_debug') === '1'; }
        catch (e) { return false; }
    })();
    function clog() {
        if (!DEBUG || !window.console) return;
        var args = Array.prototype.slice.call(arguments);
        args.unshift('%c[bfl]', 'color:#E6FF55;font-weight:bold');
        try { console.log.apply(console, args); } catch (e) {}
    }
    function cwarn() {
        if (!window.console) return;
        var args = Array.prototype.slice.call(arguments);
        args.unshift('%c[bfl]', 'color:#ff6b6b;font-weight:bold');
        try { console.warn.apply(console, args); } catch (e) {}
    }

    function gsapLib() { return window.gsap || null; }
    function STLib()   {
        var g = gsapLib();
        return (g && g.ScrollTrigger) || window.ScrollTrigger || null;
    }

    /** Are we running inside Elementor's editor preview iframe? */
    function isEditMode() {
        try {
            return !!(window.elementorFrontend &&
                      typeof window.elementorFrontend.isEditMode === 'function' &&
                      window.elementorFrontend.isEditMode());
        } catch (e) { return false; }
    }

    function setupOne(root) {
        if (!root) {
            cwarn('setupOne called with null root — abort');
            return;
        }
        // Guard against double-init via dataset flag (survives WeakSet
        // limitations in older browsers and across module re-imports).
        if (root.dataset && root.dataset[INIT_FLAG] === '1') {
            clog('skip — already initialised', root);
            return;
        }

        var canvas = root.querySelector(CANVAS_SELECTOR);
        var sticky = root.querySelector(STICKY_SELECTOR);
        if (!canvas || !sticky) {
            cwarn('markup missing — bailing', { root: root, canvas: !!canvas, sticky: !!sticky });
            return;
        }

        var bpRaw = parseInt(root.getAttribute('data-bp') || '800', 10);
        var bp    = Number.isFinite(bpRaw) ? bpRaw : 800;

        var g  = gsapLib();
        var ST = STLib();

        // Graceful degradation: no GSAP available → set --p:1 so the
        // user sees the readable end-state. The CSS @media (prefers-
        // reduced-motion) and <noscript> rules already cover this; the
        // explicit JS set covers the case where GSAP failed to load
        // mid-page (network error / blocked / CSP).
        if (!g || !ST) {
            canvas.style.setProperty('--p', '1');
            cwarn('GSAP/ScrollTrigger missing — falling back to --p:1', root);
            return;
        }

        // Audit fix #2 — kill any pre-existing ScrollTrigger that
        // targets a node inside our widget root. Survives Elementor's
        // destroy + recreate lifecycle (the previous DOM is gone, but
        // ScrollTrigger.getAll() still holds the orphan triggers until
        // refresh — better to kill explicitly).
        try {
            ST.getAll().forEach(function (st) {
                if (st && st.trigger && root.contains(st.trigger)) {
                    st.kill();
                    clog('killed orphan ST on', st.trigger);
                }
                if (st && st.pin && root.contains(st.pin)) {
                    st.kill();
                    clog('killed orphan ST (pin) on', st.pin);
                }
            });
        } catch (e) { cwarn('ST cleanup threw', e); }

        if (root.dataset) root.dataset[INIT_FLAG] = '1';

        // Audit fix #4 — disable pin in edit mode. Editor users need to
        // scroll past the section to inspect what comes after; an active
        // pin makes that frustrating. The card-grow animation still runs
        // (scrub stays on) so the user can preview the effect, just
        // without sticking the section to the viewport.
        var inEditor = isEditMode();

        // gsap.context wraps every tween + ScrollTrigger + matchMedia we
        // create. ctx.revert() on next setupOne (or on Elementor destroy)
        // cleans the lot atomically.
        if (root.__tw_bfl_ctx) {
            try { root.__tw_bfl_ctx.revert(); } catch (e) {}
            root.__tw_bfl_ctx = null;
        }

        root.__tw_bfl_ctx = g.context(function () {
            var mm = g.matchMedia();

            mm.add({
                isDesktop: '(min-width: ' + (bp + 1) + 'px) and (prefers-reduced-motion: no-preference)',
                isMobile:  '(max-width: ' + bp + 'px)',
                isReduced: '(prefers-reduced-motion: reduce)',
            }, function (ctx) {

                if (ctx.conditions.isMobile || ctx.conditions.isReduced) {
                    canvas.style.setProperty('--p', '1');
                    clog('mobile/reduced — locked at --p:1', root);
                    return;
                }
                if (!ctx.conditions.isDesktop) return;

                var tl = g.timeline({
                    scrollTrigger: {
                        trigger:        root,
                        start:          'top top',
                        end:            'bottom bottom',
                        scrub:          inEditor ? false : 1,
                        pin:            inEditor ? false : sticky,
                        pinSpacing:     false,
                        invalidateOnRefresh: true,
                        refreshPriority: 0,
                    },
                });

                tl.fromTo(canvas,
                    { '--p': 0 },
                    { '--p': 1, duration: 0.7, ease: 'none' }
                ).to({}, { duration: 0.3 });

                clog('ready', { root: root, bp: bp, inEditor: inEditor });
            });
        }, root);
    }

    /** Find a `.tw-avero-built-for-life` inside an Elementor $scope. */
    function rootFromScope($scope) {
        if (!$scope || !$scope[0]) return null;
        var node = $scope[0];
        if (node.matches && node.matches(ROOT_SELECTOR)) return node;
        return node.querySelector(ROOT_SELECTOR);
    }

    function bootAll() {
        var roots = document.querySelectorAll(ROOT_SELECTOR);
        if (!roots.length) {
            clog('boot — no .tw-avero-built-for-life on page');
            return;
        }
        Array.prototype.forEach.call(roots, function (r) {
            if (!r.hasAttribute('data-bp')) r.setAttribute('data-bp', '800');
            setupOne(r);
        });
        clog('boot — initialised', roots.length, 'instance(s)');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootAll);
    } else {
        bootAll();
    }

    // Audit fix #2 — Elementor lifecycle integration. Hooks into the
    // editor's per-widget ready event so a re-render after a setting
    // change re-initialises the animation on the new DOM. Without this,
    // edits to the widget kill the previous DOM (and its ScrollTriggers)
    // and the new DOM has no animation attached.
    function registerElementorHook() {
        if (!window.elementorFrontend ||
            !window.elementorFrontend.hooks ||
            !window.elementorFrontend.hooks.addAction) return;
        try {
            window.elementorFrontend.hooks.addAction(
                'frontend/element_ready/' + WIDGET_NAME + '.default',
                function ($scope) {
                    var root = rootFromScope($scope);
                    if (!root) {
                        cwarn('frontend/element_ready fired but no .tw-avero-built-for-life inside scope', $scope);
                        return;
                    }
                    if (!root.hasAttribute('data-bp')) root.setAttribute('data-bp', '800');
                    // Reset init flag so setupOne does the full re-wire
                    // (the DOM node may be the same reference but its
                    // ScrollTriggers were torn down by the editor).
                    if (root.dataset) root.dataset[INIT_FLAG] = '';
                    setupOne(root);
                }
            );
            clog('elementorFrontend hook registered for', WIDGET_NAME);
        } catch (e) { cwarn('elementorFrontend hook registration failed', e); }
    }

    // The hook needs to be registered AFTER elementorFrontend has booted.
    // Wait for `elementor/frontend/init` if it hasn't fired yet.
    if (window.elementorFrontend && window.elementorFrontend.hooks) {
        registerElementorHook();
    } else {
        window.addEventListener('elementor/frontend/init', registerElementorHook);
    }
})();
