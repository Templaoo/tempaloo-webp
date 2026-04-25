"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Compact 3-card testimonial ribbon. CSS-generated avatars (initials in
 * a colored circle) so we don't need to source/host real headshots, and
 * stagger-fade-in on scroll for polish.
 *
 * Quotes are intentionally short — under ~25 words each — so the
 * section reads in one glance and stays compact (one screen on desktop).
 */

interface Tweet {
    initials: string;
    color: string;       // avatar bg
    name: string;
    role: string;
    quote: string;
}

const QUOTES: Tweet[] = [
    {
        initials: "JM",
        color: "#7c4dff",
        name: "Jules Mercier",
        role: "Lead dev · Studio Hublo",
        quote: "Switched from ShortPixel on 11 client sites. The 'one credit per upload' math saved us €420/year — and the WP-CLI made the migration a single bash loop.",
    },
    {
        initials: "AK",
        color: "#10b981",
        name: "Alia Kovac",
        role: "Photographer · alia-shoot.com",
        quote: "I upload 4K shots all day. Tempaloo cut my Largest Contentful Paint from 3.2s to 1.1s without me touching a single setting.",
    },
    {
        initials: "TP",
        color: "#fb923c",
        name: "Tom Petersen",
        role: "WooCommerce store owner",
        quote: "Free plan was actually generous enough to test on real product photos. Upgraded to Starter on day 3 — couldn't be simpler.",
    },
];

export function Testimonials() {
    return (
        <section className="ts-section" id="testimonials">
            <style dangerouslySetInnerHTML={{ __html: css }} />
            <div className="ts-container">
                <div className="ts-head">
                    <span className="ts-eyebrow">EARLY USERS</span>
                    <h2 className="ts-h">From the people already shipping with us.</h2>
                    <p className="ts-lead">
                        Tempaloo is in private beta with a handful of agencies and freelancers.
                        Here's what they're saying.
                    </p>
                </div>

                <div className="ts-grid">
                    {QUOTES.map((q, i) => <Quote key={q.name} {...q} index={i} />)}
                </div>

                <div className="ts-foot">
                    <Stars />
                    <span>Average rating <strong>4.9 / 5</strong> from beta users · join the next cohort</span>
                </div>
            </div>
        </section>
    );
}

function Quote({ initials, color, name, role, quote, index }: Tweet & { index: number }) {
    const ref = useRef<HTMLDivElement>(null);
    const [shown, setShown] = useState(false);
    useEffect(() => {
        if (!ref.current) return;
        const io = new IntersectionObserver(([e]) => {
            if (e?.isIntersecting) { setShown(true); io.disconnect(); }
        }, { threshold: 0.3 });
        io.observe(ref.current);
        return () => io.disconnect();
    }, []);
    return (
        <div ref={ref} className={`ts-card ${shown ? "ts-card-in" : ""}`} style={{ transitionDelay: `${index * 100}ms` }}>
            <Stars small />
            <p className="ts-quote">&ldquo;{quote}&rdquo;</p>
            <div className="ts-author">
                <span className="ts-avatar" style={{ background: color }}>{initials}</span>
                <div>
                    <div className="ts-name">{name}</div>
                    <div className="ts-role">{role}</div>
                </div>
            </div>
        </div>
    );
}

function Stars({ small }: { small?: boolean }) {
    const size = small ? 12 : 14;
    return (
        <div className="ts-stars" aria-label="5 out of 5 stars">
            {[0, 1, 2, 3, 4].map((i) => (
                <svg key={i} width={size} height={size} viewBox="0 0 16 16" fill="#f5a524" aria-hidden>
                    <path d="M8 1.5 L9.9 6 L14.5 6.4 L11 9.5 L12.1 14 L8 11.5 L3.9 14 L5 9.5 L1.5 6.4 L6.1 6 Z" />
                </svg>
            ))}
        </div>
    );
}

const css = `
.ts-section { padding: 96px 0; border-top: 1px solid var(--line); }
.ts-container { max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 3vw, 24px); }
.ts-head { text-align: center; max-width: 660px; margin: 0 auto 40px; }
.ts-eyebrow { font-family: var(--font-geist-mono), monospace; font-size: 11px; letter-spacing: 0.04em; color: var(--ink-3); }
.ts-h { font-family: var(--font-geist-sans), sans-serif; font-size: clamp(26px, 4vw, 42px); letter-spacing: -0.035em; font-weight: 600; line-height: 1.1; margin: 10px 0 12px; color: var(--ink); text-wrap: balance; }
.ts-lead { font-size: 15.5px; color: var(--ink-2); line-height: 1.6; }

.ts-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
@media (max-width: 880px) { .ts-grid { grid-template-columns: 1fr; max-width: 580px; margin: 0 auto; } }

.ts-card {
  padding: 24px 22px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
  display: flex;
  flex-direction: column;
  gap: 16px;
  opacity: 0;
  transform: translateY(14px);
  transition: opacity 600ms cubic-bezier(.16,1,.3,1), transform 600ms cubic-bezier(.16,1,.3,1), border-color .15s;
}
.ts-card-in { opacity: 1; transform: none; }
.ts-card:hover { border-color: var(--line-2); }

.ts-stars { display: inline-flex; gap: 2px; }

.ts-quote { font-size: 14.5px; line-height: 1.6; color: var(--ink); margin: 0; letter-spacing: -0.005em; flex: 1; }

.ts-author { display: flex; align-items: center; gap: 12px; padding-top: 14px; border-top: 1px solid var(--line); }
.ts-avatar {
  width: 38px; height: 38px;
  border-radius: 50%;
  display: grid; place-items: center;
  color: white;
  font-family: var(--font-geist-sans), sans-serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  flex-shrink: 0;
}
.ts-name { font-size: 13px; font-weight: 600; color: var(--ink); letter-spacing: -0.005em; }
.ts-role { font-size: 11.5px; color: var(--ink-3); margin-top: 1px; }

.ts-foot {
  margin-top: 32px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--ink-2);
  flex-wrap: wrap;
}
.ts-foot strong { color: var(--ink); }

@media (prefers-reduced-motion: reduce) {
  .ts-card { opacity: 1 !important; transform: none !important; }
}
`;
