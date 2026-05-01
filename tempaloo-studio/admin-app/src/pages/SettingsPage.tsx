import { useEffect, useMemo, useState } from 'react';
import type { AppState, TemplateFull } from '../types';
import { api } from '../api';
import { toast } from '../components/Toast';
import { FONT_PRESETS, ensureFontLoaded, findPreset } from '../data/fonts';

interface Props {
  state:        AppState | null;
  onStateUpdate: (s: AppState) => void;
}

type Mode = 'light' | 'dark';
type Category = 'colors' | 'typography' | 'spacing' | 'radius' | 'shadow' | 'other';

interface TokenRow {
  name:       string;
  light:      string;
  dark:       string;
  category:   Category;
  isCustom:   boolean;  // not in template defaults → user-added
  isModified: boolean;  // override active in any mode
}

const CATEGORY_ORDER: Category[] = ['colors', 'typography', 'spacing', 'radius', 'shadow', 'other'];
const CATEGORY_LABEL: Record<Category, string> = {
  colors:     'Colors',
  typography: 'Typography',
  spacing:    'Spacing',
  radius:     'Radii',
  shadow:     'Shadows',
  other:      'Other',
};

function categoryOf(name: string): Category {
  if (name.includes('-font-'))    return 'typography';
  if (name.includes('-space-'))   return 'spacing';
  if (name.includes('-radius'))   return 'radius';
  if (name.includes('-shadow'))   return 'shadow';
  if (
    name.endsWith('-bg') || name.includes('-bg-') ||
    name.endsWith('-text') || name.includes('-text-') ||
    name.includes('-accent') || name.includes('-border') ||
    name.includes('-cta-') || name.includes('-color')
  ) return 'colors';
  return 'other';
}

function isHexOrColorish(v: string): boolean {
  if (!v) return false;
  return /^#[0-9a-f]{3,8}$/i.test(v) || /^(rgba?|hsla?)\(/i.test(v) || /^[a-z]+$/i.test(v);
}

export function SettingsPage({ state, onStateUpdate }: Props) {
  const [tpl, setTpl]       = useState<TemplateFull | null>(null);
  const [loading, setLoad]  = useState(false);
  const [drafts, setDrafts] = useState<Record<Mode, Record<string, string>>>({ light: {}, dark: {} });
  const [saving, setSave]   = useState(false);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const activeSlug = state?.active_slug ?? null;
  const defaults   = useMemo(() => ({
    light: tpl?.tokens?.light ?? {},
    dark:  tpl?.tokens?.dark  ?? {},
  }), [tpl]);

  useEffect(() => {
    if (!activeSlug) { setTpl(null); return; }
    setLoad(true);
    api.getTemplate(activeSlug)
      .then((t) => {
        setTpl(t);
        const o = state?.overrides?.[activeSlug] ?? {};
        setDrafts({
          light: { ...(t.tokens?.light ?? {}), ...(o.light ?? {}) },
          dark:  { ...(t.tokens?.dark  ?? {}), ...(o.dark  ?? {}) },
        });
      })
      .catch((e) => toast.error(`Failed to load template: ${(e as Error).message}`))
      .finally(() => setLoad(false));
  }, [activeSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const tokenRows: TokenRow[] = useMemo(() => {
    const allNames = new Set([...Object.keys(drafts.light), ...Object.keys(drafts.dark)]);
    const rows: TokenRow[] = [];
    allNames.forEach((name) => {
      const light = drafts.light[name] ?? '';
      const dark  = drafts.dark[name]  ?? '';
      const inDefaults = name in defaults.light || name in defaults.dark;
      rows.push({
        name,
        light,
        dark,
        category:   categoryOf(name),
        isCustom:   !inDefaults,
        isModified: light !== (defaults.light[name] ?? '') || dark !== (defaults.dark[name] ?? ''),
      });
    });
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }, [drafts, defaults]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tokenRows;
    return tokenRows.filter((r) => r.name.toLowerCase().includes(q) || r.light.toLowerCase().includes(q) || r.dark.toLowerCase().includes(q));
  }, [tokenRows, search]);

  const grouped = useMemo(() => {
    const out: Record<Category, TokenRow[]> = { colors: [], typography: [], spacing: [], radius: [], shadow: [], other: [] };
    filteredRows.forEach((r) => out[r.category].push(r));
    return out;
  }, [filteredRows]);

  function setVal(mode: Mode, name: string, value: string) {
    // Typography + Radii are SINGLE-VALUED — neither fonts nor border
    // radii vary between light and dark modes in any sensible design
    // system. Dual-write keeps both panes in sync however the user edits.
    const cat = categoryOf(name);
    if (cat === 'typography' || cat === 'radius') {
      setDrafts((d) => ({
        light: { ...d.light, [name]: value },
        dark:  { ...d.dark,  [name]: value },
      }));
      return;
    }
    setDrafts((d) => ({ ...d, [mode]: { ...d[mode], [name]: value } }));
  }

  function revert(name: string) {
    setDrafts((d) => ({
      light: { ...d.light, [name]: defaults.light[name] ?? d.light[name] },
      dark:  { ...d.dark,  [name]: defaults.dark[name]  ?? d.dark[name]  },
    }));
  }

  function deleteCustom(name: string) {
    setDrafts((d) => {
      const nextL = { ...d.light }; delete nextL[name];
      const nextD = { ...d.dark  }; delete nextD[name];
      return { light: nextL, dark: nextD };
    });
  }

  function resetMode(mode: Mode) {
    setDrafts((d) => ({ ...d, [mode]: { ...(defaults[mode]) } }));
    toast.info(`${mode === 'light' ? 'Light' : 'Dark'} reset to template defaults (not saved yet).`);
  }

  function resetAll() {
    setDrafts({ light: { ...defaults.light }, dark: { ...defaults.dark } });
    toast.info('All tokens reset to template defaults (not saved yet).');
  }

  async function saveAll() {
    if (!activeSlug || !tpl) return;
    setSave(true);
    try {
      // Build delta per mode: only entries different from baseline.
      const deltaL: Record<string, string> = {};
      const deltaD: Record<string, string> = {};
      Object.keys(drafts.light).forEach((k) => {
        if (drafts.light[k] !== (defaults.light[k] ?? '')) deltaL[k] = drafts.light[k];
        else if (!(k in defaults.light) && k in drafts.light) deltaL[k] = drafts.light[k]; // custom token
      });
      Object.keys(drafts.dark).forEach((k) => {
        if (drafts.dark[k] !== (defaults.dark[k] ?? '')) deltaD[k] = drafts.dark[k];
        else if (!(k in defaults.dark) && k in drafts.dark) deltaD[k] = drafts.dark[k];
      });
      let next = await api.saveTokens(activeSlug, 'light', deltaL);
      next     = await api.saveTokens(activeSlug, 'dark',  deltaD);
      onStateUpdate(next);
      toast.info('Saved.');
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSave(false);
    }
  }

  function addToken(name: string, light: string, dark: string) {
    if (!name.startsWith('--tw-')) name = '--tw-' + name.replace(/^-+/, '');
    if (!/^--tw-[a-z0-9-]+$/i.test(name)) {
      toast.error('Token name must match --tw-{slug} (lowercase letters, digits, dashes).');
      return false;
    }
    if (name in drafts.light || name in drafts.dark) {
      toast.error('That token already exists.');
      return false;
    }
    setDrafts((d) => ({
      light: { ...d.light, [name]: light },
      dark:  { ...d.dark,  [name]: dark  },
    }));
    setAdding(false);
    toast.info(`${name} added — remember to Save.`);
    return true;
  }

  if (!activeSlug) {
    return (
      <>
        <header className="tsa-pagehead">
          <div>
            <h1 className="tsa-pagehead__title">Theme tokens</h1>
            <p className="tsa-pagehead__subtitle">Activate a template first — its design tokens will appear here.</p>
          </div>
        </header>
        <div className="tsa-empty">
          <h3>No active template</h3>
          <p>Head to Templates and activate one to see its color, font, radius, and shadow tokens here.</p>
        </div>
      </>
    );
  }

  const customCount = tokenRows.filter((r) => r.isCustom).length;
  const modifiedCount = tokenRows.filter((r) => r.isModified).length;

  return (
    <>
      <header className="tsa-pagehead">
        <div>
          <h1 className="tsa-pagehead__title">Theme tokens</h1>
          <p className="tsa-pagehead__subtitle">
            Live-edit the active template's design tokens. Changes apply on save and override the
            template defaults — without ever touching the source files.
          </p>
        </div>
        <div className="tsa-pagehead__actions">
          <button type="button" onClick={resetAll}                className="tsa-btn tsa-btn--ghost tsa-btn--sm">Reset all</button>
          <button type="button" onClick={() => resetMode('light')} className="tsa-btn tsa-btn--ghost tsa-btn--sm">Reset light</button>
          <button type="button" onClick={() => resetMode('dark')}  className="tsa-btn tsa-btn--ghost tsa-btn--sm">Reset dark</button>
          <button type="button" onClick={saveAll} disabled={saving} className="tsa-btn tsa-btn--primary tsa-btn--sm">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </header>

      {loading && (
        <div className="tsa-card">
          <div className="tsa-skel" style={{ height: 18, width: '40%' }} />
          <div className="tsa-skel tsa-mt-3" style={{ height: 14, width: '60%' }} />
        </div>
      )}

      {!loading && tpl && (
        <>
          <div className="tsa-tokens-toolbar">
            <div className="tsa-tokens-search">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="7" cy="7" r="4.5" />
                <path d="m13 13-2.5-2.5" />
              </svg>
              <input
                type="text"
                placeholder="Search tokens…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                spellCheck={false}
              />
            </div>

            <div className="tsa-tokens-stats">
              <span className="tsa-pill tsa-pill--accent">{tokenRows.length} tokens</span>
              {modifiedCount > 0 && <span className="tsa-pill tsa-pill--warning">{modifiedCount} modified</span>}
              {customCount > 0 && <span className="tsa-pill">{customCount} custom</span>}
            </div>

            <button type="button" onClick={() => setAdding((v) => !v)} className="tsa-btn tsa-btn--secondary tsa-btn--sm">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M8 3v10M3 8h10" />
              </svg>
              {adding ? 'Cancel' : 'New token'}
            </button>
          </div>

          {adding && <AddTokenForm onAdd={addToken} onCancel={() => setAdding(false)} />}

          <div className="tsa-tokens-table">
            <div className="tsa-tokens-table__head">
              <span>Token</span>
              <span>Light</span>
              <span>Dark</span>
              <span aria-hidden="true" />
            </div>

            {CATEGORY_ORDER.map((cat) => {
              const rows = grouped[cat];
              if (!rows || rows.length === 0) return null;
              return (
                <div key={cat} className="tsa-tokens-group">
                  <div className="tsa-tokens-group__label">{CATEGORY_LABEL[cat]} <span>· {rows.length}</span></div>
                  {rows.map((r) => (
                    <TokenRowView
                      key={r.name}
                      row={r}
                      onChange={setVal}
                      onRevert={() => revert(r.name)}
                      onDelete={r.isCustom ? () => deleteCustom(r.name) : undefined}
                    />
                  ))}
                </div>
              );
            })}

            {filteredRows.length === 0 && (
              <div className="tsa-empty" style={{ marginTop: 16 }}>
                <p>No token matches "{search}".</p>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

function TokenRowView({ row, onChange, onRevert, onDelete }: {
  row:      TokenRow;
  onChange: (mode: Mode, name: string, value: string) => void;
  onRevert: () => void;
  onDelete?: () => void;
}) {
  const Cell   = pickCell(row.category);
  const merged = row.category === 'typography' || row.category === 'radius';

  return (
    <div className={'tsa-tk-row' + (row.isModified ? ' is-modified' : '') + (row.isCustom ? ' is-custom' : '') + (merged ? ' is-merged' : '')}>
      <div className="tsa-tk-row__name">
        {row.isCustom && <span className="tsa-tk-row__badge" title="Custom token">+</span>}
        <span className="tsa-tk-row__name-text" title={row.name}>{row.name}</span>
      </div>

      {merged ? (
        // Typography tokens are single-valued (one font for both modes).
        // Render ONE cell spanning the Light + Dark columns to make the
        // unified-value semantics obvious. Writes propagate to both modes
        // via the parent setVal() detection.
        <div className="tsa-tk-row__merged">
          <Cell value={row.light} onChange={(v) => onChange('light', row.name, v)} />
          <span className="tsa-tk-row__merged-hint" title="Same font in light and dark modes">≡ both modes</span>
        </div>
      ) : (
        <>
          <Cell value={row.light} onChange={(v) => onChange('light', row.name, v)} />
          <Cell value={row.dark}  onChange={(v) => onChange('dark',  row.name, v)} />
        </>
      )}

      <div className="tsa-tk-row__actions">
        {row.isModified && (
          <button type="button" onClick={onRevert} className="tsa-tk-iconbtn" title="Revert this token to defaults" aria-label="Revert">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 8a5 5 0 1 0 1.5-3.5L3 6" />
              <path d="M3 3v3h3" />
            </svg>
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={onDelete} className="tsa-tk-iconbtn tsa-tk-iconbtn--danger" title="Delete custom token" aria-label="Delete">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 4h10M6 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M5 4l1 9a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1l1-9" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

type CellProps = { value: string; onChange: (v: string) => void };

function pickCell(category: Category): React.FC<CellProps> {
  if (category === 'typography') return FontCell;
  if (category === 'radius')     return RadiusCell;
  if (category === 'shadow')     return ShadowCell;
  return ColorCell;
}

function ColorCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isHex      = /^#[0-9a-f]{3,8}$/i.test(value);
  const hexForPicker = isHex ? value.slice(0, 7) : '#000000';
  const looksColor = isHexOrColorish(value);
  return (
    <div className="tsa-tk-cell">
      <label className={'tsa-tk-swatch' + (isHex ? '' : ' is-disabled')} title={isHex ? 'Pick color' : 'Pick color (hex only)'}>
        <span className="tsa-tk-swatch__bg" />
        {looksColor && <span className="tsa-tk-swatch__fill" style={{ background: value }} />}
        <input
          type="color"
          value={hexForPicker}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Color picker"
        />
      </label>
      <input
        type="text"
        className="tsa-tk-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
    </div>
  );
}

function FontCell({ value, onChange }: CellProps) {
  const preset    = findPreset(value);
  const isCustom  = !preset;
  const [custom, setCustom] = useState(isCustom);

  // When the user picks a preset, lazily inject its Google Fonts URL
  // so the preview "Aa" renders in the actual face.
  useEffect(() => { if (preset) ensureFontLoaded(preset.url); }, [preset]);

  function selectPreset(v: string) {
    if (v === '__custom__') { setCustom(true); return; }
    setCustom(false);
    onChange(v);
  }

  return (
    <div className="tsa-tk-cell">
      <span className="tsa-tk-fontprev" style={{ fontFamily: value || 'inherit' }} aria-hidden="true">Aa</span>
      {custom ? (
        <input
          type="text"
          className="tsa-tk-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          placeholder="'Inter', sans-serif"
          onBlur={() => { if (findPreset(value)) setCustom(false); }}
        />
      ) : (
        <select
          className="tsa-tk-select"
          value={preset ? preset.value : ''}
          onChange={(e) => selectPreset(e.target.value)}
        >
          <optgroup label="System">
            {FONT_PRESETS.filter((f) => f.type === 'system').map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </optgroup>
          <optgroup label="Sans-serif">
            {FONT_PRESETS.filter((f) => f.type === 'sans').map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </optgroup>
          <optgroup label="Serif">
            {FONT_PRESETS.filter((f) => f.type === 'serif').map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </optgroup>
          <optgroup label="Display">
            {FONT_PRESETS.filter((f) => f.type === 'display').map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </optgroup>
          <optgroup label="Monospace">
            {FONT_PRESETS.filter((f) => f.type === 'mono').map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </optgroup>
          <option value="__custom__">Custom…</option>
        </select>
      )}
    </div>
  );
}

/* ── Radius cell — number input + slider ─────────────────── */

function parsePx(v: string): number {
  const m = (v || '').trim().match(/^(-?\d+(?:\.\d+)?)px$/);
  return m ? parseFloat(m[1]) : 0;
}

function RadiusCell({ value, onChange }: CellProps) {
  const looksLikePx = /^-?\d+(?:\.\d+)?px$/.test((value || '').trim());
  const num = parsePx(value);
  const [free, setFree] = useState(!looksLikePx && (value || '').length > 0);

  if (free) {
    return (
      <div className="tsa-tk-cell">
        <span className="tsa-tk-radprev" style={{ borderRadius: value || 0 }} aria-hidden="true" />
        <input
          type="text"
          className="tsa-tk-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => { if (/^-?\d+(?:\.\d+)?px$/.test(value.trim())) setFree(false); }}
          spellCheck={false}
        />
      </div>
    );
  }
  return (
    <div className="tsa-tk-cell tsa-tk-cell--radius">
      <span className="tsa-tk-radprev" style={{ borderRadius: `${num}px` }} aria-hidden="true" />
      <input
        type="range"
        className="tsa-tk-slider"
        min={0}
        max={64}
        step={1}
        value={num}
        onChange={(e) => onChange(`${e.target.value}px`)}
      />
      <input
        type="number"
        className="tsa-tk-num"
        min={0}
        max={9999}
        step={1}
        value={num}
        onChange={(e) => onChange(`${e.target.value}px`)}
      />
      <span className="tsa-tk-unit">px</span>
      <button type="button" className="tsa-tk-iconbtn tsa-tk-iconbtn--xs" title="Use a custom value" onClick={() => setFree(true)} aria-label="Custom value">⌨</button>
    </div>
  );
}

/* ── Shadow cell — visual builder ───────────────────────── */

interface ParsedShadow {
  inset:  boolean;
  x:      number;
  y:      number;
  blur:   number;
  spread: number;
  color:  string;
}

function parseShadow(v: string): ParsedShadow | null {
  const trimmed = (v || '').trim();
  if (!trimmed || trimmed === 'none') return null;
  // Accept: [inset] x y blur [spread] color
  // Color can be #..., rgb(...), rgba(...), hsl(...), or a keyword.
  const re = /^(inset\s+)?(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px(?:\s+(-?\d+(?:\.\d+)?)px)?\s+(.+?)$/i;
  const m = trimmed.match(re);
  if (!m) return null;
  return {
    inset:  !!m[1],
    x:      parseFloat(m[2]),
    y:      parseFloat(m[3]),
    blur:   parseFloat(m[4]),
    spread: m[5] ? parseFloat(m[5]) : 0,
    color:  m[6].trim(),
  };
}

function serializeShadow(s: ParsedShadow): string {
  return [
    s.inset ? 'inset' : null,
    `${s.x}px`,
    `${s.y}px`,
    `${s.blur}px`,
    s.spread !== 0 ? `${s.spread}px` : null,
    s.color,
  ].filter(Boolean).join(' ');
}

/* Shadow presets — one-click starting points for non-designer users.
 * Each preset is a complete CSS box-shadow string. The inset toggle is
 * applied separately so the user can flip any preset to inset.
 */
const SHADOW_PRESETS: Array<{ label: string; value: string }> = [
  { label: 'None',   value: 'none' },
  { label: 'Subtle', value: '0 1px 2px rgba(0, 0, 0, 0.05)' },
  { label: 'Soft',   value: '0 4px 12px rgba(0, 0, 0, 0.08)' },
  { label: 'Medium', value: '0 8px 24px -8px rgba(0, 0, 0, 0.12)' },
  { label: 'Bold',   value: '0 24px 48px -16px rgba(0, 0, 0, 0.18)' },
];

function ShadowCell({ value, onChange }: CellProps) {
  const parsed = parseShadow(value);
  const [free,   setFree]   = useState(!parsed && (value || '').length > 0 && value !== 'none');
  const [advanced, setAdvanced] = useState(false);

  if (free) {
    return (
      <div className="tsa-tk-cell">
        <span className="tsa-tk-shadprev" style={{ boxShadow: value === 'none' ? 'none' : value }} aria-hidden="true" />
        <input
          type="text"
          className="tsa-tk-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => { if (parseShadow(value)) setFree(false); }}
          placeholder="0 4px 12px rgba(0,0,0,0.1)"
          spellCheck={false}
        />
        <button type="button" className="tsa-tk-iconbtn tsa-tk-iconbtn--xs" title="Visual builder" onClick={() => setFree(false)}>✎</button>
      </div>
    );
  }

  // No-shadow / unparseable — show presets only.
  if (!parsed) {
    return (
      <div className="tsa-tk-cell tsa-tk-cell--shadow">
        <span className="tsa-tk-shadprev" style={{ boxShadow: 'none' }} aria-hidden="true" />
        <div className="tsa-shad-presets">
          {SHADOW_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className={'tsa-shad-preset' + ((value === p.value || (p.value === 'none' && (!value || value === 'none'))) ? ' is-active' : '')}
              onClick={() => onChange(p.value)}
              title={p.value}
            >
              <span className="tsa-shad-preset__demo" style={{ boxShadow: p.value === 'none' ? 'none' : p.value }} />
              <span className="tsa-shad-preset__label">{p.label}</span>
            </button>
          ))}
        </div>
        <button type="button" className="tsa-tk-iconbtn tsa-tk-iconbtn--xs" title="Custom value" onClick={() => setFree(true)}>⌨</button>
      </div>
    );
  }

  function patch(p: Partial<ParsedShadow>) {
    onChange(serializeShadow({ ...parsed!, ...p }));
  }

  // Detect which preset matches (if any) for active state highlight.
  const matchingPreset = SHADOW_PRESETS.find((p) => p.value === value);

  // Color picker only handles hex; opacity slider lives separately.
  const hexMatch  = /^#[0-9a-f]{6}$/i.test(parsed.color);
  const rgbaMatch = parsed.color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/i);
  const colorHex  = hexMatch ? parsed.color
                  : rgbaMatch ? '#' + ['', '', ''].map((_, i) => parseInt(rgbaMatch[i + 1], 10).toString(16).padStart(2, '0')).join('')
                  : '#000000';
  const colorAlpha = rgbaMatch && rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;

  function setHexColor(hex: string) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    patch({ color: `rgba(${r}, ${g}, ${b}, ${colorAlpha})` });
  }

  function setAlpha(a: number) {
    if (rgbaMatch) {
      patch({ color: `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${a})` });
    } else if (hexMatch) {
      const c = parsed!.color;
      const r = parseInt(c.slice(1, 3), 16);
      const g = parseInt(c.slice(3, 5), 16);
      const b = parseInt(c.slice(5, 7), 16);
      patch({ color: `rgba(${r}, ${g}, ${b}, ${a})` });
    }
  }

  return (
    <div className="tsa-tk-cell tsa-tk-cell--shadow">
      <span className="tsa-tk-shadprev tsa-tk-shadprev--lg" style={{ boxShadow: value }} aria-hidden="true" />

      <div className="tsa-shad-builder">
        {/* Preset chips */}
        <div className="tsa-shad-presets">
          {SHADOW_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className={'tsa-shad-preset' + (matchingPreset?.label === p.label ? ' is-active' : '')}
              onClick={() => onChange(p.value)}
              title={p.value}
            >
              <span className="tsa-shad-preset__demo" style={{ boxShadow: p.value === 'none' ? 'none' : p.value }} />
              <span className="tsa-shad-preset__label">{p.label}</span>
            </button>
          ))}
        </div>

        {/* Two main sliders — Y offset + Blur — cover 80% of designed shadows */}
        <div className="tsa-shad-sliders">
          <label className="tsa-shad-slider">
            <span className="tsa-shad-slider__label">Distance</span>
            <input type="range" min={0} max={48} value={parsed.y} onChange={(e) => patch({ y: parseFloat(e.target.value) })} />
            <span className="tsa-shad-slider__num">{parsed.y}px</span>
          </label>
          <label className="tsa-shad-slider">
            <span className="tsa-shad-slider__label">Blur</span>
            <input type="range" min={0} max={80} value={parsed.blur} onChange={(e) => patch({ blur: parseFloat(e.target.value) })} />
            <span className="tsa-shad-slider__num">{parsed.blur}px</span>
          </label>
          <label className="tsa-shad-slider">
            <span className="tsa-shad-slider__label">Opacity</span>
            <input type="range" min={0} max={100} value={Math.round(colorAlpha * 100)} onChange={(e) => setAlpha(parseInt(e.target.value, 10) / 100)} />
            <span className="tsa-shad-slider__num">{Math.round(colorAlpha * 100)}%</span>
          </label>
        </div>

        {/* Color + advanced toggle row */}
        <div className="tsa-shad-row">
          <label className="tsa-shad-color" title={`Shadow color: ${parsed.color}`}>
            <span className="tsa-tk-swatch__bg" />
            <span className="tsa-tk-swatch__fill" style={{ background: parsed.color }} />
            <input type="color" value={colorHex} onChange={(e) => setHexColor(e.target.value)} />
          </label>
          <label className="tsa-shad-inset" title="Inset shadow">
            <input type="checkbox" checked={parsed.inset} onChange={(e) => patch({ inset: e.target.checked })} />
            <span>inset</span>
          </label>
          <button type="button" className="tsa-shad-advanced-toggle" onClick={() => setAdvanced((v) => !v)}>
            {advanced ? '− Hide advanced' : '+ Advanced'}
          </button>
          <button type="button" className="tsa-tk-iconbtn tsa-tk-iconbtn--xs" title="Custom CSS" onClick={() => setFree(true)}>⌨</button>
        </div>

        {advanced && (
          <div className="tsa-shad-advanced">
            <label className="tsa-shad-slider">
              <span className="tsa-shad-slider__label">X offset</span>
              <input type="range" min={-32} max={32} value={parsed.x} onChange={(e) => patch({ x: parseFloat(e.target.value) })} />
              <span className="tsa-shad-slider__num">{parsed.x}px</span>
            </label>
            <label className="tsa-shad-slider">
              <span className="tsa-shad-slider__label">Spread</span>
              <input type="range" min={-32} max={32} value={parsed.spread} onChange={(e) => patch({ spread: parseFloat(e.target.value) })} />
              <span className="tsa-shad-slider__num">{parsed.spread}px</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

function AddTokenForm({ onAdd, onCancel }: { onAdd: (name: string, light: string, dark: string) => boolean; onCancel: () => void }) {
  const [name,  setName]  = useState('');
  const [light, setLight] = useState('#ffffff');
  const [dark,  setDark]  = useState('#0a0a0a');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onAdd(name.trim(), light, dark);
  }

  return (
    <form className="tsa-add-token" onSubmit={submit}>
      <div className="tsa-add-token__name">
        <span className="tsa-add-token__prefix">--tw-</span>
        <input
          type="text"
          autoFocus
          placeholder="avero-my-color"
          value={name.replace(/^--tw-/, '')}
          onChange={(e) => setName('--tw-' + e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase())}
          spellCheck={false}
        />
      </div>
      <ColorCell value={light} onChange={setLight} />
      <ColorCell value={dark}  onChange={setDark} />
      <div className="tsa-add-token__actions">
        <button type="button" onClick={onCancel} className="tsa-btn tsa-btn--ghost tsa-btn--sm">Cancel</button>
        <button type="submit" className="tsa-btn tsa-btn--accent tsa-btn--sm">Add to both</button>
      </div>
    </form>
  );
}
