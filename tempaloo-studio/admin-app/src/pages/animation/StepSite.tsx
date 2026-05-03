import { api, type AnimationStateV2, type CursorSettings, type ScrollSettings } from '../../api';
import { toast } from '../../components/Toast';

const CURSOR_TYPES: Array<{ id: CursorSettings['type']; label: string; desc: string }> = [
  { id: 'off',     label: 'Off',     desc: 'Native pointer.' },
  { id: 'basic',   label: 'Basic',   desc: 'Smoothed dot that follows the pointer.' },
  { id: 'outline', label: 'Outline', desc: 'Empty ring that grows on hover.' },
  { id: 'tooltip', label: 'Tooltip', desc: 'Pill near pointer (data-tw-cursor-tooltip).' },
  { id: 'text',    label: 'Text',    desc: 'Big word near pointer (data-tw-cursor-text).' },
  { id: 'media',   label: 'Media',   desc: 'Image / video preview (data-tw-cursor-media).' },
];

const ENGINES: Array<{ id: ScrollSettings['engine']; label: string; desc: string }> = [
  { id: 'none',  label: 'Native',          desc: 'Browser native scrolling.' },
  { id: 'lenis', label: 'Lenis (smooth)',  desc: 'MIT-licensed smooth scroll, ~8 KB.' },
];

const GSAP_SOURCES: Array<{ id: ScrollSettings['gsapSource']; label: string; desc: string }> = [
  { id: 'local', label: 'Local (default)', desc: 'GSAP shipped with the plugin. Privacy-safe.' },
  { id: 'cdn',   label: 'jsDelivr CDN',    desc: 'Shared cache across sites — faster repeat visits.' },
];

/**
 * Wizard step "Site" — globals shared across the entire site:
 *   • Custom cursor type + smooth + colors
 *   • Smooth-scroll engine (none / Lenis) + tuning
 *   • GSAP source (local / CDN)
 *
 * All settings live in dedicated wp_options ('tempaloo_studio_cursor',
 * 'tempaloo_studio_scroll') and the runtime reads them from the
 * window.tempaloo.studio.{cursor,scroll} payload.
 */
export function StepSite({
  state, onChange, onBack, onDone,
}: {
  state:     AnimationStateV2;
  onChange:  (s: AnimationStateV2) => void;
  onBack:    () => void;
  onDone:    () => void;
}) {
  const cursor = state.cursor ?? { type: 'off', smooth: 0.18, accent: '#10b981', bg: 'rgba(15,23,42,0.92)', size: 14, mixBlendMode: 'normal', hover: { scale: 2.4 } };
  const scroll = state.scroll ?? { engine: 'none', duration: 1.2, lerp: 0.1, wheelMultiplier: 1, excludePages: '', gsapSource: 'local' };

  async function patchCursor(patch: Partial<CursorSettings>) {
    try {
      const updated = await api.setCursor(patch);
      onChange(updated);
      toast.info('Cursor updated. Reload to see live changes.');
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    }
  }
  async function patchScroll(patch: Partial<ScrollSettings>) {
    try {
      const updated = await api.setScroll(patch);
      onChange(updated);
      toast.info('Scroll updated. Reload to apply.');
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="tsa-wizard-step">
      <header className="tsa-wizard-step__head">
        <div className="tsa-wizard-step__num">Site</div>
        <h2 className="tsa-wizard-step__title">Site-wide motion</h2>
        <p className="tsa-wizard-step__lead">
          Cursor, smooth-scroll, GSAP source. These settings apply to the entire site, not per-element.
        </p>
      </header>

      <fieldset className="tsa-wizard-choice">
        <legend>Custom cursor</legend>
        <div className="tsa-wizard-choice__grid">
          {CURSOR_TYPES.map((t) => {
            const isActive = t.id === cursor.type;
            return (
              <button
                key={t.id}
                type="button"
                className={'tsa-wizard-choice__btn' + (isActive ? ' is-active' : '')}
                onClick={() => patchCursor({ type: t.id })}
              >
                <span className="tsa-wizard-choice__label">{t.label}</span>
                <span className="tsa-wizard-choice__desc">{t.desc}</span>
                {isActive && <span className="tsa-wizard-choice__check">✓</span>}
              </button>
            );
          })}
        </div>
      </fieldset>

      {cursor.type !== 'off' && (
        <fieldset className="tsa-wizard-choice">
          <legend>Cursor tuning</legend>
          <div className="tsa-anim-row__controls">
            <label className="tsa-anim-row__field">
              <span className="tsa-anim-row__label">Smooth</span>
              <div className="tsa-anim-row__slider">
                <input type="range" min={0} max={0.95} step={0.01}
                  value={cursor.smooth}
                  onChange={(e) => patchCursor({ smooth: parseFloat(e.target.value) })}
                />
                <span className="tsa-anim-row__num">{cursor.smooth.toFixed(2)}</span>
              </div>
            </label>
            <label className="tsa-anim-row__field">
              <span className="tsa-anim-row__label">Size</span>
              <div className="tsa-anim-row__slider">
                <input type="range" min={4} max={64} step={1}
                  value={cursor.size}
                  onChange={(e) => patchCursor({ size: parseInt(e.target.value, 10) })}
                />
                <span className="tsa-anim-row__num">{cursor.size}px</span>
              </div>
            </label>
            <label className="tsa-anim-row__field">
              <span className="tsa-anim-row__label">Hover scale</span>
              <div className="tsa-anim-row__slider">
                <input type="range" min={1} max={6} step={0.1}
                  value={cursor.hover.scale}
                  onChange={(e) => patchCursor({ hover: { scale: parseFloat(e.target.value) } })}
                />
                <span className="tsa-anim-row__num">×{cursor.hover.scale.toFixed(1)}</span>
              </div>
            </label>
            <label className="tsa-anim-row__field">
              <span className="tsa-anim-row__label">Accent color</span>
              <input type="color"
                className="tsa-tk-input"
                value={cursor.accent.startsWith('#') ? cursor.accent : '#10b981'}
                onChange={(e) => patchCursor({ accent: e.target.value })}
              />
            </label>
            <label className="tsa-anim-row__field tsa-anim-row__field--full">
              <span className="tsa-anim-row__label">Mix blend mode</span>
              <select className="tsa-tk-select"
                value={cursor.mixBlendMode}
                onChange={(e) => patchCursor({ mixBlendMode: e.target.value as CursorSettings['mixBlendMode'] })}
              >
                <option value="normal">Normal</option>
                <option value="difference">Difference (inverts under cursor)</option>
                <option value="exclusion">Exclusion</option>
                <option value="multiply">Multiply</option>
                <option value="screen">Screen</option>
                <option value="overlay">Overlay</option>
              </select>
            </label>
          </div>
        </fieldset>
      )}

      <fieldset className="tsa-wizard-choice tsa-mt-4">
        <legend>Smooth scroll</legend>
        <div className="tsa-wizard-choice__grid">
          {ENGINES.map((e) => {
            const isActive = e.id === scroll.engine;
            return (
              <button
                key={e.id}
                type="button"
                className={'tsa-wizard-choice__btn' + (isActive ? ' is-active' : '')}
                onClick={() => patchScroll({ engine: e.id })}
              >
                <span className="tsa-wizard-choice__label">{e.label}</span>
                <span className="tsa-wizard-choice__desc">{e.desc}</span>
                {isActive && <span className="tsa-wizard-choice__check">✓</span>}
              </button>
            );
          })}
        </div>
      </fieldset>

      {scroll.engine === 'lenis' && (
        <fieldset className="tsa-wizard-choice">
          <legend>Lenis tuning</legend>
          <div className="tsa-anim-row__controls">
            <label className="tsa-anim-row__field">
              <span className="tsa-anim-row__label">Duration</span>
              <div className="tsa-anim-row__slider">
                <input type="range" min={0.2} max={4} step={0.05}
                  value={scroll.duration}
                  onChange={(e) => patchScroll({ duration: parseFloat(e.target.value) })}
                />
                <span className="tsa-anim-row__num">{scroll.duration.toFixed(2)}s</span>
              </div>
            </label>
            <label className="tsa-anim-row__field">
              <span className="tsa-anim-row__label">Wheel multiplier</span>
              <div className="tsa-anim-row__slider">
                <input type="range" min={0.1} max={5} step={0.1}
                  value={scroll.wheelMultiplier}
                  onChange={(e) => patchScroll({ wheelMultiplier: parseFloat(e.target.value) })}
                />
                <span className="tsa-anim-row__num">×{scroll.wheelMultiplier.toFixed(1)}</span>
              </div>
            </label>
            <label className="tsa-anim-row__field tsa-anim-row__field--full">
              <span className="tsa-anim-row__label">Exclude pages (post IDs, comma-separated)</span>
              <input type="text" className="tsa-tk-input"
                value={scroll.excludePages}
                placeholder="42, 1337"
                onChange={(e) => patchScroll({ excludePages: e.target.value })}
              />
            </label>
          </div>
        </fieldset>
      )}

      <fieldset className="tsa-wizard-choice tsa-mt-4">
        <legend>GSAP source</legend>
        <div className="tsa-wizard-choice__grid">
          {GSAP_SOURCES.map((g) => {
            const isActive = g.id === scroll.gsapSource;
            return (
              <button
                key={g.id}
                type="button"
                className={'tsa-wizard-choice__btn' + (isActive ? ' is-active' : '')}
                onClick={() => patchScroll({ gsapSource: g.id })}
              >
                <span className="tsa-wizard-choice__label">{g.label}</span>
                <span className="tsa-wizard-choice__desc">{g.desc}</span>
                {isActive && <span className="tsa-wizard-choice__check">✓</span>}
              </button>
            );
          })}
        </div>
      </fieldset>

      <footer className="tsa-wizard-step__footer">
        <button type="button" className="tsa-btn-ghost" onClick={onBack}>← Back</button>
        <button type="button" className="tsa-btn-primary" onClick={onDone}>Done</button>
      </footer>
    </div>
  );
}
