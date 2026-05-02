import { useState } from 'react';
import type { AnimationLibrary, AnimationRule, AnimationStateV2 } from './types';
import { RuleEditor } from './RuleEditor';

/**
 * Widget Overrides — Niveau 2.
 * Override granulaire par scope de widget (hero / services / faq / …).
 * "inherit" → l'élément utilise les Element Rules du Niveau 1.
 */
export function WidgetsTab({
  state, lib, saving, onSave,
}: {
  state:  AnimationStateV2;
  lib:    AnimationLibrary;
  saving: string | null;
  onSave: (widget: string, rule: AnimationRule) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  if (!state.templateSlug || state.widgets.length === 0) {
    return (
      <div className="tsa-anim-tabpanel">
        <div className="tsa-card">
          <div className="tsa-card__title">Aucun template actif</div>
          <div className="tsa-card__subtitle tsa-mt-3">
            Active un template depuis la page "Templates" pour configurer ses overrides par widget.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tsa-anim-tabpanel">
      <div className="tsa-card">
        <header className="tsa-card__header">
          <div>
            <div className="tsa-card__title">Overrides par widget — {state.templateSlug}</div>
            <div className="tsa-card__subtitle">
              Surcharge l'animation pour un scope spécifique. Les widgets non-configurés utilisent les Element Rules.
            </div>
          </div>
        </header>
        <div className="tsa-anim-element-list">
          {state.widgets.map((widget) => {
            const rule = (state.widgetOverrides as Record<string, AnimationRule>)[widget] ?? {
              enabled: true,
              preset: '',
              params: {},
              scrollTrigger: {},
            };
            const preset = lib.presets.find((p) => p.id === rule.preset);
            const isOpen = open === widget;
            const isSaving = saving === `widget:${widget}`;

            return (
              <div key={widget} className={'tsa-anim-element-row' + (isOpen ? ' is-open' : '')}>
                <div className="tsa-anim-element-row__head" onClick={() => setOpen(isOpen ? null : widget)}>
                  <span className="tsa-anim-element-row__name">{widget}</span>
                  <span className="tsa-anim-element-row__preset">
                    → <strong>{preset?.label ?? (rule.preset || 'inherit')}</strong>
                  </span>
                  {rule.direction && <span className="tsa-pill tsa-pill--accent">{rule.direction}</span>}
                  {isSaving && <span className="tsa-anim-row__saving">enregistrement…</span>}
                  <button type="button" className="tsa-anim-element-row__chevron">
                    {isOpen ? '▾' : '▸'}
                  </button>
                </div>

                {isOpen && (
                  <div className="tsa-anim-element-row__body">
                    <RuleEditor
                      rule={rule}
                      lib={lib}
                      allowInherit
                      onChange={(next) => onSave(widget, next)}
                    />

                    <fieldset className="tsa-anim-rule-editor__group">
                      <legend>Direction (override)</legend>
                      <label className="tsa-anim-row__field">
                        <span className="tsa-anim-row__label">Direction</span>
                        <select
                          className="tsa-tk-select"
                          value={rule.direction || ''}
                          onChange={(e) => onSave(widget, { ...rule, direction: e.target.value })}
                        >
                          <option value="">Inherit (default global)</option>
                          {state.allowed.direction.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </label>
                    </fieldset>
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
