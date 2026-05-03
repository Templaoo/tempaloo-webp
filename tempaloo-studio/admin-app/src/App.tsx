import { useEffect, useState } from 'react';
import { useTheme } from './hooks/useTheme';
import { Sidebar } from './components/Sidebar';
import { ToastHost, toast } from './components/Toast';
import { OverviewPage } from './pages/OverviewPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { SettingsPage } from './pages/SettingsPage';
import { ComponentsPage } from './pages/ComponentsPage';
import { LicensePage } from './pages/LicensePage';
import type { AppState, Tab, TemplateSummary } from './types';
import { api } from './api';

const VERSION = '0.1.0';

export function App() {
  // Mount the theme hook so the data-tsa-theme attribute lands on
  // the root element. We don't need its return value here — the
  // ThemeToggle in the sidebar consumes it.
  useTheme();

  const [tab, setTab]         = useState<Tab>('overview');
  const [state, setState]     = useState<AppState | null>(null);
  const [templates, setTpls]  = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.state(), api.listTemplates()])
      .then(([s, tl]) => {
        if (cancelled) return;
        setState(s);
        setTpls(tl.templates);
      })
      .catch((e) => {
        if (cancelled) return;
        toast.error(`Boot failed: ${(e as Error).message}`);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="tsa-app">
      <Sidebar active={tab} onTab={setTab} version={VERSION} />

      <main className="tsa-main">
        {tab === 'overview'   && <OverviewPage state={state} templates={templates} onGoTemplates={() => setTab('templates')} />}
        {tab === 'templates'  && <TemplatesPage state={state} templates={templates} loading={loading} onStateUpdate={setState} />}
        {tab === 'settings'   && <SettingsPage state={state} onStateUpdate={setState} />}
        {tab === 'components' && <ComponentsPage state={state} onStateUpdate={setState} />}
        {/* Animation moved to the floating panel (step 1.5). */}
        {tab === 'license'    && <LicensePage />}
      </main>

      <ToastHost />
    </div>
  );
}
