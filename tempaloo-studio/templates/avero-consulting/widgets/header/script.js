/* ============================================================
 * Avero Consulting — Header widget JS
 *
 * Uses tempaloo.studio.delegate() for clicks and onReady() for
 * per-instance setup. The delegate pattern survives Elementor's
 * editor re-renders + click swallowers (see WIDGET-SPEC §14).
 * ============================================================ */
(function () {
    'use strict';

    var ts = (window.tempaloo && window.tempaloo.studio) || {};
    if (!ts.delegate) {
        // Runtime didn't load — emit a console hint and return. This
        // shouldn't happen because Frontend\Assets registers the
        // runtime as a dep of every per-widget script.
        if (window.console) console.warn('[tw-avero-header] tempaloo.studio.delegate missing — runtime not loaded');
        return;
    }

    var THEME_KEY = 'tempaloo-studio-theme';

    function inlineToggleTheme() {
        var html = document.documentElement;
        var current = html.getAttribute('data-theme') || 'light';
        var next = current === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
        try { document.dispatchEvent(new CustomEvent('tempaloo:theme', { detail: { mode: next } })); } catch (e) {}
    }

    /* ── Delegated clicks ───────────────────────────────────── */

    // Theme toggle — works whether global.js's namespace is hydrated.
    ts.delegate('.tw-avero-header__theme-toggle', 'click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var ns = (window.tempaloo && window.tempaloo.avero) || {};
        if (typeof ns.toggleTheme === 'function') ns.toggleTheme();
        else inlineToggleTheme();
    });

    // Hamburger → opens off-canvas drawer.
    ts.delegate('.tw-avero-header__menu-btn', 'click', function (e, btn) {
        e.preventDefault();
        e.stopPropagation();
        var header = btn.closest('.tw-avero-header');
        if (!header) return;
        header.classList.add('tw-avero-header--open');
        document.documentElement.style.setProperty('overflow', 'hidden'); // lock body scroll
    });

    // Close button inside drawer.
    ts.delegate('.tw-avero-header__close', 'click', function (e, btn) {
        e.preventDefault();
        e.stopPropagation();
        closeDrawer(btn.closest('.tw-avero-header'));
    });

    // Backdrop click → close.
    ts.delegate('.tw-avero-header__backdrop', 'click', function (e, el) {
        e.preventDefault();
        e.stopPropagation();
        closeDrawer(el.closest('.tw-avero-header'));
    });

    // Click on a nav link inside drawer → close after navigation starts.
    ts.delegate('.tw-avero-header--open .tw-avero-header__navlink', 'click', function (_e, link) {
        var header = link.closest('.tw-avero-header');
        // Don't preventDefault — let the link navigate. Just animate close.
        setTimeout(function () { closeDrawer(header); }, 80);
    });

    // ESC key closes the drawer.
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' && e.keyCode !== 27) return;
        document.querySelectorAll('.tw-avero-header--open').forEach(closeDrawer);
    });

    function closeDrawer(header) {
        if (!header) return;
        header.classList.remove('tw-avero-header--open');
        document.documentElement.style.removeProperty('overflow');
    }

    /* ── Per-instance setup: sticky-section + scroll listener ── */

    ts.onReady('.tw-avero-header', function (rootEl) {
        // Climb to the nearest .elementor-section and tag it for sticky
        // (the widget's own positioning context is too small).
        var section = rootEl.closest('.elementor-section, .elementor-top-section');
        if (section) {
            section.classList.add('tempaloo-studio-sticky-section');
            rootEl.__twAveroSection = section;
        }

        if (rootEl.__twAveroHeaderScroll) {
            window.removeEventListener('scroll', rootEl.__twAveroHeaderScroll);
        }
        var onScroll = function () {
            var scrolled = window.scrollY > 40;
            rootEl.classList.toggle('tw-avero-header--scrolled', scrolled);
            if (rootEl.__twAveroSection) {
                rootEl.__twAveroSection.classList.toggle('is-scrolled', scrolled);
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        rootEl.__twAveroHeaderScroll = onScroll;
        onScroll();
    });
})();
