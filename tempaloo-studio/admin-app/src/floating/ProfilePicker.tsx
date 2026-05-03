import { useEffect, useState } from 'react';
import { api, type AnimationProfile } from '../api';
import { toast } from '../components/Toast';

/**
 * Compact Animation-Profile picker for the floating panel toolbar.
 * Migrates the "Profiles" tab from the React admin into the live-page
 * editor — applying a profile in 1 click is a top-frequency action,
 * so it lives where the user is actually working (on the page).
 *
 * Architecture step 1 of the floating-panel migration.
 */
export function ProfilePicker() {
  const [profiles, setProfiles] = useState<AnimationProfile[]>([]);
  const [active,   setActive]   = useState<string>('');
  const [pending,  setPending]  = useState<string | null>(null);
  const [open,     setOpen]     = useState(false);

  useEffect(() => {
    api.listProfiles()
      .then((r) => { setProfiles(r.profiles); setActive(r.active); })
      .catch(() => { /* admin not enabled / no perm — silently hide */ });
  }, []);

  if (!profiles.length) return null;

  const activeLabel = profiles.find((p) => p.id === active)?.label ?? 'No profile';

  async function apply(id: string) {
    setPending(id);
    setOpen(false);
    try {
      await api.applyProfile(id);
      setActive(id);
      toast.info(`Animation profile "${id}" applied. Reload the page to see the effect.`);
    } catch (e) {
      toast.error(`Apply failed: ${(e as Error).message}`);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="tsa-fp-prof">
      <button
        type="button"
        className={'tsa-fp__btn' + (open ? ' is-active' : '')}
        onClick={() => setOpen((v) => !v)}
        title="Animation profile — one-click bundle of GSAP rules"
      >
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="8" cy="8" r="6" />
          <path d="M8 4v4l2.5 2.5" />
        </svg>
        Style: <strong>{activeLabel}</strong>
      </button>
      {open && (
        <div className="tsa-fp-prof__menu" role="menu">
          {profiles.map((p) => {
            const isActive  = p.id === active;
            const isPending = pending === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="menuitem"
                disabled={isActive || isPending}
                className={'tsa-fp-prof__item' + (isActive ? ' is-active' : '')}
                onClick={() => apply(p.id)}
              >
                <span className="tsa-fp-prof__item-head">
                  <strong>{p.label}</strong>
                  {p.source === 'user' && <span className="tsa-pill">custom</span>}
                  {isActive && <span className="tsa-pill tsa-pill--accent">active</span>}
                  {isPending && <span className="tsa-pill">applying…</span>}
                </span>
                <span className="tsa-fp-prof__item-desc">{p.description}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
