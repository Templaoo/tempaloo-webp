import { useEffect, useMemo, useState } from 'react';
import type { AppState, TemplateFull } from '../types';
import { api } from '../api';
import { toast } from '../components/Toast';

interface Props {
  state:        AppState | null;
  onStateUpdate: (s: AppState) => void;
}

type Mode    = 'light' | 'dark';
type Variant = 'primary' | 'secondary' | 'ghost';
type State   = 'default' | 'hover';

interface ButtonTokens {
  bg:           string;
  text:         string;
  border:       string;
  bgHover:      string;
  textHover:    string;
  borderHover:  string;
  radius?:      string;  // primary only carries shape tokens
  height?:      string;
  paddingX?:    string;
}

function readBtn(values: Record<string, string>, slug: string, variant: Variant): ButtonTokens {
  const k = (suffix: string) => `--tw-${slug}-btn-${variant}-${suffix}`;
  return {
    bg:           values[k('bg')]           ?? '',
    text:         values[k('text')]         ?? '',
    border:       values[k('border')]       ?? '',
    bgHover:      values[k('bg-hover')]     ?? '',
    textHover:    values[k('text-hover')]   ?? '',
    borderHover:  values[k('border-hover')] ?? '',
    radius:       values[k('radius')]       ?? '',
    height:       values[k('height')]       ?? '',
    paddingX:     values[k('padding-x')]    ?? '',
  };
}

export function ComponentsPage({ state, onStateUpdate }: Props) {
  const [tpl, setTpl]       = useState<TemplateFull | null>(null);
  const [loading, setLoad]  = useState(false);
  const [drafts, setDrafts] = useState<Record<Mode, Record<string, string>>>({ light: {}, dark: {} });
  const [mode,   setMode]   = useState<Mode>('light');
  const [variant, setVariant] = useState<Variant>('primary');
  const [stateTab, setStateTab] = useState<State>('default');
  const [saving, setSave]   = useState(false);

  const activeSlug = state?.active_slug ?? null;
  const shortSlug  = useMemo(() => (activeSlug ? activeSlug.split('-')[0] : ''), [activeSlug]);

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

  if (!activeSlug) {
    return (
      <>
        <header className="tsa-pagehead">
          <div>
            <h1 className="tsa-pagehead__title">Components</h1>
            <p className="tsa-pagehead__subtitle">Activate a template first to edit its components.</p>
          </div>
        </header>
        <div className="tsa-empty">
          <h3>No active template</h3>
          <p>Templates → activate one to unlock the visual button editor.</p>
        </div>
      </>
    );
  }

  if (loading || !tpl) {
    return <div className="tsa-card"><div className="tsa-skel" style={{ height: 28 }} /></div>;
  }

  const btns: Record<Variant, ButtonTokens> = {
    primary:   readBtn(drafts[mode], shortSlug, 'primary'),
    secondary: readBtn(drafts[mode], shortSlug, 'secondary'),
    ghost:     readBtn(drafts[mode], shortSlug, 'ghost'),
  };

  function setToken(name: string, value: string) {
    setDrafts((d) => ({ ...d, [mode]: { ...d[mode], [name]: value } }));
  }

  // Build the inline preview style for each variant — uses default values
  // unless the user is mid-hover on the preview.
  function previewStyle(v: ButtonTokens, hover = false): React.CSSProperties {
    return {
      background: hover ? v.bgHover : v.bg,
      color:      hover ? v.textHover : v.text,
      border:     '1px solid ' + (hover ? v.borderHover : v.border),
      borderRadius: v.radius || undefined,
      height:     v.height || undefined,
      padding:    v.paddingX ? `0 ${v.paddingX}` : undefined,
    };
  }

  async function save() {
    if (!activeSlug || !tpl) return;
    setSave(true);
    try {
      const baselineL = tpl.tokens?.light ?? {};
      const baselineD = tpl.tokens?.dark  ?? {};
      const deltaL: Record<string, string> = {};
      const deltaD: Record<string, string> = {};
      Object.keys(drafts.light).forEach((k) => { if (drafts.light[k] !== baselineL[k]) deltaL[k] = drafts.light[k]; });
      Object.keys(drafts.dark).forEach((k)  => { if (drafts.dark[k]  !== baselineD[k]) deltaD[k] = drafts.dark[k]; });
      let next = await api.saveTokens(activeSlug, 'light', deltaL);
      next     = await api.saveTokens(activeSlug, 'dark',  deltaD);
      onStateUpdate(next);
      toast.info('Buttons saved.');
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSave(false);
    }
  }

  // Token name builder for the variant currently being edited
  const tk = (suffix: string) => `--tw-${shortSlug}-btn-${variant}-${suffix}`;

  return (
    <>
      <header className="tsa-pagehead">
        <div>
          <h1 className="tsa-pagehead__title">Components</h1>
          <p className="tsa-pagehead__subtitle">
            Edit the active template's button styles visually. Changes apply to every CTA across
            the site — Header, Hero, Pricing, Final CTA — without touching CSS.
          </p>
        </div>
        <div className="tsa-pagehead__actions">
          <div className="tsa-segmented">
            <button type="button" className={mode === 'light' ? 'is-active' : ''} onClick={() => setMode('light')}>Light</button>
            <button type="button" className={mode === 'dark'  ? 'is-active' : ''} onClick={() => setMode('dark')}>Dark</button>
          </div>
          <button type="button" onClick={save} disabled={saving} className="tsa-btn tsa-btn--primary tsa-btn--sm">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </header>

      {/* Live preview — three buttons, hover them to see the hover state */}
      <div className="tsa-comp-preview" data-mode={mode}>
        <div className="tsa-comp-preview__label">Live preview · hover any button to see its hover state</div>
        <div className="tsa-comp-preview__row">
          {(['primary', 'secondary', 'ghost'] as Variant[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => { setVariant(v); }}
              className={'tsa-comp-preview-btn' + (variant === v ? ' is-selected' : '')}
              style={previewStyle(btns[v])}
              onMouseEnter={(e) => Object.assign(e.currentTarget.style, previewStyle(btns[v], true))}
              onMouseLeave={(e) => Object.assign(e.currentTarget.style, previewStyle(btns[v], false))}
            >
              {v === 'primary' ? 'Book a call' : v === 'secondary' ? 'Our process' : 'or read more'}
            </button>
          ))}
        </div>
        <div className="tsa-comp-preview__hint">Click a button above to edit its tokens →</div>
      </div>

      {/* Editor for the selected variant */}
      <div className="tsa-card tsa-mt-4">
        <header className="tsa-card__header">
          <div>
            <div className="tsa-card__title">
              {variant.charAt(0).toUpperCase() + variant.slice(1)} button
            </div>
            <div className="tsa-card__subtitle">
              {variant === 'primary'   && 'Filled, high-contrast — main conversion CTA.'}
              {variant === 'secondary' && 'Outlined — supporting action next to the primary.'}
              {variant === 'ghost'     && 'Text-only — for tertiary links inside CTAs.'}
            </div>
          </div>
          <div className="tsa-segmented tsa-segmented--sm">
            <button type="button" className={stateTab === 'default' ? 'is-active' : ''} onClick={() => setStateTab('default')}>Default</button>
            <button type="button" className={stateTab === 'hover'   ? 'is-active' : ''} onClick={() => setStateTab('hover')}>Hover</button>
          </div>
        </header>

        <div className="tsa-comp-fields">
          {stateTab === 'default' ? (
            <>
              <ColorField label="Background"   name={tk('bg')}     value={drafts[mode][tk('bg')]     ?? ''} onChange={setToken} />
              <ColorField label="Text"         name={tk('text')}   value={drafts[mode][tk('text')]   ?? ''} onChange={setToken} />
              <ColorField label="Border"       name={tk('border')} value={drafts[mode][tk('border')] ?? ''} onChange={setToken} />
            </>
          ) : (
            <>
              <ColorField label="Background (hover)" name={tk('bg-hover')}     value={drafts[mode][tk('bg-hover')]     ?? ''} onChange={setToken} />
              <ColorField label="Text (hover)"       name={tk('text-hover')}   value={drafts[mode][tk('text-hover')]   ?? ''} onChange={setToken} />
              <ColorField label="Border (hover)"     name={tk('border-hover')} value={drafts[mode][tk('border-hover')] ?? ''} onChange={setToken} />
            </>
          )}
        </div>

        {variant === 'primary' && stateTab === 'default' && (
          <div className="tsa-comp-fields tsa-mt-4" style={{ borderTop: '1px solid var(--tsa-border)', paddingTop: 'var(--tsa-space-4)' }}>
            <PxField label="Height"     name={tk('height')}    value={drafts[mode][tk('height')]    ?? ''} onChange={setToken} max={80} />
            <PxField label="Padding X"  name={tk('padding-x')} value={drafts[mode][tk('padding-x')] ?? ''} onChange={setToken} max={64} />
            <PxField label="Radius"     name={tk('radius')}    value={drafts[mode][tk('radius')]    ?? ''} onChange={setToken} max={64} pillFlag />
          </div>
        )}
      </div>
    </>
  );
}

function ColorField({ label, name, value, onChange }: { label: string; name: string; value: string; onChange: (k: string, v: string) => void }) {
  const isHex = /^#[0-9a-f]{3,8}$/i.test(value);
  return (
    <div className="tsa-comp-field">
      <label className="tsa-comp-field__label">{label}</label>
      <div className="tsa-comp-field__row">
        <label className="tsa-tk-swatch">
          <span className="tsa-tk-swatch__bg" />
          <span className="tsa-tk-swatch__fill" style={{ background: value || 'transparent' }} />
          <input type="color" value={isHex ? value.slice(0, 7) : '#000000'} onChange={(e) => onChange(name, e.target.value)} />
        </label>
        <input
          type="text"
          className="tsa-tk-input"
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

function PxField({ label, name, value, onChange, max, pillFlag }: { label: string; name: string; value: string; onChange: (k: string, v: string) => void; max: number; pillFlag?: boolean }) {
  const isPill = pillFlag && (value === '999px' || value === '9999px');
  const num = parseInt(value, 10) || 0;
  return (
    <div className="tsa-comp-field">
      <label className="tsa-comp-field__label">{label}</label>
      <div className="tsa-comp-field__row">
        <input
          type="range"
          min={0}
          max={max}
          value={isPill ? max : Math.min(num, max)}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            onChange(name, v >= max && pillFlag ? '999px' : v + 'px');
          }}
          style={{ flex: 1, accentColor: 'var(--tsa-accent)' }}
        />
        <input
          type="text"
          className="tsa-tk-input"
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          spellCheck={false}
          style={{ width: 80 }}
        />
      </div>
    </div>
  );
}
