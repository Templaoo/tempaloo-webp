"use client";

/**
 * "What shipped recently" — surfaces v0.4-0.5 features that aren't
 * obvious from the rest of the landing page (restore, resize, presets,
 * post-upload stats, WP-CLI, dev hooks). Each card has a tiny working
 * mockup so visitors instantly see what the feature looks like.
 */
export function WhatsNew() {
    return (
        <section className="wn-section" id="whats-new">
            <style dangerouslySetInnerHTML={{ __html: css }} />
            <div className="wn-container">
                <div className="wn-head">
                    <span className="wn-eyebrow">JUST SHIPPED · v0.5</span>
                    <h2 className="wn-h">Six new features built for the way you actually work.</h2>
                    <p className="wn-lead">
                        From the hands-off "set it and forget it" plugin you already love, plus six
                        features the agency segment kept asking for.
                    </p>
                </div>

                <div className="wn-grid">
                    {/* 1. Inline upload stats */}
                    <Card title="Per-image stats, inline" tag="UI">
                        <div className="wn-mock wn-mock-row">
                            <div className="wn-mock-thumb" />
                            <div className="wn-mock-body">
                                <div className="wn-mock-name">sunset-portfolio.jpg</div>
                                <div className="wn-mock-stats">
                                    <span className="wn-mock-pill">✓ WEBP</span>
                                    <span className="wn-mock-saved">−67%</span>
                                    <span className="wn-mock-meta">1.2 MB → 412 KB</span>
                                </div>
                            </div>
                        </div>
                        <p className="wn-card-p">
                            Compression saved % shows directly under the filename on
                            <code>media-new.php</code>, no need to click Edit.
                        </p>
                    </Card>

                    {/* 2. Restore one-click */}
                    <Card title="Restore originals — one click" tag="SAFETY">
                        <div className="wn-mock wn-mock-restore">
                            <div className="wn-restore-row">
                                <div className="wn-restore-icon">↺</div>
                                <button className="wn-restore-btn">Restore (847 images)</button>
                            </div>
                            <div className="wn-restore-hint">Originals are never touched.</div>
                        </div>
                        <p className="wn-card-p">
                            Wipes every <code>.webp</code> / <code>.avif</code> sibling. Your
                            JPEG/PNG/GIF originals stay intact — re-run a Bulk to regenerate.
                        </p>
                    </Card>

                    {/* 3. Resize on upload */}
                    <Card title="Resize on upload" tag="QUOTA">
                        <div className="wn-mock wn-mock-segment">
                            {["Off", "1920", "2560", "3840"].map((v, i) => (
                                <div key={v} className={`wn-seg ${i === 2 ? "wn-seg-on" : ""}`}>
                                    {v}{v !== "Off" && <span>px</span>}
                                </div>
                            ))}
                        </div>
                        <p className="wn-card-p">
                            Hooks WordPress core's big-image scaler — the user's original is
                            preserved as a <code>-scaled-original</code> sibling.
                        </p>
                    </Card>

                    {/* 4. Quality presets */}
                    <Card title="3 quality presets" tag="UX">
                        <div className="wn-mock wn-mock-presets">
                            {[
                                { name: "Normal",     q: 85, on: false },
                                { name: "Aggressive", q: 75, on: true  },
                                { name: "Ultra",      q: 60, on: false },
                            ].map((p) => (
                                <div key={p.name} className={`wn-preset ${p.on ? "wn-preset-on" : ""}`}>
                                    <div className="wn-preset-name">{p.name}</div>
                                    <div className="wn-preset-q">q={p.q}</div>
                                </div>
                            ))}
                        </div>
                        <p className="wn-card-p">
                            One-click presets above the slider — picks a sensible default so users
                            don't agonize over &laquo;78 vs 82&raquo;.
                        </p>
                    </Card>

                    {/* 5. WP-CLI */}
                    <Card title="WP-CLI for agencies" tag="DEVOPS">
                        <div className="wn-mock wn-mock-term">
                            <div className="wn-term-line">
                                <span className="wn-term-prompt">$</span> wp tempaloo bulk --limit=500
                            </div>
                            <div className="wn-term-bar">
                                <div className="wn-term-bar-fill" />
                            </div>
                            <div className="wn-term-line wn-term-line-ok">
                                <span className="wn-term-mark">✓</span> 498 converted, 2 failed
                            </div>
                        </div>
                        <p className="wn-card-p">
                            Six commands to script across N sites:
                            <code>activate</code>, <code>bulk</code>, <code>restore</code>,
                            <code>quota</code>, <code>settings</code>, <code>status</code>.
                        </p>
                    </Card>

                    {/* 6. Dev hooks */}
                    <Card title="3 developer hooks" tag="EXTENSIBILITY">
                        <div className="wn-mock wn-mock-code">
                            <div className="wn-code-line"><span className="wn-c-fn">add_filter</span>(<span className="wn-c-str">&apos;tempaloo_quality_for&apos;</span>,</div>
                            <div className="wn-code-line wn-code-indent"><span className="wn-c-kw">function</span>(<span className="wn-c-var">$q</span>, <span className="wn-c-var">$id</span>) {`{`}</div>
                            <div className="wn-code-line wn-code-indent2"><span className="wn-c-kw">return</span> <span className="wn-c-num">92</span>; <span className="wn-c-cm">// portfolio</span></div>
                            <div className="wn-code-line wn-code-indent">{`}`}, <span className="wn-c-num">10</span>, <span className="wn-c-num">2</span>);</div>
                        </div>
                        <p className="wn-card-p">
                            <code>tempaloo_skip_attachment</code>, <code>tempaloo_quality_for</code>,
                            <code>tempaloo_after_convert</code> — fire on auto-convert AND CLI bulk.
                        </p>
                    </Card>
                </div>

                <div className="wn-foot">
                    <a href="/docs" className="wn-foot-link">Read the full docs →</a>
                </div>
            </div>
        </section>
    );
}

function Card({ title, tag, children }: { title: string; tag: string; children: React.ReactNode }) {
    return (
        <div className="wn-card">
            <div className="wn-card-h">
                <span>{title}</span>
                <span className="wn-tag">{tag}</span>
            </div>
            {children}
        </div>
    );
}

const css = `
.wn-section { padding: 96px 0; border-top: 1px solid var(--line); }
.wn-container { max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 3vw, 24px); }
.wn-head { text-align: center; max-width: 720px; margin: 0 auto 48px; }
.wn-eyebrow { font-family: var(--font-geist-mono), monospace; font-size: 11px; letter-spacing: 0.04em; color: var(--success); }
.wn-h { font-family: var(--font-geist-sans), sans-serif; font-size: clamp(28px, 4.4vw, 44px); letter-spacing: -0.035em; font-weight: 600; line-height: 1.1; margin: 10px 0 14px; color: var(--ink); text-wrap: balance; }
.wn-lead { font-size: 16px; color: var(--ink-2); line-height: 1.6; }

.wn-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
@media (max-width: 960px) { .wn-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .wn-grid { grid-template-columns: 1fr; } }

.wn-card { padding: 22px 22px 24px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); display: flex; flex-direction: column; gap: 14px; transition: border-color .15s, transform .15s; }
.wn-card:hover { border-color: var(--line-2); transform: translateY(-2px); }
.wn-card-h { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 15px; font-weight: 600; color: var(--ink); letter-spacing: -0.015em; }
.wn-tag { font-family: var(--font-geist-mono), monospace; font-size: 9.5px; letter-spacing: 0.05em; padding: 2px 6px; border-radius: 4px; background: var(--bg-2); color: var(--ink-3); border: 1px solid var(--line); font-weight: 500; }
.wn-card-p { font-size: 13px; color: var(--ink-2); line-height: 1.6; margin: 0; }
.wn-card-p code { font-family: var(--font-geist-mono), monospace; font-size: 11.5px; padding: 1px 5px; border-radius: 3px; background: var(--bg-2); border: 1px solid var(--line); margin: 0 2px; }

.wn-mock { padding: 12px; border-radius: 8px; background: var(--bg-2); border: 1px solid var(--line); min-height: 90px; display: flex; flex-direction: column; gap: 8px; }

/* Mock 1: media row */
.wn-mock-row { flex-direction: row; align-items: center; gap: 10px; }
.wn-mock-thumb { width: 42px; height: 42px; border-radius: 4px; background: linear-gradient(135deg, #f3d4a8, #b15a2c, #2a1408); flex-shrink: 0; }
.wn-mock-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.wn-mock-name { font-size: 11.5px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wn-mock-stats { display: inline-flex; align-items: center; gap: 6px; font-size: 10.5px; flex-wrap: wrap; }
.wn-mock-pill { padding: 1px 5px; border-radius: 3px; background: color-mix(in oklab, var(--success) 18%, transparent); color: var(--success); font-weight: 600; }
.wn-mock-saved { color: var(--success); font-weight: 600; }
.wn-mock-meta { color: var(--ink-3); font-family: var(--font-geist-mono), monospace; font-size: 10px; }

/* Mock 2: restore */
.wn-restore-row { display: flex; gap: 8px; align-items: center; }
.wn-restore-icon { width: 28px; height: 28px; border-radius: 6px; background: var(--bg); border: 1px solid var(--line-2); display: grid; place-items: center; color: var(--ink); font-size: 14px; }
.wn-restore-btn { padding: 6px 12px; background: var(--bg); border: 1px solid var(--line-2); border-radius: 6px; font-size: 11.5px; font-weight: 500; color: var(--ink); cursor: pointer; flex: 1; text-align: center; }
.wn-restore-hint { font-size: 11px; color: var(--ink-3); font-style: italic; }

/* Mock 3: resize segment */
.wn-mock-segment { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; padding: 8px; }
.wn-seg { padding: 6px 4px; text-align: center; border-radius: 6px; border: 1px solid var(--line-2); background: var(--bg); font-size: 11px; font-weight: 500; color: var(--ink-2); }
.wn-seg span { font-size: 9px; color: var(--ink-3); margin-left: 1px; }
.wn-seg-on { border-color: var(--ink); background: var(--bg); color: var(--ink); }

/* Mock 4: presets */
.wn-mock-presets { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.wn-preset { padding: 8px; border-radius: 6px; border: 1px solid var(--line-2); background: var(--bg); text-align: center; }
.wn-preset-name { font-size: 11px; font-weight: 600; color: var(--ink); }
.wn-preset-q { font-size: 9px; font-family: var(--font-geist-mono), monospace; color: var(--ink-3); margin-top: 2px; }
.wn-preset-on { border-color: var(--ink); }

/* Mock 5: terminal */
.wn-mock-term { background: #0f1419; border: 1px solid #1d2228; padding: 10px 12px; font-family: var(--font-geist-mono), monospace; font-size: 11.5px; line-height: 1.5; color: #d4d4d4; gap: 6px; }
.wn-term-prompt { color: #6c7c8c; margin-right: 6px; }
.wn-term-mark { color: #4ade80; margin-right: 4px; }
.wn-term-line-ok { color: #4ade80; }
.wn-term-bar { height: 4px; background: #1d2228; border-radius: 2px; overflow: hidden; }
.wn-term-bar-fill { width: 78%; height: 100%; background: linear-gradient(90deg, #4ade80, #22c55e); animation: wnBarFill 2.4s ease-in-out infinite; transform-origin: left; }
@keyframes wnBarFill { 0% { transform: scaleX(0.1); } 60% { transform: scaleX(0.78); } 100% { transform: scaleX(0.78); } }

/* Mock 6: code */
.wn-mock-code { background: var(--bg); padding: 10px 12px; font-family: var(--font-geist-mono), monospace; font-size: 11px; line-height: 1.6; gap: 0; min-height: auto; border-color: var(--line); }
.wn-code-line { color: var(--ink); }
.wn-code-indent { padding-left: 12px; }
.wn-code-indent2 { padding-left: 24px; }
.wn-c-fn  { color: #c084fc; }
.wn-c-kw  { color: #f472b6; }
.wn-c-str { color: #4ade80; }
.wn-c-var { color: #60a5fa; }
.wn-c-num { color: #fb923c; }
.wn-c-cm  { color: var(--ink-3); font-style: italic; }

.wn-foot { text-align: center; margin-top: 36px; }
.wn-foot-link { font-size: 14px; font-weight: 500; color: var(--ink); border-bottom: 1px solid var(--line-2); padding-bottom: 1px; }
.wn-foot-link:hover { border-bottom-color: var(--ink); }

@media (prefers-reduced-motion: reduce) {
  .wn-term-bar-fill { animation: none; transform: scaleX(0.78); }
}
`;
