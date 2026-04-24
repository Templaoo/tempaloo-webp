"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Theme = "light" | "dark";
type Billing = "monthly" | "annual";

interface Plan {
    id: "free" | "starter" | "growth" | "business" | "unlimited";
    name: string;
    tagline: string;
    monthly: number;
    annual: number;
    annualTotal: number;
    quota: string;
    quotaUnit: string;
    sites: string;
    badge?: string;
    highlight?: boolean;
    features: string[];
    cta: string;
}

const PLANS: Plan[] = [
    {
        id: "free", name: "Free",
        tagline: "Try it. No card required.",
        monthly: 0, annual: 0, annualTotal: 0,
        quota: "250", quotaUnit: "/mo",
        sites: "1 site",
        features: ["WebP conversion", "1 credit per upload", "Automatic on upload", "Rollover 30 days"],
        cta: "Start free",
    },
    {
        id: "starter", name: "Starter",
        tagline: "For a single blog or portfolio.",
        monthly: 5, annual: 4, annualTotal: 48,
        quota: "5,000", quotaUnit: "/mo",
        sites: "1 site",
        features: ["WebP + AVIF", "Unlimited bulk", "Rollover 30 days", "Email support (48h)"],
        cta: "Start trial",
    },
    {
        id: "growth", name: "Growth",
        tagline: "For small agencies with a few sites.",
        badge: "Popular", highlight: true,
        monthly: 12, annual: 9.58, annualTotal: 115,
        quota: "25,000", quotaUnit: "/mo",
        sites: "5 sites",
        features: ["WebP + AVIF", "5 sites per license", "Rollover 30 days", "Email support (24h)"],
        cta: "Start trial",
    },
    {
        id: "business", name: "Business",
        tagline: "For agencies running many sites.",
        monthly: 29, annual: 23.17, annualTotal: 278,
        quota: "150,000", quotaUnit: "/mo",
        sites: "Unlimited",
        features: ["Everything in Growth", "Unlimited sites", "Direct API access", "Chat support (24h)"],
        cta: "Start trial",
    },
    {
        id: "unlimited", name: "Unlimited",
        tagline: "For hosts, platforms, agencies at scale.",
        monthly: 59, annual: 47.17, annualTotal: 566,
        quota: "Unlimited", quotaUnit: "fair use 500k",
        sites: "Unlimited",
        features: ["Everything in Business", "Priority SLA", "Dedicated onboarding", "White-label reports (soon)"],
        cta: "Talk to sales",
    },
];

const FAQS = [
    { q: "Do you charge per thumbnail like ShortPixel or Elementor?",
      a: "No — and that's the main reason people switch. WordPress generates 6-8 thumbnails for every image you upload. ShortPixel, Imagify, Elementor Image Optimizer count each of those as a separate credit. We count the upload itself: 1 image uploaded = 1 credit, no matter how many sizes WordPress creates. In practice you get 6-8× more conversions for the same price." },
    { q: "Do I need Elementor, Gutenberg or any specific page builder?",
      a: "No. Our plugin is a standalone WordPress plugin — it works with Gutenberg, Elementor, Bricks, Divi, Beaver Builder, classic editor, WooCommerce, and any theme. You are never locked into an ecosystem." },
    { q: "What happens to my unused images at the end of the month?",
      a: "They roll over automatically for 30 days, capped at one month's worth of your plan. Example: on Starter (5,000/mo), if you only use 2,000 in March, April opens at 8,000 available. No more \"use it or lose it\"." },
    { q: "What happens if I hit my quota?",
      a: "New uploads simply stop being converted until next month, or until you upgrade in one click. Images already optimized keep being served as WebP — nothing breaks." },
    { q: "Do you keep my images?",
      a: "No. Conversion happens in-memory and the converted file is streamed back to your site. Originals stay on your server, untouched. We are not a storage service." },
    { q: "Can I cancel anytime? What about refunds?",
      a: "Cancel any day, in one click, no penalty. All paid plans include a 7-day free trial and a 30-day money-back guarantee." },
    { q: "Do you support AVIF?",
      a: "Yes, on Starter and above. AVIF produces ~20% smaller files than WebP at equivalent quality and is supported by every major modern browser." },
];

const activateHref = (plan: Plan["id"], billing: Billing) => `/webp/activate?plan=${plan}&billing=${billing}`;

export function LandingPage() {
    const [theme, setTheme] = useState<Theme>("dark");
    const [billing, setBilling] = useState<Billing>("annual");
    const [faqOpen, setFaqOpen] = useState<number>(0);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <div className="pr2-root" data-theme={theme}>
            <style dangerouslySetInnerHTML={{ __html: css }} />

            <Nav theme={theme} scrolled={scrolled} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} />
            <Hero />
            <StatsBar />
            <ThumbnailTrap />
            <Pricing billing={billing} onBillingChange={setBilling} />
            <FAQ openIdx={faqOpen} onToggle={(i) => setFaqOpen(faqOpen === i ? -1 : i)} />
            <FinalCTA />
            <Footer />
        </div>
    );
}

function Nav({ theme, scrolled, onToggleTheme }: { theme: Theme; scrolled: boolean; onToggleTheme: () => void }) {
    return (
        <nav className={`pr2-nav ${scrolled ? "pr2-nav-scrolled" : ""}`}>
            <div className="pr2-container pr2-nav-inner">
                <div className="pr2-nav-left">
                    <Link href="/webp" className="pr2-nav-logo" aria-label="Tempaloo WebP home"><Logo /></Link>
                    <div className="pr2-nav-links">
                        <a href="#pricing">Pricing</a>
                        <a href="#faq">FAQ</a>
                        <a href="#" title="Coming soon">Docs</a>
                        <a href="#" title="Coming soon">Changelog</a>
                    </div>
                </div>
                <div className="pr2-nav-right">
                    <button onClick={onToggleTheme} className="pr2-btn pr2-btn-ghost pr2-icon-btn" aria-label="Toggle theme">
                        {theme === "dark" ? (
                            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="3" /><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1.1 1.1M11.9 11.9L13 13M3 13l1.1-1.1M11.9 4.1L13 3" /></svg>
                        ) : (
                            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M13.5 10.2A5.5 5.5 0 0 1 5.8 2.5 5.5 5.5 0 1 0 13.5 10.2z" /></svg>
                        )}
                    </button>
                    <Link href="/webp/activate" className="pr2-nav-signin">Sign in</Link>
                    <Link href="/webp/activate?plan=free" className="pr2-btn pr2-btn-primary pr2-btn-sm">Get started <ArrowIcon /></Link>
                </div>
            </div>
        </nav>
    );
}

function Logo() {
    return (
        <span className="pr2-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="currentColor" /><path d="M6 8H18M12 8V17" stroke="var(--pr2-bg)" strokeWidth="2" strokeLinecap="round" /></svg>
            <span className="pr2-logo-text">Tempaloo<span className="pr2-logo-sub"> / WebP</span></span>
        </span>
    );
}

function ArrowIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden><path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    );
}

function CheckIcon({ size = 12 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden><path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
    );
}

function Hero() {
    return (
        <section className="pr2-hero">
            <div className="pr2-container pr2-hero-inner">
                <span className="pr2-pill">
                    <span className="pr2-pill-dot" />
                    <span>v1.4.0 · WordPress 6.0+</span>
                </span>
                <h1 className="pr2-h-display pr2-hero-h1">
                    Lighter images.{" "}
                    <span className="pr2-font-serif pr2-hero-h1-accent">One credit<br />per upload.</span>
                </h1>
                <p className="pr2-hero-lead">
                    Drop-in WebP &amp; AVIF conversion for WordPress. Every thumbnail size
                    bundled into a single credit. No visit counting. No surprise bills.
                </p>
                <div className="pr2-hero-ctas">
                    <Link href="/webp/activate?plan=free" className="pr2-btn pr2-btn-primary">Start free <ArrowIcon /></Link>
                    <a href="https://wordpress.org/plugins/tempaloo-webp/" className="pr2-btn pr2-btn-ghost" title="WordPress.org">
                        <span className="pr2-font-mono pr2-mono-sm">$</span> wp plugin install
                    </a>
                </div>
                <div className="pr2-hero-sub">
                    Free forever · No credit card · 250 images / month
                </div>
                <div className="pr2-hero-viz">
                    <MediaLibraryDemo />
                    <div className="pr2-hero-caption">
                        Live demo — 1 upload, 6 thumbnails, 1 credit
                    </div>
                </div>
            </div>
        </section>
    );
}

const SIZES = [
    { label: "Full 2048×1536", jpg: 1840, webp: 412 },
    { label: "1536×1152",       jpg: 1120, webp: 248 },
    { label: "1024×768",        jpg:  486, webp: 108 },
    { label: "768×576",         jpg:  284, webp:  62 },
    { label: "300×225",         jpg:   58, webp:  13 },
    { label: "150×150",         jpg:   22, webp:   5 },
];

function formatKB(kb: number): string {
    return kb >= 1000 ? `${(kb / 1000).toFixed(2)} MB` : `${kb} KB`;
}

function MediaLibraryDemo() {
    const [t, setT] = useState(0);
    useEffect(() => {
        let raf = 0;
        let start = performance.now();
        const loop = (now: number) => {
            const elapsed = (now - start) / 1000;
            if (elapsed > 7) start = now;
            setT(elapsed % 7);
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, []);

    const rowState = (i: number): { stage: "pending" | "jpg" | "converting" | "webp"; p: number } => {
        const appearAt = 1.0 + i * 0.12;
        const convertAt = 2.2 + i * 0.18;
        if (t < appearAt) return { stage: "pending", p: 0 };
        if (t < convertAt) return { stage: "jpg", p: 1 };
        const cp = Math.min(1, (t - convertAt) / 0.4);
        if (cp < 1) return { stage: "converting", p: cp };
        return { stage: "webp", p: 1 };
    };

    const uploadAppear = Math.min(1, Math.max(0, (t - 0.3) / 0.4));
    const creditShown = t > 2.2;
    const totalJpg = SIZES.reduce((s, x) => s + x.jpg, 0);
    const totalWebp = SIZES.reduce((s, x) => s + x.webp, 0);
    const allConverted = SIZES.every((_, i) => rowState(i).stage === "webp");

    let stateLabel = "·IDLE";
    if (allConverted) stateLabel = "✓ DONE";
    else if (t > 2.2) stateLabel = "…CONVERTING";
    else if (t > 1) stateLabel = "…GENERATING";

    return (
        <div className="pr2-demo">
            <div className="pr2-demo-chrome">
                <span className="pr2-traffic pr2-traffic-red" />
                <span className="pr2-traffic pr2-traffic-yellow" />
                <span className="pr2-traffic pr2-traffic-green" />
                <div className="pr2-demo-url">wp-admin / upload.php</div>
                <div style={{ width: 48 }} />
            </div>
            <div className="pr2-demo-grid">
                <div className="pr2-demo-left">
                    <div className="pr2-demo-section-label">UPLOAD</div>
                    <div className="pr2-demo-img" style={{ opacity: uploadAppear, transform: `translateY(${(1 - uploadAppear) * 8}px)` }}>
                        <svg viewBox="0 0 240 180" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%" }}>
                            <defs>
                                <linearGradient id="pr2-demo-sky" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#E8D4B0" />
                                    <stop offset="55%" stopColor="#D4895A" />
                                    <stop offset="100%" stopColor="#8B3A1A" />
                                </linearGradient>
                            </defs>
                            <rect width="240" height="120" fill="url(#pr2-demo-sky)" />
                            <circle cx="170" cy="72" r="20" fill="#F9E2BC" opacity="0.95" />
                            <rect y="120" width="240" height="60" fill="#1A0E08" />
                            <path d="M0 120 L40 80 L70 100 L110 66 L150 104 L190 76 L230 100 L240 90 L240 120 Z" fill="#0F0805" opacity="0.95" />
                        </svg>
                    </div>
                    <div className="pr2-demo-filename" style={{ opacity: uploadAppear }}>sunset-portfolio.jpg</div>
                    <div className="pr2-demo-filemeta" style={{ opacity: uploadAppear }}>1.84 MB · 2048 × 1536</div>
                    <div className="pr2-demo-credit" style={{ opacity: creditShown ? 1 : 0, transform: `translateY(${creditShown ? 0 : 6}px)` }}>
                        <div className="pr2-demo-credit-label">TEMPALOO CREDIT</div>
                        <div className="pr2-demo-credit-row">
                            <span className="pr2-demo-credit-num">−1</span>
                            <span className="pr2-demo-credit-sub">credit · all sizes bundled</span>
                        </div>
                    </div>
                </div>
                <div className="pr2-demo-right">
                    <div className="pr2-demo-right-head">
                        <div className="pr2-demo-section-label">WP GENERATES 6 THUMBNAILS → TEMPALOO CONVERTS</div>
                        <div className={`pr2-demo-state ${allConverted ? "pr2-demo-state-done" : ""}`}>{stateLabel}</div>
                    </div>
                    <div className="pr2-demo-rows">
                        {SIZES.map((s, i) => {
                            const st = rowState(i);
                            const isWebp = st.stage === "webp";
                            const isConverting = st.stage === "converting";
                            const hidden = st.stage === "pending";
                            const currentSize = isWebp ? s.webp : s.jpg;
                            return (
                                <div key={s.label} className={`pr2-demo-row ${isWebp ? "pr2-row-webp" : ""} ${isConverting ? "pr2-row-converting" : ""}`} style={{ opacity: hidden ? 0 : 1, transform: `translateY(${hidden ? 4 : 0}px)` }}>
                                    <div className="pr2-demo-row-label">{s.label}</div>
                                    <div className="pr2-demo-row-bar">
                                        <div className="pr2-demo-row-bar-fill" style={{
                                            width: isWebp ? "100%" : isConverting ? `${st.p * 100}%` : st.stage === "jpg" ? "100%" : "0%",
                                            background: isWebp ? "var(--pr2-success)" : isConverting ? "var(--pr2-ink)" : "var(--pr2-ink-3)",
                                        }} />
                                    </div>
                                    <div className="pr2-demo-row-size">{formatKB(currentSize)}</div>
                                    <div className={`pr2-demo-row-format ${isWebp ? "pr2-fmt-webp" : ""}`}>{isWebp ? "WEBP" : "JPG"}</div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="pr2-demo-totals">
                        <div className="pr2-demo-totals-row">
                            <div>
                                <div className="pr2-demo-section-label">BEFORE</div>
                                <div className="pr2-demo-total-val">{formatKB(totalJpg)}</div>
                            </div>
                            <div className="pr2-demo-arrow">→</div>
                            <div>
                                <div className="pr2-demo-section-label">AFTER</div>
                                <div className={`pr2-demo-total-val ${allConverted ? "pr2-demo-total-done" : ""}`}>{formatKB(allConverted ? totalWebp : totalJpg)}</div>
                            </div>
                        </div>
                        <div className={`pr2-demo-saved ${allConverted ? "pr2-demo-saved-on" : ""}`}>
                            {allConverted ? "−77%" : "…"}
                            <span className="pr2-demo-saved-sub">saved</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatsBar() {
    const stats = [
        { k: "−70%", v: "avg. page weight" },
        { k: "30s", v: "setup time" },
        { k: "6.0+", v: "WP compatibility" },
        { k: "30d", v: "money-back guarantee" },
    ];
    return (
        <section className="pr2-statsbar">
            <div className="pr2-container">
                <div className="pr2-stats-grid">
                    {stats.map((s) => (
                        <div key={s.v} className="pr2-stat">
                            <div className="pr2-h-display pr2-stat-k">{s.k}</div>
                            <div className="pr2-stat-v">{s.v}</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function ThumbnailTrap() {
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const id = window.setInterval(() => setTick((t) => (t + 1) % 100), 80);
        return () => window.clearInterval(id);
    }, []);
    const phase = tick;
    const thumbs = ["Full", "1536", "1024", "768", "300", "150"];
    const competitorCount = Math.min(6, Math.max(0, Math.floor((phase - 55) / 3) + 1));
    const tempalooCount = phase > 55 ? 1 : 0;

    const Box = ({ appear }: { appear: boolean }) => (
        <div className={`pr2-trap-box ${appear ? "pr2-trap-box-on" : ""}`} />
    );

    return (
        <section className="pr2-trap">
            <div className="pr2-container">
                <div className="pr2-section-head">
                    <span className="pr2-eyebrow">THE THUMBNAIL TRAP</span>
                    <h2 className="pr2-h-display pr2-section-h">
                        One upload <span className="pr2-font-serif pr2-section-h-accent">=</span> one credit.
                    </h2>
                    <p className="pr2-section-lead">
                        WordPress quietly generates 6 to 8 thumbnail sizes for every image you upload.
                        Most optimizers count each of those as a separate credit. We don&apos;t.
                    </p>
                </div>

                <div className="pr2-trap-grid">
                    <div className="pr2-trap-card">
                        <div className="pr2-trap-head">
                            <div className="pr2-trap-name">Competitors</div>
                            <div className="pr2-trap-sub pr2-font-mono">ShortPixel / Imagify</div>
                        </div>
                        <div className="pr2-trap-eyebrow">1 upload × 6 sizes → 6 credits</div>
                        <div className="pr2-trap-boxes">
                            {thumbs.map((s, i) => <Box key={s} appear={phase > 20 + i * 4} />)}
                        </div>
                        <div className="pr2-trap-bars">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className={`pr2-trap-bar ${phase > 55 + i * 3 ? "pr2-trap-bar-danger" : ""}`} />
                            ))}
                        </div>
                        <div className="pr2-trap-footer">
                            <span>Credits consumed</span>
                            <span className="pr2-h-display pr2-trap-count pr2-trap-count-danger pr2-font-mono">{competitorCount}</span>
                        </div>
                    </div>

                    <div className="pr2-trap-card pr2-trap-card-highlight">
                        <div className="pr2-trap-head">
                            <div className="pr2-trap-name">Tempaloo WebP</div>
                            <div className="pr2-trap-sub pr2-font-mono pr2-trap-bundled">BUNDLED</div>
                        </div>
                        <div className="pr2-trap-eyebrow">1 upload, all sizes bundled → 1 credit</div>
                        <div className={`pr2-trap-boxes pr2-trap-boxes-bundle ${phase > 50 ? "pr2-trap-boxes-bundle-on" : ""}`}>
                            {thumbs.map((s, i) => <Box key={s} appear={phase > 20 + i * 4} />)}
                        </div>
                        <div className="pr2-trap-bars">
                            <div className={`pr2-trap-bar ${phase > 55 ? "pr2-trap-bar-ink" : ""}`} />
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="pr2-trap-bar" />
                            ))}
                        </div>
                        <div className="pr2-trap-footer">
                            <span>Credits consumed</span>
                            <span className="pr2-h-display pr2-trap-count pr2-font-mono">{tempalooCount}</span>
                        </div>
                    </div>
                </div>

                <p className="pr2-trap-coda">
                    On 1,000 uploads, that&apos;s the difference between paying for{" "}
                    <span className="pr2-font-mono pr2-text-danger">6,000</span> vs{" "}
                    <span className="pr2-font-mono pr2-text-ink">1,000</span>{" "}credits.
                </p>
            </div>
        </section>
    );
}

function Pricing({ billing, onBillingChange }: { billing: Billing; onBillingChange: (b: Billing) => void }) {
    const [free, starter, growth, business, unlimited] = PLANS;

    return (
        <section id="pricing" className="pr2-pricing">
            <div className="pr2-container">
                <div className="pr2-section-head">
                    <span className="pr2-eyebrow">PRICING</span>
                    <h2 className="pr2-h-display pr2-section-h">Pick your plan.</h2>
                    <p className="pr2-section-lead">1 credit per image — every thumbnail size included. No visit counting. No surprise bills.</p>
                    <div className="pr2-billing-toggle-wrap">
                        <BillingToggle value={billing} onChange={onBillingChange} />
                    </div>
                </div>

                <div className="pr2-pricing-featured">
                    {[starter, growth, business].map((p) => (
                        <PlanCard key={p.id} plan={p} billing={billing} />
                    ))}
                </div>
                <div className="pr2-pricing-rows">
                    {[free, unlimited].map((p) => (
                        <SmallPlanRow key={p.id} plan={p} billing={billing} />
                    ))}
                </div>
            </div>
        </section>
    );
}

function BillingToggle({ value, onChange }: { value: Billing; onChange: (b: Billing) => void }) {
    return (
        <div className="pr2-bt">
            {(["monthly", "annual"] as const).map((v) => (
                <button key={v} onClick={() => onChange(v)} className={`pr2-bt-btn ${value === v ? "pr2-bt-on" : ""}`}>
                    {v === "monthly" ? "Monthly" : "Annual"}
                    {v === "annual" && (
                        <span className={`pr2-bt-save pr2-font-mono ${value === "annual" ? "pr2-bt-save-on" : ""}`}>−20%</span>
                    )}
                </button>
            ))}
        </div>
    );
}

function PlanCard({ plan, billing }: { plan: Plan; billing: Billing }) {
    const monthly = billing === "monthly" ? plan.monthly : plan.annual;
    const isFree = plan.id === "free";

    return (
        <div className={`pr2-plan ${plan.highlight ? "pr2-plan-hl" : ""}`}>
            {plan.badge && <div className="pr2-plan-badge pr2-font-mono">{plan.badge}</div>}
            <div className="pr2-plan-name">{plan.name}</div>
            <p className="pr2-plan-tag">{plan.tagline}</p>
            <div className="pr2-plan-price-block">
                {isFree ? (
                    <>
                        <span className="pr2-h-display pr2-plan-price">€0</span>
                        <div className="pr2-plan-bill">forever</div>
                    </>
                ) : (
                    <>
                        <div className="pr2-plan-price-row">
                            <span className="pr2-h-display pr2-plan-price">€{Number.isInteger(monthly) ? monthly : monthly.toFixed(2)}</span>
                            <span className="pr2-plan-per">/mo</span>
                        </div>
                        <div className="pr2-plan-bill">
                            {billing === "annual" ? `€${plan.annualTotal} billed yearly` : "billed monthly"}
                        </div>
                    </>
                )}
            </div>
            <div className="pr2-plan-meta">
                <div className="pr2-plan-meta-row">
                    <span>Credits</span>
                    <span className="pr2-font-mono pr2-plan-meta-val">{plan.quota}<span className="pr2-plan-meta-unit"> {plan.quotaUnit}</span></span>
                </div>
                <div className="pr2-plan-meta-row">
                    <span>Sites</span>
                    <span className="pr2-plan-meta-val">{plan.sites}</span>
                </div>
            </div>
            <ul className="pr2-plan-feats">
                {plan.features.map((f) => (
                    <li key={f}>
                        <span className="pr2-feat-check"><CheckIcon /></span>
                        {f}
                    </li>
                ))}
            </ul>
            <Link href={activateHref(plan.id, billing)} className={`pr2-btn ${plan.highlight ? "pr2-btn-primary" : "pr2-btn-ghost"} pr2-plan-cta`}>
                {plan.cta} <ArrowIcon />
            </Link>
        </div>
    );
}

function SmallPlanRow({ plan, billing }: { plan: Plan; billing: Billing }) {
    const monthly = billing === "monthly" ? plan.monthly : plan.annual;
    const isFree = plan.id === "free";
    return (
        <div className="pr2-smallrow">
            <div className="pr2-smallrow-col">
                <div className="pr2-smallrow-name">{plan.name}</div>
                <div className="pr2-smallrow-tag">{plan.tagline}</div>
            </div>
            <div className="pr2-smallrow-meta pr2-font-mono">
                <span className="pr2-smallrow-quota">{plan.quota}</span> {plan.quotaUnit} · {plan.sites}
            </div>
            <div className="pr2-smallrow-price">
                {isFree ? "€0" : `€${Number.isInteger(monthly) ? monthly : monthly.toFixed(2)}/mo`}
            </div>
            <Link href={activateHref(plan.id, billing)} className="pr2-btn pr2-btn-ghost pr2-btn-sm">
                {plan.cta} <ArrowIcon />
            </Link>
        </div>
    );
}

function FAQ({ openIdx, onToggle }: { openIdx: number; onToggle: (i: number) => void }) {
    return (
        <section id="faq" className="pr2-faq">
            <div className="pr2-container-sm">
                <div className="pr2-section-head">
                    <span className="pr2-eyebrow">FAQ</span>
                    <h2 className="pr2-h-display pr2-section-h">Frequently asked.</h2>
                </div>
                <div>
                    {FAQS.map((f, i) => (
                        <div key={i} className="pr2-faq-item">
                            <button onClick={() => onToggle(i)} className="pr2-faq-q">
                                <span>{f.q}</span>
                                <span className={`pr2-faq-plus ${openIdx === i ? "pr2-faq-plus-open" : ""}`}>
                                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 2V10M2 6H10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                                </span>
                            </button>
                            <div className={`pr2-faq-a ${openIdx === i ? "pr2-faq-a-open" : ""}`}>
                                <p>{f.a}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function FinalCTA() {
    return (
        <section className="pr2-final">
            <div className="pr2-container pr2-final-inner">
                <h2 className="pr2-h-display pr2-final-h">
                    30 seconds to install.{" "}
                    <span className="pr2-font-serif pr2-final-h-accent">Thirty days to change your mind.</span>
                </h2>
                <p className="pr2-final-lead">
                    Activate the free plan now. Convert your first 250 images before lunch.
                </p>
                <div className="pr2-final-ctas">
                    <Link href="/webp/activate?plan=free" className="pr2-btn pr2-btn-final-primary">Start free <ArrowIcon /></Link>
                    <a href="https://wordpress.org/plugins/tempaloo-webp/" className="pr2-btn pr2-btn-final-ghost">Read the docs</a>
                </div>
            </div>
        </section>
    );
}

function Footer() {
    return (
        <footer className="pr2-footer">
            <div className="pr2-container pr2-footer-inner">
                <div className="pr2-footer-brand">
                    <Logo />
                    <p>© {new Date().getFullYear()} Tempaloo. Made with care for WordPress creators.</p>
                </div>
                <div className="pr2-footer-cols">
                    <div>
                        <div className="pr2-footer-col-h">PRODUCT</div>
                        <div className="pr2-footer-col">
                            <a href="#pricing">Pricing</a>
                            <a href="#faq">FAQ</a>
                            <a href="#" title="Coming soon">Changelog</a>
                            <a href="#" title="Coming soon">Status</a>
                        </div>
                    </div>
                    <div>
                        <div className="pr2-footer-col-h">TEMPALOO</div>
                        <div className="pr2-footer-col">
                            <Link href="/webp" className="pr2-footer-inline">
                                WebP <span className="pr2-footer-tag pr2-font-mono pr2-footer-tag-live">· LIVE</span>
                            </Link>
                            <a href="#" className="pr2-footer-inline pr2-footer-inline-muted">
                                Templates <span className="pr2-footer-tag pr2-font-mono">· SOON</span>
                            </a>
                            <a href="#" title="Coming soon">Blog</a>
                        </div>
                    </div>
                    <div>
                        <div className="pr2-footer-col-h">LEGAL</div>
                        <div className="pr2-footer-col">
                            <a href="#" title="Coming soon">Privacy</a>
                            <a href="#" title="Coming soon">Terms</a>
                            <a href="#" title="Coming soon">Refunds</a>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap');

.pr2-root {
  --pr2-bg: #FFFFFF;
  --pr2-bg-2: #FAFAFA;
  --pr2-surface: #FFFFFF;
  --pr2-ink: #0A0A0A;
  --pr2-ink-2: #404040;
  --pr2-ink-3: #8F8F8F;
  --pr2-line: rgba(0, 0, 0, 0.06);
  --pr2-line-2: rgba(0, 0, 0, 0.1);
  --pr2-accent-wash: #F5F5F5;
  --pr2-success: #17C964;
  --pr2-danger: #E5484D;
  color-scheme: light;
  position: relative; z-index: 20;
  min-height: 100vh;
  background: var(--pr2-bg);
  color: var(--pr2-ink);
  font-family: 'Geist', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 15px; line-height: 1.55; letter-spacing: -0.003em;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  margin-top: -1rem;
}
.pr2-root[data-theme="dark"] {
  --pr2-bg: #0A0A0A;
  --pr2-bg-2: #111111;
  --pr2-surface: #0A0A0A;
  --pr2-ink: #EDEDED;
  --pr2-ink-2: #A1A1A1;
  --pr2-ink-3: #666666;
  --pr2-line: rgba(255, 255, 255, 0.08);
  --pr2-line-2: rgba(255, 255, 255, 0.14);
  --pr2-accent-wash: #171717;
  color-scheme: dark;
}
.pr2-root * { box-sizing: border-box; }
.pr2-root a { color: inherit; text-decoration: none; }
.pr2-root button { font-family: inherit; }
.pr2-root ::selection { background: var(--pr2-ink); color: var(--pr2-bg); }
.pr2-root :focus-visible { outline: 2px solid var(--pr2-ink); outline-offset: 2px; border-radius: 4px; }

.pr2-container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
.pr2-container-sm { max-width: 880px; margin: 0 auto; padding: 0 24px; }

.pr2-h-display { font-family: 'Geist', sans-serif; letter-spacing: -0.035em; font-weight: 600; }
.pr2-font-serif { font-family: 'Instrument Serif', serif; font-weight: 400; letter-spacing: -0.01em; font-style: italic; }
.pr2-font-mono { font-family: 'Geist Mono', ui-monospace, monospace; }
.pr2-mono-sm { font-size: 13px; }
.pr2-text-ink { color: var(--pr2-ink); font-weight: 500; }
.pr2-text-danger { color: var(--pr2-danger); }

.pr2-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 40px; padding: 0 16px;
  border-radius: 8px;
  font-size: 14px; font-weight: 500;
  letter-spacing: -0.01em;
  border: 1px solid transparent; cursor: pointer;
  transition: background .15s ease, color .15s ease, border-color .15s ease, transform .15s ease;
  white-space: nowrap; font-family: inherit;
}
.pr2-btn-primary { background: var(--pr2-ink); color: var(--pr2-bg); border-color: var(--pr2-ink); }
.pr2-btn-primary:hover { background: var(--pr2-ink-2); border-color: var(--pr2-ink-2); }
.pr2-btn-ghost { background: var(--pr2-bg); color: var(--pr2-ink); border-color: var(--pr2-line-2); }
.pr2-btn-ghost:hover { background: var(--pr2-bg-2); border-color: var(--pr2-ink-3); }
.pr2-btn-sm { height: 34px; font-size: 13.5px; padding: 0 14px; border-radius: 7px; }
.pr2-icon-btn { width: 34px; padding: 0 10px; height: 34px; border-radius: 7px; }

.pr2-nav { position: sticky; top: 0; z-index: 50; background: transparent; border-bottom: 1px solid transparent; transition: background .2s, border-color .2s; }
.pr2-nav-scrolled { background: color-mix(in oklab, var(--pr2-bg) 80%, transparent); backdrop-filter: blur(16px) saturate(180%); -webkit-backdrop-filter: blur(16px) saturate(180%); border-bottom-color: var(--pr2-line); }
.pr2-nav-inner { display: flex; align-items: center; justify-content: space-between; height: 60px; }
.pr2-nav-left { display: flex; align-items: center; gap: 28px; }
.pr2-nav-logo { display: flex; align-items: center; }
.pr2-nav-links { display: flex; gap: 4px; }
.pr2-nav-links a { font-size: 14px; color: var(--pr2-ink-2); padding: 6px 10px; font-weight: 450; border-radius: 6px; transition: color .15s, background .15s; }
.pr2-nav-links a:hover { color: var(--pr2-ink); background: var(--pr2-bg-2); }
.pr2-nav-right { display: flex; align-items: center; gap: 6px; }
.pr2-nav-signin { font-size: 14px; color: var(--pr2-ink-2); padding: 6px 12px; font-weight: 450; transition: color .15s; }
.pr2-nav-signin:hover { color: var(--pr2-ink); }

.pr2-logo { display: inline-flex; align-items: center; gap: 10px; color: var(--pr2-ink); }
.pr2-logo-text { font-weight: 500; font-size: 14.5px; letter-spacing: -0.015em; color: var(--pr2-ink); }
.pr2-logo-sub { color: var(--pr2-ink-3); }

.pr2-pill { display: inline-flex; align-items: center; gap: 7px; padding: 5px 11px; border-radius: 999px; background: var(--pr2-bg); color: var(--pr2-ink-2); border: 1px solid var(--pr2-line-2); font-size: 12.5px; font-weight: 450; letter-spacing: -0.005em; }
.pr2-pill-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--pr2-success); box-shadow: 0 0 0 3px rgba(23, 201, 100, 0.18); }

.pr2-hero { padding: 80px 0 96px; position: relative; overflow: hidden; }
.pr2-hero-inner { position: relative; text-align: center; }
.pr2-hero-h1 { font-size: clamp(44px, 7.2vw, 88px); line-height: 1.02; letter-spacing: -0.04em; font-weight: 600; margin: 28px auto 22px; max-width: 820px; color: var(--pr2-ink); }
.pr2-hero-h1-accent { color: var(--pr2-ink-3); font-weight: 400; }
.pr2-hero-lead { font-size: 18px; line-height: 1.55; color: var(--pr2-ink-2); max-width: 560px; margin: 0 auto 36px; text-wrap: balance; letter-spacing: -0.01em; }
.pr2-hero-ctas { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-bottom: 24px; }
.pr2-hero-sub { font-size: 13px; color: var(--pr2-ink-3); }
.pr2-hero-viz { margin-top: 72px; position: relative; }
.pr2-hero-caption { text-align: center; margin-top: 16px; font-size: 12.5px; color: var(--pr2-ink-3); font-family: 'Geist Mono', ui-monospace, monospace; letter-spacing: -0.01em; }

.pr2-demo { width: 100%; max-width: 960px; margin: 0 auto; background: var(--pr2-surface); border: 1px solid var(--pr2-line-2); border-radius: 12px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 24px 48px -24px rgba(0,0,0,0.18); font-family: 'Geist', sans-serif; }
.pr2-demo-chrome { display: flex; align-items: center; gap: 8px; padding: 11px 14px; border-bottom: 1px solid var(--pr2-line); background: var(--pr2-bg-2); }
.pr2-traffic { width: 10px; height: 10px; border-radius: 50%; }
.pr2-traffic-red { background: #FF5F57; }
.pr2-traffic-yellow { background: #FEBC2E; }
.pr2-traffic-green { background: #28C840; }
.pr2-demo-url { flex: 1; text-align: center; font-size: 11.5px; font-family: 'Geist Mono', monospace; color: var(--pr2-ink-3); letter-spacing: -0.01em; }
.pr2-demo-grid { display: grid; grid-template-columns: 280px 1fr; }
.pr2-demo-left { padding: 20px; border-right: 1px solid var(--pr2-line); background: var(--pr2-bg-2); }
.pr2-demo-right { padding: 20px; min-height: 340px; }
.pr2-demo-section-label { font-size: 10.5px; font-family: 'Geist Mono', monospace; color: var(--pr2-ink-3); letter-spacing: 0.02em; margin-bottom: 10px; }
.pr2-demo-img { aspect-ratio: 4 / 3; border-radius: 8px; overflow: hidden; border: 1px solid var(--pr2-line-2); margin-bottom: 12px; }
.pr2-demo-filename { font-size: 12.5px; font-weight: 500; color: var(--pr2-ink); letter-spacing: -0.01em; margin-bottom: 2px; }
.pr2-demo-filemeta { font-size: 11.5px; color: var(--pr2-ink-3); font-family: 'Geist Mono', monospace; }
.pr2-demo-credit { margin-top: 16px; padding: 10px 12px; border: 1px solid var(--pr2-ink); border-radius: 8px; background: var(--pr2-bg); transition: opacity .3s, transform .3s; }
.pr2-demo-credit-label { font-size: 10px; font-family: 'Geist Mono', monospace; color: var(--pr2-ink-3); letter-spacing: 0.02em; margin-bottom: 2px; }
.pr2-demo-credit-row { display: flex; align-items: baseline; gap: 6px; }
.pr2-demo-credit-num { font-size: 22px; font-weight: 500; letter-spacing: -0.04em; font-family: 'Geist Mono', monospace; color: var(--pr2-ink); }
.pr2-demo-credit-sub { font-size: 11.5px; color: var(--pr2-ink-3); }
.pr2-demo-right-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px; gap: 12px; flex-wrap: wrap; }
.pr2-demo-state { font-size: 10.5px; font-family: 'Geist Mono', monospace; color: var(--pr2-ink-3); letter-spacing: 0.02em; transition: color .2s; }
.pr2-demo-state-done { color: var(--pr2-success); }
.pr2-demo-rows { display: flex; flex-direction: column; gap: 6px; }
.pr2-demo-row { display: grid; grid-template-columns: 170px 1fr 80px 44px; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 6px; border: 1px solid transparent; transition: all .25s ease; font-size: 12.5px; }
.pr2-row-webp { background: var(--pr2-bg-2); }
.pr2-row-converting { border-color: var(--pr2-ink); }
.pr2-demo-row-label { font-family: 'Geist Mono', monospace; color: var(--pr2-ink); letter-spacing: -0.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pr2-demo-row-bar { height: 4px; border-radius: 999px; background: var(--pr2-line); position: relative; overflow: hidden; }
.pr2-demo-row-bar-fill { position: absolute; left: 0; top: 0; bottom: 0; transition: width .1s linear, background .2s; }
.pr2-demo-row-size { font-family: 'Geist Mono', monospace; text-align: right; color: var(--pr2-ink); font-variant-numeric: tabular-nums; }
.pr2-demo-row-format { font-family: 'Geist Mono', monospace; font-size: 10.5px; font-weight: 500; padding: 2px 6px; border-radius: 4px; text-align: center; background: var(--pr2-bg-2); color: var(--pr2-ink-3); transition: background .2s, color .2s; }
.pr2-fmt-webp { background: var(--pr2-ink); color: var(--pr2-bg); }
.pr2-demo-totals { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--pr2-line); display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.pr2-demo-totals-row { display: flex; gap: 18px; font-size: 12px; }
.pr2-demo-total-val { font-family: 'Geist Mono', monospace; font-weight: 500; color: var(--pr2-ink); transition: color .3s; }
.pr2-demo-total-done { color: var(--pr2-success); }
.pr2-demo-arrow { font-size: 14px; color: var(--pr2-ink-3); align-self: flex-end; padding-bottom: 1px; }
.pr2-demo-saved { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 6px; background: var(--pr2-bg-2); color: var(--pr2-ink-3); font-size: 12px; font-weight: 500; font-family: 'Geist Mono', monospace; letter-spacing: -0.01em; transition: all .3s; }
.pr2-demo-saved-on { background: var(--pr2-ink); color: var(--pr2-bg); }
.pr2-demo-saved-sub { opacity: 0.7; }
@media (max-width: 760px) {
  .pr2-demo-grid { grid-template-columns: 1fr; }
  .pr2-demo-left { border-right: none; border-bottom: 1px solid var(--pr2-line); }
}

.pr2-statsbar { border-top: 1px solid var(--pr2-line); border-bottom: 1px solid var(--pr2-line); }
.pr2-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.pr2-stat { padding: 32px 20px; text-align: center; border-right: 1px solid var(--pr2-line); }
.pr2-stat:last-child { border-right: none; }
.pr2-stat-k { font-size: 32px; font-weight: 500; letter-spacing: -0.04em; color: var(--pr2-ink); margin-bottom: 4px; }
.pr2-stat-v { font-size: 12.5px; color: var(--pr2-ink-3); font-family: 'Geist Mono', monospace; letter-spacing: -0.01em; }

.pr2-trap { padding: 120px 0; border-top: 1px solid var(--pr2-line); border-bottom: 1px solid var(--pr2-line); background: var(--pr2-bg-2); }
.pr2-section-head { max-width: 640px; margin: 0 auto 48px; text-align: center; }
.pr2-eyebrow { font-family: 'Geist Mono', monospace; font-size: 11px; font-weight: 400; letter-spacing: 0.02em; color: var(--pr2-ink-3); }
.pr2-section-h { font-size: clamp(36px, 4.8vw, 60px); font-weight: 600; letter-spacing: -0.04em; margin: 10px 0 14px; line-height: 1.05; color: var(--pr2-ink); }
.pr2-section-h-accent { color: var(--pr2-ink-3); }
.pr2-section-lead { font-size: 16px; color: var(--pr2-ink-2); line-height: 1.55; letter-spacing: -0.01em; }
.pr2-trap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; max-width: 960px; margin: 0 auto; }
.pr2-trap-card { padding: 24px; border: 1px solid var(--pr2-line); border-radius: 10px; background: var(--pr2-surface); }
.pr2-trap-card-highlight { border-color: var(--pr2-ink); }
.pr2-trap-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
.pr2-trap-name { font-weight: 500; font-size: 14px; color: var(--pr2-ink); }
.pr2-trap-sub { font-size: 11px; color: var(--pr2-ink-3); }
.pr2-trap-bundled { color: var(--pr2-ink); font-weight: 500; }
.pr2-trap-eyebrow { font-size: 12.5px; color: var(--pr2-ink-3); margin-bottom: 20px; }
.pr2-trap-boxes { display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px; margin-bottom: 20px; }
.pr2-trap-boxes-bundle { margin: 0 -4px 20px; padding: 0; border: 1px dashed transparent; border-radius: 6px; transition: padding .3s, border-color .3s; }
.pr2-trap-boxes-bundle-on { padding: 4px; border-color: var(--pr2-ink); }
.pr2-trap-box { aspect-ratio: 1; border-radius: 4px; background: var(--pr2-bg-2); border: 1px solid var(--pr2-line); opacity: 0.5; transform: scale(0.92); transition: all .3s; }
.pr2-trap-box-on { background: var(--pr2-ink); opacity: 1; transform: scale(1); }
.pr2-trap-bars { display: flex; gap: 4px; margin-bottom: 16px; }
.pr2-trap-bar { flex: 1; height: 3px; border-radius: 999px; background: var(--pr2-bg-2); transition: background .2s; }
.pr2-trap-bar-danger { background: var(--pr2-danger); }
.pr2-trap-bar-ink { background: var(--pr2-ink); }
.pr2-trap-footer { display: flex; justify-content: space-between; align-items: baseline; padding-top: 14px; border-top: 1px solid var(--pr2-line); font-size: 12px; color: var(--pr2-ink-3); }
.pr2-trap-count { font-size: 30px; font-weight: 500; letter-spacing: -0.04em; line-height: 1; color: var(--pr2-ink); }
.pr2-trap-count-danger { color: var(--pr2-danger); }
.pr2-trap-coda { max-width: 580px; margin: 40px auto 0; text-align: center; font-size: 15px; color: var(--pr2-ink-2); line-height: 1.6; letter-spacing: -0.01em; }
@media (max-width: 860px) {
  .pr2-trap-grid { grid-template-columns: 1fr; }
}

.pr2-pricing { padding: 112px 0 96px; }
.pr2-billing-toggle-wrap { margin-top: 24px; }
.pr2-bt { display: inline-flex; padding: 3px; background: var(--pr2-bg-2); border: 1px solid var(--pr2-line); border-radius: 8px; }
.pr2-bt-btn { padding: 6px 14px; border: none; background: transparent; color: var(--pr2-ink-3); border-radius: 6px; font-size: 13px; font-weight: 450; letter-spacing: -0.01em; cursor: pointer; transition: all .15s; display: inline-flex; align-items: center; gap: 6px; font-family: inherit; }
.pr2-bt-on { background: var(--pr2-surface); color: var(--pr2-ink); box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 0 0 1px var(--pr2-line-2); }
.pr2-bt-save { font-size: 10.5px; padding: 1px 5px; border-radius: 4px; background: transparent; color: var(--pr2-ink-3); font-weight: 500; }
.pr2-bt-save-on { background: var(--pr2-accent-wash); color: var(--pr2-ink); }

.pr2-pricing-featured { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; max-width: 1080px; margin: 0 auto 12px; }
.pr2-pricing-rows { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; max-width: 1080px; margin: 0 auto; }
.pr2-plan { position: relative; background: var(--pr2-surface); border: 1px solid var(--pr2-line); border-radius: 10px; padding: 24px 22px; display: flex; flex-direction: column; height: 100%; }
.pr2-plan-hl { border-color: var(--pr2-ink); }
.pr2-plan-badge { position: absolute; top: -10px; right: 18px; background: var(--pr2-ink); color: var(--pr2-bg); padding: 3px 9px; border-radius: 4px; font-size: 10.5px; font-weight: 500; letter-spacing: 0.01em; }
.pr2-plan-name { font-size: 14px; font-weight: 500; margin-bottom: 4px; color: var(--pr2-ink); }
.pr2-plan-tag { font-size: 12.5px; margin: 0 0 20px; color: var(--pr2-ink-3); min-height: 32px; line-height: 1.5; }
.pr2-plan-price-block { margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid var(--pr2-line); }
.pr2-plan-price-row { display: flex; align-items: baseline; gap: 4px; }
.pr2-plan-price { font-size: 34px; font-weight: 500; letter-spacing: -0.04em; line-height: 1; color: var(--pr2-ink); }
.pr2-plan-per { font-size: 13px; color: var(--pr2-ink-3); }
.pr2-plan-bill { font-size: 12px; color: var(--pr2-ink-3); margin-top: 4px; }
.pr2-plan-meta { margin-bottom: 20px; }
.pr2-plan-meta-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; color: var(--pr2-ink-3); }
.pr2-plan-meta-row + .pr2-plan-meta-row { margin-top: 6px; }
.pr2-plan-meta-val { font-size: 14px; font-weight: 500; color: var(--pr2-ink); letter-spacing: -0.01em; }
.pr2-plan-meta-unit { color: var(--pr2-ink-3); font-weight: 400; }
.pr2-plan-feats { margin: 0 0 22px; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; flex: 1; }
.pr2-plan-feats li { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; line-height: 1.5; color: var(--pr2-ink-2); }
.pr2-feat-check { color: var(--pr2-ink); margin-top: 3px; flex-shrink: 0; }
.pr2-plan-cta { width: 100%; height: 36px; }

.pr2-smallrow { padding: 18px 20px; border: 1px solid var(--pr2-line); background: var(--pr2-surface); border-radius: 10px; display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
.pr2-smallrow-col { flex: 1 1 180px; min-width: 160px; }
.pr2-smallrow-name { font-weight: 500; font-size: 14px; margin-bottom: 2px; color: var(--pr2-ink); }
.pr2-smallrow-tag { font-size: 12.5px; color: var(--pr2-ink-3); }
.pr2-smallrow-meta { font-size: 12.5px; color: var(--pr2-ink-3); flex: 1 1 180px; letter-spacing: -0.01em; }
.pr2-smallrow-quota { color: var(--pr2-ink); }
.pr2-smallrow-price { font-size: 14px; color: var(--pr2-ink); font-weight: 500; min-width: 90px; }

.pr2-faq { padding: 120px 0; }
.pr2-faq-item { border-bottom: 1px solid var(--pr2-line); }
.pr2-faq-q { width: 100%; text-align: left; background: transparent; border: none; padding: 20px 0; display: flex; align-items: center; justify-content: space-between; gap: 20px; cursor: pointer; color: var(--pr2-ink); font-family: inherit; }
.pr2-faq-q > span:first-child { font-size: 16px; font-weight: 500; letter-spacing: -0.02em; line-height: 1.4; }
.pr2-faq-plus { width: 24px; height: 24px; border-radius: 6px; border: 1px solid var(--pr2-line-2); display: grid; place-items: center; flex-shrink: 0; transition: all .2s; color: var(--pr2-ink-2); }
.pr2-faq-plus-open { transform: rotate(45deg); color: var(--pr2-ink); }
.pr2-faq-a { overflow: hidden; max-height: 0; opacity: 0; transition: max-height .3s ease, opacity .2s, padding .2s; padding-bottom: 0; }
.pr2-faq-a-open { max-height: 400px; opacity: 1; padding-bottom: 22px; }
.pr2-faq-a p { margin: 0; font-size: 14.5px; line-height: 1.65; color: var(--pr2-ink-2); max-width: 680px; letter-spacing: -0.01em; }

.pr2-final { padding: 112px 0; background: var(--pr2-ink); color: var(--pr2-bg); position: relative; overflow: hidden; }
.pr2-final-inner { position: relative; text-align: center; }
.pr2-final-h { font-size: clamp(40px, 5.2vw, 68px); font-weight: 600; letter-spacing: -0.04em; margin: 0 0 20px; line-height: 1.04; color: var(--pr2-bg); }
.pr2-final-h-accent { color: var(--pr2-ink-3); font-weight: 400; }
.pr2-final-lead { font-size: 17px; color: rgba(237, 237, 237, 0.6); max-width: 500px; margin: 0 auto 30px; letter-spacing: -0.01em; }
.pr2-root[data-theme="dark"] .pr2-final-lead { color: rgba(10, 10, 10, 0.6); }
.pr2-final-ctas { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.pr2-btn-final-primary { height: 42px; padding: 0 20px; font-size: 14px; background: var(--pr2-bg); color: var(--pr2-ink); border: none; }
.pr2-btn-final-primary:hover { filter: brightness(0.96); }
.pr2-btn-final-ghost { height: 42px; padding: 0 20px; font-size: 14px; background: rgba(255,255,255,0.08); color: var(--pr2-bg); border: 1px solid rgba(255,255,255,0.22); }
.pr2-root[data-theme="dark"] .pr2-btn-final-ghost { background: rgba(0,0,0,0.08); color: var(--pr2-ink); border-color: rgba(0,0,0,0.22); }
.pr2-btn-final-ghost:hover { background: rgba(255,255,255,0.14); }

.pr2-footer { padding: 56px 0; border-top: 1px solid var(--pr2-line); background: var(--pr2-bg); }
.pr2-footer-inner { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 32px; }
.pr2-footer-brand { max-width: 320px; }
.pr2-footer-brand p { font-size: 12.5px; color: var(--pr2-ink-3); margin: 14px 0 0; line-height: 1.55; }
.pr2-footer-cols { display: flex; gap: 56px; font-size: 13px; flex-wrap: wrap; }
.pr2-footer-col-h { font-size: 11px; letter-spacing: 0.02em; color: var(--pr2-ink-3); margin-bottom: 12px; font-family: 'Geist Mono', monospace; }
.pr2-footer-col { display: flex; flex-direction: column; gap: 10px; }
.pr2-footer-col a { color: var(--pr2-ink-2); transition: color .15s; }
.pr2-footer-col a:hover { color: var(--pr2-ink); }
.pr2-footer-inline { display: inline-flex; align-items: center; gap: 6px; }
.pr2-footer-inline-muted { color: var(--pr2-ink-3) !important; }
.pr2-footer-tag { font-size: 10px; }
.pr2-footer-tag-live { color: var(--pr2-success); }

@media (max-width: 720px) {
  .pr2-nav-links { display: none; }
}
`;
