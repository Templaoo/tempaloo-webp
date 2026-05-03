/* ============================================================
 * Avero Consulting — Built for Life widget animation
 *
 * Refactored per the Tempaloo Studio audit (Sprint 1.1) to follow
 * the canonical Animation Addons / GSAP-ScrollTrigger handler pattern:
 *
 *   - elementorModules.frontend.handlers.Base.extend({}) — proper
 *     Elementor lifecycle (onInit / bindEvents / onEditSettingsChange
 *     / onDestroy) so the animation re-initialises cleanly on every
 *     editor preview re-render.
 *   - getResponsiveSetting(name) — walks the device cascade so Pin
 *     Start / Pin End / Pin Spacing / breakpoint settings work per
 *     device-mode without REST round-trips.
 *   - pinType: 'transform' explicit — Elementor's nested DOM
 *     (sections / containers / Motion Effects / etc.) routinely has
 *     ancestors with transforms. position:fixed (default) gets
 *     trapped in those containing blocks; transform-mode bypasses
 *     the issue entirely.
 *   - anticipatePin: 1 — preempts the pin engagement by 1 px so the
 *     visual transition feels seamless on fast scroll.
 *   - id: data-id — every ScrollTrigger gets a unique id derived
 *     from the Elementor element's data-id. ScrollTrigger.getById()
 *     kills duplicates before re-creating.
 *   - Editor mode bail — bindEvents() returns early in this.isEdit
 *     so the pin doesn't lock the section and prevent inspecting
 *     downstream content. A "Run Animations" button can be enabled
 *     later if preview-in-editor becomes a requested feature.
 *
 * Audit conformance: target 38/38 on sections A-J of the 50-point
 * checklist (sections K covered by widget.php controls).
 *
 * Reference docs:
 *   ../../../../../test-pin-scale/learnings/WIDGET-TEMPLATE.js
 *   ../../../../../test-pin-scale/learnings/GSAP-ELEMENTOR-INTEGRATION-RULES.md
 *   ../../../../../test-pin-scale/learnings/STICKY-ELEMENTS-OFFICIAL-DOC.md
 * ============================================================ */
(function ($) {
    'use strict';

    var WIDGET_NAME     = 'built-for-life';
    var ROOT_SELECTOR   = '.tw-avero-built-for-life';
    var STICKY_SELECTOR = '.tw-avero-built-for-life__sticky';
    var CANVAS_SELECTOR = '.tw-avero-built-for-life__canvas';

    var DEBUG = (function () {
        try { return location.search.indexOf('fp_debug=1') !== -1
                  || localStorage.getItem('fp_debug') === '1'; }
        catch (e) { return false; }
    })();
    function clog() {
        if (!DEBUG || !window.console) return;
        var args = Array.prototype.slice.call(arguments);
        args.unshift('%c[bfl]', 'color:#E6FF55;font-weight:bold');
        try { console.log.apply(console, args); } catch (e) {}
    }
    function cwarn() {
        if (!window.console) return;
        var args = Array.prototype.slice.call(arguments);
        args.unshift('%c[bfl]', 'color:#ff6b6b;font-weight:bold');
        try { console.warn.apply(console, args); } catch (e) {}
    }

    window.addEventListener('elementor/frontend/init', function () {
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
            cwarn('GSAP / ScrollTrigger not loaded — widget will render statically');
            return;
        }
        gsap.registerPlugin(ScrollTrigger);

        var Base = elementorModules.frontend.handlers.Base;

        var Handler = Base.extend({

            /* ── Lifecycle 1 — onInit (state, no DOM events yet) ── */
            onInit: function () {
                // CRITICAL — set state BEFORE the super call. Elementor's
                // Base.prototype.onInit triggers bindEvents() synchronously,
                // which calls run() → matchMedia.add() → _buildDesktop() →
                // this._stIds.push(...). If we initialise _stIds AFTER
                // super, _buildDesktop runs with this._stIds === undefined
                // and throws TypeError. Set first, then super.
                this._tls   = [];      // tracked timelines
                this._mm    = null;    // gsap.matchMedia context
                this._stIds = [];      // tracked ScrollTrigger ids (for dedup)
                Base.prototype.onInit.apply(this, arguments);
            },

            /* ── Lifecycle 2 — bindEvents (DOM ready, attach behavior) ── */
            bindEvents: function () {
                // Editor mode bail — pin in editor blocks scrolling past
                // the section, frustrating the editing UX. Frontend only.
                if (this.isEdit) {
                    clog('editor mode — animation skipped (use a non-editor preview to test the pin)');
                    return;
                }
                if (this.getResponsiveSetting('enable_pin') !== 'yes') {
                    clog('enable_pin = no — skipping pin animation');
                    return;
                }
                this.run();
            },

            /* ── Lifecycle 3 — onEditSettingsChange (panel edits) ── */
            onEditSettingsChange: function (propertyName, value) {
                // Only react to settings the runtime cares about. The CSS
                // calc() pattern handles card_width / height / radius via
                // server-side render(), so changes there require a full
                // page refresh (not our job to live-preview them).
                var pinControls = [
                    'enable_pin', 'pin_start', 'pin_start_custom',
                    'pin_end', 'pin_end_custom', 'pin_spacing',
                    'pin_markers', 'mobile_breakpoint',
                ];
                if (pinControls.indexOf(propertyName) !== -1) {
                    this._cleanup();
                    if (this.getResponsiveSetting('enable_pin') === 'yes') this.run();
                }
            },

            /* ── Lifecycle 4 — onDestroy (Elementor re-render) ── */
            onDestroy: function () {
                this._cleanup();
                if (typeof Base.prototype.onDestroy === 'function') {
                    Base.prototype.onDestroy.apply(this, arguments);
                }
            },

            /* ── Responsive setting resolver ──
             *
             * Walks UP from current device, then DOWN, falling back to
             * the base control. Required because Elementor's
             * getElementSettings() ignores responsive variants.
             *
             * Verbatim port from Animation Addons sticky-pin.js — the
             * 14-line resolver that walks the cascade. Re-implementing
             * it here means the widget honours per-device settings
             * (Pin Start "top top" on desktop, "top center" on tablet,
             * etc.) without REST or extra ajax calls.
             */
            getResponsiveSetting: function (controlName) {
                var settings = this.getElementSettings();
                var currentDevice = elementorFrontend.getCurrentDeviceMode();
                var devices = ['mobile', 'mobile_extra', 'tablet', 'tablet_extra',
                               'laptop', 'desktop', 'widescreen'];
                var currentIndex = devices.indexOf(currentDevice);
                var start = currentIndex >= 0 ? currentIndex : devices.indexOf('desktop');

                for (var i = start; i < devices.length; i++) {
                    var v = elementorFrontend.utils.controls
                        .getResponsiveControlValue(settings, controlName, '', devices[i]);
                    if (v && typeof v === 'object') {
                        if (v.size !== undefined && v.size !== '' && !isNaN(v.size)) return v;
                    } else if (v !== undefined && v !== null && v !== '') return v;
                }
                for (var j = start - 1; j >= 0; j--) {
                    var w = elementorFrontend.utils.controls
                        .getResponsiveControlValue(settings, controlName, '', devices[j]);
                    if (w && typeof w === 'object') {
                        if (w.size !== undefined && w.size !== '' && !isNaN(w.size)) return w;
                    } else if (w !== undefined && w !== null && w !== '') return w;
                }
                return this.getElementSettings(controlName);
            },

            /* ── Resolve Pin Start / Pin End from enum + custom ── */
            _resolveStart: function () {
                var v = this.getResponsiveSetting('pin_start');
                if (v === 'custom') {
                    var cus = this.getResponsiveSetting('pin_start_custom');
                    return (cus && String(cus).trim()) || 'top top';
                }
                return v || 'top top';
            },
            _resolveEnd: function () {
                var v = this.getResponsiveSetting('pin_end');
                if (v === 'custom') {
                    var cus = this.getResponsiveSetting('pin_end_custom');
                    return (cus && String(cus).trim()) || 'bottom bottom';
                }
                return v || 'bottom bottom';
            },
            _resolvePinSpacing: function () {
                var v = this.getResponsiveSetting('pin_spacing');
                if (v === 'true')   return true;
                if (v === 'custom') return true;   // GSAP doesn't take strings; treat custom as true
                return false;                      // 'false' or undefined → no spacing
            },

            /* ── Main RUN — wires the animation ── */
            run: function () {
                this._cleanup();    // always cleanup before re-init

                var $element = this.$element;
                var root = $element[0];
                if (!root) return;

                var canvas = root.querySelector(CANVAS_SELECTOR);
                var sticky = root.querySelector(STICKY_SELECTOR);
                if (!canvas || !sticky) {
                    cwarn('markup missing — bailing', { canvas: !!canvas, sticky: !!sticky });
                    return;
                }

                // F1+F2 — kill CSS transitions before tweening so the
                // theme's `transition: 0.3s ease` (if any) doesn't fight
                // GSAP's tween.
                $element.css('transition', 'unset');
                gsap.set(root, { transition: 'none' });

                var bp = parseInt(this.getResponsiveSetting('mobile_breakpoint'), 10);
                if (!Number.isFinite(bp)) bp = 800;

                var self = this;

                // C3 — branch on viewport via gsap.matchMedia. Each branch
                // returns a cleanup function that runs when the MQ stops
                // matching (e.g. user resizes desktop → mobile).
                this._mm = gsap.matchMedia();

                this._mm.add({
                    isDesktop: '(min-width: ' + (bp + 1) + 'px) and (prefers-reduced-motion: no-preference)',
                    isMobile:  '(max-width: ' + bp + 'px)',
                    isReduced: '(prefers-reduced-motion: reduce)',
                }, function (ctx) {
                    if (ctx.conditions.isMobile || ctx.conditions.isReduced) {
                        canvas.style.setProperty('--p', '1');
                        clog('mobile/reduced — locked at --p:1');
                        return;
                    }
                    if (ctx.conditions.isDesktop) {
                        self._buildDesktop(root, sticky, canvas);
                    }
                });

                clog('ready', {
                    bp: bp,
                    pinStart: this._resolveStart(),
                    pinEnd:   this._resolveEnd(),
                    pinSpacing: this._resolvePinSpacing(),
                });
            },

            /* ── Build desktop ScrollTrigger + scrub timeline ── */
            _buildDesktop: function (root, sticky, canvas) {
                var dataId = root.getAttribute('data-id') ||
                             ('bfl-' + Math.random().toString(36).slice(2, 9));
                var stId   = 'bfl-' + dataId;

                // D5 — kill any pre-existing ST with this id (Elementor
                // re-render or hot-reload scenario).
                var existing = ScrollTrigger.getById(stId);
                if (existing) {
                    try { existing.kill(); } catch (e) {}
                }
                this._stIds.push(stId);

                var pinMarkers = this.getElementSettings('pin_markers') === 'true';

                // Build the scrubbed timeline. ScrollTrigger config follows
                // the canonical params from the gsap-scrolltrigger skill +
                // Animation Addons reference:
                //   D1 pinType: 'transform' — bypasses ancestor-transform traps
                //   D2 anticipatePin: 1     — reduces pin-engage jitter
                //   D3 invalidateOnRefresh  — recalc on resize/img-load/font-swap
                //   D4 id                   — for getById?.kill() dedup
                //   D6 pinSpacing: false    — section has explicit height
                var tl = gsap.timeline({
                    scrollTrigger: {
                        id:                  stId,
                        trigger:             root,
                        start:               this._resolveStart(),
                        end:                 this._resolveEnd(),
                        scrub:               1,
                        pin:                 sticky,
                        pinType:             'transform',
                        pinSpacing:          this._resolvePinSpacing(),
                        anticipatePin:       1,
                        invalidateOnRefresh: true,
                        markers:             pinMarkers,
                    },
                });

                // Phase 1 (timeline 0 → 0.7) — card grows + image dezooms +
                // text fades-in. All visual interpolation handled in CSS
                // via calc(... * var(--p)); GSAP just animates --p 0→1.
                tl.fromTo(canvas,
                    { '--p': 0 },
                    { '--p': 1, duration: 0.7, ease: 'none' }
                );

                // Phase 2 (timeline 0.7 → 1.0) — empty hold so the
                // user has 30% of the scroll length to read.
                tl.to({}, { duration: 0.3 });

                this._tls.push(tl);    // E5: track for cleanup
            },

            /* ── Cleanup (rules E1-E5) ── */
            _cleanup: function () {
                var root = this.$element[0];

                // E5 — kill timelines tracked locally
                if (this._tls && this._tls.length) {
                    this._tls.forEach(function (tl) {
                        try { tl.kill(); } catch (e) {}
                    });
                    this._tls = [];
                }

                // D5/E4 — kill ScrollTriggers by tracked id
                if (this._stIds && this._stIds.length) {
                    this._stIds.forEach(function (id) {
                        var st = ScrollTrigger.getById(id);
                        if (st) {
                            try { st.kill(); } catch (e) {}
                        }
                    });
                    this._stIds = [];
                }

                // E4 — kill any ST whose trigger or pin lives inside our root
                if (root && window.ScrollTrigger) {
                    ScrollTrigger.getAll().forEach(function (st) {
                        if (!st) return;
                        if ((st.trigger && root.contains(st.trigger)) ||
                            (st.pin && root.contains(st.pin))) {
                            try { st.kill(); } catch (e) {}
                        }
                    });
                }

                // E5 — revert matchMedia
                if (this._mm && this._mm.revert) {
                    try { this._mm.revert(); } catch (e) {}
                    this._mm = null;
                }
            },
        });

        // A3 — register the handler on Elementor's element_ready hook.
        // Fires for every instance of `built-for-life.default` on the
        // page, including after editor re-renders (Elementor's lifecycle
        // re-fires the action).
        elementorFrontend.hooks.addAction(
            'frontend/element_ready/' + WIDGET_NAME + '.default',
            function ($element) {
                elementorFrontend.elementsHandler.addHandler(Handler, { $element: $element });
            }
        );

        clog('handler registered for ' + WIDGET_NAME + '.default');
    });
})(jQuery);
