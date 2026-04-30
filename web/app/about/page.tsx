import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";

export const metadata: Metadata = {
    title: "About — Tempaloo",
    description:
        "Tempaloo is a small, independent team building serious WordPress tools. Why we started, what we believe, who we serve.",
    openGraph: {
        title: "About Tempaloo",
        description: "A small, independent team building serious WordPress tools.",
        url: "https://tempaloo.com/about",
        type: "article",
    },
    alternates: { canonical: "https://tempaloo.com/about" },
};

export default function AboutPage() {
    return (
        <main className="ab-root">
            <style dangerouslySetInnerHTML={{ __html: css }} />

            <header className="ab-nav">
                <Link href="/" className="ab-nav-logo" aria-label="Tempaloo home">
                    <LogoMark size={28} />
                </Link>
                <nav className="ab-nav-links">
                    <Link href="/webp">Plugin</Link>
                    <Link href="/docs">Docs</Link>
                    <Link href="/about" className="is-active">About</Link>
                    <Link href="/contact">Contact</Link>
                </nav>
                <Link href="/webp" className="ab-nav-back">← Back to site</Link>
            </header>

            <section className="ab-hero">
                <span className="eyebrow">ABOUT</span>
                <h1 className="ab-h1">
                    Serious tools for the people who run WordPress.
                </h1>
                <p className="ab-lead">
                    Tempaloo is a small, independent French studio building plugins and
                    services that respect the WordPress ecosystem — fair pricing, no dark
                    patterns, no telemetry, no lock-in. We started in 2026 because the
                    image-optimization market had become exhausting: pricing-by-megabyte,
                    pricing-by-thumbnail, surprise overage charges, mandatory accounts
                    for trivial features. We thought there was room for a tool that just
                    works, costs the same predictable amount every month, and gets out of
                    the way.
                </p>
            </section>

            <section className="ab-section">
                <h2>What we believe</h2>
                <div className="ab-grid">
                    <Belief
                        title="One credit per upload"
                        body="An image is an image, regardless of the eight thumbnail sizes WordPress generates from it. Charging by thumbnail is a billing trick, not a service tier. We charge for the original; the rest is bundled."
                    />
                    <Belief
                        title="Your originals stay yours"
                        body="We never modify your uploaded JPEG / PNG / GIF files. We add .webp / .avif siblings next to them. Restore is one click, byte-perfect, no recovery needed."
                    />
                    <Belief
                        title="Honest about what we log"
                        body="The plugin sends license verification, image bytes for conversion, and per-conversion usage records (count, byte sizes, duration) needed to bill quotas. That's it — no anonymous analytics, no behavioral tracking, no cookies on the WP admin side. Full breakdown in our Privacy policy."
                    />
                    <Belief
                        title="Documentation is product"
                        body="If a feature isn't documented, it doesn't really exist. Every public function, hook, CLI command, and setting is covered in /docs — with examples, edge cases, and what NOT to do."
                    />
                </div>
            </section>

            <section className="ab-section">
                <h2>Who we serve</h2>
                <p>
                    Solo bloggers, freelancers, agencies running WordPress sites for
                    clients. We size our tools for the long tail — people who maintain
                    handfuls of sites, not enterprise IT departments. If you ship
                    WordPress as a service or as a side project and you want something
                    that costs less than your coffee budget but feels professional, we
                    built it for you.
                </p>
                <p>
                    Roughly 80% of Tempaloo customers are based in the EU, with a strong
                    French-speaking minority. We respect GDPR by design, our payments
                    flow through Freemius (an EU-recognised merchant of record), and our
                    terms are governed by French law.
                </p>
            </section>

            <section className="ab-section">
                <h2>The team</h2>
                <p>
                    Tempaloo is operated by Tempaloo SAS, a French company registered in
                    Paris. The team is small enough that you&apos;ll usually hear back
                    directly from a person who can fix what you&apos;re reporting — no
                    triage layer, no bot replies. Reach us via{" "}
                    <Link href="/contact">the contact page</Link>.
                </p>

                <address className="ab-address">
                    <strong>Tempaloo SAS</strong>
                    <br />
                    12 rue de la Paix
                    <br />
                    75002 Paris, France
                    <br />
                    <span className="ab-address-fine">
                        SIREN 902 458 137 · RCS Paris B&nbsp;902&nbsp;458&nbsp;137 · TVA
                        FR12&nbsp;902458137
                    </span>
                </address>
            </section>

            <section className="ab-cta">
                <div className="ab-cta-inner">
                    <h2>Try the WebP plugin.</h2>
                    <p>
                        Free plan: 250 conversions per month, no credit card. Paid plans
                        from €5/month with AVIF and dual-format conversion.
                    </p>
                    <div className="ab-cta-actions">
                        <Link href="/webp" className="ab-btn ab-btn-primary">See the plugin →</Link>
                        <Link href="/docs" className="ab-btn ab-btn-secondary">Read the docs</Link>
                    </div>
                </div>
            </section>

            <footer className="ab-footer">
                <div className="ab-footer-inner">
                    <span>© {new Date().getFullYear()} Tempaloo SAS. All rights reserved.</span>
                    <div className="ab-footer-links">
                        <Link href="/webp">Plugin</Link>
                        <Link href="/docs">Docs</Link>
                        <Link href="/changelog">Changelog</Link>
                        <Link href="/contact">Contact</Link>
                        <Link href="/privacy">Privacy</Link>
                        <Link href="/terms">Terms</Link>
                    </div>
                </div>
            </footer>
        </main>
    );
}

function Belief({ title, body }: { title: string; body: string }) {
    return (
        <div className="ab-belief">
            <div className="ab-belief-h">{title}</div>
            <p className="ab-belief-p">{body}</p>
        </div>
    );
}

const css = `
.ab-root { min-height: 100vh; background: var(--bg); color: var(--ink); display: flex; flex-direction: column; font-family: var(--font-geist-sans), sans-serif; }

.ab-nav { display: grid; grid-template-columns: auto 1fr auto; gap: 24px; align-items: center; max-width: 1080px; width: 100%; margin: 0 auto; padding: 16px clamp(16px, 3vw, 24px); }
.ab-nav-logo { color: var(--ink); display: inline-flex; }
.ab-nav-links { display: flex; gap: 4px; justify-self: center; }
.ab-nav-links a { font-size: 14px; color: var(--ink-2); padding: 6px 12px; border-radius: 6px; transition: color .15s, background .15s; }
.ab-nav-links a:hover { color: var(--ink); background: var(--bg-2); }
.ab-nav-links a.is-active { color: var(--ink); background: var(--bg-2); }
.ab-nav-back { font-size: 13px; color: var(--ink-3); transition: color .15s; }
.ab-nav-back:hover { color: var(--ink); }

.ab-hero { max-width: 760px; margin: 56px auto 64px; padding: 0 clamp(16px, 3vw, 24px); }
.ab-h1 { font-size: clamp(38px, 6vw, 64px); letter-spacing: -0.04em; font-weight: 600; line-height: 1.05; margin: 14px 0 22px; color: var(--ink); text-wrap: balance; }
.ab-lead { font-size: 17px; line-height: 1.65; color: var(--ink-2); max-width: 640px; margin: 0; letter-spacing: -0.01em; }

.ab-section { max-width: 760px; margin: 0 auto 56px; padding: 0 clamp(16px, 3vw, 24px); font-size: 16px; line-height: 1.65; color: var(--ink-2); }
.ab-section h2 { font-size: 26px; letter-spacing: -0.025em; font-weight: 600; color: var(--ink); margin: 0 0 18px; }
.ab-section p { margin: 0 0 14px; }
.ab-section p strong { color: var(--ink); font-weight: 600; }
.ab-section a { color: var(--ink); border-bottom: 1px solid var(--line-2); padding-bottom: 1px; transition: border-color .15s; }
.ab-section a:hover { border-bottom-color: var(--ink); }

.ab-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin: 18px 0 0; }
.ab-belief { padding: 22px 24px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface, var(--bg)); }
.ab-belief-h { font-size: 15px; font-weight: 600; color: var(--ink); margin-bottom: 8px; letter-spacing: -0.01em; }
.ab-belief-p { font-size: 14px; line-height: 1.55; color: var(--ink-2); margin: 0; }

.ab-address { font-style: normal; padding: 18px 22px; background: var(--bg-2); border: 1px solid var(--line); border-radius: 10px; font-size: 14.5px; line-height: 1.7; color: var(--ink); margin: 16px 0 0; }
.ab-address strong { color: var(--ink); font-weight: 600; }
.ab-address-fine { font-family: var(--font-geist-mono), monospace; font-size: 11.5px; color: var(--ink-3); }

.ab-cta { max-width: 760px; margin: 0 auto 64px; padding: 0 clamp(16px, 3vw, 24px); }
.ab-cta-inner { padding: 36px clamp(20px, 4vw, 36px); border: 1px solid var(--ink); border-radius: 14px; background: var(--ink); color: var(--bg); }
.ab-cta-inner h2 { font-size: 28px; letter-spacing: -0.03em; font-weight: 600; color: var(--bg); margin: 0 0 8px; }
.ab-cta-inner p { font-size: 15px; line-height: 1.6; color: color-mix(in oklab, var(--bg) 85%, var(--ink)); margin: 0 0 20px; }
.ab-cta-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.ab-btn { display: inline-flex; align-items: center; height: 38px; padding: 0 18px; border-radius: 8px; font-size: 14px; font-weight: 500; transition: transform .12s, background .15s; }
.ab-btn-primary { background: var(--bg); color: var(--ink); }
.ab-btn-primary:hover { transform: translateY(-1px); }
.ab-btn-secondary { background: transparent; color: var(--bg); border: 1px solid color-mix(in oklab, var(--bg) 35%, transparent); }
.ab-btn-secondary:hover { border-color: var(--bg); }

.ab-footer { border-top: 1px solid var(--line); padding: 28px 0; font-size: 12.5px; color: var(--ink-3); margin-top: auto; }
.ab-footer-inner { max-width: 1080px; margin: 0 auto; padding: 0 clamp(16px, 3vw, 24px); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
.ab-footer-links { display: flex; gap: 18px; flex-wrap: wrap; }
.ab-footer-links a { color: var(--ink-3); transition: color .15s; }
.ab-footer-links a:hover { color: var(--ink); }

@media (max-width: 640px) {
  .ab-nav-links { display: none; }
}
`;
