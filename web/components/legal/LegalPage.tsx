"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { LogoMark } from "@/components/Logo";

/**
 * Shared chrome for /terms and /privacy. Matches the landing design
 * (Geist + Instrument Serif) but optimised for long reading — narrower
 * column, larger line-height, subdued secondary links.
 */
export function LegalPage({
    title,
    effectiveDate,
    children,
}: {
    title: string;
    effectiveDate: string;
    children: ReactNode;
}) {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <div className="lp-root">
            <style dangerouslySetInnerHTML={{ __html: css }} />

            <header className={`lp-nav ${scrolled ? "lp-nav-on" : ""}`}>
                <div className="app-container lp-nav-inner">
                    <Link href="/webp" className="lp-nav-logo" aria-label="Back to Tempaloo home">
                        <LogoMark size={32} />
                    </Link>
                    <nav className="lp-nav-right">
                        <Link href="/docs" className="lp-nav-link">Docs</Link>
                        <Link href="/contact" className="lp-nav-link">Contact</Link>
                        <Link href="/privacy" className="lp-nav-link">Privacy</Link>
                        <Link href="/terms" className="lp-nav-link">Terms</Link>
                        <Link href="/webp" className="lp-nav-back">← Back to site</Link>
                    </nav>
                </div>
            </header>

            <article className="lp-article">
                <header className="lp-header">
                    <span className="eyebrow">LEGAL</span>
                    <h1 className="lp-h1">{title}</h1>
                    <p className="lp-effective">Effective date: <time>{effectiveDate}</time></p>
                </header>
                <div className="lp-body">{children}</div>
            </article>

            <footer className="lp-footer">
                <div className="app-container lp-footer-inner">
                    <span>© {new Date().getFullYear()} Tempaloo SAS · 12 rue de la Paix, 75002 Paris</span>
                    <div className="lp-footer-links">
                        <Link href="/webp">Home</Link>
                        <Link href="/docs">Docs</Link>
                        <Link href="/contact">Contact</Link>
                        <Link href="/privacy">Privacy</Link>
                        <Link href="/terms">Terms</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}

const css = `
.lp-root { min-height: 100vh; background: var(--bg); color: var(--ink); }

.lp-nav {
  position: sticky; top: 0; z-index: 40;
  background: transparent; border-bottom: 1px solid transparent;
  transition: background .2s, border-color .2s;
}
.lp-nav-on {
  background: color-mix(in oklab, var(--bg) 80%, transparent);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border-bottom-color: var(--line);
}
.lp-nav-inner {
  display: flex; align-items: center; justify-content: space-between;
  height: 60px;
}
.lp-nav-logo {
  display: inline-flex; align-items: center; gap: 10px;
  font-weight: 500; font-size: 14.5px;
  letter-spacing: -0.015em; color: var(--ink);
}
.lp-nav-right { display: flex; align-items: center; gap: 20px; }
.lp-nav-link {
  font-size: 13.5px; color: var(--ink-2); transition: color .15s;
}
.lp-nav-link:hover { color: var(--ink); }
.lp-nav-back {
  font-size: 13px; color: var(--ink-3); transition: color .15s;
}
.lp-nav-back:hover { color: var(--ink); }

.lp-article {
  max-width: 760px;
  margin: 0 auto;
  padding: 64px clamp(16px, 3vw, 24px) 96px;
}

.lp-header { margin-bottom: 40px; padding-bottom: 28px; border-bottom: 1px solid var(--line); }
.lp-h1 {
  font-family: var(--font-geist-sans), sans-serif;
  font-size: clamp(28px, 5vw, 52px);
  letter-spacing: -0.035em;
  font-weight: 600;
  line-height: 1.08;
  margin: 12px 0 10px;
  color: var(--ink);
  text-wrap: balance;
}
.lp-effective { margin: 0; font-size: 13px; color: var(--ink-3); }
.lp-effective time { color: var(--ink-2); font-variant-numeric: tabular-nums; }

.lp-body {
  font-size: 15.5px; line-height: 1.75; color: var(--ink-2);
}
.lp-body h2 {
  font-family: var(--font-geist-sans), sans-serif;
  font-size: 22px; font-weight: 600; letter-spacing: -0.025em;
  color: var(--ink); margin: 48px 0 12px; scroll-margin-top: 80px;
}
.lp-body h3 {
  font-family: var(--font-geist-sans), sans-serif;
  font-size: 16.5px; font-weight: 600; letter-spacing: -0.015em;
  color: var(--ink); margin: 28px 0 8px;
}
.lp-body p { margin: 0 0 16px; }
.lp-body ul, .lp-body ol { margin: 0 0 18px; padding-left: 22px; }
.lp-body li { margin-bottom: 8px; }
.lp-body li::marker { color: var(--ink-3); }
.lp-body strong { color: var(--ink); font-weight: 600; }
.lp-body a { color: var(--ink); text-decoration: underline; text-underline-offset: 2px; }
.lp-body a:hover { text-decoration-thickness: 2px; }
.lp-body code {
  font-family: var(--font-geist-mono), ui-monospace, monospace;
  font-size: 13px;
  padding: 1px 5px; border-radius: 4px;
  background: var(--bg-2); color: var(--ink);
  border: 1px solid var(--line);
}

.lp-body table {
  width: 100%; border-collapse: collapse;
  margin: 16px 0 24px;
  font-size: 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
}
.lp-body th,
.lp-body td {
  padding: 10px 14px;
  text-align: left;
  border-bottom: 1px solid var(--line);
  vertical-align: top;
}
.lp-body th {
  background: var(--bg-2);
  font-weight: 500; color: var(--ink);
  font-size: 13px; letter-spacing: -0.005em;
}
.lp-body tr:last-child td { border-bottom: none; }

.lp-callout {
  margin: 24px 0;
  padding: 16px 18px;
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-left: 3px solid var(--ink);
  border-radius: 8px;
  font-size: 14.5px;
  color: var(--ink-2);
}
.lp-callout p:last-child { margin-bottom: 0; }

.lp-footer {
  border-top: 1px solid var(--line);
  padding: 32px 0;
  font-size: 12.5px; color: var(--ink-3);
}
.lp-footer-inner {
  display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 16px;
}
.lp-footer-links { display: flex; gap: 18px; }
.lp-footer-links a { color: var(--ink-3); transition: color .15s; }
.lp-footer-links a:hover { color: var(--ink); }
`;
