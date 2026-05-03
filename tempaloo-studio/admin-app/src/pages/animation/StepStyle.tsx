import type { AnimationProfile } from '../../api';

/**
 * Step 1 — Pick a style.
 * One question per screen (ux-flow skill: "one screen, one decision").
 * Profile cards include a mini live-preview strip and a clear primary
 * action ("Continue") at the bottom.
 */
export function StepStyle({
  profiles, active, onPick, onCustom, onContinue,
}: {
  profiles:   AnimationProfile[];
  active:     string;          // currently applied profile id
  onPick:     (id: string) => void;
  onCustom:   () => void;      // jumps to step 2 with no profile (custom mode)
  onContinue: () => void;      // moves to step 2
}) {
  return (
    <div className="tsa-wizard-step">
      <header className="tsa-wizard-step__head">
        <div className="tsa-wizard-step__num">1 / 3</div>
        <h2 className="tsa-wizard-step__title">Pick a style</h2>
        <p className="tsa-wizard-step__lead">
          Each style is a complete bundle of GSAP rules. You can fine-tune it next, or jump in custom.
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

        <button type="button" className="tsa-wizard-card tsa-wizard-card--custom" onClick={onCustom}>
          <div className="tsa-wizard-card__preview tsa-wizard-card__preview--blank" />
          <div className="tsa-wizard-card__title">Start custom</div>
          <div className="tsa-wizard-card__desc">Skip the preset and configure each element manually.</div>
        </button>
      </div>

      <footer className="tsa-wizard-step__footer">
        <button
          type="button"
          className="tsa-btn-primary"
          disabled={!active}
          onClick={onContinue}
        >
          Continue →
        </button>
      </footer>
    </div>
  );
}
