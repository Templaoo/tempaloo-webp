import { useMemo } from 'react';
import { api, type AnimationLibrary, type AnimationRule, type AnimationStateV2 } from '../api';
import { toast } from '../components/Toast';

/**
 * Audit list of every element currently animated on the page.
 *
 * Two row kinds, listed in priority order:
 *   1. selector — a Niveau 4 selectorOverride pinned via Animate Mode.
 *      Editable: Locate + Delete.
 *   2. element  — a Niveau 1 elementRule injected by the active profile.
 *      Read-only: Locate only (the rule's life-cycle belongs to the
 *      profile). To remove it, switch profile or use Animate Mode to
 *      pin a more specific override.
 */
export function AnimatedElementsList({
  state, lib, onChange,
}: {
  state:    AnimationStateV2;
  lib:      AnimationLibrary;
  onChange: () => void;
}) {
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];

    const so = state.selectorOverrides ?? {};
    Object.entries(so).forEach(([selector, entry]) => {
      const r = entry?.rule;
      if (!r || !r.preset) return;
      out.push({
        kind:     'selector',
        selector,
        label:    entry.label || selector,
        preset:   r.preset,
        rule:     r,
      });
    });

    Object.entries(state.elementRules || {}).forEach(([typeId, rule]) => {
      if (!rule || !rule.preset || rule.preset === 'none' || rule.enabled === false) return;
      const type = lib.elementTypes.find((t) => t.id === typeId);
      if (!type) return;
      let count = 0;
      try { count = document.querySelectorAll(type.selectors.join(',')).length; } catch {}
      if (!count) return;
      out.push({
        kind:     'element',
        selector: type.selectors.join(', '),
        label:    `${type.label}  ·  ${count} on page`,
        preset:   rule.preset,
        rule,
      });
    });

    return out;
  }, [state.selectorOverrides, state.elementRules, lib.elementTypes]);

  if (rows.length === 0) {
    return (
      <div className="tsa-am-audit tsa-am-audit--empty">
        <span>No animation rules yet. Pick a Style or use Animate Mode to add some.</span>
      </div>
    );
  }

  return (
    <div className="tsa-am-audit">
      <header className="tsa-am-audit__head">
        <strong>Animated elements</strong>
        <span className="tsa-am-audit__count">{rows.length}</span>
      </header>
      <ul className="tsa-am-audit__list" role="list">
        {rows.map((row) => (
          <AuditRow key={row.kind + ':' + row.selector} row={row} lib={lib} onChange={onChange} />
        ))}
      </ul>
    </div>
  );
}

interface Row {
  kind:     'selector' | 'element';
  selector: string;
  label:    string;
  preset:   string;
  rule:     AnimationRule;
}

function AuditRow({ row, lib, onChange }: { row: Row; lib: AnimationLibrary; onChange: () => void }) {
  const presetMeta = lib.presets.find((p) => p.id === row.preset);
  const kindBadge  = row.kind === 'selector' ? '4' : '1';
  const kindTitle  = row.kind === 'selector'
    ? 'Selector override (Animate Mode)'
    : 'Element rule from active profile';

  function locate() {
    let nodes: Element[] = [];
    try { nodes = Array.from(document.querySelectorAll(row.selector)); } catch {}
    if (!nodes.length) {
      toast.error(`No element found for "${row.selector}".`);
      return;
    }
    const first   = nodes[0] as HTMLElement;
    first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const prev    = first.style.outline;
    const prevOff = first.style.outlineOffset;
    const prevTr  = first.style.transition;
    first.style.transition    = 'outline 200ms ease';
    first.style.outline       = '3px solid #10b981';
    first.style.outlineOffset = '2px';
    setTimeout(() => {
      first.style.outline       = prev;
      first.style.outlineOffset = prevOff;
      first.style.transition    = prevTr;
    }, 1400);
  }

  async function remove() {
    if (row.kind !== 'selector') return; // element rules are managed by profiles
    try {
      await api.deleteSelectorOverride(row.selector);
      type Win = { tempaloo?: { studio?: { animV2?: { selectorOverrides?: Record<string, unknown> } } } };
      const v2 = (window as unknown as Win).tempaloo?.studio?.animV2;
      if (v2 && v2.selectorOverrides) delete v2.selectorOverrides[row.selector];
      try {
        document.querySelectorAll(row.selector).forEach((el) => {
          const ctx = (el as unknown as { __tw_anim_ctx?: { revert: () => void } }).__tw_anim_ctx;
          if (ctx && typeof ctx.revert === 'function') ctx.revert();
        });
      } catch {}
      toast.info(`Removed override for ${row.selector}`);
      onChange();
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    }
  }

  return (
    <li className="tsa-am-audit__row">
      <span className={'tsa-am-audit__kind tsa-am-audit__kind--' + row.kind} title={kindTitle}>{kindBadge}</span>
      <div className="tsa-am-audit__main">
        <div className="tsa-am-audit__label">{row.label}</div>
        <div className="tsa-am-audit__sub">
          <code>{row.selector}</code>
          <span className="tsa-am-audit__preset">{presetMeta?.label ?? row.preset}</span>
        </div>
      </div>
      <div className="tsa-am-audit__actions">
        <button type="button" className="tsa-am-audit__btn" onClick={locate} title="Scroll to and flash">⌖</button>
        {row.kind === 'selector' && (
          <button
            type="button"
            className="tsa-am-audit__btn tsa-am-audit__btn--danger"
            onClick={remove}
            title="Delete selector override"
          >×</button>
        )}
      </div>
    </li>
  );
}
