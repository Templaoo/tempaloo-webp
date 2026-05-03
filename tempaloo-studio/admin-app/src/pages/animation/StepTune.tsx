import type { AnimationLibrary, AnimationStateV2, AnimationRule } from '../../api';
import { LivePreview } from './LivePreview';

const INTENSITY_OPTIONS: Array<{ id: string; label: string; desc: string }> = [
  { id: 'off',    label: 'Off',    desc: 'No motion. Static render.' },
  { id: 'subtle', label: 'Subtle', desc: 'Opacity fades only (~300ms).' },
  { id: 'medium', label: 'Medium', desc: 'Translate + stagger + scroll triggers.' },
  { id: 'bold',   label: 'Bold',   desc: 'Larger transforms, longer durations.' },
];

const DIRECTION_OPTIONS: Array<{ id: string; label: string; desc: string }> = [
  { id: 'once',          label: 'Once',          desc: 'Plays once. Lightest on perf.' },
  { id: 'replay',        label: 'Replay',        desc: 'Plays forward every time.' },
  { id: 'bidirectional', label: 'Bidirectional', desc: 'Forward down, reverse up.' },
  { id: 'scrub',         label: 'Scrub',         desc: '1:1 with scroll position.' },
];

const REDUCE_MOTION_OPTIONS: Array<{ id: string; label: string; desc: string }> = [
  { id: 'subtle',    label: 'Auto-downgrade', desc: 'Falls back to fade. Recommended.' },
  { id: 'off',       label: 'Disable',        desc: 'No animation for reduce-motion users.' },
  { id: 'unchanged', label: 'Keep as-is',     desc: 'Plays full motion. Not recommended.' },
];

/**
 * Step 2 — Tune the feel.
 * Three site-wide globals. Live preview canvas re-keys on every change
 * so the user gets immediate feedback (onboarding-cro: "do, don't show").
 *
 * Mutual-exclusion: when intensity = "off", direction + reduce-motion
 * grids are visually suppressed (no choice to make if there's no motion).
 */
export function StepTune({
  state, lib, profileId, onChange, onContinue, onBack, onAdvanced,
}: {
  state:      AnimationStateV2;
  lib:        AnimationLibrary;
  profileId:  string;            // empty if custom mode
  onChange:   (patch: { intensity?: string; direction?: string; reduceMotion?: string }) => void;
  onContinue: () => void;
  onBack:     () => void;
  onAdvanced: () => void;
}) {
  const isOff = state.globals.intensity === 'off';

  // Build a minimal rule for the LivePreview. Use the first text-style
  // element rule (h1) so the preview shows what the user just picked.
  const previewRule: AnimationRule = state.elementRules.h1 ?? {
    enabled: true,
    preset: 'fade-up',
    params: {},
    scrollTrigger: {},
  };

  return (
    <div className="tsa-wizard-step">
      <header className="tsa-wizard-step__head">
        <div className="tsa-wizard-step__num">2 / 3</div>
        <h2 className="tsa-wizard-step__title">Tune the feel</h2>
        <p className="tsa-wizard-step__lead">
          Three site-wide globals.{' '}
          {profileId ? <>Style: <strong>{profileId}</strong>.</> : <strong>Custom mode.</strong>}
          {' '}Preview replays on every change.
        </p>
      </header>

      <div className="tsa-wizard-tune">
        <div className="tsa-wizard-tune__controls">
          <ChoiceGrid
            title="Intensity"
            options={INTENSITY_OPTIONS}
            value={state.globals.intensity}
            onChange={(v) => onChange({ intensity: v })}
          />

          <div className={isOff ? 'is-off' : ''}>
            <ChoiceGrid
              title="Replay direction"
              options={DIRECTION_OPTIONS}
              value={state.globals.direction}
              disabled={isOff}
              onChange={(v) => onChange({ direction: v })}
            />
          </div>

          <div className={isOff ? 'is-off' : ''}>
            <ChoiceGrid
              title="Reduce-motion strategy"
              options={REDUCE_MOTION_OPTIONS}
              value={state.globals.reduceMotion}
              disabled={isOff}
              onChange={(v) => onChange({ reduceMotion: v })}
            />
          </div>
        </div>

        <div className="tsa-wizard-tune__preview">
          <LivePreview rule={previewRule} lib={lib} />
        </div>
      </div>

      <footer className="tsa-wizard-step__footer">
        <button type="button" className="tsa-btn-ghost" onClick={onBack}>← Back</button>
        <button type="button" className="tsa-btn-ghost" onClick={onAdvanced}>
          Advanced (per-element / per-widget)
        </button>
        <button type="button" className="tsa-btn-primary" onClick={onContinue}>Done — save</button>
      </footer>
    </div>
  );
}

function ChoiceGrid({
  title, options, value, onChange, disabled,
}: {
  title:    string;
  options:  Array<{ id: string; label: string; desc: string }>;
  value:    string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="tsa-wizard-choice" disabled={disabled}>
      <legend>{title}</legend>
      <div className="tsa-wizard-choice__grid">
        {options.map((o) => {
          const isActive = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              className={'tsa-wizard-choice__btn' + (isActive ? ' is-active' : '')}
              disabled={disabled}
              onClick={() => onChange(o.id)}
            >
              <span className="tsa-wizard-choice__label">{o.label}</span>
              <span className="tsa-wizard-choice__desc">{o.desc}</span>
              {isActive && <span className="tsa-wizard-choice__check">✓</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
