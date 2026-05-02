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
            var qs = location.search.match(/[?&]tw_debug=([^&]*)/);
            if (qs) {
                var v = qs[1];
                if (v === '1' || v === 'true') { localStorage.setItem('tw_debug', '1'); return true; }
                if (v === '0' || v === 'false') { localStorage.removeItem('tw_debug'); return false; }
            }
            return localStorage.getItem('tw_debug') === '1';
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

    /* ── Refresh ScrollTrigger once layout is final ─────────
     *
     * Fonts loading after first paint shifts widget positions, which
     * means start/end offsets ScrollTrigger computed on init are off.
     * Refresh on window.load (everything done) and document.fonts.ready
     * (web fonts swapped in) so triggers fire at the right scroll point.
     */
    function refreshScrollTrigger(why) {
        if (window.ScrollTrigger && typeof window.ScrollTrigger.refresh === 'function') {
            try { window.ScrollTrigger.refresh(); log('ScrollTrigger.refresh()', why || ''); }
            catch (e) { warn('ScrollTrigger.refresh threw:', e); }
        }
    }
    // Refresh AT MULTIPLE points so scroll positions stay accurate
    // through the whole page-loading lifecycle.
    if (document.readyState === 'complete') {
        setTimeout(function () { refreshScrollTrigger('initial-already-complete'); }, 50);
    } else {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { refreshScrollTrigger('DOMContentLoaded'); }, 0); });
        window.addEventListener('load',                function () { setTimeout(function () { refreshScrollTrigger('window-load'); }, 50); });
    }
    if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
        document.fonts.ready.then(function () { refreshScrollTrigger('fonts-ready'); });
    }
    // Also on window resize (debounced) — ScrollTrigger handles this
    // natively but we add an extra trigger for restored scroll positions.
    var resizeTimer;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () { refreshScrollTrigger('resize'); }, 200);
    });

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

    /* ── scheduleAnim — standalone-ScrollTrigger pattern (GSAP official) ─
     *
     * Earlier attempts linked a paused tween via `animation: tween` on
     * `ScrollTrigger.create`. GSAP/ScrollTrigger then tried to compute
     * the tween's "end" during refresh and crashed for multi-target
     * tweens animating `filter`/`clipPath` (services widget @ blur-in
     * bold reproducibly hit `Cannot read properties of undefined
     * (reading 'end')` inside Te.refresh).
     *
     * Per the gsap-scrolltrigger skill: use a **standalone ScrollTrigger**
     * (no `animation:` link) and run the actual tween from the `onEnter`
     * callback. ScrollTrigger never inspects the tween's internals, so
     * the refresh path can't crash on it.
     *
     * Lifecycle:
     *   1. gsap.set(targets, fromState) — apply start values immediately
     *      so the element is hidden before any scroll happens.
     *   2. ScrollTrigger.create({ trigger, start, once, onEnter }) — when
     *      the trigger enters viewport, fire gsap.to(targets, toState).
     *   3. No scrollTrigger or no ScrollTrigger plugin → run immediately.
     *   4. ScrollTrigger.create throws → fall back to immediate play.
     */
    function scheduleAnim(targets, fromState, toState, scrollTriggerCfg) {
        var g = gsap();
        if (!g) return null;

        // Always set the start state explicitly so if anything later fails,
        // the element is at a known starting point — never half-styled.
        try { g.set(targets, fromState); } catch (e) { warn('gsap.set failed', e); }

        var run = function () {
            try {
                return g.to(targets, Object.assign({ overwrite: 'auto' }, toState));
            } catch (e) {
                warn('gsap.to failed — restoring visibility', e);
                Array.prototype.forEach.call(targets, restoreVisibility);
                return null;
            }
        };

        if (!scrollTriggerCfg || !window.ScrollTrigger) return run();

        try {
            window.ScrollTrigger.create({
                trigger: scrollTriggerCfg.trigger,
                start:   scrollTriggerCfg.start || 'top 85%',
                end:     scrollTriggerCfg.end,
                once:    scrollTriggerCfg.once !== false,
                onEnter: run,
            });
            return null;
        } catch (e) {
            warn('ScrollTrigger.create failed — running tween immediately', e);
            return run();
        }
    }

    /* ── withScroll — same standalone-ScrollTrigger pattern for tweens
     *    built ad-hoc (text presets, behavioral animations).
     *
     * Lets a preset write `gsap.set(splits, from); withScroll(opts, fn);`
     * instead of inlining `scrollTrigger:` in the tween config (which
     * has the same crash surface as scheduleAnim's old path).
     */
    function withScroll(opts, runFn) {
        if (!opts || !opts.scrollTrigger || !window.ScrollTrigger) { runFn(); return; }
        try {
            window.ScrollTrigger.create({
                trigger: opts.scrollTrigger.trigger,
                start:   opts.scrollTrigger.start || 'top 85%',
                end:     opts.scrollTrigger.end,
                once:    opts.scrollTrigger.once !== false,
                onEnter: runFn,
            });
        } catch (e) {
            warn('withScroll: ScrollTrigger.create failed — running immediately', e);
            runFn();
        }
    }

    /* ── Entrance presets ────────────────────────────────────── */

    /**
     * Each preset receives:
     *   targets — Array<HTMLElement>  (the elements to animate)
     *   opts    — { stagger, duration, scrollTrigger?, lvlFactor }
     */
    var PRESETS = {
        'none': function () { /* no-op */ },

        'fade': function (targets, opts) {
            scheduleAnim(targets,
                { opacity: 0 },
                { opacity: 1, duration: opts.duration || 0.45, ease: 'power1.out', stagger: opts.stagger || 0, clearProps: 'opacity' },
                opts.scrollTrigger);
        },

        'fade-up': function (targets, opts) {
            var y = 24 * (opts.lvlFactor || 1);
            scheduleAnim(targets,
                { opacity: 0, y: y },
                { opacity: 1, y: 0, duration: opts.duration || 0.7, ease: 'power3.out', stagger: opts.stagger || 0, clearProps: 'opacity,transform' },
                opts.scrollTrigger);
        },

        'fade-down': function (targets, opts) {
            var y = -24 * (opts.lvlFactor || 1);
            scheduleAnim(targets,
                { opacity: 0, y: y },
                { opacity: 1, y: 0, duration: opts.duration || 0.7, ease: 'power3.out', stagger: opts.stagger || 0, clearProps: 'opacity,transform' },
                opts.scrollTrigger);
        },

        'fade-left': function (targets, opts) {
            var x = -32 * (opts.lvlFactor || 1);
            scheduleAnim(targets,
                { opacity: 0, x: x },
                { opacity: 1, x: 0, duration: opts.duration || 0.7, ease: 'power3.out', stagger: opts.stagger || 0, clearProps: 'opacity,transform' },
                opts.scrollTrigger);
        },

        'fade-right': function (targets, opts) {
            var x = 32 * (opts.lvlFactor || 1);
            scheduleAnim(targets,
                { opacity: 0, x: x },
                { opacity: 1, x: 0, duration: opts.duration || 0.7, ease: 'power3.out', stagger: opts.stagger || 0, clearProps: 'opacity,transform' },
                opts.scrollTrigger);
        },

        'scale-in': function (targets, opts) {
            var f = opts.lvlFactor != null ? opts.lvlFactor : 1;
            scheduleAnim(targets,
                { opacity: 0, scale: 1 - 0.08 * f },
                { opacity: 1, scale: 1, duration: opts.duration || 0.7, ease: 'back.out(1.4)', stagger: opts.stagger || 0, clearProps: 'opacity,transform' },
                opts.scrollTrigger);
        },

        'blur-in': function (targets, opts) {
            var f = opts.lvlFactor != null ? opts.lvlFactor : 1;
            scheduleAnim(targets,
                { opacity: 0, filter: 'blur(' + (20 * f) + 'px)', willChange: 'opacity, filter' },
                { opacity: 1, filter: 'blur(0px)', duration: opts.duration || 0.85, ease: 'power3.out', stagger: opts.stagger || 0, clearProps: 'opacity,filter,willChange' },
                opts.scrollTrigger);
        },

        'mask-reveal': function (targets, opts) {
            var f = opts.lvlFactor != null ? opts.lvlFactor : 1;
            if (f === 0) {
                scheduleAnim(targets,
                    { opacity: 0 },
                    { opacity: 1, duration: opts.duration || 0.4, ease: 'power1.out', stagger: opts.stagger || 0, clearProps: 'opacity' },
                    opts.scrollTrigger);
                return;
            }
            scheduleAnim(targets,
                { clipPath: 'inset(0 100% 0 0)' },
                { clipPath: 'inset(0 0% 0 0)', duration: opts.duration || 0.8, ease: 'power3.out', stagger: opts.stagger || 0, clearProps: 'clipPath' },
                opts.scrollTrigger);
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
            var words = splitWords(el, false);
            var y = 16 * (opts.lvlFactor || 1);
            gsap().set(words, { opacity: 0, y: y });
            withScroll(opts, function () {
                gsap().to(words, {
                    opacity: 1, y: 0, duration: 0.6, ease: 'power3.out',
                    stagger: 0.03, clearProps: 'opacity,transform', overwrite: 'auto',
                });
            });
        },

        // 2. Word fade-blur — premium / editorial.
        'word-fade-blur': function (el, opts) {
            var words = splitWords(el, false);
            gsap().set(words, { opacity: 0, filter: 'blur(8px)' });
            withScroll(opts, function () {
                gsap().to(words, {
                    opacity: 1, filter: 'blur(0px)',
                    duration: 0.7, ease: 'power2.out',
                    stagger: 0.04, clearProps: 'opacity,filter', overwrite: 'auto',
                });
            });
        },

        // 3. Word slide-up (overflow) — cinematic Stripe-style.
        'word-slide-up-overflow': function (el, opts) {
            var inners = splitWords(el, true);
            gsap().set(inners, { yPercent: 110 });
            withScroll(opts, function () {
                gsap().to(inners, {
                    yPercent: 0, duration: 0.7, ease: 'power4.out',
                    stagger: 0.04, clearProps: 'transform', overwrite: 'auto',
                });
            });
        },

        // 4. Char up — short headlines only (auto-fallback if too long).
        'char-up': function (el, opts) {
            var text = (el.textContent || '').trim();
            if (text.length > 60) return TEXT_PRESETS['word-fade-up'](el, opts);
            var chars = splitChars(el);
            var y = 8 * (opts.lvlFactor || 1);
            gsap().set(chars, { opacity: 0, y: y });
            withScroll(opts, function () {
                gsap().to(chars, {
                    opacity: 1, y: 0, duration: 0.5, ease: 'power3.out',
                    stagger: 0.018, clearProps: 'opacity,transform', overwrite: 'auto',
                });
            });
        },

        // 5. Line fade-up stagger — multi-line headlines (split on <br>).
        'line-fade-up-stagger': function (el, opts) {
            var lines = splitLines(el);
            var y = 24 * (opts.lvlFactor || 1);
            gsap().set(lines, { opacity: 0, y: y });
            withScroll(opts, function () {
                gsap().to(lines, {
                    opacity: 1, y: 0, duration: 0.7, ease: 'power3.out',
                    stagger: 0.1, clearProps: 'opacity,transform', overwrite: 'auto',
                });
            });
        },

        // 6. Text typing — typewriter chars instant-reveal sequentially.
        //    Stagger cap: keep total animation duration under 1.5s even
        //    on long sentences (200-char text would otherwise type for
        //    9 seconds — too slow for a hero headline).
        'text-typing': function (el, opts) {
            var chars = splitChars(el);
            var stagger = Math.min(0.045, chars.length > 0 ? 1.5 / chars.length : 0.045);
            gsap().set(chars, { opacity: 0 });
            withScroll(opts, function () {
                gsap().to(chars, {
                    opacity: 1, duration: 0.001, stagger: stagger, ease: 'none', overwrite: 'auto',
                });
            });
        },

        // 7. Text fill sweep — wave from dim to full opacity, char-by-char.
        //    Falls back to word-stagger if the text is too long to char-split
        //    cleanly. Reliable across all browsers (no background-clip:text
        //    or color-mix() — those have spotty Safari support).
        'text-fill-sweep': function (el, opts) {
            var text = (el.textContent || '').trim();
            if (text.length > 80) {
                var words = splitWords(el, false);
                gsap().set(words, { opacity: 0.22 });
                withScroll(opts, function () {
                    gsap().to(words, {
                        opacity: 1, duration: 0.4, stagger: 0.05,
                        ease: 'power2.out', clearProps: 'opacity', overwrite: 'auto',
                    });
                });
                return;
            }
            var chars = splitChars(el);
            gsap().set(chars, { opacity: 0.22 });
            withScroll(opts, function () {
                gsap().to(chars, {
                    opacity: 1, duration: 0.3, stagger: 0.022,
                    ease: 'power2.out', clearProps: 'opacity', overwrite: 'auto',
                });
            });
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
                g.set(rootEl, { opacity: 0, y: y0 });
                withScroll(opts, function () {
                    g.to(rootEl, {
                        opacity: 1, y: 0, duration: 0.7, ease: 'power3.out',
                        clearProps: 'opacity,transform', overwrite: 'auto',
                    });
                });
                return;
            }
            // Pre-set all targets to their fromState, then assemble a
            // paused timeline that runs onEnter.
            var prepared = Array.prototype.slice.call(targets).map(function (t) {
                var tag = (t.tagName || '').toLowerCase();
                var isHeadline = tag === 'h1' || tag === 'h2' || tag === 'h3';
                if (isHeadline) {
                    var words = splitWords(t, false);
                    g.set(words, { opacity: 0, y: 16 * (opts.lvlFactor || 1) });
                    return { kind: 'headline', el: t, words: words };
                }
                g.set(t, { opacity: 0, y: 14 * (opts.lvlFactor || 1) });
                return { kind: 'el', el: t };
            });
            withScroll(opts, function () {
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

        // Resolve per-widget config from the inlined payload.
        var cfg = (window.tempaloo && window.tempaloo.studio && window.tempaloo.studio.anims) || {};
        var widgetCfg = cfg[scope] || {};

        // Per-widget preset is ALWAYS respected — intensity only modulates
        // transform size via lvlFactor (subtle = 0, medium = 1, bold = 1.4).
        // At subtle the y/x translates collapse to 0 → effectively opacity-
        // only, but the preset's character (scale, blur, mask) is preserved.
        // Off bails out entirely above.
        var preset = widgetCfg.entrance || 'fade-up';

        var stMs   = parseInt(widgetCfg.stagger || 80, 10);
        var dur    = parseFloat(widgetCfg.duration || 0.7);
        var trig   = widgetCfg.trigger || 'top 85%';
        var lvlF   = intensityFactor(lvl);

        var opts = {
            stagger: stMs / 1000,
            duration: dur * (lvl === 'bold' ? 1.25 : 1),
            lvlFactor: lvlF,
            scrollTrigger: hasST() && trig !== 'none' ? { trigger: rootEl, start: trig, once: true } : null,
        };

        log('applyEntrance', { scope: scope, preset: preset, lvl: lvl, opts: opts });

        // Text presets selected as the scope-level entrance need routing.
        // Three cases:
        //   1. 'editorial-stack' — composite — orchestrates rootEl's children
        //   2. Word/char/line splitters (word-fade-up, char-up, text-typing,
        //      text-fill-sweep, scroll-words-fill, etc.) — apply to the
        //      element that holds the actual text. Heuristic: first
        //      headline (h1/h2/h3) → first [data-tw-anim-target] →
        //      rootEl. This avoids splitting every char in a multi-quote
        //      testimonials section (would create hundreds of spans).
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
        // Choice is respected at every intensity (lvlFactor handles size).
        var textTargets = Array.prototype.slice.call(rootEl.querySelectorAll('[data-tw-anim-text]'));
        textTargets.forEach(function (t) {
            var name = t.getAttribute('data-tw-anim-text');
            var fn = TEXT_PRESETS[name];
            if (fn) {
                try { fn(t, opts); }
                catch (e) { warn('text preset "' + name + '" threw on', t, e); restoreVisibility(t); }
            }
        });

        // Element entrance for remaining targets (excluding text-reveal ones).
        var allTargets = rootEl.querySelectorAll('[data-tw-anim-target]');
        var elemTargets = Array.prototype.slice.call(allTargets)
            .filter(function (t) { return !t.hasAttribute('data-tw-anim-text'); });

        if (!elemTargets.length && textTargets.length === 0) {
            // No targets declared — animate the whole widget root.
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
            // Don't leave widgets invisible — clear ALL inline animation
            // properties GSAP may have set BEFORE throwing (especially
            // filter:blur, scale, clipPath which were the actual stuck
            // values, not just opacity).
            elemTargets.forEach(restoreVisibility);
        }
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

    /* ── Boot — runs for every scoped widget on the page ────── */

    ts.onReady('[data-tw-anim-scope]', function (rootEl) {
        applyEntrance(rootEl);
        applyBehaviors(rootEl);
    });

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
        presets:      PRESETS,
        textPresets:  TEXT_PRESETS,
        behaviors:    BEHAVIORS,
        register:     function (name, fn) { PRESETS[name] = fn; },
        registerText: function (name, fn) { TEXT_PRESETS[name] = fn; },
        registerBehavior: function (name, fn) { BEHAVIORS[name] = fn; },
        apply:        applyEntrance,
        applyText:    applyStandaloneTextReveal,
        level:        level,
        splitWords:   splitWords,
        splitChars:   splitChars,
        splitLines:   splitLines,
    };
})();
