/* ============================================================
 * Avero Consulting — Testimonials widget JS
 * Synchronous class swap (only one .is-active at a time → no
 * layout doubling) + optional GSAP fade-in on the new active.
 * Auto-cycles every N seconds (data-tw-autoplay), pauses on hover.
 * Idempotent: re-running clears prior timer + bindings.
 * ============================================================ */
(function () {
    'use strict';

    function init(rootEl) {
        if (!rootEl) return;
        if (rootEl.__twAveroTSTimer) { clearInterval(rootEl.__twAveroTSTimer); rootEl.__twAveroTSTimer = null; }

        var quotes = rootEl.querySelectorAll('.tw-avero-testimonials__quote');
        var dots   = rootEl.querySelectorAll('.tw-avero-testimonials__dot');
        if (!quotes.length) return;

        var ns      = (window.tempaloo && window.tempaloo.avero) || {};
        var level   = ns.animationLevel ? ns.animationLevel() : 'medium';
        var reduced = level === 'subtle' || level === 'off';
        var idx     = 0;

        // Make sure exactly one is-active at boot — defensive for
        // re-init in editor where state can be stale.
        for (var i = 0; i < quotes.length; i++) {
            quotes[i].classList.toggle('is-active', i === 0);
            if (dots[i]) dots[i].classList.toggle('is-active', i === 0);
        }

        function show(target) {
            target = ((target % quotes.length) + quotes.length) % quotes.length;
            if (target === idx) return;

            // Strip any inline opacity/transform GSAP left on the
            // outgoing quote — without this the inline `opacity: 1`
            // wins against the CSS rule for non-active quotes and
            // the slide remains visible behind the new one.
            if (window.gsap) window.gsap.set(quotes[idx], { clearProps: 'opacity,transform' });
            else { quotes[idx].style.opacity = ''; quotes[idx].style.transform = ''; }

            // Synchronous swap — at no point are two quotes both active.
            quotes[idx].classList.remove('is-active');
            quotes[target].classList.add('is-active');
            dots.forEach(function (d, i) { d.classList.toggle('is-active', i === target); });

            if (window.gsap && !reduced) {
                window.gsap.fromTo(
                    quotes[target],
                    { opacity: 0, y: 8 },
                    { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', clearProps: 'transform' }
                );
            }
            idx = target;
        }

        // Bind dots once.
        dots.forEach(function (d) {
            if (d.__bound) return;
            d.__bound = true;
            d.addEventListener('click', function () {
                show(parseInt(d.getAttribute('data-tw-target') || '0', 10));
                restartTimer();
            });
        });

        // Auto-rotate.
        var seconds = parseInt(rootEl.getAttribute('data-tw-autoplay') || '0', 10);
        function startTimer() {
            if (!seconds || quotes.length < 2 || reduced) return;
            rootEl.__twAveroTSTimer = setInterval(function () { show(idx + 1); }, seconds * 1000);
        }
        function restartTimer() {
            if (rootEl.__twAveroTSTimer) clearInterval(rootEl.__twAveroTSTimer);
            startTimer();
        }
        if (!rootEl.__twAveroTSHover) {
            rootEl.__twAveroTSHover = true;
            rootEl.addEventListener('mouseenter', function () {
                if (rootEl.__twAveroTSTimer) { clearInterval(rootEl.__twAveroTSTimer); rootEl.__twAveroTSTimer = null; }
            });
            rootEl.addEventListener('mouseleave', startTimer);
        }
        startTimer();

        // Entrance for the initially-active quote. clearProps so the
        // inline `opacity:1` GSAP leaves doesn't fight the CSS rule
        // when this quote later loses .is-active.
        if (window.gsap && !reduced) {
            window.gsap.from(quotes[0], {
                opacity: 0, y: 16, duration: 0.7, ease: 'power3.out', clearProps: 'opacity,transform',
                scrollTrigger: window.ScrollTrigger ? { trigger: rootEl, start: 'top 80%', once: true } : undefined,
            });
        }
    }

    window.tempaloo = window.tempaloo || {};
    window.tempaloo.avero = window.tempaloo.avero || {};
    window.tempaloo.avero.testimonials = init;

    function boot() { document.querySelectorAll('.tw-avero-testimonials').forEach(init); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

    if (window.elementorFrontend && window.elementorFrontend.hooks) {
        window.elementorFrontend.hooks.addAction('frontend/element_ready/testimonials.default', function ($el) { init($el[0]); });
    }
})();
