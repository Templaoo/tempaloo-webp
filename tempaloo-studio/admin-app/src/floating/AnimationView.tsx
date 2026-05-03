import { useEffect, useRef, useState } from 'react';
import { api, type AnimationProfile } from '../api';
import { toast } from '../components/Toast';
import type { AnimationLibrary, AnimationRule, AnimationStateV2 } from '../api';
import { StepStyle } from '../pages/animation/StepStyle';
import { StepTune } from '../pages/animation/StepTune';
import { StepAdvanced } from '../pages/animation/StepAdvanced';
import { StepSite } from '../pages/animation/StepSite';
import { AnimatedElementsList } from './AnimatedElementsList';

type Step = 'style' | 'tune' | 'advanced' | 'site';

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'style',    label: 'Style' },
  { id: 'tune',     label: 'Tune' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'site',     label: 'Site' },
];

/**
 * AnimationView — full Wizard hosted INSIDE the floating panel.
 * Step 1.5 of the migration: the Wizard moves out of the React admin
 * sidebar and lives next to the user's actual work surface (the live
 * page). Same 3-step flow as before:
 *
 *   1. Style     — pick a Profile
 *   2. Tune      — global intensity / direction / reduce-motion
 *   3. Advanced  — per-element-type / per-widget overrides
 *
 * The same load + save handlers as the old AnimationPage so behaviour
 * is identical; only the host changes.
 */
export function AnimationView() {
  const [step, setStep] = useState<Step>('style');
  const [lib, setLib]   = useState<AnimationLibrary | null>(null);
  const [state, setState] = useState<AnimationStateV2 | null>(null);
  const [profiles, setProfiles] = useState<AnimationProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState<string | null>(null);
  const debounce = useRef<Record<string, number>>({});

  useEffect(() => {
    Promise.all([api.getAnimationLibrary(), api.getAnimationV2(), api.listProfiles()])
      .then(([l, s, ps]) => {
        setLib(l);
        setState(s);
        setProfiles(ps.profiles);
        setActiveProfile(ps.active);
      })
      .catch((e) => toast.error(`Failed to load: ${(e as Error).message}`))
      .finally(() => setLoading(false));
  }, []);

  async function refreshState() {
    try {
      const [s, ps] = await Promise.all([api.getAnimationV2(), api.listProfiles()]);
      setState(s);
      setProfiles(ps.profiles);
      setActiveProfile(ps.active);
    } catch (e) {
      toast.error(`Reload failed: ${(e as Error).message}`);
    }
  }

  async function applyProfile(id: string) {
    setSaving('profile');
    try {
      await api.applyProfile(id);
      await refreshState();
      toast.info(`Applied "${id}". Reload pages to see the change.`);
    } catch (e) {
      toast.error(`Apply failed: ${(e as Error).message}`);
    } finally {
      setSaving(null);
    }
  }

  async function saveGlobals(patch: { intensity?: string; direction?: string; reduceMotion?: string }) {
    if (!state) return;
    setState({ ...state, globals: { ...state.globals, ...patch } });
    setSaving('globals');
    try {
      const updated = await api.setGlobals(patch);
      setState(updated);
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(null);
    }
  }

  function saveElementRule(typeId: string, rule: AnimationRule) {
    if (!state) return;
    setState({ ...state, elementRules: { ...state.elementRules, [typeId]: rule } });
    const key = `element:${typeId}`;
    if (debounce.current[key]) window.clearTimeout(debounce.current[key]);
    debounce.current[key] = window.setTimeout(async () => {
      setSaving(key);
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
      toast.info(`${typeId} reset to schema default.`);
    } catch (e) {
      toast.error(`Reset failed: ${(e as Error).message}`);
    } finally {
      setSaving(null);
    }
  }

  function saveWidgetOverride(widget: string, rule: AnimationRule) {
    if (!state || !state.templateSlug) return;
    setState({
      ...state,
      widgetOverrides: { ...state.widgetOverrides, [widget]: rule },
    });
    const key = `widget:${widget}`;
    if (debounce.current[key]) window.clearTimeout(debounce.current[key]);
    debounce.current[key] = window.setTimeout(async () => {
      setSaving(key);
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
    <div className="tsa-fp-anim">
      {loading && (
        <div className="tsa-fp-anim__loading">Loading animation library…</div>
      )}

      {!loading && lib && state && (
        <>
          <AnimatedElementsList state={state} lib={lib} onChange={refreshState} />

          <nav className="tsa-fp-anim__steps" role="tablist">
            {STEPS.map((s, i) => {
              const isActive = s.id === step;
              const isPast   = STEPS.findIndex((x) => x.id === step) > i;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={
                    'tsa-fp-anim__step' +
                    (isActive ? ' is-active' : '') +
                    (isPast   ? ' is-past'   : '')
                  }
                  onClick={() => setStep(s.id)}
                >
                  <span className="tsa-fp-anim__stepnum">{i + 1}</span>
                  <span className="tsa-fp-anim__steplabel">{s.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="tsa-fp-anim__body">
            {step === 'style' && (
              <StepStyle
                profiles={profiles}
                active={activeProfile}
                onPick={applyProfile}
                onCustom={() => setStep('tune')}
                onContinue={() => setStep('tune')}
              />
            )}
            {step === 'tune' && (
              <StepTune
                state={state}
                lib={lib}
                profileId={activeProfile}
                onChange={saveGlobals}
                onContinue={() => toast.info('Saved. Reload pages to see the change.')}
                onBack={() => setStep('style')}
                onAdvanced={() => setStep('advanced')}
              />
            )}
            {step === 'advanced' && (
              <StepAdvanced
                state={state}
                lib={lib}
                saving={saving}
                onSaveElement={saveElementRule}
                onResetElement={resetElementRule}
                onSaveWidget={saveWidgetOverride}
                onBack={() => setStep('tune')}
                onDone={() => toast.info('Advanced overrides saved.')}
              />
            )}
            {step === 'site' && (
              <StepSite
                state={state}
                onChange={setState}
                onBack={() => setStep('advanced')}
                onDone={() => toast.info('Site settings saved.')}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
