import type { AnimationProfile } from '../../api';

/**
 * Profile picker — one click applies a complete bundle of GSAP rules
 * (globals + per-tag presets) site-wide. The four built-ins ship with
 * the plugin; user-defined profiles appear with a "custom" pill.
 */
export function StepStyle({
  profiles, active, onPick,
}: {
  profiles: AnimationProfile[];
  active:   string;
  onPick:   (id: string) => void;
}) {
  return (
    <div className="tsa-wizard-step">
      <header className="tsa-wizard-step__head">
        <h2 className="tsa-wizard-step__title">Pick a style</h2>
        <p className="tsa-wizard-step__lead">
          Each style is a complete bundle of GSAP rules. Click one to apply site-wide.
        </p>
      </header>

      <div className="tsa-wizard-cards">
        {profiles.map((p) => {
          const isActive = p.id === active;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p.id)}
              className={'tsa-wizard-card' + (isActive ? ' is-active' : '')}
            >
              <div className="tsa-wizard-card__preview" data-flavor={p.id} />
              <div className="tsa-wizard-card__title">{p.label}</div>
              <div className="tsa-wizard-card__desc">{p.description}</div>
              {p.source === 'user' && <span className="tsa-pill">custom</span>}
              {isActive && <span className="tsa-pill tsa-pill--accent tsa-wizard-card__badge">Active</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
