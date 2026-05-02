/* ============================================================
 * Avero Consulting — Testimonials marquee
 *
 * Pattern (per the gsap-core / gsap-utils skills):
 *   1. Clone the track's children once → the track now contains
 *      EXACTLY 2× the original content.
 *   2. Animate xPercent: -50 with ease "none" + repeat: -1.
 *      When the track has shifted by 50% of its own width, the
 *      visible content is identical to the start state, so the
 *      loop snaps back without any visible jump.
 *   3. Use gsap.timeScale() instead of pause() on hover for a
 *      nicer slow-down feel; restore on mouseleave.
 *
 * Why GSAP and not a CSS @keyframes marquee:
 *   - We can pause / slow on hover without :hover restarting the
 *     keyframe from 0 (a known CSS-only quirk).
 *   - The runtime can flip timeScale() on prefers-reduced-motion
 *     toggle without re-mounting anything.
 *   - Works inside Elementor's editor preview — re-init kills the
 *     prior tween and rebuilds, no zombie animations.
 *
 * Idempotent: rootEl.__tw_marquee_tween is killed + the track's
 * original innerHTML is restored before each (re-)init so editor
 * re-renders never accumulate clones or stack tweens.
 * ============================================================ */
(function () {
    'use strict';

    var ts = (window.tempaloo && window.tempaloo.studio) || {};
    if (!ts.onReady) return;

    function init(rootEl) {
        if (!rootEl) return;
        var track = rootEl.querySelector('.tw-avero-testimonials__track');
        if (!track) return;

        // ── Idempotent reset ──────────────────────────────────
        // Editor re-renders or hot-reloads call init() again on the
        // same root. Without this block we'd duplicate clones each
        // time and stack tweens on top of each other.
        if (rootEl.__tw_marquee_tween) {
            try { rootEl.__tw_marquee_tween.kill(); } catch (e) {}
            rootEl.__tw_marquee_tween = null;
        }
        if (rootEl.__tw_marquee_original_html) {
            track.innerHTML = rootEl.__tw_marquee_original_html;
        }

        // Snapshot for the next re-init.
        rootEl.__tw_marquee_original_html = track.innerHTML;

        // Restore the CSS @keyframes fallback in case a prior init
        // disabled it. If GSAP takes over below we'll clear this
        // again — but if we return early (off / reduced / no GSAP)
        // the fallback keyframe needs to be live.
        track.style.animation = '';

        // ── Seamless loop setup ───────────────────────────────
        var children = Array.prototype.slice.call(track.children);
        if (children.length < 2) return; // Nothing to loop with one card.

        var fragment = document.createDocumentFragment();
        children.forEach(function (child) {
            var clone = child.cloneNode(true);
            // Hide the duplicates from screen readers and from the
            // tab order; the originals already announce the content.
            clone.setAttribute('aria-hidden', 'true');
            clone.setAttribute('tabindex', '-1');
            fragment.appendChild(clone);
        });
        track.appendChild(fragment);

        // ── Reduced motion + intensity gate ───────────────────
        var ns        = (window.tempaloo && window.tempaloo.avero) || {};
        var level     = ns.animationLevel ? ns.animationLevel() : 'medium';
        var prefersReduced = window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (level === 'off' || prefersReduced) {
            // Static fallback — content is fully visible, no motion.
            // The user can still scroll / tab through cards manually.
            return;
        }

        if (!window.gsap) return;
        var gsap = window.gsap;

        // GSAP is taking over — kill the CSS @keyframes fallback so
        // its transform doesn't fight our tween's transform.
        track.style.animation = 'none';

        // ── Build the marquee tween ───────────────────────────
        // Read duration from the data-attr written by widget.php so
        // the author can tune cadence per instance via the control.
        var seconds = parseFloat(rootEl.getAttribute('data-tw-duration') || '50');
        if (!isFinite(seconds) || seconds <= 0) seconds = 50;

        // Subtle = roughly 1.6× slower so the page feels calmer.
        if (level === 'subtle') seconds *= 1.6;

        // Start from x: 0, drift to xPercent: -50, repeat infinite.
        // Source order rule: track now contains 2× content, so when
        // it's shifted 50% of its width, what's visible matches t=0
        // → the playhead can wrap without visible discontinuity.
        rootEl.__tw_marquee_tween = gsap.fromTo(
            track,
            { xPercent: 0 },
            {
                xPercent: -50,
                duration: seconds,
                ease: 'none',
                repeat: -1,
            }
        );

        // ── Pause-ish on hover ────────────────────────────────
        // timeScale(0.15) is more elegant than pause() — the marquee
        // visibly slows so the user knows they're inside the hot
        // zone (and reading is easier) without a hard stop.
        if (!rootEl.__tw_marquee_hover_bound) {
            rootEl.__tw_marquee_hover_bound = true;
            rootEl.addEventListener('mouseenter', function () {
                if (rootEl.__tw_marquee_tween) rootEl.__tw_marquee_tween.timeScale(0.15);
            });
            rootEl.addEventListener('mouseleave', function () {
                if (rootEl.__tw_marquee_tween) rootEl.__tw_marquee_tween.timeScale(1);
            });
            // Same UX for keyboard focus — pause when an item is
            // focused so users tabbing through cards can read them.
            rootEl.addEventListener('focusin', function () {
                if (rootEl.__tw_marquee_tween) rootEl.__tw_marquee_tween.timeScale(0.15);
            });
            rootEl.addEventListener('focusout', function () {
                if (rootEl.__tw_marquee_tween) rootEl.__tw_marquee_tween.timeScale(1);
            });
        }
    }

    // Public namespace — lets Elementor's editor handler reuse the
    // same init function if needed (window.tempaloo.avero.testimonials).
    window.tempaloo = window.tempaloo || {};
    window.tempaloo.avero = window.tempaloo.avero || {};
    window.tempaloo.avero.testimonials = init;

    // onReady() handles BOTH the public frontend AND the Elementor
    // editor preview — the runtime fires it whenever the widget
    // mounts (or re-mounts after an edit), so we don't need a
    // separate elementorFrontend.hooks handler here.
    ts.onReady('.tw-avero-testimonials', init);
})();
