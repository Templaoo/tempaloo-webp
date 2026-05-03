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
 *
 * No GSAP / no ScrollTrigger — that gives us:
 *   - No pin-spacer creation that fights Elementor's flex/grid
 *   - No timeline / matchMedia conflicts with other widgets' triggers
 *   - Cheaper than scrub: a single rAF-throttled scroll handler
 *   - Graceful degradation: if JS fails, CSS @media (max-width:bp)
 *     kicks in OR the sticky engages naturally with --p stuck at 0;
 *     in either case the section is still readable.
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

    function setupOne(section) {
        var canvas = section.querySelector('.tw-bfl__canvas');
        if (!canvas) {
            clog('canvas missing — skipping', section);
            return;
        }
        var bp = parseInt(section.getAttribute('data-bp') || '800', 10);

        var ticking = false;

        function update() {
            ticking = false;

            // Mobile bypass: lock --p at 1 (full visible, no animation).
            // The CSS @media also handles the layout reset; we set --p
            // here so the JS state matches the CSS state.
            if (window.innerWidth <= bp) {
                canvas.style.setProperty('--p', '1');
                return;
            }

            var rect   = section.getBoundingClientRect();
            var travel = section.offsetHeight - window.innerHeight;
            if (travel <= 0) {
                canvas.style.setProperty('--p', '1');
                return;
            }

            // -rect.top goes from 0 (section top hits viewport top) to
            // travel (section bottom hits viewport bottom). Compress to
            // 0..1 across the FIRST 70% of travel, then hold at 1 for
            // the remaining 30% so the fullscreen state has a beat to
            // read before the section unpins. Forma's exact ratios.
            var raw    = clamp01(-rect.top / travel);
            var p      = Math.min(1, raw / 0.7);
            var eased  = smoothstep(p);

            canvas.style.setProperty('--p', eased.toFixed(4));
        }

        function onScroll() {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(update);
            }
        }

        // Idempotent setup — multiple calls (Elementor editor re-renders)
        // detach the previous listeners before attaching new ones.
        if (section.__tw_bfl_cleanup) {
            try { section.__tw_bfl_cleanup(); } catch (e) {}
            section.__tw_bfl_cleanup = null;
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', update);
        update();

        section.__tw_bfl_cleanup = function () {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', update);
        };

        clog('ready', { section: section, bp: bp });
    }

    function bootAll() {
        var sections = document.querySelectorAll('.tw-bfl');
        if (!sections.length) return;
        Array.prototype.forEach.call(sections, function (s) {
            // Promote the data-bp from the existing data-tw-bfl-bp attr
            // (legacy) or default to 800. Keeps backward-compat with the
            // previous markup if any cached version still ships it.
            if (!s.hasAttribute('data-bp')) {
                var legacy = s.getAttribute('data-tw-bfl-bp') || '800';
                s.setAttribute('data-bp', legacy);
            }
            setupOne(s);
        });
        clog('boot — initialised', sections.length, 'instance(s)');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootAll);
    } else {
        bootAll();
    }

    // Re-init on Elementor editor re-renders.
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
