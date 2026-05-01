/* ============================================================
 * Avero Consulting — Hero widget JS
 *
 * Init function: window.tempaloo.avero.hero(rootEl)
 *
 * Per WIDGET-SPEC §1.9 + §1.12:
 *   - All queries scoped to rootEl
 *   - Idempotent (re-running on the same root replays cleanly)
 *   - Honours prefers-reduced-motion
 *   - Auto-init on frontend AND inside Elementor editor
 * ============================================================ */

(function () {
    'use strict';

    function init(rootEl) {
        if (!rootEl) return;
        if (rootEl.dataset.twAnimate !== '1') return; // disabled via control
        if (!window.gsap) return;

        var ns = (window.tempaloo && window.tempaloo.avero) || {};
        var level = ns.animationLevel ? ns.animationLevel() : 'medium';
        if (level === 'off') return;
        var reduced = level === 'subtle';

        // Cache previously-set props so re-running on the same root
        // (Elementor edits, theme switches) starts from a clean slate.
        if (rootEl.__twAveroHeroTimeline) {
            rootEl.__twAveroHeroTimeline.kill();
        }

        var rating  = rootEl.querySelector('.tw-avero-hero__rating');
        var title   = rootEl.querySelector('.tw-avero-hero__title');
        var lead    = rootEl.querySelector('.tw-avero-hero__lead');
        var ctas    = rootEl.querySelectorAll('.tw-avero-hero__cta');
        var trust   = rootEl.querySelector('.tw-avero-hero__trust');
        var media   = rootEl.querySelector('.tw-avero-hero__media');
        var card    = rootEl.querySelector('.tw-avero-hero__floating-card');

        if (reduced) {
            // Simplified entrance: opacity only, fast, no transforms.
            window.gsap.fromTo(
                [rating, title, lead, ctas, trust, media, card].filter(Boolean),
                { opacity: 0 },
                { opacity: 1, duration: 0.3, stagger: 0.04, ease: 'power1.out' }
            );
            return;
        }

        // Full GSAP timeline. Stagger the content column items, cross-
        // fade the media column with a subtle scale, and pop the
        // floating card last for delight.
        var tl = window.gsap.timeline({ defaults: { ease: 'power3.out' } });

        if (rating) tl.from(rating, { opacity: 0, y: 12, duration: 0.5 }, 0);
        if (title)  tl.from(title,  { opacity: 0, y: 24, duration: 0.85 }, 0.05);
        if (lead)   tl.from(lead,   { opacity: 0, y: 16, duration: 0.6 }, 0.25);
        if (ctas && ctas.length) {
            tl.from(ctas, { opacity: 0, y: 12, duration: 0.45, stagger: 0.08 }, 0.4);
        }
        if (trust)  tl.from(trust,  { opacity: 0, y: 12, duration: 0.5 }, 0.6);

        if (media) {
            tl.from(media,
                { opacity: 0, scale: 0.96, y: 20, duration: 1.0, ease: 'power2.out' },
                0.1
            );
        }
        if (card) {
            tl.from(card,
                { opacity: 0, y: 20, scale: 0.92, duration: 0.6, ease: 'back.out(1.4)' },
                0.85
            );
        }

        rootEl.__twAveroHeroTimeline = tl;
    }

    // Expose for global.js's runOnReady chain.
    window.tempaloo = window.tempaloo || {};
    window.tempaloo.avero = window.tempaloo.avero || {};
    window.tempaloo.avero.hero = init;

    // Frontend auto-init.
    function bootFrontend() {
        document.querySelectorAll('.tw-avero-hero').forEach(function (el) {
            if (window.tempaloo.avero.runOnReady) {
                window.tempaloo.avero.runOnReady(el, init);
            } else {
                init(el);
            }
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootFrontend);
    } else {
        bootFrontend();
    }

    // Elementor editor auto-init — fires every time Elementor renders
    // or re-renders the widget in the iframe.
    if (window.elementorFrontend && window.elementorFrontend.hooks) {
        window.elementorFrontend.hooks.addAction(
            'frontend/element_ready/hero.default',
            function ($el) { init($el[0]); }
        );
    }
})();
