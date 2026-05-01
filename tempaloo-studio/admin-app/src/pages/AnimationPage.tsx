import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import type { AnimationPreset, AnimationState } from '../api';
import { toast } from '../components/Toast';

const LEVELS: Array<{ id: string; label: string; desc: string }> = [
  { id: 'off',    label: 'Off',    desc: 'No motion. Static render. Fastest, most accessible.' },
  { id: 'subtle', label: 'Subtle', desc: 'Opacity-only fades. ~300ms. Reduced-motion friendly.' },
  { id: 'medium', label: 'Medium', desc: 'Designed look — translateY, stagger, scroll triggers. (Default)' },
  { id: 'bold',   label: 'Bold',   desc: 'Bigger transforms, longer durations. More dramatic entrances.' },
];

const TRIGGER_OPTIONS = [
  { id: 'top 90%',     label: 'Very early (90%)' },
  { id: 'top 85%',     label: 'Early (85%, default)' },
  { id: 'top 75%',     label: 'Standard (75%)' },
  { id: 'top 60%',     label: 'Late (60%)' },
  { id: 'center 75%',  label: 'Center (75%)' },
  { id: 'none',        label: 'On page load (no scroll)' },
];

// Pretty preset labels for the dropdown.
const PRESET_LABELS: Record<string, string> = {
  'none':                  'None',
  'fade':                  'Fade',
  'fade-up':               'Fade up',
  'fade-down':             'Fade down',
  'fade-left':             'Fade left',
  'fade-right':            'Fade right',
  'scale-in':              'Scale in',
  'blur-in':               'Blur in',
  'mask-reveal':           'Mask reveal',
  'word-fade-up':          'Word — fade up',
  'word-fade-blur':        'Word — fade blur (premium)',
  'word-slide-up-overflow':'Word — slide up (cinematic)',
  'char-up':               'Char — up (short headlines)',
  'line-fade-up-stagger':  'Line — fade up stagger',
  'text-typing':           'Typewriter',
  'text-fill-sweep':       'Color fill sweep',
  'scroll-words-fill':     'Scroll-linked words fill',
  'editorial-stack':       'Editorial stack (composite)',
};

export function AnimationPage() {
  const [state,   setState]   = useState<AnimationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingScope, setSavingScope] = useState<string | null>(null);
  const debounce = useRef<Record<string, number>>({});

  useEffect(() => {
    api.getAnimation()
      .then((d) => setState(d))
      .catch((e) => toast.error(`Failed to load: ${(e as Error).message}`))
      .finally(() => setLoading(false));
  }, []);

  async function pickIntensity(next: string) {
    if (!state || next === state.intensity) return;
    setSavingScope('__intensity');
    setState({ ...state, intensity: next });
    try {
      const updated = await api.setAnimation({ intensity: next });
      setState(updated);
      toast.info(`Animation set to "${next}". Reload pages to see the change.`);
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSavingScope(null);
    }
  }

  function patchWidget(widget: string, partial: Partial<AnimationPreset>) {
    if (!state) return;
    const nextPreset = { ...(state.presets[widget] ?? {}), ...partial };
    const nextPresets = { ...state.presets, [widget]: nextPreset };
    setState({ ...state, presets: nextPresets });

    // Debounce save so dragging a slider doesn't fire 60 requests/sec.
    if (debounce.current[widget]) window.clearTimeout(debounce.current[widget]);
    debounce.current[widget] = window.setTimeout(async () => {
      if (!state) return;
      setSavingScope(widget);
      try {
        const updated = await api.setAnimation({
          template_slug: state.template_slug,
          presets: { [widget]: nextPreset },
        });
        setState(updated);
      } catch (e) {
        toast.error(`Save failed: ${(e as Error).message}`);
      } finally {
        setSavingScope(null);
      }
    }, 350);
  }

  return (
    <>
      <header className="tsa-pagehead">
        <div>
          <h1 className="tsa-pagehead__title">Animation</h1>
          <p className="tsa-pagehead__subtitle">
            Global motion intensity for the whole site, plus per-widget preset selection.
            Changes apply to every page that contains the widget — no per-page Elementor
            tinkering required.
          </p>
        </div>
      </header>

      {loading && <div className="tsa-card"><div className="tsa-skel" style={{ height: 24 }} /></div>}

      {!loading && state && (
        <>
          <div className="tsa-anim-grid">
            {LEVELS.map((lvl) => {
              const isActive = lvl.id === state.intensity;
              return (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => pickIntensity(lvl.id)}
                  disabled={savingScope === '__intensity'}
                  className={'tsa-anim-card' + (isActive ? ' is-active' : '')}
                >
                  <span className="tsa-anim-card__demo" data-level={lvl.id}>
                    <span className="tsa-anim-card__dot" />
                    <span className="tsa-anim-card__dot" />
                    <span className="tsa-anim-card__dot" />
                  </span>
                  <span className="tsa-anim-card__label">{lvl.label}</span>
                  <span className="tsa-anim-card__desc">{lvl.desc}</span>
                  {isActive && <span className="tsa-pill tsa-pill--accent tsa-anim-card__badge"><span className="tsa-pill__dot" /> Active</span>}
                </button>
              );
            })}
          </div>

          {state.template_slug && state.widgets.length > 0 && (
            <div className="tsa-card tsa-mt-5">
              <header className="tsa-card__header">
                <div>
                  <div className="tsa-card__title">Per-widget animations</div>
                  <div className="tsa-card__subtitle">
                    Each widget in the active template can have its own entrance preset, stagger,
                    and scroll trigger. Saves automatically.
                  </div>
                </div>
              </header>

              <div className="tsa-anim-widget-list">
                {state.widgets.map((w) => (
                  <WidgetRow
                    key={w}
                    widget={w}
                    preset={state.presets[w] ?? {}}
                    grouped={state.presets_grouped}
                    saving={savingScope === w}
                    onChange={(p) => patchWidget(w, p)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="tsa-card tsa-mt-4">
            <div className="tsa-card__title">Accessibility</div>
            <div className="tsa-card__subtitle tsa-mt-3">
              The user's <code style={{ fontFamily: 'var(--tsa-font-mono)' }}>prefers-reduced-motion</code> OS
              setting always wins — when it's enabled, anything above "Subtle" is automatically
              downgraded to "Subtle". Text-reveal presets fall back to a single word-fade. We
              don't override accessibility preferences.
            </div>
          </div>
        </>
      )}
    </>
  );
}

function WidgetRow({
  widget, preset, grouped, saving, onChange,
}: {
  widget:  string;
  preset:  AnimationPreset;
  grouped: { element: string[]; text: string[] };
  saving:  boolean;
  onChange: (p: Partial<AnimationPreset>) => void;
}) {
  const entrance = preset.entrance || 'fade-up';
  const stagger  = preset.stagger  ?? 80;
  const trigger  = preset.trigger  || 'top 85%';

  // Mini live demo — animates a 3-dot row using the chosen preset's
  // visual character. Triggers when entrance changes so the user sees
  // the difference immediately. Pure CSS, no GSAP needed in admin.
  const demoKey = useMemo(() => `${entrance}-${Date.now()}`, [entrance]);

  return (
    <div className={'tsa-anim-row' + (saving ? ' is-saving' : '')}>
      <div className="tsa-anim-row__head">
        <span className="tsa-anim-row__name">{widget}</span>
        <DemoStrip preset={entrance} key={demoKey} />
        {saving && <span className="tsa-anim-row__saving">saving…</span>}
      </div>

      <div className="tsa-anim-row__controls">
        <label className="tsa-anim-row__field">
          <span className="tsa-anim-row__label">Preset</span>
          <select
            className="tsa-tk-select"
            value={entrance}
            onChange={(e) => onChange({ entrance: e.target.value })}
          >
            <optgroup label="Element entrance">
              {grouped.element.map((p) => (
                <option key={p} value={p}>{PRESET_LABELS[p] || p}</option>
              ))}
            </optgroup>
            <optgroup label="Text reveal (Phase 2.1)">
              {grouped.text.map((p) => (
                <option key={p} value={p}>{PRESET_LABELS[p] || p}</option>
              ))}
            </optgroup>
          </select>
        </label>

        <label className="tsa-anim-row__field">
          <span className="tsa-anim-row__label">Stagger</span>
          <div className="tsa-anim-row__slider">
            <input
              type="range"
              min={0}
              max={300}
              step={10}
              value={stagger}
              onChange={(e) => onChange({ stagger: parseInt(e.target.value, 10) })}
            />
            <span className="tsa-anim-row__num">{stagger}ms</span>
          </div>
        </label>

        <label className="tsa-anim-row__field">
          <span className="tsa-anim-row__label">Scroll trigger</span>
          <select
            className="tsa-tk-select"
            value={trigger}
            onChange={(e) => onChange({ trigger: e.target.value })}
          >
            {TRIGGER_OPTIONS.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

/**
 * Mini CSS-only demo strip — 3 dots animated to reflect the preset's
 * visual character without loading GSAP in the admin. The animation
 * replays whenever `key` changes (we re-key on preset switch).
 */
function DemoStrip({ preset }: { preset: string }) {
  // Map presets to a CSS animation name. Approximations — good enough
  // to show the user "this preset feels like X".
  const animClass = useMemo(() => {
    if (preset.startsWith('word-') || preset === 'editorial-stack') return 'tsa-demo-anim--word';
    if (preset.startsWith('char-') || preset === 'text-typing')      return 'tsa-demo-anim--char';
    if (preset === 'fade-up' || preset === 'fade-down')              return 'tsa-demo-anim--up';
    if (preset === 'scale-in')                                       return 'tsa-demo-anim--scale';
    if (preset === 'blur-in' || preset === 'word-fade-blur')         return 'tsa-demo-anim--blur';
    if (preset === 'mask-reveal' || preset === 'text-fill-sweep')    return 'tsa-demo-anim--mask';
    if (preset === 'fade-left')                                      return 'tsa-demo-anim--left';
    if (preset === 'fade-right')                                     return 'tsa-demo-anim--right';
    if (preset === 'none')                                           return 'tsa-demo-anim--none';
    return 'tsa-demo-anim--fade';
  }, [preset]);

  return (
    <span className={'tsa-demo-strip ' + animClass}>
      <span /><span /><span />
    </span>
  );
}
