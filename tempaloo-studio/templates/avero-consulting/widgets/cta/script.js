/* ============================================================
 * Avero Consulting — CTA widget JS
 * Title scale-up + halo drift on viewport entry.
 * ============================================================ */
(function () {
    'use strict';

    function init(rootEl) {
        if (!rootEl) return;
        var ns    = (window.tempaloo && window.tempaloo.avero) || {};
        var level = ns.animationLevel ? ns.animationLevel() : 'medium';
        if (level === 'off' || !window.gsap) return;

        var title = rootEl.querySelector('.tw-avero-cta__title');
        var lead  = rootEl.querySelector('.tw-avero-cta__lead');
        var halo  = rootEl.querySelector('.tw-avero-cta__halo');
        var ctas  = rootEl.querySelectorAll('.tw-avero-cta__btn');

        var trigger = window.ScrollTrigger ? { trigger: rootEl, start: 'top 80%', once: true } : undefined;

        if (level === 'subtle') {
            window.gsap.fromTo([title, lead, ctas].filter(Boolean), { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.04, clearProps: 'opacity' });
            return;
        }

        var k = level === 'bold' ? 1.4 : 1; // bold = bigger transforms
        if (title) window.gsap.from(title, { y: 28 * k, opacity: 0, duration: 0.9, ease: 'power3.out', clearProps: 'opacity,transform', scrollTrigger: trigger });
        if (lead)  window.gsap.from(lead,  { y: 18 * k, opacity: 0, duration: 0.7, ease: 'power3.out', delay: 0.15, clearProps: 'opacity,transform', scrollTrigger: trigger });
        if (ctas && ctas.length) window.gsap.from(ctas, { y: 12 * k, opacity: 0, duration: 0.55, stagger: 0.08, ease: 'power3.out', delay: 0.3, clearProps: 'opacity,transform', scrollTrigger: trigger });
        if (halo) {
            window.gsap.fromTo(halo, { scale: 0.9, opacity: 0 }, { scale: 1.05, opacity: 0.7, duration: 1.4, ease: 'power2.out', scrollTrigger: trigger });
        }
    }

    window.tempaloo = window.tempaloo || {};
    window.tempaloo.avero = window.tempaloo.avero || {};
    window.tempaloo.avero.cta = init;

    function boot() { document.querySelectorAll('.tw-avero-cta').forEach(init); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

    if (window.elementorFrontend && window.elementorFrontend.hooks) {
        window.elementorFrontend.hooks.addAction('frontend/element_ready/cta.default', function ($el) { init($el[0]); });
    }
})();
