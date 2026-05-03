import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/app.css';
import './floating/floating.css';
import { App } from './App';
import { FloatingPanel } from './floating/FloatingPanel';

// The bundle is shared between two contexts:
//   1. The full admin page (wp-admin/admin.php?page=tempaloo-studio)
//      mounts at #tempaloo-studio-admin-root — DIRECT mount, no
//      shadow DOM (the wp-admin chrome already isolates it).
//   2. The floating panel (frontend, logged-in admins only) mounts at
//      #tempaloo-studio-floating-root — inside a SHADOW DOM so the
//      active WordPress theme (Hello Elementor / Astra / etc.) cannot
//      bleed `body strong { color: pink }` rules into our card titles.
//      All admin.css is injected as <link> INSIDE the shadow root so
//      its scope is enforced by the browser, not by CSS specificity.

const adminRoot = document.getElementById('tempaloo-studio-admin-root');
if (adminRoot) {
  if (!adminRoot.hasAttribute('data-tsa-theme')) adminRoot.setAttribute('data-tsa-theme', 'light');
  createRoot(adminRoot).render(<StrictMode><App /></StrictMode>);
}

const floatingRoot = document.getElementById('tempaloo-studio-floating-root');
if (floatingRoot) {
  if (!floatingRoot.hasAttribute('data-tsa-theme')) floatingRoot.setAttribute('data-tsa-theme', 'dark');
  mountFloatingInShadow(floatingRoot);
}

/**
 * Mount the floating panel inside a Shadow DOM so the host page's
 * theme CSS is unable to reach our React tree. Same model Motion.page
 * uses (their builder runs in an iframe — equivalent isolation, less
 * runtime cost here because shadow DOM ships natively in every
 * modern browser).
 *
 * Steps:
 *   1. Build a shadow root on the panel's host div.
 *   2. Inject <link rel="stylesheet"> with the admin.css URL passed
 *      from PHP via window.TempalooStudioBoot.cssUrl.
 *   3. Mount React on a child div inside the shadow root.
 *
 * The host div keeps its data-tsa-theme + id attributes so external
 * code (Cursor.js's isExcluded check, Animate Mode's isPanel filter)
 * can still detect it via document.querySelector('#tempaloo-studio-
 * floating-root').
 */
function mountFloatingInShadow(host: HTMLElement) {
  // Resilience — re-mount support: if a shadow already exists, reuse.
  let shadow: ShadowRoot;
  // attachShadow throws if already attached; check first.
  // Cast through unknown to read the optional shadowRoot property.
  const existing = (host as HTMLElement & { shadowRoot?: ShadowRoot }).shadowRoot;
  if (existing) {
    shadow = existing;
  } else {
    shadow = host.attachShadow({ mode: 'open' });
  }

  // CSS — pulled from the URL the PHP layer passes us.
  const boot = (window as unknown as { TempalooStudioBoot?: { cssUrl?: string } }).TempalooStudioBoot;
  const cssUrl = boot?.cssUrl || '';
  if (cssUrl) {
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = cssUrl;
    shadow.appendChild(link);
  }

  // Mount React on a container with the SAME id as the host. IDs don't
  // clash across shadow boundaries, and reusing the id means every
  // existing rule `#tempaloo-studio-floating-root .tsa-fp ...` in
  // floating.css matches both the document-level (admin page) and
  // shadow-level (frontend panel) mounts. No CSS rewrite needed.
  //
  // CRITICAL — do NOT use `all: initial` on this container. That
  // resets EVERY property including the inheritance of CSS custom
  // properties (--tsa-text, --tsa-accent etc.), so var() lookups
  // would resolve to their initial values (`color: canvastext` =
  // black on dark = invisible titles, the bug the user reported).
  // Custom-property inheritance crosses shadow boundaries naturally.
  const reactRoot = document.createElement('div');
  reactRoot.id = 'tempaloo-studio-floating-root';
  reactRoot.setAttribute('data-tsa-theme', host.getAttribute('data-tsa-theme') || 'dark');
  shadow.appendChild(reactRoot);

  createRoot(reactRoot).render(<StrictMode><FloatingPanel /></StrictMode>);
}
