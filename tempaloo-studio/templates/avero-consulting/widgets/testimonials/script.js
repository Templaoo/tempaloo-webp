/* ============================================================
 * Avero Consulting — Testimonials widget JS
 *
 * - Click delegation on dots (survives editor re-renders).
 * - onReady() for the per-instance rotator + auto-cycle timer.
 * ============================================================ */
(function () {
    'use strict';

    var ts = (window.tempaloo && window.tempaloo.studio) || {};
    if (!ts.delegate || !ts.onReady) return;

    /* Click handler — works on the live page and inside the editor
     * preview iframe regardless of when the widget mounts. */
    ts.delegate('.tw-avero-testimonials__dot', 'click', function (e, dot) {
        e.preventDefault();
        var rootEl = dot.closest('.tw-avero-testimonials');
        if (!rootEl || !rootEl.__twAveroTSShow) return;
        rootEl.__twAveroTSShow(parseInt(dot.getAttribute('data-tw-target') || '0', 10));
    });

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

        // Defensive: ensure exactly one is-active at boot.
        for (var i = 0; i < quotes.length; i++) {
            quotes[i].classList.toggle('is-active', i === 0);
            if (dots[i]) dots[i].classList.toggle('is-active', i === 0);
        }

        function show(target) {
            target = ((target % quotes.length) + quotes.length) % quotes.length;
            if (target === idx) return;

            // Strip any inline opacity/transform GSAP left on the outgoing quote.
            if (window.gsap) window.gsap.set(quotes[idx], { clearProps: 'opacity,transform' });
            else { quotes[idx].style.opacity = ''; quotes[idx].style.transform = ''; }

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
            restartTimer();
        }

        // Expose for the delegated dot click handler above.
        rootEl.__twAveroTSShow = show;

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

        // Entrance is now handled by the central animation runtime via
        // `data-tw-anim-scope="testimonials"` on the root + the preset
        // declared in template.json::animations.presets.testimonials.
    }

    window.tempaloo = window.tempaloo || {};
    window.tempaloo.avero = window.tempaloo.avero || {};
    window.tempaloo.avero.testimonials = init;

    ts.onReady('.tw-avero-testimonials', init);
})();
