import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/app.css';
import './floating/floating.css';
import { App } from './App';
import { FloatingPanel } from './floating/FloatingPanel';

// The bundle is shared between two contexts:
//   1. The full admin page (wp-admin/admin.php?page=tempaloo-studio)
//      mounts at #tempaloo-studio-admin-root.
//   2. The floating color editor (frontend + Elementor preview iframe,
//      logged-in admins only) mounts at #tempaloo-studio-floating-root.
// We try both — at most one is present per page, never both.

const adminRoot = document.getElementById('tempaloo-studio-admin-root');
if (adminRoot) {
  if (!adminRoot.hasAttribute('data-tsa-theme')) adminRoot.setAttribute('data-tsa-theme', 'light');
  createRoot(adminRoot).render(<StrictMode><App /></StrictMode>);
}

const floatingRoot = document.getElementById('tempaloo-studio-floating-root');
if (floatingRoot) {
  if (!floatingRoot.hasAttribute('data-tsa-theme')) floatingRoot.setAttribute('data-tsa-theme', 'dark');
  createRoot(floatingRoot).render(<StrictMode><FloatingPanel /></StrictMode>);
}
