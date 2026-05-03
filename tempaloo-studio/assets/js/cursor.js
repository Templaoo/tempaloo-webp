/* ============================================================
 * Tempaloo Studio — Custom Cursor system (Sprint 2 / point #7)
 *
 * Inspired by Motion.page Cursor.js — 5 cursor types you can switch
 * between via the React admin (or programmatically via the public API):
 *
 *   - 'off'      : no custom cursor, native pointer.
 *   - 'basic'    : small dot that follows the pointer with smoothing.
 *   - 'outline'  : empty ring that grows on hover.
 *   - 'tooltip'  : pill near the pointer showing the value of
 *                  data-tw-cursor-tooltip on the hovered element.
 *   - 'text'     : large word near the pointer (data-tw-cursor-text),
 *                  scales up on hover. Style "VIEW" / "READ MORE".
 *   - 'media'    : image/video preview from data-tw-cursor-media on hover.
 *                  Used for portfolio galleries.
 *
 * Boots from window.tempaloo.studio.cursor = { type, smooth, accent,
 *   bg, size, mixBlendMode, hover: { scale } }.
 * Touch devices get no custom cursor. Off-window pointer is hidden.
 *
 * No GSAP dependency for the basic types — uses requestAnimationFrame
 * + transform for 60fps. The smoothing factor matches GSAP's cursor
 * patterns (lerp toward target, frame-rate independent).
 * ============================================================ */
(function () {
    'use strict';

    var ts = (window.tempaloo && window.tempaloo.studio) || null;
    if (!ts) return;

    // Tracer — gated by ?fp_debug=1 OR localStorage('fp_debug', '1').
    // Same flag the floating panel uses, so a single switch surfaces
    // every layer's diagnostics in one console session.
    var DEBUG = (function () {
        try {
            var qs = location.search.match(/[?&]fp_debug=([^&]*)/);
            if (qs && (qs[1] === '1' || qs[1] === 'true'))  { localStorage.setItem('fp_debug', '1'); return true; }
            if (qs && (qs[1] === '0' || qs[1] === 'false')) { localStorage.removeItem('fp_debug');   return false; }
            return localStorage.getItem('fp_debug') === '1';
        } catch (e) { return false; }
    })();
    function clog() {
        if (!DEBUG || !window.console) return;
        var args = Array.prototype.slice.call(arguments);
        args.unshift('%c[cursor]', 'color:#10b981;font-weight:bold');
        try { console.log.apply(console, args); } catch (e) {}
    }

    var cfg = (window.tempaloo && window.tempaloo.studio && window.tempaloo.studio.cursor) || null;
    clog('boot — cfg=', cfg);
    if (!cfg || cfg.type === 'off' || !cfg.type) {
        clog('skipped — type is off or unset');
        return;
    }

    // Touch-only devices: no custom cursor (would feel broken).
    if ('ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0) {
        clog('skipped — touch device');
        return;
    }

    var TYPE   = String(cfg.type || 'basic');
    var SMOOTH = clamp01(cfg.smooth, 0.18);
    var ACCENT = cfg.accent || '#10b981';
    var BG     = cfg.bg     || 'rgba(15, 23, 42, 0.92)';
    var SIZE   = parseInt(cfg.size || 14, 10);
    var BLEND  = cfg.mixBlendMode || 'normal';
    var HOVER_SCALE = (cfg.hover && cfg.hover.scale) || 2.4;

    function clamp01(n, def) {
        var v = parseFloat(n);
        if (!isFinite(v)) return def;
        return Math.max(0, Math.min(1, v));
    }

    var root = document.createElement('div');
    root.id = 'tw-cursor-root';
    root.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'pointer-events:none',
        'z-index:2147483646', 'mix-blend-mode:' + BLEND,
        'will-change:transform', 'transform:translate3d(-100px,-100px,0)',
        // Force visible — the anti-FOUC pattern hides body until DCL,
        // and tw-cursor-root is a body descendant that would inherit
        // visibility:hidden until then. Explicit !important wins so
        // the user's pointer stays visible during the FOUC window.
        'visibility:visible !important',
    ].join(';');
    // Append to documentElement (html) instead of body — body might be
    // hidden by the anti-FOUC pattern. html is never hidden.
    (document.documentElement || document.body).appendChild(root);
    clog('root appended', root);

    // The visual cursor element (shape varies by type).
    var dot = document.createElement('div');
    dot.id  = 'tw-cursor';
    dot.style.cssText = [
        'position:absolute', 'top:0', 'left:0',
        'transform:translate(-50%,-50%) scale(1)',
        'transition:transform 220ms cubic-bezier(0.16, 1, 0.3, 1), background 200ms ease, border-color 200ms ease, opacity 200ms ease',
        'will-change:transform',
    ].join(';');
    root.appendChild(dot);

    // Type-specific element setup.
    var label, mediaImg, mediaVideo;
    if (TYPE === 'basic') {
        applyDot(SIZE, ACCENT);
    } else if (TYPE === 'outline') {
        applyOutline(SIZE * 2.2, ACCENT);
    } else if (TYPE === 'tooltip') {
        applyDot(8, ACCENT);
        label = makeLabel();
        root.appendChild(label);
    } else if (TYPE === 'text') {
        // Hide dot, show big text.
        dot.style.opacity = '0';
        label = makeLabel(true);
        root.appendChild(label);
    } else if (TYPE === 'media') {
        dot.style.opacity = '0';
        mediaImg = document.createElement('img');
        mediaImg.style.cssText = [
            'position:absolute', 'top:0', 'left:0',
            'transform:translate(-50%,-50%) scale(0)',
            'width:160px', 'height:160px', 'object-fit:cover',
            'border-radius:8px', 'box-shadow:0 24px 48px -12px rgba(0,0,0,0.4)',
            'transition:transform 320ms cubic-bezier(0.16, 1, 0.3, 1)',
            'will-change:transform', 'pointer-events:none',
        ].join(';');
        root.appendChild(mediaImg);
        mediaVideo = document.createElement('video');
        mediaVideo.muted = true; mediaVideo.loop = true; mediaVideo.playsInline = true;
        mediaVideo.style.cssText = mediaImg.style.cssText;
        root.appendChild(mediaVideo);
    } else {
        applyDot(SIZE, ACCENT);
    }

    function applyDot(size, color) {
        dot.style.width  = size + 'px';
        dot.style.height = size + 'px';
        dot.style.borderRadius = '50%';
        dot.style.background   = color;
    }
    function applyOutline(size, color) {
        dot.style.width  = size + 'px';
        dot.style.height = size + 'px';
        dot.style.borderRadius = '50%';
        dot.style.background   = 'transparent';
        dot.style.border       = '1.5px solid ' + color;
    }
    function makeLabel(big) {
        var el = document.createElement('div');
        el.style.cssText = [
            'position:absolute', 'top:0', 'left:0',
            'transform:translate(-50%, calc(-100% - 14px))',
            big ? 'font-size:18px' : 'font-size:11px',
            big ? 'font-weight:700' : 'font-weight:600',
            big ? 'letter-spacing:-0.01em' : 'letter-spacing:0.02em',
            'color:' + (big ? ACCENT : '#fff'),
            big ? 'text-transform:uppercase' : '',
            'padding:' + (big ? '6px 10px' : '4px 8px'),
            'background:' + (big ? 'transparent' : BG),
            'border-radius:' + (big ? '0' : '4px'),
            'white-space:nowrap',
            'opacity:0',
            'transition:opacity 180ms ease',
            'font-family:ui-sans-serif, system-ui, sans-serif',
        ].filter(Boolean).join(';');
        return el;
    }

    // Pointer tracking + render loop with smoothing.
    var mx = -100, my = -100;
    var cx = -100, cy = -100;
    var hovered = null;
    var hoveredKind = null; // 'tooltip' | 'text' | 'media' | 'click'
    var hoveredVal  = '';

    function onMove(e) {
        mx = e.clientX; my = e.clientY;
        // Detect hovered targets.
        var t = e.target;
        if (TYPE === 'tooltip')      detectAttr(t, 'data-tw-cursor-tooltip');
        else if (TYPE === 'text')    detectAttr(t, 'data-tw-cursor-text');
        else if (TYPE === 'media')   detectAttr(t, 'data-tw-cursor-media');
        // Click-target hover scale.
        var c = closestClickable(t);
        if (c !== hovered) {
            hovered = c;
            dot.style.transform = 'translate(-50%,-50%) scale(' + (c ? HOVER_SCALE : 1) + ')';
        }
    }
    function detectAttr(start, attr) {
        var el = start;
        while (el && el !== document.body) {
            if (el.getAttribute && el.getAttribute(attr)) {
                if (hoveredKind !== attr || hoveredVal !== el.getAttribute(attr)) {
                    hoveredKind = attr;
                    hoveredVal  = el.getAttribute(attr);
                    showLabel(hoveredVal);
                }
                return;
            }
            el = el.parentElement;
        }
        if (hoveredKind) {
            hoveredKind = null; hoveredVal = '';
            hideLabel();
        }
    }
    function showLabel(val) {
        if (label) {
            label.textContent = val;
            label.style.opacity = '1';
        }
        if (mediaImg && TYPE === 'media') {
            var isVideo = /\.(mp4|webm|ogg)(\?|$)/i.test(val);
            if (isVideo) {
                mediaImg.style.transform = 'translate(-50%,-50%) scale(0)';
                if (mediaVideo.src !== val) mediaVideo.src = val;
                mediaVideo.style.transform = 'translate(-50%,-50%) scale(1)';
                mediaVideo.play().catch(function () {});
            } else {
                mediaVideo.style.transform = 'translate(-50%,-50%) scale(0)';
                if (mediaImg.src !== val) mediaImg.src = val;
                mediaImg.style.transform = 'translate(-50%,-50%) scale(1)';
            }
        }
    }
    function hideLabel() {
        if (label) label.style.opacity = '0';
        if (mediaImg) mediaImg.style.transform = 'translate(-50%,-50%) scale(0)';
        if (mediaVideo) mediaVideo.style.transform = 'translate(-50%,-50%) scale(0)';
    }
    function closestClickable(el) {
        while (el && el !== document.body) {
            if (el.tagName === 'A' || el.tagName === 'BUTTON' ||
                el.getAttribute && (el.getAttribute('role') === 'button' || el.getAttribute('data-tw-cursor-hover') !== null)) {
                return el;
            }
            el = el.parentElement;
        }
        return null;
    }

    // Render loop — frame-rate independent lerp toward target.
    var rafId;
    function tick() {
        // Ease factor: equivalent to per-frame (1 - SMOOTH^60) but
        // computed each frame to handle variable refresh rates.
        var k = 1 - Math.pow(1 - SMOOTH, 1);
        cx += (mx - cx) * k;
        cy += (my - cy) * k;
        root.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
        rafId = requestAnimationFrame(tick);
    }
    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', function () {
        // Hide cursor when pointer leaves the document.
        root.style.opacity = '0';
    });
    document.addEventListener('mouseenter', function () { root.style.opacity = '1'; });
    rafId = requestAnimationFrame(tick);

    // Hide native cursor only when our custom one is BASIC / OUTLINE
    // / TEXT — for tooltip + media we keep the OS pointer so the user
    // doesn't lose their bearings while reading the label / image.
    if (TYPE === 'basic' || TYPE === 'outline' || TYPE === 'text') {
        document.documentElement.style.cursor = 'none';
        // But we don't want this on form fields — let them keep the
        // I-beam / pointer for affordance.
        var styleTag = document.createElement('style');
        styleTag.id = 'tw-cursor-overrides';
        styleTag.textContent =
            'input,textarea,select,[contenteditable]{cursor:auto!important}' +
            'a,button,[role="button"],[data-tw-cursor-hover]{cursor:none!important}';
        document.head.appendChild(styleTag);
    }

    // Public API for the floating panel to live-toggle without reload.
    ts.cursor = ts.cursor || {};
    ts.cursor.destroy = function () {
        cancelAnimationFrame(rafId);
        document.removeEventListener('mousemove', onMove);
        if (root.parentNode) root.parentNode.removeChild(root);
        document.documentElement.style.cursor = '';
        var s = document.getElementById('tw-cursor-overrides');
        if (s && s.parentNode) s.parentNode.removeChild(s);
    };
})();
