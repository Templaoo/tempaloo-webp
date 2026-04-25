"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Why optimize images" — the educational section. The 4 stat counters
 * at the top tween in via rAF when the section enters the viewport.
 *
 * Each follow-up card now wraps a fully-animated CSS mockup that *shows*
 * the claim (LCP timeline race, CWV gauges, conversion-vs-load-time
 * chart, bandwidth tower) — not just an icon next to text.
 */
export function WhyMatters() {
    return (
        <section className="why-section" id="why-matters">
            <style dangerouslySetInnerHTML={{ __html: css }} />
            <div className="why-container">
                <div className="why-head">
                    <span className="why-eyebrow">WHY IT MATTERS</span>
                    <h2 className="why-h">Image weight is the <span className="why-h-mark">#1 reason</span> your site is slow.</h2>
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
                    <Card title="Faster Largest Contentful Paint" copy="LCP is what Google measures to decide if your page feels fast. WebP cuts the hero photo by 50–70%, dropping LCP into the 'good' bucket on its own.">
                        <LcpRaceMock />
                    </Card>
                    <Card title="Pass Core Web Vitals at a glance" copy="Pages with optimized images pass the CWV threshold 3× more often than pages serving raw JPEG. Your search ranking moves with that score.">
                        <CwvGaugeMock />
                    </Card>
                    <Card title="Lower bounce, more revenue" copy="Akamai mobile retail study: every additional second of load time drops conversions by ~7%. WebP shaves seconds, not milliseconds, on image-heavy pages.">
                        <ConversionChartMock />
                    </Card>
                    <Card title="Less bandwidth = lower bills" copy="A typical e-commerce site serves 200 GB/month of images. Switch to WebP and that drops to ~60 GB. Your CDN bill follows.">
                        <BandwidthTowerMock />
                    </Card>
                </div>
            </div>
        </section>
    );
}

/* ── Stat counters (top row) ────────────────────────────────────────── */
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
            <div className="why-stat-num">{prefix}{num}<span className="why-stat-suffix">{suffix}</span></div>
            <div className="why-stat-label">{label}</div>
            <div className="why-stat-sub">{sub}</div>
        </div>
    );
}

/* ── Card wrapper ───────────────────────────────────────────────────── */
function Card({ title, copy, children }: { title: string; copy: string; children: React.ReactNode }) {
    return (
        <div className="why-card">
            <div className="why-card-mock">{children}</div>
            <div className="why-card-text">
                <div className="why-card-h">{title}</div>
                <p className="why-card-p">{copy}</p>
            </div>
        </div>
    );
}

/* ── Inline `useInView` shared by the 4 mockups ─────────────────────── */
function useInView<T extends HTMLElement>(opts: IntersectionObserverInit = { threshold: 0.35 }) {
    const ref = useRef<T>(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        if (!ref.current) return;
        const io = new IntersectionObserver(([e]) => {
            if (e?.isIntersecting) { setInView(true); io.disconnect(); }
        }, opts);
        io.observe(ref.current);
        return () => io.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return { ref, inView };
}

/* ── 1. LCP race ────────────────────────────────────────────────────── */
function LcpRaceMock() {
    const { ref, inView } = useInView<HTMLDivElement>();
    return (
        <div ref={ref} className={`mk-race ${inView ? "mk-on" : ""}`}>
            <div className="mk-race-row">
                <div className="mk-race-label">JPEG</div>
                <div className="mk-race-track">
                    <div className="mk-race-fill mk-race-fill-slow" />
                    <div className="mk-race-marker mk-race-marker-slow">
                        LCP <strong>3.2s</strong>
                    </div>
                </div>
            </div>
            <div className="mk-race-row">
                <div className="mk-race-label">WebP</div>
                <div className="mk-race-track">
                    <div className="mk-race-fill mk-race-fill-fast" />
                    <div className="mk-race-marker mk-race-marker-fast">
                        LCP <strong>1.1s</strong>
                    </div>
                </div>
            </div>
            <div className="mk-race-ruler">
                <span>0s</span><span>1s</span><span>2s</span><span>3s</span>
            </div>
            <div className="mk-race-savings">Saved <strong>2.1s</strong> per page load</div>
        </div>
    );
}

/* ── 2. CWV gauges ──────────────────────────────────────────────────── */
function CwvGaugeMock() {
    const { ref, inView } = useInView<HTMLDivElement>();
    return (
        <div ref={ref} className={`mk-gauges ${inView ? "mk-on" : ""}`}>
            {[
                { label: "LCP", score: 0.92, value: "1.1s" },
                { label: "INP", score: 0.88, value: "120ms" },
                { label: "CLS", score: 0.95, value: "0.02" },
            ].map((g, i) => (
                <Gauge key={g.label} {...g} delay={i * 150} />
            ))}
        </div>
    );
}
function Gauge({ label, score, value, delay }: { label: string; score: number; value: string; delay: number }) {
    // Circumference of an r=32 circle ≈ 201. We dash it to score% on view.
    const C = 2 * Math.PI * 32;
    return (
        <div className="mk-gauge" style={{ animationDelay: delay + "ms" }}>
            <svg viewBox="0 0 80 80" width="80" height="80">
                <circle cx="40" cy="40" r="32" stroke="var(--line-2)" strokeWidth="6" fill="none" />
                <circle
                    cx="40" cy="40" r="32"
                    stroke="var(--success)"
                    strokeWidth="6"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={C}
                    strokeDashoffset={C}
                    transform="rotate(-90 40 40)"
                    className="mk-gauge-arc"
                    style={{ "--arc": C * (1 - score), "--delay": delay + "ms" } as React.CSSProperties}
                />
                <text x="40" y="44" textAnchor="middle" fontSize="14" fontWeight="600" fill="currentColor" fontFamily="var(--font-geist-mono)">
                    {value}
                </text>
            </svg>
            <div className="mk-gauge-label">{label}</div>
        </div>
    );
}

/* ── 3. Conversion vs load-time bar chart ───────────────────────────── */
function ConversionChartMock() {
    const { ref, inView } = useInView<HTMLDivElement>();
    const bars = [
        { x: "1s", h: 100, c: "good" },
        { x: "2s", h: 88,  c: "good" },
        { x: "3s", h: 70,  c: "warn" },
        { x: "4s", h: 50,  c: "bad"  },
        { x: "5s", h: 32,  c: "bad"  },
    ];
    return (
        <div ref={ref} className={`mk-bars ${inView ? "mk-on" : ""}`}>
            <div className="mk-bars-axis-y">
                <span>conv.</span>
            </div>
            <div className="mk-bars-stage">
                <div className="mk-bars-baseline" />
                <div className="mk-bars-row">
                    {bars.map((b, i) => (
                        <div key={b.x} className="mk-bar-col">
                            <div className={`mk-bar mk-bar-${b.c}`} style={{ height: b.h + "%", animationDelay: 80 * i + "ms" }}>
                                <span className="mk-bar-pop">−{100 - b.h}%</span>
                            </div>
                            <div className="mk-bar-x">{b.x}</div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="mk-bars-cite">load time → conversions</div>
        </div>
    );
}

/* ── 4. Bandwidth tower ─────────────────────────────────────────────── */
function BandwidthTowerMock() {
    const { ref, inView } = useInView<HTMLDivElement>();
    const [gb, setGb] = useState(200);
    useEffect(() => {
        if (!inView) return;
        const start = performance.now();
        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / 1400);
            const eased = 1 - Math.pow(1 - t, 3);
            setGb(200 - (200 - 60) * eased);
            if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }, [inView]);
    return (
        <div ref={ref} className={`mk-tower ${inView ? "mk-on" : ""}`}>
            <div className="mk-tower-col">
                <div className="mk-tower-top">200 GB</div>
                <div className="mk-tower-stack mk-tower-stack-jpeg">
                    {Array.from({ length: 10 }, (_, i) => (
                        <div key={i} className="mk-tower-cell" />
                    ))}
                </div>
                <div className="mk-tower-base">JPEG</div>
            </div>
            <div className="mk-tower-arrow">→</div>
            <div className="mk-tower-col">
                <div className="mk-tower-top mk-tower-top-good">{Math.round(gb)} GB</div>
                <div className="mk-tower-stack mk-tower-stack-webp">
                    {Array.from({ length: 3 }, (_, i) => (
                        <div key={i} className="mk-tower-cell mk-tower-cell-good" style={{ animationDelay: 150 * i + "ms" }} />
                    ))}
                </div>
                <div className="mk-tower-base">WebP</div>
            </div>
            <div className="mk-tower-savings">−70%<br /><span>per month</span></div>
        </div>
    );
}

const css = `
.why-section { padding: 96px 0; border-top: 1px solid var(--line); background: var(--bg-2); }
.why-container { max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 3vw, 24px); }
.why-head { text-align: center; max-width: 720px; margin: 0 auto 48px; }
.why-eyebrow { font-family: var(--font-geist-mono), monospace; font-size: 11px; letter-spacing: 0.04em; color: var(--ink-3); }
.why-h { font-family: var(--font-geist-sans), sans-serif; font-size: clamp(28px, 4.4vw, 48px); letter-spacing: -0.035em; font-weight: 600; line-height: 1.08; margin: 10px 0 14px; color: var(--ink); text-wrap: balance; }
.why-h-mark { background: linear-gradient(180deg, transparent 65%, color-mix(in oklab, var(--success) 38%, transparent) 65%); padding: 0 4px; }
.why-lead { font-size: 16px; color: var(--ink-2); line-height: 1.6; }
.why-lead strong { color: var(--ink); }

/* Top stats */
.why-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 56px; }
@media (max-width: 760px) { .why-stats { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 460px) { .why-stats { grid-template-columns: 1fr; } }
.why-stat { padding: 24px 22px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); display: flex; flex-direction: column; gap: 4px; }
.why-stat-num { font-family: var(--font-geist-sans), sans-serif; font-size: 40px; font-weight: 600; letter-spacing: -0.04em; line-height: 1; color: var(--ink); font-variant-numeric: tabular-nums; }
.why-stat-suffix { font-size: 22px; color: var(--ink-3); font-weight: 500; margin-left: 2px; }
.why-stat-label { font-size: 13.5px; color: var(--ink); font-weight: 600; margin-top: 6px; }
.why-stat-sub { font-size: 12.5px; color: var(--ink-3); line-height: 1.5; margin-top: 2px; }

/* Cards (2 cols) */
.why-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
@media (max-width: 880px) { .why-grid { grid-template-columns: 1fr; } }
.why-card {
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
  overflow: hidden;
  display: flex; flex-direction: column;
  transition: border-color .15s, transform .15s;
}
.why-card:hover { border-color: var(--line-2); transform: translateY(-2px); }
.why-card-mock {
  height: 200px;
  background: linear-gradient(180deg, var(--bg-2), var(--surface));
  border-bottom: 1px solid var(--line);
  display: flex; align-items: center; justify-content: center;
  padding: 18px;
  position: relative; overflow: hidden;
}
.why-card-text { padding: 22px 24px 24px; }
.why-card-h { font-size: 16px; font-weight: 600; color: var(--ink); letter-spacing: -0.015em; margin-bottom: 6px; }
.why-card-p { font-size: 13.5px; color: var(--ink-2); line-height: 1.6; margin: 0; }

/* ── Mockup 1 — LCP race ────────────────────────────────────────────── */
.mk-race { width: 100%; max-width: 380px; display: flex; flex-direction: column; gap: 12px; font-family: var(--font-geist-mono), monospace; }
.mk-race-row { display: grid; grid-template-columns: 44px 1fr; align-items: center; gap: 10px; }
.mk-race-label { font-size: 10.5px; color: var(--ink-3); text-align: right; letter-spacing: 0.04em; }
.mk-race-track { position: relative; height: 12px; background: var(--bg-2); border: 1px solid var(--line); border-radius: 6px; overflow: visible; }
.mk-race-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 6px; transform-origin: left; transform: scaleX(0); }
.mk-race-fill-slow { background: linear-gradient(90deg, #f5a524, #f97316, #ef4444); width: 100%; }
.mk-race-fill-fast { background: linear-gradient(90deg, var(--success), #22c55e); width: 33%; }
.mk-race-marker { position: absolute; top: -22px; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 500; opacity: 0; transform: translateY(4px); white-space: nowrap; }
.mk-race-marker strong { font-weight: 700; }
.mk-race-marker-slow { right: 0; transform: translate(50%, 4px); background: rgba(239, 68, 68, 0.15); color: #ef4444; }
.mk-race-marker-fast { left: 33%; transform: translate(-50%, 4px); background: rgba(16, 185, 129, 0.18); color: var(--success); }
.mk-on .mk-race-fill-slow { animation: mkFillSlow 2.4s cubic-bezier(.4,0,.2,1) forwards; }
.mk-on .mk-race-fill-fast { animation: mkFillFast 0.9s cubic-bezier(.4,0,.2,1) forwards; }
.mk-on .mk-race-marker-slow { animation: mkPop 400ms ease 2.4s forwards; }
.mk-on .mk-race-marker-fast { animation: mkPop 400ms ease 0.9s forwards; }
@keyframes mkFillSlow { to { transform: scaleX(1); } }
@keyframes mkFillFast { to { transform: scaleX(1); } }
@keyframes mkPop { to { opacity: 1; transform: var(--mk-pop-end, translateY(0)); } }
.mk-race-marker-slow { --mk-pop-end: translate(50%, 0); }
.mk-race-marker-fast { --mk-pop-end: translate(-50%, 0); }
.mk-race-ruler { display: grid; grid-template-columns: 44px 1fr; gap: 10px; padding-top: 4px; }
.mk-race-ruler > span:first-child { visibility: hidden; }
.mk-race-ruler > span:nth-child(n+2) { display: none; }
.mk-race-ruler { display: flex; padding-left: 54px; justify-content: space-between; font-size: 9.5px; color: var(--ink-3); }
.mk-race-ruler > span { display: inline-block !important; visibility: visible !important; }
.mk-race-savings { margin-top: 4px; font-family: var(--font-geist-sans), sans-serif; font-size: 11.5px; color: var(--ink-2); text-align: center; opacity: 0; }
.mk-race-savings strong { color: var(--success); font-weight: 600; }
.mk-on .mk-race-savings { animation: mkRise 500ms ease 2.8s forwards; }
@keyframes mkRise { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

/* ── Mockup 2 — CWV gauges ──────────────────────────────────────────── */
.mk-gauges { display: flex; gap: 18px; align-items: center; justify-content: center; }
.mk-gauge { display: flex; flex-direction: column; align-items: center; gap: 4px; opacity: 0; transform: translateY(8px); }
.mk-on .mk-gauge { animation: mkRise 500ms ease forwards; animation-delay: var(--delay, 0ms); }
.mk-gauge-arc { transition: stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1); }
.mk-on .mk-gauge-arc { stroke-dashoffset: var(--arc, 0); transition-delay: var(--delay, 0ms); }
.mk-gauge text { dominant-baseline: middle; }
.mk-gauge-label { font-family: var(--font-geist-mono), monospace; font-size: 10.5px; color: var(--ink-3); letter-spacing: 0.04em; }

/* ── Mockup 3 — Conversion bars ─────────────────────────────────────── */
.mk-bars { display: flex; gap: 8px; align-items: stretch; padding: 4px 8px; height: 100%; max-width: 360px; }
.mk-bars-axis-y { display: flex; align-items: center; }
.mk-bars-axis-y span { writing-mode: vertical-rl; transform: rotate(180deg); font-family: var(--font-geist-mono), monospace; font-size: 9.5px; color: var(--ink-3); letter-spacing: 0.04em; }
.mk-bars-stage { flex: 1; display: flex; flex-direction: column; }
.mk-bars-baseline { height: 0; border-top: 1px dashed var(--line-2); margin-top: 12px; flex-shrink: 0; }
.mk-bars-row { flex: 1; display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; align-items: end; padding-bottom: 4px; }
.mk-bar-col { display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; justify-content: end; }
.mk-bar { width: 100%; max-width: 28px; border-radius: 4px 4px 0 0; transform: scaleY(0); transform-origin: bottom; position: relative; min-height: 8px; }
.mk-bar-good { background: linear-gradient(180deg, var(--success), #16a34a); }
.mk-bar-warn { background: linear-gradient(180deg, #f5a524, #d97706); }
.mk-bar-bad  { background: linear-gradient(180deg, #ef4444, #b91c1c); }
.mk-on .mk-bar { animation: mkBarGrow 700ms cubic-bezier(.16,1,.3,1) forwards; }
@keyframes mkBarGrow { to { transform: scaleY(1); } }
.mk-bar-x { font-family: var(--font-geist-mono), monospace; font-size: 9.5px; color: var(--ink-3); }
.mk-bar-pop { position: absolute; top: -16px; left: 50%; transform: translate(-50%, 4px); font-family: var(--font-geist-mono), monospace; font-size: 9px; font-weight: 600; color: var(--ink); opacity: 0; white-space: nowrap; }
.mk-on .mk-bar-bad .mk-bar-pop { animation: mkRise 400ms ease 1.1s forwards; }
.mk-bars-cite { writing-mode: vertical-rl; transform: rotate(180deg); font-family: var(--font-geist-mono), monospace; font-size: 9px; color: var(--ink-3); letter-spacing: 0.04em; align-self: center; }

/* ── Mockup 4 — Bandwidth tower ─────────────────────────────────────── */
.mk-tower { display: flex; align-items: end; justify-content: center; gap: 14px; height: 100%; padding: 4px 8px; }
.mk-tower-col { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.mk-tower-top { font-family: var(--font-geist-mono), monospace; font-size: 11px; font-weight: 600; color: var(--ink); padding-bottom: 4px; font-variant-numeric: tabular-nums; }
.mk-tower-top-good { color: var(--success); }
.mk-tower-stack { display: flex; flex-direction: column-reverse; gap: 2px; width: 36px; }
.mk-tower-cell { height: 12px; background: linear-gradient(180deg, #f97316, #ea580c); border-radius: 2px; transform: scaleY(0); transform-origin: bottom; }
.mk-tower-cell-good { background: linear-gradient(180deg, var(--success), #16a34a); }
.mk-on .mk-tower-stack-jpeg .mk-tower-cell { animation: mkBarGrow 500ms cubic-bezier(.16,1,.3,1) forwards; }
.mk-on .mk-tower-stack-jpeg .mk-tower-cell:nth-child(1) { animation-delay: 0ms; }
.mk-on .mk-tower-stack-jpeg .mk-tower-cell:nth-child(2) { animation-delay: 60ms; }
.mk-on .mk-tower-stack-jpeg .mk-tower-cell:nth-child(3) { animation-delay: 120ms; }
.mk-on .mk-tower-stack-jpeg .mk-tower-cell:nth-child(4) { animation-delay: 180ms; }
.mk-on .mk-tower-stack-jpeg .mk-tower-cell:nth-child(5) { animation-delay: 240ms; }
.mk-on .mk-tower-stack-jpeg .mk-tower-cell:nth-child(6) { animation-delay: 300ms; }
.mk-on .mk-tower-stack-jpeg .mk-tower-cell:nth-child(7) { animation-delay: 360ms; }
.mk-on .mk-tower-stack-jpeg .mk-tower-cell:nth-child(8) { animation-delay: 420ms; }
.mk-on .mk-tower-stack-jpeg .mk-tower-cell:nth-child(9) { animation-delay: 480ms; }
.mk-on .mk-tower-stack-jpeg .mk-tower-cell:nth-child(10) { animation-delay: 540ms; }
.mk-on .mk-tower-stack-webp .mk-tower-cell { animation: mkBarGrow 500ms cubic-bezier(.16,1,.3,1) forwards; }
.mk-tower-base { font-family: var(--font-geist-mono), monospace; font-size: 9.5px; color: var(--ink-3); letter-spacing: 0.04em; padding-top: 4px; border-top: 1px solid var(--line); margin-top: 4px; width: 100%; text-align: center; }
.mk-tower-arrow { font-size: 18px; color: var(--ink-3); padding-bottom: 28px; }
.mk-tower-savings { margin-left: 10px; padding: 8px 12px; border: 1px solid color-mix(in oklab, var(--success) 35%, transparent); background: color-mix(in oklab, var(--success) 10%, transparent); border-radius: 8px; text-align: center; font-family: var(--font-geist-sans), sans-serif; font-size: 18px; font-weight: 700; color: var(--success); line-height: 1; }
.mk-tower-savings span { display: block; font-size: 9px; font-weight: 500; color: var(--ink-3); margin-top: 2px; letter-spacing: 0.04em; text-transform: uppercase; }

@media (prefers-reduced-motion: reduce) {
  .mk-race-fill-slow, .mk-race-fill-fast { transform: scaleX(1) !important; animation: none !important; }
  .mk-race-marker, .mk-race-savings { opacity: 1 !important; transform: none !important; animation: none !important; }
  .mk-gauge { opacity: 1 !important; transform: none !important; animation: none !important; }
  .mk-gauge-arc { stroke-dashoffset: var(--arc, 0) !important; transition: none !important; }
  .mk-bar, .mk-tower-cell { transform: scaleY(1) !important; animation: none !important; }
  .mk-bar-pop { opacity: 1 !important; transform: translate(-50%, 0) !important; animation: none !important; }
}
`;
