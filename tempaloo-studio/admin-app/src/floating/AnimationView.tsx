import { useEffect, useRef, useState } from 'react';
import { api, type AnimationProfile } from '../api';
import { toast } from '../components/Toast';
import type { AnimationLibrary, AnimationStateV2 } from '../api';
import { StepStyle } from '../pages/animation/StepStyle';
import { AnimatedElementsList } from './AnimatedElementsList';

/**
 * AnimationView — single-pane animation panel.
 *
 *   • Top    — Master "Animations enabled" toggle (sets globals.intensity
 *              to 'off' or back to the previous value).
 *   • Mid    — Profile picker (Editorial / Cinematic / Minimal / Bold).
 *              One click applies a complete bundle of GSAP rules site-wide.
 *   • Bottom — Audit list of every element currently animated, with
 *              Locate + Delete actions (single + bulk multi-select).
 *
 * Per-tag editing, widget scopes, and site (cursor/scroll) tabs were
 * removed — they added complexity without enough value. Profiles cover
 * the global look, Animate Mode covers fine-tuning per element, and the
 * master toggle lets the user kill animations site-wide in one click.
 */
export function AnimationView({ onClose: _onClose }: { onClose?: () => void } = {}) {
  const [lib, setLib]     = useState<AnimationLibrary | null>(null);
  const [state, setState] = useState<AnimationStateV2 | null>(null);
  const [profiles, setProfiles] = useState<AnimationProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [togglingMaster, setTogglingMaster] = useState(false);

  // Remember the last NON-OFF intensity so we can restore it when the
  // user toggles animations back ON. Without this, restoring would
  // hardcode 'medium' and lose the user's per-profile intensity choice.
  const lastEnabledIntensity = useRef<string>('medium');

  useEffect(() => {
    Promise.all([api.getAnimationLibrary(), api.getAnimationV2(), api.listProfiles()])
      .then(([l, s, ps]) => {
        setLib(l);
        setState(s);
        setProfiles(ps.profiles);
        setActiveProfile(ps.active);
        if (s.globals.intensity && s.globals.intensity !== 'off') {
          lastEnabledIntensity.current = s.globals.intensity;
        }
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
      if (s.globals.intensity && s.globals.intensity !== 'off') {
        lastEnabledIntensity.current = s.globals.intensity;
      }
    } catch (e) {
      toast.error(`Reload failed: ${(e as Error).message}`);
    }
  }

  async function applyProfile(id: string) {
    try {
      await api.applyProfile(id);
      await refreshState();
      toast.info(`Applied "${id}". Reload pages to see the change.`);
    } catch (e) {
      toast.error(`Apply failed: ${(e as Error).message}`);
    }
  }

  async function toggleMaster(enable: boolean) {
    if (togglingMaster) return;
    setTogglingMaster(true);
    try {
      const target = enable ? lastEnabledIntensity.current : 'off';
      const updated = await api.setIntensity(target);
      setState(updated);
      toast.info(
        enable
          ? `Animations enabled (${target}). Reload pages to see them.`
          : 'All animations disabled site-wide. Reload pages to see the change.'
      );
    } catch (e) {
      toast.error(`Toggle failed: ${(e as Error).message}`);
    } finally {
      setTogglingMaster(false);
    }
  }

  const animationsEnabled = !!state && state.globals.intensity !== 'off';

  return (
    <div className="tsa-fp-anim">
      {loading && (
        <div className="tsa-fp-anim__loading">Loading animation library…</div>
      )}

      {!loading && lib && state && (
        <div className="tsa-fp-anim__body">
          {/* Master toggle — kills every animation site-wide when off.
              Goes through the full intensity -> 'off' path so:
                - Anti-FOUC body{visibility:hidden} no longer fires
                - GSAP/ScrollTrigger no longer enqueue (lazy gate)
                - All element rules + selector overrides no-op
                - Lenis stops smoothing (still depends on scroll engine)
             Toggling back ON restores the previous intensity (so the
             user's per-profile preference isn't lost). */}
          <div className="tsa-fp-anim__master" role="group" aria-label="Animations master toggle">
            <label className="tsa-fp-anim__master-row">
              <span className="tsa-fp-anim__master-label">
                <strong>Animations</strong>
                <span className="tsa-fp-anim__master-status">
                  {animationsEnabled
                    ? `Enabled · intensity: ${state.globals.intensity}`
                    : 'Disabled site-wide'}
                </span>
              </span>
              <button
                type="button"
                className={'tsa-fp-anim__master-switch' + (animationsEnabled ? ' is-on' : '')}
                onClick={() => toggleMaster(!animationsEnabled)}
                disabled={togglingMaster}
                aria-pressed={animationsEnabled}
                title={animationsEnabled ? 'Click to disable all animations' : 'Click to re-enable animations'}
              >
                <span className="tsa-fp-anim__master-knob" />
              </button>
            </label>
          </div>

          <StepStyle
            profiles={profiles}
            active={activeProfile}
            onPick={applyProfile}
          />
          <AnimatedElementsList state={state} lib={lib} onChange={refreshState} />
        </div>
      )}
    </div>
  );
}
