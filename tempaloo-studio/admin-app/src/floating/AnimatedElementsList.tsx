import { useMemo } from 'react';
import { api, type AnimationLibrary, type AnimationRule, type AnimationStateV2 } from '../api';
import { toast } from '../components/Toast';

/**
 * Audit list of all currently animated elements on the page.
 *
 * Surfaces (in priority order):
 *   1. Niveau 4 — selectorOverrides (pinned via Animate Mode)
 *   2. Niveau 2 — widgetOverrides (template scopes)
 *   3. Niveau 1 — elementRules (only enabled, only those that currently
 *      have nodes on the page)
 *
 * Each row offers:
 *   • Locate — scrolls the element into view + flashes a green border
 *   • Delete — for selectorOverrides only; widget overrides → "inherit"
 *
 * Element Rules are read-only here (use the Wizard's Step 3 to edit them).
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

    // Niveau 4 — selector overrides (most specific, listed first)
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

    // Niveau 2 — widget overrides
    const wo = state.widgetOverrides ?? {};
    Object.entries(wo).forEach(([widget, rule]) => {
      const r = rule as AnimationRule;
      if (!r || !r.preset) return;
      out.push({
        kind:     'widget',
        selector: `[data-tw-anim-scope="${widget}"]`,
        label:    widget,
        preset:   r.preset,
        rule:     r,
      });
    });

    // Niveau 1 — element rules (read-only summary; one entry per type)
    Object.entries(state.elementRules || {}).forEach(([typeId, rule]) => {
      if (!rule || !rule.preset || rule.preset === 'none' || rule.enabled === false) return;
      const type = lib.elementTypes.find((t) => t.id === typeId);
      if (!type) return;
      // Count nodes currently in the DOM that this rule would target.
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
  }, [state.selectorOverrides, state.widgetOverrides, state.elementRules, lib.elementTypes]);

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
  kind:     'selector' | 'widget' | 'element';
  selector: string;
  label:    string;
  preset:   string;
  rule:     AnimationRule;
}

function AuditRow({ row, lib, onChange }: { row: Row; lib: AnimationLibrary; onChange: () => void }) {
  const presetMeta = lib.presets.find((p) => p.id === row.preset);
  const kindBadge = row.kind === 'selector' ? '4' : row.kind === 'widget' ? '2' : '1';
  const kindTitle =
    row.kind === 'selector' ? 'Selector override (most specific)' :
    row.kind === 'widget'   ? 'Widget override (template scope)'  :
                              'Element rule (per-tag)';

  function locate() {
    let nodes: Element[] = [];
    try { nodes = Array.from(document.querySelectorAll(row.selector)); } catch {}
    if (!nodes.length) {
      toast.error(`No element found for "${row.selector}".`);
      return;
    }
    const first = nodes[0] as HTMLElement;
    first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Flash an outline so the user can see what was just selected.
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
    if (row.kind === 'selector') {
      try {
        await api.deleteSelectorOverride(row.selector);
        // Clear runtime payload + revert inline styles in place.
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
      return;
    }

    if (row.kind === 'widget') {
      // Set widget back to inherit — empty rule.
      try {
        const slug = (window as unknown as { tempaloo?: { studio?: { animV2?: { templateSlug?: string } } } })
          .tempaloo?.studio?.animV2?.templateSlug;
        if (!slug) { toast.error('No active template'); return; }
        await api.setWidgetOverride(slug, row.label, {
          enabled: true, preset: '', params: {}, scrollTrigger: {},
        });
        toast.info(`Widget "${row.label}" set to inherit`);
        onChange();
      } catch (e) {
        toast.error(`Update failed: ${(e as Error).message}`);
      }
      return;
    }

    if (row.kind === 'element') {
      const typeId = row.label.split(' ')[0]; // best-effort; user can also use Reset in Step 3
      try {
        await api.resetElementRule(typeId);
        toast.info(`Element rule for ${typeId} reset to default`);
        onChange();
      } catch (e) {
        toast.error(`Reset failed: ${(e as Error).message}`);
      }
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
        <button type="button" className="tsa-am-audit__btn tsa-am-audit__btn--danger" onClick={remove} title={
          row.kind === 'selector' ? 'Delete selector override' :
          row.kind === 'widget'   ? 'Set widget to inherit'    :
                                    'Reset element rule to default'
        }>×</button>
      </div>
    </li>
  );
}
