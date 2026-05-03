import { useEffect, useRef, useState } from 'react';
import { api, type AnimationProfile } from '../api';
import { toast } from '../components/Toast';
import type { AnimationLibrary, AnimationRule, AnimationStateV2 } from '../api';
import { StepStyle } from './animation/StepStyle';
import { StepTune } from './animation/StepTune';
import { StepAdvanced } from './animation/StepAdvanced';

type Step = 'style' | 'tune' | 'advanced';

/**
 * Animation admin — linear 3-step wizard.
 *
 * Workflow (one screen, one decision — ux-flow + onboarding-cro skills):
 *   1. Style     pick a Profile (Editorial / Cinematic / Minimal / Bold)
 *                or "Start custom" to skip presets.
 *   2. Tune      adjust intensity / direction / reduce-motion. Live preview.
 *   3. Advanced  optional per-element / per-widget overrides with full
 *                disabled-state logic (mutually-exclusive controls).
 *
 * The hierarchy on the runtime side stays the same:
 *   profile → globals → element rules → widget overrides
 * (more specific wins over less specific). The wizard simply guides the
 * user through the same surface in a linear order instead of parallel tabs.
 */
export function AnimationPage() {
  const [step,    setStep]    = useState<Step>('style');
  const [lib,     setLib]     = useState<AnimationLibrary | null>(null);
  const [state,   setState]   = useState<AnimationStateV2 | null>(null);
  const [profiles,      setProfiles]      = useState<AnimationProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState<string | null>(null);
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

  // ── Step 1 — pick / apply a profile ────────────────────
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

  // ── Step 2 — globals (live update) ─────────────────────
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

  // ── Step 3 — element rules (debounced auto-save) ───────
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

  // ── Step 3 — widget overrides (debounced auto-save) ────
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
    <>
      <header className="tsa-pagehead">
        <div>
          <h1 className="tsa-pagehead__title">Animation</h1>
          <p className="tsa-pagehead__subtitle">
            Three steps: pick a style, tune the feel, fine-tune if needed. Covers your <code>tw-</code>
            widgets and Elementor native widgets (Heading, Image, Button…).
          </p>
        </div>
      </header>

      {loading && <div className="tsa-card"><div className="tsa-skel" style={{ height: 24 }} /></div>}

      {!loading && lib && state && (
        <>
          <Stepper step={step} onJump={setStep} />

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
              onContinue={() => toast.info('Saved. Reload your pages to see the change.')}
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

          <div className="tsa-card tsa-mt-4">
            <div className="tsa-card__title">Accessibility</div>
            <div className="tsa-card__subtitle tsa-mt-3">
              The runtime uses <code>gsap.matchMedia()</code> to honour <code>prefers-reduced-motion</code>.
              Strategy is set in step 2 (default: auto-downgrade to plain fade). No animation is forced
              when the user opts out.
            </div>
          </div>
        </>
      )}
    </>
  );
}

/** Linear stepper at the top — clickable to jump back. */
function Stepper({ step, onJump }: { step: Step; onJump: (s: Step) => void }) {
  const steps: Array<{ id: Step; label: string }> = [
    { id: 'style',    label: 'Style' },
    { id: 'tune',     label: 'Tune' },
    { id: 'advanced', label: 'Advanced' },
  ];
  return (
    <nav className="tsa-wizard-stepper" aria-label="Wizard progress">
      {steps.map((s, i) => {
        const isActive = s.id === step;
        const isPast   = steps.findIndex((x) => x.id === step) > i;
        return (
          <button
            key={s.id}
            type="button"
            className={'tsa-wizard-stepper__step' + (isActive ? ' is-active' : '') + (isPast ? ' is-past' : '')}
            onClick={() => onJump(s.id)}
          >
            <span className="tsa-wizard-stepper__num">{i + 1}</span>
            <span className="tsa-wizard-stepper__label">{s.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
