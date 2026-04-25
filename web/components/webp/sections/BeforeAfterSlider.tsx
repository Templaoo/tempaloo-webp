"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Drag-to-reveal before/after slider, the iconic visual on every image
 * optimization landing page. Pure CSS + a 30-line drag handler — no
 * library, no images, the photo is rendered as SVG so it looks crisp at
 * any size and scales with the layout.
 *
 * On first scroll-into-view, the divider auto-animates 0 → 100 → 50 so
 * users notice the affordance even without touching the mouse.
 */
export function BeforeAfterSlider() {
    const wrapRef = useRef<HTMLDivElement>(null);
    const [pct, setPct] = useState(50);
    const draggingRef = useRef(false);
    const animatedOnceRef = useRef(false);

    useEffect(() => {
        if (!wrapRef.current) return;
        const io = new IntersectionObserver(([e]) => {
            if (!e?.isIntersecting || animatedOnceRef.current) return;
            animatedOnceRef.current = true;
            // Tease: slide right then back to 50%
            const start = performance.now();
            const tween = (now: number) => {
                const t = Math.min(1, (now - start) / 1600);
                let v: number;
                if (t < 0.4)      v = lerp(50, 88, t / 0.4);                       // → 88
                else if (t < 0.7) v = lerp(88, 18, (t - 0.4) / 0.3);               // → 18
                else              v = lerp(18, 50, (t - 0.7) / 0.3);               // → 50
                setPct(v);
                if (t < 1) requestAnimationFrame(tween);
            };
            requestAnimationFrame(tween);
        }, { threshold: 0.4 });
        io.observe(wrapRef.current);
        return () => io.disconnect();
    }, []);

    const onPointerDown = (e: React.PointerEvent) => {
        draggingRef.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        update(e.clientX);
    };
    const onPointerMove = (e: React.PointerEvent) => {
        if (!draggingRef.current) return;
        update(e.clientX);
    };
    const onPointerUp = () => { draggingRef.current = false; };
    const update = (clientX: number) => {
        const r = wrapRef.current?.getBoundingClientRect();
        if (!r) return;
        const x = ((clientX - r.left) / r.width) * 100;
        setPct(Math.max(0, Math.min(100, x)));
    };

    return (
        <section className="ba-section">
            <style dangerouslySetInnerHTML={{ __html: css }} />
            <div className="ba-container">
                <div className="ba-head">
                    <span className="ba-eyebrow">SEE IT FOR YOURSELF</span>
                    <h2 className="ba-h">Drag to reveal — same photo, 67% lighter.</h2>
                    <p className="ba-lead">
                        Modern WebP compression at q=82 is visually indistinguishable from the JPEG
                        original. The browser only downloads the lighter version.
                    </p>
                </div>

                <div
                    ref={wrapRef}
                    className="ba-wrap"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerLeave={onPointerUp}
                    role="slider"
                    aria-label="Drag to compare original vs compressed"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(pct)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === "ArrowLeft")  setPct(p => Math.max(0, p - 5));
                        if (e.key === "ArrowRight") setPct(p => Math.min(100, p + 5));
                    }}
                >
                    {/* AFTER (clean compressed image) — full width baseline */}
                    <div className="ba-img" aria-hidden>
                        <Photo />
                    </div>

                    {/* BEFORE (original) clipped from the left up to `pct`% */}
                    <div className="ba-img ba-img-before" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }} aria-hidden>
                        <Photo dim />
                    </div>

                    {/* Labels */}
                    <span className="ba-label ba-label-before">
                        Original · <strong>1.24 MB</strong>
                    </span>
                    <span className="ba-label ba-label-after">
                        WebP · <strong>412 KB</strong> · <span className="ba-label-saved">−67%</span>
                    </span>

                    {/* Divider + handle */}
                    <div className="ba-divider" style={{ left: `${pct}%` }} aria-hidden>
                        <div className="ba-handle">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M5 3 L2 7 L5 11 M9 3 L12 7 L9 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="ba-foot">
                    <span className="ba-foot-num"><strong>−67%</strong> file size</span>
                    <span className="ba-foot-sep" />
                    <span className="ba-foot-num"><strong>0%</strong> visible quality loss</span>
                    <span className="ba-foot-sep" />
                    <span className="ba-foot-num"><strong>1 credit</strong> · all 7 thumbnail sizes included</span>
                </div>
            </div>
        </section>
    );
}

function Photo({ dim }: { dim?: boolean }) {
    return (
        <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
            <defs>
                <linearGradient id={`bag${dim ? "d" : "c"}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={dim ? "#dcb89a" : "#f3d4a8"} />
                    <stop offset="0.45" stopColor={dim ? "#c47e58" : "#e08a52"} />
                    <stop offset="1" stopColor={dim ? "#5a2e16" : "#7a3a18"} />
                </linearGradient>
                <radialGradient id={`bsun${dim ? "d" : "c"}`} cx="0.78" cy="0.32" r="0.18">
                    <stop offset="0" stopColor={dim ? "#fff5c6" : "#fff9d4"} stopOpacity="1" />
                    <stop offset="1" stopColor={dim ? "#fff5c6" : "#fff9d4"} stopOpacity="0" />
                </radialGradient>
                {dim && (
                    <filter id="bnoise">
                        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
                        <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0" />
                        <feComposite in2="SourceGraphic" operator="in" />
                    </filter>
                )}
            </defs>
            <rect width="1200" height="380" fill={`url(#bag${dim ? "d" : "c"})`} />
            <circle cx="938" cy="190" r="56" fill={`url(#bsun${dim ? "d" : "c"})`} />
            <rect y="380" width="1200" height="220" fill="#0d0a05" />
            {/* Mountain silhouettes */}
            <path d="M0 380 L120 270 L210 320 L320 230 L450 310 L600 200 L760 290 L900 240 L1080 320 L1200 270 L1200 380 Z" fill="#160d05" />
            <path d="M0 380 L80 340 L180 360 L280 320 L420 365 L560 330 L720 360 L880 325 L1040 365 L1200 340 L1200 380 Z" fill="#1f1308" opacity="0.85" />
            {/* Trees / details */}
            <g fill="#0a0603">
                <path d="M180 380 L195 340 L210 380 Z" />
                <path d="M340 380 L360 320 L380 380 Z" />
                <path d="M820 380 L840 335 L860 380 Z" />
            </g>
            {dim && <rect width="1200" height="600" filter="url(#bnoise)" />}
        </svg>
    );
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

const css = `
.ba-section { padding: 64px 0; border-top: 1px solid var(--line); }
.ba-container { max-width: 1080px; margin: 0 auto; padding: 0 clamp(16px, 3vw, 24px); }
.ba-head { text-align: center; max-width: 640px; margin: 0 auto 32px; }
.ba-eyebrow { font-family: var(--font-geist-mono), monospace; font-size: 11px; letter-spacing: 0.04em; color: var(--ink-3); }
.ba-h { font-family: var(--font-geist-sans), sans-serif; font-size: clamp(26px, 4vw, 42px); letter-spacing: -0.035em; font-weight: 600; line-height: 1.1; margin: 10px 0 12px; color: var(--ink); text-wrap: balance; }
.ba-lead { font-size: 15.5px; line-height: 1.6; color: var(--ink-2); }

.ba-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 1;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--line-2);
  box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 24px 48px -24px rgba(0,0,0,0.18);
  cursor: ew-resize;
  user-select: none;
  touch-action: none;
}
.ba-img { position: absolute; inset: 0; width: 100%; height: 100%; }
.ba-img-before { transition: clip-path .05s linear; }
.ba-img svg { display: block; width: 100%; height: 100%; }

.ba-label { position: absolute; top: 14px; padding: 5px 10px; border-radius: 6px; font-family: var(--font-geist-mono), monospace; font-size: 11.5px; color: white; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); pointer-events: none; }
.ba-label strong { font-weight: 600; }
.ba-label-before { left: 14px; background: rgba(0, 0, 0, 0.55); }
.ba-label-after  { right: 14px; background: rgba(16, 185, 129, 0.85); }
.ba-label-saved  { font-weight: 700; }

.ba-divider {
  position: absolute; top: 0; bottom: 0;
  width: 2px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.18);
  transform: translateX(-1px);
  pointer-events: none;
}
.ba-handle {
  position: absolute; top: 50%; left: 50%;
  width: 38px; height: 38px;
  margin: -19px 0 0 -19px;
  background: rgba(255, 255, 255, 0.96);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #0a0a0a;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18), 0 0 0 4px rgba(0, 0, 0, 0.08);
  pointer-events: auto;
  cursor: grab;
}
.ba-handle:active { cursor: grabbing; }

.ba-foot {
  display: flex; flex-wrap: wrap; justify-content: center; align-items: center;
  gap: 14px 24px; margin-top: 24px;
  font-size: 13px; color: var(--ink-2);
}
.ba-foot strong { color: var(--ink); font-weight: 600; }
.ba-foot-sep { width: 1px; height: 14px; background: var(--line-2); display: inline-block; }
@media (max-width: 600px) {
  .ba-foot-sep { display: none; }
  .ba-label { font-size: 10.5px; padding: 4px 8px; }
}
@media (prefers-reduced-motion: reduce) {
  .ba-img-before { transition: none; }
}
`;
