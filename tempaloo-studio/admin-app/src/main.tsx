import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/app.css';
import { App } from './App';

const el = document.getElementById('tempaloo-studio-admin-root');
if (el) {
  // Default theme attribute so tokens.css resolves before the React
  // tree mounts and useTheme() syncs.
  if (!el.hasAttribute('data-tsa-theme')) el.setAttribute('data-tsa-theme', 'light');
  createRoot(el).render(<StrictMode><App /></StrictMode>);
}
