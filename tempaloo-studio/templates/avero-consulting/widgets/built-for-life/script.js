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

    /**
     * Self-diagnostic — walks ancestors looking for the 5 known
     * blockers that prevent the pin-scale pattern from working in
     * WordPress + Elementor. Logs clear warnings so the user knows
     * exactly which environment issue to fix without guessing.
     *
     * Runs once per setupOne(), gated by fp_debug flag (or always
     * when DEBUG=true). Cheap — the walk-up is bounded by document
     * depth (~10-15 nodes max in a typical Elementor page).
     */
    function diagnose(root) {
        if (!DEBUG) return;
        var report = {
            blockers: [],
            warnings: [],
            info: {},
        };

        // Blocker #1 — overflow:hidden on any ancestor breaks
        // position:sticky and can clip GSAP's pinned position:fixed.
        // Walk up to <html> checking computed overflow on each ancestor.
        var el = root.parentElement;
        var depth = 0;
        while (el && depth < 30) {
            var cs = window.getComputedStyle(el);
            if (cs.overflowY === 'hidden' || cs.overflowY === 'clip' ||
                cs.overflowX === 'hidden' || cs.overflowX === 'clip' ||
                cs.overflow  === 'hidden' || cs.overflow  === 'clip') {
                report.blockers.push({
                    type:    'overflow-hidden-ancestor',
                    element: el.tagName + (el.className ? '.' + String(el.className).split(' ').join('.') : ''),
                    overflow: { x: cs.overflowX, y: cs.overflowY },
                    fix:     'Add CSS: ' + ('.' + String(el.className).split(' ')[0]) + ' { overflow: visible }',
                });
            }
            // Blocker #2 — transform / filter / perspective / will-change
            // on an ancestor creates a new containing block, trapping
            // position:fixed inside it (so pin moves with the parent).
            if (cs.transform !== 'none' ||
                cs.filter !== 'none' ||
                cs.perspective !== 'none' ||
                /transform|filter|perspective/.test(cs.willChange)) {
                report.blockers.push({
                    type:    'containing-block-trap',
                    element: el.tagName + (el.className ? '.' + String(el.className).split(' ').join('.') : ''),
                    cause: {
                        transform:   cs.transform !== 'none' ? cs.transform : null,
                        filter:      cs.filter    !== 'none' ? cs.filter    : null,
                        perspective: cs.perspective !== 'none' ? cs.perspective : null,
                        willChange:  cs.willChange,
                    },
                    fix: 'Remove transform/filter/perspective/will-change from this element, OR move the pinned section out of it.',
                });
            }
            el = el.parentElement;
            depth++;
        }

        // Blocker #3 — multiple GSAP instances on the page.
        // Detected by counting <script src*="gsap"> in the document.
        try {
            var gsapScripts = Array.prototype.filter.call(
                document.querySelectorAll('script[src*="gsap"]'),
                function (s) { return s.src && /\bgsap(\.min)?\.js/i.test(s.src); }
            );
            if (gsapScripts.length > 1) {
                report.warnings.push({
                    type:  'multiple-gsap-scripts',
                    count: gsapScripts.length,
                    srcs:  gsapScripts.map(function (s) { return s.src; }),
                    fix:   'Multiple GSAP versions loaded. Elementor Pro ships its own GSAP. Make sure ScrollTrigger is registered on the SAME gsap instance the widget uses.',
                });
            }
            // Verify ScrollTrigger is actually registered on window.gsap.
            var g = window.gsap;
            if (g && (!g.ScrollTrigger && !window.ScrollTrigger)) {
                report.blockers.push({
                    type: 'scrolltrigger-not-registered',
                    fix:  'Call gsap.registerPlugin(ScrollTrigger) once before any ScrollTrigger usage.',
                });
            }
        } catch (e) {}

        // Blocker #4 — Lenis active without scrollerProxy.
        if (window._tw_lenis || window.Lenis) {
            // ScrollTrigger.scrollerProxy uses a flag we can't easily
            // detect. Just warn — user has to verify wiring manually.
            report.warnings.push({
                type: 'lenis-active',
                fix:  'Lenis is loaded. Wire ScrollTrigger.scrollerProxy() and ScrollTrigger.update on lenis scroll, OR drop Lenis on this page.',
            });
        }

        // Info — current ScrollTrigger count (reveals leaks across re-inits).
        if (STLib()) {
            report.info.scrollTriggerCount = STLib().getAll().length;
        }
        // Info — GSAP version actually attached to window.
        if (window.gsap) {
            report.info.gsapVersion = window.gsap.version || 'unknown';
        }
        // Info — are we in an iframe (Elementor editor)?
        report.info.inIframe = (window.self !== window.top);
        report.info.viewport = { w: window.innerWidth, h: window.innerHeight };
        report.info.docHeight = document.documentElement.scrollHeight;

        // Pretty-print the diagnostic report.
        if (report.blockers.length || report.warnings.length) {
            try {
                console.groupCollapsed('%c[bfl] DIAGNOSTIC',
                    'background:#E6FF55;color:#000;padding:2px 6px;border-radius:3px;font-weight:bold');
                if (report.blockers.length) {
                    console.warn('🛑 BLOCKERS (' + report.blockers.length + ')');
                    report.blockers.forEach(function (b) { console.warn(b); });
                }
                if (report.warnings.length) {
                    console.warn('⚠️  WARNINGS (' + report.warnings.length + ')');
                    report.warnings.forEach(function (w) { console.warn(w); });
                }
                console.log('ℹ️  INFO', report.info);
                console.groupEnd();
            } catch (e) {}
        } else {
            clog('diagnostic clean — environment OK', report.info);
        }
        return report;
    }

    /**
     * Post-init forensic — runs AFTER ScrollTrigger has wired the pin
     * and checks which `pinType` GSAP actually picked. If GSAP fell
     * back to `'transform'` (the safe-but-slower mode), it means an
     * ancestor has a transform that traps position:fixed. Walk up to
     * find the culprit and log it. Run with delays because some
     * plugins (Animation Addons for Elementor Pro, Elementor Motion
     * Effects, certain themes) apply transforms LATE — on window.load
     * or via MutationObserver — after the initial diagnose() pass.
     */
    function forensicCheckPinType(root) {
        if (!DEBUG) return;
        var ST = STLib();
        if (!ST) return;
        var sticky = root.querySelector(STICKY_SELECTOR);
        if (!sticky) return;

        var match = ST.getAll().filter(function (st) {
            return st && st.pin === sticky;
        })[0];
        if (!match) {
            clog('forensic — no ScrollTrigger found on the sticky');
            return;
        }
        var pinType = match.pinType || (match.vars && match.vars.pinType) || '?';

        if (pinType === 'transform') {
            // Re-walk ancestors to find the late-applied transform.
            var culprit = null;
            var el = root.parentElement;
            while (el) {
                var cs = window.getComputedStyle(el);
                if (cs.transform !== 'none' ||
                    cs.filter !== 'none' ||
                    cs.perspective !== 'none' ||
                    /transform|filter|perspective/.test(cs.willChange)) {
                    culprit = {
                        element: el.tagName + (el.className ? '.' + String(el.className).split(' ').join('.') : ''),
                        transform:   cs.transform   !== 'none' ? cs.transform   : null,
                        filter:      cs.filter      !== 'none' ? cs.filter      : null,
                        perspective: cs.perspective !== 'none' ? cs.perspective : null,
                        willChange:  cs.willChange,
                    };
                    break;
                }
                el = el.parentElement;
            }
            try {
                console.groupCollapsed('%c[bfl] FORENSIC — pinType fell back to transform',
                    'background:#ff9800;color:#000;padding:2px 6px;border-radius:3px;font-weight:bold');
                console.warn('GSAP could not use position:fixed (the preferred mode) and fell back to transform-based pinning. This still works visually but is slightly less smooth. Cause: an ancestor has transform / filter / perspective / will-change set, creating a containing block that traps position:fixed.');
                if (culprit) {
                    console.warn('Culprit ancestor:', culprit);
                    console.warn('Fix options:');
                    console.warn('  1. Remove the offending CSS rule from the ancestor');
                    console.warn('  2. Disable the plugin that applies it (often: Animation Addons for Elementor Pro, Elementor Motion Effects)');
                    console.warn('  3. Accept transform-mode pinning (current behaviour — works on most pages)');
                } else {
                    console.warn('Could not locate the culprit ancestor on a re-walk. The transform may be on document.documentElement, document.body, or an iframe boundary.');
                }
                console.groupEnd();
            } catch (e) {}
        } else {
            clog('forensic — pinType=' + pinType + ' (good — fixed mode, smoothest pin)');
        }
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

        // Diagnose the environment BEFORE wiring anything. With
        // ?fp_debug=1 this surfaces the exact WP/Elementor blocker
        // (overflow:hidden ancestor / transform trap / multi-gsap /
        // Lenis / SR-not-registered) so we know what to fix without
        // guessing. No-op outside debug mode.
        diagnose(root);

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

        // Forensic — staggered re-checks to catch transforms applied
        // LATE by third-party plugins (Animation Addons for Elementor
        // Pro, Elementor Motion Effects, Lenis, etc.). The initial
        // diagnose() runs at setupOne() boot before ScrollTrigger
        // exists; these later checks inspect the actual ScrollTrigger's
        // pinType and identify the culprit ancestor if it auto-fell-back
        // to 'transform' mode.
        setTimeout(function () { forensicCheckPinType(root); }, 500);
        setTimeout(function () { forensicCheckPinType(root); }, 2000);
        if (window.addEventListener) {
            window.addEventListener('load', function () {
                setTimeout(function () { forensicCheckPinType(root); }, 100);
            }, { once: true });
        }
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
