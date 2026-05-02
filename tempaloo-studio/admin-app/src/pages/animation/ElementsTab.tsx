import { useState } from 'react';
import type { AnimationLibrary, AnimationRule, AnimationStateV2 } from './types';
import { RuleEditor } from './RuleEditor';

/**
 * Element Type Rules — Niveau 1 du modèle hiérarchique.
 * Chaque type (h1, h2, p, img, button, container, link) a SA règle :
 * preset + paramètres GSAP + scrollTrigger. Appliquée automatiquement
 * à tout élément matching les sélecteurs (incluant Elementor natifs).
 */
export function ElementsTab({
  state, lib, saving, onSave, onReset,
}: {
  state:    AnimationStateV2;
  lib:      AnimationLibrary;
  saving:   string | null;
  onSave:   (typeId: string, rule: AnimationRule) => void;
  onReset:  (typeId: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="tsa-anim-tabpanel">
      <div className="tsa-card">
        <header className="tsa-card__header">
          <div>
            <div className="tsa-card__title">Règles par type d'élément</div>
            <div className="tsa-card__subtitle">
              Animation appliquée à chaque type d'élément du site, y compris les widgets Elementor natifs (Heading, Button, Image…).
              Les widgets <code>tw-</code> avec <code>data-tw-anim-scope</code> utilisent leurs overrides — voir l'onglet "Per-widget".
            </div>
          </div>
        </header>
        <div className="tsa-anim-element-list">
          {lib.elementTypes.map((type) => {
            const rule = state.elementRules[type.id] ?? {
              enabled: true,
              preset: type.recommendedPreset,
              params: {},
              scrollTrigger: {},
            };
            const preset = lib.presets.find((p) => p.id === rule.preset);
            const isOpen = open === type.id;
            const isSaving = saving === `element:${type.id}`;
            return (
              <div key={type.id} className={'tsa-anim-element-row' + (isOpen ? ' is-open' : '')}>
                <div className="tsa-anim-element-row__head" onClick={() => setOpen(isOpen ? null : type.id)}>
                  <label className="tsa-anim-element-row__toggle" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={rule.enabled !== false}
                      onChange={(e) => onSave(type.id, { ...rule, enabled: e.target.checked })}
                    />
                  </label>
                  <span className="tsa-anim-element-row__name">{type.label}</span>
                  <span className="tsa-anim-element-row__preset">
                    → <strong>{preset?.label ?? rule.preset}</strong>
                  </span>
                  <span className="tsa-anim-element-row__selectors" title={type.selectors.join(', ')}>
                    {type.selectors.length} sélecteur{type.selectors.length > 1 ? 's' : ''}
                  </span>
                  {isSaving && <span className="tsa-anim-row__saving">enregistrement…</span>}
                  <button type="button" className="tsa-anim-element-row__chevron" aria-label="Toggle">
                    {isOpen ? '▾' : '▸'}
                  </button>
                </div>

                {isOpen && (
                  <div className="tsa-anim-element-row__body">
                    <RuleEditor
                      rule={rule}
                      lib={lib}
                      onChange={(next) => onSave(type.id, next)}
                    />
                    <div className="tsa-anim-element-row__footer">
                      <button type="button" className="tsa-btn-ghost" onClick={() => onReset(type.id)}>
                        Réinitialiser au défaut
                      </button>
                      <span className="tsa-anim-element-row__sels-detail">
                        Sélecteurs : <code>{type.selectors.join(', ')}</code>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
