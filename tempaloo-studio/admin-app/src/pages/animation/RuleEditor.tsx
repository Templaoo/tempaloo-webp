import { useMemo } from 'react';
import type { AnimationLibrary, AnimationRule } from '../../api';
import { ParamControl } from './ParamControl';

/**
 * Editor for one rule (Element Rule or Widget Override). Auto-generates
 * controls from the chosen preset's schema — every knob is a real GSAP
 * parameter (from the gsap-* skills). No invented options.
 *
 * Mutual-exclusion rules enforced visually:
 *   - preset === 'none'    → all params + scrollTrigger greyed out
 *   - preset has scrubOnly → toggleActions greyed out (scrub computes
 *                            its own progress, per gsap-scrolltrigger)
 *   - scrollTrigger.scrub  → toggleActions greyed out (same reason)
 *   - rule.enabled === false → entire editor greyed out
 */
export function RuleEditor({
  rule, lib, allowInherit, elementTypeId, onChange,
}: {
  rule:           AnimationRule;
  lib:            AnimationLibrary;
  allowInherit?:  boolean;
  /** When set, the preset dropdown is filtered to presets compatible
   *  with this element type (h1 / h2 / p / img / button / container /
   *  link). E.g. picking text-typing for an "img" rule is forbidden by
   *  the schema — the option is omitted entirely. */
  elementTypeId?: string;
  onChange:       (next: AnimationRule) => void;
}) {
  const presets = useMemo(() => {
    if (!elementTypeId) return lib.presets;
    return lib.presets.filter((p) => {
      if (!p.compatibleWith || p.compatibleWith.length === 0) return true;
      return p.compatibleWith.includes(elementTypeId);
    });
  }, [lib.presets, elementTypeId]);

  const preset = useMemo(
    () => lib.presets.find((p) => p.id === rule.preset) ?? null,
    [lib.presets, rule.preset],
  );

  const isDisabled    = rule.enabled === false;
  const isPresetNone  = rule.preset === 'none' || !rule.preset;
  const isScrubLocked = !!preset?.scrubOnly || rule.scrollTrigger?.scrub === true;

  const setPreset = (id: string) => {
    if (!id || id === 'inherit') {
      onChange({ ...rule, preset: '', params: {}, scrollTrigger: {} });
      return;
    }
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    // Reset params to that preset's defaults so the user starts from a
    // known-good state instead of inheriting incompatible knobs.
    const params: Record<string, number | string | boolean> = {};
    Object.entries(p.params).forEach(([k, s]) => { params[k] = s.value as never; });
    const st: Record<string, number | string | boolean> = {};
    Object.entries(p.scrollTrigger ?? {}).forEach(([k, s]) => { st[k] = s.value as never; });
    onChange({ ...rule, preset: id, params, scrollTrigger: st });
  };

  const setParam = (key: string, v: number | string | boolean) => {
    onChange({ ...rule, params: { ...rule.params, [key]: v } });
  };
  const setSt = (key: string, v: number | string | boolean) => {
    onChange({ ...rule, scrollTrigger: { ...rule.scrollTrigger, [key]: v } });
  };

  return (
    <div className={'tsa-anim-rule-editor' + (isDisabled ? ' is-disabled' : '')}>
      <label className="tsa-anim-row__field tsa-anim-row__field--full">
        <span className="tsa-anim-row__label">Animation</span>
        <select
          className="tsa-tk-select"
          value={rule.preset || (allowInherit ? 'inherit' : '')}
          disabled={isDisabled}
          onChange={(e) => setPreset(e.target.value)}
        >
          {allowInherit && <option value="inherit">Inherit (use site default)</option>}
          <optgroup label="Element entrance">
            {presets.filter((p) => p.category === 'element').map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </optgroup>
          <optgroup label="Text reveal">
            {presets.filter((p) => p.category === 'text').map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </optgroup>
        </select>
      </label>

      {preset && !isPresetNone && (
        <>
          <div className="tsa-anim-rule-editor__desc">
            {preset.description}
            {preset.requires.length > 0 && (
              <span className="tsa-anim-rule-editor__deps">
                {' '}— requires: {preset.requires.join(', ')}
              </span>
            )}
          </div>

          {Object.keys(preset.params).length > 0 && (
            <fieldset className="tsa-anim-rule-editor__group" disabled={isDisabled}>
              <legend>GSAP parameters</legend>
              <div className="tsa-anim-row__controls">
                {Object.entries(preset.params).map(([k, spec]) => (
                  <ParamControl
                    key={k}
                    name={k}
                    spec={spec}
                    value={rule.params[k]}
                    lib={lib}
                    disabled={isDisabled}
                    onChange={(v) => setParam(k, v)}
                  />
                ))}
              </div>
            </fieldset>
          )}

          {preset.scrollTrigger && Object.keys(preset.scrollTrigger).length > 0 && (
            <fieldset className="tsa-anim-rule-editor__group" disabled={isDisabled}>
              <legend>ScrollTrigger</legend>
              <div className="tsa-anim-row__controls">
                {Object.entries(preset.scrollTrigger).map(([k, spec]) => {
                  // Mutual-exclusion: when scrub is on, toggleActions
                  // is meaningless — scrub computes progress 1:1 from
                  // scroll position. Grey it out with a tooltip.
                  const scrubKills = isScrubLocked && k === 'toggleActions';
                  return (
                    <ParamControl
                      key={k}
                      name={k}
                      spec={scrubKills ? { ...spec, tip: 'Disabled because scrub computes progress from scroll position (gsap-scrolltrigger).' } : spec}
                      value={rule.scrollTrigger[k]}
                      lib={lib}
                      disabled={isDisabled || scrubKills}
                      onChange={(v) => setSt(k, v)}
                    />
                  );
                })}
              </div>
            </fieldset>
          )}
        </>
      )}

      {isPresetNone && (
        <div className="tsa-anim-rule-editor__desc">
          No animation. The element renders instantly. Pick another preset to enable parameters.
        </div>
      )}
    </div>
  );
}
