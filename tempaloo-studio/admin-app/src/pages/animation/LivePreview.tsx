import { useEffect, useRef } from 'react';
import type { AnimationLibrary, AnimationRule } from '../../api';

/**
 * LivePreview — sandboxed mini-canvas that replays the picked rule on
 * mock content (h1 + paragraph + button + image placeholder). Re-keys
 * on rule change so the user sees the difference instantly without
 * reloading any front-end page.
 *
 * Implementation note: we don't load GSAP into the admin bundle (heavy,
 * version-coupled with the runtime). Instead we approximate the preset
 * with CSS keyframes that mirror the GSAP shape (translateY + fade,
 * blur + fade, scale + fade, mask reveal). It's a "feel" preview, not
 * a pixel-perfect simulation — good enough to choose between Editorial
 * vs Cinematic vs Bold without leaving the admin.
 */
export function LivePreview({
  rule, lib,
}: {
  rule: AnimationRule;
  lib:  AnimationLibrary;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const preset = lib.presets.find((p) => p.id === rule.preset);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    // Force a reflow by removing/re-adding the data-flavor attribute,
    // which restarts the CSS animations on every rule change.
    root.removeAttribute('data-flavor');
    void root.offsetWidth;
    const flavor = mapPresetToFlavor(rule.preset);
    root.setAttribute('data-flavor', flavor);
    const dur     = (rule.params?.duration as number) ?? 0.7;
    const stagger = (rule.params?.stagger as number)  ?? 0.08;
    root.style.setProperty('--lp-duration', `${dur}s`);
    root.style.setProperty('--lp-stagger',  `${stagger}s`);
  }, [rule.preset, rule.params]);

  return (
    <div className="tsa-lp">
      <div className="tsa-lp__bar">
        <span className="tsa-lp__dot" />
        <span className="tsa-lp__dot" />
        <span className="tsa-lp__dot" />
        <span className="tsa-lp__title">Live preview · {preset?.label ?? rule.preset}</span>
      </div>
      <div ref={ref} className="tsa-lp__stage" data-flavor="fade-up">
        <div className="tsa-lp__h1" style={{ animationDelay: '0s' }}>
          A bold heading appears
        </div>
        <div className="tsa-lp__p" style={{ animationDelay: 'calc(var(--lp-stagger) * 1)' }}>
          Subhead copy reveals next, in cadence with the title to give a sense of choreography.
        </div>
        <div className="tsa-lp__row">
          <div className="tsa-lp__img" style={{ animationDelay: 'calc(var(--lp-stagger) * 2)' }} />
          <button type="button" className="tsa-lp__btn" style={{ animationDelay: 'calc(var(--lp-stagger) * 3)' }}>
            Get started
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Map every preset id to one of the 6 CSS keyframe flavors used by the
 * preview. Approximation only — the live site uses real GSAP.
 */
function mapPresetToFlavor(presetId: string): string {
  if (!presetId) return 'fade-up';
  if (presetId.includes('blur'))  return 'blur';
  if (presetId.includes('mask'))  return 'mask';
  if (presetId.includes('scale')) return 'scale';
  if (presetId.includes('typing') || presetId.includes('char')) return 'char';
  if (presetId.includes('slide-up')) return 'slide';
  if (presetId.includes('fade-down'))  return 'fade-down';
  if (presetId.includes('fade-left'))  return 'fade-left';
  if (presetId.includes('fade-right')) return 'fade-right';
  if (presetId === 'fade')             return 'fade';
  if (presetId === 'none')             return 'none';
  return 'fade-up';
}
