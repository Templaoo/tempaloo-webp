/* ============================================================
 * Avero Consulting — Services widget JS
 * Stagger entrance via GSAP ScrollTrigger. Falls back to a one-shot
 * fade-in if ScrollTrigger isn't registered.
 * ============================================================ */
(function () {
    'use strict';

    function init(rootEl) {
        if (!rootEl) return;
        var ns    = (window.tempaloo && window.tempaloo.avero) || {};
        var level = ns.animationLevel ? ns.animationLevel() : 'medium';
        if (level === 'off' || !window.gsap) return;

        if (rootEl.__twAveroServicesST) {
            rootEl.__twAveroServicesST.kill();
            rootEl.__twAveroServicesST = null;
        }

        var cards = rootEl.querySelectorAll('.tw-avero-services__card');
        var intro = rootEl.querySelector('.tw-avero-services__intro');

        if (level === 'subtle') {
            window.gsap.fromTo([intro, cards].filter(Boolean), { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.04, clearProps: 'opacity' });
            return;
        }

        // Bold = larger Y translate + longer stagger; Medium = designed default.
        var yIntro = level === 'bold' ? 40 : 24;
        var yCards = level === 'bold' ? 48 : 32;
        var stagger = level === 'bold' ? 0.18 : 0.12;
        var duration = level === 'bold' ? 1.0 : 0.85;

        var hasST = !!window.ScrollTrigger;
        var common = { ease: 'power3.out', duration: duration, clearProps: 'opacity,transform' };

        if (intro) {
            window.gsap.from(intro, Object.assign({ y: yIntro, opacity: 0 }, common,
                hasST ? { scrollTrigger: { trigger: intro, start: 'top 85%', once: true } } : {}
            ));
        }

        var tween = window.gsap.from(cards, Object.assign(
            { y: yCards, opacity: 0, stagger: stagger, duration: duration * 0.85, ease: 'power3.out', clearProps: 'opacity,transform' },
            hasST ? { scrollTrigger: { trigger: rootEl, start: 'top 75%', once: true } } : { delay: 0.15 }
        ));
        rootEl.__twAveroServicesST = tween;
    }

    window.tempaloo = window.tempaloo || {};
    window.tempaloo.avero = window.tempaloo.avero || {};
    window.tempaloo.avero.services = init;

    function boot() { document.querySelectorAll('.tw-avero-services').forEach(function (el) { init(el); }); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

    if (window.elementorFrontend && window.elementorFrontend.hooks) {
        window.elementorFrontend.hooks.addAction('frontend/element_ready/services.default', function ($el) { init($el[0]); });
    }
})();
