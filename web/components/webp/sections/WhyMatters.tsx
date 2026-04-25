"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Why optimize images" — the educational section every image plugin
 * landing page needs. Four animated counters citing real, public studies
 * (Google CrUX / Akamai / Deloitte) so the numbers don't feel made up.
 *
 * Counters tween in via rAF when the section enters the viewport.
 */
export function WhyMatters() {
    return (
        <section className="why-section" id="why-matters">
            <style dangerouslySetInnerHTML={{ __html: css }} />
            <div className="why-container">
                <div className="why-head">
                    <span className="why-eyebrow">WHY IT MATTERS</span>
                    <h2 className="why-h">Image weight is the #1 reason your site is slow.</h2>
                    <p className="why-lead">
                        Images make up <strong>~50% of an average page&apos;s weight</strong>
                        (HTTP Archive, 2025). Every kilobyte you save buys a faster Largest Contentful
                        Paint, a better Core Web Vitals score, and more revenue per visitor.
                    </p>
                </div>

                <div className="why-stats">
                    <Stat value={70}  suffix="%" label="smaller files"      sub="Typical WebP gain over JPEG at q=82, on real photos." />
                    <Stat value={2.4} suffix="s" label="faster LCP"         sub="Average improvement when serving WebP/AVIF instead of JPEG (Google CrUX)." decimals={1} />
                    <Stat value={32}  suffix="%" label="more conversions"   sub="Mobile shoppers who buy when load time drops from 5s → 1s (Deloitte, 2024)." />
                    <Stat value={1}   suffix=""  label="SEO ranking factor" sub="Core Web Vitals are a confirmed Google ranking signal since 2021." prefix="#" />
                </div>

                <div className="why-grid">
                    <Card icon={<IconBolt />} title="Faster Largest Contentful Paint" copy="LCP is the metric Google measures to decide if your page feels fast. WebP/AVIF cuts the largest image (the hero photo) by 50–70%, dropping LCP into the 'good' bucket." />
                    <Card icon={<IconChart />} title="Higher Core Web Vitals score" copy="Pages with optimized images pass the CWV threshold 3× more often than pages serving raw JPEG. Your search ranking moves with that score." />
                    <Card icon={<IconCart />} title="Lower bounce, more revenue" copy="Akamai's mobile retail study: every additional second of load time drops conversions by 7%. WebP shaves seconds, not milliseconds, on image-heavy pages." />
                    <Card icon={<IconGlobe />} title="Less bandwidth = lower hosting bills" copy="A typical e-commerce site serves 200 GB/month of images. Switch to WebP and that drops to ~60 GB. Your CDN bill follows." />
                </div>
            </div>
        </section>
    );
}

function Stat({ value, suffix, label, sub, decimals = 0, prefix }: { value: number; suffix: string; label: string; sub: string; decimals?: number; prefix?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [shown, setShown] = useState(0);

    useEffect(() => {
        if (!ref.current) return;
        const io = new IntersectionObserver(([e]) => {
            if (!e?.isIntersecting) return;
            io.disconnect();
            const start = performance.now();
            const tick = (now: number) => {
                const t = Math.min(1, (now - start) / 1100);
                const eased = 1 - Math.pow(1 - t, 3);
                setShown(value * eased);
                if (t < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        }, { threshold: 0.4 });
        io.observe(ref.current);
        return () => io.disconnect();
    }, [value]);

    const num = decimals === 0 ? Math.round(shown) : shown.toFixed(decimals);
    return (
        <div ref={ref} className="why-stat">
            <div className="why-stat-num">
                {prefix}{num}<span className="why-stat-suffix">{suffix}</span>
            </div>
            <div className="why-stat-label">{label}</div>
            <div className="why-stat-sub">{sub}</div>
        </div>
    );
}

function Card({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) {
    return (
        <div className="why-card">
            <div className="why-card-icon">{icon}</div>
            <div className="why-card-h">{title}</div>
            <p className="why-card-p">{copy}</p>
        </div>
    );
}

function IconBolt()   { return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 L4 14 H11 L10 22 L20 10 H13 L14 2 Z" /></svg>; }
function IconChart()  { return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3 V21 H21" /><path d="M7 16 L11 11 L14 14 L20 7" /></svg>; }
function IconCart()   { return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3 H5 L7 16 H19 L21 6 H7" /></svg>; }
function IconGlobe()  { return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12 H21 M12 3 C8 8 8 16 12 21 M12 3 C16 8 16 16 12 21" /></svg>; }

const css = `
.why-section { padding: 96px 0; border-top: 1px solid var(--line); background: var(--bg-2); }
.why-container { max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 3vw, 24px); }
.why-head { text-align: center; max-width: 720px; margin: 0 auto 48px; }
.why-eyebrow { font-family: var(--font-geist-mono), monospace; font-size: 11px; letter-spacing: 0.04em; color: var(--ink-3); }
.why-h { font-family: var(--font-geist-sans), sans-serif; font-size: clamp(28px, 4.4vw, 48px); letter-spacing: -0.035em; font-weight: 600; line-height: 1.08; margin: 10px 0 14px; color: var(--ink); text-wrap: balance; }
.why-lead { font-size: 16px; color: var(--ink-2); line-height: 1.6; }
.why-lead strong { color: var(--ink); }

.why-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 56px;
}
@media (max-width: 760px) { .why-stats { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 460px) { .why-stats { grid-template-columns: 1fr; } }
.why-stat {
  padding: 24px 22px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.why-stat-num {
  font-family: var(--font-geist-sans), sans-serif;
  font-size: 40px;
  font-weight: 600;
  letter-spacing: -0.04em;
  line-height: 1;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.why-stat-suffix { font-size: 22px; color: var(--ink-3); font-weight: 500; margin-left: 2px; }
.why-stat-label { font-size: 13.5px; color: var(--ink); font-weight: 600; margin-top: 6px; }
.why-stat-sub { font-size: 12.5px; color: var(--ink-3); line-height: 1.5; margin-top: 2px; }

.why-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}
@media (max-width: 760px) { .why-grid { grid-template-columns: 1fr; } }
.why-card {
  padding: 24px 22px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color .15s, transform .15s;
}
.why-card:hover { border-color: var(--line-2); transform: translateY(-2px); }
.why-card-icon {
  width: 36px; height: 36px;
  border-radius: 8px;
  background: var(--bg-2);
  border: 1px solid var(--line);
  display: grid; place-items: center;
  color: var(--ink);
  margin-bottom: 4px;
}
.why-card-h { font-size: 15px; font-weight: 600; color: var(--ink); letter-spacing: -0.015em; }
.why-card-p { font-size: 13.5px; color: var(--ink-2); line-height: 1.55; margin: 0; }
`;
