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
        var stuckRoots = [];
        var stuckSplits = [];
        document.querySelectorAll('[data-tw-anim-scope], [data-tw-anim-target], [data-tw-anim-text]').forEach(function (el) {
            var op = parseFloat(getComputedStyle(el).opacity);
            if (op < 0.05) stuckRoots.push(el);
        });
        // Also check split-text descendants (words / chars / lines) which
        // are the most common stuck-at-0 case after a failed GSAP timeline.
        document.querySelectorAll('.tw-word, .tw-word__inner, .tw-char, .tw-line__inner').forEach(function (el) {
            var op = parseFloat(getComputedStyle(el).opacity);
            if (op < 0.05) stuckSplits.push(el);
        });

        if (!stuckRoots.length && !stuckSplits.length) {
            log('safety net: all elements visible');
            return;
        }
        warn('safety net: forcing visibility on', stuckRoots.length, 'roots +',
             stuckSplits.length, 'split-spans', force ? '(manual)' : '(auto)');

        function clean(el) {
            if (window.gsap && typeof window.gsap.killTweensOf === 'function') {
                try { window.gsap.killTweensOf(el); } catch (e) {}
            }
            el.style.opacity = '';
            el.style.transform = '';
            el.style.filter = '';
            el.style.clipPath = '';
            el.style.yPercent = '';
        }

        stuckRoots.forEach(function (el) {
            clean(el);
            el.querySelectorAll('.tw-word, .tw-word__inner, .tw-char, .tw-line__inner').forEach(clean);
        });
        stuckSplits.forEach(clean);
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

    /* ── Entrance presets ────────────────────────────────────── */

    /**
     * Each preset receives:
     *   targets — Array<HTMLElement>  (the elements to animate)
     *   opts    — { stagger, duration, scrollTrigger?, lvlFactor }
     */
    var PRESETS = {
        'none': function () { /* no-op */ },

        'fade': function (targets, opts) {
            gsap().from(targets, Object.assign({
                opacity: 0,
                duration: opts.duration || 0.45,
                ease: 'power1.out',
                stagger: opts.stagger || 0,
                clearProps: 'opacity',
            }, opts.scrollTrigger ? { scrollTrigger: opts.scrollTrigger } : {}));
        },

        'fade-up': function (targets, opts) {
            gsap().from(targets, Object.assign({
                opacity: 0,
                y: 24 * (opts.lvlFactor || 1),
                duration: opts.duration || 0.7,
                ease: 'power3.out',
                stagger: opts.stagger || 0,
                clearProps: 'opacity,transform',
            }, opts.scrollTrigger ? { scrollTrigger: opts.scrollTrigger } : {}));
        },

        'fade-down': function (targets, opts) {
            gsap().from(targets, Object.assign({
                opacity: 0,
                y: -24 * (opts.lvlFactor || 1),
                duration: opts.duration || 0.7,
                ease: 'power3.out',
                stagger: opts.stagger || 0,
                clearProps: 'opacity,transform',
            }, opts.scrollTrigger ? { scrollTrigger: opts.scrollTrigger } : {}));
        },

        'fade-left': function (targets, opts) {
            gsap().from(targets, Object.assign({
                opacity: 0,
                x: -32 * (opts.lvlFactor || 1),
                duration: opts.duration || 0.7,
                ease: 'power3.out',
                stagger: opts.stagger || 0,
                clearProps: 'opacity,transform',
            }, opts.scrollTrigger ? { scrollTrigger: opts.scrollTrigger } : {}));
        },

        'fade-right': function (targets, opts) {
            gsap().from(targets, Object.assign({
                opacity: 0,
                x: 32 * (opts.lvlFactor || 1),
                duration: opts.duration || 0.7,
                ease: 'power3.out',
                stagger: opts.stagger || 0,
                clearProps: 'opacity,transform',
            }, opts.scrollTrigger ? { scrollTrigger: opts.scrollTrigger } : {}));
        },

        'scale-in': function (targets, opts) {
            // scale: 0.92 at lvlFactor=1 (medium); 1.0 at subtle (no scale);
            // 0.888 at bold. Lerp around 1 with intensity.
            var f = opts.lvlFactor != null ? opts.lvlFactor : 1;
            gsap().from(targets, Object.assign({
                opacity: 0,
                scale: 1 - 0.08 * f,
                duration: opts.duration || 0.7,
                ease: 'back.out(1.4)',
                stagger: opts.stagger || 0,
                clearProps: 'opacity,transform',
            }, opts.scrollTrigger ? { scrollTrigger: opts.scrollTrigger } : {}));
        },

        'blur-in': function (targets, opts) {
            var f = opts.lvlFactor != null ? opts.lvlFactor : 1;
            gsap().from(targets, Object.assign({
                opacity: 0,
                filter: 'blur(' + (20 * f) + 'px)',
                duration: opts.duration || 0.85,
                ease: 'power3.out',
                stagger: opts.stagger || 0,
                clearProps: 'opacity,filter',
            }, opts.scrollTrigger ? { scrollTrigger: opts.scrollTrigger } : {}));
        },

        'mask-reveal': function (targets, opts) {
            // mask-reveal at subtle (lvlFactor 0) collapses to a soft fade
            // so the user never gets a jarring visual at "subtle" setting.
            var f = opts.lvlFactor != null ? opts.lvlFactor : 1;
            if (f === 0) {
                gsap().from(targets, Object.assign({
                    opacity: 0, duration: opts.duration || 0.4, ease: 'power1.out',
                    stagger: opts.stagger || 0, clearProps: 'opacity',
                }, opts.scrollTrigger ? { scrollTrigger: opts.scrollTrigger } : {}));
                return;
            }
            gsap().from(targets, Object.assign({
                clipPath: 'inset(0 100% 0 0)',
                duration: opts.duration || 0.8,
                ease: 'power3.out',
                stagger: opts.stagger || 0,
                clearProps: 'clipPath',
            }, opts.scrollTrigger ? { scrollTrigger: opts.scrollTrigger } : {}));
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

    function withST(opts) {
        return opts && opts.scrollTrigger ? { scrollTrigger: opts.scrollTrigger } : {};
    }

    var TEXT_PRESETS = {

        // 1. Word fade-up — DEFAULT for editorial headlines.
        'word-fade-up': function (el, opts) {
            var words = splitWords(el, false);
            gsap().from(words, Object.assign({
                opacity: 0, y: 16 * (opts.lvlFactor || 1),
                duration: 0.6, ease: 'power3.out',
                stagger: 0.03, clearProps: 'opacity,transform',
            }, withST(opts)));
        },

        // 2. Word fade-blur — premium / editorial.
        'word-fade-blur': function (el, opts) {
            var words = splitWords(el, false);
            gsap().from(words, Object.assign({
                opacity: 0, filter: 'blur(8px)',
                duration: 0.7, ease: 'power2.out',
                stagger: 0.04, clearProps: 'opacity,filter',
            }, withST(opts)));
        },

        // 3. Word slide-up (overflow) — cinematic Stripe-style.
        'word-slide-up-overflow': function (el, opts) {
            var inners = splitWords(el, true);
            gsap().from(inners, Object.assign({
                yPercent: 110, duration: 0.7, ease: 'power4.out',
                stagger: 0.04, clearProps: 'transform',
            }, withST(opts)));
        },

        // 4. Char up — short headlines only (auto-fallback if too long).
        'char-up': function (el, opts) {
            var text = (el.textContent || '').trim();
            if (text.length > 60) return TEXT_PRESETS['word-fade-up'](el, opts);
            var chars = splitChars(el);
            gsap().from(chars, Object.assign({
                opacity: 0, y: 8 * (opts.lvlFactor || 1),
                duration: 0.5, ease: 'power3.out',
                stagger: 0.018, clearProps: 'opacity,transform',
            }, withST(opts)));
        },

        // 5. Line fade-up stagger — multi-line headlines (split on <br>).
        'line-fade-up-stagger': function (el, opts) {
            var lines = splitLines(el);
            gsap().from(lines, Object.assign({
                opacity: 0, y: 24 * (opts.lvlFactor || 1),
                duration: 0.7, ease: 'power3.out',
                stagger: 0.1, clearProps: 'opacity,transform',
            }, withST(opts)));
        },

        // 6. Text typing — typewriter chars instant-reveal sequentially.
        //    Stagger cap: keep total animation duration under 1.5s even
        //    on long sentences (200-char text would otherwise type for
        //    9 seconds — too slow for a hero headline).
        'text-typing': function (el, opts) {
            var chars = splitChars(el);
            var stagger = Math.min(0.045, chars.length > 0 ? 1.5 / chars.length : 0.045);
            gsap().set(chars, { opacity: 0 });
            gsap().to(chars, Object.assign({
                opacity: 1, duration: 0.001, stagger: stagger, ease: 'none',
            }, withST(opts)));
        },

        // 7. Text fill sweep — wave from dim to full opacity, char-by-char.
        //    Falls back to word-stagger if the text is too long to char-split
        //    cleanly. Reliable across all browsers (no background-clip:text
        //    or color-mix() — those have spotty Safari support).
        'text-fill-sweep': function (el, opts) {
            var text = (el.textContent || '').trim();
            // Auto-fallback to word-level for long text (paragraphs).
            if (text.length > 80) {
                var words = splitWords(el, false);
                gsap().fromTo(words,
                    { opacity: 0.22 },
                    Object.assign({
                        opacity: 1, duration: 0.4, stagger: 0.05,
                        ease: 'power2.out', clearProps: 'opacity',
                    }, withST(opts))
                );
                return;
            }
            var chars = splitChars(el);
            gsap().fromTo(chars,
                { opacity: 0.22 },
                Object.assign({
                    opacity: 1, duration: 0.3, stagger: 0.022,
                    ease: 'power2.out', clearProps: 'opacity',
                }, withST(opts))
            );
        },

        // 8. Scroll-linked words fill — Apple/Stripe-Tax style.
        //    Requires ScrollTrigger; falls back to simple fade if absent.
        'scroll-words-fill': function (el, opts) {
            var words = splitWords(el, false);
            gsap().set(words, { opacity: 0.18 });
            if (hasST()) {
                gsap().to(words, {
                    opacity: 1, ease: 'none', stagger: 0.1,
                    scrollTrigger: { trigger: el, start: 'top 80%', end: 'top 30%', scrub: true },
                });
            } else {
                gsap().to(words, { opacity: 1, duration: 0.6, stagger: 0.05, ease: 'power2.out', clearProps: 'opacity' });
            }
        },

        // 9. Editorial stack — composite, orchestrates the children
        //    (eyebrow / headline / lead / cta-row) of a scope. Headline
        //    auto-receives word-fade-up, others fade up sequentially.
        //    Falls back to fade-up of the root if no targets declared,
        //    so picking this preset on a non-editorial widget still
        //    plays SOMETHING rather than silently no-op'ing.
        'editorial-stack': function (rootEl, opts) {
            var targets = rootEl.querySelectorAll('[data-tw-anim-target]');
            if (!targets.length) {
                // Graceful fallback — the widget didn't mark its children,
                // so just fade the whole widget root in.
                gsap().from(rootEl, Object.assign({
                    opacity: 0, y: 16 * (opts.lvlFactor || 1),
                    duration: 0.7, ease: 'power3.out',
                    clearProps: 'opacity,transform',
                }, withST(opts)));
                return;
            }
            var tl = gsap().timeline(withST(opts));
            Array.prototype.slice.call(targets).forEach(function (t, i) {
                var tag = (t.tagName || '').toLowerCase();
                var isHeadline = tag === 'h1' || tag === 'h2' || tag === 'h3';
                if (isHeadline) {
                    var words = splitWords(t, false);
                    tl.from(words, {
                        opacity: 0, y: 16 * (opts.lvlFactor || 1),
                        duration: 0.65, ease: 'power3.out', stagger: 0.03,
                        clearProps: 'opacity,transform',
                    }, i === 0 ? 0 : 0.15);
                } else {
                    tl.from(t, {
                        opacity: 0, y: 14 * (opts.lvlFactor || 1),
                        duration: 0.55, ease: 'power3.out',
                        clearProps: 'opacity,transform',
                    }, i === 0 ? 0 : '<0.08');
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

        // Composite text presets like 'editorial-stack' take the rootEl
        // and orchestrate their own targets internally.
        if (TEXT_PRESETS[preset] && (preset === 'editorial-stack')) {
            try { TEXT_PRESETS[preset](rootEl, opts); }
            catch (e) {
                warn('preset "' + preset + '" threw on', rootEl, e);
                // Failure fallback: don't leave the widget invisible.
                rootEl.style.opacity = '1';
            }
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
                catch (e) { warn('text preset "' + name + '" threw on', t, e); t.style.opacity = '1'; }
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
            // Don't leave widgets invisible if a preset crashed.
            elemTargets.forEach(function (t) { t.style.opacity = '1'; });
        }
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
