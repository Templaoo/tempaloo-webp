/* ============================================================
 * Avero Consulting — Built for Life widget animation
 *
 * Self-contained "world expands" cinematic pin:
 *   • Card 88vw × 80vh → 100vw × 100vh on scroll
 *   • Image dezooms 1.15 → 1.0 ("the world expands" feel)
 *   • Eyebrow + title + lead fade in + rise 40px during climax
 *   • CSS-sticky pin (NOT ScrollTrigger pin) — won't deform
 *     Elementor's flex/grid parents the way `pin: true` does
 *   • Smoothstep ease p*p*(3-2p) — same curve Forma uses
 *   • Mobile (≤bp px) — static card, no pin, full text visible
 *
 * Design constraints / GSAP best practices applied:
 *   - gsap.matchMedia for responsive + reduce-motion
 *   - gsap.context wraps every tween for atomic cleanup on
 *     re-init (Elementor preview re-renders, theme switches)
 *   - invalidateOnRefresh: true so positions recompute when
 *     fonts swap / layout shifts
 *   - Graceful degradation: if GSAP/ScrollTrigger aren't loaded
 *     (admin disabled animations), the widget renders as a
 *     static card via the inline CSS only — no JS errors.
 * ============================================================ */
(function () {
    'use strict';

    var ts    = (window.tempaloo && window.tempaloo.studio) || {};
    var DEBUG = (function () {
        try { return location.search.indexOf('fp_debug=1') !== -1 || localStorage.getItem('fp_debug') === '1'; }
        catch (e) { return false; }
    })();
    function log() {
        if (!DEBUG || !window.console) return;
        var args = Array.prototype.slice.call(arguments);
        args.unshift('%c[bfl]', 'color:#E6FF55;font-weight:bold');
        try { console.log.apply(console, args); } catch (e) {}
    }

    function gsap() {
        return window.gsap || (ts && ts.gsap) || null;
    }
    function hasST() {
        var g = gsap();
        return !!(g && (g.ScrollTrigger || window.ScrollTrigger));
    }

    /** Smoothstep — cubic Hermite interpolation. Forma's curve. */
    function smoothstep(p) { return p * p * (3 - 2 * p); }

    /**
     * Initialise one widget instance. Idempotent — calling twice on
     * the same root cleans up the previous context first so Elementor
     * editor re-renders don't pile up duplicate triggers.
     */
    function init(rootEl) {
        var g = gsap();
        if (!g || !hasST()) {
            log('GSAP/ScrollTrigger missing — falling back to static card', rootEl);
            // Force the static-card layout regardless of viewport — the
            // CSS @media (max-width: bp) rule already handles this when
            // matched, but on desktop without GSAP we'd see a 0-sized
            // card otherwise. Override sticky inline.
            var sticky = rootEl.querySelector('.tw-bfl__sticky');
            var inner  = rootEl.querySelector('.tw-bfl__inner');
            if (sticky) {
                sticky.style.position = 'static';
                sticky.style.height   = 'auto';
                sticky.style.display  = 'block';
                sticky.style.overflow = 'visible';
            }
            if (inner) {
                inner.style.width      = '92vw';
                inner.style.height     = 'auto';
                inner.style.aspectRatio = '4 / 3';
                inner.style.margin     = '32px auto';
            }
            return;
        }

        // Cleanup any prior context (Elementor re-render).
        if (rootEl.__tw_bfl_ctx) {
            try { rootEl.__tw_bfl_ctx.revert(); } catch (e) {}
            rootEl.__tw_bfl_ctx = null;
        }

        var sticky  = rootEl.querySelector('.tw-bfl__sticky');
        var inner   = rootEl.querySelector('.tw-bfl__inner');
        var media   = rootEl.querySelector('.tw-bfl__media');
        var overlay = rootEl.querySelector('.tw-bfl__overlay');
        if (!sticky || !inner) {
            log('markup missing — skipping', rootEl);
            return;
        }

        // Read the data-* attributes set by the PHP render.
        var cardW   = parseInt(rootEl.getAttribute('data-tw-bfl-card-w')  || '88', 10);
        var cardH   = parseInt(rootEl.getAttribute('data-tw-bfl-card-h')  || '80', 10);
        var radius  = parseInt(rootEl.getAttribute('data-tw-bfl-radius')  || '28', 10);
        var scaleFr = parseFloat(rootEl.getAttribute('data-tw-bfl-scale') || '1.15');
        var pinVh   = parseInt(rootEl.getAttribute('data-tw-bfl-pin-vh')  || '250', 10);
        var bp      = parseInt(rootEl.getAttribute('data-tw-bfl-bp')      || '800', 10);

        log('init', { cardW: cardW, cardH: cardH, radius: radius, scaleFr: scaleFr, pinVh: pinVh, bp: bp });

        // gsap.context wraps everything so a single revert() cleans up
        // tweens, ScrollTriggers, AND the matchMedia subscriptions.
        rootEl.__tw_bfl_ctx = g.context(function () {

            var mm = g.matchMedia();
            mm.add({
                isDesktop: '(min-width: ' + (bp + 1) + 'px)',
                isMobile:  '(max-width: ' + bp + 'px)',
            }, function (ctx) {

                if (ctx.conditions.isDesktop) {
                    // Reserve scroll runway on rootEl. Without this, the
                    // CSS sticky has no room to "stick" — sticky only
                    // engages while its containing block is being scrolled
                    // through.
                    rootEl.style.minHeight = (pinVh + 100) + 'vh';

                    // Initial card state.
                    g.set(inner, {
                        width:        cardW + 'vw',
                        height:       cardH + 'vh',
                        borderRadius: radius + 'px',
                        willChange:   'width, height, border-radius',
                    });
                    if (media) {
                        g.set(media, {
                            scale:      scaleFr,
                            willChange: 'transform',
                        });
                    }
                    if (overlay) {
                        g.set(overlay, { opacity: 0, y: 40 });
                    }

                    // Build the scrub timeline. NO `pin: true` — sticky
                    // CSS handles the visual pin natively.
                    var tl = g.timeline({
                        scrollTrigger: {
                            trigger:        rootEl,
                            start:          'top top',
                            end:            '+=' + pinVh + '%',
                            scrub:          1,
                            invalidateOnRefresh: true,
                        },
                    });

                    // Phase 1 (0 → 0.7): card grows + image dezooms.
                    tl.to(inner, {
                        width:        '100vw',
                        height:       '100vh',
                        borderRadius: 0,
                        duration:     0.7,
                        ease:         smoothstep,
                    }, 0);
                    if (media) {
                        tl.to(media, {
                            scale:    1,
                            duration: 0.7,
                            ease:     smoothstep,
                        }, 0);
                    }

                    // Phase 2 (0.4 → 0.7): overlay fades in + rises.
                    if (overlay) {
                        tl.to(overlay, {
                            opacity:  1,
                            y:        0,
                            duration: 0.3,
                            ease:     smoothstep,
                        }, 0.4);
                    }

                    // Phase 3 (0.7 → 1.0): hold for reading.
                    tl.to({}, { duration: 0.3 }, 0.7);

                    // matchMedia auto-reverts on breakpoint change — no
                    // explicit cleanup needed here. We restore minHeight
                    // anyway so the desktop→mobile switch leaves a clean
                    // CSS state.
                    return function () {
                        rootEl.style.minHeight = '';
                    };
                }

                if (ctx.conditions.isMobile) {
                    // Static card — turn off sticky, render normally.
                    sticky.style.position = 'static';
                    sticky.style.height   = 'auto';
                    sticky.style.display  = 'block';
                    sticky.style.overflow = 'visible';
                    g.set(inner, {
                        width:        '92vw',
                        height:       'auto',
                        borderRadius: '20px',
                        margin:       '32px auto',
                    });
                    if (media)   g.set(media,   { scale: 1 });
                    if (overlay) g.set(overlay, { opacity: 1, y: 0 });

                    return function () {
                        sticky.style.position = '';
                        sticky.style.height   = '';
                        sticky.style.display  = '';
                        sticky.style.overflow = '';
                    };
                }
            });

        }, rootEl);

        log('ready', rootEl);
    }

    // Boot — find every .tw-bfl on the page and initialise. Wait one
    // tick so any anti-FOUC hide / element-rule pass has a chance to
    // settle before we scrub the timeline.
    function boot() {
        var roots = document.querySelectorAll('.tw-bfl');
        if (!roots.length) return;
        Array.prototype.forEach.call(roots, function (r) {
            // Skip if this widget has been opted-out via element rules
            // covering it as a generic container — we want to claim the
            // markup explicitly with our own preset.
            init(r);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    // Re-init when Elementor's frontend reports a widget ready (editor
    // preview re-renders trigger this).
    if (window.elementorFrontend && window.elementorFrontend.hooks && window.elementorFrontend.hooks.addAction) {
        try {
            window.elementorFrontend.hooks.addAction('frontend/element_ready/built-for-life.default', function ($scope) {
                if (!$scope || !$scope[0]) return;
                var root = $scope[0].matches && $scope[0].matches('.tw-bfl') ? $scope[0] : $scope[0].querySelector('.tw-bfl');
                if (root) init(root);
            });
        } catch (e) {}
    }
})();
