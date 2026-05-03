import { useState } from 'react';
import type { AnimationLibrary, AnimationRule, AnimationStateV2 } from '../../api';
import { RuleEditor } from './RuleEditor';

type Mode = 'elements' | 'widgets';

/**
 * Step 3 — Advanced.
 * Single screen, sub-toggle between Per-element / Per-widget (mutually
 * exclusive view, never both at once — keeps the cognitive load low).
 *
 * Disabled-state rules:
 *   • Element row toggle off → entire RuleEditor greyed out.
 *   • Widget set to "Inherit" → editor collapsed to a hint, not shown.
 *   • Each editor follows its own internal mutual-exclusion (see
 *     RuleEditor: scrub kills toggleActions, none kills params, etc).
 */
export function StepAdvanced({
  state, lib, saving,
  onSaveElement, onResetElement,
  onSaveWidget,
  onBack, onDone,
}: {
  state:           AnimationStateV2;
  lib:             AnimationLibrary;
  saving:          string | null;
  onSaveElement:   (typeId: string, rule: AnimationRule) => void;
  onResetElement:  (typeId: string) => void;
  onSaveWidget:    (widget: string, rule: AnimationRule) => void;
  onBack:          () => void;
  onDone:          () => void;
}) {
  const [mode, setMode] = useState<Mode>('elements');
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="tsa-wizard-step">
      <header className="tsa-wizard-step__head">
        <div className="tsa-wizard-step__num">3 / 3</div>
        <h2 className="tsa-wizard-step__title">Advanced — fine-tune (optional)</h2>
        <p className="tsa-wizard-step__lead">
          Override individual element types or specific widgets. Most users skip this step.
        </p>
      </header>

      <div className="tsa-wizard-segmented">
        <button
          type="button"
          className={'tsa-wizard-seg' + (mode === 'elements' ? ' is-active' : '')}
          onClick={() => { setMode('elements'); setOpenId(null); }}
        >
          Per element type
        </button>
        <button
          type="button"
          className={'tsa-wizard-seg' + (mode === 'widgets' ? ' is-active' : '')}
          onClick={() => { setMode('widgets'); setOpenId(null); }}
          disabled={!state.templateSlug || state.widgets.length === 0}
          title={!state.templateSlug ? 'Activate a template to override its widgets.' : ''}
        >
          Per widget {state.widgets.length > 0 && <span className="tsa-pill">{state.widgets.length}</span>}
        </button>
      </div>

      {mode === 'elements' && (
        <ElementsList
          state={state}
          lib={lib}
          saving={saving}
          openId={openId}
          setOpenId={setOpenId}
          onSave={onSaveElement}
          onReset={onResetElement}
        />
      )}

      {mode === 'widgets' && (
        <WidgetsList
          state={state}
          lib={lib}
          saving={saving}
          openId={openId}
          setOpenId={setOpenId}
          onSave={onSaveWidget}
        />
      )}

      <footer className="tsa-wizard-step__footer">
        <button type="button" className="tsa-btn-ghost" onClick={onBack}>← Back</button>
        <button type="button" className="tsa-btn-primary" onClick={onDone}>Done</button>
      </footer>
    </div>
  );
}

/* ── Per-element-type list ──────────────────────────────────── */

function ElementsList({
  state, lib, saving, openId, setOpenId, onSave, onReset,
}: {
  state:    AnimationStateV2;
  lib:      AnimationLibrary;
  saving:   string | null;
  openId:   string | null;
  setOpenId: (id: string | null) => void;
  onSave:   (typeId: string, rule: AnimationRule) => void;
  onReset:  (typeId: string) => void;
}) {
  return (
    <div className="tsa-anim-element-list">
      {lib.elementTypes.map((type) => {
        const rule: AnimationRule = state.elementRules[type.id] ?? {
          enabled: true,
          preset: type.recommendedPreset,
          params: {},
          scrollTrigger: {},
        };
        const preset   = lib.presets.find((p) => p.id === rule.preset);
        const isOpen   = openId === type.id;
        const isSaving = saving === `element:${type.id}`;
        const isOff    = rule.enabled === false;

        return (
          <div key={type.id} className={'tsa-anim-element-row' + (isOpen ? ' is-open' : '') + (isOff ? ' is-off' : '')}>
            <div className="tsa-anim-element-row__head" onClick={() => setOpenId(isOpen ? null : type.id)}>
              <label className="tsa-anim-element-row__toggle" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={!isOff}
                  onChange={(e) => onSave(type.id, { ...rule, enabled: e.target.checked })}
                />
              </label>
              <span className="tsa-anim-element-row__name">{type.label}</span>
              <span className="tsa-anim-element-row__preset">
                → <strong>{preset?.label ?? rule.preset}</strong>
              </span>
              <span className="tsa-anim-element-row__selectors" title={type.selectors.join(', ')}>
                {type.selectors.length} selector{type.selectors.length > 1 ? 's' : ''}
              </span>
              {isSaving && <span className="tsa-anim-row__saving">saving…</span>}
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
                    Reset to schema default
                  </button>
                  <span className="tsa-anim-element-row__sels-detail">
                    Selectors: <code>{type.selectors.join(', ')}</code>
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Per-widget list ────────────────────────────────────────── */

function WidgetsList({
  state, lib, saving, openId, setOpenId, onSave,
}: {
  state:    AnimationStateV2;
  lib:      AnimationLibrary;
  saving:   string | null;
  openId:   string | null;
  setOpenId: (id: string | null) => void;
  onSave:   (widget: string, rule: AnimationRule) => void;
}) {
  if (!state.templateSlug || state.widgets.length === 0) {
    return (
      <div className="tsa-card">
        <div className="tsa-card__title">No active template</div>
        <div className="tsa-card__subtitle tsa-mt-3">
          Activate a template from the Templates page to override its widgets.
        </div>
      </div>
    );
  }

  return (
    <div className="tsa-anim-element-list">
      <div className="tsa-anim-template-pill">
        Template: <strong>{state.templateSlug}</strong>
      </div>
      {state.widgets.map((widget) => {
        const rule: AnimationRule = (state.widgetOverrides as Record<string, AnimationRule>)[widget] ?? {
          enabled: true,
          preset: '',
          params: {},
          scrollTrigger: {},
        };
        const preset    = lib.presets.find((p) => p.id === rule.preset);
        const isOpen    = openId === widget;
        const isSaving  = saving === `widget:${widget}`;
        const isInherit = !rule.preset;

        return (
          <div key={widget} className={'tsa-anim-element-row' + (isOpen ? ' is-open' : '')}>
            <div className="tsa-anim-element-row__head" onClick={() => setOpenId(isOpen ? null : widget)}>
              <span className="tsa-anim-element-row__name">{widget}</span>
              <span className="tsa-anim-element-row__preset">
                {isInherit
                  ? <span className="tsa-anim-element-row__inherit">Inherits from element rules</span>
                  : <>→ <strong>{preset?.label ?? rule.preset}</strong></>}
              </span>
              {rule.direction && <span className="tsa-pill tsa-pill--accent">{rule.direction}</span>}
              {isSaving && <span className="tsa-anim-row__saving">saving…</span>}
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

                <fieldset className="tsa-anim-rule-editor__group" disabled={isInherit}>
                  <legend>Direction (override)</legend>
                  <label className="tsa-anim-row__field">
                    <span className="tsa-anim-row__label">Direction</span>
                    <select
                      className="tsa-tk-select"
                      value={rule.direction || ''}
                      disabled={isInherit}
                      onChange={(e) => onSave(widget, { ...rule, direction: e.target.value })}
                    >
                      <option value="">Inherit (global default)</option>
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
  );
}
