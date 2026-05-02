/* ============================================================
 * Avero Consulting — How it works scroll choreography
 *
 * Two animations stitched together via ScrollTrigger:
 *
 *   1. PROGRESS LINE — the central vertical guide line scales
 *      from scaleY:0 to scaleY:1 as the user scrolls through the
 *      timeline section. Uses scrub:true (the §1.15.4 exception
 *      in WIDGET-SPEC) because scroll-linked progress requires
 *      the tween↔trigger linkage. Wrapped in try/catch with a
 *      static fallback so a refresh crash can't blank the line.
 *
 *   2. PER-STEP REVEAL — for each item we use the standalone
 *      ScrollTrigger pattern (§1.15) — ScrollTrigger.create with
 *      onEnter / onLeaveBack callbacks that play / reverse a
 *      paused timeline. This avoids the `animation:tween` link
 *      crash for the multi-target reveal (marker pop +
 *      content/media slide) on filter/transform combos.
 *
 * Idempotent: prior ScrollTriggers and timelines tied to this
 * root are killed before re-init, so editor re-renders don't
 * stack up zombie animations.
 * ============================================================ */
(function () {
    'use strict';

    var ts = (window.tempaloo && window.tempaloo.studio) || {};
    if (!ts.onReady) return;

    function init(rootEl) {
        if (!rootEl) return;
        var gsap = window.gsap;
        var ST   = window.ScrollTrigger;
        if (!gsap || !ST) return;

        // ── Idempotent reset ──────────────────────────────────
        // Clean prior animations + their triggers before rebuilding.
        if (rootEl.__tw_hiw_cleanup) {
            try { rootEl.__tw_hiw_cleanup(); } catch (e) {}
            rootEl.__tw_hiw_cleanup = null;
        }

        var timeline   = rootEl.querySelector('.tw-avero-how-it-works__timeline');
        var activeLine = rootEl.querySelector('.tw-avero-how-it-works__line-active');
        var items      = rootEl.querySelectorAll('.tw-avero-how-it-works__item');
        if (!timeline || !items.length) return;

        // ── Reduced motion / off → static reveal ──────────────
        var ns       = (window.tempaloo && window.tempaloo.avero) || {};
        var level    = ns.animationLevel ? ns.animationLevel() : 'medium';
        var reduced  = level === 'subtle' || level === 'off'
                       || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

        if (reduced) {
            // Wipe the from-states so content renders normally.
            gsap.set(activeLine, { scaleY: 1 });
            items.forEach(function (item) {
                var marker  = item.querySelector('.tw-avero-how-it-works__item-marker');
                var content = item.querySelector('.tw-avero-how-it-works__item-content');
                var media   = item.querySelector('.tw-avero-how-it-works__item-media');
                gsap.set([marker, content, media], { clearProps: 'opacity,transform' });
            });
            return;
        }

        var triggers   = [];
        var tweens     = [];
        // editAware: in the Elementor editor preview, ts.editAware()
        // returns null so we skip ScrollTrigger entirely and play
        // animations on mount. This is the central live-preview fix
        // — see widget-base.js for the helper definition.
        var inEditor   = ts.isEditMode && ts.isEditMode();

        // ── 1. Progress line (scrub) ──────────────────────────
        // §1.15.4 exception: scrub requires the tween↔trigger link.
        // In editor mode, scrub doesn't make sense (no scroll happens
        // inside a non-resized iframe), so we just snap the line to
        // its final state and skip the trigger.
        if (activeLine) {
            if (inEditor) {
                gsap.set(activeLine, { scaleY: 1 });
            } else {
                try {
                    var lineTween = gsap.to(activeLine, {
                        scaleY: 1,
                        ease: 'none',
                        scrollTrigger: {
                            trigger: timeline,
                            start: 'top 70%',
                            end: 'bottom 70%',
                            scrub: true,
                        },
                    });
                    tweens.push(lineTween);
                    if (lineTween.scrollTrigger) triggers.push(lineTween.scrollTrigger);
                } catch (e) {
                    // Fallback — show the line at full scale so users
                    // still see the visual structure of the timeline.
                    gsap.set(activeLine, { scaleY: 1 });
                }
            }
        }

        // ── 2. Per-step reveal — standalone trigger or play-on-mount
        items.forEach(function (item) {
            var marker  = item.querySelector('.tw-avero-how-it-works__item-marker');
            var content = item.querySelector('.tw-avero-how-it-works__item-content');
            var media   = item.querySelector('.tw-avero-how-it-works__item-media');
            if (!marker && !content && !media) return;

            var tl = gsap.timeline({ paused: true });
            if (marker) {
                tl.to(marker, {
                    scale:    1,
                    duration: 0.6,
                    ease:     'back.out(1.7)',
                    overwrite: 'auto',
                });
            }
            if (content || media) {
                var targets = [content, media].filter(Boolean);
                tl.to(targets, {
                    opacity:  1,
                    x:        0,
                    y:        0,
                    duration: 1,
                    stagger:  0.1,
                    ease:     'power4.out',
                    overwrite: 'auto',
                }, '-=0.4');
            }
            tweens.push(tl);

            // ts.editAware returns null in the editor → skip the
            // ScrollTrigger wiring and play the timeline immediately
            // so the user sees the final state in live preview.
            var stCfg = ts.editAware ? ts.editAware({ trigger: item, start: 'top 85%' }) : { trigger: item, start: 'top 85%' };
            if (!stCfg) {
                tl.play();
                return;
            }
            try {
                var trig = ST.create({
                    trigger: stCfg.trigger,
                    start:   stCfg.start,
                    onEnter:     function () { tl.play(); },
                    onEnterBack: function () { tl.play(); },
                    onLeaveBack: function () { tl.reverse(); },
                });
                triggers.push(trig);
            } catch (e) {
                // Fallback — play immediately so content is visible.
                tl.play();
            }
        });

        // ── Refresh now that we've added new triggers, so positions
        //    are accurate on first paint (matches the central runtime
        //    pattern). Safe to call multiple times.
        try { ST.refresh(); } catch (e) {}

        // ── Cleanup hook for idempotent re-init ──────────────
        rootEl.__tw_hiw_cleanup = function () {
            triggers.forEach(function (t) { try { t.kill(); } catch (e) {} });
            tweens.forEach(function (tw)  { try { tw.kill(); } catch (e) {} });
        };
    }

    window.tempaloo = window.tempaloo || {};
    window.tempaloo.avero = window.tempaloo.avero || {};
    window.tempaloo.avero.howItWorks = init;

    ts.onReady('.tw-avero-how-it-works', init);
})();
