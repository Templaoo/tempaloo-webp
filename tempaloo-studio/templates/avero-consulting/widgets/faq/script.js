/* ============================================================
 * Avero Consulting — FAQ widget JS
 * Toggle accordion items on click. CSS owns the height transition
 * via grid-template-rows 0fr → 1fr.
 * ============================================================ */
(function () {
    'use strict';

    function init(rootEl) {
        if (!rootEl) return;
        rootEl.querySelectorAll('.tw-avero-faq__item').forEach(function (item) {
            var btn = item.querySelector('.tw-avero-faq__q');
            if (!btn || btn.__bound) return;
            btn.__bound = true;
            btn.addEventListener('click', function () {
                var open = item.classList.toggle('is-open');
                btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
        });
    }

    window.tempaloo = window.tempaloo || {};
    window.tempaloo.avero = window.tempaloo.avero || {};
    window.tempaloo.avero.faq = init;

    function boot() { document.querySelectorAll('.tw-avero-faq').forEach(init); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

    if (window.elementorFrontend && window.elementorFrontend.hooks) {
        window.elementorFrontend.hooks.addAction('frontend/element_ready/faq.default', function ($el) { init($el[0]); });
    }
})();
