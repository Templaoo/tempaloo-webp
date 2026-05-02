import type { AnimationLibrary, ParamSpec } from './types';

/**
 * Auto-generated control for a single GSAP parameter spec.
 * Renders the right input (slider / select / toggle) based on the
 * spec's `type` and bounds — impossible to set values outside the
 * preset's documented range.
 */
export function ParamControl({
  name, spec, value, lib, onChange,
}: {
  name:     string;
  spec:     ParamSpec;
  value:    number | string | boolean | undefined;
  lib:      AnimationLibrary;
  onChange: (v: number | string | boolean) => void;
}) {
  const label = spec.label || name;
  const tip   = spec.tip;

  if (spec.type === 'number') {
    const v   = typeof value === 'number' ? value : (spec.value as number);
    const min = spec.min ?? 0;
    const max = spec.max ?? 100;
    const step = spec.step ?? 1;
    return (
      <label className="tsa-anim-row__field" title={tip}>
        <span className="tsa-anim-row__label">
          {label}
          {tip && <span className="tsa-anim-row__tip" title={tip}>?</span>}
        </span>
        <div className="tsa-anim-row__slider">
          <input
            type="range"
            min={min} max={max} step={step}
            value={v}
            disabled={!!spec.locked}
            onChange={(e) => onChange(parseFloat(e.target.value))}
          />
          <span className="tsa-anim-row__num">{v}{spec.unit ?? ''}</span>
        </div>
      </label>
    );
  }

  if (spec.type === 'enum') {
    const v       = typeof value === 'string' ? value : (spec.value as string);
    const options = lib.enums[spec.enum] ?? [];
    return (
      <label className="tsa-anim-row__field" title={tip}>
        <span className="tsa-anim-row__label">
          {label}
          {tip && <span className="tsa-anim-row__tip" title={tip}>?</span>}
        </span>
        <select
          className="tsa-tk-select"
          value={v}
          disabled={!!spec.locked}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </label>
    );
  }

  if (spec.type === 'boolean') {
    const v = typeof value === 'boolean' ? value : (spec.value as boolean);
    return (
      <label className="tsa-anim-row__field tsa-anim-row__field--check" title={tip}>
        <input
          type="checkbox"
          checked={v}
          disabled={!!spec.locked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{label}</span>
        {tip && <span className="tsa-anim-row__tip" title={tip}>?</span>}
      </label>
    );
  }

  // string fallback
  const v = typeof value === 'string' ? value : (spec.value as string);
  return (
    <label className="tsa-anim-row__field" title={tip}>
      <span className="tsa-anim-row__label">{label}</span>
      <input
        type="text"
        className="tsa-tk-input"
        value={v}
        disabled={!!spec.locked}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
