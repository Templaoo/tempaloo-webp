import { useEffect, useRef, useState } from 'react';
import { api, type AnimationProfile } from '../api';
import { toast } from '../components/Toast';
import type { AnimationLibrary, AnimationRule, AnimationStateV2 } from './animation/types';
import { GlobalsTab } from './animation/GlobalsTab';
import { ElementsTab } from './animation/ElementsTab';
import { WidgetsTab } from './animation/WidgetsTab';
import { LibraryTab } from './animation/LibraryTab';
import { ProfilesTab } from './animation/ProfilesTab';

type TabId = 'profiles' | 'globals' | 'elements' | 'widgets' | 'library';

const TABS: Array<{ id: TabId; label: string; desc: string }> = [
  { id: 'profiles', label: 'Profiles', desc: 'Bundles 1-clic — Editorial · Cinematic · Minimal · Bold' },
  { id: 'globals',  label: 'Globals',  desc: 'Intensité · direction · reduce-motion' },
  { id: 'elements', label: 'Elements', desc: 'Règles par tag (h1, h2, p, img, button…)' },
  { id: 'widgets',  label: 'Per-widget', desc: 'Overrides par scope du template actif' },
  { id: 'library',  label: 'Library',  desc: 'Référence complète des presets GSAP' },
];

export function AnimationPage() {
  const [tab,    setTab]    = useState<TabId>('profiles');
  const [lib,    setLib]    = useState<AnimationLibrary | null>(null);
  const [state,  setState]  = useState<AnimationStateV2 | null>(null);
  const [profiles,      setProfiles]      = useState<AnimationProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState<string | null>(null);
  const debounce = useRef<Record<string, number>>({});

  // Initial load — library + v2 state + profiles in parallel.
  useEffect(() => {
    Promise.all([
      api.getAnimationLibrary(),
      api.getAnimationV2(),
      api.listProfiles(),
    ])
      .then(([l, s, ps]) => {
        setLib(l);
        setState(s);
        setProfiles(ps.profiles);
        setActiveProfile(ps.active);
      })
      .catch((e) => toast.error(`Failed to load: ${(e as Error).message}`))
      .finally(() => setLoading(false));
  }, []);

  async function refreshV2AndProfiles() {
    try {
      const [s, ps] = await Promise.all([api.getAnimationV2(), api.listProfiles()]);
      setState(s);
      setProfiles(ps.profiles);
      setActiveProfile(ps.active);
    } catch (e) {
      toast.error(`Reload failed: ${(e as Error).message}`);
    }
  }

  // ── Globals ────────────────────────────────────────────
  async function saveGlobals(patch: { intensity?: string; direction?: string; reduceMotion?: string }) {
    if (!state) return;
    setState({ ...state, globals: { ...state.globals, ...patch } as AnimationStateV2['globals'] });
    setSaving('globals');
    try {
      const updated = await api.setGlobals(patch);
      setState(updated);
      toast.info('Globals enregistrés. Rechargez vos pages pour voir l\'effet.');
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(null);
    }
  }

  // ── Element rules (auto-save with debounce) ────────────
  function saveElementRule(typeId: string, rule: AnimationRule) {
    if (!state) return;
    setState({ ...state, elementRules: { ...state.elementRules, [typeId]: rule } });

    if (debounce.current[`element:${typeId}`]) window.clearTimeout(debounce.current[`element:${typeId}`]);
    debounce.current[`element:${typeId}`] = window.setTimeout(async () => {
      setSaving(`element:${typeId}`);
      try {
        const updated = await api.setElementRule(typeId, rule);
        setState(updated);
      } catch (e) {
        toast.error(`Save failed: ${(e as Error).message}`);
      } finally {
        setSaving(null);
      }
    }, 350);
  }

  async function resetElementRule(typeId: string) {
    if (!state) return;
    setSaving(`element:${typeId}`);
    try {
      const updated = await api.resetElementRule(typeId);
      setState(updated);
      toast.info(`${typeId} réinitialisé au défaut du schéma.`);
    } catch (e) {
      toast.error(`Reset failed: ${(e as Error).message}`);
    } finally {
      setSaving(null);
    }
  }

  // ── Widget overrides (auto-save with debounce) ─────────
  function saveWidgetOverride(widget: string, rule: AnimationRule) {
    if (!state || !state.templateSlug) return;
    setState({
      ...state,
      widgetOverrides: { ...state.widgetOverrides, [widget]: rule },
    });

    if (debounce.current[`widget:${widget}`]) window.clearTimeout(debounce.current[`widget:${widget}`]);
    debounce.current[`widget:${widget}`] = window.setTimeout(async () => {
      setSaving(`widget:${widget}`);
      try {
        const updated = await api.setWidgetOverride(state.templateSlug, widget, rule);
        setState(updated);
      } catch (e) {
        toast.error(`Save failed: ${(e as Error).message}`);
      } finally {
        setSaving(null);
      }
    }, 350);
  }

  return (
    <>
      <header className="tsa-pagehead">
        <div>
          <h1 className="tsa-pagehead__title">Animation</h1>
          <p className="tsa-pagehead__subtitle">
            Modèle hiérarchique GSAP : globals → règles par type d'élément → overrides par widget.
            Couvre les widgets <code>tw-</code> ET les widgets Elementor natifs (Heading, Image, Button…).
          </p>
        </div>
      </header>

      {loading && <div className="tsa-card"><div className="tsa-skel" style={{ height: 24 }} /></div>}

      {!loading && lib && state && (
        <>
          <nav className="tsa-anim-tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={t.id === tab}
                className={'tsa-anim-tab' + (t.id === tab ? ' is-active' : '')}
                onClick={() => setTab(t.id)}
              >
                <span className="tsa-anim-tab__label">{t.label}</span>
                <span className="tsa-anim-tab__desc">{t.desc}</span>
              </button>
            ))}
          </nav>

          {tab === 'profiles' && (
            <ProfilesTab
              profiles={profiles}
              active={activeProfile}
              onApplied={refreshV2AndProfiles}
              onListChange={(next) => { setProfiles(next.profiles); setActiveProfile(next.active); }}
            />
          )}
          {tab === 'globals'  && <GlobalsTab  state={state} saving={saving === 'globals'} onChange={saveGlobals} />}
          {tab === 'elements' && <ElementsTab state={state} lib={lib} saving={saving} onSave={saveElementRule} onReset={resetElementRule} />}
          {tab === 'widgets'  && <WidgetsTab  state={state} lib={lib} saving={saving} onSave={saveWidgetOverride} />}
          {tab === 'library'  && <LibraryTab  lib={lib} />}

          <div className="tsa-card tsa-mt-4">
            <div className="tsa-card__title">Accessibilité</div>
            <div className="tsa-card__subtitle tsa-mt-3">
              Le système utilise <code>gsap.matchMedia()</code> pour respecter <code>prefers-reduced-motion</code>.
              La stratégie est configurée dans l'onglet Globals (par défaut : auto-dégrade vers fade simple).
              Aucune animation n'est forcée si l'utilisateur préfère réduire le motion.
            </div>
          </div>
        </>
      )}
    </>
  );
}
