import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppState, TemplateFull } from '../types';
import { api } from '../api';

type Mode = 'light' | 'dark';

const HIDDEN_BELOW   = 768;
const STORAGE_POS    = 'tempaloo-fp-pos';
const STORAGE_SIZE   = 'tempaloo-fp-size';
const STORAGE_OPEN_CATS = 'tempaloo-fp-open-cats';
const STYLE_ID       = 'tempaloo-studio-floating-preview';

const DEFAULT_SIZE = { w: 380, h: 620 };
const MIN_SIZE     = { w: 320, h: 380 };

/* ─── Token categorization (colors only — Phase 3.0 scope) ────── */

interface CategoryDef {
  id:    string;
  label: string;
  match: (name: string) => boolean;
}

const CATEGORIES: CategoryDef[] = [
  { id: 'bg',     label: 'Backgrounds', match: (n) => /^--tw-[^-]+-bg(-|$)/.test(n) },
  { id: 'text',   label: 'Text',        match: (n) => /^--tw-[^-]+-text(-|$)/.test(n) },
  { id: 'accent', label: 'Accent',      match: (n) => /-accent(-|$)/.test(n) },
  { id: 'border', label: 'Borders',     match: (n) => /-border(-|$)/.test(n) },
  { id: 'cta',    label: 'Buttons',     match: (n) => /-(cta|btn)-/.test(n) },
  { id: 'state',  label: 'States',      match: (n) => /-(success|warning|danger|info)/.test(n) },
];

function categoryOf(name: string): string {
  for (const c of CATEGORIES) if (c.match(name)) return c.id;
  return 'other';
}

function isColorValue(v: string): boolean {
  if (!v) return false;
  const t = v.trim();
  return /^(#|rgb|hsl)/i.test(t) || t === 'transparent' || t === 'currentColor';
}

/* ─── Live preview via injected <style> — mode-scoped ──────────
 *
 * Inline style.setProperty on <html> applies GLOBALLY, ignoring
 * data-theme. So overriding --tw-avero-bg from the panel in light
 * mode would also win in dark mode → both modes show the same color.
 *
 * The fix: inject a single <style id="…-floating-preview"> with
 * `:root{}` for light overrides and `[data-theme="dark"]{}` for
 * dark overrides. Cascade respects the mode swap.
 */
function applyPreview(drafts: Record<Mode, Record<string, string>>, tpl: TemplateFull | null) {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  const baseL = tpl?.tokens?.light ?? {};
  const baseD = tpl?.tokens?.dark  ?? {};
  const lightDecls = Object.entries(drafts.light)
    .filter(([k, v]) => k.startsWith('--tw-') && v !== baseL[k])
    .map(([k, v]) => `${k}:${v}`).join(';');
  const darkDecls = Object.entries(drafts.dark)
    .filter(([k, v]) => k.startsWith('--tw-') && v !== baseD[k])
    .map(([k, v]) => `${k}:${v}`).join(';');
  let css = '';
  if (lightDecls) css += `:root{${lightDecls}}\n`;
  if (darkDecls)  css += `[data-theme="dark"]{${darkDecls}}\n`;
  el.textContent = css;
}

/* ─── Element role detection (for inspect tooltip) ────────────── */

function elementRole(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const cls = el.className && typeof el.className === 'string' ? el.className : '';
  if (/h[1-6]/.test(tag))                        return 'headline';
  if (tag === 'p')                                return 'paragraph';
  if (tag === 'img' || tag === 'picture')         return 'image';
  if (tag === 'svg' || tag === 'path')            return 'icon';
  if (tag === 'nav')                              return 'navigation';
  if (tag === 'button')                           return 'button';
  if (tag === 'a' && /(cta|btn|button)/.test(cls)) return 'button';
  if (tag === 'a')                                return 'link';
  if (/(card|tier|feature|item)/.test(cls))       return 'card';
  if (/(badge|pill|chip|tag)/.test(cls))          return 'pill';
  if (tag === 'section')                          return 'section';
  if (tag === 'header')                           return 'header';
  if (tag === 'footer')                           return 'footer';
  return tag;
}

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {}
  return fallback;
}

function writeStored(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

/* ============================================================
 * FloatingPanel — production-grade
 * ============================================================ */

export function FloatingPanel() {
  // Boot state
  const [mounted,    setMounted]    = useState(false);
  const [state,      setState]      = useState<AppState | null>(null);
  const [tpl,        setTpl]        = useState<TemplateFull | null>(null);
  const [drafts,     setDrafts]     = useState<Record<Mode, Record<string, string>>>({ light: {}, dark: {} });
  const [activeMode, setActiveMode] = useState<Mode>('light');
  const [followPage, setFollowPage] = useState(true);
  const [tooSmall,   setTooSmall]   = useState(false);

  // Panel UI state
  const [open,       setOpen]       = useState(false);
  const [maximized,  setMaximized]  = useState(false);
  const [pos,        setPos]        = useState(() => readStored(STORAGE_POS, { x: -1, y: -1 }));
  const [size,       setSize]       = useState(() => readStored(STORAGE_SIZE, DEFAULT_SIZE));
  const [openCats,   setOpenCats]   = useState<Set<string>>(() => new Set(readStored<string[]>(STORAGE_OPEN_CATS, ['bg','text','accent','cta'])));

  // Inspect state
  const [inspectMode,   setInspectMode]   = useState(false);
  const [inspectFilter, setInspectFilter] = useState<string[] | null>(null);
  const [inspectLabel,  setInspectLabel]  = useState<string>('');

  // Save / hint
  const [saving, setSaving] = useState(false);
  const [hint,   setHint]   = useState<string>('');

  /* ── Responsive guard ──────────────────────────────────── */
  useEffect(() => {
    const check = () => setTooSmall(window.innerWidth < HIDDEN_BELOW);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  /* ── Sync with page data-theme (one-way unless user opts out) */
  useEffect(() => {
    const html = document.documentElement;
    const sync = () => {
      const t = html.getAttribute('data-theme');
      if (followPage && (t === 'light' || t === 'dark')) setActiveMode(t);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [followPage]);

  /* ── Boot data ─────────────────────────────────────────── */
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

  /* ── Live preview — re-inject <style> on every draft change */
  useEffect(() => { if (tpl) applyPreview(drafts, tpl); }, [drafts, tpl]);

  /* ── Persist UI state to localStorage ───────────────────── */
  useEffect(() => { writeStored(STORAGE_POS,  pos);  }, [pos]);
  useEffect(() => { writeStored(STORAGE_SIZE, size); }, [size]);
  useEffect(() => { writeStored(STORAGE_OPEN_CATS, Array.from(openCats)); }, [openCats]);

  /* ── Drag (from header) ─────────────────────────────────── */
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  function onDragStart(e: React.PointerEvent) {
    if (maximized) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  }
  function onDragMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    const max_x = window.innerWidth  - 80;
    const max_y = window.innerHeight - 60;
    setPos({
      x: Math.max(20 - size.w + 80, Math.min(max_x, dragRef.current.px + dx)),
      y: Math.max(20, Math.min(max_y, dragRef.current.py + dy)),
    });
  }
  function onDragEnd(e: React.PointerEvent) {
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    dragRef.current = null;
  }

  /* ── Resize (bottom-right corner) ───────────────────────── */
  const resizeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  function onResizeStart(e: React.PointerEvent) {
    if (maximized) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizeRef.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
  }
  function onResizeMove(e: React.PointerEvent) {
    if (!resizeRef.current) return;
    e.stopPropagation();
    const dw = e.clientX - resizeRef.current.x;
    const dh = e.clientY - resizeRef.current.y;
    const maxW = Math.min(window.innerWidth  - 40, 800);
    const maxH = Math.min(window.innerHeight - 40, 900);
    setSize({
      w: Math.max(MIN_SIZE.w, Math.min(maxW, resizeRef.current.w + dw)),
      h: Math.max(MIN_SIZE.h, Math.min(maxH, resizeRef.current.h + dh)),
    });
  }
  function onResizeEnd(e: React.PointerEvent) {
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    resizeRef.current = null;
  }

  /* ── Edit / discard / save ─────────────────────────────── */

  function setVal(name: string, value: string) {
    setDrafts((d) => ({ ...d, [activeMode]: { ...d[activeMode], [name]: value } }));
  }

  function switchMode(next: Mode) {
    setActiveMode(next);
    if (followPage) document.documentElement.setAttribute('data-theme', next);
  }

  function resetMode(mode: Mode) {
    if (!tpl) return;
    if (!window.confirm(`Reset all ${mode} mode colors to template defaults? Unsaved drafts in ${mode} will be lost.`)) return;
    setDrafts((d) => ({ ...d, [mode]: { ...(tpl.tokens?.[mode] ?? {}) } }));
    setHintFlash(`Reset ${mode} mode (drafts only — click Save to persist).`);
  }

  function resetAll() {
    if (!tpl) return;
    if (!window.confirm('Reset BOTH light and dark to template defaults? Unsaved drafts will be lost.')) return;
    setDrafts({
      light: { ...(tpl.tokens?.light ?? {}) },
      dark:  { ...(tpl.tokens?.dark  ?? {}) },
    });
    setHintFlash('Reset both modes (drafts only — click Save to persist).');
  }

  function discard() {
    if (!tpl || !state) return;
    const o = state.overrides?.[state.active_slug ?? ''] ?? {};
    setDrafts({
      light: { ...(tpl.tokens?.light ?? {}), ...(o.light ?? {}) },
      dark:  { ...(tpl.tokens?.dark  ?? {}), ...(o.dark  ?? {}) },
    });
    setHintFlash('Draft discarded.');
  }

  function setHintFlash(msg: string, ms = 2400) {
    setHint(msg);
    window.setTimeout(() => setHint(''), ms);
  }

  async function save() {
    if (!state?.active_slug || !tpl) return;
    setSaving(true);
    try {
      const baseL = tpl.tokens?.light ?? {};
      const baseD = tpl.tokens?.dark  ?? {};
      const deltaL: Record<string, string> = {};
      const deltaD: Record<string, string> = {};
      Object.keys(drafts.light).forEach((k) => { if (drafts.light[k] !== baseL[k]) deltaL[k] = drafts.light[k]; });
      Object.keys(drafts.dark).forEach((k)  => { if (drafts.dark[k]  !== baseD[k]) deltaD[k] = drafts.dark[k]; });
      let next = await api.saveTokens(state.active_slug, 'light', deltaL);
      next     = await api.saveTokens(state.active_slug, 'dark',  deltaD);
      setState(next);
      setHintFlash('Saved ✓');
    } catch (e) {
      setHintFlash(`Save failed: ${(e as Error).message}`, 5000);
    } finally {
      setSaving(false);
    }
  }

  /* ── Diff counts (per mode) ─────────────────────────────── */

  const dirty = useMemo(() => {
    if (!tpl) return { light: 0, dark: 0, total: 0 };
    let l = 0, d = 0;
    const baseL = tpl.tokens?.light ?? {};
    const baseD = tpl.tokens?.dark  ?? {};
    Object.keys(drafts.light).forEach((k) => { if (drafts.light[k] !== baseL[k]) l++; });
    Object.keys(drafts.dark).forEach((k)  => { if (drafts.dark[k]  !== baseD[k]) d++; });
    return { light: l, dark: d, total: l + d };
  }, [drafts, tpl]);

  /* ── Token grouping for the active mode ──────────────────── */

  const grouped = useMemo(() => {
    if (!tpl) return {} as Record<string, string[]>;
    const out: Record<string, string[]> = {};
    Object.keys(drafts[activeMode])
      .filter((k) => isColorValue(drafts[activeMode][k] || ''))
      .filter((k) => !inspectFilter || inspectFilter.includes(k))
      .sort()
      .forEach((k) => {
        const cat = categoryOf(k);
        (out[cat] ||= []).push(k);
      });
    return out;
  }, [drafts, activeMode, tpl, inspectFilter]);

  function toggleCat(id: string) {
    setOpenCats((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /* ── Render ─────────────────────────────────────────────── */

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
          {dirty.total > 0 && <span className="tsa-fp-toggle__badge">{dirty.total}</span>}
        </span>
      </button>
    );
  }

  // Compute panel positioning
  const initialX = window.innerWidth  - size.w - 20;
  const initialY = window.innerHeight - size.h - 20;
  const finalX   = pos.x === -1 ? initialX : pos.x;
  const finalY   = pos.y === -1 ? initialY : pos.y;

  const panelStyle: React.CSSProperties = maximized
    ? { left: 20, top: 20, right: 20, bottom: 20, width: 'auto', height: 'auto' }
    : { left: finalX, top: finalY, width: size.w, height: size.h };

  return (
    <div className="tsa-fp" role="dialog" aria-label="Tempaloo color editor" style={panelStyle}>

      {/* ── Header (drag handle + window controls) ────────── */}
      <header
        className="tsa-fp__header"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        style={{ cursor: maximized ? 'default' : 'grab' }}
      >
        <span className="tsa-fp__grip" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
            <circle cx="5" cy="4" r="0.7" fill="currentColor"/><circle cx="5" cy="8" r="0.7" fill="currentColor"/><circle cx="5" cy="12" r="0.7" fill="currentColor"/>
            <circle cx="11" cy="4" r="0.7" fill="currentColor"/><circle cx="11" cy="8" r="0.7" fill="currentColor"/><circle cx="11" cy="12" r="0.7" fill="currentColor"/>
          </svg>
        </span>
        <span className="tsa-fp__title">{tpl.name}</span>
        {dirty.total > 0 && <span className="tsa-fp__dirty">● {dirty.total} unsaved</span>}
        <button type="button" className="tsa-fp__icon" onClick={(e) => { e.stopPropagation(); setMaximized((v) => !v); }} title={maximized ? 'Restore' : 'Maximize'}>
          {maximized ? '❐' : '◰'}
        </button>
        <button type="button" className="tsa-fp__icon" onClick={(e) => { e.stopPropagation(); setOpen(false); }} title="Minimize" aria-label="Minimize">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
            <path d="M3 11h10" />
          </svg>
        </button>
      </header>

      {/* ── Mode switcher row ────────────────────────────── */}
      <div className="tsa-fp__moderow">
        <div className="tsa-fp__modeswitch" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === 'light'}
            className={'tsa-fp__modebtn' + (activeMode === 'light' ? ' is-active' : '')}
            onClick={() => switchMode('light')}
          >
            ☀ Light {dirty.light > 0 && <span className="tsa-fp__modebadge">{dirty.light}</span>}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === 'dark'}
            className={'tsa-fp__modebtn' + (activeMode === 'dark' ? ' is-active' : '')}
            onClick={() => switchMode('dark')}
          >
            ☾ Dark {dirty.dark > 0 && <span className="tsa-fp__modebadge">{dirty.dark}</span>}
          </button>
        </div>
        <label className="tsa-fp__follow" title="When on, switching modes also flips the page's data-theme so you see what you're editing.">
          <input type="checkbox" checked={followPage} onChange={(e) => setFollowPage(e.target.checked)} />
          <span>Sync page</span>
        </label>
      </div>

      {/* ── Toolbar: Inspect + Reset ──────────────────────── */}
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
          <button type="button" className="tsa-fp__btn" onClick={() => { setInspectFilter(null); setInspectLabel(''); }}>
            Show all
          </button>
        )}
        <span className="tsa-fp__spacer" />
        <div className="tsa-fp__reset">
          <button type="button" className="tsa-fp__btn tsa-fp__btn--ghost" onClick={() => resetMode('light')} title="Reset light mode to template defaults">↻ L</button>
          <button type="button" className="tsa-fp__btn tsa-fp__btn--ghost" onClick={() => resetMode('dark')}  title="Reset dark mode to template defaults">↻ D</button>
          <button type="button" className="tsa-fp__btn tsa-fp__btn--ghost" onClick={resetAll} title="Reset both modes to template defaults">↻ All</button>
        </div>
      </div>

      {inspectMode && (
        <InspectOverlay
          tokens={drafts[activeMode]}
          onPick={(matched, label) => {
            setInspectMode(false);
            setInspectFilter(matched);
            setInspectLabel(label);
            // Auto-open the categories that contain matched tokens.
            const cats = new Set<string>();
            matched.forEach((t) => cats.add(categoryOf(t)));
            setOpenCats((prev) => new Set([...prev, ...Array.from(cats)]));
            setHintFlash(`${matched.length} colors used by ${label}`, 3500);
          }}
          onCancel={() => setInspectMode(false)}
        />
      )}

      {inspectFilter && inspectLabel && (
        <div className="tsa-fp__inspect-banner">
          📍 <strong>{inspectLabel}</strong> — {inspectFilter.length} colors
        </div>
      )}

      {/* ── Token list (grouped + collapsible) ───────────── */}
      <div className="tsa-fp__list">
        {Object.keys(grouped).length === 0 && (
          <div className="tsa-fp__empty">No matching color tokens.</div>
        )}
        {[...CATEGORIES, { id: 'other', label: 'Other', match: () => true }].map((cat) => {
          const items = grouped[cat.id];
          if (!items || items.length === 0) return null;
          const isOpen = openCats.has(cat.id);
          return (
            <div key={cat.id} className={'tsa-fp__group' + (isOpen ? ' is-open' : '')}>
              <button type="button" className="tsa-fp__group-head" onClick={() => toggleCat(cat.id)}>
                <span className="tsa-fp__chevron">{isOpen ? '▾' : '▸'}</span>
                <span className="tsa-fp__group-name">{cat.label}</span>
                <span className="tsa-fp__group-count">{items.length}</span>
              </button>
              {isOpen && (
                <div className="tsa-fp__group-body">
                  {items.map((name) => (
                    <ColorRow
                      key={name + '-' + activeMode}
                      name={name}
                      value={drafts[activeMode][name]}
                      otherValue={drafts[activeMode === 'light' ? 'dark' : 'light'][name]}
                      otherMode={activeMode === 'light' ? 'dark' : 'light'}
                      onChange={(v) => setVal(name, v)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="tsa-fp__footer">
        {hint && <span className="tsa-fp__hint">{hint}</span>}
        {!hint && dirty.total === 0 && <span className="tsa-fp__hint" style={{ opacity: 0.6 }}>Edits are previewed live. Save to persist.</span>}
        <button type="button" className="tsa-fp__btn" onClick={discard} disabled={dirty.total === 0}>Discard</button>
        <button type="button" className="tsa-fp__btn tsa-fp__btn--primary" onClick={save} disabled={saving || dirty.total === 0}>
          {saving ? 'Saving…' : (dirty.total > 0 ? `Save ${dirty.total}` : 'Saved')}
        </button>
      </footer>

      {/* ── Resize handle (bottom-right) ─────────────────── */}
      {!maximized && (
        <span
          className="tsa-fp__resize"
          onPointerDown={onResizeStart}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeEnd}
          onPointerCancel={onResizeEnd}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/* ─── Color row — shows active mode value editable + small
 *     readonly preview of the OTHER mode for context. */

function ColorRow({
  name, value, otherValue, otherMode, onChange,
}: {
  name:       string;
  value:      string;
  otherValue: string;
  otherMode:  Mode;
  onChange:   (v: string) => void;
}) {
  const isHex   = /^#[0-9a-f]{3,8}$/i.test(value);
  const display = name.replace(/^--tw-[^-]+-/, '');
  const synced  = value === otherValue;

  return (
    <div className="tsa-fp__row">
      <label className="tsa-fp__swatch" title={isHex ? 'Pick a color' : 'Edit value below'}>
        <span className="tsa-fp__swatch-bg" />
        <span className="tsa-fp__swatch-fill" style={{ background: value }} />
        <input
          type="color"
          value={isHex ? value.slice(0, 7) : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`Pick color for ${name}`}
        />
      </label>
      <div className="tsa-fp__row-main">
        <span className="tsa-fp__name" title={name}>{display}</span>
        <input
          type="text"
          className="tsa-fp__input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      </div>
      <span
        className={'tsa-fp__other' + (synced ? ' is-synced' : '')}
        title={`${otherMode} mode: ${otherValue}${synced ? ' (synced)' : ''}`}
      >
        <span className="tsa-fp__other-mode">{otherMode === 'light' ? '☀' : '☾'}</span>
        <span className="tsa-fp__other-fill" style={{ background: otherValue }} />
      </span>
    </div>
  );
}

/* ─── Inspect overlay — DOM hover + click → reverse-lookup
 *     tokens that match the element's computed colors. ────── */

function InspectOverlay({
  tokens, onPick, onCancel,
}: {
  tokens: Record<string, string>;
  onPick: (matched: string[], label: string) => void;
  onCancel: () => void;
}) {
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let lastHover: HTMLElement | null = null;
    let prevOutline = '';

    // Tooltip element appended to body.
    const tip = document.createElement('div');
    tip.className = 'tsa-fp-inspect-tip';
    tip.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;background:#0a0a0a;color:#fafafa;font:500 11px/1.4 Inter,system-ui,sans-serif;padding:6px 9px;border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,0.4);transform:translate(-50%,calc(-100% - 12px));opacity:0;transition:opacity 120ms';
    document.body.appendChild(tip);
    tooltipRef.current = tip;

    const isPanel = (el: Element | null): boolean => {
      return !!el && (el.id === 'tempaloo-studio-floating-root' || !!el.closest('#tempaloo-studio-floating-root'));
    };

    const matchTokens = (el: HTMLElement): string[] => {
      const cs = window.getComputedStyle(el);
      const colors = [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor];
      const matched: string[] = [];
      Object.entries(tokens).forEach(([n, v]) => {
        const norm = normalizeColor(v);
        if (colors.some((c) => normalizeColor(c) === norm)) matched.push(n);
      });
      return matched;
    };

    const onMouseMove = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el || isPanel(el)) {
        tip.style.opacity = '0';
        return;
      }
      if (lastHover !== el) {
        if (lastHover) lastHover.style.outline = prevOutline;
        prevOutline = el.style.outline || '';
        el.style.outline = '2px solid #818cf8';
        el.style.outlineOffset = '-2px';
        lastHover = el;
      }
      const matched = matchTokens(el);
      const role = elementRole(el);
      tip.innerHTML = '<strong>' + role + '</strong> · ' + matched.length + ' color' + (matched.length === 1 ? '' : 's');
      tip.style.left = e.clientX + 'px';
      tip.style.top  = e.clientY + 'px';
      tip.style.opacity = '1';
    };

    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el || isPanel(el)) return;
      e.preventDefault();
      e.stopPropagation();
      const matched = matchTokens(el);
      const scopeEl = el.closest('[data-tw-anim-scope]') as HTMLElement | null;
      const widget  = scopeEl ? scopeEl.getAttribute('data-tw-anim-scope') : null;
      const role    = elementRole(el);
      const label   = widget ? `${widget} · ${role}` : role;
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
      if (tip.parentNode) tip.parentNode.removeChild(tip);
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [tokens, onPick, onCancel]);

  return null;
}

function normalizeColor(c: string): string {
  if (!c) return '';
  if (c === 'transparent') return 'rgba(0, 0, 0, 0)';
  const probe = document.createElement('span');
  probe.style.color = c;
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  document.body.appendChild(probe);
  const computed = window.getComputedStyle(probe).color;
  document.body.removeChild(probe);
  return computed;
}
