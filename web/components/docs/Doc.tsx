import { type ReactNode } from "react";

/**
 * Shared building blocks for the docs pages.
 *
 * These are intentionally small, presentational, and styled inline through
 * a single <style> block. Keeps each /docs page self-contained and lets us
 * version the doc design without touching every consumer.
 */

export function DocPage({ eyebrow, title, lead, children }: { eyebrow?: string; title: string; lead?: string; children: ReactNode }) {
    return (
        <article className="doc-page">
            <style dangerouslySetInnerHTML={{ __html: docCss }} />
            {eyebrow && <div className="doc-eyebrow">{eyebrow}</div>}
            <h1 className="doc-h1">{title}</h1>
            {lead && <p className="doc-lead">{lead}</p>}
            {children}
        </article>
    );
}

export function Section({ id, title, children }: { id?: string; title?: string; children: ReactNode }) {
    return (
        <section id={id} className="doc-section">
            {title && <h2 className="doc-h2">{title}</h2>}
            {children}
        </section>
    );
}

export function H3({ id, children }: { id?: string; children: ReactNode }) {
    return <h3 id={id} className="doc-h3">{children}</h3>;
}

export function P({ children }: { children: ReactNode }) {
    return <p className="doc-p">{children}</p>;
}

export function Code({ children }: { children: ReactNode }) {
    return <code className="doc-code">{children}</code>;
}

export function Pre({ lang, code }: { lang?: string; code: string }) {
    return (
        <div className="doc-pre">
            {lang && <span className="doc-pre-lang">{lang}</span>}
            <pre><code>{code}</code></pre>
        </div>
    );
}

export function Callout({ kind = "info", title, children }: { kind?: "info" | "warn" | "tip"; title?: string; children: ReactNode }) {
    return (
        <div className={`doc-callout doc-callout-${kind}`}>
            {title && <div className="doc-callout-h">{title}</div>}
            <div className="doc-callout-body">{children}</div>
        </div>
    );
}

export function Mockup({ chrome = "browser", url, children }: { chrome?: "browser" | "terminal" | "admin"; url?: string; children: ReactNode }) {
    return (
        <div className={`doc-mock doc-mock-${chrome}`}>
            {chrome === "terminal" ? (
                <div className="doc-mock-bar">
                    <span className="doc-traffic doc-traffic-r" />
                    <span className="doc-traffic doc-traffic-y" />
                    <span className="doc-traffic doc-traffic-g" />
                    <span className="doc-mock-title">Terminal</span>
                </div>
            ) : (
                <div className="doc-mock-bar">
                    <span className="doc-traffic doc-traffic-r" />
                    <span className="doc-traffic doc-traffic-y" />
                    <span className="doc-traffic doc-traffic-g" />
                    {url && <span className="doc-mock-url">{url}</span>}
                </div>
            )}
            <div className="doc-mock-body">{children}</div>
        </div>
    );
}

/** A faked WP admin row that looks like the post-upload entry on media-new.php. */
export function AdminUploadRow({ filename, sizes, oldSize, newSize, savedPct, format = "WEBP" }: {
    filename: string;
    sizes: number;
    oldSize: string;
    newSize: string;
    savedPct: number;
    format?: string;
}) {
    return (
        <div className="doc-row">
            <div className="doc-row-thumb" aria-hidden>
                <svg viewBox="0 0 60 60" width="60" height="60">
                    <rect width="60" height="60" fill="#3a4a5e"/>
                    <circle cx="44" cy="20" r="6" fill="#f4d97a"/>
                    <path d="M0 60 L12 38 L22 48 L36 28 L60 50 L60 60 Z" fill="#1a2530"/>
                </svg>
            </div>
            <div className="doc-row-body">
                <strong className="doc-row-name">{filename}</strong>
                <div className="doc-row-stats">
                    <span className="doc-row-pill">✓ {format}</span>
                    <span className="doc-row-saved">−{savedPct}%</span>
                    <span className="doc-row-meta">{oldSize} → {newSize} · {sizes} sizes</span>
                </div>
                <div className="doc-row-links">
                    <span>Edit</span>
                    <span className="doc-row-divider">·</span>
                    <span>Copy URL to clipboard</span>
                </div>
            </div>
            <span className="doc-row-badge">{format}</span>
        </div>
    );
}

export function Kbd({ children }: { children: ReactNode }) {
    return <kbd className="doc-kbd">{children}</kbd>;
}

const docCss = `
.doc-page { max-width: 760px; min-width: 0; }
.doc-eyebrow { font-family: var(--font-geist-mono), monospace; font-size: 11px; letter-spacing: 0.04em; color: var(--ink-3); margin-bottom: 12px; }
.doc-h1 { font-family: var(--font-geist-sans), sans-serif; font-size: clamp(32px, 4.5vw, 44px); letter-spacing: -0.035em; font-weight: 600; line-height: 1.08; margin: 0 0 16px; color: var(--ink); }
.doc-lead { font-size: 17px; line-height: 1.55; color: var(--ink-2); letter-spacing: -0.01em; margin: 0 0 32px; max-width: 640px; }

.doc-section { margin-top: 48px; scroll-margin-top: 80px; }
.doc-h2 { font-family: var(--font-geist-sans), sans-serif; font-size: 24px; letter-spacing: -0.025em; font-weight: 600; color: var(--ink); margin: 0 0 16px; padding-bottom: 12px; border-bottom: 1px solid var(--line); scroll-margin-top: 80px; }
.doc-h3 { font-family: var(--font-geist-sans), sans-serif; font-size: 17px; letter-spacing: -0.015em; font-weight: 600; color: var(--ink); margin: 32px 0 8px; scroll-margin-top: 80px; }
.doc-p { font-size: 15px; line-height: 1.65; color: var(--ink-2); margin: 0 0 16px; }
.doc-p strong { color: var(--ink); font-weight: 600; }
.doc-code { font-family: var(--font-geist-mono), monospace; font-size: 13px; padding: 1px 6px; background: var(--bg-2); border: 1px solid var(--line); border-radius: 4px; color: var(--ink); }

.doc-pre { position: relative; margin: 16px 0 24px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg-2); overflow: hidden; }
.doc-pre-lang { position: absolute; top: 8px; right: 12px; font-family: var(--font-geist-mono), monospace; font-size: 10.5px; letter-spacing: 0.04em; color: var(--ink-3); text-transform: uppercase; }
.doc-pre pre { margin: 0; padding: 18px 20px; overflow-x: auto; font-family: var(--font-geist-mono), monospace; font-size: 13px; line-height: 1.6; color: var(--ink); }
.doc-pre code { white-space: pre; }

.doc-callout { margin: 20px 0; padding: 14px 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg-2); }
.doc-callout-info { border-left: 3px solid var(--ink); }
.doc-callout-warn { border-left: 3px solid var(--warn); }
.doc-callout-tip { border-left: 3px solid var(--success); }
.doc-callout-h { font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 4px; }
.doc-callout-body { font-size: 14px; color: var(--ink-2); line-height: 1.6; }
.doc-callout-body p:last-child { margin-bottom: 0; }

.doc-mock { margin: 20px 0 28px; border: 1px solid var(--line-2); border-radius: 10px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 12px 24px -16px rgba(0,0,0,0.18); background: #fff; color: #2c3338; }
[data-theme="dark"] .doc-mock { background: #1d2328; color: #e0e0e0; border-color: rgba(255,255,255,0.12); }
.doc-mock-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #f0f0f1; border-bottom: 1px solid #dcdcde; }
[data-theme="dark"] .doc-mock-bar { background: #14181c; border-bottom-color: rgba(255,255,255,0.08); }
.doc-mock-terminal .doc-mock-bar { background: #2a2e35; }
.doc-traffic { width: 10px; height: 10px; border-radius: 50%; }
.doc-traffic-r { background: #ff5f57; } .doc-traffic-y { background: #febc2e; } .doc-traffic-g { background: #28c840; }
.doc-mock-url, .doc-mock-title { flex: 1; text-align: center; font-family: var(--font-geist-mono), monospace; font-size: 11.5px; color: var(--ink-3); }
.doc-mock-title { color: rgba(255,255,255,0.6); }
.doc-mock-body { padding: 16px; }
.doc-mock-terminal .doc-mock-body { background: #1d2228; color: #d4d4d4; padding: 16px 18px; font-family: var(--font-geist-mono), monospace; font-size: 12.5px; line-height: 1.7; }
.doc-mock-terminal .doc-mock-body pre { margin: 0; white-space: pre-wrap; }

.doc-row { display: grid; grid-template-columns: 60px 1fr auto; gap: 14px; padding: 14px; background: #fff; border: 1px solid #dcdcde; border-radius: 4px; align-items: start; position: relative; }
[data-theme="dark"] .doc-row { background: #1d2328; border-color: rgba(255,255,255,0.12); }
.doc-row-thumb { width: 60px; height: 60px; border-radius: 4px; overflow: hidden; }
.doc-row-thumb svg { display: block; }
.doc-row-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.doc-row-name { color: #2c3338; font-weight: 600; font-size: 13px; }
[data-theme="dark"] .doc-row-name { color: #e0e0e0; }
.doc-row-stats { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; line-height: 1.4; flex-wrap: wrap; }
.doc-row-pill { display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 4px; background: #dcfce7; color: #166534; font-weight: 600; font-size: 11px; }
.doc-row-saved { color: #166534; font-weight: 600; }
.doc-row-meta { color: #555; }
[data-theme="dark"] .doc-row-meta { color: #aaa; }
.doc-row-links { display: flex; gap: 6px; align-items: center; font-size: 12px; color: #2271b1; }
[data-theme="dark"] .doc-row-links { color: #72aee6; }
.doc-row-divider { color: #aaa; }
.doc-row-badge { position: absolute; top: 6px; right: 6px; background: #2a57e6; color: #fff; font-family: var(--font-geist-sans), sans-serif; font-weight: 600; font-size: 10px; letter-spacing: 0.3px; padding: 3px 6px; border-radius: 3px; }

.doc-kbd { display: inline-flex; align-items: center; padding: 1px 6px; min-width: 22px; height: 22px; justify-content: center; border: 1px solid var(--line-2); border-bottom-width: 2px; border-radius: 4px; background: var(--bg-2); font-family: var(--font-geist-mono), monospace; font-size: 11px; color: var(--ink); margin: 0 2px; }

.doc-page ul, .doc-page ol { font-size: 15px; line-height: 1.65; color: var(--ink-2); padding-left: 24px; margin: 0 0 16px; }
.doc-page li { margin-bottom: 6px; }
.doc-page li code { font-size: 12.5px; }
.doc-page a { color: var(--ink); border-bottom: 1px solid var(--line-2); padding-bottom: 1px; transition: border-color .15s; }
.doc-page a:hover { border-bottom-color: var(--ink); }

.doc-grid { display: grid; gap: 14px; margin: 16px 0 24px; }
.doc-grid-2 { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.doc-card { padding: 16px 18px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
.doc-card-h { font-size: 14px; font-weight: 600; color: var(--ink); margin-bottom: 4px; }
.doc-card-p { font-size: 13px; color: var(--ink-2); line-height: 1.55; margin: 0; }
.doc-card-link { display: inline-block; margin-top: 8px; font-size: 13px; font-weight: 500; color: var(--ink); }
`;
