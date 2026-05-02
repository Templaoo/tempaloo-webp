import { useState } from 'react';
import { api, type AnimationProfile } from '../../api';
import { toast } from '../../components/Toast';

/**
 * Profiles — Plan B.
 * Bundles complets (globals + element rules) appliquables en 1 clic et
 * réutilisables entre tous les templates installés.
 */
export function ProfilesTab({
  profiles, active, onApplied, onListChange,
}: {
  profiles:     AnimationProfile[];
  active:       string;
  onApplied:    () => void;            // refetch v2 state
  onListChange: (next: { profiles: AnimationProfile[]; active: string }) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [showSnap, setShowSnap] = useState(false);
  const [snap, setSnap] = useState({ id: '', label: '', description: '' });

  async function apply(id: string) {
    setBusy(`apply:${id}`);
    try {
      await api.applyProfile(id);
      onApplied();
      toast.info(`Profil "${id}" appliqué. Rechargez vos pages pour voir l'effet.`);
    } catch (e) {
      toast.error(`Apply failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!confirm(`Supprimer le profil "${id}" ?`)) return;
    setBusy(`del:${id}`);
    try {
      const next = await api.deleteUserProfile(id);
      onListChange(next);
      toast.info(`Profil "${id}" supprimé.`);
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function saveSnapshot() {
    if (!snap.id || !snap.label) {
      toast.error('id et label requis');
      return;
    }
    setBusy('snapshot');
    try {
      const next = await api.snapshotProfile(snap.id, snap.label, snap.description);
      onListChange(next);
      setShowSnap(false);
      setSnap({ id: '', label: '', description: '' });
      toast.info(`Profil "${snap.label}" sauvegardé.`);
    } catch (e) {
      toast.error(`Snapshot failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="tsa-anim-tabpanel">
      <div className="tsa-card">
        <header className="tsa-card__header">
          <div>
            <div className="tsa-card__title">Profils d'animation</div>
            <div className="tsa-card__subtitle">
              Un profil = bundle complet de globals + règles par élément. Applique-le en 1 clic à tout le site.
              Réutilisable entre tous les templates installés. Tes overrides par widget sont préservés.
            </div>
          </div>
          <button
            type="button"
            className="tsa-btn-ghost"
            onClick={() => setShowSnap((v) => !v)}
          >
            {showSnap ? 'Annuler' : '💾 Sauvegarder l\'état actuel'}
          </button>
        </header>

        {showSnap && (
          <div className="tsa-anim-snapshot-form">
            <input
              type="text"
              className="tsa-tk-input"
              placeholder="Identifiant (slug, ex: my-style)"
              value={snap.id}
              onChange={(e) => setSnap({ ...snap, id: e.target.value })}
            />
            <input
              type="text"
              className="tsa-tk-input"
              placeholder="Nom affiché (ex: My Style)"
              value={snap.label}
              onChange={(e) => setSnap({ ...snap, label: e.target.value })}
            />
            <input
              type="text"
              className="tsa-tk-input"
              placeholder="Description (optionnel)"
              value={snap.description}
              onChange={(e) => setSnap({ ...snap, description: e.target.value })}
            />
            <button
              type="button"
              className="tsa-btn-primary"
              disabled={busy === 'snapshot'}
              onClick={saveSnapshot}
            >
              {busy === 'snapshot' ? 'Enregistrement…' : 'Sauvegarder'}
            </button>
          </div>
        )}

        <div className="tsa-anim-profile-grid">
          {profiles.map((p) => {
            const isActive = p.id === active;
            return (
              <div key={p.id} className={'tsa-anim-profile-card' + (isActive ? ' is-active' : '')}>
                <div className="tsa-anim-profile-card__head">
                  <strong>{p.label}</strong>
                  <span className={'tsa-pill ' + (p.source === 'user' ? 'tsa-pill--accent' : '')}>{p.source === 'user' ? 'custom' : 'shipped'}</span>
                </div>
                <code className="tsa-anim-profile-card__id">{p.id}</code>
                <p className="tsa-anim-profile-card__desc">{p.description}</p>

                {p.elementRules && (
                  <div className="tsa-anim-profile-card__rules">
                    {Object.entries(p.elementRules).slice(0, 4).map(([k, r]) => (
                      <div key={k} className="tsa-anim-profile-card__rule">
                        <code>{k}</code> → {r.preset || '—'}
                      </div>
                    ))}
                    {Object.keys(p.elementRules).length > 4 && (
                      <div className="tsa-anim-profile-card__rule tsa-anim-profile-card__rule--more">
                        + {Object.keys(p.elementRules).length - 4} autres
                      </div>
                    )}
                  </div>
                )}

                <div className="tsa-anim-profile-card__actions">
                  <button
                    type="button"
                    className={'tsa-btn-primary' + (isActive ? ' is-disabled' : '')}
                    disabled={isActive || busy === `apply:${p.id}`}
                    onClick={() => apply(p.id)}
                  >
                    {isActive ? '✓ Actif' : (busy === `apply:${p.id}` ? 'Application…' : 'Appliquer')}
                  </button>
                  {p.source === 'user' && (
                    <button
                      type="button"
                      className="tsa-btn-ghost"
                      disabled={busy === `del:${p.id}`}
                      onClick={() => remove(p.id)}
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
