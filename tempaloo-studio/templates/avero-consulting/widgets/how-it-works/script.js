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
 * Live-preview strategy
 *   Initial states are SET BY JS (gsap.set) instead of CSS, so
 *   the CSS default is opacity:1 — if the script never runs at
 *   all (GSAP fails to load, syntax error, intensity = off), the
 *   widget is fully visible by default. ScrollTrigger then runs
 *   normally in BOTH frontend AND editor preview, so the author
 *   sees the actual scroll-driven reveal as they scroll the
 *   iframe. Earlier versions short-circuited in editor mode and
 *   played all animations on mount, which prevented the user
 *   from seeing the choreography in live preview.
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
        if (rootEl.__tw_hiw_cleanup) {
            try { rootEl.__tw_hiw_cleanup(); } catch (e) {}
            rootEl.__tw_hiw_cleanup = null;
        }

        var timeline   = rootEl.querySelector('.tw-avero-how-it-works__timeline');
        var activeLine = rootEl.querySelector('.tw-avero-how-it-works__line-active');
        var items      = rootEl.querySelectorAll('.tw-avero-how-it-works__item');
        if (!timeline || !items.length) return;

        // ── Reduced motion / off → static reveal ──────────────
        var ns      = (window.tempaloo && window.tempaloo.avero) || {};
        var level   = ns.animationLevel ? ns.animationLevel() : 'medium';
        var reduced = level === 'subtle' || level === 'off'
                      || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

        if (reduced) {
            // CSS default opacity:1 already shows everything; just snap
            // the progress line to its end state for a complete look.
            if (activeLine) gsap.set(activeLine, { scaleY: 1 });
            return;
        }

        var triggers = [];
        var tweens   = [];

        // ── Apply initial hidden states via gsap.set (NOT CSS) ─
        // CSS default for these elements is opacity:1, so if anything
        // below this point throws, the widget stays visible. The set()
        // calls hide each element just before its tween is wired up.
        if (activeLine) gsap.set(activeLine, { scaleY: 0 });

        items.forEach(function (item) {
            var marker  = item.querySelector('.tw-avero-how-it-works__item-marker');
            var content = item.querySelector('.tw-avero-how-it-works__item-content');
            var media   = item.querySelector('.tw-avero-how-it-works__item-media');
            var reverse = item.classList.contains('tw-avero-how-it-works__item--reverse');

            if (marker)  gsap.set(marker,  { scale: 0 });
            if (content) gsap.set(content, { opacity: 0, x: reverse ? -30 : 30 });
            if (media)   gsap.set(media,   { opacity: 0, y: 20 });

            // Build a paused timeline that animates each piece into
            // its final state. We don't use animation:tween linkage on
            // ScrollTrigger.create — onEnter/onLeaveBack callbacks
            // play/reverse the timeline (§1.15 standalone pattern).
            var tl = gsap.timeline({ paused: true });
            if (marker) {
                tl.to(marker, {
                    scale:     1,
                    duration:  0.6,
                    ease:      'back.out(1.7)',
                    overwrite: 'auto',
                });
            }
            if (content || media) {
                var targets = [content, media].filter(Boolean);
                tl.to(targets, {
                    opacity:   1,
                    x:         0,
                    y:         0,
                    duration:  1,
                    stagger:   0.1,
                    ease:      'power4.out',
                    overwrite: 'auto',
                }, '-=0.4');
            }
            tweens.push(tl);

            // Use ScrollTrigger normally — including in the editor —
            // so the author sees the scroll-driven reveal as they
            // scroll through the preview iframe. If create() throws
            // for any reason, fall back to playing the tween so the
            // content still becomes visible.
            try {
                var trig = ST.create({
                    trigger:     item,
                    start:       'top 85%',
                    onEnter:     function () { tl.play(); },
                    onEnterBack: function () { tl.play(); },
                    onLeaveBack: function () { tl.reverse(); },
                });
                triggers.push(trig);
            } catch (e) {
                tl.play();
            }
        });

        // ── Progress line scrub (frontend AND editor) ─────────
        // Same reasoning as the per-item triggers — keep ScrollTrigger
        // active in editor so the user can see the line fill as they
        // scroll. try/catch fallback ensures the line still ends in
        // its full state if create() fails.
        if (activeLine) {
            try {
                var lineTween = gsap.to(activeLine, {
                    scaleY: 1,
                    ease:   'none',
                    scrollTrigger: {
                        trigger: timeline,
                        start:   'top 70%',
                        end:     'bottom 70%',
                        scrub:   true,
                    },
                });
                tweens.push(lineTween);
                if (lineTween.scrollTrigger) triggers.push(lineTween.scrollTrigger);
            } catch (e) {
                gsap.set(activeLine, { scaleY: 1 });
            }
        }

        // ── Refresh — recalculates positions for the newly-created
        //    triggers. ScrollTrigger queues this debounced internally
        //    so calling it multiple times in quick succession is fine.
        try { ST.refresh(); } catch (e) {}

        // ── Cleanup hook for idempotent re-init ──────────────
        rootEl.__tw_hiw_cleanup = function () {
            triggers.forEach(function (t)  { try { t.kill();  } catch (e) {} });
            tweens.forEach(function (tw)   { try { tw.kill(); } catch (e) {} });
        };
    }

    window.tempaloo = window.tempaloo || {};
    window.tempaloo.avero = window.tempaloo.avero || {};
    window.tempaloo.avero.howItWorks = init;

    ts.onReady('.tw-avero-how-it-works', init);
})();
