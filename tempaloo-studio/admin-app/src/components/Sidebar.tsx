import type { Tab } from '../types';
import { LogoWordmark } from './Logo';
import { ThemeToggle } from './ThemeToggle';

interface NavItem {
  id:    Tab;
  label: string;
  icon:  React.ReactNode;
}

const NAV: NavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="2" width="5" height="5" rx="1" />
        <rect x="9" y="2" width="5" height="5" rx="1" />
        <rect x="2" y="9" width="5" height="5" rx="1" />
        <rect x="9" y="9" width="5" height="5" rx="1" />
      </svg>
    ),
  },
  {
    id: 'templates',
    label: 'Templates',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="2" width="12" height="4" rx="1" />
        <rect x="2" y="8" width="5" height="6" rx="1" />
        <rect x="9" y="8" width="5" height="6" rx="1" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Theme tokens',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="8" cy="8" r="2" />
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" />
      </svg>
    ),
  },
  {
    id: 'components',
    label: 'Components',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="2" width="5" height="5" rx="1" />
        <rect x="9" y="9" width="5" height="5" rx="1" />
        <path d="M5 9v5M11 2v5M2 12h4M10 4h4" />
      </svg>
    ),
  },
  // The Animation page used to live here. Step 1 of the floating-panel
  // migration moved profiles into the live editor (see ProfilePicker).
  // The wizard is no longer surfaced from the sidebar — it can be
  // reached via a deep-link if someone needs the advanced surface.
  {
    id: 'license',
    label: 'License',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5l-3-3Z" />
        <path d="M10 2v3h3" />
        <path d="M6 9h4M6 12h4" />
      </svg>
    ),
  },
];

interface Props {
  active:  Tab;
  onTab:   (id: Tab) => void;
  version: string;
}

export function Sidebar({ active, onTab, version }: Props) {
  return (
    <aside className="tsa-sidebar">
      <div className="tsa-sidebar__brand">
        <LogoWordmark size={26} />
      </div>

      <nav className="tsa-sidebar__nav">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onTab(item.id)}
            className={
              'tsa-sidebar__navlink' + (active === item.id ? ' tsa-sidebar__navlink--active' : '')
            }
          >
            <span className="tsa-sidebar__navlink-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="tsa-sidebar__footer">
        <span className="tsa-sidebar__version">v{version}</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
