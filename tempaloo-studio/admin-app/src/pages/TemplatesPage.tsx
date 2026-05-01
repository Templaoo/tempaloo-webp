import { useState } from 'react';
import type { AppState, TemplateSummary } from '../types';
import { api } from '../api';
import { toast } from '../components/Toast';

interface Props {
  state:        AppState | null;
  templates:    TemplateSummary[];
  loading:      boolean;
  onStateUpdate: (s: AppState) => void;
}

export function TemplatesPage({ state, templates, loading, onStateUpdate }: Props) {
  const activeSlug = state?.active_slug ?? null;
  const [busy, setBusy] = useState<string | null>(null);
  const [replace, setReplace] = useState(false);

  async function activate(slug: string) {
    setBusy(slug);
    try {
      const next = await api.activate(slug);
      onStateUpdate(next);
      toast.info(`Activated: ${templates.find((t) => t.slug === slug)?.name ?? slug}`);
    } catch (e) {
      toast.error(`Activation failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function deactivate() {
    setBusy('__deactivate');
    try {
      const next = await api.deactivate();
      onStateUpdate(next);
      toast.info('Template deactivated.');
    } catch (e) {
      toast.error(`Deactivation failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function importPages(slug: string) {
    setBusy(`import:${slug}`);
    try {
      const res = await api.importPages(slug, replace);
      const all = Object.values(res.pages);
      if (all.length === 0) {
        toast.info('No pages declared in this template.');
        return;
      }
      const created  = all.filter((p) => p.action === 'created').length;
      const replaced = all.filter((p) => p.action === 'replaced').length;
      const skipped  = all.filter((p) => p.action === 'skipped').length;
      const parts: string[] = [];
      if (created)  parts.push(`${created} created`);
      if (replaced) parts.push(`${replaced} replaced`);
      if (skipped)  parts.push(`${skipped} skipped (already existed)`);
      toast.info(parts.join(' · '));
    } catch (e) {
      toast.error(`Import failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <header className="tsa-pagehead">
        <div>
          <h1 className="tsa-pagehead__title">Templates</h1>
          <p className="tsa-pagehead__subtitle">
            One template active at a time. Switching is non-destructive — your saved page content
            stays put; widgets just stop being available outside the active template.
          </p>
        </div>
        {activeSlug && (
          <div className="tsa-pagehead__actions">
            <button
              type="button"
              onClick={deactivate}
              disabled={busy === '__deactivate'}
              className="tsa-btn tsa-btn--secondary"
            >
              {busy === '__deactivate' ? 'Deactivating…' : 'Deactivate current'}
            </button>
          </div>
        )}
      </header>

      {loading && <SkeletonGrid />}

      {!loading && templates.length === 0 && (
        <div className="tsa-empty">
          <h3>No templates installed yet</h3>
          <p>
            Drop a template folder under <code style={{ fontFamily: 'var(--tsa-font-mono)' }}>plugins/tempaloo-studio/templates/</code>.
            We'll auto-detect <code style={{ fontFamily: 'var(--tsa-font-mono)' }}>template.json</code>.
          </p>
        </div>
      )}

      {!loading && templates.length > 0 && (
        <div className="tsa-tpl-grid">
          {templates.map((t) => {
            const isActive = t.slug === activeSlug;
            const isBusy   = busy === t.slug;
            return (
              <article key={t.slug} className="tsa-tpl">
                <div className="tsa-tpl__thumb" aria-hidden="true">
                  {isActive && (
                    <span className="tsa-tpl__active-badge">
                      <span className="tsa-pill tsa-pill--success">
                        <span className="tsa-pill__dot" /> Active
                      </span>
                    </span>
                  )}
                  <span style={{ fontStyle: 'italic' }}>{t.name.split(' ')[0]}</span>
                </div>
                <div className="tsa-tpl__body">
                  <div className="tsa-tpl__name">{t.name}</div>
                  <div className="tsa-tpl__desc">{t.description}</div>
                  <div className="tsa-tpl__meta">
                    <div className="tsa-row">
                      {t.category && <span className="tsa-tpl__category">{t.category}</span>}
                    </div>
                    <div className="tsa-row">
                      {isActive && (
                        <>
                          <label className="tsa-replace" title="When checked, existing pages with a matching slug are overwritten instead of skipped. Useful while iterating on a template; leave OFF in production.">
                            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
                            <span>Overwrite</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => importPages(t.slug)}
                            disabled={busy === `import:${t.slug}`}
                            className="tsa-btn tsa-btn--ghost tsa-btn--sm"
                            title="Create (or overwrite) the demo pages declared in this template"
                          >
                            {busy === `import:${t.slug}` ? 'Installing…' : 'Install demo pages'}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => (isActive ? deactivate() : activate(t.slug))}
                        disabled={isBusy}
                        className={'tsa-btn tsa-btn--sm ' + (isActive ? 'tsa-btn--secondary' : 'tsa-btn--primary')}
                      >
                        {isBusy ? '…' : isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

function SkeletonGrid() {
  return (
    <div className="tsa-tpl-grid">
      {[0, 1, 2].map((i) => (
        <article key={i} className="tsa-tpl">
          <div className="tsa-skel" style={{ aspectRatio: '16 / 10', borderTopLeftRadius: 'var(--tsa-radius-lg)', borderTopRightRadius: 'var(--tsa-radius-lg)' }} />
          <div className="tsa-tpl__body">
            <div className="tsa-skel" style={{ height: 18, width: '60%' }} />
            <div className="tsa-skel" style={{ height: 12, width: '90%', marginTop: 8 }} />
            <div className="tsa-skel" style={{ height: 12, width: '70%', marginTop: 4 }} />
          </div>
        </article>
      ))}
    </div>
  );
}
