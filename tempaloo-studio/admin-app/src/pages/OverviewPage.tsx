import type { AppState, TemplateSummary } from '../types';

interface Props {
  state:     AppState | null;
  templates: TemplateSummary[];
  onGoTemplates: () => void;
}

export function OverviewPage({ state, templates, onGoTemplates }: Props) {
  const active        = state?.active ?? null;
  const totalWidgets  = templates.reduce((acc, t) => acc + (t.widgets_count || 0), 0);

  return (
    <>
      <header className="tsa-pagehead">
        <div>
          <h1 className="tsa-pagehead__title">Welcome back.</h1>
          <p className="tsa-pagehead__subtitle">
            Tempaloo Studio brings premium Elementor template kits to your site — installable in
            seconds, themable in real time, conversion-ready out of the box.
          </p>
        </div>
        <div className="tsa-pagehead__actions">
          <button type="button" onClick={onGoTemplates} className="tsa-btn tsa-btn--primary">
            Browse templates
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </button>
        </div>
      </header>

      <section className="tsa-stat-grid">
        <article className="tsa-stat">
          <div className="tsa-stat__label">Active template</div>
          <div className="tsa-stat__value">{active?.name ?? 'None'}</div>
          <div className="tsa-stat__hint">{active ? `v${active.version}` : 'Pick one to get started.'}</div>
        </article>

        <article className="tsa-stat">
          <div className="tsa-stat__label">Templates available</div>
          <div className="tsa-stat__value">{templates.length}</div>
          <div className="tsa-stat__hint">{totalWidgets} widgets across all kits.</div>
        </article>

        <article className="tsa-stat">
          <div className="tsa-stat__label">Theme</div>
          <div className="tsa-stat__value">Light + Dark</div>
          <div className="tsa-stat__hint">Tokens override-ready in real time.</div>
        </article>

        <article className="tsa-stat">
          <div className="tsa-stat__label">License</div>
          <div className="tsa-stat__value">Trial</div>
          <div className="tsa-stat__hint">Activate to unlock all templates.</div>
        </article>
      </section>

      <div className="tsa-card">
        <div className="tsa-card__header">
          <div>
            <div className="tsa-card__title">Quick start</div>
            <div className="tsa-card__subtitle">Three steps and you're live.</div>
          </div>
        </div>
        <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--tsa-text-soft)', lineHeight: 1.8 }}>
          <li><strong style={{ color: 'var(--tsa-text)' }}>Pick a template</strong> from the Templates tab — preview, then activate.</li>
          <li><strong style={{ color: 'var(--tsa-text)' }}>Open Elementor</strong> on any page; the active template's widgets appear in the &ldquo;Tempaloo Studio&rdquo; category.</li>
          <li><strong style={{ color: 'var(--tsa-text)' }}>Tune the look</strong> in Theme tokens — colors, fonts, radii, all editable live without rebuilding anything.</li>
        </ol>
      </div>
    </>
  );
}
