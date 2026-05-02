import { useMemo } from 'react';
import type { AnimationLibrary, AnimationRule } from './types';
import { ParamControl } from './ParamControl';

/**
 * Editor for one rule (Element Rule or Widget Override). Auto-generates
 * controls from the chosen preset's schema — every knob is a real GSAP
 * parameter (per the gsap-* skills). No invented options.
 */
export function RuleEditor({
  rule, lib, allowInherit, onChange,
}: {
  rule:          AnimationRule;
  lib:           AnimationLibrary;
  allowInherit?: boolean;
  onChange:      (next: AnimationRule) => void;
}) {
  const presets = lib.presets;
  const preset  = useMemo(
    () => presets.find((p) => p.id === rule.preset) ?? null,
    [presets, rule.preset],
  );

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
    <div className="tsa-anim-rule-editor">
      <label className="tsa-anim-row__field tsa-anim-row__field--full">
        <span className="tsa-anim-row__label">Animation</span>
        <select
          className="tsa-tk-select"
          value={rule.preset || (allowInherit ? 'inherit' : '')}
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

      {preset && (
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
            <fieldset className="tsa-anim-rule-editor__group">
              <legend>Paramètres GSAP</legend>
              <div className="tsa-anim-row__controls">
                {Object.entries(preset.params).map(([k, spec]) => (
                  <ParamControl
                    key={k}
                    name={k}
                    spec={spec}
                    value={rule.params[k]}
                    lib={lib}
                    onChange={(v) => setParam(k, v)}
                  />
                ))}
              </div>
            </fieldset>
          )}

          {preset.scrollTrigger && Object.keys(preset.scrollTrigger).length > 0 && (
            <fieldset className="tsa-anim-rule-editor__group">
              <legend>ScrollTrigger</legend>
              <div className="tsa-anim-row__controls">
                {Object.entries(preset.scrollTrigger).map(([k, spec]) => (
                  <ParamControl
                    key={k}
                    name={k}
                    spec={spec}
                    value={rule.scrollTrigger[k]}
                    lib={lib}
                    onChange={(v) => setSt(k, v)}
                  />
                ))}
              </div>
            </fieldset>
          )}
        </>
      )}
    </div>
  );
}
