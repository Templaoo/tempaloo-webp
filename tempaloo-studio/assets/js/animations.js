/* ============================================================
 * Tempaloo Studio — central animation runtime
 *
 * Single GSAP-powered engine that any widget can opt into via DATA
 * ATTRIBUTES on its markup — no per-widget GSAP code needed.
 *
 * Convention:
 *
 *   <section class="tw-…" data-tw-anim-scope="hero">
 *     <h1 data-tw-anim-target="title">…</h1>
 *     <p  data-tw-anim-target="lead">…</p>
 *     <a  data-tw-anim-target="cta">…</a>
 *   </section>
 *
 * The runtime resolves the preset for each `data-tw-anim-scope` from
 * `window.tempaloo.studio.anims[scope]` (emitted by PHP from the
 * template manifest + user overrides) and applies a GSAP timeline
 * across all `data-tw-anim-target` children.
 *
 * Adding a new preset = registering a function in PRESETS.
 * Per-widget customization = editing `window.tempaloo.studio.anims[…]`.
 * No widget script.js is required for entrance animation — just markup.
 *
 * Behavioral animations (hover lift, number counter, marquee, magnetic)
 * use `data-tw-anim` (no scope/target prefix) and are applied to
 * matching elements globally.
 * ============================================================ */
(function () {
    'use strict';

    var ts = (window.tempaloo && window.tempaloo.studio) || {};
    if (!ts.onReady || !ts.delegate) return;

    /* ── Debug logger — opt-in via ?tw_debug=1 OR localStorage ─
     *
     * When enabled, logs the entire animation pipeline to the console
     * so we can diagnose "widget invisible after refresh" reports.
     * Tracks: GSAP load timing, plugin registration, scope discovery,
     * preset application, ScrollTrigger fire events, errors caught.
     *
     * Activation:
     *   - Add `?tw_debug=1` to any URL → immediate trace for that load
     *   - Or run `localStorage.setItem('tw_debug','1')` for persistent
     *   - Or `?tw_debug=0` / `localStorage.removeItem('tw_debug')` to clear
     */
    var DEBUG = (function () {
        try {
            // Honor BOTH ?tw_debug=1 (animations runtime) and ?fp_debug=1
            // (floating panel) — flipping either one turns on tracing
            // across the whole stack so the user has a single switch.
            var qs1 = location.search.match(/[?&]tw_debug=([^&]*)/);
            var qs2 = location.search.match(/[?&]fp_debug=([^&]*)/);
            if (qs1) {
                var v = qs1[1];
                if (v === '1' || v === 'true') { localStorage.setItem('tw_debug', '1'); return true; }
                if (v === '0' || v === 'false') { localStorage.removeItem('tw_debug'); return false; }
            }
            if (qs2 && (qs2[1] === '1' || qs2[1] === 'true')) {
                localStorage.setItem('tw_debug', '1');
                return true;
            }
            return localStorage.getItem('tw_debug') === '1' || localStorage.getItem('fp_debug') === '1';
        } catch (e) { return false; }
    })();

    function log() {
        if (!DEBUG || !window.console) return;
        var args = Array.prototype.slice.call(arguments);
        args.unshift('%c[tw]', 'color:#3fb2a2;font-weight:bold');
        try { console.log.apply(console, args); } catch (e) {}
    }
    function warn() {
        if (!window.console) return;
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[tw]');
        try { console.warn.apply(console, args); } catch (e) {}
    }

    log('runtime boot — gsap=' + !!window.gsap + ' scrollTrigger=' + !!window.ScrollTrigger + ' debug=' + DEBUG);
    if (DEBUG) {
        // Expose hooks for manual inspection in DevTools.
        window.tempaloo.studio.__debug = {
            stuckElements: function () {
                var stuck = [];
                document.querySelectorAll('[data-tw-anim-scope], [data-tw-anim-target], [data-tw-anim-text]').forEach(function (el) {
                    if (parseFloat(getComputedStyle(el).opacity) < 0.05) stuck.push(el);
                });
                return stuck;
            },
            forceShow: function () { ensureVisible(true); },
            scrollTriggers: function () { return window.ScrollTrigger ? window.ScrollTrigger.getAll() : []; },
        };
    }

    /* ── Register ScrollTrigger with GSAP — CRITICAL ─────────
     *
     * Without this, every `gsap.from(target, { scrollTrigger: {…} })`
     * call has its scrollTrigger option silently ignored — the tween
     * fires immediately on init instead of waiting for the element
     * to enter the viewport. GSAP requires `registerPlugin` to expose
     * ScrollTrigger to its tween parser.
     *
     * We do it here (animations.js) rather than relying on global.js
     * because the load order between the two scripts isn't guaranteed
     * in every setup. Idempotent via `__twSTRegistered` flag.
     */
    if (window.gsap && window.ScrollTrigger && !window.gsap.__twSTRegistered) {
        if (typeof window.gsap.registerPlugin === 'function') {
            try {
                window.gsap.registerPlugin(window.ScrollTrigger);
                window.gsap.__twSTRegistered = true;
                log('ScrollTrigger registered with GSAP');
            } catch (e) { warn('ScrollTrigger registerPlugin threw:', e); }
        }
    } else if (!window.gsap) {
        warn('GSAP not loaded at animations.js eval — animations will silently no-op');
    } else if (!window.ScrollTrigger) {
        warn('ScrollTrigger not loaded — scroll-into-view animations will fire on init instead');
    }

    /* ── Safety net — force visibility on stuck elements ─────
     *
     * Defensive fallback for any element that ends up at opacity 0
     * for >4 seconds after page load. Possible causes: GSAP failed
     * to register, a preset threw mid-execution, ScrollTrigger
     * computed wrong offsets due to layout shift, or browser quirks
     * on history-restored scroll positions. This guarantees the page
     * is ALWAYS usable — animations are nice-to-have, content visibility
     * is non-negotiable.
     */
    function ensureVisible(force) {
        // CRITICAL: only force visibility on elements CURRENTLY IN VIEWPORT.
        // Elements below the fold at opacity 0 are INTENTIONAL — they're
        // waiting for ScrollTrigger to fire when the user scrolls down.
        // Forcing them visible here breaks the scroll-into-view animation
        // entirely (they appear instantly with no animation when reached).
        // The safety net should ONLY catch genuine stuck-at-0 cases:
        // elements visible in the viewport that should have animated but
        // didn't.
        function inViewport(el) {
            var r = el.getBoundingClientRect();
            // A bit of margin so elements at the edge are still considered in.
            return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
        }

        var stuckRoots = [];
        var stuckSplits = [];
        document.querySelectorAll('[data-tw-anim-scope], [data-tw-anim-target], [data-tw-anim-text]').forEach(function (el) {
            if (!inViewport(el)) return;
            var op = parseFloat(getComputedStyle(el).opacity);
            if (op < 0.05) stuckRoots.push(el);
        });
        // Split-text descendants (words / chars / lines) — same in-viewport
        // gate so we don't break scroll-words-fill etc. that are intentionally
        // dim until scrubbed.
        document.querySelectorAll('.tw-word, .tw-word__inner, .tw-char, .tw-line__inner').forEach(function (el) {
            if (!inViewport(el)) return;
            var op = parseFloat(getComputedStyle(el).opacity);
            if (op < 0.05) stuckSplits.push(el);
        });

        if (!stuckRoots.length && !stuckSplits.length) {
            log('safety net: all in-viewport elements visible');
            return;
        }
        warn('safety net: forcing visibility on', stuckRoots.length, 'in-viewport roots +',
             stuckSplits.length, 'split-spans', force ? '(manual)' : '(auto)');

        // restoreVisibility is defined later in the file but hoisted via
        // function declaration. Same routine as the per-preset catch
        // handler — keeps recovery behavior consistent.
        stuckRoots.forEach(restoreVisibility);
        stuckSplits.forEach(restoreVisibility);
    }
    // Schedule the safety net once layout has settled.
    if (document.readyState === 'complete') {
        setTimeout(function () { ensureVisible(false); }, 4000);
    } else {
        window.addEventListener('load', function () {
            setTimeout(function () { ensureVisible(false); }, 4000);
        });
    }

    /* ── Boot-time asset audit (debug only) ─────────────────── */
    function bootAudit() {
        if (!DEBUG) return;
        var stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .map(function (l) { return l.href; });
        var scripts = Array.from(document.scripts)
            .map(function (s) { return s.src; })
            .filter(Boolean);
        var twStyles  = stylesheets.filter(function (h) { return h.indexOf('tempaloo-studio') >= 0; });
        var twScripts = scripts.filter(function (h) { return h.indexOf('tempaloo-studio') >= 0; });
        var scopes    = document.querySelectorAll('[data-tw-anim-scope]').length;
        var targets   = document.querySelectorAll('[data-tw-anim-target]').length;
        var textTgts  = document.querySelectorAll('[data-tw-anim-text]').length;
        var anims     = (window.tempaloo && window.tempaloo.studio && window.tempaloo.studio.anims) || {};

        log('— BOOT AUDIT —');
        log('  GSAP:', window.gsap ? window.gsap.version || '?' : 'MISSING');
        log('  ScrollTrigger:', window.ScrollTrigger ? window.ScrollTrigger.version || '?' : 'MISSING');
        log('  ST registered:', !!(window.gsap && window.gsap.__twSTRegistered));
        log('  Stylesheets (tempaloo):', twStyles);
        log('  Scripts (tempaloo):', twScripts);
        log('  Widget scopes found:', scopes);
        log('  Anim targets found:', targets, '(text:', textTgts + ')');
        log('  Anims config:', Object.keys(anims).length ? anims : '(empty)');
        log('  intensity:', level());
    }
    if (document.readyState !== 'loading') bootAudit();
    else document.addEventListener('DOMContentLoaded', bootAudit);

    /* ── ScrollTrigger refresh strategy (Sprint 1 / point #5) ───
     *
     * Inspired by Motion.page: instead of 5 scattered refresh hooks,
     * one global refresher that:
     *   1. Sorts triggers top-to-bottom (fixes pin-spacing miscalcs
     *      when triggers are declared out of source order — common in
     *      Elementor where widgets mount asynchronously).
     *   2. Refreshes every trigger.
     *
     * Wired to:
     *   • window.load + 92ms (Motion.page's magic number — lets the
     *     final layout settle before recomputing offsets).
     *   • document.fonts.ready (web fonts swap shifts text bounds).
     *   • Lazy-load events from popular WP plugins (Smush, a3-lazy-load,
     *     Lazy Load XT) — they all fire `lazyloaded` after each image
     *     hot-swaps. Recompute so trigger positions stay accurate.
     *   • window.resize (debounced 200ms — ScrollTrigger does this
     *     natively but we add a backup for restored scroll positions).
     *
     * Exposed as window.tempaloo.studio.refreshScroll so widget scripts
     * can trigger it on demand (e.g. after revealing a hidden tab panel).
     */
    var globalRefreshTimer;
    function refreshScrollTrigger(why) {
        if (!window.ScrollTrigger) return;
        try {
            if (typeof window.ScrollTrigger.sort === 'function') {
                window.ScrollTrigger.sort();
            }
            window.ScrollTrigger.getAll().forEach(function (t) {
                try { t.refresh(); } catch (e) {}
            });
            log('ScrollTrigger.refresh()', why || '');
        } catch (e) { warn('ScrollTrigger.refresh threw:', e); }
    }
    function scheduleRefresh(why, delay) {
        clearTimeout(globalRefreshTimer);
        globalRefreshTimer = setTimeout(function () { refreshScrollTrigger(why); }, delay || 92);
    }
    // Initial refresh — covers all readyState cases.
    if (document.readyState === 'complete') {
        scheduleRefresh('initial', 50);
    } else {
        window.addEventListener('load', function () { scheduleRefresh('window-load', 92); });
    }
    // Web fonts swap.
    if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
        document.fonts.ready.then(function () { scheduleRefresh('fonts-ready', 0); });
    }
    // Sprint 1 / point #6 — lazy-load image hook. Most WP lazy-load
    // plugins (Smush, a3-lazy-load, Lazy Load XT, etc.) emit
    // `lazyloaded` once they swap the real <img src>. Without this,
    // ScrollTrigger keeps the offsets it computed when the placeholder
    // (1×1 transparent) was in place — animations fire at the wrong
    // scroll position. Debounced via scheduleRefresh.
    document.addEventListener('lazyloaded', function () { scheduleRefresh('lazyloaded', 0); });
    // Also handle native loading=lazy images that complete after first
    // paint (load event bubbles from <img>).
    document.addEventListener('load', function (e) {
        if (e.target && e.target.tagName === 'IMG') scheduleRefresh('img-load', 0);
    }, true);
    // Resize backup (ST handles this natively but for restored scroll
    // positions on history navigation we want our own debounced trigger).
    var resizeTimer;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () { scheduleRefresh('resize', 0); }, 200);
    });
    // Public: widget scripts can call ts.refreshScroll() after revealing
    // hidden panels (tabs, accordions, modals) so triggers inside them
    // recompute against the now-visible layout.
    ts.refreshScroll = scheduleRefresh;

    /* ── Helpers ─────────────────────────────────────────────── */

    function gsap()   { return window.gsap || null; }
    function hasST()  { return !!window.ScrollTrigger; }
    function level() {
        var ns = (window.tempaloo && window.tempaloo.avero) || {};
        if (ns.animationLevel) return ns.animationLevel();
        // Fallback if a template doesn't ship its own namespace.
        var cfg = (window.tempaloo && window.tempaloo.studio && window.tempaloo.studio.animation) || {};
        var lvl = cfg.intensity || 'medium';
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches && lvl !== 'off') return 'subtle';
        return lvl;
    }
    function intensityFactor(lvl) {
        if (lvl === 'subtle') return 0;       // no transforms, opacity-only handled by 'fade'
        if (lvl === 'bold')   return 1.4;
        return 1;                              // medium = 1
    }

    /* ── Direction model — how a scroll-triggered animation behaves
     *    when the user moves through it multiple times:
     *
     *      'once'          — play on first enter, kill the trigger.
     *      'replay'        — replay forward on every enter (down OR up).
     *      'bidirectional' — play forward on enter, REVERSE when the
     *                        user scrolls back up past the trigger
     *                        (mirror entrance choreography). DEFAULT.
     *      'scrub'         — progress tied 1:1 to scroll position.
     *                        Requires the §1.15.4 tween↔trigger link.
     *
     * Per the gsap-scrolltrigger skill, we always use the *standalone*
     * ScrollTrigger pattern (no `animation:` link) for the first three
     * directions — onEnter / onEnterBack / onLeaveBack callbacks
     * play / reverse a paused timeline. Scrub falls back to direct
     * tween linkage because it has no other implementation path.
     *
     * Reliability hardening (per how-it-works fix):
     *   - invalidateOnRefresh: true on every trigger
     *   - syncTimelineToTrigger: after the trigger refreshes, snap the
     *     timeline's progress to match the trigger's progress, so a
     *     page reload while scrolled past the trigger leaves the
     *     animation in its end state (visible) instead of stuck at
     *     progress=0 (hidden).
     */
    function defaultDirection() {
        var cfg = (window.tempaloo && window.tempaloo.studio && window.tempaloo.studio.animation) || {};
        var d   = (cfg.direction || '').toLowerCase();
        if (d === 'once' || d === 'replay' || d === 'bidirectional' || d === 'scrub') return d;
        return 'bidirectional';
    }

    /**
     * Build a sync handler that snaps a paused timeline's progress to a
     * ScrollTrigger's current progress. Critical for page-reload-past-
     * trigger cases: without this, the user sees a flash of fromState
     * (e.g. opacity:0) before ScrollTrigger fires onEnter — looks like
     * the heading "loses its highlight" on reload.
     *
     * Wire via the trigger's per-instance onRefresh callback (gsap docs:
     * "Use refreshPriority and per-trigger onRefresh"), NOT the global
     * ScrollTrigger.addEventListener('refresh') — the global path leaks
     * one listener per widget mount and re-fires for every other trigger.
     */
    function buildSync(tl, applyFromState) {
        var ranOnce = false;
        return function (self) {
            if (!tl) return;
            try {
                var p = typeof self.progress === 'number'
                            ? self.progress
                            : (typeof self.progress === 'function' ? self.progress() : 0);
                var scrollY = window.pageYOffset || (document.documentElement && document.documentElement.scrollTop) || 0;

                if (p > 0.01) {
                    // The trigger is already past `start` on first refresh.
                    // Two distinct cases — must NOT be conflated:
                    //
                    //   A) scrollY > 50  (user reloaded mid-page)
                    //      Snap to played state — no flash, no replay of
                    //      content the user has already seen.
                    //
                    //   B) scrollY ≤ 50  (page just loaded at the top)
                    //      The element is above-the-fold but technically
                    //      past `top 85%`. The user IS entering the page
                    //      → entrance MUST play, not snap. Apply fromState
                    //      then play the timeline normally.
                    //
                    // Conflating both broke text presets (typewriter,
                    // word-fade-blur etc.) for above-the-fold heroes —
                    // they were locked to opacity:1 with no animation.
                    if (scrollY > 50 || ranOnce) {
                        if (tl.progress() < 0.99) tl.progress(1).pause();
                    } else {
                        if (typeof applyFromState === 'function') applyFromState();
                        tl.progress(0).play();
                    }
                } else {
                    // Before start — apply fromState so the entrance can
                    // play when the user scrolls down through start.
                    if (typeof applyFromState === 'function') applyFromState();
                    if (tl.progress() > 0.01) tl.progress(0).pause();
                }
                ranOnce = true;
            } catch (e) { warn('sync threw', e); }
        };
    }

    /* ── scheduleAnim — central dispatcher honoring `direction`.
     *
     * Builds a paused timeline that animates `targets` from `fromState`
     * → `toState`. If a scrollTriggerCfg is provided, wires the
     * timeline to a ScrollTrigger according to the chosen direction.
     */
    function scheduleAnim(targets, fromState, toState, scrollTriggerCfg, direction, delay) {
        var g = gsap();
        if (!g) return null;
        direction = direction || defaultDirection();

        // Universal `delay` (in seconds, gsap-core param). Injected on
        // toState so GSAP holds the tween for `delay` seconds before
        // playing. Honours per-rule delays set in the React admin.
        if (typeof delay === 'number' && delay > 0) {
            toState = Object.assign({}, toState, { delay: delay });
        }

        var applyFromState = function () {
            try { g.set(targets, fromState); } catch (e) { warn('gsap.set failed', e); }
        };

        // Scrub mode — REQUIRES tween↔trigger link (§1.15.4 exception).
        // We bypass the timeline+callback path and create the tween with
        // an inline scrollTrigger that has scrub:true. Scrub computes its
        // own progress from scroll position, so the flash-of-hidden bug
        // doesn't apply here — we still gsap.set so initial frame matches.
        if (direction === 'scrub' && scrollTriggerCfg && window.ScrollTrigger) {
            applyFromState();
            try {
                return g.to(targets, Object.assign({ overwrite: 'auto' }, toState, {
                    scrollTrigger: {
                        trigger: scrollTriggerCfg.trigger,
                        start:   scrollTriggerCfg.start || 'top 85%',
                        end:     scrollTriggerCfg.end   || 'bottom 30%',
                        scrub:   true,
                        invalidateOnRefresh: true,
                    },
                }));
            } catch (e) {
                warn('scrub setup threw — falling back to bidirectional', e);
                direction = 'bidirectional';
            }
        }

        // Build a paused timeline so the trigger callbacks (or our
        // immediate-play fallback) can play / reverse it cleanly.
        var tl;
        try {
            tl = g.timeline({ paused: true });
            tl.to(targets, Object.assign({ overwrite: 'auto' }, toState));
        } catch (e) {
            warn('timeline build failed — restoring visibility', e);
            Array.prototype.forEach.call(targets, restoreVisibility);
            return null;
        }

        if (!scrollTriggerCfg || !window.ScrollTrigger) {
            applyFromState();
            tl.play();
            return tl;
        }

        var cfg = {
            trigger:             scrollTriggerCfg.trigger,
            start:               scrollTriggerCfg.start || 'top 85%',
            end:                 scrollTriggerCfg.end,
            invalidateOnRefresh: true,
            // CRITICAL — onRefresh fires once on create (after positions
            // computed) and again on every layout change. We use it to
            // snap timeline progress AND lazily apply fromState only when
            // scroll is before start. On reload past start, fromState is
            // never rendered → no flash of opacity:0 ("lost highlight").
            onRefresh: buildSync(tl, applyFromState),
        };

        if (direction === 'once') {
            cfg.once    = true;
            cfg.onEnter = function () { tl.play(); };
        } else if (direction === 'replay') {
            cfg.onEnter     = function () { tl.progress(0); tl.play(); };
            cfg.onEnterBack = function () { tl.progress(0); tl.play(); };
        } else { // bidirectional (default)
            cfg.onEnter     = function () { tl.play(); };
            cfg.onEnterBack = function () { tl.play(); };
            cfg.onLeaveBack = function () { tl.reverse(); };
        }

        try {
            window.ScrollTrigger.create(cfg);
        } catch (e) {
            warn('ScrollTrigger.create failed — playing tween immediately', e);
            applyFromState();
            tl.play();
        }

        return tl;
    }

    /* ── withScroll — same direction model for ad-hoc tweens (text
     *    presets, behavioral animations). Caller provides a runFn
     *    that BUILDS its own gsap.to/timeline when invoked, plus the
     *    fromState we use to gsap.set initial styles.
     *
     * Two run callbacks expected:
     *   playFn()    — applies the "to" state (forward animation)
     *   reverseFn() — applies the "from" state (reverse, optional)
     *
     * If only playFn is provided, bidirectional/replay degrade to
     * once-style behavior (no reverse on scroll up).
     */
    function withScroll(opts, playFn, reverseFn, setFromFn) {
        opts = opts || {};
        var direction = (opts.direction || defaultDirection()).toLowerCase();

        // No trigger — apply fromState then play immediately (parity with
        // the no-scrolltrigger branch in scheduleAnim).
        if (!opts.scrollTrigger || !window.ScrollTrigger) {
            if (typeof setFromFn === 'function') { try { setFromFn(); } catch (e) {} }
            try { playFn(); } catch (e) {}
            return;
        }

        var fromApplied = false;
        var played      = false;

        var ensureFrom = function () {
            if (fromApplied || typeof setFromFn !== 'function') return;
            fromApplied = true;
            try { setFromFn(); } catch (e) { warn('setFromFn threw', e); }
        };
        // `delay` (gsap-core) — wait N seconds before playFn fires. Text
        // presets don't pass delay through their own gsap.to() params, so
        // we wrap the playFn invocation in a setTimeout. Matches GSAP's
        // delay semantics for the user (the entrance starts late) without
        // touching every individual preset.
        var delayMs = (typeof opts.delay === 'number' && opts.delay > 0) ? Math.round(opts.delay * 1000) : 0;
        var runPlay = function () { try { playFn(); } catch (e) {} };
        var safePlay = function () {
            ensureFrom();
            played = true;
            if (delayMs) setTimeout(runPlay, delayMs);
            else runPlay();
        };
        var safeReplay = function () {
            ensureFrom();
            played = true;
            if (delayMs) setTimeout(runPlay, delayMs);
            else runPlay();
        };
        var safeReverse = function () {
            if (!played) return; // never reverse before first play
            try { reverseFn(); } catch (e) {}
        };

        var cfg = {
            trigger:             opts.scrollTrigger.trigger,
            start:               opts.scrollTrigger.start || 'top 85%',
            end:                 opts.scrollTrigger.end,
            invalidateOnRefresh: true,
            // CRITICAL — defer fromState until ScrollTrigger has computed
            // positions. If reload lands past start, fromState is never
            // applied → no flash of hidden text ("lost highlight").
            //
            // Two cases when past start on first refresh:
            //   • scrollY > 50  → mid-page reload, snap to played state.
            //   • scrollY ≤ 50  → page just loaded at top. Element is
            //     above-the-fold but technically past start. Apply
            //     fromState then play — typewriter / word-fade-blur etc.
            //     MUST animate on first paint when the user is entering.
            onRefresh: function (self) {
                if (played) return;
                var p = typeof self.progress === 'number' ? self.progress : 0;
                var scrollY = window.pageYOffset || (document.documentElement && document.documentElement.scrollTop) || 0;
                if (p > 0.01) {
                    if (scrollY > 50) {
                        played = true;
                        try { playFn(); } catch (e) {}
                    } else {
                        ensureFrom();
                        played = true;
                        try { playFn(); } catch (e) {}
                    }
                } else {
                    ensureFrom();
                }
            },
        };

        if (direction === 'once') {
            cfg.once    = true;
            cfg.onEnter = safePlay;
        } else if (direction === 'replay') {
            cfg.onEnter     = safeReplay;
            cfg.onEnterBack = safeReplay;
        } else { // bidirectional
            cfg.onEnter     = safePlay;
            cfg.onEnterBack = safePlay;
            if (typeof reverseFn === 'function') {
                cfg.onLeaveBack = safeReverse;
            }
        }

        try {
            window.ScrollTrigger.create(cfg);
        } catch (e) {
            warn('withScroll: ScrollTrigger.create failed — running immediately', e);
            ensureFrom();
            try { playFn(); } catch (e2) {}
        }
    }

    /* ── Entrance presets ────────────────────────────────────── */

    /**
     * Each preset receives:
     *   targets — Array<HTMLElement>  (the elements to animate)
     *   opts    — { stagger, duration, scrollTrigger?, lvlFactor }
     */
    /**
     * Helpers — read schema-typed params with sensible fallbacks.
     * The runtime now honours every param the React admin exposes
     * (audit fix: y / x / scaleFrom / blurFrom / ease / useAutoAlpha
     * were previously ignored — derived from lvlFactor only).
     */
    function pNum(opts, key, fallback) {
        var v = opts && opts.params && opts.params[key];
        return (typeof v === 'number') ? v : fallback;
    }
    function pStr(opts, key, fallback) {
        var v = opts && opts.params && opts.params[key];
        return (typeof v === 'string' && v) ? v : fallback;
    }
    function pBool(opts, key, fallback) {
        var v = opts && opts.params && opts.params[key];
        return (typeof v === 'boolean') ? v : fallback;
    }
    /** Use autoAlpha (which sets visibility:hidden too) when the rule
     *  asks for it (gsap-core best practice). Falls back to plain opacity. */
    function fadeKey(opts) { return pBool(opts, 'useAutoAlpha', false) ? 'autoAlpha' : 'opacity'; }

    /**
     * Resolve the markup parts world-expands needs (inner / media / overlay)
     * from ARBITRARY user markup — so the preset can be applied to any
     * widget (Tempaloo or native Elementor) via Animate Mode without the
     * user having to author specific BEM classes.
     *
     * Three resolution paths, tried in order:
     *
     *   A. AUTHORED BEM
     *      `.tw-anim-world-expands__inner / __media / __overlay`.
     *      Used by Tempaloo widgets that bake the markup in.
     *
     *   B. NATIVE <img> / <picture> / <video> child anywhere inside.
     *      The "inner" is the deepest direct child of rootEl that
     *      contains the media. If the media is itself a direct child,
     *      we synthesize a wrapper div so we have one element to scale.
     *      Headings + paragraphs that are NOT inside the media are
     *      treated as the overlay.
     *
     *   C. CSS background-image fallback — for sections / containers
     *      that use a backdrop image (most common Elementor pattern).
     *      We inject a real `<img>` covering the host so the rest of
     *      the animation logic works uniformly. Original bg-image is
     *      hidden during the effect and restored on revert.
     *
     *   D. NO MEDIA — bare container with text / buttons (a CTA card,
     *      a FAQ, any widget that's just elements). The container's
     *      own visual presentation (background-color / gradient /
     *      border / etc.) is transferred to a synthesized inner so
     *      the unfurl-to-fullscreen effect carries the section's
     *      look. The rootEl's bg is masked during the effect and
     *      restored on revert.
     *
     * Returns `{ inner, media, overlay, restore }`. Media may be null
     * (PATH D). The `restore` callback undoes any DOM mutations on
     * revert. Returns `null` only if rootEl has no children at all.
     */
    function resolveWorldExpandsTargets(rootEl) {
        // PATH A — explicit BEM authored markup
        var bemInner   = rootEl.querySelector('.tw-anim-world-expands__inner');
        var bemMedia   = rootEl.querySelector('.tw-anim-world-expands__media');
        var bemOverlay = rootEl.querySelector('.tw-anim-world-expands__overlay');
        if (bemInner && bemMedia) {
            return {
                inner:   bemInner,
                media:   bemMedia,
                overlay: bemOverlay || null,
                restore: function () {},
            };
        }

        var restoreSteps = [];
        var pushRestore  = function (fn) { restoreSteps.push(fn); };

        // PATH B — find a real media element
        var media = rootEl.querySelector('img, picture, video');

        // PATH C — fall back to CSS background-image if no real media
        if (!media) {
            var hosts = [rootEl].concat(Array.prototype.slice.call(rootEl.querySelectorAll('*')));
            var bgHost = null, bgUrl = '';
            for (var i = 0; i < hosts.length; i++) {
                var bg = window.getComputedStyle(hosts[i]).backgroundImage;
                var m  = bg && bg.match(/url\(["']?([^"')]+)["']?\)/);
                if (m && m[1]) { bgHost = hosts[i]; bgUrl = m[1]; break; }
            }
            if (bgHost) {
                // Inject a real <img> covering the host so the scale/dezoom
                // logic in PATH B applies uniformly. Hide the original bg
                // during the animation; restore on revert.
                var imgEl = document.createElement('img');
                imgEl.src = bgUrl;
                imgEl.alt = '';
                imgEl.setAttribute('aria-hidden', 'true');
                imgEl.style.cssText = 'display:block;position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;pointer-events:none;';
                var prevPos = bgHost.style.position;
                var prevBg  = bgHost.style.backgroundImage;
                if (window.getComputedStyle(bgHost).position === 'static') {
                    bgHost.style.position = 'relative';
                }
                bgHost.style.backgroundImage = 'none';
                bgHost.insertBefore(imgEl, bgHost.firstChild);
                media = imgEl;
                pushRestore(function () {
                    bgHost.style.position        = prevPos;
                    bgHost.style.backgroundImage = prevBg;
                    if (imgEl.parentNode) imgEl.parentNode.removeChild(imgEl);
                });
            }
            // No bg-image either → fall through to PATH D below.
        }

        // Bail only if the rootEl is completely empty (no children at all
        // and no media to work with). Otherwise we always have something.
        if (!media && !rootEl.firstChild) return null;

        // Resolve `inner`.
        // - WITH media : walk up from media until just below rootEl.
        //                If media is a direct child of rootEl, wrap.
        // - WITHOUT media (PATH D): synthesize a wrapper around rootEl's
        //                children so we have a separate element to grow
        //                from card to fullscreen. Transfer the rootEl's
        //                visual presentation (bg, border, color) so the
        //                unfurl carries the section's look. Hide rootEl's
        //                own bg during the effect; restore on revert.
        var inner;
        if (media) {
            inner = media;
            while (inner.parentElement && inner.parentElement !== rootEl) {
                inner = inner.parentElement;
            }
            if (inner === media || inner.parentElement !== rootEl) {
                var wrapM = document.createElement('div');
                wrapM.className = 'tw-world-expands__synth-inner';
                wrapM.style.cssText = 'position:relative;display:block;';
                while (rootEl.firstChild) wrapM.appendChild(rootEl.firstChild);
                rootEl.appendChild(wrapM);
                inner = wrapM;
                pushRestore(function () {
                    while (wrapM.firstChild) rootEl.appendChild(wrapM.firstChild);
                    if (wrapM.parentNode) wrapM.parentNode.removeChild(wrapM);
                });
            }
        } else {
            // PATH D — bare container, no visual media.
            var rootCS = window.getComputedStyle(rootEl);
            var wrapD = document.createElement('div');
            wrapD.className = 'tw-world-expands__synth-inner';
            // Transfer the visual presentation so the synthesized inner
            // visually represents rootEl when it grows. Carry both bg
            // layers (color + image/gradient) and border-radius so the
            // card pre-state looks right.
            wrapD.style.cssText = [
                'position:relative',
                'display:block',
                'box-sizing:border-box',
                'background-color:' + rootCS.backgroundColor,
                'background-image:' + rootCS.backgroundImage,
                'background-size:'  + rootCS.backgroundSize,
                'background-position:' + rootCS.backgroundPosition,
                'background-repeat:' + rootCS.backgroundRepeat,
                'color:' + rootCS.color,
            ].join(';');
            while (rootEl.firstChild) wrapD.appendChild(rootEl.firstChild);
            rootEl.appendChild(wrapD);
            // Mask rootEl's own bg so we don't paint twice (once on rootEl
            // statically, once on inner growing). Capture only what we
            // override so revert is faithful.
            var prevRootCol = rootEl.style.backgroundColor;
            var prevRootImg = rootEl.style.backgroundImage;
            rootEl.style.backgroundColor = 'transparent';
            rootEl.style.backgroundImage = 'none';
            inner = wrapD;
            pushRestore(function () {
                while (wrapD.firstChild) rootEl.appendChild(wrapD.firstChild);
                if (wrapD.parentNode) wrapD.parentNode.removeChild(wrapD);
                rootEl.style.backgroundColor = prevRootCol;
                rootEl.style.backgroundImage = prevRootImg;
            });
        }

        // Resolve `overlay` — first headline / paragraph NOT inside the
        // media element. Returns null if none found (image-only mode).
        var overlay = null;
        var candidates = rootEl.querySelectorAll('h1, h2, h3, h4, p, [data-tw-anim-target]');
        for (var j = 0; j < candidates.length; j++) {
            if (!media.contains(candidates[j])) { overlay = candidates[j]; break; }
        }

        return {
            inner:   inner,
            media:   media,
            overlay: overlay,
            restore: function () {
                for (var k = restoreSteps.length - 1; k >= 0; k--) {
                    try { restoreSteps[k](); } catch (e) {}
                }
            },
        };
    }

    var PRESETS = {
        'none': function () { /* no-op */ },

        'fade': function (targets, opts) {
            var k = fadeKey(opts);
            var from = {}, to = {};
            from[k] = 0; to[k] = 1;
            to.duration = pNum(opts, 'duration', 0.45);
            to.ease     = pStr(opts, 'ease', 'power1.out');
            to.stagger  = pNum(opts, 'stagger', 0);
            to.clearProps = k === 'autoAlpha' ? 'opacity,visibility' : 'opacity';
            scheduleAnim(targets, from, to, opts.scrollTrigger, opts.direction, opts.delay);
        },

        'fade-up': function (targets, opts) {
            // Schema y wins. lvlFactor still scales it (subtle = 0
            // collapses transforms; bold = 1.4 amplifies).
            var y = pNum(opts, 'y', 24) * (opts.lvlFactor != null ? opts.lvlFactor : 1);
            var k = fadeKey(opts);
            var from = { y: y }, to = { y: 0 };
            from[k] = 0; to[k] = 1;
            to.duration = pNum(opts, 'duration', 0.7);
            to.ease     = pStr(opts, 'ease', 'power3.out');
            to.stagger  = pNum(opts, 'stagger', 0);
            to.clearProps = (k === 'autoAlpha' ? 'opacity,visibility,' : 'opacity,') + 'transform';
            scheduleAnim(targets, from, to, opts.scrollTrigger, opts.direction, opts.delay);
        },

        'fade-down': function (targets, opts) {
            var y = -pNum(opts, 'y', 24) * (opts.lvlFactor != null ? opts.lvlFactor : 1);
            var k = fadeKey(opts);
            var from = { y: y }, to = { y: 0 };
            from[k] = 0; to[k] = 1;
            to.duration = pNum(opts, 'duration', 0.7);
            to.ease     = pStr(opts, 'ease', 'power3.out');
            to.stagger  = pNum(opts, 'stagger', 0);
            to.clearProps = (k === 'autoAlpha' ? 'opacity,visibility,' : 'opacity,') + 'transform';
            scheduleAnim(targets, from, to, opts.scrollTrigger, opts.direction, opts.delay);
        },

        'fade-left': function (targets, opts) {
            var x = -pNum(opts, 'x', 32) * (opts.lvlFactor != null ? opts.lvlFactor : 1);
            var k = fadeKey(opts);
            var from = { x: x }, to = { x: 0 };
            from[k] = 0; to[k] = 1;
            to.duration = pNum(opts, 'duration', 0.7);
            to.ease     = pStr(opts, 'ease', 'power3.out');
            to.stagger  = pNum(opts, 'stagger', 0);
            to.clearProps = (k === 'autoAlpha' ? 'opacity,visibility,' : 'opacity,') + 'transform';
            scheduleAnim(targets, from, to, opts.scrollTrigger, opts.direction, opts.delay);
        },

        'fade-right': function (targets, opts) {
            var x = pNum(opts, 'x', 32) * (opts.lvlFactor != null ? opts.lvlFactor : 1);
            var k = fadeKey(opts);
            var from = { x: x }, to = { x: 0 };
            from[k] = 0; to[k] = 1;
            to.duration = pNum(opts, 'duration', 0.7);
            to.ease     = pStr(opts, 'ease', 'power3.out');
            to.stagger  = pNum(opts, 'stagger', 0);
            to.clearProps = (k === 'autoAlpha' ? 'opacity,visibility,' : 'opacity,') + 'transform';
            scheduleAnim(targets, from, to, opts.scrollTrigger, opts.direction, opts.delay);
        },

        'scale-in': function (targets, opts) {
            // scaleFrom from schema (0.5–1). Falls back to old
            // lvlFactor-derived computation when the schema didn't
            // provide one (legacy templates).
            var scaleFrom = pNum(opts, 'scaleFrom', 1 - 0.08 * (opts.lvlFactor != null ? opts.lvlFactor : 1));
            var k = fadeKey(opts);
            var from = { scale: scaleFrom }, to = { scale: 1 };
            from[k] = 0; to[k] = 1;
            to.duration = pNum(opts, 'duration', 0.7);
            to.ease     = pStr(opts, 'ease', 'back.out(1.4)');
            to.stagger  = pNum(opts, 'stagger', 0);
            to.clearProps = (k === 'autoAlpha' ? 'opacity,visibility,' : 'opacity,') + 'transform';
            scheduleAnim(targets, from, to, opts.scrollTrigger, opts.direction, opts.delay);
        },

        'blur-in': function (targets, opts) {
            // blurFrom from schema (0–50px). lvlFactor still modulates.
            var blurFrom = pNum(opts, 'blurFrom', 20) * (opts.lvlFactor != null ? opts.lvlFactor : 1);
            var k = fadeKey(opts);
            var from = { filter: 'blur(' + blurFrom + 'px)', willChange: 'opacity, filter' };
            var to   = { filter: 'blur(0px)' };
            from[k] = 0; to[k] = 1;
            to.duration = pNum(opts, 'duration', 0.85);
            to.ease     = pStr(opts, 'ease', 'power3.out');
            to.stagger  = pNum(opts, 'stagger', 0);
            to.clearProps = (k === 'autoAlpha' ? 'opacity,visibility,' : 'opacity,') + 'filter,willChange';
            scheduleAnim(targets, from, to, opts.scrollTrigger, opts.direction, opts.delay);
        },

        'mask-reveal': function (targets, opts) {
            var f = opts.lvlFactor != null ? opts.lvlFactor : 1;
            // At "subtle" (lvlFactor 0), drop to opacity-only fade —
            // clip-path on tiny elements often looks awkward.
            if (f === 0) {
                scheduleAnim(targets,
                    { opacity: 0 },
                    { opacity: 1, duration: pNum(opts, 'duration', 0.4), ease: pStr(opts, 'ease', 'power1.out'), stagger: pNum(opts, 'stagger', 0), clearProps: 'opacity' },
                    opts.scrollTrigger, opts.direction, opts.delay);
                return;
            }
            scheduleAnim(targets,
                { clipPath: 'inset(0 100% 0 0)' },
                { clipPath: 'inset(0 0% 0 0)', duration: pNum(opts, 'duration', 0.8), ease: pStr(opts, 'ease', 'power3.out'), stagger: pNum(opts, 'stagger', 0), clearProps: 'clipPath' },
                opts.scrollTrigger, opts.direction, opts.delay);
        },
    };

    /* ── Text splitter (custom, no SplitText dependency) ───── */

    /**
     * Walk text nodes inside `el` and wrap each word in a span. Preserves
     * any inline tags (<em>, <strong>, <a>) by only touching text nodes.
     * Idempotent via `el.__twSplit` flag — re-running returns the same
     * spans without re-splitting.
     */
    function splitWords(el, overflow) {
        var key = overflow ? 'words-overflow' : 'words';
        if (el.__twSplit === key) {
            return el.querySelectorAll(overflow ? '.tw-word__inner' : '.tw-word');
        }
        if (!el.__twOriginalHTML) el.__twOriginalHTML = el.innerHTML;
        // Preserve readable text for screen readers — the spans are
        // visually splitting only.
        if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', (el.textContent || '').trim());

        var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
        var nodes = [], node;
        while ((node = walker.nextNode())) nodes.push(node);

        nodes.forEach(function (textNode) {
            var text = textNode.textContent;
            if (!text) return;
            var frag = document.createDocumentFragment();
            text.split(/(\s+)/).forEach(function (part) {
                if (!part) return;
                if (/^\s+$/.test(part)) {
                    frag.appendChild(document.createTextNode(part));
                    return;
                }
                if (overflow) {
                    var outer = document.createElement('span');
                    outer.className = 'tw-word';
                    outer.style.cssText = 'display:inline-block;overflow:hidden;vertical-align:baseline';
                    var inner = document.createElement('span');
                    inner.className = 'tw-word__inner';
                    inner.style.cssText = 'display:inline-block;will-change:transform';
                    inner.textContent = part;
                    outer.appendChild(inner);
                    frag.appendChild(outer);
                } else {
                    var span = document.createElement('span');
                    span.className = 'tw-word';
                    span.style.cssText = 'display:inline-block;will-change:transform,opacity,filter';
                    span.textContent = part;
                    frag.appendChild(span);
                }
            });
            textNode.parentNode.replaceChild(frag, textNode);
        });
        el.__twSplit = key;
        return el.querySelectorAll(overflow ? '.tw-word__inner' : '.tw-word');
    }

    function splitChars(el) {
        if (el.__twSplit === 'chars') return el.querySelectorAll('.tw-char');
        if (!el.__twOriginalHTML) el.__twOriginalHTML = el.innerHTML;
        if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', (el.textContent || '').trim());

        var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
        var nodes = [], node;
        while ((node = walker.nextNode())) nodes.push(node);

        nodes.forEach(function (textNode) {
            var text = textNode.textContent;
            if (!text) return;
            var frag = document.createDocumentFragment();
            for (var i = 0; i < text.length; i++) {
                var ch = text[i];
                if (ch === ' ' || ch === '\n' || ch === '\t') {
                    frag.appendChild(document.createTextNode(ch));
                    continue;
                }
                var span = document.createElement('span');
                span.className = 'tw-char';
                span.style.cssText = 'display:inline-block;will-change:transform,opacity';
                span.textContent = ch;
                frag.appendChild(span);
            }
            textNode.parentNode.replaceChild(frag, textNode);
        });
        el.__twSplit = 'chars';
        return el.querySelectorAll('.tw-char');
    }

    /**
     * Lines splitter — without measuring, we can only split on <br> tags.
     * For natural line-wrap detection we'd need the GSAP SplitText plugin
     * (paid). This works well for headlines authored with explicit \n
     * or <br> separators (Avero hero uses this pattern).
     */
    function splitLines(el) {
        if (el.__twSplit === 'lines') return el.querySelectorAll('.tw-line__inner');
        if (!el.__twOriginalHTML) el.__twOriginalHTML = el.innerHTML;
        var html = el.innerHTML;
        var lines = html.split(/<br\s*\/?>/i);
        if (lines.length < 2) return [el]; // single line — fall back to whole element
        if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', (el.textContent || '').trim());
        el.innerHTML = lines.map(function (line) {
            return '<span class="tw-line" style="display:block;overflow:hidden">' +
                   '<span class="tw-line__inner" style="display:inline-block;will-change:transform">' + line + '</span></span>';
        }).join('');
        el.__twSplit = 'lines';
        return el.querySelectorAll('.tw-line__inner');
    }

    /* ── Text-reveal presets (9, registered alongside element presets) */

    /* All text presets follow the same shape now:
     *   1. Split the headline into spans (words/chars/lines).
     *   2. gsap.set(spans, fromState) — hide them immediately.
     *   3. withScroll(opts, () => gsap.to(spans, toState)) — defer the
     *      reveal to the standalone ScrollTrigger's onEnter (or run now
     *      if no scrollTrigger is configured).
     *
     * The previous implementation used gsap.from(spans, { scrollTrigger })
     * which has the same crash surface as scheduleAnim's old `animation:
     * tween` link — ScrollTrigger.refresh tried to compute the linked
     * tween's end and threw on multi-target / filter / clipPath combos.
     */

    var TEXT_PRESETS = {

        // 1. Word fade-up — DEFAULT for editorial headlines.
        'word-fade-up': function (el, opts) {
            var words   = splitWords(el, false);
            var y       = pNum(opts, 'y', 16) * (opts.lvlFactor != null ? opts.lvlFactor : 1);
            var dur     = pNum(opts, 'duration', 0.6);
            var stag    = pNum(opts, 'stagger', 0.03);
            var ease    = pStr(opts, 'ease', 'power3.out');
            var sFrom   = pStr(opts, 'staggerFrom', 'start');
            withScroll(opts,
                function () { gsap().to(words, { opacity: 1, y: 0, duration: dur, ease: ease, stagger: { each: stag, from: sFrom }, overwrite: 'auto' }); },
                function () { gsap().to(words, { opacity: 0, y: y, duration: dur * 0.66, ease: 'power3.in', stagger: { each: stag * 0.66, from: 'end' }, overwrite: 'auto' }); },
                function () { gsap().set(words, { opacity: 0, y: y }); }
            );
        },

        // 2. Word fade-blur — premium / editorial.
        'word-fade-blur': function (el, opts) {
            var words = splitWords(el, false);
            var blur  = pNum(opts, 'blurFrom', 8);
            var dur   = pNum(opts, 'duration', 0.7);
            var stag  = pNum(opts, 'stagger', 0.04);
            var ease  = pStr(opts, 'ease', 'power2.out');
            var sFrom = pStr(opts, 'staggerFrom', 'start');
            withScroll(opts,
                function () { gsap().to(words, { opacity: 1, filter: 'blur(0px)', duration: dur, ease: ease, stagger: { each: stag, from: sFrom }, overwrite: 'auto' }); },
                function () { gsap().to(words, { opacity: 0, filter: 'blur(' + blur + 'px)', duration: dur * 0.65, ease: 'power2.in', stagger: { each: stag * 0.5, from: 'end' }, overwrite: 'auto' }); },
                function () { gsap().set(words, { opacity: 0, filter: 'blur(' + blur + 'px)' }); }
            );
        },

        // 3. Word slide-up (overflow) — cinematic Stripe-style.
        'word-slide-up-overflow': function (el, opts) {
            var inners = splitWords(el, true);
            var yp     = pNum(opts, 'yPercentFrom', 110);
            var dur    = pNum(opts, 'duration', 0.7);
            var stag   = pNum(opts, 'stagger', 0.04);
            var ease   = pStr(opts, 'ease', 'power4.out');
            withScroll(opts,
                function () { gsap().to(inners, { yPercent: 0, duration: dur, ease: ease, stagger: stag, overwrite: 'auto' }); },
                function () { gsap().to(inners, { yPercent: yp, duration: dur * 0.65, ease: 'power4.in', stagger: { each: stag * 0.6, from: 'end' }, overwrite: 'auto' }); },
                function () { gsap().set(inners, { yPercent: yp }); }
            );
        },

        // 4. Char up — short headlines only (auto-fallback if too long).
        'char-up': function (el, opts) {
            var text = (el.textContent || '').trim();
            if (text.length > 60) return TEXT_PRESETS['word-fade-up'](el, opts);
            var chars = splitChars(el);
            var y     = pNum(opts, 'y', 8) * (opts.lvlFactor != null ? opts.lvlFactor : 1);
            var dur   = pNum(opts, 'duration', 0.5);
            var stag  = pNum(opts, 'stagger', 0.018);
            var ease  = pStr(opts, 'ease', 'power3.out');
            withScroll(opts,
                function () { gsap().to(chars, { opacity: 1, y: 0, duration: dur, ease: ease, stagger: stag, overwrite: 'auto' }); },
                function () { gsap().to(chars, { opacity: 0, y: y, duration: dur * 0.7, ease: 'power3.in', stagger: { each: stag * 0.66, from: 'end' }, overwrite: 'auto' }); },
                function () { gsap().set(chars, { opacity: 0, y: y }); }
            );
        },

        // 5. Line fade-up stagger — multi-line headlines (split on <br>).
        'line-fade-up-stagger': function (el, opts) {
            var lines = splitLines(el);
            var y     = pNum(opts, 'y', 24) * (opts.lvlFactor != null ? opts.lvlFactor : 1);
            var dur   = pNum(opts, 'duration', 0.7);
            var stag  = pNum(opts, 'stagger', 0.1);
            var ease  = pStr(opts, 'ease', 'power3.out');
            withScroll(opts,
                function () { gsap().to(lines, { opacity: 1, y: 0, duration: dur, ease: ease, stagger: stag, overwrite: 'auto' }); },
                function () { gsap().to(lines, { opacity: 0, y: y, duration: dur * 0.7, ease: 'power3.in', stagger: { each: stag * 0.6, from: 'end' }, overwrite: 'auto' }); },
                function () { gsap().set(lines, { opacity: 0, y: y }); }
            );
        },

        // 6. Text typing — typewriter chars instant-reveal sequentially.
        'text-typing': function (el, opts) {
            var chars   = splitChars(el);
            // Honour totalDuration param: stagger = total / chars (capped 0.045/char).
            var total   = pNum(opts, 'totalDuration', 1.5);
            var stagger = chars.length > 0 ? Math.min(0.045, total / chars.length) : 0.045;
            withScroll(opts,
                function () { gsap().to(chars, { opacity: 1, duration: 0.001, stagger: stagger, ease: 'none', overwrite: 'auto' }); },
                function () { gsap().to(chars, { opacity: 0, duration: 0.001, stagger: { each: stagger, from: 'end' }, ease: 'none', overwrite: 'auto' }); },
                function () { gsap().set(chars, { opacity: 0 }); }
            );
        },

        // 7. Text fill sweep — wave from dim to full opacity, char-by-char.
        'text-fill-sweep': function (el, opts) {
            var dur     = pNum(opts, 'duration', 0.4);
            var stag    = pNum(opts, 'stagger', 0.05);
            var ease    = pStr(opts, 'ease', 'power2.out');
            var opaFrom = pNum(opts, 'opacityFrom', 0.22);
            var text = (el.textContent || '').trim();
            if (text.length > 80) {
                var words = splitWords(el, false);
                withScroll(opts,
                    function () { gsap().to(words, { opacity: 1, duration: dur, stagger: stag, ease: ease, overwrite: 'auto' }); },
                    function () { gsap().to(words, { opacity: opaFrom, duration: dur * 0.75, stagger: { each: stag * 0.6, from: 'end' }, ease: 'power2.in', overwrite: 'auto' }); },
                    function () { gsap().set(words, { opacity: opaFrom }); }
                );
                return;
            }
            var chars = splitChars(el);
            withScroll(opts,
                function () { gsap().to(chars, { opacity: 1, duration: dur * 0.75, stagger: stag * 0.44, ease: ease, overwrite: 'auto' }); },
                function () { gsap().to(chars, { opacity: opaFrom, duration: dur * 0.62, stagger: { each: stag * 0.3, from: 'end' }, ease: 'power2.in', overwrite: 'auto' }); },
                function () { gsap().set(chars, { opacity: opaFrom }); }
            );
        },

        // 8. Scroll-linked words fill — Apple/Stripe-Tax style.
        //    Uses scrub:true (scroll-driven progress, not onEnter), so
        //    we keep the inline scrollTrigger here — scrub requires the
        //    tween to be linked, and a single-element trigger animating
        //    .tw-word spans is the well-tested case (no filter/clipPath).
        'scroll-words-fill': function (el, opts) {
            var words = splitWords(el, false);
            gsap().set(words, { opacity: 0.18 });
            if (hasST()) {
                try {
                    gsap().to(words, {
                        opacity: 1, ease: 'none', stagger: 0.1,
                        scrollTrigger: { trigger: el, start: 'top 80%', end: 'top 30%', scrub: true },
                    });
                } catch (e) {
                    warn('scroll-words-fill: scrub setup failed — running fade fallback', e);
                    gsap().to(words, { opacity: 1, duration: 0.6, stagger: 0.05, ease: 'power2.out', clearProps: 'opacity' });
                }
            } else {
                gsap().to(words, { opacity: 1, duration: 0.6, stagger: 0.05, ease: 'power2.out', clearProps: 'opacity' });
            }
        },

        // 9. Editorial stack — composite, orchestrates the children
        //    (eyebrow / headline / lead / cta-row) of a scope. Headline
        //    auto-receives word-fade-up, others fade up sequentially.
        //    Built as a paused timeline + standalone ScrollTrigger.onEnter
        //    so the timeline isn't inspected during ScrollTrigger.refresh.
        'editorial-stack': function (rootEl, opts) {
            var g = gsap();
            var targets = rootEl.querySelectorAll('[data-tw-anim-target]');
            if (!targets.length) {
                // Graceful fallback — the widget didn't mark its children,
                // so just fade the whole widget root in.
                var y0 = 16 * (opts.lvlFactor || 1);
                withScroll(opts,
                    function () {
                        g.to(rootEl, {
                            opacity: 1, y: 0, duration: 0.7, ease: 'power3.out',
                            clearProps: 'opacity,transform', overwrite: 'auto',
                        });
                    },
                    function () {
                        g.to(rootEl, {
                            opacity: 0, y: y0, duration: 0.45, ease: 'power3.in',
                            overwrite: 'auto',
                        });
                    },
                    function () { g.set(rootEl, { opacity: 0, y: y0 }); }
                );
                return;
            }
            // Map targets to their (kind, words?) shape — split runs once
            // per refresh because splitWords is idempotent via __twSplit.
            var prepared = Array.prototype.slice.call(targets).map(function (t) {
                var tag = (t.tagName || '').toLowerCase();
                var isHeadline = tag === 'h1' || tag === 'h2' || tag === 'h3';
                if (isHeadline) {
                    return { kind: 'headline', el: t, words: splitWords(t, false) };
                }
                return { kind: 'el', el: t };
            });
            var lvlF = opts.lvlFactor || 1;
            withScroll(opts,
                function () {
                    var tl = g.timeline();
                    prepared.forEach(function (p, i) {
                        if (p.kind === 'headline') {
                            tl.to(p.words, {
                                opacity: 1, y: 0, duration: 0.65, ease: 'power3.out',
                                stagger: 0.03, clearProps: 'opacity,transform', overwrite: 'auto',
                            }, i === 0 ? 0 : 0.15);
                        } else {
                            tl.to(p.el, {
                                opacity: 1, y: 0, duration: 0.55, ease: 'power3.out',
                                clearProps: 'opacity,transform', overwrite: 'auto',
                            }, i === 0 ? 0 : '<0.08');
                        }
                    });
                },
                function () {
                    // Reverse choreography — fade back out top-to-bottom.
                    prepared.forEach(function (p) {
                        if (p.kind === 'headline') {
                            g.to(p.words, {
                                opacity: 0, y: 16 * lvlF, duration: 0.4,
                                ease: 'power3.in', stagger: { each: 0.02, from: 'end' },
                                overwrite: 'auto',
                            });
                        } else {
                            g.to(p.el, {
                                opacity: 0, y: 14 * lvlF, duration: 0.35,
                                ease: 'power3.in', overwrite: 'auto',
                            });
                        }
                    });
                },
                function () {
                    // setFromState — applied only when refresh detects we
                    // are BEFORE start (anti-flash on reload past hero).
                    prepared.forEach(function (p) {
                        if (p.kind === 'headline') {
                            g.set(p.words, { opacity: 0, y: 16 * lvlF });
                        } else {
                            g.set(p.el, { opacity: 0, y: 14 * lvlF });
                        }
                    });
                }
            );
        },

        /* ─────────────────────────────────────────────────────
         * world-expands — cinematic pin preset.
         *
         * Hero section starts as a rounded card (88vw × 80vh), grows
         * to fullscreen (100vw × 100vh) on scroll while the inner
         * <img> dezooms 1.15 → 1.0 for a "the world expands" feel.
         * Title + lead fade in + rise 40px during the climax. Section
         * pins one viewport so the user can read, then scroll continues.
         *
         * Universal markup support — applies to ANY clicked element:
         *
         *   • Authored BEM (Tempaloo widgets):
         *       section > .tw-anim-world-expands__inner
         *               > .tw-anim-world-expands__media
         *               + .tw-anim-world-expands__overlay
         *
         *   • Native Elementor section/container with a CHILD <img>
         *     (Image widget) — the runtime walks up from the <img> to
         *     the right inner wrapper and uses any sibling heading /
         *     paragraph as the overlay.
         *
         *   • Native Elementor section/container with a CSS
         *     `background-image: url(...)` and no <img> — the runtime
         *     injects an `<img>` covering the host with that URL,
         *     hides the original bg, and animates the injected image
         *     uniformly. Restored on revert.
         *
         *   • A bare container with NO image at all (just text /
         *     buttons / a CTA card) — the rootEl's own visual
         *     presentation (background-color / gradient / border /
         *     color) is transferred to a synthesized inner so the
         *     unfurl-to-fullscreen effect carries the section's look.
         *     The dezoom phase is skipped (no media to scale).
         *
         * Mobile bypass: gsap.matchMedia drops the entire effect below
         * `mobileBreakpoint` (default 800px) — image stays as a static
         * card and the text is always visible (accessibility +
         * performance: phones don't pay for the pin).
         *
         * How to use (e.g. an Avero "Built for life" section):
         *   1. Build the section however you want — a section with a
         *      bg image + h2 + p, OR a container holding an Image
         *      widget + Heading widget side by side.
         *   2. Floating panel → Animate Mode → click the OUTER section
         *      (or container). The selector override is saved.
         *   3. Pick preset = "World expands (cinematic pin)". The
         *      runtime auto-detects all parts. No markup change needed.
         *   4. Make sure the section's natural height is ≥ 250vh, OR
         *      that there's content below — ScrollTrigger needs scroll
         *      room to resolve the pin.
         */
        'world-expands': function (rootEl, opts) {
            var g = gsap();
            if (!g || !hasST()) return;

            // Universal markup resolver — handles authored BEM, native
            // <img>/<picture>/<video> children, and CSS background-image
            // sections. Returns synthesized wrappers + restore callback
            // when the user's markup doesn't match the BEM contract.
            var resolved = resolveWorldExpandsTargets(rootEl);
            if (!resolved) {
                warn('world-expands: rootEl has no children to animate —', rootEl);
                return;
            }
            var inner   = resolved.inner;
            var media   = resolved.media;
            var overlay = resolved.overlay;
            var restoreMarkup = resolved.restore;

            // Read params with sensible fallbacks.
            var cardW    = pNum(opts, 'cardWidthVw', 88);
            var cardH    = pNum(opts, 'cardHeightVh', 80);
            var radiusPx = pNum(opts, 'cardRadiusPx', 28);
            var scaleFr  = pNum(opts, 'mediaScaleFrom', 1.15);
            var textY    = pNum(opts, 'textY', 40);
            var pinVh    = pNum(opts, 'pinDurationVh', 250);
            var bp       = pNum(opts, 'mobileBreakpoint', 800);
            var grad     = pBool(opts, 'overlayGradient', true);

            // Smoothstep ease — `p*p*(3 - 2p)`. Standard cubic Hermite
            // interpolation, organic feel without overshoot. Forma uses
            // this exact curve; it sits between `power1.inOut` (too soft)
            // and `power2.inOut` (slightly too aggressive at the edges).
            var smoothstep = (typeof CustomEase !== 'undefined' && CustomEase && CustomEase.create)
                ? null  // CustomEase not registered in free GSAP — use the function form below.
                : null;
            var smoothstepFn = function (p) { return p * p * (3 - 2 * p); };

            // Section needs to clear room for the pin — set min-height
            // so layout reserves the pin's scroll length above the
            // fullscreen viewport. Without this, the pinned section
            // overlaps the next one.
            try {
                rootEl.style.position = rootEl.style.position || 'relative';
            } catch (e) {}

            // gsap.matchMedia — desktop runs the effect, mobile bypasses
            // and renders a static card. The mobile branch sets only
            // the visible static layout (no scrub, no pin).
            var mm = g.matchMedia();
            var queryDesktop = '(min-width: ' + (bp + 1) + 'px)';
            var queryMobile  = '(max-width: ' + bp + 'px)';

            mm.add({
                isDesktop: queryDesktop,
                isMobile:  queryMobile,
            }, function (ctx) {
                // ── DESKTOP — full cinematic effect ─────────────
                if (ctx.conditions.isDesktop) {
                    // Initial state — rounded card centered.
                    g.set(inner, {
                        width:        cardW + 'vw',
                        height:       cardH + 'vh',
                        borderRadius: radiusPx + 'px',
                        margin:       '0 auto',
                        overflow:     'hidden',
                        position:     'relative',
                        willChange:   'width, height, border-radius',
                    });
                    if (media) {
                        g.set(media, {
                            scale:      scaleFr,
                            width:      '100%',
                            height:     '100%',
                            objectFit:  'cover',
                            willChange: 'transform',
                        });
                    }
                    if (overlay) {
                        g.set(overlay, {
                            opacity:    0,
                            y:          textY,
                            position:   overlay.style.position || 'absolute',
                            // Optional dark gradient — keeps the title readable
                            // when the underlying image is busy. Matches Forma's
                            // default styling.
                            background: grad
                                ? 'linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.55))'
                                : overlay.style.background,
                        });
                    }

                    // Build the scrubbed timeline. Smoothstep ease — same
                    // curve Forma uses (`p*p*(3 - 2p)`), more organic than
                    // power2.inOut at start/end.
                    var tl = g.timeline({
                        scrollTrigger: {
                            trigger:        rootEl,
                            start:          'top top',
                            end:            '+=' + pinVh + '%',
                            scrub:          1,
                            pin:            true,
                            anticipatePin:  1,
                            invalidateOnRefresh: true,
                        },
                    });

                    // Phase 1 (0 → 0.7): card grows to fullscreen + image dezooms.
                    // Forma compresses the visual change into the first 70% of
                    // travel, then holds — `t.to(..., {... }, 0).to({}, { duration: 0.3 }, 0.7)`.
                    tl.to(inner, {
                        width:        '100vw',
                        height:       '100vh',
                        borderRadius: 0,
                        duration:     0.7,
                        ease:         smoothstepFn,
                    }, 0);
                    if (media) {
                        tl.to(media, {
                            scale:    1,
                            duration: 0.7,
                            ease:     smoothstepFn,
                        }, 0);
                    }

                    // Phase 2 (0.4 → 0.7): text fades in + rises during the climax.
                    if (overlay) {
                        tl.to(overlay, {
                            opacity:  1,
                            y:        0,
                            ease:     smoothstepFn,
                            duration: 0.3,
                        }, 0.4);
                    }

                    // Phase 3 (0.7 → 1.0): hold for reading. Empty tween
                    // to consume scroll without further visual change.
                    tl.to({}, { duration: 0.3 }, 0.7);

                    // Cleanup on revert (matchMedia handles tween cleanup
                    // for free; we additionally undo any DOM mutations
                    // injected by the resolver — synthesized inner wrap,
                    // bg-image-to-img injection, etc.).
                    return function () {
                        try {
                            g.set([inner, media, overlay].filter(Boolean), { clearProps: 'all' });
                        } catch (e) {}
                        try { restoreMarkup(); } catch (e) {}
                    };
                }

                // ── MOBILE — static card, text visible ─────────
                if (ctx.conditions.isMobile) {
                    g.set(inner, {
                        width:        '100%',
                        height:       'auto',
                        borderRadius: radiusPx + 'px',
                        overflow:     'hidden',
                        position:     'relative',
                    });
                    if (media) g.set(media, { scale: 1, width: '100%', height: 'auto' });
                    if (overlay) g.set(overlay, { opacity: 1, y: 0 });
                    return function () {
                        try {
                            g.set([inner, media, overlay].filter(Boolean), { clearProps: 'all' });
                        } catch (e) {}
                        try { restoreMarkup(); } catch (e) {}
                    };
                }
            });
        },
    };

    /* ── Behavioral animations (data-tw-anim attribute) ─────── */

    var BEHAVIORS = {
        'lift': function (el) {
            // Already covered by CSS :hover transform on most CTAs.
            // No-op here unless we want JS-driven for older browsers.
        },

        'magnetic': function (el) {
            // CTA that subtly follows the cursor within a 40px radius.
            if (el.__twAnimMagnetic) return;
            el.__twAnimMagnetic = true;
            var range = 40;
            el.addEventListener('mousemove', function (e) {
                var r = el.getBoundingClientRect();
                var dx = e.clientX - (r.left + r.width / 2);
                var dy = e.clientY - (r.top + r.height / 2);
                var clamp = function (v) { return Math.max(-range / 3, Math.min(range / 3, v / 4)); };
                if (gsap()) gsap().to(el, { x: clamp(dx), y: clamp(dy), duration: 0.3, ease: 'power2.out' });
            });
            el.addEventListener('mouseleave', function () {
                if (gsap()) gsap().to(el, { x: 0, y: 0, duration: 0.4, ease: 'elastic.out(1,0.5)' });
            });
        },

        'counter': function (el) {
            // Animated count-up triggered when the element enters the viewport.
            if (el.__twAnimCounter) return;
            el.__twAnimCounter = true;
            var end = parseFloat(el.getAttribute('data-tw-end') || el.textContent || '0');
            var duration = parseFloat(el.getAttribute('data-tw-duration') || '1.6');
            var prefix = el.getAttribute('data-tw-prefix') || '';
            var suffix = el.getAttribute('data-tw-suffix') || '';
            var decimals = parseInt(el.getAttribute('data-tw-decimals') || '0', 10);
            var obj = { v: 0 };
            el.textContent = prefix + '0' + suffix;
            var run = function () {
                if (!gsap()) { el.textContent = prefix + end + suffix; return; }
                gsap().to(obj, {
                    v: end,
                    duration: duration,
                    ease: 'power2.out',
                    onUpdate: function () { el.textContent = prefix + obj.v.toFixed(decimals) + suffix; },
                });
            };
            if (hasST()) {
                window.ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: run });
            } else {
                run();
            }
        },

        'marquee': function (el) {
            // Looping horizontal scroll for client logo strips.
            if (el.__twAnimMarquee || !gsap()) return;
            el.__twAnimMarquee = true;
            var inner = el.firstElementChild;
            if (!inner) return;
            // Duplicate content so the loop is seamless.
            inner.innerHTML += inner.innerHTML;
            var speed = parseFloat(el.getAttribute('data-tw-speed') || '40'); // px/sec
            var distance = inner.scrollWidth / 2;
            var duration = distance / speed;
            gsap().to(inner, { x: -distance, duration: duration, ease: 'none', repeat: -1 });
        },

        'parallax-mouse': function (el) {
            // Element shifts subtly with mouse position relative to viewport center.
            if (el.__twAnimMouse || !gsap()) return;
            el.__twAnimMouse = true;
            var depth = parseFloat(el.getAttribute('data-tw-depth') || '12'); // max px
            window.addEventListener('mousemove', function (e) {
                var dx = (e.clientX / window.innerWidth - 0.5) * depth;
                var dy = (e.clientY / window.innerHeight - 0.5) * depth;
                gsap().to(el, { x: dx, y: dy, duration: 0.6, ease: 'power2.out' });
            });
        },
    };

    /* ── Scope-driven entrance dispatcher ───────────────────── */

    function applyEntrance(rootEl) {
        if (!gsap()) {
            warn('applyEntrance skipped — gsap missing for', rootEl);
            return;
        }

        var lvl = level();
        if (lvl === 'off') { log('applyEntrance: intensity=off, skipping', rootEl); return; }

        var scope = rootEl.getAttribute('data-tw-anim-scope');
        if (!scope) return;

        // ── Idempotent reset via gsap.context().revert() ──────
        //
        // Elementor remounts widgets multiple times in editor mode
        // (every control edit, every save, every undo). Without this,
        // each applyEntrance() call would create a fresh gsap.set +
        // ScrollTrigger.create on TOP of the previous one without
        // killing the old triggers. Result: stacked ScrollTriggers
        // fire onEnter / onLeaveBack repeatedly for the same chars,
        // gsap.to calls race each other, and the user sees flicker
        // (flicker bug on scroll up/down reported by user).
        //
        // gsap.context.revert() kills every tween + ScrollTrigger
        // created inside the ctx AND reverts their inline styles, so
        // the next preset rebuilds from a clean slate.
        if (rootEl.__tw_anim_ctx) {
            try { rootEl.__tw_anim_ctx.revert(); } catch (e) { warn('anim ctx revert threw', e); }
            rootEl.__tw_anim_ctx = null;
        }

        // Resolve per-widget config from the inlined payload.
        var cfg = (window.tempaloo && window.tempaloo.studio && window.tempaloo.studio.anims) || {};
        var widgetCfg = cfg[scope] || {};

        // OPTION 1 (per-widget Inherit) — when no widget override is
        // configured for this scope, applyEntrance BAILS OUT so the
        // Element Rules engine can take over inside this scope. This
        // is what makes Avero's <h1> / <p> / <img> respect the picked
        // profile (Editorial / Cinematic / etc.) when the widget is
        // left on "Inherit" in the React admin Step 3.
        //
        // Backward-compat: if the widget has NO entry in the config map
        // at all (template never declared it), we still bail out — the
        // element rules will handle it. Only widgets explicitly
        // configured by template.json or the admin run applyEntrance.
        var preset = widgetCfg.entrance;
        if (!preset || preset === 'inherit') {
            log('applyEntrance: scope "' + scope + '" inherits → element rules will handle it');
            return;
        }

        var stMs       = parseInt(widgetCfg.stagger || 80, 10);
        var dur        = parseFloat(widgetCfg.duration || 0.7);
        var trig       = widgetCfg.trigger || 'top 85%';
        var lvlF       = intensityFactor(lvl);
        // Direction precedence: per-widget override → global default
        // ('bidirectional'). The user expects this to mirror entrance
        // animations on scroll-up by default — they can switch back
        // to 'once' / 'replay' / 'scrub' per widget from the React admin.
        var direction  = (widgetCfg.direction || defaultDirection()).toLowerCase();
        if (direction !== 'once' && direction !== 'replay' && direction !== 'bidirectional' && direction !== 'scrub') {
            direction = 'bidirectional';
        }

        // editAware: in the Elementor editor preview iframe, return null
        // for the scrollTrigger config so the runtime plays animations
        // immediately on mount instead of waiting for scroll.
        var stCfg = hasST() && trig !== 'none' ? { trigger: rootEl, start: trig } : null;
        if (ts.editAware) stCfg = ts.editAware(stCfg);

        // applyEntrance is fed by the legacy widget-scope path. Widget
        // overrides were removed when the admin UI was simplified to
        // "profile + click-to-animate", so v2Params is always empty and
        // delay defaults to 0. Element rules and selector overrides
        // carry their own delay through their respective resolvers.
        var v2Params = {};
        var delay    = 0;

        var opts = {
            stagger:       stMs / 1000,
            duration:      dur * (lvl === 'bold' ? 1.25 : 1),
            delay:         delay,
            lvlFactor:     lvlF,
            scrollTrigger: stCfg,
            direction:     direction,
            // Pass the FULL v2 params through so presets can read
            // ease, y/x, scaleFrom, blurFrom, useAutoAlpha, etc.
            // The legacy v1 stagger/duration above stay because
            // applyEntrance is fed by the v1 shim payload — v2Params
            // adds the rest.
            params:        v2Params,
        };

        log('applyEntrance', { scope: scope, preset: preset, lvl: lvl, opts: opts });

        // Wrap every preset execution in a gsap.context() scoped to
        // rootEl. EVERY tween, timeline, and ScrollTrigger created by
        // the preset is automatically tracked. Calling ctx.revert() on
        // the next applyEntrance kills the lot atomically — fixes the
        // "stacked triggers fire repeatedly" bug observed when Elementor
        // remounts the widget several times.
        rootEl.__tw_anim_ctx = gsap.context(function () {

            if (TEXT_PRESETS[preset]) {
                if (preset === 'editorial-stack') {
                    try { TEXT_PRESETS[preset](rootEl, opts); }
                    catch (e) { warn('preset "' + preset + '" threw on', rootEl, e); restoreVisibility(rootEl); }
                    return;
                }
                var textRoot = rootEl.querySelector('h1, h2, h3, h4')
                            || rootEl.querySelector('[data-tw-anim-target]')
                            || rootEl;
                log('  text-preset routed to', textRoot.tagName.toLowerCase(), 'in', scope);
                try { TEXT_PRESETS[preset](textRoot, opts); }
                catch (e) { warn('text preset "' + preset + '" threw on', textRoot, e); restoreVisibility(textRoot); }
                return;
            }

            // Per-target text-reveals — any `[data-tw-anim-text]` element
            // gets its own preset and is excluded from the main entrance.
            var textTargets = Array.prototype.slice.call(rootEl.querySelectorAll('[data-tw-anim-text]'));
            textTargets.forEach(function (t) {
                var name = t.getAttribute('data-tw-anim-text');
                var fn = TEXT_PRESETS[name];
                if (fn) {
                    try { fn(t, opts); }
                    catch (e) { warn('text preset "' + name + '" threw on', t, e); restoreVisibility(t); }
                }
            });

            // Element entrance for remaining targets.
            var allTargets = rootEl.querySelectorAll('[data-tw-anim-target]');
            var elemTargets = Array.prototype.slice.call(allTargets)
                .filter(function (t) { return !t.hasAttribute('data-tw-anim-text'); });

            if (!elemTargets.length && textTargets.length === 0) {
                elemTargets = [rootEl];
            }
            if (!elemTargets.length) return;

            elemTargets.sort(function (a, b) {
                return parseFloat(a.getAttribute('data-tw-anim-order') || '0')
                     - parseFloat(b.getAttribute('data-tw-anim-order') || '0');
            });

            var fn = PRESETS[preset];
            if (!fn) {
                warn('applyEntrance: unknown preset "' + preset + '" for scope "' + scope + '"');
                return;
            }
            try {
                fn(elemTargets, opts);
                log('applied "' + preset + '" to', elemTargets.length, 'targets in scope', scope);
            } catch (e) {
                warn('preset "' + preset + '" threw on', elemTargets, e);
                elemTargets.forEach(restoreVisibility);
            }

        }, rootEl);
    }

    /**
     * Force-restore an element's natural state by clearing every inline
     * style GSAP touches during entrance animations. Used by both the
     * per-preset catch handlers and the safety net.
     */
    function restoreVisibility(el) {
        if (!el || !el.style) return;
        if (window.gsap && typeof window.gsap.killTweensOf === 'function') {
            try { window.gsap.killTweensOf(el); } catch (e) {}
        }
        el.style.opacity   = '';
        el.style.transform = '';
        el.style.filter    = '';
        el.style.clipPath  = '';
        // Also descendants — split-spans share the same problem when a
        // composite preset's timeline fails mid-creation.
        el.querySelectorAll && el.querySelectorAll('.tw-word, .tw-word__inner, .tw-char, .tw-line__inner').forEach(function (c) {
            if (window.gsap) try { window.gsap.killTweensOf(c); } catch (e) {}
            c.style.opacity = '';
            c.style.transform = '';
            c.style.filter = '';
        });
    }

    /* Standalone text-reveal — `data-tw-anim-text` outside any scope.
     * Useful for marking individual headlines anywhere (above-fold copy
     * blocks, page intros) without needing to wrap them in a scoped widget. */
    function applyStandaloneTextReveal(el) {
        if (!gsap()) return;
        var lvl = level();
        if (lvl === 'off') return;
        var name = el.getAttribute('data-tw-anim-text');
        var fn = TEXT_PRESETS[name];
        if (!fn) return;
        var opts = {
            lvlFactor: intensityFactor(lvl),
            scrollTrigger: hasST() ? { trigger: el, start: 'top 85%', once: true } : null,
        };
        try { fn(el, opts); } catch (e) {}
    }

    function applyBehaviors(rootEl) {
        var els = rootEl.querySelectorAll('[data-tw-anim]');
        els.forEach(function (el) {
            var name = el.getAttribute('data-tw-anim');
            if (!name) return;
            var fn = BEHAVIORS[name];
            if (fn) fn(el);
        });
    }

    /* ── v2 Element Rules engine (Plan A) ─────────────────────
     *
     * Reads window.tempaloo.studio.animV2.elementRules and applies a
     * preset to every element matching that type's selector list (h1,
     * h2, p, img, button, container, link). Excludes elements already
     * handled by a [data-tw-anim-scope] widget — those run via
     * applyEntrance with their own widget override. This is what makes
     * Elementor NATIVE widgets (heading, image, button) animate
     * automatically without any data-attr in their markup.
     *
     * Wraps the pass in gsap.matchMedia() per the gsap-core skill —
     * `prefers-reduced-motion: reduce` automatically downgrades the
     * preset to 'fade' (or skips per the user's reduceMotion strategy)
     * AND auto-reverts every animation it created when the media query
     * stops matching (e.g. user toggles reduce-motion in OS settings).
     */
    function applyElementRules() {
        var g = gsap();
        if (!g) return;
        var v2 = (window.tempaloo && window.tempaloo.studio && window.tempaloo.studio.animV2) || null;
        if (!v2 || !v2.elementRules) return;

        var rmStrategy = (v2.globals && v2.globals.reduceMotion) || 'subtle';

        var mm;
        try { mm = g.matchMedia(); } catch (e) { warn('matchMedia unavailable, falling back', e); mm = null; }

        var run = function (reduce) {
            // Per-element-type pass
            Object.keys(v2.elementRules).forEach(function (typeId) {
                var rule = v2.elementRules[typeId];
                if (!rule || rule.enabled === false) return;
                if (!rule.preset || rule.preset === 'none') return;

                // Reduce-motion handling per skill: replace by 'fade' or
                // skip entirely.
                var preset = rule.preset;
                if (reduce) {
                    if (rmStrategy === 'off') return;
                    if (rmStrategy === 'subtle') preset = 'fade';
                }

                var typeMeta  = (v2.elementTypes || {})[typeId];
                var selectors = (typeMeta && typeMeta.selectors) || [];
                if (!selectors.length) return;

                var sel = selectors.join(',');
                var nodes = [];
                try { nodes = Array.prototype.slice.call(document.querySelectorAll(sel)); }
                catch (e) { warn('Invalid selector for type ' + typeId, e); return; }

                // Exclusions:
                //  • elements explicitly opted out via data-tw-anim-skip
                //  • elements inside a [data-tw-anim-scope] WHEN that
                //    scope has an active widget override. When the scope
                //    has no override (or "inherit"), we descend INTO it
                //    and let element rules apply — this is OPTION 1 of
                //    the Avero ↔ admin bridge: per-widget "Inherit"
                //    cascades the picked profile down to <h1>/<p>/<img>
                //    inside Avero hero/services/faq/etc.
                var anims = (window.tempaloo && window.tempaloo.studio && window.tempaloo.studio.anims) || {};
                var blockedByScope = {};
                nodes = nodes.filter(function (el) {
                    if (el.hasAttribute && el.hasAttribute('data-tw-anim-skip')) return false;
                    var scope = el.closest && el.closest('[data-tw-anim-scope]');
                    if (!scope) return true;
                    var scopeName = scope.getAttribute('data-tw-anim-scope');
                    var override  = scopeName ? anims[scopeName] : null;
                    // Active override = entrance preset that's neither
                    // empty nor "inherit". Composite presets (editorial-
                    // stack) handle their own descendants → also exclude.
                    if (override && override.entrance && override.entrance !== 'inherit') {
                        blockedByScope[scopeName] = (blockedByScope[scopeName] || 0) + 1;
                        return false;
                    }
                    return true;
                });
                // Surface the blocked count so the user can debug "why
                // doesn't my element rule reach Avero?". Tip in console:
                // set the listed widget(s) to "Inherit" in the React
                // admin → Step 3 → Per widget to let the rule cascade in.
                if (Object.keys(blockedByScope).length) {
                    log('Element rule "' + typeId + '" blocked inside:', blockedByScope,
                        '— set these widgets to "Inherit" in admin to let the rule apply.');
                }
                if (!nodes.length) return;

                // Build opts from the rule's params and scrollTrigger.
                var params = rule.params || {};
                var st     = rule.scrollTrigger || {};
                var direction = (rule.direction || defaultDirection()).toLowerCase();
                if (direction !== 'once' && direction !== 'replay' &&
                    direction !== 'bidirectional' && direction !== 'scrub') {
                    direction = 'bidirectional';
                }
                var stCfg = (hasST() && st.start && st.start !== 'none')
                                ? { trigger: null, start: st.start }
                                : null;

                // Each element gets its own ScrollTrigger (trigger = the
                // element itself) so animations fire when each element
                // enters the viewport, not when the first one does.
                nodes.forEach(function (el) {
                    var opts = {
                        delay:         (typeof params.delay   === 'number' ? params.delay   : 0),
                        stagger:       (typeof params.stagger === 'number' ? params.stagger : 0),
                        duration:      (typeof params.duration === 'number' ? params.duration : 0.7),
                        lvlFactor:     intensityFactor(level()),
                        scrollTrigger: stCfg ? { trigger: el, start: stCfg.start } : null,
                        direction:     direction,
                        // Pass typed v2 params through so future presets
                        // can read e.g. ease, blurFrom, scaleFrom, y, x.
                        params:        params,
                    };
                    if (ts.editAware) opts.scrollTrigger = ts.editAware(opts.scrollTrigger);

                    var fn = TEXT_PRESETS[preset] || PRESETS[preset];
                    if (!fn) { warn('Element rule: unknown preset', preset, 'for type', typeId); return; }

                    // Idempotent reset for re-applies (matchMedia toggles).
                    if (el.__tw_anim_ctx) {
                        try { el.__tw_anim_ctx.revert(); } catch (e) {}
                        el.__tw_anim_ctx = null;
                    }
                    el.__tw_anim_ctx = g.context(function () {
                        try { fn(el, opts); }
                        catch (e) { warn('Element-rule preset "' + preset + '" threw on', el, e); restoreVisibility(el); }
                    }, el);
                });
                log('Element rule "' + typeId + '" → "' + preset + '" applied to', nodes.length, 'nodes');
            });
        };

        if (mm && typeof mm.add === 'function') {
            mm.add({
                isMotion:      '(prefers-reduced-motion: no-preference)',
                reduceMotion:  '(prefers-reduced-motion: reduce)',
            }, function (ctx) {
                run(!!ctx.conditions.reduceMotion);
                // matchMedia auto-reverts when conditions change — no
                // explicit cleanup needed (per gsap-core skill).
            });
        } else {
            run(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        }
    }

    /* ── Niveau 4 — Selector overrides (Animate Mode) ────────
     *
     * Reads window.tempaloo.studio.animV2.selectorOverrides — a flat map
     * { "<css selector>": { rule, label, savedAt } } — and applies the
     * rule to every matching element. Wins over Element Rules because
     * we run AFTER applyElementRules; the per-element gsap.context() is
     * reverted before re-applying so the new rule starts from a clean
     * slate (no double-trigger / no leftover inline styles).
     *
     * Used by: Animate Mode in the floating panel — when the user
     * picks a preset for an inspected element, we POST a selector
     * override and call this function to refresh the live page.
     */
    function applySelectorOverrides() {
        var g = gsap();
        if (!g) return;
        var v2 = (window.tempaloo && window.tempaloo.studio && window.tempaloo.studio.animV2) || null;
        if (!v2 || !v2.selectorOverrides) return;
        var map = v2.selectorOverrides;
        if (typeof map !== 'object') return;

        Object.keys(map).forEach(function (sel) {
            var entry = map[sel];
            if (!entry || !entry.rule || !entry.rule.preset) return;
            var nodes;
            try { nodes = document.querySelectorAll(sel); }
            catch (e) { warn('selectorOverride: invalid selector', sel, e); return; }
            if (!nodes.length) return;
            Array.prototype.forEach.call(nodes, function (el) {
                applyRuleToElement(el, entry.rule);
            });
            log('Selector override "' + sel + '" → "' + entry.rule.preset + '" applied to', nodes.length, 'nodes');
        });
    }

    /**
     * Apply a v2 rule object to a single element, ON DEMAND. Public
     * helper so the floating panel popover can preview a rule live
     * without a page reload. Reverts any prior gsap.context() on the
     * element first to guarantee a clean re-render.
     */
    function applyRuleToElement(el, rule) {
        if (!el || !rule || !rule.preset) return;
        var g = gsap();
        if (!g) return;
        if (el.__tw_anim_ctx) {
            try { el.__tw_anim_ctx.revert(); } catch (e) {}
            el.__tw_anim_ctx = null;
        }
        var preset = rule.preset;
        var fn = TEXT_PRESETS[preset] || PRESETS[preset];
        if (!fn) { warn('applyRuleToElement: unknown preset', preset); return; }

        var params = rule.params || {};
        var st     = rule.scrollTrigger || {};
        var direction = (rule.direction || defaultDirection()).toLowerCase();
        if (direction !== 'once' && direction !== 'replay' &&
            direction !== 'bidirectional' && direction !== 'scrub') {
            direction = 'bidirectional';
        }
        var stCfg = (hasST() && st.start && st.start !== 'none')
                        ? { trigger: el, start: st.start }
                        : null;
        if (ts.editAware) stCfg = ts.editAware(stCfg);

        var opts = {
            delay:         (typeof params.delay   === 'number' ? params.delay   : 0),
            stagger:       (typeof params.stagger === 'number' ? params.stagger : 0),
            duration:      (typeof params.duration === 'number' ? params.duration : 0.7),
            lvlFactor:     intensityFactor(level()),
            scrollTrigger: stCfg,
            direction:     direction,
            params:        params,
        };
        el.__tw_anim_ctx = g.context(function () {
            try { fn(el, opts); }
            catch (e) { warn('applyRuleToElement preset "' + preset + '" threw on', el, e); restoreVisibility(el); }
        }, el);
    }

    /* ── Boot — runs for every scoped widget on the page ────── */

    ts.onReady('[data-tw-anim-scope]', function (rootEl) {
        applyEntrance(rootEl);
        applyBehaviors(rootEl);
    });

    // v2 Element Rules — runs ONCE per page load, after scopes have
    // been processed (next tick), so the in-scope exclusion check
    // works against fully-mounted scope nodes. Selector overrides run
    // last so they win over Element Rules.
    //
    // Anti-FOUC: window.__tw_unhide() is set by the head snippet that
    // hides body until our runtime runs. Call it AFTER the first apply
    // pass so the user sees the page with fromStates already applied —
    // no flash of un-animated content.
    function bootApplyAndUnhide() {
        try { applyElementRules();      } catch (e) { warn('applyElementRules failed', e); }
        try { applySelectorOverrides(); } catch (e) { warn('applySelectorOverrides failed', e); }
        // Unhide on next animation frame so the browser paints the
        // fromState before becoming visible — kills the flash.
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                if (typeof window.__tw_unhide === 'function') {
                    try { window.__tw_unhide(); log('FOUC unhide triggered'); } catch (e) {}
                }
            });
        });
    }
    if (document.readyState === 'complete') {
        setTimeout(bootApplyAndUnhide, 0);
    } else {
        window.addEventListener('load', function () { setTimeout(bootApplyAndUnhide, 0); });
    }

    // Behaviors can also live on top-level elements outside any scope.
    ts.onReady('[data-tw-anim]:not([data-tw-anim-scope])', function (el) {
        var name = el.getAttribute('data-tw-anim');
        var fn = BEHAVIORS[name];
        if (fn) fn(el);
    });

    // Standalone text-reveals — `data-tw-anim-text` outside any scope.
    ts.onReady('[data-tw-anim-text]:not([data-tw-anim-target])', applyStandaloneTextReveal);

    /* ── Public API for power users ─────────────────────────── */

    ts.animations = {
        presets:                 PRESETS,
        textPresets:             TEXT_PRESETS,
        behaviors:               BEHAVIORS,
        register:                function (name, fn) { PRESETS[name] = fn; },
        registerText:            function (name, fn) { TEXT_PRESETS[name] = fn; },
        registerBehavior:        function (name, fn) { BEHAVIORS[name] = fn; },
        apply:                   applyEntrance,
        applyText:               applyStandaloneTextReveal,
        applyElementRules:       applyElementRules,
        applySelectorOverrides:  applySelectorOverrides,
        applyRuleToElement:      applyRuleToElement,   // public — used by Animate Mode popover
        level:                   level,
        splitWords:              splitWords,
        splitChars:              splitChars,
        splitLines:              splitLines,
    };
})();
