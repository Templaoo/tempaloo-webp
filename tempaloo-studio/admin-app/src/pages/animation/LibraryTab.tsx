import type { AnimationLibrary } from './types';

/**
 * Library viewer — read-only doc of every preset, its description,
 * its required GSAP plugins, and its full param schema. Generated
 * directly from anim-presets.json so it can never go out of sync.
 */
export function LibraryTab({ lib }: { lib: AnimationLibrary }) {
  const elementPresets = lib.presets.filter((p) => p.category === 'element');
  const textPresets    = lib.presets.filter((p) => p.category === 'text');

  return (
    <div className="tsa-anim-tabpanel">
      <div className="tsa-card">
        <header className="tsa-card__header">
          <div>
            <div className="tsa-card__title">Bibliothèque GSAP — {lib.presets.length} presets</div>
            <div className="tsa-card__subtitle">
              Référence complète. Chaque preset documente ses paramètres GSAP réels et ses plugins requis (per gsap-core / gsap-scrolltrigger / gsap-plugins skills).
            </div>
          </div>
        </header>

        <h3 className="tsa-mt-4">Element entrance ({elementPresets.length})</h3>
        <div className="tsa-anim-library-grid">
          {elementPresets.map((p) => <PresetCard key={p.id} preset={p} lib={lib} />)}
        </div>

        <h3 className="tsa-mt-5">Text reveal ({textPresets.length})</h3>
        <div className="tsa-anim-library-grid">
          {textPresets.map((p) => <PresetCard key={p.id} preset={p} lib={lib} />)}
        </div>

        <h3 className="tsa-mt-5">Behaviors ({lib.behaviors.length})</h3>
        <div className="tsa-anim-library-grid">
          {lib.behaviors.map((b) => (
            <div key={b.id} className="tsa-anim-library-card">
              <div className="tsa-anim-library-card__head">
                <strong>{b.label}</strong>
                <code>{b.id}</code>
              </div>
              <p className="tsa-anim-library-card__desc">{b.description}</p>
              {b.requires && b.requires.length > 0 && (
                <div className="tsa-anim-library-card__deps">requires: {b.requires.join(', ')}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PresetCard({ preset, lib }: { preset: AnimationLibrary['presets'][number]; lib: AnimationLibrary }) {
  return (
    <div className="tsa-anim-library-card">
      <div className="tsa-anim-library-card__head">
        <strong>{preset.label}</strong>
        <code>{preset.id}</code>
      </div>
      <p className="tsa-anim-library-card__desc">{preset.description}</p>
      <div className="tsa-anim-library-card__deps">
        requires: {preset.requires.length > 0 ? preset.requires.join(', ') : 'gsap (core)'}
        {preset.splits && <span> · split: {preset.splits}</span>}
      </div>
      {Object.keys(preset.params).length > 0 && (
        <details className="tsa-anim-library-card__params">
          <summary>Paramètres ({Object.keys(preset.params).length})</summary>
          <ul>
            {Object.entries(preset.params).map(([k, s]) => (
              <li key={k}>
                <code>{k}</code> · <em>{s.type}</em> · default <code>{String((s as { value: unknown }).value)}</code>
                {s.type === 'number' && (s.min !== undefined || s.max !== undefined) && (
                  <span> · range [{s.min ?? '−∞'}, {s.max ?? '∞'}]</span>
                )}
                {s.type === 'enum' && (
                  <span> · {(lib.enums[s.enum] ?? []).length} choix</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
