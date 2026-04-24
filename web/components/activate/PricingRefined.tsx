"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PLANS, type Plan } from "@/lib/plans";
import type { Billing } from "@/components/pricing/BillingToggle";

type PlanCode = Plan["code"];

interface Props {
    billing: Billing;
    onBillingChange: (b: Billing) => void;
    onChoose: (code: PlanCode) => void;
    authedEmail?: string | null;
}

const FAQ_ITEMS = [
    {
        q: "How do credits work?",
        a: "One credit = one image upload, regardless of how many thumbnail sizes WordPress generates. Your theme might produce 5 thumbnails per image — that's still 1 credit. We don't count visits or bandwidth.",
    },
    {
        q: "What happens if I go over my monthly limit?",
        a: "New uploads are served as their original (no conversion) until your monthly reset, so your site never breaks. You can upgrade any time for instant access to more credits.",
    },
    {
        q: "Can I switch plans mid-cycle?",
        a: "Yes — prorated to the day. Upgrades take effect immediately, downgrades at the end of your current cycle.",
    },
    {
        q: "Do unused credits roll over?",
        a: "Yes, unused credits roll over for 30 days, capped at one full plan's worth. Free tier credits reset monthly.",
    },
    {
        q: "Is there a free trial on paid plans?",
        a: "All paid plans include a 7-day trial, no card required. You'll get the full credit quota for that tier to test with real traffic.",
    },
    {
        q: "What about AVIF?",
        a: "Included from Starter up. We serve the best format each browser accepts via a single <picture> tag — no JS, no layout shift.",
    },
];

export function PricingRefined({ billing, onBillingChange, onChoose, authedEmail }: Props) {
    const [usage, setUsage] = useState(4000);
    const [openFaq, setOpenFaq] = useState(0);
    const period = billing;

    const recoId: PlanCode = useMemo(() => {
        if (usage <= 250) return "free";
        if (usage <= 5000) return "starter";
        if (usage <= 25000) return "growth";
        if (usage <= 150000) return "business";
        return "unlimited";
    }, [usage]);

    const [heroState, setHeroState] = useState({
        stage: "Reading PNG", pct: "0%", ribbon: "PNG · 2.4 MB", isWebp: false,
    });
    useEffect(() => {
        let raf = 0;
        const start = performance.now();
        const tick = (t: number) => {
            const p = ((t - start) % 8000) / 8000;
            let s;
            if (p < 0.10)      s = { stage: "Reading PNG",   pct: "0%",                                       ribbon: "PNG · 2.4 MB",  isWebp: false };
            else if (p < 0.42) s = { stage: "Encoding WebP", pct: Math.round(((p - 0.10) / 0.32) * 100) + "%", ribbon: "PNG · 2.4 MB",  isWebp: false };
            else if (p < 0.52) s = { stage: "Optimizing",    pct: "100%",                                     ribbon: "WebP · 312 KB", isWebp: true  };
            else if (p < 0.85) s = { stage: "Complete",      pct: "−87%",                                     ribbon: "WebP · 312 KB", isWebp: true  };
            else               s = { stage: "Next image…",   pct: "—",                                        ribbon: "PNG · 2.4 MB",  isWebp: false };
            setHeroState((prev) =>
                prev.stage === s.stage && prev.pct === s.pct && prev.isWebp === s.isWebp ? prev : s
            );
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, []);

    const fillPct = Math.pow(usage / 500_000, 0.35) * 100;

    return (
        <div className="pr1-root">
            <style dangerouslySetInnerHTML={{ __html: pricingRefinedCss }} />

            <header className="pr1-hdr">
                <Link href="/webp" className="pr1-logo">
                    <span className="pr1-logo-mark" />
                    Tempaloo
                </Link>
                <nav className="pr1-nav">
                    <Link href="/webp">Product</Link>
                    <Link href="#features">Features</Link>
                    <Link href="/webp/activate" className="active">Pricing</Link>
                    <Link href="/webp#faq">Docs</Link>
                </nav>
                <div className="pr1-hdr-r">
                    {authedEmail ? (
                        <Link href="/webp/dashboard" className="pr1-sign">Dashboard</Link>
                    ) : (
                        <Link href="/webp/activate" className="pr1-sign">Sign in</Link>
                    )}
                    <button className="pr1-get" onClick={() => onChoose("free")}>Get started →</button>
                </div>
            </header>

            <section className="pr1-heroblock">
                <div className="pr1-hero-bg" aria-hidden>
                    <div className="pr1-hero-grid" />
                    <div className="pr1-orb pr1-orb-1" />
                    <div className="pr1-orb pr1-orb-2" />
                    <div className="pr1-orb pr1-orb-3" />
                </div>

                <div className="pr1-hero-l">
                    <div className="pr1-hero-badge">
                        <span className="pr1-dot" />
                        <span>New · AVIF + WebP, single credit</span>
                        <span className="pr1-arr">→</span>
                    </div>
                    <h1 className="pr1-hero-h1">
                        Images <em>80%</em><br />
                        smaller.<br />
                        Pages <span className="pr1-word-strike">sluggish</span> <em>flying.</em>
                    </h1>
                    <p className="pr1-hero-lead">
                        Drop-in WebP + AVIF conversion for WordPress. One credit per image — every thumbnail size included.
                    </p>
                    <div className="pr1-hero-ctas">
                        <button className="pr1-hc-primary" onClick={() => onChoose("free")}>
                            Start free — 250 images
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
                        </button>
                        <a className="pr1-hc-ghost" href="#plans">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
                            See plans
                        </a>
                    </div>
                    <div className="pr1-hero-stats">
                        <div className="pr1-hero-stat"><div className="pr1-statnum">12<em>M+</em></div><div className="pr1-statlbl">Images converted</div></div>
                        <div className="pr1-hero-stat"><div className="pr1-statnum">78<em>%</em></div><div className="pr1-statlbl">Avg size reduction</div></div>
                        <div className="pr1-hero-stat"><div className="pr1-statnum">1.4<em>s</em></div><div className="pr1-statlbl">Faster LCP</div></div>
                    </div>
                </div>

                <div className="pr1-hero-viz" aria-hidden>
                    <div className="pr1-viz-frame" />
                    <div className="pr1-viz-chrome">
                        <span className="pr1-cd a" /><span className="pr1-cd b" /><span className="pr1-cd c" />
                        <span className="pr1-path">~/assets/hero-image · converter.webp</span>
                    </div>

                    <div className="pr1-img-stage">
                        <div
                            className="pr1-img-ribbon"
                            style={{ color: heroState.isWebp ? "var(--accent)" : "#fdba74" }}
                        >
                            {heroState.ribbon}
                        </div>
                    </div>

                    <span className="pr1-byte">01101</span>
                    <span className="pr1-byte">A7F2</span>
                    <span className="pr1-byte">0xFF</span>
                    <span className="pr1-byte">1001</span>
                    <span className="pr1-byte">C4E0</span>

                    <div className="pr1-thumbs">
                        <div className="pr1-thumb" /><div className="pr1-thumb" /><div className="pr1-thumb" /><div className="pr1-thumb" />
                    </div>

                    <div className="pr1-viz-pop">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                        Saved 87%
                    </div>

                    <div className="pr1-hud">
                        <div className="pr1-hud-top">
                            <b className="pr1-hud-stage">{heroState.stage}</b>
                            <span className="pr1-pct">{heroState.pct}</span>
                        </div>
                        <div className="pr1-hud-bar" />
                        <div className="pr1-hud-metrics">
                            <div className="pr1-hud-metric"><span>Input</span><b>2.4 MB</b></div>
                            <div className="pr1-hud-metric ok"><span>Output</span><b>312 KB</b></div>
                            <div className="pr1-hud-metric ok"><span>Quality</span><b>Lossless</b></div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="pr1-inner" id="plans">
                <section className="pr1-hero-plans">
                    <div className="pr1-eyebrow"><span className="pr1-dot" />Pricing</div>
                    <h2 className="pr1-plans-h">Pick your <em>plan.</em></h2>
                    <p className="pr1-sub">
                        One credit per image — all thumbnail sizes included. No visit counting. No surprise bills.
                    </p>
                </section>

                <div className="pr1-controls">
                    <div className="pr1-toggle" role="tablist">
                        <button data-on={period === "monthly"} onClick={() => onBillingChange("monthly")}>Monthly</button>
                        <button data-on={period === "annual"} onClick={() => onBillingChange("annual")}>
                            Annual <span className="pr1-save">−20%</span>
                        </button>
                    </div>
                </div>

                <div className="pr1-slider-wrap">
                    <div className="pr1-sl-head">
                        <span>Your monthly upload volume</span>
                        <b>{usage.toLocaleString()} images</b>
                    </div>
                    <input
                        className="pr1-sl"
                        type="range"
                        min={100}
                        max={500_000}
                        step={100}
                        value={usage}
                        onChange={(e) => setUsage(Number(e.target.value))}
                        style={{ "--fill": `${fillPct}%` } as React.CSSProperties}
                    />
                    <div className="pr1-sl-ticks">
                        <span>100</span><span>1k</span><span>10k</span><span>100k</span><span>500k</span>
                    </div>
                    <div className="pr1-sl-head pr1-sl-reco">
                        <span className="pr1-reco">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7" /></svg>
                            Recommended for you
                        </span>
                        <b className="pr1-reco-name">{recoId}</b>
                    </div>
                </div>

                <div className="pr1-grid">
                    {PLANS.map((p) => {
                        const isAnnual = period === "annual";
                        const monthlyAmt = isAnnual ? p.priceAnnual / 12 : p.priceMonthly;
                        const showPer = p.priceMonthly > 0;
                        const isReco = p.code === recoId;
                        const ctaStyle = p.highlight ? "primary" : p.code === "free" ? "ghost" : "outline";
                        return (
                            <div key={p.code} className={`pr1-card ${p.highlight ? "pr1-hl" : ""}`}>
                                {p.badge && <div className="pr1-badge">{p.badge}</div>}
                                {isReco && !p.badge && (
                                    <div className="pr1-badge pr1-badge-soft">Your fit</div>
                                )}
                                <div className="pr1-name">{p.name}</div>
                                <div className="pr1-tag">{p.tagline}</div>
                                <div className="pr1-price">
                                    {showPer ? (
                                        <>
                                            <span className="pr1-price-cur">€</span>
                                            <span className="pr1-price-amt">{formatAmount(monthlyAmt)}</span>
                                            <span className="pr1-price-per">/ mo</span>
                                        </>
                                    ) : (
                                        <span className="pr1-price-amt pr1-price-free">Free</span>
                                    )}
                                </div>
                                <div className="pr1-billed">
                                    {showPer && isAnnual
                                        ? `€${p.priceAnnual} billed yearly`
                                        : showPer ? "billed monthly" : "forever"}
                                </div>
                                <div className="pr1-meta">
                                    <div className="pr1-meta-big">
                                        {p.imagesLabel.replace("/ month", "").trim()}
                                    </div>
                                    <div className="pr1-meta-sm">{p.sites}</div>
                                </div>
                                <ul className="pr1-feats">
                                    {p.features.map((f) => (
                                        <li key={f} className="pr1-feat">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                                            <span>{f}</span>
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    type="button"
                                    className={`pr1-cta pr1-cta-${ctaStyle}`}
                                    onClick={() => onChoose(p.code)}
                                >
                                    {p.cta} →
                                </button>
                            </div>
                        );
                    })}
                </div>

                <div className="pr1-trust">
                    <div className="pr1-trust-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12c0 4.97-3.58 9-8 9s-8-4.03-8-9V5l8-3 8 3v7z" /><path d="M9 12l2 2 4-4" /></svg>
                        30-day money back
                    </div>
                    <div className="pr1-trust-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                        Cancel any time
                    </div>
                    <div className="pr1-trust-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                        Secure checkout (Freemius)
                    </div>
                    <div className="pr1-trust-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" /></svg>
                        EU-hosted (GDPR)
                    </div>
                </div>

                <section className="pr1-faq-wrap" id="faq">
                    <h2 className="pr1-faq-h">Common <em>questions.</em></h2>
                    {FAQ_ITEMS.map((f, i) => (
                        <div key={i} className="pr1-faq-item" data-open={openFaq === i}>
                            <button className="pr1-faq-q" onClick={() => setOpenFaq(openFaq === i ? -1 : i)}>
                                {f.q}
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                            </button>
                            <div className="pr1-faq-a">{f.a}</div>
                        </div>
                    ))}
                </section>
            </div>

            <section className="pr1-footer-cta">
                <div>
                    <h2>Start converting in <em>90 seconds.</em></h2>
                    <p>Drop in the WordPress plugin and activate your key. First 250 images on the house — no card.</p>
                </div>
                <div className="pr1-footer-cta-buttons">
                    <a href="#plans" className="pr1-cta pr1-cta-outline pr1-cta-inline">See plans</a>
                    <button className="pr1-cta pr1-cta-primary pr1-cta-inline" onClick={() => onChoose("free")}>Get started free →</button>
                </div>
            </section>
        </div>
    );
}

function formatAmount(eur: number): string {
    if (eur === 0) return "0";
    return eur % 1 === 0 ? String(Math.round(eur)) : eur.toFixed(2);
}

const pricingRefinedCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap');

.pr1-root{
  --accent:#10b981;
  --accent-grad:linear-gradient(135deg,#34d399 0%,#22d3ee 100%);
  --bg-0:#07070b;
  --bg-1:#0d0d14;
  --bg-2:#12121c;
  --line:rgba(255,255,255,.06);
  --line-strong:rgba(255,255,255,.12);
  --text-0:#f4f3ff;
  --text-1:#c7c5d9;
  --text-2:#8b89a0;
  --text-3:#5c5b72;
  font-family:'Inter Tight','Inter',system-ui,sans-serif;
  color:var(--text-0);
  background:
    radial-gradient(1200px 600px at 20% -10%, rgba(34,211,238,.08), transparent 60%),
    radial-gradient(900px 500px at 85% 10%, rgba(167,139,250,.08), transparent 60%),
    radial-gradient(1400px 700px at 50% 110%, rgba(16,185,129,.06), transparent 60%),
    var(--bg-0);
  min-height:100vh;padding:0 0 120px;
  letter-spacing:-0.01em;overflow:hidden;
  margin:-1rem auto 0;
}

.pr1-inner{padding:48px 64px 0;}

.pr1-hdr{
  position:sticky;top:12px;z-index:30;
  max-width:1400px;margin:12px auto 0;
  display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:32px;
  padding:10px 14px 10px 20px;
  background:rgba(13,13,20,.55);
  backdrop-filter:blur(24px) saturate(160%);
  -webkit-backdrop-filter:blur(24px) saturate(160%);
  border:.5px solid var(--line-strong);
  border-radius:999px;
  box-shadow:0 1px 0 rgba(255,255,255,.05) inset, 0 10px 40px rgba(0,0,0,.35);
}
.pr1-logo{display:inline-flex;align-items:center;gap:10px;font-weight:700;font-size:16px;letter-spacing:-0.02em;color:var(--text-0);text-decoration:none;}
.pr1-logo-mark{width:28px;height:28px;border-radius:8px;background:var(--accent-grad);position:relative;overflow:hidden;box-shadow:0 2px 12px color-mix(in oklab, var(--accent) 50%, transparent);}
.pr1-logo-mark::after{
  content:'';position:absolute;inset:4px;border-radius:4px;
  background:rgba(4,33,26,.6);
  -webkit-mask:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path fill='black' d='M3 3h14v14H3zM7 7l3 3 3-3M10 10v4'/></svg>") center/70% no-repeat;
  mask:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path fill='black' d='M3 3h14v14H3zM7 7l3 3 3-3M10 10v4'/></svg>") center/70% no-repeat;
}
.pr1-nav{display:flex;gap:2px;justify-content:center;}
.pr1-nav a{color:var(--text-2);text-decoration:none;font-size:14px;font-weight:500;padding:8px 14px;border-radius:999px;transition:color .15s, background .15s;}
.pr1-nav a:hover{color:var(--text-0);background:rgba(255,255,255,.04);}
.pr1-nav a.active{color:var(--text-0);background:rgba(255,255,255,.06);}
.pr1-hdr-r{display:inline-flex;gap:8px;align-items:center;}
.pr1-hdr-r .pr1-sign{color:var(--text-1);font-size:14px;font-weight:500;padding:8px 14px;border-radius:999px;text-decoration:none;transition:color .15s;}
.pr1-hdr-r .pr1-sign:hover{color:var(--text-0);}
.pr1-hdr-r .pr1-get{
  padding:8px 16px;border-radius:999px;background:var(--accent-grad);color:#04211a;font-weight:600;font-size:14px;
  text-decoration:none;border:0;cursor:pointer;font-family:inherit;
  box-shadow:0 4px 16px -4px color-mix(in oklab, var(--accent) 60%, transparent);
  transition:transform .15s,filter .15s;
}
.pr1-hdr-r .pr1-get:hover{transform:translateY(-1px);filter:brightness(1.05);}

.pr1-heroblock{
  position:relative;max-width:1400px;margin:0 auto;padding:96px 64px 88px;
  display:grid;grid-template-columns:1.1fr 1fr;gap:64px;align-items:center;min-height:640px;
}
.pr1-hero-bg{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none;border-radius:32px;}
.pr1-hero-bg .pr1-orb{position:absolute;border-radius:50%;filter:blur(60px);opacity:.45;animation:pr1-float 18s ease-in-out infinite;}
.pr1-hero-bg .pr1-orb-1{width:500px;height:500px;top:-120px;left:-80px;background:radial-gradient(circle, color-mix(in oklab, var(--accent) 60%, transparent), transparent 70%);}
.pr1-hero-bg .pr1-orb-2{width:400px;height:400px;bottom:-100px;right:-60px;background:radial-gradient(circle, rgba(167,139,250,.5), transparent 70%);animation-delay:-6s;}
.pr1-hero-bg .pr1-orb-3{width:320px;height:320px;top:40%;left:40%;background:radial-gradient(circle, rgba(34,211,238,.4), transparent 70%);animation-delay:-12s;}
@keyframes pr1-float{0%,100%{transform:translate(0,0) scale(1);}33%{transform:translate(30px,-20px) scale(1.05);}66%{transform:translate(-20px,30px) scale(.95);}}
.pr1-hero-grid{
  position:absolute;inset:0;z-index:0;opacity:.4;
  background-image:linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px),linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px);
  background-size:48px 48px;
  -webkit-mask-image:radial-gradient(ellipse at center, black 20%, transparent 75%);
  mask-image:radial-gradient(ellipse at center, black 20%, transparent 75%);
}
.pr1-hero-l{position:relative;z-index:2;}
.pr1-hero-badge{display:inline-flex;align-items:center;gap:10px;padding:6px 14px 6px 8px;border-radius:999px;background:rgba(255,255,255,.04);border:.5px solid var(--line-strong);backdrop-filter:blur(12px);font-size:12px;color:var(--text-1);font-weight:500;margin-bottom:28px;animation:pr1-fadeup .8s cubic-bezier(.2,.7,.3,1) both;}
.pr1-hero-badge .pr1-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 3px color-mix(in oklab, var(--accent) 30%, transparent);animation:pr1-pulse 2s ease-in-out infinite;}
@keyframes pr1-pulse{0%,100%{box-shadow:0 0 0 3px color-mix(in oklab, var(--accent) 30%, transparent);}50%{box-shadow:0 0 0 6px color-mix(in oklab, var(--accent) 0%, transparent);}}
.pr1-hero-badge .pr1-arr{color:var(--text-3);}
.pr1-hero-h1{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:clamp(54px,7vw,96px);line-height:.94;letter-spacing:-0.035em;margin:0 0 24px;animation:pr1-fadeup .9s .1s cubic-bezier(.2,.7,.3,1) both;}
.pr1-hero-h1 em{font-style:italic;background:var(--accent-grad);-webkit-background-clip:text;background-clip:text;color:transparent;}
.pr1-hero-h1 .pr1-word-strike{position:relative;display:inline-block;color:var(--text-3);}
.pr1-hero-h1 .pr1-word-strike::after{content:'';position:absolute;left:-2%;right:-2%;top:54%;height:2px;background:var(--text-2);transform-origin:left;animation:pr1-strike .8s .7s cubic-bezier(.7,0,.3,1) both;}
@keyframes pr1-strike{from{transform:scaleX(0);}to{transform:scaleX(1);}}
.pr1-hero-lead{font-size:18px;color:var(--text-1);line-height:1.5;max-width:520px;margin:0 0 32px;animation:pr1-fadeup 1s .2s cubic-bezier(.2,.7,.3,1) both;}
.pr1-hero-ctas{display:flex;gap:12px;align-items:center;margin-bottom:44px;animation:pr1-fadeup 1s .3s cubic-bezier(.2,.7,.3,1) both;flex-wrap:wrap;}
.pr1-hero-ctas .pr1-hc-primary{padding:14px 22px;border-radius:12px;background:var(--accent-grad);color:#04211a;font-weight:600;font-size:15px;border:0;cursor:pointer;font-family:inherit;box-shadow:0 1px 0 rgba(255,255,255,.3) inset, 0 10px 30px -8px color-mix(in oklab, var(--accent) 60%, transparent);transition:transform .15s, filter .15s;display:inline-flex;align-items:center;gap:8px;}
.pr1-hero-ctas .pr1-hc-primary:hover{transform:translateY(-2px);filter:brightness(1.08);}
.pr1-hero-ctas .pr1-hc-ghost{padding:14px 20px;border-radius:12px;background:transparent;color:var(--text-0);border:.5px solid var(--line-strong);font-weight:500;font-size:15px;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:8px;transition:all .15s;text-decoration:none;}
.pr1-hero-ctas .pr1-hc-ghost:hover{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.22);}
.pr1-hero-stats{display:flex;gap:40px;padding-top:28px;border-top:.5px solid var(--line);animation:pr1-fadeup 1s .4s cubic-bezier(.2,.7,.3,1) both;flex-wrap:wrap;}
.pr1-hero-stat .pr1-statnum{font-family:'Instrument Serif',Georgia,serif;font-size:32px;font-weight:400;letter-spacing:-0.02em;color:var(--text-0);line-height:1;font-variant-numeric:tabular-nums;}
.pr1-hero-stat .pr1-statnum em{font-style:italic;color:var(--accent);}
.pr1-hero-stat .pr1-statlbl{font-size:11px;color:var(--text-2);text-transform:uppercase;letter-spacing:.08em;margin-top:6px;font-weight:500;}
@keyframes pr1-fadeup{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}

.pr1-hero-viz{position:relative;z-index:2;width:100%;max-width:560px;justify-self:end;aspect-ratio:1;animation:pr1-fadeup 1s .25s cubic-bezier(.2,.7,.3,1) both;}
.pr1-viz-frame{position:absolute;inset:0;border-radius:24px;overflow:hidden;background:radial-gradient(ellipse at 30% 20%, rgba(34,211,238,.12), transparent 50%),radial-gradient(ellipse at 80% 80%, color-mix(in oklab, var(--accent) 15%, transparent), transparent 55%),linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.01));border:.5px solid var(--line-strong);box-shadow:0 24px 60px -20px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.03) inset;backdrop-filter:blur(16px);}
.pr1-viz-frame::before{content:'';position:absolute;inset:0;opacity:.5;background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:24px 24px;-webkit-mask-image:radial-gradient(ellipse at center,black 30%,transparent 80%);mask-image:radial-gradient(ellipse at center,black 30%,transparent 80%);}
.pr1-viz-chrome{position:absolute;top:16px;left:16px;right:16px;z-index:3;display:flex;align-items:center;gap:6px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;color:var(--text-2);letter-spacing:.04em;}
.pr1-viz-chrome .pr1-cd{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.15);}
.pr1-viz-chrome .pr1-cd.a{background:#ff5f56;} .pr1-viz-chrome .pr1-cd.b{background:#fdbc3a;} .pr1-viz-chrome .pr1-cd.c{background:var(--accent);}
.pr1-viz-chrome .pr1-path{margin-left:12px;opacity:.7;}
.pr1-img-stage{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);width:64%;aspect-ratio:4/3;border-radius:12px;overflow:hidden;box-shadow:0 12px 32px rgba(0,0,0,.4);z-index:1;background:radial-gradient(circle at 30% 35%,#fbbf24 0%,transparent 45%),radial-gradient(circle at 70% 65%,#f472b6 0%,transparent 50%),radial-gradient(circle at 55% 50%,#38bdf8 0%,transparent 55%),linear-gradient(135deg,#1e1b4b 0%,#581c87 50%,#831843 100%);animation:pr1-img-swap 8s cubic-bezier(.7,0,.3,1) infinite;}
@keyframes pr1-img-swap{0%,34%{filter:none;transform:translate(-50%,-50%) scale(1);}38%,62%{filter:saturate(1.2) contrast(1.05);transform:translate(-50%,-50%) scale(1.005);}66%,100%{filter:none;transform:translate(-50%,-50%) scale(1);}}
.pr1-img-stage::before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px);background-size:12px 12px;opacity:0;animation:pr1-grid-show 8s ease-in-out infinite;}
@keyframes pr1-grid-show{0%,10%{opacity:0;}18%,40%{opacity:.85;}48%,100%{opacity:0;}}
.pr1-img-stage::after{content:'';position:absolute;left:0;right:0;height:24%;background:linear-gradient(180deg,transparent 0%,color-mix(in oklab, var(--accent) 12%, transparent) 40%,color-mix(in oklab, var(--accent) 60%, transparent) 90%,var(--accent) 100%);box-shadow:0 8px 24px 2px color-mix(in oklab, var(--accent) 45%, transparent);top:-24%;animation:pr1-scan 8s cubic-bezier(.65,.05,.35,1) infinite;mix-blend-mode:screen;}
@keyframes pr1-scan{0%{top:-24%;opacity:0;}8%{opacity:1;}40%{top:100%;opacity:1;}44%,100%{top:100%;opacity:0;}}
.pr1-img-ribbon{position:absolute;top:12px;left:12px;z-index:2;padding:5px 10px;border-radius:999px;background:rgba(10,10,16,.78);backdrop-filter:blur(10px);border:.5px solid rgba(255,255,255,.12);font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.06em;font-weight:700;color:#fdba74;transition:color .35s ease;white-space:nowrap;}
.pr1-byte{position:absolute;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;font-weight:600;color:var(--accent);z-index:2;pointer-events:none;opacity:0;text-shadow:0 0 12px color-mix(in oklab, var(--accent) 60%, transparent);}
.pr1-byte:nth-child(3){top:35%;left:30%;animation:pr1-byte 8s ease-in 1.8s infinite;}
.pr1-byte:nth-child(4){top:48%;left:62%;animation:pr1-byte 8s ease-in 2.1s infinite;}
.pr1-byte:nth-child(5){top:60%;left:38%;animation:pr1-byte 8s ease-in 2.4s infinite;}
.pr1-byte:nth-child(6){top:42%;left:52%;animation:pr1-byte 8s ease-in 2.7s infinite;}
.pr1-byte:nth-child(7){top:55%;left:70%;animation:pr1-byte 8s ease-in 3s infinite;}
@keyframes pr1-byte{0%,20%{opacity:0;transform:translate(0,0);}25%{opacity:1;transform:translate(0,0);}38%{opacity:0;transform:translate(0,60px) rotate(20deg);}100%{opacity:0;transform:translate(0,60px);}}
.pr1-hud{position:absolute;left:16px;right:16px;bottom:16px;z-index:3;background:rgba(10,10,16,.8);backdrop-filter:blur(14px);border:.5px solid var(--line-strong);border-radius:14px;padding:12px 14px;font-family:'JetBrains Mono',ui-monospace,monospace;}
.pr1-hud-top{display:flex;justify-content:space-between;align-items:center;font-size:10px;color:var(--text-2);letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;}
.pr1-hud-top b{color:var(--text-0);font-weight:600;}
.pr1-hud-top .pr1-pct{color:var(--accent);font-weight:700;font-size:12px;letter-spacing:0;}
.pr1-hud-bar{height:4px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;position:relative;}
.pr1-hud-bar::after{content:'';position:absolute;left:0;top:0;bottom:0;width:0;background:var(--accent-grad);border-radius:999px;box-shadow:0 0 12px color-mix(in oklab, var(--accent) 60%, transparent);animation:pr1-bar 8s cubic-bezier(.6,0,.3,1) infinite;}
@keyframes pr1-bar{0%,10%{width:0%;}42%{width:100%;}46%,68%{width:100%;background:var(--accent-grad);opacity:1;}72%,100%{width:100%;opacity:0;}}
.pr1-hud-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px;font-size:10px;}
.pr1-hud-metric{display:flex;flex-direction:column;gap:2px;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,.03);}
.pr1-hud-metric span{color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;font-size:9px;}
.pr1-hud-metric b{color:var(--text-0);font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;}
.pr1-hud-metric.ok b{color:var(--accent);}
.pr1-viz-pop{position:absolute;top:26%;right:-10px;z-index:4;padding:10px 14px;border-radius:14px;background:var(--accent-grad);color:#04211a;font-weight:700;font-size:14px;letter-spacing:-0.01em;box-shadow:0 12px 32px color-mix(in oklab, var(--accent) 50%, transparent);display:inline-flex;align-items:center;gap:8px;opacity:0;transform:translateY(-8px) scale(.85);animation:pr1-pop 8s cubic-bezier(.3,1.6,.5,1) infinite;}
@keyframes pr1-pop{0%,48%{opacity:0;transform:translateY(-8px) scale(.85);}52%{opacity:1;transform:translateY(0) scale(1);}78%{opacity:1;transform:translateY(0) scale(1);}85%,100%{opacity:0;transform:translateY(-8px) scale(.85);}}
.pr1-thumbs{position:absolute;left:16px;bottom:130px;z-index:3;display:flex;gap:6px;align-items:flex-end;opacity:0;animation:pr1-thumbs 8s ease-out infinite;}
@keyframes pr1-thumbs{0%,52%{opacity:0;transform:translateX(-8px);}58%,80%{opacity:1;transform:translateX(0);}85%,100%{opacity:0;transform:translateX(-8px);}}
.pr1-thumb{border-radius:4px;overflow:hidden;border:.5px solid rgba(255,255,255,.15);background:radial-gradient(circle at 40% 40%,#fbbf24 0%,transparent 50%),radial-gradient(circle at 65% 65%,#f472b6 0%,transparent 55%),linear-gradient(135deg,#1e1b4b 0%,#581c87 100%);box-shadow:0 4px 12px rgba(0,0,0,.4);}
.pr1-thumb:nth-child(1){width:56px;height:42px;}
.pr1-thumb:nth-child(2){width:42px;height:32px;}
.pr1-thumb:nth-child(3){width:28px;height:22px;}
.pr1-thumb:nth-child(4){width:20px;height:16px;}

.pr1-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 12px 6px 8px;border-radius:999px;background:rgba(255,255,255,.04);border:.5px solid var(--line-strong);font-size:12px;color:var(--text-1);letter-spacing:.01em;margin-bottom:20px;}
.pr1-eyebrow .pr1-dot{width:6px;height:6px;border-radius:50%;background:var(--accent);box-shadow:0 0 12px var(--accent);}
.pr1-hero-plans{max-width:780px;margin:40px auto 0;text-align:center;}
.pr1-plans-h{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-style:italic;font-size:clamp(44px,5.5vw,64px);letter-spacing:-0.03em;margin:0 0 16px;line-height:1;}
.pr1-plans-h em{font-style:italic;background:var(--accent-grad);-webkit-background-clip:text;background-clip:text;color:transparent;}
.pr1-sub{font-size:17px;color:var(--text-1);max-width:540px;margin:0 auto;line-height:1.5;}

.pr1-controls{display:flex;align-items:center;justify-content:center;gap:24px;margin:40px auto 56px;flex-wrap:wrap;}
.pr1-toggle{display:inline-flex;padding:4px;border-radius:999px;background:rgba(0,0,0,.4);border:.5px solid var(--line-strong);backdrop-filter:blur(8px);}
.pr1-toggle button{appearance:none;border:0;background:transparent;color:var(--text-2);padding:10px 20px;border-radius:999px;cursor:pointer;font:inherit;font-size:14px;font-weight:500;display:inline-flex;align-items:center;gap:8px;transition:color .2s;}
.pr1-toggle button[data-on="true"]{background:var(--text-0);color:#0a0a12;}
.pr1-toggle .pr1-save{font-size:11px;padding:2px 6px;border-radius:999px;background:var(--accent);color:#04211a;font-weight:600;}

.pr1-slider-wrap{max-width:900px;margin:0 auto 56px;padding:20px 24px;border-radius:16px;background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01));border:.5px solid var(--line-strong);}
.pr1-sl-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px;font-size:13px;color:var(--text-2);}
.pr1-sl-head b{color:var(--text-0);font-weight:600;font-size:20px;font-variant-numeric:tabular-nums;}
.pr1-sl-reco{margin-top:14px;margin-bottom:0;}
.pr1-sl-head .pr1-reco{color:var(--accent);font-weight:600;font-size:12px;letter-spacing:.02em;display:inline-flex;align-items:center;gap:6px;}
.pr1-reco-name{color:var(--accent) !important;font-size:16px !important;text-transform:capitalize;}
.pr1-sl{-webkit-appearance:none;appearance:none;width:100%;height:4px;background:rgba(255,255,255,.08);border-radius:999px;outline:none;cursor:pointer;background-image:var(--accent-grad);background-size:var(--fill,0%) 100%;background-repeat:no-repeat;}
.pr1-sl::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:20px;height:20px;border-radius:50%;background:var(--text-0);border:3px solid var(--accent);cursor:grab;box-shadow:0 4px 12px rgba(0,0,0,.4);}
.pr1-sl::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:var(--text-0);border:3px solid var(--accent);cursor:grab;box-shadow:0 4px 12px rgba(0,0,0,.4);}
.pr1-sl-ticks{display:flex;justify-content:space-between;margin-top:10px;font-size:11px;color:var(--text-3);}

.pr1-grid{display:grid;grid-template-columns:repeat(5, minmax(0, 1fr));gap:16px;max-width:1400px;margin:0 auto;align-items:stretch;}
.pr1-card{position:relative;display:flex;flex-direction:column;padding:28px 24px 24px;background:linear-gradient(180deg, rgba(255,255,255,.025), rgba(255,255,255,.01));border:.5px solid var(--line-strong);border-radius:20px;transition:transform .25s cubic-bezier(.2,.7,.3,1), border-color .2s, background .2s;}
.pr1-card:hover{transform:translateY(-4px);border-color:rgba(255,255,255,.18);background:linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.015));}
.pr1-card.pr1-hl{background:radial-gradient(120% 80% at 50% 0%, color-mix(in oklab, var(--accent) 18%, transparent), transparent 60%),linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.01));border:.5px solid color-mix(in oklab, var(--accent) 40%, transparent);transform:translateY(-8px);box-shadow:0 0 0 1px color-mix(in oklab, var(--accent) 30%, transparent), 0 20px 60px -20px color-mix(in oklab, var(--accent) 40%, transparent), 0 0 80px -20px color-mix(in oklab, var(--accent) 40%, transparent);z-index:2;}
.pr1-card.pr1-hl:hover{transform:translateY(-12px);}
.pr1-badge{position:absolute;top:-10px;left:50%;transform:translateX(-50%);padding:5px 12px;border-radius:999px;background:var(--accent-grad);color:#04211a;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;box-shadow:0 4px 16px color-mix(in oklab, var(--accent) 50%, transparent);}
.pr1-badge-soft{background:rgba(255,255,255,.1) !important;color:var(--text-0) !important;backdrop-filter:blur(8px);box-shadow:none !important;}
.pr1-name{font-size:14px;font-weight:600;color:var(--text-0);letter-spacing:.04em;text-transform:uppercase;margin:0 0 6px;}
.pr1-tag{font-size:13px;color:var(--text-2);line-height:1.45;margin:0 0 24px;min-height:38px;}
.pr1-price{display:flex;align-items:baseline;gap:6px;margin-bottom:4px;}
.pr1-price-amt{font-family:'Instrument Serif',Georgia,serif;font-size:56px;font-weight:400;line-height:1;letter-spacing:-0.02em;color:var(--text-0);font-variant-numeric:tabular-nums;}
.pr1-price-free{font-style:italic;}
.pr1-price-cur{font-family:'Instrument Serif',Georgia,serif;font-size:28px;color:var(--text-1);line-height:1;margin-right:-2px;}
.pr1-price-per{font-size:13px;color:var(--text-2);margin-left:4px;}
.pr1-billed{font-size:12px;color:var(--text-3);margin-bottom:22px;height:16px;}
.pr1-meta{padding:14px 0;border-top:.5px solid var(--line);border-bottom:.5px solid var(--line);margin-bottom:18px;}
.pr1-meta-big{font-size:18px;font-weight:600;color:var(--text-0);letter-spacing:-0.01em;font-variant-numeric:tabular-nums;}
.pr1-meta-sm{font-size:12px;color:var(--text-2);margin-top:4px;}
.pr1-feats{list-style:none;padding:0;margin:0 0 24px;display:flex;flex-direction:column;gap:12px;flex:1;}
.pr1-feat{display:flex;gap:10px;font-size:13px;color:var(--text-1);line-height:1.4;}
.pr1-feat svg{flex-shrink:0;margin-top:2px;color:var(--accent);}
.pr1-cta{display:block;width:100%;padding:12px 16px;border-radius:10px;font:inherit;font-size:14px;font-weight:600;cursor:pointer;transition:all .15s;text-align:center;border:.5px solid transparent;text-decoration:none;}
.pr1-cta-primary{background:var(--accent-grad);color:#04211a;box-shadow:0 1px 0 rgba(255,255,255,.3) inset, 0 6px 20px -6px color-mix(in oklab, var(--accent) 60%, transparent);}
.pr1-cta-primary:hover{transform:translateY(-1px);filter:brightness(1.05);}
.pr1-cta-outline{background:rgba(255,255,255,.04);color:var(--text-0);border-color:var(--line-strong);}
.pr1-cta-outline:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.22);}
.pr1-cta-ghost{background:transparent;color:var(--text-1);border-color:var(--line);}
.pr1-cta-ghost:hover{color:var(--text-0);border-color:var(--line-strong);}
.pr1-cta-inline{width:auto !important;padding:12px 20px !important;}

.pr1-trust{display:flex;justify-content:center;align-items:center;gap:36px;margin:64px auto 0;max-width:900px;flex-wrap:wrap;color:var(--text-2);font-size:13px;}
.pr1-trust-item{display:inline-flex;align-items:center;gap:8px;}
.pr1-trust-item svg{color:var(--accent);}

.pr1-faq-wrap{max-width:780px;margin:120px auto 0;}
.pr1-faq-h{font-family:'Instrument Serif',Georgia,serif;font-size:clamp(34px,4.5vw,44px);font-weight:400;letter-spacing:-0.02em;text-align:center;margin:0 0 40px;}
.pr1-faq-h em{font-style:italic;background:var(--accent-grad);-webkit-background-clip:text;background-clip:text;color:transparent;}
.pr1-faq-item{border-top:.5px solid var(--line-strong);}
.pr1-faq-item:last-child{border-bottom:.5px solid var(--line-strong);}
.pr1-faq-q{width:100%;appearance:none;background:transparent;border:0;color:var(--text-0);font:inherit;font-size:18px;font-weight:500;letter-spacing:-0.01em;padding:24px 0;text-align:left;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:16px;}
.pr1-faq-q svg{transition:transform .25s;color:var(--text-2);flex-shrink:0;}
.pr1-faq-item[data-open="true"] .pr1-faq-q svg{transform:rotate(45deg);color:var(--accent);}
.pr1-faq-a{overflow:hidden;max-height:0;transition:max-height .3s ease,padding .3s ease;color:var(--text-1);font-size:15px;line-height:1.6;}
.pr1-faq-item[data-open="true"] .pr1-faq-a{max-height:400px;padding:0 0 24px;}

.pr1-footer-cta{max-width:1100px;margin:120px auto 0;padding:56px 48px;border-radius:28px;background:radial-gradient(600px 300px at 80% 0%, color-mix(in oklab, var(--accent) 25%, transparent), transparent 60%),linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.01));border:.5px solid var(--line-strong);display:grid;grid-template-columns:1.4fr 1fr;gap:40px;align-items:center;}
.pr1-footer-cta h2{font-family:'Instrument Serif',Georgia,serif;font-size:clamp(28px,4vw,40px);font-weight:400;letter-spacing:-0.02em;margin:0 0 12px;line-height:1;}
.pr1-footer-cta h2 em{font-style:italic;color:var(--accent);}
.pr1-footer-cta p{color:var(--text-1);margin:0;font-size:15px;line-height:1.5;}
.pr1-footer-cta-buttons{display:flex;gap:12px;flex-wrap:wrap;justify-content:flex-end;}

@media (max-width: 1100px){
  .pr1-grid{grid-template-columns:repeat(2, minmax(0, 1fr));}
  .pr1-heroblock{grid-template-columns:1fr;padding:64px 32px;gap:48px;}
  .pr1-hero-viz{justify-self:center;max-width:480px;}
  .pr1-inner{padding:32px 24px 0;}
  .pr1-footer-cta{grid-template-columns:1fr;padding:40px 28px;}
  .pr1-footer-cta-buttons{justify-content:flex-start;}
  .pr1-nav{display:none;}
  .pr1-hdr{grid-template-columns:auto 1fr;gap:16px;padding:8px 12px;}
}
@media (max-width: 640px){
  .pr1-grid{grid-template-columns:1fr;}
  .pr1-card.pr1-hl{transform:none;}
  .pr1-card.pr1-hl:hover{transform:translateY(-4px);}
  .pr1-trust{gap:18px;}
  .pr1-hero-stats{gap:24px;}
}
`;
