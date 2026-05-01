/* ============================================================
 * Avero Consulting — FAQ widget JS
 *
 * 100% click-driven → uses tempaloo.studio.delegate() so the toggle
 * survives Elementor editor re-renders. No per-element binding.
 * ============================================================ */
(function () {
    'use strict';

    var ts = (window.tempaloo && window.tempaloo.studio) || {};
    if (!ts.delegate) return;

    ts.delegate('.tw-avero-faq__q', 'click', function (e, btn) {
        e.preventDefault();
        var item = btn.closest('.tw-avero-faq__item');
        if (!item) return;
        var open = item.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // Expose a no-op init for legacy compat with global.js's runOnReady.
    window.tempaloo = window.tempaloo || {};
    window.tempaloo.avero = window.tempaloo.avero || {};
    window.tempaloo.avero.faq = function () {};
})();
