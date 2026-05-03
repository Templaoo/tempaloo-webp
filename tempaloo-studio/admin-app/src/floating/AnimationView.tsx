import { useEffect, useState } from 'react';
import { api, type AnimationProfile } from '../api';
import { toast } from '../components/Toast';
import type { AnimationLibrary, AnimationStateV2 } from '../api';
import { StepStyle } from '../pages/animation/StepStyle';
import { AnimatedElementsList } from './AnimatedElementsList';

/**
 * AnimationView — single-pane animation panel.
 *
 *   • Top    — Profile picker (Editorial / Cinematic / Minimal / Bold).
 *              One click applies a complete bundle of GSAP rules site-wide.
 *   • Bottom — Audit list of every element currently animated, with
 *              Locate + Delete actions. The "Animate any element" picker
 *              is wired in from the parent panel.
 *
 * Per-tag editing, widget scopes, and site (cursor/scroll) tabs were
 * removed — they added complexity without enough value. Profiles cover
 * the global look, Animate Mode covers fine-tuning per element.
 */
export function AnimationView({ onClose: _onClose }: { onClose?: () => void } = {}) {
  const [lib, setLib]     = useState<AnimationLibrary | null>(null);
  const [state, setState] = useState<AnimationStateV2 | null>(null);
  const [profiles, setProfiles] = useState<AnimationProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<string>('');
  const [loading, setLoading] = useState(true);

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
    try {
      await api.applyProfile(id);
      await refreshState();
      toast.info(`Applied "${id}". Reload pages to see the change.`);
    } catch (e) {
      toast.error(`Apply failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="tsa-fp-anim">
      {loading && (
        <div className="tsa-fp-anim__loading">Loading animation library…</div>
      )}

      {!loading && lib && state && (
        <div className="tsa-fp-anim__body">
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
