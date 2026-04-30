"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { LogoMark } from "@/components/Logo";

/**
 * Shared chrome for /contact. Mirrors the LegalPage / DocsShell visual
 * language so the page sits cohesively with the rest of the site —
 * Geist + Instrument Serif typography, sticky blurred nav, two-column
 * body (form + info card), constrained reading width.
 */
export function ContactShell({ children }: { children: ReactNode }) {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <div className="contact-root">
            <style dangerouslySetInnerHTML={{ __html: css }} />

            <header className={`contact-nav ${scrolled ? "is-on" : ""}`}>
                <div className="contact-nav-inner">
                    <Link href="/" className="contact-nav-logo" aria-label="Tempaloo home">
                        <LogoMark size={28} />
                    </Link>
                    <nav className="contact-nav-links">
                        <Link href="/webp">Plugin</Link>
                        <Link href="/docs">Docs</Link>
                        <Link href="/contact" className="is-active">Contact</Link>
                    </nav>
                    <Link href="/webp" className="contact-nav-back">← Back to site</Link>
                </div>
            </header>

            <main className="contact-main">
                <section className="contact-hero">
                    <span className="eyebrow">CONTACT</span>
                    <h1 className="contact-h1">Let&apos;s talk.</h1>
                    <p className="contact-lead">
                        Pre-sales questions, support tickets, partnerships, press requests —
                        every message lands in the same inbox and we read it. Typical reply
                        time is under 24 hours, business days.
                    </p>
                </section>

                <section className="contact-grid">
                    <div className="contact-form-col">{children}</div>

                    <aside className="contact-info">
                        <div className="contact-card">
                            <div className="contact-card-h">Direct email</div>
                            <p className="contact-card-p">
                                Prefer your own email client?{" "}
                                <a href="mailto:contact@tempaloo.com">contact@tempaloo.com</a>
                            </p>
                        </div>

                        <div className="contact-card">
                            <div className="contact-card-h">Office</div>
                            <address className="contact-address">
                                Tempaloo SAS
                                <br />
                                12 rue de la Paix
                                <br />
                                75002 Paris, France
                            </address>
                            <p className="contact-fineprint">
                                SIREN 902 458 137 · RCS Paris B&nbsp;902&nbsp;458&nbsp;137 · TVA FR12&nbsp;902458137
                            </p>
                        </div>

                        <div className="contact-card">
                            <div className="contact-card-h">Looking for help?</div>
                            <p className="contact-card-p">
                                Most questions are answered in our{" "}
                                <Link href="/docs">documentation</Link> — installation,
                                troubleshooting, hooks, CLI commands.
                            </p>
                            <p className="contact-card-p" style={{ marginTop: 8 }}>
                                Active customers can also open a ticket from inside the
                                plugin&apos;s Diagnostic tab — it includes a system snapshot
                                that helps us debug 10× faster.
                            </p>
                        </div>

                        <div className="contact-card contact-card-quiet">
                            <div className="contact-card-h">Response time</div>
                            <p className="contact-card-p">
                                Mon–Fri, 9:00–18:00 CET. We don&apos;t do bots or canned
                                responses — every reply is hand-written by someone on the
                                team.
                            </p>
                        </div>
                    </aside>
                </section>
            </main>

            <footer className="contact-footer">
                <div className="contact-footer-inner">
                    <span>© {new Date().getFullYear()} Tempaloo SAS. All rights reserved.</span>
                    <div className="contact-footer-links">
                        <Link href="/webp">Plugin</Link>
                        <Link href="/docs">Docs</Link>
                        <Link href="/privacy">Privacy</Link>
                        <Link href="/terms">Terms</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}

const css = `
.contact-root { min-height: 100vh; background: var(--bg); color: var(--ink); font-family: var(--font-geist-sans), sans-serif; }

/* ── Nav ────────────────────────────────────────────────────── */
.contact-nav { position: sticky; top: 0; z-index: 40; background: transparent; border-bottom: 1px solid transparent; transition: background .2s, border-color .2s; }
.contact-nav.is-on { background: color-mix(in oklab, var(--bg) 80%, transparent); backdrop-filter: blur(16px) saturate(180%); -webkit-backdrop-filter: blur(16px) saturate(180%); border-bottom-color: var(--line); }
.contact-nav-inner { max-width: 1200px; margin: 0 auto; padding: 0 clamp(16px, 3vw, 24px); height: 60px; display: grid; grid-template-columns: auto 1fr auto; gap: 24px; align-items: center; }
.contact-nav-logo { display: inline-flex; color: var(--ink); }
.contact-nav-links { display: flex; gap: 4px; justify-self: center; }
.contact-nav-links a { font-size: 14px; color: var(--ink-2); padding: 6px 12px; font-weight: 450; border-radius: 6px; transition: color .15s, background .15s; }
.contact-nav-links a:hover { color: var(--ink); background: var(--bg-2); }
.contact-nav-links a.is-active { color: var(--ink); background: var(--bg-2); }
.contact-nav-back { font-size: 13px; color: var(--ink-3); transition: color .15s; }
.contact-nav-back:hover { color: var(--ink); }

/* ── Hero ───────────────────────────────────────────────────── */
.contact-main { max-width: 1080px; margin: 0 auto; padding: 56px clamp(16px, 3vw, 24px) 96px; }
.contact-hero { max-width: 720px; margin-bottom: 56px; }
.contact-hero .eyebrow { font-family: var(--font-geist-mono), monospace; font-size: 11px; letter-spacing: 0.04em; color: var(--ink-3); }
.contact-h1 { font-size: clamp(40px, 6vw, 64px); letter-spacing: -0.04em; font-weight: 600; line-height: 1.05; margin: 14px 0 18px; color: var(--ink); text-wrap: balance; }
.contact-h1::after { content: "."; color: var(--brand, #2a57e6); }
.contact-lead { font-size: 17px; line-height: 1.6; color: var(--ink-2); letter-spacing: -0.01em; margin: 0; max-width: 560px; }

/* ── Grid: form + info ──────────────────────────────────────── */
.contact-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 56px; align-items: start; }

.contact-info { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 84px; }
.contact-card { padding: 18px 20px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface, var(--bg)); }
.contact-card-quiet { background: var(--bg-2); border-color: var(--line); }
.contact-card-h { font-size: 12px; font-weight: 600; color: var(--ink); margin-bottom: 8px; letter-spacing: -0.005em; text-transform: uppercase; font-family: var(--font-geist-mono), monospace; letter-spacing: 0.04em; }
.contact-card-p { font-size: 14px; line-height: 1.55; color: var(--ink-2); margin: 0; }
.contact-card-p a { color: var(--ink); border-bottom: 1px solid var(--line-2); padding-bottom: 1px; transition: border-color .15s; }
.contact-card-p a:hover { border-bottom-color: var(--ink); }
.contact-address { font-style: normal; font-size: 14px; line-height: 1.55; color: var(--ink); }
.contact-fineprint { margin: 10px 0 0; font-size: 11.5px; line-height: 1.5; color: var(--ink-3); font-family: var(--font-geist-mono), monospace; }
.contact-fineprint em { font-style: italic; color: var(--ink-3); }

/* ── Footer ─────────────────────────────────────────────────── */
.contact-footer { border-top: 1px solid var(--line); padding: 28px 0; font-size: 12.5px; color: var(--ink-3); margin-top: 80px; }
.contact-footer-inner { max-width: 1080px; margin: 0 auto; padding: 0 clamp(16px, 3vw, 24px); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
.contact-footer-links { display: flex; gap: 18px; }
.contact-footer-links a { color: var(--ink-3); transition: color .15s; }
.contact-footer-links a:hover { color: var(--ink); }

@media (max-width: 880px) {
  .contact-grid { grid-template-columns: 1fr; gap: 32px; }
  .contact-info { position: static; }
  .contact-nav-links { display: none; }
  .contact-nav-inner { grid-template-columns: auto 1fr auto; }
}
`;
