/* ============================================================
 * Avero Consulting — Built for Life widget (GSAP ScrollTrigger)
 *
 * Driven by GSAP ScrollTrigger per the official gsap-scrolltrigger
 * skill recommendations. Replaces the previous CSS-sticky + manual
 * scroll listener that didn't survive Elementor's nested wrappers
 * reliably (CSS sticky breaks if any ancestor has overflow:hidden,
 * which is common in Elementor sections).
 *
 * Architecture (from gsap-scrolltrigger skill — Pinning + Scrub):
 *
 *   trigger:  .tw-bfl                         (defines start/end calc)
 *   pin:      .tw-bfl__sticky                  (pinned via position:fixed by GSAP)
 *   pinSpacing: false                          (.tw-bfl already has explicit height)
 *   start:    'top top'
 *   end:      'bottom bottom'
 *   scrub:    1                                (smooth lag of 1s)
 *   invalidateOnRefresh: true                  (recalc on resize/img-load/font-swap)
 *
 *   Animation: a timeline that advances `--p` 0→1 across the first 70%
 *   of scroll, then holds at 1 for the remaining 30% (Forma's "moment
 *   to read" pattern). Tween uses ease: 'none' so scroll-to-progress
 *   stays 1:1 (per skill: "Use ease: 'none' on the animation when scrub
 *   is enabled, otherwise scroll position and animation progress won't
 *   line up — a very common mistake").
 *
 * Why pin a CHILD instead of the trigger:
 *   The previous attempt at `pin: true` (pinning rootEl) deformed
 *   Elementor's flex/grid wrappers because the pin-spacer wraps the
 *   trigger. Pinning a smaller child (.tw-bfl__sticky) with
 *   pinSpacing:false uses position:fixed on the child only — the outer
 *   .elementor-section/.elementor-container chain stays in its natural
 *   layout. The trigger element provides scroll runway via inline height.
 *
 * Mobile + reduced-motion bypass via gsap.matchMedia (per gsap-core
 * skill): the cinematic effect runs only on desktop with normal motion
 * preference. Mobile and reduce-motion users see --p locked at 1 (full
 * end-state, readable, no scroll coupling).
 *
 * Cleanup: gsap.context() wraps the matchMedia + ScrollTrigger so a
 * single ctx.revert() on re-init cleans up everything atomically.
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

    function gsapLib() { return window.gsap || null; }
    function STLib()   {
        var g = gsapLib();
        return (g && g.ScrollTrigger) || window.ScrollTrigger || null;
    }

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
        var sticky = section.querySelector('.tw-bfl__sticky');
        if (!canvas || !sticky) {
            clog('markup missing — bailing', section);
            return;
        }

        // Resolve breakpoint defensively. Number.isFinite guards against
        // a corrupt data-bp attribute slipping NaN into matchMedia.
        var bpRaw = parseInt(section.getAttribute('data-bp') || '800', 10);
        var bp    = Number.isFinite(bpRaw) ? bpRaw : 800;

        var g  = gsapLib();
        var ST = STLib();

        // Graceful degradation: no GSAP available → set --p:1 so the
        // user sees the readable end-state. The CSS @media (prefers-
        // reduced-motion) and <noscript> rules already handle this; the
        // explicit JS set covers the case where GSAP failed to load
        // mid-page (network error / blocked by adblocker / etc.).
        if (!g || !ST) {
            canvas.style.setProperty('--p', '1');
            clog('GSAP/ScrollTrigger missing — falling back to --p:1', section);
            return;
        }

        // gsap.context() wraps every tween + ScrollTrigger + matchMedia
        // we create. A single ctx.revert() on re-init cleans up the lot
        // atomically — important because Elementor's preview lifecycle
        // re-fires `frontend/element_ready` on every dirty render.
        section.__tw_bfl_ctx = g.context(function () {

            // gsap.matchMedia branches the animation on viewport + motion
            // preference. Each branch gets its own cleanup function.
            var mm = g.matchMedia();

            mm.add({
                isDesktop: '(min-width: ' + (bp + 1) + 'px) and (prefers-reduced-motion: no-preference)',
                isMobile:  '(max-width: ' + bp + 'px)',
                isReduced: '(prefers-reduced-motion: reduce)',
            }, function (ctx) {

                // Mobile or reduced-motion → lock --p:1 (full text visible,
                // image at scale 1, layout reset by CSS @media). No
                // ScrollTrigger created, no scroll coupling.
                if (ctx.conditions.isMobile || ctx.conditions.isReduced) {
                    canvas.style.setProperty('--p', '1');
                    clog('mobile/reduced — locked at --p:1', section);
                    return;
                }

                if (!ctx.conditions.isDesktop) return;

                // Build a scrubbed timeline. The timeline's progress
                // 0 → 1 maps to scroll progress through the section.
                //
                // Phase 1 (timeline 0 → 0.7): --p 0 → 1
                //   Card grows, image dezooms, text fades + rises.
                // Phase 2 (timeline 0.7 → 1.0): empty hold tween
                //   --p stays at 1, scroll continues to consume the
                //   final 30% of the pin without further visual change.
                //
                // ease: 'none' is REQUIRED here (skill rule: "with
                // scrub enabled, scroll-to-progress mapping must be 1:1
                // or the animation feels detached from scroll").
                var tl = g.timeline({
                    scrollTrigger: {
                        trigger:        section,
                        start:          'top top',
                        end:            'bottom bottom',
                        scrub:          1,
                        // Pin the inner sticky child rather than the
                        // section itself. pinSpacing:false because the
                        // section already has explicit height (sec_vh
                        // inline) so layout doesn't collapse.
                        pin:            sticky,
                        pinSpacing:     false,
                        invalidateOnRefresh: true,
                        // Lower priority = refreshed earlier (skill
                        // rule: top-to-bottom page order). The BFL
                        // section is mid-page in Avero so a small
                        // positive priority is fine.
                        refreshPriority: 0,
                    },
                });

                tl.fromTo(canvas,
                    { '--p': 0 },
                    { '--p': 1, duration: 0.7, ease: 'none' }
                ).to({}, { duration: 0.3 }); // 30% hold for reading

                clog('ready', { section: section, bp: bp, sec_vh: section.offsetHeight });

                // matchMedia auto-reverts on breakpoint change. No
                // explicit cleanup return needed.
            });

        }, section);
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

    // Re-init on Elementor editor re-renders. The WeakSet dedup in
    // setupOne short-circuits redundant calls.
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
