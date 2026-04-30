import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";

export const metadata: Metadata = {
    title: "Changelog — Tempaloo",
    description:
        "Public release notes for the Tempaloo WebP plugin and related services. Latest features, fixes, and improvements.",
    openGraph: {
        title: "Tempaloo Changelog",
        description: "Latest releases, features, and fixes.",
        url: "https://tempaloo.com/changelog",
        type: "article",
    },
    alternates: { canonical: "https://tempaloo.com/changelog" },
};

interface Release {
    version: string;
    date: string;
    tag?: "major" | "minor" | "patch";
    headline: string;
    items: { kind: "new" | "fixed" | "changed" | "internal"; text: string }[];
}

/**
 * Release timeline. Add to the TOP of the array on every public ship
 * — order is preserved as written. Keep it focused on user-visible
 * change; internal refactors only land here if they materially affect
 * customer outcomes (perf, reliability, security).
 */
const RELEASES: Release[] = [
    {
        version: "1.0.0",
        date: "2026-04-30",
        tag: "major",
        headline: "Initial public release.",
        items: [
            { kind: "new", text: "WebP and AVIF conversion for the WordPress original + every generated size." },
            { kind: "new", text: "Async upload pipeline — uploads finish instantly, conversion runs in a fresh PHP process via non-blocking loopback." },
            { kind: "new", text: "Bulk converter with adaptive backoff, pause/resume, live progress (current image + savings counter + ETA)." },
            { kind: "new", text: "Pro Media Library column — per-row format badge, savings breakdown, expandable detail, inline restore confirmation." },
            { kind: "new", text: "Bulk row-actions: \"Optimize selected\" and \"Restore originals\" via the standard WordPress dropdown." },
            { kind: "new", text: "Picture-tag and URL-rewrite delivery modes. CDN passthrough mode for sites running Cloudflare Polish, BunnyCDN Optimizer, etc." },
            { kind: "new", text: "Diagnostic tab — state audit, reconcile, per-attachment forensic inspect, filesystem self-test." },
            { kind: "new", text: "Developer hooks (tempaloo_webp_skip_attachment, tempaloo_webp_quality_for, tempaloo_webp_after_convert) and 6 WP-CLI commands." },
            { kind: "new", text: "Compatibility hardening: atomic temp+rename writes, page-cache opt-out for LiteSpeed / WP Rocket / W3TC." },
        ],
    },
];

const KIND_LABEL: Record<Release["items"][number]["kind"], string> = {
    new: "New",
    fixed: "Fixed",
    changed: "Changed",
    internal: "Internal",
};
const KIND_COLOR: Record<Release["items"][number]["kind"], string> = {
    new: "#15803d",
    fixed: "#2563eb",
    changed: "#b45309",
    internal: "#6b7280",
};

export default function ChangelogPage() {
    return (
        <main className="cl-root">
            <style dangerouslySetInnerHTML={{ __html: css }} />

            <header className="cl-nav">
                <Link href="/" className="cl-nav-logo" aria-label="Tempaloo home">
                    <LogoMark size={28} />
                </Link>
                <nav className="cl-nav-links">
                    <Link href="/webp">Plugin</Link>
                    <Link href="/docs">Docs</Link>
                    <Link href="/changelog" className="is-active">Changelog</Link>
                    <Link href="/contact">Contact</Link>
                </nav>
                <Link href="/webp" className="cl-nav-back">← Back to site</Link>
            </header>

            <article className="cl-article">
                <header className="cl-header">
                    <span className="eyebrow">CHANGELOG</span>
                    <h1 className="cl-h1">What&apos;s new in Tempaloo.</h1>
                    <p className="cl-lead">
                        Public release notes for the WordPress plugin and the API behind it.
                        We don&apos;t ship silent changes — every user-visible delta lands here
                        with the version it shipped in.
                    </p>
                    <p className="cl-rss">
                        Want the digest? <Link href="/contact">Drop us a line</Link> — we send a release-notes digest at most monthly, no spam.
                    </p>
                </header>

                <ol className="cl-list">
                    {RELEASES.map((r) => (
                        <li key={r.version} className="cl-release">
                            <div className="cl-release-meta">
                                <span className="cl-version">v{r.version}</span>
                                {r.tag && <span className={`cl-tag cl-tag-${r.tag}`}>{r.tag}</span>}
                                <time className="cl-date" dateTime={r.date}>
                                    {new Date(r.date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                                </time>
                            </div>
                            <h2 className="cl-h2">{r.headline}</h2>
                            <ul className="cl-items">
                                {r.items.map((it, i) => (
                                    <li key={i}>
                                        <span className="cl-kind" style={{ color: KIND_COLOR[it.kind] }}>{KIND_LABEL[it.kind]}</span>
                                        <span className="cl-text">{it.text}</span>
                                    </li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ol>

                <footer className="cl-foot">
                    <p>
                        Looking for an older release? Browse the{" "}
                        <a href="https://wordpress.org/plugins/tempaloo-webp/#developers" target="_blank" rel="noopener noreferrer">
                            full version history on WordPress.org
                        </a>{" "}
                        — every release ever shipped is archived there with its readme.txt
                        changelog block intact.
                    </p>
                </footer>
            </article>

            <footer className="cl-footer">
                <div className="cl-footer-inner">
                    <span>© {new Date().getFullYear()} Tempaloo SAS. All rights reserved.</span>
                    <div className="cl-footer-links">
                        <Link href="/webp">Plugin</Link>
                        <Link href="/docs">Docs</Link>
                        <Link href="/contact">Contact</Link>
                        <Link href="/privacy">Privacy</Link>
                        <Link href="/terms">Terms</Link>
                    </div>
                </div>
            </footer>
        </main>
    );
}

const css = `
.cl-root { min-height: 100vh; background: var(--bg); color: var(--ink); display: flex; flex-direction: column; font-family: var(--font-geist-sans), sans-serif; }

.cl-nav { display: grid; grid-template-columns: auto 1fr auto; gap: 24px; align-items: center; max-width: 1080px; width: 100%; margin: 0 auto; padding: 16px clamp(16px, 3vw, 24px); }
.cl-nav-logo { color: var(--ink); display: inline-flex; }
.cl-nav-links { display: flex; gap: 4px; justify-self: center; }
.cl-nav-links a { font-size: 14px; color: var(--ink-2); padding: 6px 12px; border-radius: 6px; transition: color .15s, background .15s; }
.cl-nav-links a:hover { color: var(--ink); background: var(--bg-2); }
.cl-nav-links a.is-active { color: var(--ink); background: var(--bg-2); }
.cl-nav-back { font-size: 13px; color: var(--ink-3); transition: color .15s; }
.cl-nav-back:hover { color: var(--ink); }

.cl-article { max-width: 760px; width: 100%; margin: 0 auto; padding: 48px clamp(16px, 3vw, 24px) 64px; }

.cl-header { margin-bottom: 56px; padding-bottom: 28px; border-bottom: 1px solid var(--line); }
.cl-h1 { font-size: clamp(36px, 5vw, 56px); letter-spacing: -0.04em; font-weight: 600; line-height: 1.05; margin: 14px 0 14px; color: var(--ink); text-wrap: balance; }
.cl-lead { font-size: 16px; line-height: 1.6; color: var(--ink-2); max-width: 580px; margin: 0 0 16px; }
.cl-rss { font-size: 13px; color: var(--ink-3); margin: 0; }
.cl-rss a { color: var(--ink); border-bottom: 1px solid var(--line-2); padding-bottom: 1px; transition: border-color .15s; }
.cl-rss a:hover { border-bottom-color: var(--ink); }

.cl-list { list-style: none; padding: 0; margin: 0; }
.cl-release { padding: 32px 0; border-bottom: 1px solid var(--line); }
.cl-release:first-child { padding-top: 0; }
.cl-release:last-child { border-bottom: none; }

.cl-release-meta { display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--ink-3); margin-bottom: 8px; flex-wrap: wrap; }
.cl-version { font-family: var(--font-geist-mono), monospace; font-size: 13px; font-weight: 600; color: var(--ink); }
.cl-tag { font-family: var(--font-geist-mono), monospace; font-size: 10px; padding: 2px 7px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
.cl-tag-major { background: rgba(220, 38, 38, 0.1); color: #b91c1c; }
.cl-tag-minor { background: rgba(37, 99, 235, 0.1); color: #1e40af; }
.cl-tag-patch { background: rgba(107, 114, 128, 0.1); color: #4b5563; }
.cl-date { font-variant-numeric: tabular-nums; color: var(--ink-3); }

.cl-h2 { font-size: 22px; letter-spacing: -0.025em; font-weight: 600; line-height: 1.3; color: var(--ink); margin: 0 0 16px; }
.cl-items { list-style: none; padding: 0; margin: 0; }
.cl-items li { display: grid; grid-template-columns: 70px 1fr; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--line); align-items: baseline; }
.cl-items li:last-child { border-bottom: none; }
.cl-kind { font-size: 10.5px; font-family: var(--font-geist-mono), monospace; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
.cl-text { font-size: 14.5px; line-height: 1.55; color: var(--ink-2); }

.cl-foot { margin-top: 48px; padding: 18px 22px; background: var(--bg-2); border: 1px solid var(--line); border-radius: 12px; font-size: 14px; line-height: 1.55; color: var(--ink-2); }
.cl-foot a { color: var(--ink); border-bottom: 1px solid var(--line-2); padding-bottom: 1px; }
.cl-foot a:hover { border-bottom-color: var(--ink); }

.cl-footer { border-top: 1px solid var(--line); padding: 28px 0; font-size: 12.5px; color: var(--ink-3); margin-top: auto; }
.cl-footer-inner { max-width: 1080px; margin: 0 auto; padding: 0 clamp(16px, 3vw, 24px); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
.cl-footer-links { display: flex; gap: 18px; }
.cl-footer-links a { color: var(--ink-3); transition: color .15s; }
.cl-footer-links a:hover { color: var(--ink); }

@media (max-width: 640px) {
  .cl-nav-links { display: none; }
  .cl-items li { grid-template-columns: 60px 1fr; gap: 10px; }
}
`;
