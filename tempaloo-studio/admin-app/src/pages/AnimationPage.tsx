import { useEffect, useState } from 'react';
import { api } from '../api';
import { toast } from '../components/Toast';

const LEVELS: Array<{ id: string; label: string; desc: string }> = [
  { id: 'off',    label: 'Off',    desc: 'No motion. Static render. Fastest, most accessible.' },
  { id: 'subtle', label: 'Subtle', desc: 'Opacity-only fades. ~300ms. Reduced-motion friendly.' },
  { id: 'medium', label: 'Medium', desc: 'Designed look — translateY, stagger, scroll triggers. (Default)' },
  { id: 'bold',   label: 'Bold',   desc: 'Bigger transforms, longer durations. More dramatic entrances.' },
];

export function AnimationPage() {
  const [intensity, setIntensity] = useState<string>('medium');
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    api.getAnimation()
      .then((r) => setIntensity(r.intensity))
      .catch((e) => toast.error(`Failed to load: ${(e as Error).message}`))
      .finally(() => setLoading(false));
  }, []);

  async function pick(next: string) {
    if (next === intensity) return;
    setSaving(true);
    setIntensity(next);
    try {
      await api.setAnimation(next);
      toast.info(`Animation set to "${next}". Reload your pages to see the change.`);
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="tsa-pagehead">
        <div>
          <h1 className="tsa-pagehead__title">Animation</h1>
          <p className="tsa-pagehead__subtitle">
            Set the global motion intensity. All widgets read this and adapt — no per-widget
            customization in this version. Future updates will add per-widget overrides and a
            timeline editor for power users.
          </p>
        </div>
      </header>

      {loading ? (
        <div className="tsa-card"><div className="tsa-skel" style={{ height: 24 }} /></div>
      ) : (
        <>
          <div className="tsa-anim-grid">
            {LEVELS.map((lvl) => {
              const isActive = lvl.id === intensity;
              return (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => pick(lvl.id)}
                  disabled={saving}
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

          <div className="tsa-card tsa-mt-5">
            <div className="tsa-card__title">Accessibility</div>
            <div className="tsa-card__subtitle tsa-mt-3">
              The user's <code style={{ fontFamily: 'var(--tsa-font-mono)' }}>prefers-reduced-motion</code> OS
              setting always wins — when it's enabled, anything above "Subtle" is automatically
              downgraded to "Subtle". We don't override accessibility preferences.
            </div>
          </div>
        </>
      )}
    </>
  );
}
