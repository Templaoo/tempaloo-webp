"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PLANS, type Plan } from "@/lib/plans";
import type { Billing } from "@/components/pricing/BillingToggle";

type PlanCode = Plan["code"];

interface Props {
    billing: Billing;
    onBillingChange: (b: Billing) => void;
    onChoose: (code: PlanCode) => void;
    initialPlan: PlanCode;
    authedEmail?: string | null;
}

export function ActivatePricing({ billing, onBillingChange, onChoose, initialPlan, authedEmail }: Props) {
    useEffect(() => {
        const stored = typeof window !== "undefined" ? localStorage.getItem("tempaloo-theme") : null;
        if (stored === "light" || stored === "dark") {
            document.documentElement.setAttribute("data-theme", stored);
        }
    }, []);

    return (
        <div className="pr3-root">
            <style dangerouslySetInnerHTML={{ __html: css }} />

            <Nav authedEmail={authedEmail} />

            <section className="pr3-hero">
                <div className="app-container">
                    <div className="pr3-hero-inner">
                        <span className="eyebrow">PRICING</span>
                        <h1 className="h-display pr3-hero-h1">
                            Pick your plan.{" "}
                            <span className="font-serif pr3-hero-h1-accent">Ship lighter pages.</span>
                        </h1>
                        <p className="pr3-hero-lead">
                            1 credit per image — every thumbnail size included. No visit counting. No surprise bills.
                        </p>
                        <div className="pr3-billing-wrap">
                            <BillingSegment value={billing} onChange={onBillingChange} />
                        </div>
                    </div>
                </div>
            </section>

            <section className="pr3-grid-section">
                <div className="app-container">
                    <div className="pr3-grid">
                        {PLANS.map((p) => (
                            <PricingCard
                                key={p.code}
                                plan={p}
                                billing={billing}
                                selected={p.code === initialPlan}
                                onChoose={() => onChoose(p.code)}
                            />
                        ))}
                    </div>

                    <div className="pr3-trust">
                        <TrustItem icon={<ShieldIcon />} label="30-day money-back guarantee" />
                        <TrustItem icon={<ClockIcon />} label="7-day free trial on paid plans" />
                        <TrustItem icon={<LockIcon />} label="Secure checkout via Freemius" />
                        <TrustItem icon={<GlobeIcon />} label="EU-hosted (GDPR)" />
                    </div>
                </div>
            </section>

            <section className="pr3-faq-teaser">
                <div className="app-container-sm">
                    <p className="pr3-faq-teaser-lead">
                        Questions on quotas, rollover, or AVIF?{" "}
                        <Link href="/webp#faq" className="pr3-faq-link">Check the FAQ →</Link>
                    </p>
                </div>
            </section>
        </div>
    );
}

function Nav({ authedEmail }: { authedEmail?: string | null }) {
    return (
        <nav className="pr3-nav">
            <div className="app-container pr3-nav-inner">
                <Link href="/webp" className="pr3-nav-logo">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="currentColor" /><path d="M6 8H18M12 8V17" stroke="var(--bg)" strokeWidth="2" strokeLinecap="round" /></svg>
                    <span>Tempaloo<span className="pr3-nav-sub"> / WebP</span></span>
                </Link>
                <div className="pr3-nav-right">
                    {authedEmail ? (
                        <Link href="/webp/dashboard" className="btn btn-ghost btn-sm">
                            Dashboard →
                        </Link>
                    ) : (
                        <Link href="/webp" className="pr3-nav-back">← Back to overview</Link>
                    )}
                </div>
            </div>
        </nav>
    );
}

function BillingSegment({ value, onChange }: { value: Billing; onChange: (b: Billing) => void }) {
    return (
        <div className="pr3-segment">
            {(["monthly", "annual"] as const).map((v) => (
                <button key={v} onClick={() => onChange(v)} className={`pr3-segment-btn ${value === v ? "pr3-seg-on" : ""}`}>
                    {v === "monthly" ? "Monthly" : "Annual"}
                    {v === "annual" && (
                        <span className={`pr3-save font-mono ${value === "annual" ? "pr3-save-on" : ""}`}>−20%</span>
                    )}
                </button>
            ))}
        </div>
    );
}

function PricingCard({ plan, billing, selected, onChoose }: { plan: Plan; billing: Billing; selected: boolean; onChoose: () => void }) {
    const isAnnual = billing === "annual";
    const monthly = isAnnual ? plan.priceAnnual / 12 : plan.priceMonthly;
    const showPrice = plan.priceMonthly > 0;

    return (
        <div className={`pr3-card ${plan.highlight ? "pr3-card-hl" : ""} ${selected ? "pr3-card-selected" : ""}`}>
            {plan.badge && <div className="pr3-card-badge font-mono">{plan.badge}</div>}
            {selected && !plan.badge && <div className="pr3-card-badge pr3-card-badge-soft font-mono">YOUR PICK</div>}

            <div className="pr3-card-head">
                <div className="pr3-card-name">{plan.name}</div>
                <p className="pr3-card-tag">{plan.tagline}</p>
            </div>

            <div className="pr3-card-price">
                {showPrice ? (
                    <>
                        <div className="pr3-card-price-row">
                            <span className="h-display pr3-card-price-amt">€{formatAmount(monthly)}</span>
                            <span className="pr3-card-price-per">/mo</span>
                        </div>
                        <div className="pr3-card-bill">
                            {isAnnual ? `€${plan.priceAnnual} billed yearly` : "billed monthly"}
                        </div>
                    </>
                ) : (
                    <>
                        <span className="h-display pr3-card-price-amt">€0</span>
                        <div className="pr3-card-bill">forever · no card</div>
                    </>
                )}
            </div>

            <div className="pr3-card-meta">
                <div className="pr3-card-meta-row">
                    <span>Credits</span>
                    <span className="font-mono pr3-card-meta-val">
                        {plan.imagesLabel.replace("/ month", "").trim()}
                    </span>
                </div>
                <div className="pr3-card-meta-row">
                    <span>Sites</span>
                    <span className="pr3-card-meta-val">{plan.sites}</span>
                </div>
            </div>

            <ul className="pr3-card-feats">
                {plan.features.map((f) => (
                    <li key={f}>
                        <span className="pr3-feat-check"><CheckIcon /></span>
                        {f}
                    </li>
                ))}
            </ul>

            <button
                type="button"
                onClick={onChoose}
                className={`btn ${plan.highlight ? "btn-primary" : "btn-ghost"} pr3-card-cta`}
            >
                {plan.cta} <ArrowIcon />
            </button>
        </div>
    );
}

function TrustItem({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <div className="pr3-trust-item">
            <span className="pr3-trust-icon">{icon}</span>
            <span>{label}</span>
        </div>
    );
}

function ArrowIcon() {
    return <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden><path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function CheckIcon() {
    return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function ShieldIcon() {
    return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12c0 5-3.58 9-8 9s-8-4-8-9V5l8-3 8 3v7z" /><path d="M9 12l2 2 4-4" /></svg>;
}
function ClockIcon() {
    return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>;
}
function LockIcon() {
    return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>;
}
function GlobeIcon() {
    return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" /></svg>;
}

function formatAmount(eur: number): string {
    if (eur === 0) return "0";
    return eur % 1 === 0 ? String(Math.round(eur)) : eur.toFixed(2);
}

const css = `
.pr3-root {
  min-height: 100vh;
  background: var(--bg);
  color: var(--ink);
}

.pr3-nav {
  position: sticky; top: 0; z-index: 40;
  background: color-mix(in oklab, var(--bg) 80%, transparent);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border-bottom: 1px solid var(--line);
}
.pr3-nav-inner {
  display: flex; align-items: center; justify-content: space-between;
  height: 60px;
}
.pr3-nav-logo {
  display: inline-flex; align-items: center; gap: 10px;
  font-weight: 500; font-size: 14.5px;
  letter-spacing: -0.015em;
  color: var(--ink);
}
.pr3-nav-sub { color: var(--ink-3); }
.pr3-nav-right { display: flex; gap: 10px; align-items: center; }
.pr3-nav-back { font-size: 13.5px; color: var(--ink-3); transition: color .15s; }
.pr3-nav-back:hover { color: var(--ink); }

.pr3-hero {
  padding: 64px 0 40px;
  text-align: center;
  border-bottom: 1px solid var(--line);
}
.pr3-hero-inner { max-width: 720px; margin: 0 auto; }
.pr3-hero-h1 {
  font-size: clamp(40px, 6vw, 68px);
  line-height: 1.02; letter-spacing: -0.04em; font-weight: 600;
  margin: 12px 0 16px; color: var(--ink);
}
.pr3-hero-h1-accent { color: var(--ink-3); font-weight: 400; }
.pr3-hero-lead {
  font-size: 17px; color: var(--ink-2);
  max-width: 520px; margin: 0 auto;
  letter-spacing: -0.01em; line-height: 1.55;
}
.pr3-billing-wrap { margin-top: 28px; display: flex; justify-content: center; }

.pr3-segment {
  display: inline-flex; padding: 3px;
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: 8px;
}
.pr3-segment-btn {
  padding: 6px 14px; border: none; background: transparent;
  color: var(--ink-3); border-radius: 6px;
  font-size: 13px; font-weight: 450;
  letter-spacing: -0.01em; cursor: pointer;
  transition: all .15s;
  display: inline-flex; align-items: center; gap: 6px;
}
.pr3-seg-on {
  background: var(--surface); color: var(--ink);
  box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 0 0 1px var(--line-2);
}
.pr3-save {
  font-size: 10.5px; padding: 1px 5px; border-radius: 4px;
  background: transparent; color: var(--ink-3); font-weight: 500;
}
.pr3-save-on { background: var(--accent-wash); color: var(--ink); }

.pr3-grid-section { padding: 48px 0 80px; }
.pr3-grid {
  display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px; max-width: 1200px; margin: 0 auto;
}
@media (max-width: 1100px) {
  .pr3-grid { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
}

.pr3-card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 24px 20px 22px;
  display: flex; flex-direction: column;
  transition: border-color .15s, transform .15s;
}
.pr3-card:hover { border-color: var(--line-2); transform: translateY(-2px); }
.pr3-card-hl {
  border-color: var(--ink);
}
.pr3-card-hl:hover { border-color: var(--ink); transform: translateY(-4px); }
.pr3-card-selected {
  box-shadow: 0 0 0 1px var(--ink), 0 12px 32px -12px rgba(0,0,0,0.2);
}
.pr3-card-badge {
  position: absolute; top: -10px; right: 16px;
  background: var(--ink); color: var(--bg);
  padding: 3px 9px; border-radius: 4px;
  font-size: 10.5px; font-weight: 500;
  letter-spacing: 0.02em;
}
.pr3-card-badge-soft {
  background: var(--bg-2); color: var(--ink);
  border: 1px solid var(--line-2);
}

.pr3-card-name { font-size: 14.5px; font-weight: 500; color: var(--ink); margin-bottom: 3px; }
.pr3-card-tag { font-size: 12.5px; color: var(--ink-3); margin: 0 0 20px; line-height: 1.45; min-height: 34px; }

.pr3-card-price { padding-bottom: 18px; border-bottom: 1px solid var(--line); margin-bottom: 18px; }
.pr3-card-price-row { display: flex; align-items: baseline; gap: 4px; }
.pr3-card-price-amt { font-size: 32px; font-weight: 500; letter-spacing: -0.04em; line-height: 1; color: var(--ink); }
.pr3-card-price-per { font-size: 13px; color: var(--ink-3); }
.pr3-card-bill { font-size: 12px; color: var(--ink-3); margin-top: 4px; }

.pr3-card-meta { margin-bottom: 18px; }
.pr3-card-meta-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; color: var(--ink-3); }
.pr3-card-meta-row + .pr3-card-meta-row { margin-top: 6px; }
.pr3-card-meta-val { font-size: 13px; font-weight: 500; color: var(--ink); letter-spacing: -0.01em; }

.pr3-card-feats {
  list-style: none; padding: 0; margin: 0 0 20px;
  display: flex; flex-direction: column; gap: 8px; flex: 1;
}
.pr3-card-feats li { display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; color: var(--ink-2); line-height: 1.5; }
.pr3-feat-check { color: var(--ink); margin-top: 3px; flex-shrink: 0; }

.pr3-card-cta { width: 100%; height: 36px; }

.pr3-trust {
  max-width: 880px; margin: 48px auto 0;
  display: flex; justify-content: center; gap: 24px; flex-wrap: wrap;
  padding-top: 40px; border-top: 1px solid var(--line);
}
.pr3-trust-item {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 13px; color: var(--ink-3);
}
.pr3-trust-icon { color: var(--ink-2); display: inline-flex; }

.pr3-faq-teaser {
  padding: 40px 0 64px;
  border-top: 1px solid var(--line);
  background: var(--bg-2);
  text-align: center;
}
.pr3-faq-teaser-lead {
  margin: 0; font-size: 14.5px; color: var(--ink-2);
}
.pr3-faq-link { color: var(--ink); font-weight: 500; }
.pr3-faq-link:hover { text-decoration: underline; }
`;
