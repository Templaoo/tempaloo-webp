import Link from "next/link";
import type { Metadata } from "next";
import { LogoMark } from "@/components/Logo";

export const metadata: Metadata = {
    title: "Page not found — Tempaloo",
    robots: { index: false, follow: false },
};

export default function NotFound() {
    return (
        <main className="nf-root">
            <style dangerouslySetInnerHTML={{ __html: css }} />

            <header className="nf-nav">
                <Link href="/" className="nf-nav-logo" aria-label="Tempaloo home">
                    <LogoMark size={28} />
                </Link>
            </header>

            <section className="nf-body">
                <div className="nf-code" aria-hidden>404</div>
                <h1 className="nf-h1">This page wandered off.</h1>
                <p className="nf-p">
                    The link you followed might be outdated, or we&apos;ve moved things
                    around. Try one of these instead:
                </p>

                <div className="nf-grid">
                    <Link href="/webp" className="nf-card">
                        <div className="nf-card-h">Plugin</div>
                        <div className="nf-card-p">Tempaloo WebP — features, pricing, install.</div>
                    </Link>
                    <Link href="/docs" className="nf-card">
                        <div className="nf-card-h">Docs</div>
                        <div className="nf-card-p">Install guide, troubleshooting, hooks, CLI.</div>
                    </Link>
                    <Link href="/contact" className="nf-card">
                        <div className="nf-card-h">Contact</div>
                        <div className="nf-card-p">Get in touch — we read every message.</div>
                    </Link>
                </div>

                <p className="nf-back">
                    Or just <Link href="/">head home</Link>.
                </p>
            </section>
        </main>
    );
}

const css = `
.nf-root { min-height: 100vh; background: var(--bg); color: var(--ink); display: flex; flex-direction: column; font-family: var(--font-geist-sans), sans-serif; }
.nf-nav { padding: 20px clamp(16px, 3vw, 24px); }
.nf-nav-logo { display: inline-flex; color: var(--ink); }

.nf-body { flex: 1; max-width: 720px; margin: 0 auto; padding: clamp(48px, 10vh, 96px) clamp(16px, 3vw, 24px) 64px; text-align: center; }

.nf-code { font-family: var(--font-geist-mono), monospace; font-size: clamp(72px, 14vw, 140px); font-weight: 600; letter-spacing: -0.05em; color: var(--ink-3); line-height: 1; opacity: 0.4; margin-bottom: 16px; }
.nf-h1 { font-size: clamp(32px, 5vw, 48px); letter-spacing: -0.035em; font-weight: 600; line-height: 1.1; margin: 0 0 14px; color: var(--ink); }
.nf-p { font-size: 16px; line-height: 1.55; color: var(--ink-2); max-width: 520px; margin: 0 auto 36px; }

.nf-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; max-width: 600px; margin: 0 auto 32px; }
.nf-card { display: block; padding: 18px 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface, var(--bg)); text-align: left; transition: border-color .15s, transform .15s; text-decoration: none; }
.nf-card:hover { border-color: var(--ink-3); transform: translateY(-1px); }
.nf-card-h { font-size: 14px; font-weight: 600; color: var(--ink); margin-bottom: 4px; }
.nf-card-p { font-size: 12.5px; color: var(--ink-2); line-height: 1.5; margin: 0; }

.nf-back { font-size: 13px; color: var(--ink-3); margin: 0; }
.nf-back a { color: var(--ink); border-bottom: 1px solid var(--line-2); padding-bottom: 1px; transition: border-color .15s; }
.nf-back a:hover { border-bottom-color: var(--ink); }
`;
