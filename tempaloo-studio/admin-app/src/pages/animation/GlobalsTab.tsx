import type { AnimationStateV2 } from './types';

const INTENSITY_LABELS: Record<string, { label: string; desc: string }> = {
  off:    { label: 'Off',    desc: 'Aucune animation. Rendu statique. Le plus rapide, le plus accessible.' },
  subtle: { label: 'Subtle', desc: 'Fades opacité uniquement (~300ms). Compatible reduced-motion.' },
  medium: { label: 'Medium', desc: 'Animations design : translateY, stagger, scroll triggers. (Défaut)' },
  bold:   { label: 'Bold',   desc: 'Transforms plus marqués, durées plus longues. Plus dramatique.' },
};

const DIRECTION_LABELS: Record<string, { label: string; desc: string }> = {
  once:          { label: 'Once',          desc: 'Joue UNE fois au scroll. Le plus léger en performance.' },
  replay:        { label: 'Replay',        desc: 'Rejoue forward à chaque entrée (down ET up). Pas de reverse.' },
  bidirectional: { label: 'Bidirectional', desc: 'Forward au scroll-down, REVERSE au scroll-up. Défaut.' },
  scrub:         { label: 'Scrub',         desc: 'Progression liée 1:1 au scroll. Pour animations narratives.' },
};

const REDUCE_MOTION_LABELS: Record<string, { label: string; desc: string }> = {
  off:       { label: 'Off',       desc: 'Aucune animation pour les utilisateurs reduce-motion.' },
  subtle:    { label: 'Subtle',    desc: 'Auto-dégrade tout en simple fade. Recommandé. (Défaut)' },
  unchanged: { label: 'Unchanged', desc: 'Joue les animations telles quelles. Non recommandé pour l\'accessibilité.' },
};

export function GlobalsTab({
  state, saving, onChange,
}: {
  state:    AnimationStateV2;
  saving:   boolean;
  onChange: (patch: { intensity?: string; direction?: string; reduceMotion?: string }) => void;
}) {
  return (
    <div className="tsa-anim-tabpanel">
      <div className="tsa-card">
        <header className="tsa-card__header">
          <div>
            <div className="tsa-card__title">Intensité globale</div>
            <div className="tsa-card__subtitle">
              Niveau de motion appliqué à tout le site. <code>prefers-reduced-motion</code> de l'OS rétrograde automatiquement vers Subtle.
            </div>
          </div>
        </header>
        <div className="tsa-anim-grid">
          {state.allowed.intensity.map((id) => {
            const meta = INTENSITY_LABELS[id] ?? { label: id, desc: '' };
            const isActive = id === state.globals.intensity;
            return (
              <button
                key={id} type="button"
                onClick={() => onChange({ intensity: id })}
                disabled={saving}
                className={'tsa-anim-card' + (isActive ? ' is-active' : '')}
              >
                <span className="tsa-anim-card__demo" data-level={id}>
                  <span className="tsa-anim-card__dot" />
                  <span className="tsa-anim-card__dot" />
                  <span className="tsa-anim-card__dot" />
                </span>
                <span className="tsa-anim-card__label">{meta.label}</span>
                <span className="tsa-anim-card__desc">{meta.desc}</span>
                {isActive && <span className="tsa-pill tsa-pill--accent tsa-anim-card__badge"><span className="tsa-pill__dot" /> Actif</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="tsa-card tsa-mt-5">
        <header className="tsa-card__header">
          <div>
            <div className="tsa-card__title">Direction de replay par défaut</div>
            <div className="tsa-card__subtitle">
              Comment les animations se comportent quand l'utilisateur scrolle dans l'autre sens. Les overrides par widget gardent leur valeur.
            </div>
          </div>
        </header>
        <div className="tsa-anim-grid tsa-anim-grid--compact">
          {state.allowed.direction.map((id) => {
            const meta = DIRECTION_LABELS[id] ?? { label: id, desc: '' };
            const isActive = id === state.globals.direction;
            return (
              <button
                key={id} type="button"
                onClick={() => onChange({ direction: id })}
                disabled={saving}
                className={'tsa-anim-card' + (isActive ? ' is-active' : '')}
              >
                <span className="tsa-anim-card__label">{meta.label}</span>
                <span className="tsa-anim-card__desc">{meta.desc}</span>
                {isActive && <span className="tsa-pill tsa-pill--accent tsa-anim-card__badge"><span className="tsa-pill__dot" /> Actif</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="tsa-card tsa-mt-5">
        <header className="tsa-card__header">
          <div>
            <div className="tsa-card__title">Stratégie reduce-motion</div>
            <div className="tsa-card__subtitle">
              Comportement quand l'utilisateur a <code>prefers-reduced-motion: reduce</code> activé sur son OS. Géré via <code>gsap.matchMedia()</code> — auto-revert sur changement.
            </div>
          </div>
        </header>
        <div className="tsa-anim-grid tsa-anim-grid--compact">
          {state.allowed.reduceMotion.map((id) => {
            const meta = REDUCE_MOTION_LABELS[id] ?? { label: id, desc: '' };
            const isActive = id === state.globals.reduceMotion;
            return (
              <button
                key={id} type="button"
                onClick={() => onChange({ reduceMotion: id })}
                disabled={saving}
                className={'tsa-anim-card' + (isActive ? ' is-active' : '')}
              >
                <span className="tsa-anim-card__label">{meta.label}</span>
                <span className="tsa-anim-card__desc">{meta.desc}</span>
                {isActive && <span className="tsa-pill tsa-pill--accent tsa-anim-card__badge"><span className="tsa-pill__dot" /> Actif</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
