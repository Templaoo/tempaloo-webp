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

    /* ── Debug tracer — opt-in via ?tw_debug=1 OR localStorage(tw_debug=1)
     *
     * Activate from DevTools console inside the editor preview iframe:
     *
     *     localStorage.setItem('tw_debug', '1'); location.reload();
     *
     * Or visit /avero-home/?tw_debug=1 once on the public frontend
     * (sets the flag in localStorage for the same origin), then open
     * the editor.
     *
     * Logs every decision the script makes:
     *   - did GSAP / ScrollTrigger load
     *   - is edit mode detected (and how)
     *   - how many items we found
     *   - did gsap.set apply
     *   - did ScrollTrigger.create succeed
     *   - is the trigger marked as inactive (off-viewport at create)
     */
    var DEBUG = (function () {
        try {
            var qs = location.search.match(/[?&]tw_debug=([^&]*)/);
            if (qs) {
                if (qs[1] === '1' || qs[1] === 'true')  { localStorage.setItem('tw_debug', '1'); return true; }
                if (qs[1] === '0' || qs[1] === 'false') { localStorage.removeItem('tw_debug');   return false; }
            }
            return localStorage.getItem('tw_debug') === '1';
        } catch (e) { return false; }
    })();
    function dlog() {
        if (!DEBUG || !window.console) return;
        var args = Array.prototype.slice.call(arguments);
        args.unshift('%c[hiw]', 'color:#a78bfa;font-weight:bold');
        try { console.log.apply(console, args); } catch (e) {}
    }
    function dwarn() {
        if (!window.console) return;
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[hiw]');
        try { console.warn.apply(console, args); } catch (e) {}
    }

    function init(rootEl) {
        if (!rootEl) {
            dwarn('init called with no rootEl');
            return;
        }
        dlog('init start', rootEl);
        var gsap = window.gsap;
        var ST   = window.ScrollTrigger;
        if (!gsap) { dwarn('GSAP MISSING — animation skipped, content stays at CSS default (visible)'); return; }
        if (!ST)   { dwarn('ScrollTrigger MISSING — animation skipped, content stays at CSS default (visible)'); return; }
        dlog('GSAP', gsap.version, '+ ScrollTrigger', ST.version, 'OK');

        // ── Idempotent reset ──────────────────────────────────
        if (rootEl.__tw_hiw_cleanup) {
            dlog('cleanup previous init');
            try { rootEl.__tw_hiw_cleanup(); } catch (e) { dwarn('cleanup threw', e); }
            rootEl.__tw_hiw_cleanup = null;
        }

        var timeline   = rootEl.querySelector('.tw-avero-how-it-works__timeline');
        var activeLine = rootEl.querySelector('.tw-avero-how-it-works__line-active');
        var items      = rootEl.querySelectorAll('.tw-avero-how-it-works__item');
        dlog('queries', { timeline: !!timeline, activeLine: !!activeLine, items: items.length });
        if (!timeline || !items.length) { dwarn('missing timeline or items, bail'); return; }

        // ── Reduced motion / off → static reveal ──────────────
        var ns      = (window.tempaloo && window.tempaloo.avero) || {};
        var level   = ns.animationLevel ? ns.animationLevel() : 'medium';
        var prefRM  = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        var reduced = level === 'subtle' || level === 'off' || prefRM;
        var inEditor = ts.isEditMode && ts.isEditMode();
        var hasEditClass = !!(document.body && document.body.classList && document.body.classList.contains('tempaloo-studio-edit-mode'));
        dlog('mode', { level: level, prefersReducedMotion: prefRM, isEditor: inEditor, bodyHasEditClass: hasEditClass, intent: reduced ? 'static' : 'animated' });

        if (reduced) {
            dlog('reduced/off — snapping line scaleY:1 and bailing (CSS default = visible)');
            if (activeLine) gsap.set(activeLine, { scaleY: 1 });
            return;
        }

        var triggers = [];
        var tweens   = [];

        // ── Apply initial hidden states via gsap.set (NOT CSS) ─
        // CSS default for these elements is opacity:1, so if anything
        // below this point throws, the widget stays visible. The set()
        // calls hide each element just before its tween is wired up.
        if (activeLine) {
            try { gsap.set(activeLine, { scaleY: 0 }); dlog('set line scaleY:0'); }
            catch (e) { dwarn('gsap.set(line) threw', e); }
        }

        items.forEach(function (item, idx) {
            var marker  = item.querySelector('.tw-avero-how-it-works__item-marker');
            var content = item.querySelector('.tw-avero-how-it-works__item-content');
            var media   = item.querySelector('.tw-avero-how-it-works__item-media');
            var reverse = item.classList.contains('tw-avero-how-it-works__item--reverse');
            dlog('item ' + idx, { marker: !!marker, content: !!content, media: !!media, reverse: reverse });

            try {
                if (marker)  gsap.set(marker,  { scale: 0 });
                if (content) gsap.set(content, { opacity: 0, x: reverse ? -30 : 30 });
                if (media)   gsap.set(media,   { opacity: 0, y: 20 });
            } catch (e) {
                dwarn('gsap.set on item ' + idx + ' threw', e);
            }

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

            // Use ScrollTrigger in "play-once" mode — `once: true`
            // makes ScrollTrigger fire onEnter exactly once, then kill
            // the trigger entirely. No onEnterBack / onLeaveBack ever
            // fire afterwards, so:
            //   - the timeline plays the FIRST time the user scrolls
            //     past the item;
            //   - it stays at its end state forever after, even when
            //     the user scrolls back up past the trigger and down
            //     again (no flicker, no reverse-then-replay yo-yo);
            //   - one fewer live ScrollTrigger per item — gentler on
            //     the per-frame refresh cost on long pages.
            // This matches the central runtime's pattern in
            // animations.js and is what every Avero entrance preset
            // uses for the same UX reason.
            try {
                var trig = ST.create({
                    trigger: item,
                    start:   'top 85%',
                    once:    true,
                    onEnter: function () { dlog('item ' + idx + ' onEnter — tl.play (once)'); tl.play(); },
                });
                triggers.push(trig);
                // Report the trigger's resolved start position + activity.
                // If `isActive` is true at create time, GSAP fires onEnter
                // synchronously on the next refresh — content reveals
                // without needing a scroll gesture.
                dlog('item ' + idx + ' ST created', {
                    start:    trig.start,
                    end:      trig.end,
                    isActive: trig.isActive,
                    progress: typeof trig.progress === 'function' ? trig.progress() : undefined,
                });
            } catch (e) {
                dwarn('item ' + idx + ' ST.create threw, falling back to tl.play()', e);
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
                if (lineTween.scrollTrigger) {
                    triggers.push(lineTween.scrollTrigger);
                    dlog('line scrub ST created', {
                        start: lineTween.scrollTrigger.start,
                        end:   lineTween.scrollTrigger.end,
                        progress: typeof lineTween.scrollTrigger.progress === 'function' ? lineTween.scrollTrigger.progress() : undefined,
                    });
                }
            } catch (e) {
                dwarn('line scrub setup threw — snapping line to scaleY:1', e);
                gsap.set(activeLine, { scaleY: 1 });
            }
        }

        // ── Refresh — recalculates positions for the newly-created
        //    triggers. ScrollTrigger queues this debounced internally
        //    so calling it multiple times in quick succession is fine.
        try {
            ST.refresh();
            dlog('ST.refresh() done — total ScrollTriggers on page:', ST.getAll().length);
        } catch (e) { dwarn('ST.refresh threw', e); }

        // Expose the per-root state on a debug global so the user can
        // poke at it from DevTools: `window.tempaloo.studio.__hiw[0]`.
        if (DEBUG) {
            window.tempaloo = window.tempaloo || {};
            window.tempaloo.studio = window.tempaloo.studio || {};
            window.tempaloo.studio.__hiw = window.tempaloo.studio.__hiw || [];
            window.tempaloo.studio.__hiw.push({ rootEl: rootEl, triggers: triggers, tweens: tweens });
        }

        // ── Cleanup hook for idempotent re-init ──────────────
        rootEl.__tw_hiw_cleanup = function () {
            dlog('cleanup running — killing', triggers.length, 'triggers +', tweens.length, 'tweens');
            triggers.forEach(function (t)  { try { t.kill();  } catch (e) {} });
            tweens.forEach(function (tw)   { try { tw.kill(); } catch (e) {} });
        };
    }

    window.tempaloo = window.tempaloo || {};
    window.tempaloo.avero = window.tempaloo.avero || {};
    window.tempaloo.avero.howItWorks = init;

    ts.onReady('.tw-avero-how-it-works', init);
})();
