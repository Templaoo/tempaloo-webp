import { useMemo, useState, useCallback } from 'react';
import { api, type AnimationLibrary, type AnimationRule, type AnimationStateV2 } from '../api';
import { toast } from '../components/Toast';

/**
 * Audit list of every element currently animated on the page.
 *
 * Two row kinds:
 *   1. selector — Niveau 4 selectorOverride pinned via Animate Mode.
 *      Selectable + deletable. Single delete via the per-row × button,
 *      or multi-delete via the toolbar (checkboxes + "Delete selected").
 *   2. element  — Niveau 1 elementRule injected by the active profile.
 *      Read-only: Locate only (lifecycle belongs to the profile). To
 *      remove all element rules at once, switch profile or use the
 *      master "Animations enabled" toggle in AnimationView.
 *
 * Toolbar appears when at least one selector row exists. It lets the
 * user select all selectors / clear / bulk-delete in one round-trip.
 */
export function AnimatedElementsList({
  state, lib, onChange,
}: {
  state:    AnimationStateV2;
  lib:      AnimationLibrary;
  onChange: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

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

  const selectorRows = rows.filter((r) => r.kind === 'selector');
  const allSelectorsSelected = selectorRows.length > 0 && selectorRows.every((r) => selected.has(r.selector));

  const toggleOne = useCallback((selector: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(selector)) next.delete(selector);
      else next.add(selector);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(selectorRows.map((r) => r.selector)));
  }, [selectorRows]);

  const clearAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  async function bulkDelete() {
    if (bulkDeleting || selected.size === 0) return;
    const selectors = Array.from(selected);
    if (!window.confirm(
      `Delete ${selectors.length} selector override${selectors.length > 1 ? 's' : ''}? This cannot be undone.`
    )) return;

    setBulkDeleting(true);
    try {
      const res = await api.deleteSelectorOverridesBulk(selectors);
      type Win = { tempaloo?: { studio?: { animV2?: { selectorOverrides?: Record<string, unknown> } } } };
      const v2 = (window as unknown as Win).tempaloo?.studio?.animV2;

      // Clear runtime payload + revert inline styles for each deleted selector.
      selectors.forEach((sel) => {
        if (v2?.selectorOverrides) delete v2.selectorOverrides[sel];
        try {
          document.querySelectorAll(sel).forEach((el) => {
            const ctx = (el as unknown as { __tw_anim_ctx?: { revert: () => void } }).__tw_anim_ctx;
            if (ctx && typeof ctx.revert === 'function') ctx.revert();
          });
        } catch {}
      });

      const failedCount = res._bulk?.failed?.length ?? 0;
      const deletedCount = res._bulk?.deleted?.length ?? selectors.length;
      if (failedCount > 0) {
        toast.error(`${deletedCount} deleted, ${failedCount} failed.`);
      } else {
        toast.info(`Deleted ${deletedCount} selector override${deletedCount > 1 ? 's' : ''}.`);
      }
      setSelected(new Set());
      onChange();
    } catch (e) {
      toast.error(`Bulk delete failed: ${(e as Error).message}`);
    } finally {
      setBulkDeleting(false);
    }
  }

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

      {selectorRows.length > 0 && (
        <div className="tsa-am-audit__toolbar">
          <label className="tsa-am-audit__toolbar-check" title="Select all selector overrides">
            <input
              type="checkbox"
              checked={allSelectorsSelected}
              onChange={() => (allSelectorsSelected ? clearAll() : selectAll())}
            />
            <span>Select all ({selectorRows.length})</span>
          </label>
          {selected.size > 0 && (
            <>
              <span className="tsa-am-audit__toolbar-spacer" />
              <button
                type="button"
                className="tsa-am-audit__toolbar-btn"
                onClick={clearAll}
                disabled={bulkDeleting}
              >
                Clear
              </button>
              <button
                type="button"
                className="tsa-am-audit__toolbar-btn tsa-am-audit__toolbar-btn--danger"
                onClick={bulkDelete}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? 'Deleting…' : `Delete selected (${selected.size})`}
              </button>
            </>
          )}
        </div>
      )}

      <ul className="tsa-am-audit__list" role="list">
        {rows.map((row) => (
          <AuditRow
            key={row.kind + ':' + row.selector}
            row={row}
            lib={lib}
            isSelected={selected.has(row.selector)}
            onToggleSelect={() => toggleOne(row.selector)}
            onChange={onChange}
          />
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

function AuditRow({
  row, lib, isSelected, onToggleSelect, onChange,
}: {
  row:            Row;
  lib:            AnimationLibrary;
  isSelected:     boolean;
  onToggleSelect: () => void;
  onChange:       () => void;
}) {
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
    <li className={'tsa-am-audit__row' + (isSelected ? ' is-selected' : '')}>
      {row.kind === 'selector' ? (
        <input
          type="checkbox"
          className="tsa-am-audit__checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          aria-label={`Select ${row.label}`}
        />
      ) : (
        // Spacer to keep grid alignment when no checkbox is rendered
        // for element-rule rows.
        <span className="tsa-am-audit__checkbox tsa-am-audit__checkbox--placeholder" aria-hidden="true" />
      )}
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
