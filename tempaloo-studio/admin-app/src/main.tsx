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

  // Inherit useful CSS custom properties from :root so widget tokens
  // are still readable inside the panel (font stacks, colors, etc.).
  // Custom properties cross shadow boundaries by default — this
  // explicit anchor element guarantees a consistent inherit baseline.
  const themeAnchor = document.createElement('div');
  themeAnchor.setAttribute('data-tsa-theme', host.getAttribute('data-tsa-theme') || 'dark');
  themeAnchor.style.cssText = 'all:initial;display:contents';
  shadow.appendChild(themeAnchor);

  // Mount React inside the anchor.
  const reactRoot = document.createElement('div');
  reactRoot.id = 'tempaloo-studio-floating-shadow-root';
  themeAnchor.appendChild(reactRoot);

  createRoot(reactRoot).render(<StrictMode><FloatingPanel /></StrictMode>);
}
