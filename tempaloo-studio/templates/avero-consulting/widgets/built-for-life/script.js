/* ============================================================
 * Avero Consulting — Built for Life widget animation
 *
 * Forma's exact pin-scale pattern, ported verbatim:
 *
 *   • Section is N vh tall (default 250vh) and contains a sticky
 *     wrapper at 100vh.
 *   • A single CSS custom property `--p` interpolates 0 → 1 across
 *     the section's scroll-through.
 *   • All visual interpolation is done in CSS via calc(* var(--p)).
 *   • Smoothstep ease applied to p.
 *   • Mobile (≤ data-bp px) — pin is fully bypassed via CSS @media,
 *     the JS sets --p:1 once and bails.
 *   • prefers-reduced-motion — locks --p:1 (readable end-state, no
 *     scroll-coupled motion). The CSS @media handles this too; JS
 *     bails early so the rAF loop never engages.
 *
 * No GSAP / no ScrollTrigger — that gives us:
 *   - No pin-spacer creation that fights Elementor's flex/grid
 *   - No timeline / matchMedia conflicts with other widgets' triggers
 *   - Cheaper than scrub: one rAF-throttled scroll handler
 *   - Graceful degradation: failed JS still leaves a readable section
 *     (the @media + <noscript> CSS pin --p:1 by default)
 *
 * Hardening from the 2026-05-03 audit:
 *   - WeakSet dedup so Elementor lifecycle events don't double-init
 *   - prefers-reduced-motion early bail
 *   - Resize listener debounced 100ms + passive
 *   - section.offsetHeight cached, invalidated on resize
 *   - Number.isFinite(bp) so a corrupt data-bp doesn't blow up
 * ============================================================ */
(function () {
    'use strict';

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

    /** Smoothstep — cubic Hermite (Forma's exact curve). */
    function smoothstep(p) { return p * p * (3 - 2 * p); }

    /** Clamp helper. */
    function clamp01(v) { return Math.max(0, Math.min(1, v)); }

    /**
     * WeakSet of section nodes already initialised. Elementor's frontend
     * lifecycle re-fires `frontend/element_ready/built-for-life.default`
     * on every preview re-render and (sometimes) twice on first load,
     * which used to set up redundant scroll listeners on the same node.
     */
    var initialised = (typeof WeakSet === 'function') ? new WeakSet() : null;
    function alreadyInitialised(node) {
        if (initialised && initialised.has(node)) return true;
        if (initialised) initialised.add(node);
        return false;
    }

    function setupOne(section) {
        if (alreadyInitialised(section)) {
            clog('skip — already initialised', section);
            return;
        }

        var canvas = section.querySelector('.tw-bfl__canvas');
        if (!canvas) {
            clog('canvas missing — skipping', section);
            return;
        }

        // Resolve breakpoint defensively. If data-bp is corrupt or missing,
        // parseInt may return NaN — fall back to 800px.
        var bpRaw = parseInt(section.getAttribute('data-bp') || '800', 10);
        var bp    = Number.isFinite(bpRaw) ? bpRaw : 800;

        // prefers-reduced-motion — bail before wiring scroll/resize.
        // The CSS @media rule already pins --p:1, so we just don't
        // attach the rAF loop. Saves a listener + work on every scroll.
        var rmQuery = (typeof window.matchMedia === 'function')
            ? window.matchMedia('(prefers-reduced-motion: reduce)')
            : null;
        if (rmQuery && rmQuery.matches) {
            canvas.style.setProperty('--p', '1');
            clog('reduced-motion — skipping rAF loop', section);
            return;
        }

        // Cache layout reads. offsetHeight forces a reflow if read in
        // every rAF tick alongside other layout-touching code; reading
        // once + invalidating on resize/img-load keeps the hot path cheap.
        var sectionHeight = section.offsetHeight;
        var viewportH     = window.innerHeight;

        function recalc() {
            sectionHeight = section.offsetHeight;
            viewportH     = window.innerHeight;
        }

        var ticking = false;

        function update() {
            ticking = false;

            // Mobile bypass: lock --p at 1. CSS @media handles the
            // layout reset; we set --p so the JS state matches.
            if (window.innerWidth <= bp) {
                canvas.style.setProperty('--p', '1');
                return;
            }

            var rect   = section.getBoundingClientRect();
            var travel = sectionHeight - viewportH;
            if (travel <= 0) {
                canvas.style.setProperty('--p', '1');
                return;
            }

            // -rect.top goes from 0 (section top hits viewport top) to
            // travel (section bottom hits viewport bottom). Compress to
            // 0..1 across the FIRST 70% of travel, then hold at 1 for
            // the remaining 30% so the fullscreen state has a beat to
            // read before the section unpins. Forma's exact ratios.
            var raw   = clamp01(-rect.top / travel);
            var p     = Math.min(1, raw / 0.7);
            var eased = smoothstep(p);

            canvas.style.setProperty('--p', eased.toFixed(4));
        }

        function onScroll() {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(update);
            }
        }

        // Debounced resize — 100ms is enough to coalesce the mid-resize
        // burst on browsers that fire `resize` on every pixel. Recalc
        // cached layout AND re-run update so --p reflects the new geometry.
        var resizeTimer = null;
        function onResize() {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                recalc();
                update();
            }, 100);
        }

        // Image load → invalidate cache (image height shift can move
        // the section's offsetHeight).
        var img = section.querySelector('.tw-bfl__media');
        function onImgLoad() {
            recalc();
            update();
        }

        // Idempotent setup — clean up any prior listeners attached by a
        // previous setupOne call (Elementor re-renders go through
        // alreadyInitialised first, but defense in depth).
        if (section.__tw_bfl_cleanup) {
            try { section.__tw_bfl_cleanup(); } catch (e) {}
            section.__tw_bfl_cleanup = null;
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onResize, { passive: true });
        if (img && !img.complete) img.addEventListener('load', onImgLoad, { once: true });
        update();

        section.__tw_bfl_cleanup = function () {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onResize);
            if (img) img.removeEventListener('load', onImgLoad);
            if (resizeTimer) clearTimeout(resizeTimer);
        };

        // React to OS-level reduce-motion toggle without a page reload.
        if (rmQuery && typeof rmQuery.addEventListener === 'function') {
            rmQuery.addEventListener('change', function (e) {
                if (e.matches) {
                    canvas.style.setProperty('--p', '1');
                    if (section.__tw_bfl_cleanup) section.__tw_bfl_cleanup();
                } else {
                    update();
                }
            });
        }

        clog('ready', { section: section, bp: bp, sectionHeight: sectionHeight, travel: sectionHeight - viewportH });
    }

    function bootAll() {
        var sections = document.querySelectorAll('.tw-bfl');
        if (!sections.length) return;
        Array.prototype.forEach.call(sections, function (s) {
            if (!s.hasAttribute('data-bp')) s.setAttribute('data-bp', '800');
            setupOne(s);
        });
        clog('boot — initialised', sections.length, 'instance(s)');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootAll);
    } else {
        bootAll();
    }

    // Re-init on Elementor editor re-renders. The WeakSet dedup at the
    // top of setupOne() short-circuits redundant calls.
    if (window.elementorFrontend && window.elementorFrontend.hooks && window.elementorFrontend.hooks.addAction) {
        try {
            window.elementorFrontend.hooks.addAction('frontend/element_ready/built-for-life.default', function ($scope) {
                if (!$scope || !$scope[0]) return;
                var s = $scope[0].matches && $scope[0].matches('.tw-bfl') ? $scope[0] : $scope[0].querySelector('.tw-bfl');
                if (s) {
                    if (!s.hasAttribute('data-bp')) s.setAttribute('data-bp', '800');
                    setupOne(s);
                }
            });
        } catch (e) {}
    }
})();
