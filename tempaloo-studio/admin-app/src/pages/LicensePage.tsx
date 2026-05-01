export function LicensePage() {
  return (
    <>
      <header className="tsa-pagehead">
        <div>
          <h1 className="tsa-pagehead__title">License</h1>
          <p className="tsa-pagehead__subtitle">
            Activate Tempaloo Studio to unlock every premium template, plus future updates.
          </p>
        </div>
      </header>

      <div className="tsa-card" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--tsa-space-5)', alignItems: 'start' }}>
        <div>
          <div className="tsa-card__title">Activate your license key</div>
          <div className="tsa-card__subtitle tsa-mt-3">
            Enter the key you received in your purchase email. Each key can be activated on the
            number of sites included in your plan.
          </div>

          <div className="tsa-mt-4" style={{ display: 'flex', gap: 8, maxWidth: 520 }}>
            <input
              type="text"
              placeholder="TEMPALOO-XXXX-XXXX-XXXX"
              className="tsa-token-row__input"
              style={{ flex: 1, height: 38, fontSize: 13 }}
              spellCheck={false}
            />
            <button type="button" className="tsa-btn tsa-btn--primary" disabled>
              Activate
            </button>
          </div>
          <div className="tsa-mt-3" style={{ fontSize: 12, color: 'var(--tsa-text-muted)' }}>
            Activation API coming in v0.2 — wired to <code style={{ fontFamily: 'var(--tsa-font-mono)' }}>api.tempaloo.com/v1/license/validate</code>.
          </div>
        </div>

        <aside style={{ background: 'var(--tsa-bg-soft)', border: '1px solid var(--tsa-border)', borderRadius: 'var(--tsa-radius-md)', padding: 'var(--tsa-space-4)' }}>
          <div style={{ fontSize: 12, color: 'var(--tsa-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
            Plans
          </div>
          <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
            {[
              { name: 'Solo',    sites: '1 site',          price: '€89' },
              { name: 'Studio',  sites: '5 sites',         price: '€189' },
              { name: 'Agency',  sites: 'Unlimited sites', price: '€399' },
            ].map((p) => (
              <li key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--tsa-border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--tsa-text-muted)' }}>{p.sites}</div>
                </div>
                <div style={{ fontFamily: 'var(--tsa-font-heading)', fontSize: 18 }}>{p.price}</div>
              </li>
            ))}
          </ul>
          <a
            href="https://tempaloo.com/studio"
            target="_blank"
            rel="noopener"
            className="tsa-btn tsa-btn--secondary tsa-btn--sm tsa-mt-4"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            See full pricing
          </a>
        </aside>
      </div>
    </>
  );
}
