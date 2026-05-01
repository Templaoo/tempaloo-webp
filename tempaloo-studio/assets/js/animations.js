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
            gsap().from(targets, Object.assign({
                opacity: 0,
                scale: 0.92,
                duration: opts.duration || 0.7,
                ease: 'back.out(1.4)',
                stagger: opts.stagger || 0,
                clearProps: 'opacity,transform',
            }, opts.scrollTrigger ? { scrollTrigger: opts.scrollTrigger } : {}));
        },

        'blur-in': function (targets, opts) {
            // Editorial premium — uses CSS filter; no GSAP plugin needed.
            gsap().from(targets, Object.assign({
                opacity: 0,
                filter: 'blur(20px)',
                duration: opts.duration || 0.85,
                ease: 'power3.out',
                stagger: opts.stagger || 0,
                clearProps: 'opacity,filter',
            }, opts.scrollTrigger ? { scrollTrigger: opts.scrollTrigger } : {}));
        },

        'mask-reveal': function (targets, opts) {
            // Reveal via clip-path — works for headlines and image cards alike.
            gsap().from(targets, Object.assign({
                clipPath: 'inset(0 100% 0 0)',
                duration: opts.duration || 0.8,
                ease: 'power3.out',
                stagger: opts.stagger || 0,
                clearProps: 'clipPath',
            }, opts.scrollTrigger ? { scrollTrigger: opts.scrollTrigger } : {}));
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
        if (!gsap()) return;

        var lvl = level();
        if (lvl === 'off') return;

        var scope = rootEl.getAttribute('data-tw-anim-scope');
        if (!scope) return;

        // Resolve per-widget config from the inlined payload.
        var cfg = (window.tempaloo && window.tempaloo.studio && window.tempaloo.studio.anims) || {};
        var widgetCfg = cfg[scope] || {};

        var preset = widgetCfg.entrance || 'fade-up';
        if (lvl === 'subtle' && preset !== 'none') preset = 'fade'; // downgrade on reduced-motion / subtle

        var fn = PRESETS[preset];
        if (!fn) return;

        // Targets — all `[data-tw-anim-target]` children, OR the root itself
        // if no targets are declared (whole-widget entrance).
        var targets = rootEl.querySelectorAll('[data-tw-anim-target]');
        if (!targets.length) targets = [rootEl];

        // Sort by data-tw-anim-order if present, otherwise DOM order.
        var sorted = Array.prototype.slice.call(targets).sort(function (a, b) {
            var oa = parseFloat(a.getAttribute('data-tw-anim-order') || '0');
            var ob = parseFloat(b.getAttribute('data-tw-anim-order') || '0');
            return oa - ob;
        });

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

        // Kill any prior tween on these targets so re-init in editor doesn't double.
        if (rootEl.__twAnimTween) { try { rootEl.__twAnimTween.kill(); } catch (e) {} }
        try {
            fn(sorted, opts);
            // GSAP returns either a tween or sets up multiple — we don't need
            // to track every one, just the most recent if available.
        } catch (e) { /* swallow */ }
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

    /* ── Public API for power users ─────────────────────────── */

    ts.animations = {
        presets:   PRESETS,
        behaviors: BEHAVIORS,
        register:  function (name, fn) { PRESETS[name] = fn; },
        registerBehavior: function (name, fn) { BEHAVIORS[name] = fn; },
        apply:     applyEntrance,
        level:     level,
    };
})();
