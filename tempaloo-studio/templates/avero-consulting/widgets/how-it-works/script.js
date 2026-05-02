/* ============================================================
 * Avero Consulting — How it works scroll choreography
 *
 * Reliability-hardened per GSAP-ScrollTrigger best practices:
 *
 *   1. PROGRESS LINE — central scrub-tied vertical line that
 *      grows from scaleY:0 → 1 as the user scrolls through the
 *      whole timeline section.
 *
 *   2. PER-STEP REVEAL — each step's marker pops in (scale 0→1
 *      with back ease) while content + media slide into place,
 *      with a back-and-forth (forward on scroll DOWN, reverse
 *      on scroll UP).
 *
 * Best practices applied (per gsap-scrolltrigger skill):
 *   - `invalidateOnRefresh: true` on every trigger so positions
 *     recompute when layout changes (image load, font swap,
 *     Elementor editor re-render, viewport resize).
 *   - `refreshPriority` set to item DOM order so triggers refresh
 *     top-to-bottom (avoids first-item being computed against a
 *     not-yet-laid-out third-item layout).
 *   - Refresh hooks on document.fonts.ready + window.load + every
 *     image inside the widget loading. The #1 cause of "sometimes
 *     works, sometimes doesn't" is layout shifting after first
 *     paint — this catches every shift point.
 *   - `gsap.fromTo()` on the timeline with explicit start states
 *     instead of `gsap.set + gsap.to` chained — gsap.fromTo's
 *     immediateRender behavior is deterministic and well-defined
 *     in the docs.
 *   - `gsap.context()` for cleanup — kills every tween + trigger
 *     created inside the context in one call, no manual bookkeeping.
 *
 * Idempotent: every (re-)init kills the prior context, so editor
 * re-mounts and undo/redo can never stack zombie animations.
 * ============================================================ */
(function () {
    'use strict';

    var ts = (window.tempaloo && window.tempaloo.studio) || {};
    if (!ts.onReady) return;

    /* ── Debug tracer (?tw_debug=1) ─────────────────────── */
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
        if (!rootEl) return;
        var gsap = window.gsap;
        var ST   = window.ScrollTrigger;
        if (!gsap || !ST) {
            dwarn('GSAP or ScrollTrigger missing — bail (CSS default = visible)');
            return;
        }
        dlog('init start', rootEl, 'GSAP', gsap.version, 'ST', ST.version);

        // ── Idempotent reset via gsap.context().revert() ─────
        // Replaces the manual cleanup loop. context.revert() kills
        // every tween + trigger created INSIDE the context AND reverts
        // their inline styles, so the next gsap.fromTo can compute
        // starting values from a clean slate.
        if (rootEl.__tw_hiw_ctx) {
            dlog('cleanup previous context.revert()');
            try { rootEl.__tw_hiw_ctx.revert(); } catch (e) { dwarn('revert threw', e); }
            rootEl.__tw_hiw_ctx = null;
        }

        var timeline   = rootEl.querySelector('.tw-avero-how-it-works__timeline');
        var activeLine = rootEl.querySelector('.tw-avero-how-it-works__line-active');
        var items      = rootEl.querySelectorAll('.tw-avero-how-it-works__item');
        if (!timeline || !items.length) { dwarn('missing timeline or items'); return; }
        dlog('queries', { items: items.length });

        // ── Reduced motion / off → static reveal ──────────────
        var ns      = (window.tempaloo && window.tempaloo.avero) || {};
        var level   = ns.animationLevel ? ns.animationLevel() : 'medium';
        var prefRM  = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        if (level === 'subtle' || level === 'off' || prefRM) {
            dlog('reduced/off — snapping line + bailing');
            if (activeLine) gsap.set(activeLine, { scaleY: 1 });
            return;
        }

        // Pairs (timeline, ScrollTrigger) so we can sync each timeline
        // to its trigger's initial progress AFTER refresh. Without this,
        // a page reload at the bottom of the page leaves all per-item
        // timelines at progress=0 (hidden) while ScrollTrigger reports
        // the user is past end → onEnterBack only fires once the user
        // scrolls UP across "end", but at that moment items are HIDDEN
        // (timeline never played). The user sees nothing reveal.
        var pairs = [];

        /* ── Build everything inside a gsap.context() so revert()
         *    cleans the slate atomically on next init. */
        var ctx = gsap.context(function () {

            /* PER-STEP TIMELINES — bidirectional ScrollTrigger
             * with toggleActions semantics manually implemented via
             * onEnter / onEnterBack / onLeaveBack callbacks because
             * we want the timeline to play, replay, and reverse
             * cleanly without the §1.15-banned `animation:` link.
             */
            items.forEach(function (item, idx) {
                var marker  = item.querySelector('.tw-avero-how-it-works__item-marker');
                var content = item.querySelector('.tw-avero-how-it-works__item-content');
                var media   = item.querySelector('.tw-avero-how-it-works__item-media');
                if (!marker && !content && !media) return;

                var reverse = item.classList.contains('tw-avero-how-it-works__item--reverse');

                // Build a paused timeline using fromTo so each tween
                // declares its OWN start state. This is more robust
                // than gsap.set + gsap.to because if the context
                // reverts mid-animation, fromTo recomputes from the
                // declared "from" instead of a possibly-half-animated
                // current style.
                var tl = gsap.timeline({ paused: true });
                if (marker) {
                    tl.fromTo(marker,
                        { scale: 0 },
                        {
                            scale:     1,
                            duration:  0.6,
                            ease:      'back.out(1.7)',
                            overwrite: 'auto',
                        }
                    );
                }
                if (content) {
                    tl.fromTo(content,
                        { opacity: 0, x: reverse ? -30 : 30 },
                        {
                            opacity:   1,
                            x:         0,
                            duration:  1,
                            ease:      'power4.out',
                            overwrite: 'auto',
                        },
                        '-=0.4'
                    );
                }
                if (media) {
                    tl.fromTo(media,
                        { opacity: 0, y: 20 },
                        {
                            opacity:   1,
                            y:         0,
                            duration:  1,
                            ease:      'power4.out',
                            overwrite: 'auto',
                        },
                        '<+0.1'  // staggered behind content by 0.1s
                    );
                }

                // ScrollTrigger configured with two reliability flags:
                //   - invalidateOnRefresh: true → start/end recompute
                //     when ST.refresh() runs (image load, font swap,
                //     resize). Without this, a trigger created BEFORE
                //     a hero image loaded would have a stale start
                //     position and fire too early or too late.
                //   - refreshPriority: idx → guarantees top-to-bottom
                //     refresh order so item 1's geometry is computed
                //     against an already-finalized item 0.
                var st = ST.create({
                    trigger:             item,
                    start:               'top 85%',
                    invalidateOnRefresh: true,
                    refreshPriority:     idx,
                    onEnter:             function () { dlog('item ' + idx + ' onEnter');     tl.play(); },
                    onEnterBack:         function () { dlog('item ' + idx + ' onEnterBack'); tl.play(); },
                    onLeaveBack:         function () { dlog('item ' + idx + ' onLeaveBack'); tl.reverse(); },
                });
                pairs.push({ tl: tl, st: st, idx: idx });
            });

            /* PROGRESS LINE — scrub-tied to the whole timeline
             * section. invalidateOnRefresh ensures the start/end
             * positions track image-load and font-swap shifts that
             * are common in editor mode. */
            if (activeLine) {
                gsap.fromTo(activeLine,
                    { scaleY: 0 },
                    {
                        scaleY: 1,
                        ease:   'none',
                        scrollTrigger: {
                            trigger:             timeline,
                            start:               'top 70%',
                            end:                 'bottom 70%',
                            scrub:               true,
                            invalidateOnRefresh: true,
                            refreshPriority:     -1,  // ahead of items so the line is laid out first
                        },
                    }
                );
            }

        }, rootEl); // scope the context to this root for query selectors

        rootEl.__tw_hiw_ctx = ctx;

        /* ── Refresh hooks — catch late layout shifts ──────────
         *
         * The #1 cause of "animation sometimes doesn't fire" is
         * that ScrollTrigger computed its start/end positions
         * BEFORE the image / font / sibling-widget finished
         * laying out. Forcing a refresh on every realistic
         * "layout might have shifted" signal makes the triggers
         * always accurate.
         *
         * ScrollTrigger.refresh() is debounced internally (200ms)
         * so calling it many times back-to-back is cheap.
         */
        // After every refresh, sync each per-item timeline to the
        // CURRENT trigger progress. This is the fix for "page reloaded
        // at the bottom — animation never fires when scrolling up":
        //
        //   Without sync: timeline stays at progress=0 (hidden) even
        //   though the user is past end. Scrolling UP across `end` is
        //   supposed to fire onEnterBack which calls tl.play() — but
        //   ScrollTrigger sometimes misses that boundary on the first
        //   user-initiated scroll after browser scroll-restoration.
        //   Even when it does fire, the user briefly sees a "snap"
        //   from hidden to revealed which feels wrong.
        //
        //   With sync: at refresh time, if the trigger reports the
        //   user is PAST the start (we're scrolled below the item),
        //   we jump the timeline to progress(1) — items are visible
        //   from frame 1. Scrolling UP past start → onLeaveBack
        //   fires normally → tl.reverse() animates them out as
        //   expected. Scrolling DOWN past start again → onEnter →
        //   tl.play() animates them back in.
        function syncPairs(reason) {
            pairs.forEach(function (p) {
                try {
                    var stProgress = (typeof p.st.progress === 'function') ? p.st.progress() : 0;
                    // Threshold 0.01 — anything > 0 means user has scrolled
                    // past start. Below that, treat as "before start" and
                    // keep the timeline at its initial state.
                    if (stProgress > 0.01) {
                        if (p.tl.progress() < 0.99) {
                            p.tl.progress(1).pause();
                            dlog('sync item ' + p.idx + ': st.progress=' + stProgress.toFixed(2) + ' → tl.progress(1) [' + reason + ']');
                        }
                    } else {
                        if (p.tl.progress() > 0.01) {
                            p.tl.progress(0).pause();
                            dlog('sync item ' + p.idx + ': st.progress=0 → tl.progress(0) [' + reason + ']');
                        }
                    }
                } catch (e) { dwarn('sync item ' + p.idx + ' threw', e); }
            });
        }

        var doRefresh = function (why) {
            try {
                ST.refresh();
                dlog('refresh:', why, '— total triggers on page:', ST.getAll().length);
                syncPairs(why);
            } catch (e) { dwarn('refresh threw', e); }
        };

        // 1. Microtask after init — catch synchronous post-build shifts.
        Promise.resolve().then(function () { doRefresh('post-init microtask'); });

        // 2. After fonts swap (web fonts cause noticeable shifts).
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () { doRefresh('fonts.ready'); });
        }

        // 3. After every image inside the widget finishes loading.
        rootEl.querySelectorAll('img').forEach(function (img) {
            if (img.complete) return;
            img.addEventListener('load',  function () { doRefresh('img load:'  + (img.alt || img.src)); }, { once: true });
            img.addEventListener('error', function () { doRefresh('img error:' + (img.alt || img.src)); }, { once: true });
        });

        // 4. window.load — the canonical "everything's done" hook.
        if (document.readyState !== 'complete') {
            window.addEventListener('load', function () { doRefresh('window-load'); }, { once: true });
        }

        // 5. Final safety net — 600ms after init for slow async work
        //    (lazy-loaded scripts, late style injection by other
        //    plugins).
        setTimeout(function () { doRefresh('600ms safety net'); }, 600);

        // Debug API in DevTools.
        if (DEBUG) {
            window.tempaloo = window.tempaloo || {};
            window.tempaloo.studio = window.tempaloo.studio || {};
            window.tempaloo.studio.__hiw = window.tempaloo.studio.__hiw || [];
            window.tempaloo.studio.__hiw.push({ rootEl: rootEl, ctx: ctx });
        }
    }

    window.tempaloo = window.tempaloo || {};
    window.tempaloo.avero = window.tempaloo.avero || {};
    window.tempaloo.avero.howItWorks = init;

    ts.onReady('.tw-avero-how-it-works', init);
})();
