import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppState, TemplateFull } from '../types';
import { api } from '../api';

type Mode     = 'light' | 'dark';
type ViewMode = Mode | 'dual';   // 'dual' = edit both modes side-by-side

const HIDDEN_BELOW   = 768;
const STORAGE_POS    = 'tempaloo-fp-pos';
const STORAGE_SIZE   = 'tempaloo-fp-size';
const STORAGE_OPEN    = 'tempaloo-fp-open';
const STORAGE_OPEN_CATS = 'tempaloo-fp-open-cats';
const STYLE_ID         = 'tempaloo-studio-floating-preview';
const STYLE_ID_BIND    = 'tempaloo-studio-floating-bindings';
const STORAGE_BINDINGS = 'tempaloo-fp-bindings';

/** A binding rebinds an existing CSS property of an inspected element
 *  to a different token (typically a custom one). It generates a CSS
 *  rule that overrides the widget's rule and is injected into a
 *  separate <style> tag at panel mount. */
interface Binding {
  id:       string;
  selector: string;   // e.g. ".tw-avero-services__card"
  property: string;   // "background" | "color" | "border-color" | ...
  token:    string;   // e.g. "--tw-avero-brand-orange"
  label:    string;   // human-friendly: "services · card"
}

const DEFAULT_SIZE = { w: 380, h: 620 };
const MIN_SIZE     = { w: 320, h: 380 };

/* ─── Logger — `?fp_debug=1` URL flag or localStorage(`fp_debug`)
 *
 * Logs every user action through the panel so we can diagnose UX
 * complaints ("the color leaks across modes", "save did nothing",
 * etc.) without screen-sharing. Activate via:
 *   - URL: append ?fp_debug=1 (sticks for the session)
 *   - DevTools: localStorage.setItem('fp_debug','1')
 *   - Disable: ?fp_debug=0 OR localStorage.removeItem('fp_debug')
 */
const FP_DEBUG: boolean = (() => {
  try {
    const qs = location.search.match(/[?&]fp_debug=([^&]*)/);
    if (qs) {
      if (qs[1] === '1' || qs[1] === 'true')  { localStorage.setItem('fp_debug', '1'); return true; }
      if (qs[1] === '0' || qs[1] === 'false') { localStorage.removeItem('fp_debug');   return false; }
    }
    return localStorage.getItem('fp_debug') === '1';
  } catch { return false; }
})();
function flog(action: string, ...payload: unknown[]) {
  if (!FP_DEBUG) return;
  try { console.log('%c[FP]%c ' + action, 'color:#3fb2a2;font-weight:bold', 'color:inherit', ...payload); } catch {}
}
function fwarn(action: string, ...payload: unknown[]) {
  try { console.warn('[FP] ' + action, ...payload); } catch {}
}

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
 * The CRITICAL bit: light overrides MUST use a selector that does
 * NOT match in dark mode. `:root` and `[data-theme="dark"]` have
 * the SAME specificity (0,0,1,0 — both = 1 pseudo/attr). When two
 * rules tie on specificity, the LATER one in DOM order wins.
 *
 * Theme_Tokens.php emits both :root and [data-theme="dark"]. Our
 * preview <style> is appended AFTER it. So a naive `:root { ... }`
 * here silently wins over the original `[data-theme="dark"] { ... }`
 * in BOTH modes — exactly the leak the user reported (edit bg-strong
 * in light, dark cards turn red too).
 *
 * Fix: scope light overrides to `:root:not([data-theme="dark"])`
 * (specificity 0,0,2,0 — beats [data-theme="dark"] in light mode,
 * doesn't match in dark mode at all). Dark overrides stay on the
 * plain `[data-theme="dark"]` selector — they're later in source
 * order than the original Theme_Tokens dark block, so they win on
 * source order alone in dark mode.
 */
function applyPreview(drafts: Record<Mode, Record<string, string>>, tpl: TemplateFull | null) {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
    flog('applyPreview: created <style> tag');
  }
  const baseL = tpl?.tokens?.light ?? {};
  const baseD = tpl?.tokens?.dark  ?? {};
  const lightPairs = Object.entries(drafts.light)
    .filter(([k, v]) => k.startsWith('--tw-') && v !== baseL[k]);
  const darkPairs = Object.entries(drafts.dark)
    .filter(([k, v]) => k.startsWith('--tw-') && v !== baseD[k]);
  const lightDecls = lightPairs.map(([k, v]) => `${k}:${v}`).join(';');
  const darkDecls  = darkPairs.map(([k, v]) => `${k}:${v}`).join(';');
  let css = '';
  // Light scope: matches when html has no data-theme OR data-theme is
  // anything other than "dark" (so explicit data-theme="light" works).
  if (lightDecls) css += `:root:not([data-theme="dark"]){${lightDecls}}\n`;
  if (darkDecls)  css += `[data-theme="dark"]{${darkDecls}}\n`;
  el.textContent = css;
  flog('applyPreview: emitted', { lightCount: lightPairs.length, darkCount: darkPairs.length, bytes: css.length });
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
  const [activeMode, setActiveMode] = useState<ViewMode>('light');
  const [followPage, setFollowPage] = useState(true);
  const [tooSmall,   setTooSmall]   = useState(false);

  // Panel UI state — `open` is persisted so the user's last choice
  // survives a page refresh (default: open on first visit).
  const [open,       setOpen]       = useState<boolean>(() => readStored<boolean>(STORAGE_OPEN, true));
  const [maximized,  setMaximized]  = useState(false);
  const [pos,        setPos]        = useState(() => readStored(STORAGE_POS, { x: -1, y: -1 }));
  const [size,       setSize]       = useState(() => readStored(STORAGE_SIZE, DEFAULT_SIZE));
  const [openCats,   setOpenCats]   = useState<Set<string>>(() => new Set(readStored<string[]>(STORAGE_OPEN_CATS, ['bg','text','accent','cta'])));

  // Inspect state
  const [inspectMode,   setInspectMode]   = useState(false);
  const [inspectFilter, setInspectFilter] = useState<string[] | null>(null);
  const [inspectLabel,  setInspectLabel]  = useState<string>('');

  // Add-token form state
  const [addOpen,    setAddOpen]    = useState(false);
  const [addName,    setAddName]    = useState('');
  const [addLight,   setAddLight]   = useState('#ffffff');
  const [addDark,    setAddDark]    = useState('#000000');

  // Inspect target — captured at click time, used by the bindings UI
  const [inspectTarget, setInspectTarget] = useState<{ selector: string; label: string } | null>(null);
  const [bindings,      setBindings]      = useState<Binding[]>(() => readStored<Binding[]>(STORAGE_BINDINGS, []));
  const [bindOpen,      setBindOpen]      = useState(false);
  const [bindToken,     setBindToken]     = useState<string>('');
  const [bindProperty,  setBindProperty]  = useState<string>('background');

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

  /* ── Sync with page data-theme (one-way unless user opts out)
   *    NOTE: skip the sync when activeMode === 'dual' so that the
   *    user can scroll through the page in either theme without the
   *    dual-edit view collapsing back to a single-mode view. */
  useEffect(() => {
    const html = document.documentElement;
    const sync = () => {
      const t = html.getAttribute('data-theme');
      if (followPage && (t === 'light' || t === 'dark')) {
        setActiveMode((prev) => {
          if (prev === 'dual') return prev;
          if (prev !== t) flog('sync: html data-theme changed', { from: prev, to: t });
          return t;
        });
      }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [followPage]);

  /* ── Keyboard shortcut Ctrl/Cmd + Shift + C → toggle open ──── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        flog('shortcut: toggle open', { wasOpen: open });
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

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

  /* ── Bindings preview — separate <style> tag so the rules survive
   *    independent of token edits. Each binding emits one rule:
   *      .selector { property: var(--token) !important; }
   *    The !important is required to beat the widget's own rule for
   *    that property (which has the same or higher specificity). */
  useEffect(() => {
    let el = document.getElementById(STYLE_ID_BIND) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID_BIND;
      document.head.appendChild(el);
    }
    el.textContent = bindings.map(
      (b) => `${b.selector}{${b.property}:var(${b.token}) !important}`
    ).join('\n');
    writeStored(STORAGE_BINDINGS, bindings);
    flog('bindings: applied', { count: bindings.length });
  }, [bindings]);

  /* ── Persist UI state to localStorage ───────────────────── */
  useEffect(() => { writeStored(STORAGE_POS,  pos);  }, [pos]);
  useEffect(() => { writeStored(STORAGE_SIZE, size); }, [size]);
  useEffect(() => { writeStored(STORAGE_OPEN, open); flog('panel: ' + (open ? 'opened' : 'closed')); }, [open]);
  useEffect(() => { writeStored(STORAGE_OPEN_CATS, Array.from(openCats)); }, [openCats]);

  /* ── Debug API exposed on window — `window.tsaFP.dump()` etc.
   *
   * Lets us reproduce + diagnose user reports without screen-share:
   * the user runs window.tsaFP.dump() in DevTools, copy-pastes the
   * output, and we can see the entire panel state at that instant.
   */
  useEffect(() => {
    const w = window as unknown as { tsaFP?: Record<string, unknown> };
    w.tsaFP = {
      dump:   () => ({ activeMode, followPage, drafts, dirty, inspectFilter, inspectLabel, open }),
      drafts: () => drafts,
      diff:   () => {
        if (!tpl) return null;
        const baseL = tpl.tokens?.light ?? {};
        const baseD = tpl.tokens?.dark  ?? {};
        const dl: Record<string, [string, string]> = {};
        const dd: Record<string, [string, string]> = {};
        Object.keys(drafts.light).forEach((k) => { if (drafts.light[k] !== baseL[k]) dl[k] = [baseL[k] ?? '', drafts.light[k]]; });
        Object.keys(drafts.dark).forEach((k)  => { if (drafts.dark[k]  !== baseD[k]) dd[k] = [baseD[k] ?? '', drafts.dark[k]]; });
        return { light: dl, dark: dd };
      },
      previewCss: () => document.getElementById(STYLE_ID)?.textContent ?? '',
      htmlTheme:  () => document.documentElement.getAttribute('data-theme'),
      enableDebug:  () => { localStorage.setItem('fp_debug', '1'); location.reload(); },
      disableDebug: () => { localStorage.removeItem('fp_debug');   location.reload(); },
    };
  }, [activeMode, followPage, drafts, tpl, inspectFilter, inspectLabel, open]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Editable in 'light' / 'dark' single-mode. In 'dual' the row uses
  // setValByMode directly (one input per mode), so this fallback only
  // fires for legacy callers / single-mode tabs.
  function setVal(name: string, value: string) {
    if (activeMode === 'dual') return; // dual rows call setValByMode
    setValByMode(activeMode, name, value);
  }

  function setValByMode(mode: Mode, name: string, value: string) {
    setDrafts((d) => {
      const prev = d[mode][name];
      if (prev === value) return d;
      flog('setVal', { mode, token: name, from: prev, to: value });
      return { ...d, [mode]: { ...d[mode], [name]: value } };
    });
  }

  function switchMode(next: ViewMode) {
    flog('switchMode', { from: activeMode, to: next, followPage, willClearInspect: !!inspectFilter });
    setActiveMode(next);
    // Inspect filter is mode-specific (it was computed from one mode's
    // computed colors). Keeping it across mode changes is misleading.
    if (inspectFilter) {
      setInspectFilter(null);
      setInspectLabel('');
      setHintFlash(`Switched to ${next} — inspect filter cleared (re-inspect to find this element's colors).`, 3500);
    }
    // Only flip page theme for single modes — dual leaves the page as-is.
    if (followPage && (next === 'light' || next === 'dark')) {
      document.documentElement.setAttribute('data-theme', next);
    }
  }

  function resetMode(mode: Mode) {
    if (!tpl) return;
    if (!window.confirm(`Reset all ${mode} mode colors to template defaults? Unsaved drafts in ${mode} will be lost.`)) return;
    flog('resetMode', { mode });
    setDrafts((d) => ({ ...d, [mode]: { ...(tpl.tokens?.[mode] ?? {}) } }));
    setHintFlash(`Reset ${mode} mode (drafts only — click Save to persist).`);
  }

  function resetAll() {
    if (!tpl) return;
    if (!window.confirm('Reset BOTH light and dark to template defaults? Unsaved drafts will be lost.')) return;
    flog('resetAll');
    setDrafts({
      light: { ...(tpl.tokens?.light ?? {}) },
      dark:  { ...(tpl.tokens?.dark  ?? {}) },
    });
    setHintFlash('Reset both modes (drafts only — click Save to persist).');
  }

  function discard() {
    if (!tpl || !state) return;
    flog('discard');
    const o = state.overrides?.[state.active_slug ?? ''] ?? {};
    setDrafts({
      light: { ...(tpl.tokens?.light ?? {}), ...(o.light ?? {}) },
      dark:  { ...(tpl.tokens?.dark  ?? {}), ...(o.dark  ?? {}) },
    });
    setHintFlash('Draft discarded.');
  }

  /* ── Add a brand-new color token (light + dark in one go) ──
   *
   * Token name = the suffix the user types; we auto-prepend
   * `--tw-{shortSlug}-` so the new var lives in the same namespace
   * as the template. The full var is added to BOTH drafts.light
   * and drafts.dark; saving will persist it as an override on the
   * active template. The user can then reference it from any custom
   * CSS / widget that consumes `var(--tw-{slug}-{newName})`. */
  function shortSlug(): string {
    const slug = state?.active_slug ?? '';
    return slug.split('-')[0] || slug;
  }

  /* A token is "custom" when the active template doesn't declare it
   * in either tokens.light or tokens.dark — i.e. the user added it
   * via "+ Add color". Custom tokens get a delete button on their
   * row. Built-in template tokens cannot be deleted (only reset). */
  function isCustomToken(name: string): boolean {
    if (!tpl) return false;
    const inLight = (tpl.tokens?.light ?? {})[name] !== undefined;
    const inDark  = (tpl.tokens?.dark  ?? {})[name] !== undefined;
    return !inLight && !inDark;
  }

  function removeToken(name: string) {
    if (!isCustomToken(name)) {
      setHintFlash('Built-in tokens can only be reset, not deleted.', 3000);
      return;
    }
    if (!window.confirm(`Delete custom token ${name}? This will also remove any binding using it.`)) return;
    flog('removeToken', { name });
    setDrafts((d) => {
      const nextL = { ...d.light }; delete nextL[name];
      const nextD = { ...d.dark  }; delete nextD[name];
      return { light: nextL, dark: nextD };
    });
    // Drop any binding that references this token — otherwise it
    // becomes a stale CSS rule pointing at a non-existent var.
    setBindings((arr) => arr.filter((b) => b.token !== name));
    setHintFlash(`Removed ${name} (Save to persist)`, 3500);
  }
  function applyBinding() {
    if (!inspectTarget || !bindToken) return;
    const id = `${inspectTarget.selector}__${bindProperty}`;
    const next: Binding = {
      id,
      selector: inspectTarget.selector,
      property: bindProperty,
      token:    bindToken,
      label:    inspectTarget.label,
    };
    flog('bindings: add', next);
    setBindings((arr) => {
      const without = arr.filter((b) => b.id !== id); // replace if same selector+property
      return [...without, next];
    });
    setBindOpen(false);
    setHintFlash(`Bound ${bindProperty} of ${inspectTarget.label} → ${bindToken.replace(/^--tw-[^-]+-/, '')}`, 4000);
  }

  function removeBinding(id: string) {
    flog('bindings: remove', id);
    setBindings((arr) => arr.filter((b) => b.id !== id));
  }

  function clearBindings() {
    if (!bindings.length) return;
    if (!window.confirm(`Remove all ${bindings.length} element-token binding(s)?`)) return;
    flog('bindings: clear all');
    setBindings([]);
  }

  function addToken() {
    const raw = addName.trim().toLowerCase().replace(/^-+|-+$/g, '');
    if (!raw) { setHintFlash('Name required.', 2200); return; }
    if (!/^[a-z0-9-]+$/.test(raw)) { setHintFlash('Name: a-z 0-9 - only.', 2800); return; }
    const fullName = `--tw-${shortSlug()}-${raw}`;
    if (drafts.light[fullName] !== undefined || drafts.dark[fullName] !== undefined) {
      setHintFlash(`Token "${fullName}" already exists.`, 3000);
      return;
    }
    flog('addToken', { fullName, light: addLight, dark: addDark });
    setDrafts((d) => ({
      light: { ...d.light, [fullName]: addLight },
      dark:  { ...d.dark,  [fullName]: addDark  },
    }));
    setOpenCats((prev) => new Set([...prev, categoryOf(fullName)]));
    setAddOpen(false);
    setAddName('');
    setHintFlash(`Added ${fullName} (Save to persist)`, 3500);
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
      flog('save: posting', { slug: state.active_slug, lightCount: Object.keys(deltaL).length, darkCount: Object.keys(deltaD).length });
      let next = await api.saveTokens(state.active_slug, 'light', deltaL);
      next     = await api.saveTokens(state.active_slug, 'dark',  deltaD);
      setState(next);
      flog('save: ok');
      setHintFlash('Saved ✓');
    } catch (e) {
      fwarn('save: failed', e);
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
    // Dual = union of all token names from light + dark (so a token
    // declared only in dark still shows up). Single mode = just that mode.
    const keys = activeMode === 'dual'
      ? Array.from(new Set([...Object.keys(drafts.light), ...Object.keys(drafts.dark)]))
      : Object.keys(drafts[activeMode]);
    keys
      .filter((k) => {
        // A token is shown if EITHER mode has a color value for it.
        const lv = drafts.light[k] || '';
        const dv = drafts.dark[k]  || '';
        return isColorValue(lv) || isColorValue(dv);
      })
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
        className="tsa-fp-toggle tsa-fp-toggle--pill"
        onClick={() => { flog('toggle: open'); setOpen(true); }}
        title="Open Tempaloo color editor (Ctrl+Shift+C)"
        aria-label="Open Tempaloo color editor"
      >
        <span className="tsa-fp-toggle__inner">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="8" cy="8" r="5.5" />
            <path d="M5 8a3 3 0 0 0 3 3M11 8a3 3 0 0 0-3-3" />
          </svg>
          <span className="tsa-fp-toggle__label">Colors</span>
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
        <button
          type="button"
          className="tsa-fp__icon"
          onClick={(e) => { e.stopPropagation(); flog('toggle: ' + (maximized ? 'restore' : 'maximize')); setMaximized((v) => !v); }}
          title={maximized ? 'Restore' : 'Maximize'}
          aria-label={maximized ? 'Restore size' : 'Maximize'}
        >
          {maximized ? '❐' : '◰'}
        </button>
        <button
          type="button"
          className="tsa-fp__icon tsa-fp__icon--close"
          onClick={(e) => { e.stopPropagation(); flog('toggle: close'); setOpen(false); }}
          title="Close panel (Ctrl+Shift+C to toggle, or click the Colors button to re-open)"
          aria-label="Close panel"
        >
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>

      {/* ── Mode switcher row — Light · Dark · Dual ─────── */}
      <div className="tsa-fp__moderow">
        <div className="tsa-fp__modeswitch" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === 'light'}
            className={'tsa-fp__modebtn' + (activeMode === 'light' ? ' is-active' : '')}
            onClick={() => switchMode('light')}
            title="Edit light-mode colors only"
          >
            ☀ Light {dirty.light > 0 && <span className="tsa-fp__modebadge">{dirty.light}</span>}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === 'dark'}
            className={'tsa-fp__modebtn' + (activeMode === 'dark' ? ' is-active' : '')}
            onClick={() => switchMode('dark')}
            title="Edit dark-mode colors only"
          >
            ☾ Dark {dirty.dark > 0 && <span className="tsa-fp__modebadge">{dirty.dark}</span>}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === 'dual'}
            className={'tsa-fp__modebtn' + (activeMode === 'dual' ? ' is-active' : '')}
            onClick={() => switchMode('dual')}
            title="Edit BOTH light and dark side-by-side in the same row"
          >
            ⚌ Dual {dirty.total > 0 && <span className="tsa-fp__modebadge">{dirty.total}</span>}
          </button>
        </div>
        <label
          className="tsa-fp__follow"
          title={activeMode === 'dual' ? 'Disabled in Dual mode — both modes are visible at once.' : "When on, switching modes also flips the page's data-theme so you see what you're editing."}
        >
          <input
            type="checkbox"
            checked={followPage}
            disabled={activeMode === 'dual'}
            onChange={(e) => setFollowPage(e.target.checked)}
          />
          <span>Sync page</span>
        </label>
      </div>

      {/* ── Toolbar: Inspect + Add + Reset ────────────────── */}
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
        <button
          type="button"
          className={'tsa-fp__btn' + (addOpen ? ' is-active' : '')}
          onClick={() => setAddOpen((v) => !v)}
          title="Add a new color token (light + dark)"
        >
          + Add color
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

      {/* ── Add color form (collapsible) ─────────────────── */}
      {addOpen && (
        <div className="tsa-fp__addform">
          <div className="tsa-fp__addform-row">
            <span className="tsa-fp__addform-prefix">{`--tw-${shortSlug()}-`}</span>
            <input
              type="text"
              className="tsa-fp__input"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="my-color"
              autoFocus
              spellCheck={false}
              onKeyDown={(e) => { if (e.key === 'Enter') addToken(); if (e.key === 'Escape') setAddOpen(false); }}
            />
          </div>
          <div className="tsa-fp__addform-row">
            <label className="tsa-fp__addform-side">
              <span>☀ Light</span>
              <input type="color" value={addLight.startsWith('#') ? addLight.slice(0,7) : '#ffffff'} onChange={(e) => setAddLight(e.target.value)} />
              <input type="text" className="tsa-fp__input" value={addLight} onChange={(e) => setAddLight(e.target.value)} spellCheck={false} />
            </label>
            <label className="tsa-fp__addform-side">
              <span>☾ Dark</span>
              <input type="color" value={addDark.startsWith('#') ? addDark.slice(0,7) : '#000000'} onChange={(e) => setAddDark(e.target.value)} />
              <input type="text" className="tsa-fp__input" value={addDark} onChange={(e) => setAddDark(e.target.value)} spellCheck={false} />
            </label>
          </div>
          <div className="tsa-fp__addform-actions">
            <button type="button" className="tsa-fp__btn" onClick={() => setAddOpen(false)}>Cancel</button>
            <button type="button" className="tsa-fp__btn tsa-fp__btn--primary" onClick={addToken} disabled={!addName.trim()}>Add</button>
          </div>
        </div>
      )}

      {inspectMode && (
        <InspectOverlay
          // In dual mode, search the union of both palettes so we surface
          // every token the element ties to in either theme. The UI then
          // shows a Dual row where the user can edit both at once.
          tokens={
            activeMode === 'dual'
              ? { ...drafts.light, ...drafts.dark }
              : drafts[activeMode]
          }
          onPick={(matched, label, selector) => {
            flog('inspect: picked', { mode: activeMode, label, selector, matched });
            setInspectMode(false);
            setInspectFilter(matched);
            setInspectLabel(label + ' (' + activeMode + ')');
            setInspectTarget({ selector, label });
            const cats = new Set<string>();
            matched.forEach((t) => cats.add(categoryOf(t)));
            setOpenCats((prev) => new Set([...prev, ...Array.from(cats)]));
            const where = activeMode === 'dual' ? 'both modes' : `${activeMode}-mode`;
            setHintFlash(`${matched.length} ${where} colors for ${label} — click "Apply token" to bind a custom color`, 4500);
          }}
          onCancel={() => { flog('inspect: cancelled'); setInspectMode(false); }}
        />
      )}

      {inspectFilter && inspectLabel && (
        <div className="tsa-fp__inspect-banner">
          <span>📍 <strong>{inspectLabel}</strong> — {inspectFilter.length} colors</span>
          {inspectTarget && (
            <button
              type="button"
              className="tsa-fp__btn tsa-fp__btn--small"
              onClick={() => setBindOpen((v) => !v)}
              title="Apply a custom token to this element's background, color, or border"
            >
              🔗 Apply token
            </button>
          )}
        </div>
      )}

      {bindOpen && inspectTarget && (
        <div className="tsa-fp__bindform">
          <div className="tsa-fp__bindform-row">
            <span className="tsa-fp__bindform-label">Selector</span>
            <code className="tsa-fp__bindform-selector" title={inspectTarget.selector}>{inspectTarget.selector}</code>
          </div>
          <div className="tsa-fp__bindform-row">
            <span className="tsa-fp__bindform-label">Property</span>
            <select
              className="tsa-fp__select"
              value={bindProperty}
              onChange={(e) => setBindProperty(e.target.value)}
            >
              <option value="background">background</option>
              <option value="background-color">background-color</option>
              <option value="color">color (text)</option>
              <option value="border-color">border-color</option>
              <option value="border-top-color">border-top-color</option>
              <option value="border-bottom-color">border-bottom-color</option>
              <option value="outline-color">outline-color</option>
              <option value="fill">fill (SVG)</option>
              <option value="stroke">stroke (SVG)</option>
            </select>
          </div>
          <div className="tsa-fp__bindform-row">
            <span className="tsa-fp__bindform-label">Token</span>
            <select
              className="tsa-fp__select"
              value={bindToken}
              onChange={(e) => setBindToken(e.target.value)}
            >
              <option value="">— choose a token —</option>
              {Array.from(new Set([...Object.keys(drafts.light), ...Object.keys(drafts.dark)]))
                .filter((k) => k.startsWith('--tw-'))
                .sort()
                .map((k) => (
                  <option key={k} value={k}>{k.replace(/^--tw-[^-]+-/, '')}</option>
                ))}
            </select>
          </div>
          <div className="tsa-fp__bindform-actions">
            <button type="button" className="tsa-fp__btn" onClick={() => setBindOpen(false)}>Cancel</button>
            <button type="button" className="tsa-fp__btn tsa-fp__btn--primary" onClick={applyBinding} disabled={!bindToken}>Apply</button>
          </div>
        </div>
      )}

      {bindings.length > 0 && (
        <div className="tsa-fp__bindings">
          <div className="tsa-fp__bindings-head">
            <span>🔗 {bindings.length} active binding{bindings.length === 1 ? '' : 's'}</span>
            <button type="button" className="tsa-fp__btn tsa-fp__btn--small tsa-fp__btn--ghost" onClick={clearBindings}>Clear all</button>
          </div>
          <ul className="tsa-fp__bindings-list">
            {bindings.map((b) => (
              <li key={b.id} className="tsa-fp__binding">
                <span className="tsa-fp__binding-label" title={`${b.selector} { ${b.property}: var(${b.token}) }`}>
                  <strong>{b.label}</strong> · {b.property} → {b.token.replace(/^--tw-[^-]+-/, '')}
                </span>
                <button type="button" className="tsa-fp__icon" onClick={() => removeBinding(b.id)} title="Remove this binding" aria-label="Remove binding">✕</button>
              </li>
            ))}
          </ul>
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
                    activeMode === 'dual' ? (
                      <DualColorRow
                        key={name + '-dual'}
                        name={name}
                        lightValue={drafts.light[name] ?? ''}
                        darkValue={drafts.dark[name]   ?? ''}
                        isCustom={isCustomToken(name)}
                        onChangeLight={(v) => setValByMode('light', name, v)}
                        onChangeDark={(v)  => setValByMode('dark',  name, v)}
                        onDelete={() => removeToken(name)}
                      />
                    ) : (
                      <ColorRow
                        key={name + '-' + activeMode}
                        name={name}
                        value={drafts[activeMode][name]}
                        otherValue={drafts[activeMode === 'light' ? 'dark' : 'light'][name]}
                        otherMode={activeMode === 'light' ? 'dark' : 'light'}
                        isCustom={isCustomToken(name)}
                        onChange={(v) => setVal(name, v)}
                        onDelete={() => removeToken(name)}
                      />
                    )
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
  name, value, otherValue, otherMode, isCustom, onChange, onDelete,
}: {
  name:       string;
  value:      string;
  otherValue: string;
  otherMode:  Mode;
  isCustom:   boolean;
  onChange:   (v: string) => void;
  onDelete:   () => void;
}) {
  const isHex   = /^#[0-9a-f]{3,8}$/i.test(value);
  const display = name.replace(/^--tw-[^-]+-/, '');
  const synced  = value === otherValue;

  return (
    <div className={'tsa-fp__row' + (isCustom ? ' tsa-fp__row--custom' : '')}>
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
        <span className="tsa-fp__name" title={name}>
          {isCustom && <span className="tsa-fp__custom-badge" title="Custom token (added via + Add color)">●</span>}
          {display}
        </span>
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
      {isCustom && (
        <button
          type="button"
          className="tsa-fp__row-delete"
          onClick={onDelete}
          title={`Delete custom token ${name}`}
          aria-label={`Delete ${name}`}
        >🗑</button>
      )}
    </div>
  );
}

/* ─── Dual color row — edit BOTH light + dark in one row ────
 *
 * Two color pickers + two text inputs, side-by-side. Each side
 * commits ONLY to its own mode's drafts (no auto-sync). A "link"
 * indicator turns green when both modes share the same value, so
 * the author can see at-a-glance which tokens are mode-agnostic.
 *
 * Each side has a "copy →" / "← copy" button to push the current
 * value to the OTHER mode — handy when the user wants the same
 * color in both modes. */

function DualColorRow({
  name, lightValue, darkValue, isCustom, onChangeLight, onChangeDark, onDelete,
}: {
  name:          string;
  lightValue:    string;
  darkValue:     string;
  isCustom:      boolean;
  onChangeLight: (v: string) => void;
  onChangeDark:  (v: string) => void;
  onDelete:      () => void;
}) {
  const display = name.replace(/^--tw-[^-]+-/, '');
  const synced  = lightValue === darkValue && lightValue !== '';

  return (
    <div className={'tsa-fp__row tsa-fp__row--dual' + (synced ? ' is-synced' : '') + (isCustom ? ' tsa-fp__row--custom' : '')}>
      <span className="tsa-fp__name tsa-fp__name--dual" title={name}>
        {isCustom && <span className="tsa-fp__custom-badge" title="Custom token">●</span>}
        {display}
        {isCustom && (
          <button type="button" className="tsa-fp__row-delete tsa-fp__row-delete--inline" onClick={onDelete} title={`Delete ${name}`} aria-label={`Delete ${name}`}>🗑</button>
        )}
      </span>

      <DualSide
        mode="light"
        icon="☀"
        value={lightValue}
        onChange={onChangeLight}
        onCopyToOther={() => onChangeDark(lightValue)}
        copyDirection="→"
        copyTitle="Copy this light value to dark"
      />

      <span className={'tsa-fp__dual-link' + (synced ? ' is-synced' : '')} title={synced ? 'Both modes share the same value' : 'Light and dark differ'}>
        {synced ? '⇌' : '⇿'}
      </span>

      <DualSide
        mode="dark"
        icon="☾"
        value={darkValue}
        onChange={onChangeDark}
        onCopyToOther={() => onChangeLight(darkValue)}
        copyDirection="←"
        copyTitle="Copy this dark value to light"
      />
    </div>
  );
}

function DualSide({
  mode, icon, value, onChange, onCopyToOther, copyDirection, copyTitle,
}: {
  mode:          Mode;
  icon:          string;
  value:         string;
  onChange:      (v: string) => void;
  onCopyToOther: () => void;
  copyDirection: '→' | '←';
  copyTitle:     string;
}) {
  const isHex = /^#[0-9a-f]{3,8}$/i.test(value);
  return (
    <div className={'tsa-fp__dual-side tsa-fp__dual-side--' + mode}>
      <label className="tsa-fp__swatch tsa-fp__swatch--dual" title={`${mode} mode`}>
        <span className="tsa-fp__swatch-bg" />
        <span className="tsa-fp__swatch-fill" style={{ background: value || 'transparent' }} />
        <input
          type="color"
          value={isHex ? value.slice(0, 7) : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`Pick ${mode}-mode color`}
        />
        <span className="tsa-fp__dual-icon" aria-hidden="true">{icon}</span>
      </label>
      <input
        type="text"
        className="tsa-fp__input tsa-fp__input--dual"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        placeholder={mode}
      />
      <button
        type="button"
        className="tsa-fp__dual-copy"
        onClick={onCopyToOther}
        title={copyTitle}
        aria-label={copyTitle}
      >
        {copyDirection}
      </button>
    </div>
  );
}

/* ─── Inspect overlay — DOM hover + click → reverse-lookup
 *     tokens that match the element's computed colors. ────── */

function InspectOverlay({
  tokens, onPick, onCancel,
}: {
  tokens: Record<string, string>;
  onPick: (matched: string[], label: string, selector: string) => void;
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

    const buildSelector = (el: HTMLElement): string => {
      // Prefer the most specific BEM class (tw-{template}-{widget}__elem),
      // then the widget root class, then tag. Avoid auto-generated
      // Elementor classes (.elementor-xxx) since those are unstable.
      const cls = (el.className && typeof el.className === 'string') ? el.className : '';
      const classes = cls.split(/\s+/).filter(Boolean);
      const bem = classes.filter((c) => /^tw-/.test(c) && c.includes('__'));
      if (bem.length) return '.' + bem[0];
      const tw  = classes.filter((c) => /^tw-/.test(c));
      if (tw.length)  return '.' + tw[0];
      const scopeEl = el.closest('[data-tw-anim-scope]') as HTMLElement | null;
      if (scopeEl) {
        const scope = scopeEl.getAttribute('data-tw-anim-scope');
        return `[data-tw-anim-scope="${scope}"] ${el.tagName.toLowerCase()}`;
      }
      return el.tagName.toLowerCase();
    };

    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el || isPanel(el)) return;
      e.preventDefault();
      e.stopPropagation();
      const matched  = matchTokens(el);
      const scopeEl  = el.closest('[data-tw-anim-scope]') as HTMLElement | null;
      const widget   = scopeEl ? scopeEl.getAttribute('data-tw-anim-scope') : null;
      const role     = elementRole(el);
      const label    = widget ? `${widget} · ${role}` : role;
      const selector = buildSelector(el);
      if (lastHover) lastHover.style.outline = prevOutline;
      onPick(matched, label, selector);
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
