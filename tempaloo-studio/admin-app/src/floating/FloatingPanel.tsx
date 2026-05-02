import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppState, TemplateFull } from '../types';
import { api } from '../api';

type Mode = 'light' | 'dark';

const HIDDEN_BELOW = 768;

/**
 * Floating color editor — panel mounted at the bottom-right of the
 * page (frontend + Elementor preview iframe). Edits are applied
 * LIVE via `document.documentElement.style.setProperty()` so the
 * underlying page reflects every change instantly. "Save" persists
 * via REST; "Discard" reverts the inline overrides without saving.
 *
 * Capability check is enforced server-side (Floating_Panel.php) —
 * the bundle is only enqueued for users with manage_options.
 */
export function FloatingPanel() {
  const [open,         setOpen]         = useState(false);
  const [mounted,      setMounted]      = useState(false);
  const [state,        setState]        = useState<AppState | null>(null);
  const [tpl,          setTpl]          = useState<TemplateFull | null>(null);
  const [drafts,       setDrafts]       = useState<Record<Mode, Record<string, string>>>({ light: {}, dark: {} });
  const [activeMode,   setActiveMode]   = useState<Mode>('light');
  const [inspectMode,  setInspectMode]  = useState(false);
  const [inspectFilter, setInspectFilter] = useState<string[] | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [hint,         setHint]         = useState<string>('');
  const liveAppliedKeys = useRef<Set<string>>(new Set());

  // Hide on small screens (mobile) — declared not as a render guard
  // (would cause hooks issues if width changes) but as a CSS fallback
  // via a state flag.
  const [tooSmall, setTooSmall] = useState(false);
  useEffect(() => {
    const check = () => setTooSmall(window.innerWidth < HIDDEN_BELOW);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Track the page's current data-theme so the panel edits the right mode.
  useEffect(() => {
    const html = document.documentElement;
    const sync = () => {
      const t = html.getAttribute('data-theme');
      if (t === 'light' || t === 'dark') setActiveMode(t);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Boot data.
  useEffect(() => {
    let cancelled = false;
    api.state().then(async (s) => {
      if (cancelled) return;
      setState(s);
      if (s.active_slug) {
        const t = await api.getTemplate(s.active_slug);
        if (cancelled) return;
        setTpl(t);
        const o = s.overrides?.[s.active_slug] ?? {};
        setDrafts({
          light: { ...(t.tokens?.light ?? {}), ...(o.light ?? {}) },
          dark:  { ...(t.tokens?.dark  ?? {}), ...(o.dark  ?? {}) },
        });
      }
      setMounted(true);
    }).catch(() => setMounted(true));
    return () => { cancelled = true; };
  }, []);

  // Live preview — apply draft values to the page's <html> via
  // style.setProperty(). Only color-shaped values; tracked keys are
  // cleared on Discard so the page snaps back to persisted state.
  useEffect(() => {
    const html = document.documentElement;
    const draftMode = drafts[activeMode] || {};
    const baseline = (tpl?.tokens?.[activeMode]) || {};
    const mergedKeys = Object.keys(draftMode);
    mergedKeys.forEach((k) => {
      if (!k.startsWith('--tw-')) return;
      const v = draftMode[k];
      if (v === baseline[k]) return; // matches default — no override needed
      html.style.setProperty(k, v);
      liveAppliedKeys.current.add(k);
    });
  }, [drafts, activeMode, tpl]);

  function setVal(name: string, value: string) {
    setDrafts((d) => ({ ...d, [activeMode]: { ...d[activeMode], [name]: value } }));
  }

  function discard() {
    if (!tpl || !state) return;
    // Restore drafts to last-saved state.
    const o = state.overrides?.[state.active_slug ?? ''] ?? {};
    const next: Record<Mode, Record<string, string>> = {
      light: { ...(tpl.tokens?.light ?? {}), ...(o.light ?? {}) },
      dark:  { ...(tpl.tokens?.dark  ?? {}), ...(o.dark  ?? {}) },
    };
    setDrafts(next);
    // Clear the inline overrides we applied for the live preview.
    const html = document.documentElement;
    liveAppliedKeys.current.forEach((k) => html.style.removeProperty(k));
    liveAppliedKeys.current.clear();
    setHint('Draft discarded.');
    window.setTimeout(() => setHint(''), 2200);
  }

  async function save() {
    if (!state?.active_slug || !tpl) return;
    setSaving(true);
    try {
      const baseL = tpl.tokens?.light ?? {};
      const baseD = tpl.tokens?.dark ?? {};
      const deltaL: Record<string, string> = {};
      const deltaD: Record<string, string> = {};
      Object.keys(drafts.light).forEach((k) => { if (drafts.light[k] !== baseL[k]) deltaL[k] = drafts.light[k]; });
      Object.keys(drafts.dark).forEach((k)  => { if (drafts.dark[k]  !== baseD[k]) deltaD[k] = drafts.dark[k]; });
      let next = await api.saveTokens(state.active_slug, 'light', deltaL);
      next     = await api.saveTokens(state.active_slug, 'dark',  deltaD);
      setState(next);
      setHint('Saved ✓');
      window.setTimeout(() => setHint(''), 2400);
    } catch (e) {
      setHint(`Save failed: ${(e as Error).message}`);
      window.setTimeout(() => setHint(''), 5000);
    } finally {
      setSaving(false);
    }
  }

  // Diff count for the Save button label.
  const dirtyCount = useMemo(() => {
    if (!tpl) return 0;
    const baseL = tpl.tokens?.light ?? {};
    const baseD = tpl.tokens?.dark ?? {};
    let n = 0;
    Object.keys(drafts.light).forEach((k) => { if (drafts.light[k] !== baseL[k]) n++; });
    Object.keys(drafts.dark).forEach((k)  => { if (drafts.dark[k]  !== baseD[k]) n++; });
    return n;
  }, [drafts, tpl]);

  const tokenNames = useMemo(() => {
    if (!tpl) return [] as string[];
    const all = Object.keys(drafts[activeMode]);
    return all
      .filter((k) => {
        const v = drafts[activeMode][k] || '';
        return /^(#|rgb|hsl)/i.test(v) || v === 'transparent' || v.startsWith('rgba');
      })
      .filter((k) => !inspectFilter || inspectFilter.includes(k))
      .sort();
  }, [drafts, activeMode, tpl, inspectFilter]);

  if (tooSmall || !mounted) return null;
  if (!state?.active_slug || !tpl) return null;

  if (!open) {
    return (
      <button
        type="button"
        className="tsa-fp-toggle"
        onClick={() => setOpen(true)}
        title="Open color editor"
        aria-label="Open Tempaloo color editor"
      >
        <span className="tsa-fp-toggle__inner">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="8" cy="8" r="6" />
            <path d="M5 8a3 3 0 0 0 3 3M11 8a3 3 0 0 0-3-3" />
          </svg>
        </span>
      </button>
    );
  }

  return (
    <div className="tsa-fp" role="dialog" aria-label="Tempaloo color editor">
      <header className="tsa-fp__header">
        <span className="tsa-fp__title">{tpl.name}</span>
        <span className="tsa-fp__mode">{activeMode}</span>
        {dirtyCount > 0 && <span className="tsa-fp__dirty">● {dirtyCount} unsaved</span>}
        <button type="button" className="tsa-fp__icon" onClick={() => setOpen(false)} aria-label="Minimize">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M3 8h10" />
          </svg>
        </button>
      </header>

      <div className="tsa-fp__toolbar">
        <button
          type="button"
          className={'tsa-fp__btn' + (inspectMode ? ' is-active' : '')}
          onClick={() => setInspectMode((v) => !v)}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 2h6v6H2z" /><path d="M8 8l6 6M11 14h3v-3" />
          </svg>
          {inspectMode ? 'Click any element…' : 'Inspect'}
        </button>
        {inspectFilter && (
          <button type="button" className="tsa-fp__btn" onClick={() => setInspectFilter(null)}>
            Show all ({Object.keys(drafts[activeMode]).length})
          </button>
        )}
        <span className="tsa-fp__count">{tokenNames.length} colors</span>
      </div>

      {inspectMode && (
        <InspectOverlay
          tokens={drafts[activeMode]}
          onPick={(matched, label) => {
            setInspectMode(false);
            setInspectFilter(matched);
            setHint(`Filtered to ${matched.length} colors used by ${label}.`);
            window.setTimeout(() => setHint(''), 3000);
          }}
          onCancel={() => setInspectMode(false)}
        />
      )}

      <div className="tsa-fp__list">
        {tokenNames.length === 0 && (
          <div className="tsa-fp__empty">No matching color tokens.</div>
        )}
        {tokenNames.map((name) => (
          <ColorRow
            key={name + '-' + activeMode}
            name={name}
            value={drafts[activeMode][name]}
            onChange={(v) => setVal(name, v)}
          />
        ))}
      </div>

      <footer className="tsa-fp__footer">
        {hint && <span className="tsa-fp__hint">{hint}</span>}
        <button type="button" className="tsa-fp__btn" onClick={discard} disabled={dirtyCount === 0}>
          Discard
        </button>
        <button type="button" className="tsa-fp__btn tsa-fp__btn--primary" onClick={save} disabled={saving || dirtyCount === 0}>
          {saving ? 'Saving…' : (dirtyCount > 0 ? `Save ${dirtyCount}` : 'Saved')}
        </button>
      </footer>
    </div>
  );
}

function ColorRow({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }) {
  const isHex = /^#[0-9a-f]{3,8}$/i.test(value);
  const display = name.replace(/^--tw-[^-]+-/, '');
  return (
    <div className="tsa-fp__row">
      <label className="tsa-fp__swatch" title={isHex ? 'Pick a color' : 'Edit value below (hex picker disabled for non-hex)'}>
        <span className="tsa-fp__swatch-bg" />
        <span className="tsa-fp__swatch-fill" style={{ background: value }} />
        <input
          type="color"
          value={isHex ? value.slice(0, 7) : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`Pick color for ${name}`}
        />
      </label>
      <span className="tsa-fp__name" title={name}>{display}</span>
      <input
        type="text"
        className="tsa-fp__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
    </div>
  );
}

/**
 * Inspect overlay — temporary mouse listener that highlights elements
 * on hover and, on click, finds which CSS tokens match the element's
 * computed colors. Approach 2 (DOM scan): no per-widget declaration
 * needed, works on any markup.
 */
function InspectOverlay({
  tokens, onPick, onCancel,
}: {
  tokens: Record<string, string>;
  onPick: (matched: string[], label: string) => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    let lastHover: HTMLElement | null = null;
    let prevOutline = '';

    const isPanel = (el: Element | null): boolean => {
      return !!el && (el.id === 'tempaloo-studio-floating-root' || !!el.closest('#tempaloo-studio-floating-root'));
    };

    const onMouseMove = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el || isPanel(el)) return;
      if (lastHover === el) return;
      if (lastHover) lastHover.style.outline = prevOutline;
      prevOutline = el.style.outline || '';
      el.style.outline = '2px solid #818cf8';
      el.style.outlineOffset = '-2px';
      lastHover = el;
    };

    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el || isPanel(el)) return;
      e.preventDefault();
      e.stopPropagation();

      // Reverse-lookup tokens that match this element's computed colors.
      const cs = window.getComputedStyle(el);
      const colors = [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor];
      const matched: string[] = [];
      Object.entries(tokens).forEach(([name, value]) => {
        const norm = normalizeColor(value);
        if (colors.some((c) => normalizeColor(c) === norm)) matched.push(name);
      });

      // Build a friendly label: closest [class*="tw-…"] ancestor name.
      const scopeEl = el.closest('[data-tw-anim-scope]') as HTMLElement | null;
      const widget = scopeEl ? scopeEl.getAttribute('data-tw-anim-scope') : null;
      const tag = el.tagName.toLowerCase();
      const label = widget ? `${widget} (${tag})` : tag;

      if (lastHover) lastHover.style.outline = prevOutline;
      onPick(matched, label);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lastHover) lastHover.style.outline = prevOutline;
        onCancel();
      }
    };

    document.body.style.cursor = 'crosshair';
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey);

    return () => {
      document.body.style.cursor = '';
      if (lastHover) lastHover.style.outline = prevOutline;
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [tokens, onPick, onCancel]);

  return null;
}

/**
 * Normalize any CSS color string to its computed rgb()/rgba() form.
 * The browser's getComputedStyle returns rgb() always; we route every
 * input through the same browser parser so comparisons are consistent.
 */
function normalizeColor(c: string): string {
  if (!c) return '';
  if (c === 'transparent') return 'rgba(0, 0, 0, 0)';
  const probe = document.createElement('span');
  probe.style.color = c;
  // Render off-screen to force computation.
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  document.body.appendChild(probe);
  const computed = window.getComputedStyle(probe).color;
  document.body.removeChild(probe);
  return computed;
}
