"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import {
    type Competitor,
    competitorCostFor,
    tempalooPlanFor,
    TEMPALOO,
} from "@/lib/competitors";

/**
 * Comparative landing page: /webp/vs-{competitor}.
 *
 * Shared by the 3 routes — only the `competitor` prop changes. The page
 * renders 5 sections:
 *   1. Hero — headline + animated credit-burn demo
 *   2. The thumbnail trap — explains the counting model difference
 *   3. Calculator — interactive cost projection across providers
 *   4. Feature matrix — side-by-side parity check
 *   5. Switch CTA
 *
 * All animations are CSS keyframes (GPU-accelerated) + a small rAF tween
 * for the calculator number transitions. No animation library.
 */
export function VsPage({ competitor }: { competitor: Competitor }) {
    return (
        <div className="vs-root" data-comp={competitor.slug}>
            <style dangerouslySetInnerHTML={{ __html: css(competitor.accent) }} />
            <Nav competitor={competitor} />
            <Hero competitor={competitor} />
            <ThumbnailTrap competitor={competitor} />
            <Calculator competitor={competitor} />
            <Matrix competitor={competitor} />
            <SwitchCta competitor={competitor} />
            <Footer competitor={competitor} />
        </div>
    );
}

/* ── Nav ────────────────────────────────────────────────────────────── */
function Nav({ competitor }: { competitor: Competitor }) {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);
    return (
        <nav className={`vs-nav ${scrolled ? "vs-nav-scrolled" : ""}`}>
            <div className="vs-container vs-nav-inner">
                <Link href="/webp" className="vs-nav-logo" aria-label="Tempaloo home">
                    <LogoMark size={28} />
                </Link>
                <div className="vs-nav-mid">
                    Tempaloo <span className="vs-nav-vs">vs</span> {competitor.name}
                </div>
                <Link href={`/webp/activate?plan=free&utm_source=vs_${competitor.slug}`} className="vs-btn vs-btn-primary vs-btn-sm">
                    Switch — free 250/mo
                </Link>
            </div>
        </nav>
    );
}

/* ── Hero ───────────────────────────────────────────────────────────── */
function Hero({ competitor }: { competitor: Competitor }) {
    return (
        <section className="vs-hero">
            <div className="vs-container vs-hero-inner">
                <span className="vs-pill vs-reveal">
                    <span className="vs-pill-dot" />
                    {competitor.name} alternative · 1 upload = 1 credit
                </span>
                <h1 className="vs-h-display vs-hero-h1 vs-reveal vs-reveal-d1">
                    Switch from <span className="vs-hero-comp">{competitor.name}</span>.
                    <br />
                    <span className="vs-font-serif vs-hero-accent">Stop paying per thumbnail.</span>
                </h1>
                <p className="vs-hero-lead vs-reveal vs-reveal-d2">
                    {competitor.name} counts every WordPress thumbnail as a separate credit.
                    A single upload burns <strong>{competitor.avgThumbnailsPerUpload} credits</strong>.
                    Tempaloo counts the upload itself — <strong>1 credit per photo, all sizes bundled</strong>.
                    The math is brutal.
                </p>
                <div className="vs-hero-ctas vs-reveal vs-reveal-d3">
                    <Link href={`/webp/activate?plan=free&utm_source=vs_${competitor.slug}`} className="vs-btn vs-btn-primary">
                        Get my free key — 250 imgs / month
                    </Link>
                    <a href="#calculator" className="vs-btn vs-btn-ghost">
                        See the savings →
                    </a>
                </div>
                <ul className="vs-trust-chips vs-reveal vs-reveal-d4">
                    <li><Check /> 30-day money back</li>
                    <li><Check /> No credit card on Free</li>
                    <li><Check /> Cancel anytime</li>
                </ul>

                <CreditBurnDemo competitor={competitor} />
            </div>
        </section>
    );
}

/* ── Credit-burn animation — the core visual ────────────────────────── */
function CreditBurnDemo({ competitor }: { competitor: Competitor }) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        if (!ref.current) return;
        const io = new IntersectionObserver(([e]) => e?.isIntersecting && setVisible(true), { threshold: 0.3 });
        io.observe(ref.current);
        return () => io.disconnect();
    }, []);

    const thumbs = Array.from({ length: competitor.avgThumbnailsPerUpload }, (_, i) => i);

    return (
        <div ref={ref} className={`vs-burn ${visible ? "vs-burn-on" : ""}`}>
            {/* Tempaloo side */}
            <div className="vs-burn-col vs-burn-us">
                <div className="vs-burn-h">
                    <span className="vs-burn-brand">Tempaloo</span>
                    <span className="vs-burn-tally">
                        <span className="vs-burn-tally-num">1</span>
                        <span className="vs-burn-tally-lbl">credit</span>
                    </span>
                </div>
                <div className="vs-burn-stage">
                    <div className="vs-burn-photo vs-burn-photo-anim">
                        <PhotoSvg />
                        <span className="vs-burn-fname">sunset.jpg</span>
                    </div>
                    <div className="vs-burn-arrow">↓</div>
                    <div className="vs-burn-bundle">
                        <span className="vs-burn-pill vs-burn-pill-good">
                            ✓ 1 credit · all 7 sizes bundled
                        </span>
                    </div>
                </div>
            </div>

            {/* Competitor side */}
            <div className="vs-burn-col vs-burn-them">
                <div className="vs-burn-h">
                    <span className="vs-burn-brand">{competitor.name}</span>
                    <span className="vs-burn-tally vs-burn-tally-bad">
                        <span className="vs-burn-tally-num" data-final={competitor.avgThumbnailsPerUpload}>
                            {competitor.avgThumbnailsPerUpload}
                        </span>
                        <span className="vs-burn-tally-lbl">credits</span>
                    </span>
                </div>
                <div className="vs-burn-stage">
                    <div className="vs-burn-photo vs-burn-photo-anim">
                        <PhotoSvg />
                        <span className="vs-burn-fname">sunset.jpg</span>
                    </div>
                    <div className="vs-burn-arrow">↓ WP generates {competitor.avgThumbnailsPerUpload} thumbnails ↓</div>
                    <div className="vs-burn-thumbs">
                        {thumbs.map((i) => (
                            <div key={i} className="vs-burn-thumb" style={{ animationDelay: `${0.3 + i * 0.18}s` }}>
                                <PhotoSvg small />
                                <span className="vs-burn-credit-pop" style={{ animationDelay: `${0.5 + i * 0.18}s` }}>
                                    +1
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Thumbnail trap ─────────────────────────────────────────────────── */
function ThumbnailTrap({ competitor }: { competitor: Competitor }) {
    return (
        <section className="vs-trap">
            <div className="vs-container">
                <div className="vs-section-head">
                    <span className="vs-eyebrow">THE THUMBNAIL TRAP</span>
                    <h2 className="vs-section-h">Why your {competitor.name} bill grew faster than your traffic.</h2>
                    <p className="vs-section-lead">
                        Every WordPress upload generates 6–8 thumbnail sizes (full, large, medium, medium_large,
                        thumbnail, theme sizes, plus WooCommerce/Elementor extras). It's invisible to your editors.
                        It's <strong>not</strong> invisible to your billing.
                    </p>
                </div>

                <div className="vs-trap-grid">
                    <Card title={`How ${competitor.name} counts`} subtitle={competitor.countingModel} accent="bad">
                        <BarRow label="1 photo uploaded" value={competitor.avgThumbnailsPerUpload} max={competitor.avgThumbnailsPerUpload} colored />
                        <div className="vs-trap-coda">
                            = <strong>{competitor.avgThumbnailsPerUpload}× your conversion bill</strong> for the same actual content
                        </div>
                    </Card>
                    <Card title="How Tempaloo counts" subtitle="1 credit per upload — every thumbnail size bundled." accent="good">
                        <BarRow label="1 photo uploaded" value={1} max={competitor.avgThumbnailsPerUpload} colored />
                        <div className="vs-trap-coda">
                            = <strong>{competitor.avgThumbnailsPerUpload}× more conversions</strong> for the same monthly budget
                        </div>
                    </Card>
                </div>
            </div>
        </section>
    );
}

/* ── Calculator ─────────────────────────────────────────────────────── */
function Calculator({ competitor }: { competitor: Competitor }) {
    const [photos, setPhotos] = useState(500);
    const tempaloo = useMemo(() => tempalooPlanFor(photos), [photos]);
    const them = useMemo(() => competitorCostFor(competitor, photos), [competitor, photos]);

    const tempalooDisplay = useTween(tempaloo.priceEur);
    const themDisplay = useTween(them.priceEur);
    const savings = Math.max(0, them.priceEur - tempaloo.priceEur);
    const savingsPct = them.priceEur > 0 ? Math.round((savings / them.priceEur) * 100) : 0;

    return (
        <section id="calculator" className="vs-calc">
            <div className="vs-container">
                <div className="vs-section-head">
                    <span className="vs-eyebrow">YOUR REAL COST</span>
                    <h2 className="vs-section-h">How much would you save?</h2>
                    <p className="vs-section-lead">
                        Drag the slider to your monthly upload volume.
                        We'll do the math (assuming a typical {competitor.avgThumbnailsPerUpload} thumbnails per upload).
                    </p>
                </div>

                <div className="vs-calc-card">
                    <div className="vs-calc-input">
                        <label htmlFor="vs-slider" className="vs-calc-label">
                            Photos uploaded per month: <strong className="vs-calc-num">{photos.toLocaleString()}</strong>
                        </label>
                        <input
                            id="vs-slider"
                            type="range"
                            min={50}
                            max={10000}
                            step={50}
                            value={photos}
                            onChange={(e) => setPhotos(Number(e.target.value))}
                            className="vs-calc-slider"
                            aria-label="Monthly photo uploads"
                        />
                        <div className="vs-calc-marks">
                            <span>50</span><span>1k</span><span>5k</span><span>10k</span>
                        </div>
                    </div>

                    <div className="vs-calc-grid">
                        <div className="vs-calc-quote vs-calc-quote-them">
                            <div className="vs-calc-q-h">
                                {competitor.name}
                                <span className="vs-calc-q-plan">{them.planName}{!them.covered && " + overflow"}</span>
                            </div>
                            <div className="vs-calc-q-num">€{themDisplay}<span>/mo</span></div>
                            <div className="vs-calc-q-meta">
                                {(photos * competitor.avgThumbnailsPerUpload).toLocaleString()} thumbnail-credits/mo
                            </div>
                        </div>

                        <div className="vs-calc-arrow" aria-hidden>→</div>

                        <div className="vs-calc-quote vs-calc-quote-us">
                            <div className="vs-calc-q-h">
                                Tempaloo
                                <span className="vs-calc-q-plan">{tempaloo.name}</span>
                            </div>
                            <div className="vs-calc-q-num">€{tempalooDisplay}<span>/mo</span></div>
                            <div className="vs-calc-q-meta">
                                {photos.toLocaleString()} upload-credits/mo
                            </div>
                        </div>
                    </div>

                    <div className={`vs-calc-savings ${savings > 0 ? "vs-calc-savings-on" : ""}`}>
                        {savings > 0 ? (
                            <>
                                You save <strong>€{savings}/mo</strong> ({savingsPct}% less) — and <strong>€{(savings * 12).toLocaleString()}/year</strong>.
                            </>
                        ) : (
                            <>You're inside both providers' free tiers — switch for the better dev experience.</>
                        )}
                    </div>

                    <div className="vs-calc-cta">
                        <Link href={`/webp/activate?plan=${tempaloo.name.toLowerCase()}&utm_source=calculator_${competitor.slug}`} className="vs-btn vs-btn-primary">
                            Start on {tempaloo.name} {tempaloo.priceEur === 0 ? "(free)" : `(€${tempaloo.priceEur}/mo)`} <Arrow />
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ── Feature matrix ─────────────────────────────────────────────────── */
function Matrix({ competitor }: { competitor: Competitor }) {
    const rows: { label: string; us: ReactNode; them: ReactNode; usWin?: boolean }[] = [
        {
            label: "Counts thumbnails as credits",
            us: <span className="vs-mat-good">No — 1 upload = 1 credit</span>,
            them: <span className="vs-mat-bad">Yes — {competitor.avgThumbnailsPerUpload}× per upload</span>,
            usWin: true,
        },
        { label: "WebP", us: yes, them: yes },
        { label: "AVIF", us: yes, them: competitor.avif ? yes : no, usWin: !competitor.avif },
        { label: "Restore originals (one click)", us: yes, them: competitor.restore ? yes : no, usWin: !competitor.restore },
        { label: "Resize on upload", us: yes, them: competitor.resizeOnUpload ? yes : no },
        { label: "Multisite", us: yes, them: competitor.multisite ? yes : no },
        { label: "WP-CLI", us: yes, them: competitor.wpCli ? yes : no, usWin: !competitor.wpCli },
        { label: "Developer hooks", us: <Tag>3 documented</Tag>, them: <Tag muted>{competitor.hooks}</Tag> },
        { label: "EU-hosted (GDPR)", us: yes, them: competitor.euHosted ? yes : no, usWin: !competitor.euHosted },
        { label: "Pricing model", us: <Tag>Flat plans, image-based</Tag>, them: <Tag muted>{labelOf(competitor.pricingTransparency)}</Tag> },
        { label: "CDN bundled", us: <Tag muted>Not yet</Tag>, them: competitor.cdn === "yes" ? yes : competitor.cdn === "addon" ? <Tag muted>Paid add-on</Tag> : no },
        { label: "Free tier (real images/mo)", us: <Tag accent>250</Tag>, them: <Tag muted>{competitor.freeMonthlyImagesEffective}</Tag>, usWin: true },
    ];

    return (
        <section className="vs-mat">
            <div className="vs-container">
                <div className="vs-section-head">
                    <span className="vs-eyebrow">PARITY CHECK</span>
                    <h2 className="vs-section-h">Feature by feature.</h2>
                    <p className="vs-section-lead">No fluff — what you get in each plugin, side by side.</p>
                </div>
                <div className="vs-mat-wrap">
                    <table className="vs-mat-table">
                        <thead>
                            <tr>
                                <th></th>
                                <th className="vs-mat-us-h">Tempaloo</th>
                                <th>{competitor.name}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => (
                                <tr key={r.label} className="vs-mat-row" style={{ animationDelay: `${i * 40}ms` }}>
                                    <th>{r.label}</th>
                                    <td className={`vs-mat-us ${r.usWin ? "vs-mat-us-win" : ""}`}>{r.us}</td>
                                    <td>{r.them}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="vs-mat-note">
                    Comparison fair as of April 2026, pulled from each vendor's public pricing page.
                </p>
            </div>
        </section>
    );
}

/* ── Switch CTA ─────────────────────────────────────────────────────── */
function SwitchCta({ competitor }: { competitor: Competitor }) {
    return (
        <section className="vs-final">
            <div className="vs-container vs-final-inner">
                <h2 className="vs-h-display vs-final-h">
                    Stop counting thumbnails.<br />
                    <span className="vs-font-serif vs-final-accent">Start shipping faster pages.</span>
                </h2>
                <p className="vs-final-lead">
                    Free plan, no card, 250 images/month. Migrate from {competitor.name} in 5 minutes —
                    your existing WebP files keep working.
                </p>
                <div className="vs-final-ctas">
                    <Link href={`/webp/activate?plan=free&utm_source=vs_${competitor.slug}`} className="vs-btn vs-btn-final-primary">
                        Get my free API key <Arrow />
                    </Link>
                    <Link href="/webp" className="vs-btn vs-btn-final-ghost">
                        See full pricing
                    </Link>
                </div>
            </div>
        </section>
    );
}

/* ── Footer ─────────────────────────────────────────────────────────── */
function Footer({ competitor }: { competitor: Competitor }) {
    return (
        <footer className="vs-footer">
            <div className="vs-container vs-footer-inner">
                <div className="vs-footer-brand">
                    <LogoMark size={22} />
                    <p>One credit per upload. Lighter pages, no surprise bills.</p>
                </div>
                <div className="vs-footer-cols">
                    <div className="vs-footer-col">
                        <div className="vs-footer-col-h">VS COMPETITORS</div>
                        <Link href="/webp/vs-shortpixel">vs ShortPixel</Link>
                        <Link href="/webp/vs-imagify">vs Imagify</Link>
                        <Link href="/webp/vs-tinypng">vs TinyPNG</Link>
                    </div>
                    <div className="vs-footer-col">
                        <div className="vs-footer-col-h">PRODUCT</div>
                        <Link href="/webp">Overview</Link>
                        <Link href="/webp#pricing">Pricing</Link>
                        <Link href="/docs">Docs</Link>
                    </div>
                </div>
            </div>
            <div className="vs-container vs-footer-bottom">
                <span>© {new Date().getFullYear()} Tempaloo · independent of {competitor.name}.</span>
            </div>
        </footer>
    );
}

/* ── Small primitives ───────────────────────────────────────────────── */
function PhotoSvg({ small }: { small?: boolean }) {
    const s = small ? 32 : 64;
    return (
        <svg viewBox="0 0 64 64" width={s} height={s} aria-hidden>
            <defs>
                <linearGradient id={`pg${small ? "s" : "b"}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#f9c47a" />
                    <stop offset="0.5" stopColor="#d8845a" />
                    <stop offset="1" stopColor="#3a2a1c" />
                </linearGradient>
            </defs>
            <rect width="64" height="42" fill={`url(#pg${small ? "s" : "b"})`} />
            <circle cx="46" cy="14" r="6" fill="#fff5cf" />
            <rect y="42" width="64" height="22" fill="#0a0805" />
            <path d="M0 42 L18 26 L28 36 L42 22 L60 38 L64 33 L64 42 Z" fill="#1c1108" />
        </svg>
    );
}
function Check() {
    return <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden><path d="M3 8.5 L6.5 12 L13 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>;
}
function Arrow() {
    return <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden><path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>;
}
const yes = <span className="vs-mat-good">✓</span>;
const no  = <span className="vs-mat-bad">—</span>;
function Tag({ children, muted, accent }: { children: ReactNode; muted?: boolean; accent?: boolean }) {
    return <span className={`vs-mat-tag ${muted ? "vs-mat-tag-muted" : ""} ${accent ? "vs-mat-tag-accent" : ""}`}>{children}</span>;
}
function labelOf(t: string): string {
    if (t === "tiered-credits") return "Tiered credit packs";
    if (t === "complex") return "MB-based, complex";
    return "Clear";
}

function Card({ title, subtitle, accent, children }: { title: string; subtitle: string; accent: "good" | "bad"; children: ReactNode }) {
    return (
        <div className={`vs-card vs-card-${accent}`}>
            <div className="vs-card-h">{title}</div>
            <div className="vs-card-sub">{subtitle}</div>
            <div className="vs-card-body">{children}</div>
        </div>
    );
}
function BarRow({ label, value, max, colored }: { label: string; value: number; max: number; colored?: boolean }) {
    const pct = (value / max) * 100;
    return (
        <div className="vs-bar-row">
            <div className="vs-bar-row-label">{label}</div>
            <div className="vs-bar-row-bar">
                <div
                    className={`vs-bar-row-fill ${colored ? "vs-bar-row-fill-colored" : ""}`}
                    style={{ width: pct + "%" }}
                />
                <span className="vs-bar-row-num">{value} {value === 1 ? "credit" : "credits"}</span>
            </div>
        </div>
    );
}

/* ── Number tween hook ──────────────────────────────────────────────── */
function useTween(target: number, duration = 350): string {
    const [value, setValue] = useState(target);
    const fromRef = useRef(target);
    useEffect(() => {
        const from = fromRef.current;
        const start = performance.now();
        let raf = 0;
        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            const v = from + (target - from) * eased;
            setValue(v);
            if (t < 1) raf = requestAnimationFrame(tick);
            else fromRef.current = target;
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, duration]);
    return Math.round(value).toLocaleString();
}

/* ── CSS ────────────────────────────────────────────────────────────── */
const css = (accent: string) => `
.vs-root { background: var(--bg); color: var(--ink); font-family: var(--font-geist-sans), sans-serif; }
.vs-container { max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 3vw, 24px); }
.vs-h-display { font-family: var(--font-geist-sans), sans-serif; letter-spacing: -0.035em; font-weight: 600; }
.vs-font-serif { font-family: var(--font-serif), serif; font-style: italic; font-weight: 400; letter-spacing: -0.01em; }
.vs-eyebrow { font-family: var(--font-geist-mono), monospace; font-size: 11px; letter-spacing: 0.04em; color: var(--ink-3); }

.vs-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 40px; padding: 0 18px; border-radius: 8px; font-size: 14px; font-weight: 500; border: 1px solid transparent; cursor: pointer; transition: background .15s, color .15s, border-color .15s, transform .15s; white-space: nowrap; text-decoration: none; }
.vs-btn-primary { background: var(--ink); color: var(--bg); }
.vs-btn-primary:hover { transform: translateY(-1px); }
.vs-btn-ghost { background: transparent; color: var(--ink); border-color: var(--line-2); }
.vs-btn-ghost:hover { background: var(--bg-2); }
.vs-btn-sm { height: 34px; font-size: 13px; padding: 0 14px; }

/* Nav */
.vs-nav { position: sticky; top: 0; z-index: 50; background: transparent; border-bottom: 1px solid transparent; transition: background .2s, border-color .2s; }
.vs-nav-scrolled { background: color-mix(in oklab, var(--bg) 88%, transparent); backdrop-filter: blur(14px) saturate(180%); -webkit-backdrop-filter: blur(14px) saturate(180%); border-bottom-color: var(--line); }
.vs-nav-inner { display: grid; grid-template-columns: auto 1fr auto; gap: 24px; align-items: center; height: 60px; }
.vs-nav-logo { display: inline-flex; color: var(--ink); }
.vs-nav-mid { justify-self: center; font-size: 14px; color: var(--ink-2); font-weight: 500; }
.vs-nav-vs { color: var(--ink-3); margin: 0 6px; font-style: italic; }
@media (max-width: 600px) { .vs-nav-mid { display: none; } }

/* Reveal animations */
.vs-reveal { opacity: 0; transform: translateY(12px); animation: vsRise 700ms cubic-bezier(.16,1,.3,1) forwards; }
.vs-reveal-d1 { animation-delay: 80ms; }
.vs-reveal-d2 { animation-delay: 180ms; }
.vs-reveal-d3 { animation-delay: 280ms; }
.vs-reveal-d4 { animation-delay: 380ms; }
@keyframes vsRise { to { opacity: 1; transform: none; } }

/* Hero */
.vs-hero { padding: 64px 0 48px; }
.vs-hero-inner { text-align: center; }
.vs-pill { display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px; border-radius: 999px; background: var(--bg-2); color: var(--ink-2); border: 1px solid var(--line-2); font-size: 12.5px; font-weight: 500; }
.vs-pill-dot { width: 6px; height: 6px; border-radius: 50%; background: ${accent}; box-shadow: 0 0 0 4px ${accent}26; }
.vs-hero-h1 { font-size: clamp(34px, 6.4vw, 72px); line-height: 1.04; margin: 24px auto 20px; max-width: 880px; color: var(--ink); text-wrap: balance; }
.vs-hero-comp { color: ${accent}; }
.vs-hero-accent { color: var(--ink-3); }
.vs-hero-lead { font-size: 17px; line-height: 1.6; color: var(--ink-2); max-width: 600px; margin: 0 auto 28px; text-wrap: balance; }
.vs-hero-lead strong { color: var(--ink); font-weight: 600; }
.vs-hero-ctas { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-bottom: 18px; }
.vs-trust-chips { list-style: none; padding: 0; margin: 0 0 64px; display: flex; justify-content: center; gap: 18px 24px; flex-wrap: wrap; font-size: 12.5px; color: var(--ink-3); }
.vs-trust-chips li { display: inline-flex; align-items: center; gap: 5px; }
.vs-trust-chips svg { color: var(--ink-2); }

/* Credit-burn demo */
.vs-burn { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 1080px; margin: 0 auto; padding: 24px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 24px 48px -24px rgba(0,0,0,0.18); }
@media (max-width: 760px) { .vs-burn { grid-template-columns: 1fr; } }
.vs-burn-col { padding: 18px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg); }
.vs-burn-us { background: linear-gradient(180deg, ${accent}07, transparent); border-color: ${accent}40; }
.vs-burn-h { display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 12px; border-bottom: 1px solid var(--line); margin-bottom: 16px; }
.vs-burn-brand { font-weight: 600; font-size: 14px; color: var(--ink); }
.vs-burn-tally { display: inline-flex; align-items: baseline; gap: 4px; }
.vs-burn-tally-num { font-family: var(--font-geist-mono), monospace; font-size: 26px; font-weight: 600; color: var(--success); letter-spacing: -0.04em; }
.vs-burn-tally-bad .vs-burn-tally-num { color: ${accent}; }
.vs-burn-tally-lbl { font-size: 11px; color: var(--ink-3); font-family: var(--font-geist-mono), monospace; letter-spacing: 0.02em; text-transform: uppercase; }
.vs-burn-stage { display: flex; flex-direction: column; align-items: center; min-height: 220px; }
.vs-burn-photo { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 8px; border-radius: 8px; opacity: 0; transform: scale(0.92); }
.vs-burn-on .vs-burn-photo-anim { animation: vsPhotoIn 600ms cubic-bezier(.16,1,.3,1) 80ms forwards; }
@keyframes vsPhotoIn { to { opacity: 1; transform: none; } }
.vs-burn-fname { font-family: var(--font-geist-mono), monospace; font-size: 11px; color: var(--ink-2); }
.vs-burn-arrow { color: var(--ink-3); font-family: var(--font-geist-mono), monospace; font-size: 11px; margin: 14px 0; opacity: 0; }
.vs-burn-on .vs-burn-arrow { animation: vsRise 500ms ease 700ms forwards; }
.vs-burn-bundle { opacity: 0; }
.vs-burn-on .vs-burn-bundle { animation: vsRise 500ms ease 1100ms forwards; }
.vs-burn-pill { display: inline-block; padding: 6px 12px; border-radius: 999px; font-family: var(--font-geist-mono), monospace; font-size: 11.5px; font-weight: 500; }
.vs-burn-pill-good { background: color-mix(in oklab, var(--success) 18%, var(--bg-2)); color: var(--success); border: 1px solid color-mix(in oklab, var(--success) 30%, transparent); }
.vs-burn-thumbs { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; padding: 8px 0; }
@media (max-width: 480px) { .vs-burn-thumbs { grid-template-columns: repeat(4, 1fr); } }
.vs-burn-thumb { position: relative; opacity: 0; transform: translateY(-4px) scale(0.7); }
.vs-burn-on .vs-burn-thumb { animation: vsThumbIn 400ms cubic-bezier(.16,1,.3,1) forwards; }
@keyframes vsThumbIn { to { opacity: 1; transform: none; } }
.vs-burn-credit-pop { position: absolute; top: -8px; right: -6px; background: ${accent}; color: white; font-family: var(--font-geist-mono), monospace; font-size: 9.5px; font-weight: 600; padding: 1px 5px; border-radius: 6px; opacity: 0; transform: translateY(4px); }
.vs-burn-on .vs-burn-credit-pop { animation: vsCreditPop 600ms cubic-bezier(.16,1,.3,1) forwards; }
@keyframes vsCreditPop { 0% { opacity: 0; transform: translateY(4px); } 30% { opacity: 1; transform: translateY(-4px); } 100% { opacity: 1; transform: translateY(-2px); } }

/* Section heads */
.vs-section-head { max-width: 720px; margin: 0 auto 40px; text-align: center; }
.vs-section-h { font-size: clamp(28px, 4.4vw, 48px); line-height: 1.1; letter-spacing: -0.035em; font-weight: 600; margin: 10px 0 14px; color: var(--ink); text-wrap: balance; }
.vs-section-lead { font-size: 16px; color: var(--ink-2); line-height: 1.6; }
.vs-section-lead strong { color: var(--ink); }

/* Trap section */
.vs-trap { padding: 96px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); background: var(--bg-2); }
.vs-trap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 980px; margin: 0 auto; }
@media (max-width: 760px) { .vs-trap-grid { grid-template-columns: 1fr; } }
.vs-card { padding: 24px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); }
.vs-card-bad { border-color: ${accent}40; }
.vs-card-good { border-color: color-mix(in oklab, var(--success) 35%, transparent); }
.vs-card-h { font-weight: 600; font-size: 16px; color: var(--ink); margin-bottom: 4px; }
.vs-card-sub { font-size: 12.5px; color: var(--ink-3); margin-bottom: 18px; line-height: 1.5; }
.vs-bar-row { display: flex; flex-direction: column; gap: 6px; }
.vs-bar-row-label { font-size: 13px; color: var(--ink-2); }
.vs-bar-row-bar { position: relative; height: 28px; background: var(--bg-2); border-radius: 6px; overflow: hidden; display: flex; align-items: center; padding: 0 10px; }
.vs-bar-row-fill { position: absolute; left: 0; top: 0; bottom: 0; background: var(--ink); border-radius: 6px; transform-origin: left; animation: vsBarGrow 900ms cubic-bezier(.16,1,.3,1) 200ms backwards; }
.vs-card-bad .vs-bar-row-fill-colored { background: ${accent}; }
.vs-card-good .vs-bar-row-fill-colored { background: var(--success); }
@keyframes vsBarGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.vs-bar-row-num { position: relative; font-family: var(--font-geist-mono), monospace; font-size: 12.5px; font-weight: 600; color: white; mix-blend-mode: difference; }
.vs-trap-coda { margin-top: 18px; font-size: 14px; color: var(--ink-2); line-height: 1.5; }
.vs-trap-coda strong { color: var(--ink); }

/* Calculator */
.vs-calc { padding: 96px 0; }
.vs-calc-card { max-width: 840px; margin: 0 auto; padding: 28px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); box-shadow: 0 24px 48px -24px rgba(0,0,0,0.18); }
.vs-calc-input { margin-bottom: 28px; }
.vs-calc-label { display: block; font-size: 14px; color: var(--ink-2); margin-bottom: 10px; }
.vs-calc-num { font-family: var(--font-geist-mono), monospace; color: var(--ink); font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }
.vs-calc-slider { width: 100%; appearance: none; height: 6px; background: var(--bg-2); border-radius: 3px; outline: none; }
.vs-calc-slider::-webkit-slider-thumb { appearance: none; width: 22px; height: 22px; border-radius: 50%; background: var(--ink); cursor: grab; box-shadow: 0 0 0 4px var(--bg), 0 0 0 5px var(--line-2); transition: transform .15s; }
.vs-calc-slider::-webkit-slider-thumb:hover { transform: scale(1.1); }
.vs-calc-slider::-moz-range-thumb { width: 22px; height: 22px; border-radius: 50%; background: var(--ink); cursor: grab; border: none; box-shadow: 0 0 0 4px var(--bg), 0 0 0 5px var(--line-2); }
.vs-calc-marks { display: flex; justify-content: space-between; margin-top: 6px; font-family: var(--font-geist-mono), monospace; font-size: 10.5px; color: var(--ink-3); }
.vs-calc-grid { display: grid; grid-template-columns: 1fr 32px 1fr; gap: 12px; align-items: stretch; }
@media (max-width: 580px) { .vs-calc-grid { grid-template-columns: 1fr; } .vs-calc-arrow { display: none; } }
.vs-calc-quote { padding: 18px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg); display: flex; flex-direction: column; gap: 4px; transition: border-color .2s; }
.vs-calc-quote-them { border-color: ${accent}40; background: ${accent}06; }
.vs-calc-quote-us { border-color: ${accent === "var(--success)" ? "var(--success)" : "var(--success)"}40; background: color-mix(in oklab, var(--success) 4%, var(--bg)); }
.vs-calc-q-h { font-size: 13px; color: var(--ink-2); font-weight: 500; display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.vs-calc-q-plan { font-size: 11px; color: var(--ink-3); font-family: var(--font-geist-mono), monospace; font-weight: 400; }
.vs-calc-q-num { font-size: 38px; font-weight: 600; letter-spacing: -0.04em; color: var(--ink); margin-top: 4px; line-height: 1; }
.vs-calc-q-num span { font-size: 14px; color: var(--ink-3); font-weight: 400; margin-left: 2px; }
.vs-calc-q-meta { font-size: 11.5px; color: var(--ink-3); font-family: var(--font-geist-mono), monospace; margin-top: 6px; }
.vs-calc-arrow { display: flex; align-items: center; justify-content: center; font-size: 22px; color: var(--ink-3); }
.vs-calc-savings { margin-top: 22px; padding: 16px; border-radius: 10px; background: var(--bg-2); border: 1px solid var(--line-2); text-align: center; font-size: 14px; color: var(--ink-2); transition: all .2s; opacity: 0.7; }
.vs-calc-savings-on { background: color-mix(in oklab, var(--success) 12%, var(--bg-2)); border-color: color-mix(in oklab, var(--success) 30%, transparent); color: var(--ink); opacity: 1; }
.vs-calc-savings strong { color: var(--ink); font-size: 16px; }
.vs-calc-cta { display: flex; justify-content: center; margin-top: 18px; }

/* Matrix */
.vs-mat { padding: 96px 0; border-top: 1px solid var(--line); background: var(--bg-2); }
.vs-mat-wrap { max-width: 880px; margin: 0 auto; overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
.vs-mat-table { width: 100%; min-width: 540px; border-collapse: collapse; font-size: 14px; }
.vs-mat-table th, .vs-mat-table td { padding: 14px 16px; text-align: left; border-bottom: 1px solid var(--line); }
.vs-mat-table thead th { font-size: 12px; font-weight: 600; color: var(--ink-3); letter-spacing: 0.02em; text-transform: uppercase; background: var(--bg-2); border-bottom: 1px solid var(--line-2); }
.vs-mat-table tbody th { font-weight: 500; color: var(--ink); width: 42%; }
.vs-mat-table tbody td { color: var(--ink-2); }
.vs-mat-us-h, .vs-mat-us { background: color-mix(in oklab, var(--success) 6%, transparent); color: var(--ink) !important; }
.vs-mat-us-win { font-weight: 600; }
.vs-mat-table tr:last-child th, .vs-mat-table tr:last-child td { border-bottom: none; }
.vs-mat-good { color: var(--success); font-weight: 600; }
.vs-mat-bad { color: ${accent}; }
.vs-mat-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; background: var(--bg-2); border: 1px solid var(--line); font-size: 12px; color: var(--ink); font-weight: 500; }
.vs-mat-tag-muted { background: transparent; border-color: var(--line-2); color: var(--ink-3); }
.vs-mat-tag-accent { background: color-mix(in oklab, var(--success) 18%, transparent); border-color: var(--success); color: var(--success); }
.vs-mat-row { animation: vsRowIn 500ms ease backwards; }
@keyframes vsRowIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.vs-mat-note { text-align: center; font-size: 12px; color: var(--ink-3); margin: 24px 0 0; }

/* Final CTA */
.vs-final { padding: 112px 0; background: var(--ink); color: var(--bg); position: relative; overflow: hidden; }
.vs-final-inner { text-align: center; }
.vs-final-h { font-size: clamp(32px, 5vw, 56px); line-height: 1.05; margin: 0 0 18px; color: var(--bg); text-wrap: balance; }
.vs-final-accent { color: var(--ink-3); }
.vs-final-lead { font-size: 16px; color: rgba(237, 237, 237, 0.7); max-width: 540px; margin: 0 auto 28px; }
.vs-final-ctas { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.vs-btn-final-primary { background: var(--bg); color: var(--ink); height: 44px; padding: 0 22px; font-size: 14.5px; }
.vs-btn-final-ghost { background: rgba(255,255,255,0.08); color: var(--bg); border: 1px solid rgba(255,255,255,0.22); height: 44px; padding: 0 22px; font-size: 14.5px; }
.vs-btn-final-ghost:hover { background: rgba(255,255,255,0.14); }

/* Footer */
.vs-footer { padding: 56px 0 32px; border-top: 1px solid var(--line); background: var(--bg); }
.vs-footer-inner { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 32px; }
.vs-footer-brand { max-width: 280px; display: flex; flex-direction: column; gap: 14px; }
.vs-footer-brand p { font-size: 12.5px; color: var(--ink-3); margin: 0; line-height: 1.55; }
.vs-footer-cols { display: flex; gap: 56px; flex-wrap: wrap; }
.vs-footer-col { display: flex; flex-direction: column; gap: 10px; font-size: 13px; }
.vs-footer-col-h { font-size: 11px; letter-spacing: 0.02em; color: var(--ink-3); margin-bottom: 2px; font-family: var(--font-geist-mono), monospace; }
.vs-footer-col a { color: var(--ink-2); text-decoration: none; transition: color .15s; }
.vs-footer-col a:hover { color: var(--ink); }
.vs-footer-bottom { margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--line); font-size: 11.5px; color: var(--ink-3); }

@media (prefers-reduced-motion: reduce) {
  .vs-reveal, .vs-burn-photo-anim, .vs-burn-arrow, .vs-burn-bundle, .vs-burn-thumb, .vs-burn-credit-pop, .vs-bar-row-fill, .vs-mat-row {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
`;
