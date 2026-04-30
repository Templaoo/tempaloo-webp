"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { trackCtaClick, type TrackPlan } from "@/lib/track";
import type { Plan as ApiPlan } from "@/lib/plans";
import { BeforeAfterSlider } from "@/components/webp/sections/BeforeAfterSlider";
import { WhyMatters }        from "@/components/webp/sections/WhyMatters";
import { WhatsNew }          from "@/components/webp/sections/WhatsNew";

type Theme = "light" | "dark";
type Billing = "monthly" | "annual";

// Internal shape used by the pricing cards. Derived from the API Plan
// (single source of truth) via `toCardPlan` below.
interface CardPlan {
    id: ApiPlan["code"];
    name: string;
    tagline: string;
    monthly: number;
    annual: number;        // monthly-equivalent after the annual discount
    annualTotal: number;
    quota: string;
    quotaUnit: string;
    sites: string;
    badge?: string;
    highlight?: boolean;
    features: string[];
    cta: string;
}

function toCardPlan(p: ApiPlan): CardPlan {
    // Format raw numbers into the two-part "5,000 /mo" shape the cards expect.
    let quota: string;
    let quotaUnit: string;
    if (p.imagesLimit === -1) {
        quota = "Unlimited";
        quotaUnit = p.fairUseCap ? `fair use ${(p.fairUseCap / 1000).toFixed(0)}k` : "";
    } else {
        quota = p.imagesLimit.toLocaleString("en-US");
        quotaUnit = "/mo";
    }
    return {
        id: p.code,
        name: p.name,
        tagline: p.tagline,
        monthly: p.priceMonthly,
        annual: p.priceAnnual > 0 ? p.priceAnnual / 12 : 0,
        annualTotal: p.priceAnnual,
        quota,
        quotaUnit,
        sites: p.sites,
        badge: p.badge,
        highlight: p.highlight,
        features: p.features,
        cta: p.cta,
    };
}

const FAQS = [
    { q: "Do you charge per thumbnail like ShortPixel or Elementor?",
      a: "No — and that's the main reason people switch. WordPress generates 6-8 thumbnails for every image you upload. ShortPixel, Imagify, Elementor Image Optimizer count each of those as a separate credit. We count the upload itself: 1 image uploaded = 1 credit, no matter how many sizes WordPress creates. In practice you get 6-8× more conversions for the same price." },
    { q: "Do I need Elementor, Gutenberg or any specific page builder?",
      a: "No. Our plugin is a standalone WordPress plugin — it works with Gutenberg, Elementor, Bricks, Divi, Beaver Builder, classic editor, WooCommerce, and any theme. You are never locked into an ecosystem." },
    { q: "What happens to my unused images at the end of the month?",
      a: "They roll over automatically for 30 days, capped at one month's worth of your plan. Example: on Starter (5,000/mo), if you only use 2,000 in March, April opens at 8,000 available. No more \"use it or lose it\"." },
    { q: "What happens if I hit my quota?",
      a: "New uploads simply stop being converted until next month, or until you upgrade in one click. Images already optimized keep being served as WebP — nothing breaks." },
    { q: "Are there any limits on the Free plan beyond the 250 images/month?",
      a: "Just one: bulk runs (manual conversion of your existing media library) are capped at 50 images per day on Free. Auto-conversion of new uploads stays unlimited within your monthly quota — so a normal blog or portfolio never hits the cap. The cap only exists to prevent agencies from one-shot-migrating large client sites on a free key. Upgrading to any paid plan removes it entirely." },
    { q: "Do you keep my images?",
      a: "No. Conversion happens in-memory and the converted file is streamed back to your site. Originals stay on your server, untouched. We are not a storage service." },
    { q: "Can I cancel anytime? What about refunds?",
      a: "Cancel any day, in one click, no penalty. All paid plans include a 7-day free trial. The 30-day money-back guarantee covers your first paid charge if you've used less than 20% of your plan's monthly conversions in good faith — full details in our Terms §4." },
    { q: "Do you support AVIF?",
      a: "Yes, on Starter and above. AVIF produces ~20% smaller files than WebP at equivalent quality and is supported by every major modern browser." },
];

const activateHref = (plan: CardPlan["id"], billing: Billing) => `/webp/activate?plan=${plan}&billing=${billing}`;

function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        if (typeof window === "undefined") return;
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => setReduced(mq.matches);
        update();
        mq.addEventListener("change", update);
        return () => mq.removeEventListener("change", update);
    }, []);
    return reduced;
}

/** Mark an element as visible the first time it enters the viewport. */
function useInView<T extends HTMLElement = HTMLDivElement>(
    options: IntersectionObserverInit = { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
): { ref: React.RefObject<T>; inView: boolean } {
    const ref = useRef<T>(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        if (!ref.current || typeof IntersectionObserver === "undefined") {
            setInView(true);
            return;
        }
        const io = new IntersectionObserver(([entry]) => {
            if (entry?.isIntersecting) {
                setInView(true);
                io.disconnect();
            }
        }, options);
        io.observe(ref.current);
        return () => io.disconnect();
    }, [options]);
    return { ref, inView };
}

/** Animated counter from 0 → target over `duration`, started only when `active`. */
function useAnimatedNumber(target: number, active: boolean, duration = 900): number {
    const reduced = usePrefersReducedMotion();
    const [value, setValue] = useState(reduced ? target : 0);
    useEffect(() => {
        if (!active || reduced) { setValue(target); return; }
        let raf = 0;
        const start = performance.now();
        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            // easeOutCubic
            const eased = 1 - Math.pow(1 - t, 3);
            setValue(target * eased);
            if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, active, duration, reduced]);
    return value;
}

function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
    const { ref, inView } = useInView<HTMLDivElement>();
    return (
        <div
            ref={ref}
            className={`pr2-reveal ${inView ? "pr2-reveal-in" : ""} ${className}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
}

export function LandingPage({ plans }: { plans: ApiPlan[] }) {
    const [theme, setThemeState] = useState<Theme>("dark");
    const [billing, setBilling] = useState<Billing>("annual");
    const [faqOpen, setFaqOpen] = useState<number>(0);
    const [scrolled, setScrolled] = useState(false);

    // Convert the API shape to card shape once per render. useMemo because the
    // conversion is referenced by multiple sections (Pricing, StickyMobileCTA).
    const cardPlans = useMemo(() => plans.map(toCardPlan), [plans]);

    useEffect(() => {
        const stored = (typeof window !== "undefined" && localStorage.getItem("tempaloo-theme")) as Theme | null;
        if (stored === "light" || stored === "dark") {
            setThemeState(stored);
            document.documentElement.setAttribute("data-theme", stored);
        }
    }, []);

    const setTheme = (next: Theme) => {
        setThemeState(next);
        document.documentElement.setAttribute("data-theme", next);
        try { localStorage.setItem("tempaloo-theme", next); } catch { /* no-op */ }
    };

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <div className="pr2-root">
            <style dangerouslySetInnerHTML={{ __html: css }} />

            <Nav theme={theme} scrolled={scrolled} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} />
            <Hero />
            <Reveal><BeforeAfterSlider /></Reveal>
            <StatsBar />
            <Reveal><WhyMatters /></Reveal>
            <Reveal><HowItWorks /></Reveal>
            <Reveal><Compatibility /></Reveal>
            <Reveal><UseCases /></Reveal>
            <Reveal><Security /></Reveal>
            <Reveal><ThumbnailTrap /></Reveal>
            <Reveal><WhatsNew /></Reveal>
            <Reveal><Pricing plans={cardPlans} billing={billing} onBillingChange={setBilling} /></Reveal>
            <Reveal><FAQ openIdx={faqOpen} onToggle={(i) => setFaqOpen(faqOpen === i ? -1 : i)} /></Reveal>
            <FinalCTA />
            <Footer />
            <StickyMobileCTA />
        </div>
    );
}

function Nav({ theme, scrolled, onToggleTheme }: { theme: Theme; scrolled: boolean; onToggleTheme: () => void }) {
    const [menuOpen, setMenuOpen] = useState(false);

    /**
     * iOS-safe scroll lock: plain `overflow: hidden` on body doesn't stop
     * the page from scrolling on Safari because the scroller is <html>.
     * Pinning the body at `position: fixed; top: -scrollY` freezes the
     * document, and we restore the scroll position on close so the user
     * lands exactly where they were.
     */
    useEffect(() => {
        if (!menuOpen) return;
        const scrollY = window.scrollY;
        const body = document.body;
        const prev = {
            position: body.style.position,
            top: body.style.top,
            left: body.style.left,
            right: body.style.right,
            width: body.style.width,
        };
        body.style.position = "fixed";
        body.style.top = `-${scrollY}px`;
        body.style.left = "0";
        body.style.right = "0";
        body.style.width = "100%";

        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
        window.addEventListener("keydown", onKey);
        return () => {
            body.style.position = prev.position;
            body.style.top = prev.top;
            body.style.left = prev.left;
            body.style.right = prev.right;
            body.style.width = prev.width;
            window.scrollTo(0, scrollY);
            window.removeEventListener("keydown", onKey);
        };
    }, [menuOpen]);

    const close = () => setMenuOpen(false);

    return (
        <>
            <nav className={`pr2-nav ${scrolled ? "pr2-nav-scrolled" : ""}`}>
                <div className="pr2-container pr2-nav-inner">
                    <Link href="/webp" className="pr2-nav-logo" aria-label="Tempaloo WebP home"><Logo /></Link>
                    <div className="pr2-nav-links" aria-label="Primary">
                        <a href="#pricing">Pricing</a>
                        <a href="#faq">FAQ</a>
                        <Link href="/docs">Docs</Link>
                        <Link href="/changelog">Changelog</Link>
                        <Link href="/contact">Contact</Link>
                    </div>
                    <div className="pr2-nav-right">
                        <button onClick={onToggleTheme} className="pr2-btn pr2-btn-ghost pr2-icon-btn" aria-label="Toggle theme">
                            {theme === "dark" ? (
                                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="3" /><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1.1 1.1M11.9 11.9L13 13M3 13l1.1-1.1M11.9 4.1L13 3" /></svg>
                            ) : (
                                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M13.5 10.2A5.5 5.5 0 0 1 5.8 2.5 5.5 5.5 0 1 0 13.5 10.2z" /></svg>
                            )}
                        </button>
                        <Link href="/sign-in" className="pr2-nav-signin">Sign in</Link>
                        <Link href="/webp/activate?plan=free" className="pr2-btn pr2-btn-primary pr2-btn-sm pr2-nav-cta" onClick={() => trackCtaClick("nav", "free")}>
                            <span className="pr2-nav-cta-label">Get started</span> <ArrowIcon />
                        </Link>
                        <button
                            type="button"
                            className="pr2-btn pr2-btn-ghost pr2-icon-btn pr2-nav-burger"
                            aria-label={menuOpen ? "Close menu" : "Open menu"}
                            aria-expanded={menuOpen}
                            aria-controls="pr2-mobile-menu"
                            onClick={() => setMenuOpen(v => !v)}
                        >
                            {menuOpen ? (
                                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 3 L13 13 M13 3 L3 13" /></svg>
                            ) : (
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2.5 4.5 H13.5 M2.5 8 H13.5 M2.5 11.5 H13.5" /></svg>
                            )}
                        </button>
                    </div>
                </div>
            </nav>

            {/* Rendered as a sibling of <nav>, not a child — a position:fixed
                drawer inside a position:sticky ancestor misbehaves on mobile
                Safari (it can scroll with the sticky). Hoisting it out of the
                sticky context guarantees the drawer stays pinned to the
                viewport. */}
            <div
                id="pr2-mobile-menu"
                className={`pr2-mobile-menu ${menuOpen ? "pr2-mobile-menu-open" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-hidden={!menuOpen}
            >
                <button type="button" className="pr2-mobile-scrim" aria-label="Close menu" tabIndex={menuOpen ? 0 : -1} onClick={close} />
                <div className="pr2-mobile-panel" onClick={(e) => e.stopPropagation()}>
                    <nav className="pr2-mobile-links" aria-label="Mobile">
                        <a href="#pricing" onClick={close}>Pricing</a>
                        <a href="#faq" onClick={close}>FAQ</a>
                        <Link href="/docs" onClick={close}>Docs</Link>
                        <Link href="/changelog" onClick={close}>Changelog</Link>
                        <Link href="/contact" onClick={close}>Contact</Link>
                    </nav>
                    <div className="pr2-mobile-ctas">
                        <Link href="/sign-in" className="pr2-btn pr2-btn-ghost" onClick={close}>Sign in</Link>
                        <Link href="/webp/activate?plan=free" className="pr2-btn pr2-btn-primary" onClick={() => { trackCtaClick("nav_mobile", "free"); close(); }}>
                            Get started <ArrowIcon />
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}

function Logo() {
    return (
        <span className="pr2-logo">
            <LogoMark size={34} />
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
    const [copied, setCopied] = useState(false);
    const copyInstallCmd = async () => {
        try {
            await navigator.clipboard.writeText("wp plugin install tempaloo-webp --activate");
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch { /* clipboard API unavailable — silent */ }
    };
    return (
        <section className="pr2-hero">
            <div className="pr2-container pr2-hero-inner">
                <span className="pr2-pill">
                    <span className="pr2-pill-dot" />
                    <span>New · WordPress 6.0+ · PHP 7.4+</span>
                </span>
                <h1 className="pr2-h-display pr2-hero-h1">
                    Faster WordPress.{" "}
                    <span className="pr2-font-serif pr2-hero-h1-accent">One upload,<br />every size.</span>
                </h1>
                <p className="pr2-hero-lead">
                    Drop-in WebP &amp; AVIF conversion that bundles every thumbnail WordPress
                    generates into a single credit. Lighter pages, green Core Web Vitals, no surprise bills.
                </p>
                <div className="pr2-hero-ctas">
                    <Link href="/webp/activate?plan=free" className="pr2-btn pr2-btn-primary" onClick={() => trackCtaClick("hero", "free")}>Get my free API key <ArrowIcon /></Link>
                    <button type="button" onClick={() => { copyInstallCmd(); trackCtaClick("hero_install_copy", "free"); }} className="pr2-btn pr2-btn-ghost" aria-label="Copy WP-CLI install command">
                        <span className="pr2-font-mono pr2-mono-sm">$</span> {copied ? "Copied ✓" : "wp plugin install"}
                    </button>
                </div>
                <ul className="pr2-trust-chips" aria-label="Risk reducers">
                    <li><CheckIcon size={11} /> 30-day money back</li>
                    <li><CheckIcon size={11} /> 7-day trial on paid plans</li>
                    <li><CheckIcon size={11} /> Cancel anytime</li>
                </ul>
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
    const reduced = usePrefersReducedMotion();
    const hostRef = useRef<HTMLDivElement>(null);
    // t=5.5 lands the animation in the "Complete" state (all WebP, −77%) —
    // shows the outcome without any motion for reduced-motion users.
    const [t, setT] = useState(reduced ? 5.5 : 0);

    useEffect(() => {
        if (reduced) { setT(5.5); return; }
        if (!hostRef.current || typeof IntersectionObserver === "undefined") {
            // Fallback: run unconditionally if IO is unavailable.
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
        }

        let raf = 0;
        let running = false;
        let start = 0;
        const loop = (now: number) => {
            const elapsed = (now - start) / 1000;
            if (elapsed > 7) start = now;
            setT(elapsed % 7);
            raf = requestAnimationFrame(loop);
        };
        const io = new IntersectionObserver(([entry]) => {
            if (entry?.isIntersecting && !running) {
                running = true;
                start = performance.now();
                raf = requestAnimationFrame(loop);
            } else if (!entry?.isIntersecting && running) {
                running = false;
                cancelAnimationFrame(raf);
            }
        }, { threshold: 0.2 });
        io.observe(hostRef.current);
        return () => {
            io.disconnect();
            cancelAnimationFrame(raf);
        };
    }, [reduced]);

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
        <div ref={hostRef} className="pr2-demo">
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
                                            background: isWebp ? "var(--success)" : isConverting ? "var(--ink)" : "var(--ink-3)",
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
    const { ref, inView } = useInView<HTMLDivElement>();
    const pct = useAnimatedNumber(70, inView);
    const secs = useAnimatedNumber(30, inView);
    const days = useAnimatedNumber(30, inView);
    return (
        <section ref={ref} className="pr2-statsbar">
            <div className="pr2-container">
                <div className="pr2-stats-grid">
                    <Stat k={`−${Math.round(pct)}%`} v="avg. page weight" />
                    <Stat k={`${Math.round(secs)}s`} v="setup time" />
                    <Stat k="6.0+" v="WP compatibility" />
                    <Stat k={`${Math.round(days)}d`} v="money-back guarantee" />
                </div>
            </div>
        </section>
    );
}

function Stat({ k, v }: { k: string; v: string }) {
    return (
        <div className="pr2-stat">
            <div className="pr2-h-display pr2-stat-k">{k}</div>
            <div className="pr2-stat-v">{v}</div>
        </div>
    );
}

const HOW_STEPS = [
    {
        n: "01",
        title: "Install",
        copy: "Grab the plugin from WordPress.org or run the WP-CLI one-liner. No build step, no config file.",
        cmd: "wp plugin install tempaloo-webp --activate",
    },
    {
        n: "02",
        title: "Activate",
        copy: "Sign in with Google, get your free API key in 10 seconds, paste it in the plugin settings.",
        cmd: "tmp_live_••••••••••••••",
    },
    {
        n: "03",
        title: "Convert",
        copy: "New uploads are converted automatically. Existing library? One click on Bulk does the rest.",
        cmd: "Auto-convert: ON · Bulk: 1,284 queued",
    },
    {
        n: "04",
        title: "Serve",
        copy: "Visitors get WebP or AVIF based on their browser. Originals stay on your server, untouched.",
        cmd: "Served WEBP to 94% of visits",
    },
];

function HowItWorks() {
    return (
        <section className="pr2-how">
            <div className="pr2-container">
                <div className="pr2-section-head">
                    <span className="pr2-eyebrow">HOW IT WORKS</span>
                    <h2 className="pr2-h-display pr2-section-h">
                        Four steps.{" "}
                        <span className="pr2-font-serif pr2-section-h-accent">Mostly waiting.</span>
                    </h2>
                    <p className="pr2-section-lead">
                        No build pipeline, no CDN re-architecture. You install a plugin; we do the boring parts.
                    </p>
                </div>
                <ol className="pr2-how-grid" aria-label="Installation steps">
                    {HOW_STEPS.map((s) => (
                        <li key={s.n} className="pr2-how-step">
                            <div className="pr2-how-n pr2-font-mono">{s.n}</div>
                            <h3 className="pr2-how-title">{s.title}</h3>
                            <p className="pr2-how-copy">{s.copy}</p>
                            <code className="pr2-how-cmd pr2-font-mono">{s.cmd}</code>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
}

const COMPAT = [
    { name: "Gutenberg", kind: "Block editor" },
    { name: "Elementor", kind: "Page builder" },
    { name: "Bricks", kind: "Page builder" },
    { name: "Divi", kind: "Theme + builder" },
    { name: "Beaver Builder", kind: "Page builder" },
    { name: "WooCommerce", kind: "E-commerce" },
    { name: "WPML / Polylang", kind: "Multilingual" },
    { name: "Rank Math / Yoast", kind: "SEO" },
    { name: "WP Rocket", kind: "Cache" },
    { name: "LiteSpeed Cache", kind: "Cache" },
];

function Compatibility() {
    return (
        <section className="pr2-compat">
            <div className="pr2-container">
                <div className="pr2-section-head">
                    <span className="pr2-eyebrow">COMPATIBILITY</span>
                    <h2 className="pr2-h-display pr2-section-h">
                        Works with{" "}
                        <span className="pr2-font-serif pr2-section-h-accent">your stack.</span>
                    </h2>
                    <p className="pr2-section-lead">
                        Standalone plugin. No lock-in to a page builder, theme or cache plugin — it sits next to whatever you already use.
                    </p>
                </div>
                <ul className="pr2-compat-grid" aria-label="Compatible tools">
                    {COMPAT.map((c) => (
                        <li key={c.name} className="pr2-compat-card">
                            <span className="pr2-compat-name">{c.name}</span>
                            <span className="pr2-compat-kind pr2-font-mono">{c.kind}</span>
                        </li>
                    ))}
                </ul>
                <p className="pr2-compat-note">
                    Theme-agnostic · Works with any image-generating plugin · Zero front-end JS injected
                </p>
            </div>
        </section>
    );
}

const USE_CASES = [
    {
        tag: "Solo blogger",
        title: "Ship a post a day,\nnot a bill.",
        copy: "Writing 10-image articles, one per day? Free covers ~25 posts/mo. Starter covers ~500. No credit card until you really need it.",
        plan: "starter" as const,
        cta: "Fits Starter →",
    },
    {
        tag: "Agency / Freelance",
        title: "Five client sites,\none receipt.",
        copy: "Growth license runs on up to 5 sites, 25k images/mo pooled. Credit rollover covers lumpy launch cycles. One invoice, one dashboard.",
        plan: "growth" as const,
        cta: "Fits Growth →",
    },
    {
        tag: "E-commerce / Shop",
        title: "150,000 products.\nOne API.",
        copy: "WooCommerce stores with thousands of SKU visuals. Business tier: unlimited sites, direct API for custom workflows, priority chat support.",
        plan: "business" as const,
        cta: "Fits Business →",
    },
];

function UseCases() {
    return (
        <section className="pr2-uc">
            <div className="pr2-container">
                <div className="pr2-section-head">
                    <span className="pr2-eyebrow">WHO IT&rsquo;S FOR</span>
                    <h2 className="pr2-h-display pr2-section-h">
                        One plugin.{" "}
                        <span className="pr2-font-serif pr2-section-h-accent">Three realities.</span>
                    </h2>
                    <p className="pr2-section-lead">
                        We priced Tempaloo for the three types of WordPress user that usually lose out on optimizer pricing.
                    </p>
                </div>
                <div className="pr2-uc-grid">
                    {USE_CASES.map((u) => (
                        <article key={u.tag} className="pr2-uc-card">
                            <span className="pr2-uc-tag">{u.tag}</span>
                            <h3 className="pr2-h-display pr2-uc-title">{u.title}</h3>
                            <p className="pr2-uc-copy">{u.copy}</p>
                            <Link
                                href={`/webp/activate?plan=${u.plan}&billing=annual`}
                                className="pr2-uc-link"
                                onClick={() => trackCtaClick("uc_card", u.plan as TrackPlan)}
                            >
                                {u.cta}
                            </Link>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}

const SECURITY = [
    { title: "No image storage", copy: "Conversion happens in-memory. Files stream straight back to your server, never saved on ours." },
    { title: "Originals untouched", copy: "We write a WebP sibling next to each original. Disable Tempaloo any time — your site still works." },
    { title: "EU-hosted (GDPR)", copy: "API and database run in Frankfurt. No cross-Atlantic data transfer, no Privacy Shield drama." },
    { title: "Per-site activation", copy: "Each site gets one activation slot. Deactivate from your dashboard if you move hosts — no ticket required." },
    { title: "Signed webhooks", copy: "Every Freemius callback is verified with HMAC before we touch your licence. Replays are rejected." },
    { title: "Key rotation", copy: "Compromised key? Regenerate from the dashboard. The old one dies the instant the new one is issued." },
];

function Security() {
    return (
        <section className="pr2-sec">
            <div className="pr2-container">
                <div className="pr2-section-head">
                    <span className="pr2-eyebrow">SAFE BY DEFAULT</span>
                    <h2 className="pr2-h-display pr2-section-h">
                        Your site,{" "}
                        <span className="pr2-font-serif pr2-section-h-accent">your files.</span>
                    </h2>
                    <p className="pr2-section-lead">
                        Tempaloo is a pipe, not a storage locker. Here&rsquo;s the short list of what that means in practice.
                    </p>
                </div>
                <ul className="pr2-sec-grid" aria-label="Security and privacy guarantees">
                    {SECURITY.map((s) => (
                        <li key={s.title} className="pr2-sec-card">
                            <div className="pr2-sec-title">{s.title}</div>
                            <p className="pr2-sec-copy">{s.copy}</p>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

function StickyMobileCTA() {
    // Only emerge after the user has scrolled past the hero. Avoids
    // covering the H1 on first paint.
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const onScroll = () => setVisible(window.scrollY > 520);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);
    return (
        <div
            className={`pr2-sticky-cta ${visible ? "pr2-sticky-on" : ""}`}
            role="complementary"
            aria-label="Start free"
            aria-hidden={!visible}
        >
            <div className="pr2-sticky-inner">
                <div className="pr2-sticky-copy">
                    <strong>Free · 250 images/mo</strong>
                    <span className="pr2-sticky-sub">No card · 30-day money back</span>
                </div>
                <Link href="/webp/activate?plan=free" className="pr2-btn pr2-btn-primary pr2-btn-sm" onClick={() => trackCtaClick("sticky_mobile", "free")}>
                    Start free <ArrowIcon />
                </Link>
            </div>
        </div>
    );
}

function ThumbnailTrap() {
    const reduced = usePrefersReducedMotion();
    // phase=99 is the end-state of the cycle: both boxes fully revealed,
    // competitor counter at 6, Tempaloo at 1. Static but tells the full story.
    const [tick, setTick] = useState(reduced ? 99 : 0);
    useEffect(() => {
        if (reduced) { setTick(99); return; }
        const id = window.setInterval(() => setTick((t) => (t + 1) % 100), 80);
        return () => window.clearInterval(id);
    }, [reduced]);
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
                <div className="pr2-trap-vs">
                    See the math against each one:&nbsp;
                    <Link href="/webp/vs-shortpixel">vs ShortPixel</Link>
                    <span aria-hidden> · </span>
                    <Link href="/webp/vs-imagify">vs Imagify</Link>
                    <span aria-hidden> · </span>
                    <Link href="/webp/vs-tinypng">vs TinyPNG</Link>
                </div>
            </div>
        </section>
    );
}

function Pricing({ plans, billing, onBillingChange }: { plans: CardPlan[]; billing: Billing; onBillingChange: (b: Billing) => void }) {
    // Find plans by code so the layout doesn't depend on array order. If a
    // code is missing from the feed (e.g., plan deprecated) the section
    // simply omits that card instead of crashing.
    const byCode = new Map(plans.map(p => [p.id, p]));
    const starter = byCode.get("starter");
    const growth = byCode.get("growth");
    const business = byCode.get("business");
    const free = byCode.get("free");
    const unlimited = byCode.get("unlimited");
    const featured = [starter, growth, business].filter((p): p is CardPlan => Boolean(p));
    const small = [free, unlimited].filter((p): p is CardPlan => Boolean(p));

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
                    {featured.map((p) => (
                        <PlanCard key={p.id} plan={p} billing={billing} />
                    ))}
                </div>
                <div className="pr2-pricing-rows">
                    {small.map((p) => (
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

function PlanCard({ plan, billing }: { plan: CardPlan; billing: Billing }) {
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
            <Link
                href={activateHref(plan.id, billing)}
                className={`pr2-btn ${plan.highlight ? "pr2-btn-primary" : "pr2-btn-ghost"} pr2-plan-cta`}
                onClick={() => trackCtaClick("pricing", plan.id as TrackPlan)}
            >
                {plan.cta} <ArrowIcon />
            </Link>
        </div>
    );
}

function SmallPlanRow({ plan, billing }: { plan: CardPlan; billing: Billing }) {
    const monthly = billing === "monthly" ? plan.monthly : plan.annual;
    const isFree = plan.id === "free";
    return (
        <div className="pr2-smallrow">
            <div className="pr2-smallrow-col">
                <div className="pr2-smallrow-name">
                    {plan.name}
                    {isFree && (
                        <span className="pr2-smallrow-note" title="Bulk runs (manual conversion of existing library) are capped at 50 images/day on Free. Auto-conversion of new uploads stays unlimited.">
                            · bulk capped at 50/day
                        </span>
                    )}
                </div>
                <div className="pr2-smallrow-tag">{plan.tagline}</div>
            </div>
            <div className="pr2-smallrow-meta pr2-font-mono">
                <span className="pr2-smallrow-quota">{plan.quota}</span> {plan.quotaUnit} · {plan.sites}
            </div>
            <div className="pr2-smallrow-price">
                {isFree ? "€0" : `€${Number.isInteger(monthly) ? monthly : monthly.toFixed(2)}/mo`}
            </div>
            <Link
                href={activateHref(plan.id, billing)}
                className="pr2-btn pr2-btn-ghost pr2-btn-sm"
                onClick={() => trackCtaClick("pricing", plan.id as TrackPlan)}
            >
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
                    {FAQS.map((f, i) => {
                        const open = openIdx === i;
                        const panelId = `pr2-faq-a-${i}`;
                        return (
                            <div key={i} className="pr2-faq-item">
                                <button
                                    onClick={() => onToggle(i)}
                                    className="pr2-faq-q"
                                    aria-expanded={open}
                                    aria-controls={panelId}
                                >
                                    <span>{f.q}</span>
                                    <span className={`pr2-faq-plus ${open ? "pr2-faq-plus-open" : ""}`} aria-hidden>
                                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 2V10M2 6H10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                                    </span>
                                </button>
                                <div
                                    id={panelId}
                                    role="region"
                                    aria-hidden={!open}
                                    className={`pr2-faq-a ${open ? "pr2-faq-a-open" : ""}`}
                                >
                                    <p>{f.a}</p>
                                </div>
                            </div>
                        );
                    })}
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
                    <Link href="/webp/activate?plan=free" className="pr2-btn pr2-btn-final-primary" onClick={() => trackCtaClick("final_cta", "free")}>Start free <ArrowIcon /></Link>
                    <Link href="/docs" className="pr2-btn pr2-btn-final-ghost">Read the docs</Link>
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
                            <Link href="/docs">Docs</Link>
                            <Link href="/changelog">Changelog</Link>
                        </div>
                    </div>
                    <div>
                        <div className="pr2-footer-col-h">COMPARE</div>
                        <div className="pr2-footer-col">
                            <Link href="/webp/vs-shortpixel">vs ShortPixel</Link>
                            <Link href="/webp/vs-imagify">vs Imagify</Link>
                            <Link href="/webp/vs-tinypng">vs TinyPNG</Link>
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
                            <Link href="/about">About</Link>
                            <Link href="/contact">Contact</Link>
                        </div>
                    </div>
                    <div>
                        <div className="pr2-footer-col-h">LEGAL</div>
                        <div className="pr2-footer-col">
                            <Link href="/privacy">Privacy</Link>
                            <Link href="/terms">Terms</Link>
                            <Link href="/terms#4-trial-and-refunds">Refunds</Link>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}

const css = `
.pr2-root {
  min-height: 100vh;
  background: var(--bg);
  color: var(--ink);
}

.pr2-container { max-width: 1200px; margin: 0 auto; padding: 0 clamp(16px, 3vw, 24px); }
.pr2-container-sm { max-width: 880px; margin: 0 auto; padding: 0 clamp(16px, 3vw, 24px); }

.pr2-h-display { font-family: var(--font-geist-sans), sans-serif; letter-spacing: -0.035em; font-weight: 600; }
.pr2-font-serif { font-family: var(--font-serif), serif; font-weight: 400; letter-spacing: -0.01em; font-style: italic; }
.pr2-font-mono { font-family: var(--font-geist-mono), ui-monospace, monospace; }
.pr2-mono-sm { font-size: 13px; }
.pr2-text-ink { color: var(--ink); font-weight: 500; }
.pr2-text-danger { color: var(--danger); }

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
.pr2-btn-primary { background: var(--ink); color: var(--bg); border-color: var(--ink); }
.pr2-btn-primary:hover { background: var(--ink-2); border-color: var(--ink-2); }
.pr2-btn-ghost { background: var(--bg); color: var(--ink); border-color: var(--line-2); }
.pr2-btn-ghost:hover { background: var(--bg-2); border-color: var(--ink-3); }
.pr2-btn-sm { height: 34px; font-size: 13.5px; padding: 0 14px; border-radius: 7px; }
.pr2-icon-btn { width: 34px; padding: 0 10px; height: 34px; border-radius: 7px; }

.pr2-nav { position: sticky; top: 0; z-index: 50; background: transparent; border-bottom: 1px solid transparent; transition: background .2s, border-color .2s; }
.pr2-nav-scrolled { background: color-mix(in oklab, var(--bg) 80%, transparent); backdrop-filter: blur(16px) saturate(180%); -webkit-backdrop-filter: blur(16px) saturate(180%); border-bottom-color: var(--line); }
/* 3-column grid: logo left, links centered, CTAs right. The center column
   is absolutely centered to the viewport regardless of the side widths,
   so the menu sits on the page's vertical axis even if Sign in / Get
   started grows or shrinks. */
.pr2-nav-inner { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; height: 60px; }
.pr2-nav-logo { display: flex; align-items: center; justify-self: start; }
.pr2-nav-links { display: flex; gap: 4px; justify-self: center; }
.pr2-nav-links a { font-size: 14px; color: var(--ink-2); padding: 6px 10px; font-weight: 450; border-radius: 6px; transition: color .15s, background .15s; }
.pr2-nav-links a:hover { color: var(--ink); background: var(--bg-2); }
.pr2-nav-right { display: flex; align-items: center; gap: 6px; justify-self: end; }
.pr2-nav-signin { font-size: 14px; color: var(--ink-2); padding: 6px 12px; font-weight: 450; transition: color .15s; }
.pr2-nav-signin:hover { color: var(--ink); }

.pr2-logo { display: inline-flex; align-items: center; color: var(--ink); }

.pr2-pill { display: inline-flex; align-items: center; gap: 7px; padding: 5px 11px; border-radius: 999px; background: var(--bg); color: var(--ink-2); border: 1px solid var(--line-2); font-size: 12.5px; font-weight: 450; letter-spacing: -0.005em; }
.pr2-pill-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--success); box-shadow: 0 0 0 3px rgba(23, 201, 100, 0.18); }

.pr2-hero { padding: 80px 0 96px; position: relative; overflow: hidden; }
.pr2-hero-inner { position: relative; text-align: center; }
.pr2-hero-h1 { font-size: clamp(32px, 7.2vw, 88px); line-height: 1.04; letter-spacing: -0.04em; font-weight: 600; margin: 28px auto 22px; max-width: 820px; color: var(--ink); text-wrap: balance; }
.pr2-hero-h1-accent { color: var(--ink-3); font-weight: 400; }
.pr2-hero-lead { font-size: 18px; line-height: 1.55; color: var(--ink-2); max-width: 560px; margin: 0 auto 36px; text-wrap: balance; letter-spacing: -0.01em; }
.pr2-hero-ctas { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-bottom: 24px; }
.pr2-hero-sub { font-size: 13px; color: var(--ink-3); }
.pr2-hero-viz { margin-top: 72px; position: relative; }
.pr2-hero-caption { text-align: center; margin-top: 16px; font-size: 12.5px; color: var(--ink-3); font-family: var(--font-geist-mono), ui-monospace, monospace; letter-spacing: -0.01em; }

.pr2-demo { width: 100%; max-width: 960px; margin: 0 auto; background: var(--surface); border: 1px solid var(--line-2); border-radius: 12px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 24px 48px -24px rgba(0,0,0,0.18); font-family: var(--font-geist-sans), sans-serif; }
.pr2-demo-chrome { display: flex; align-items: center; gap: 8px; padding: 11px 14px; border-bottom: 1px solid var(--line); background: var(--bg-2); }
.pr2-traffic { width: 10px; height: 10px; border-radius: 50%; }
.pr2-traffic-red { background: #FF5F57; }
.pr2-traffic-yellow { background: #FEBC2E; }
.pr2-traffic-green { background: #28C840; }
.pr2-demo-url { flex: 1; text-align: center; font-size: 11.5px; font-family: var(--font-geist-mono), ui-monospace, monospace; color: var(--ink-3); letter-spacing: -0.01em; }
.pr2-demo-grid { display: grid; grid-template-columns: 280px 1fr; }
.pr2-demo-left { padding: 20px; border-right: 1px solid var(--line); background: var(--bg-2); }
.pr2-demo-right { padding: 20px; min-height: 340px; }
.pr2-demo-section-label { font-size: 10.5px; font-family: var(--font-geist-mono), ui-monospace, monospace; color: var(--ink-3); letter-spacing: 0.02em; margin-bottom: 10px; }
.pr2-demo-img { aspect-ratio: 4 / 3; border-radius: 8px; overflow: hidden; border: 1px solid var(--line-2); margin-bottom: 12px; }
.pr2-demo-filename { font-size: 12.5px; font-weight: 500; color: var(--ink); letter-spacing: -0.01em; margin-bottom: 2px; }
.pr2-demo-filemeta { font-size: 11.5px; color: var(--ink-3); font-family: var(--font-geist-mono), ui-monospace, monospace; }
.pr2-demo-credit { margin-top: 16px; padding: 10px 12px; border: 1px solid var(--ink); border-radius: 8px; background: var(--bg); transition: opacity .3s, transform .3s; }
.pr2-demo-credit-label { font-size: 10px; font-family: var(--font-geist-mono), ui-monospace, monospace; color: var(--ink-3); letter-spacing: 0.02em; margin-bottom: 2px; }
.pr2-demo-credit-row { display: flex; align-items: baseline; gap: 6px; }
.pr2-demo-credit-num { font-size: 22px; font-weight: 500; letter-spacing: -0.04em; font-family: var(--font-geist-mono), ui-monospace, monospace; color: var(--ink); }
.pr2-demo-credit-sub { font-size: 11.5px; color: var(--ink-3); }
.pr2-demo-right-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px; gap: 12px; flex-wrap: wrap; }
.pr2-demo-state { font-size: 10.5px; font-family: var(--font-geist-mono), ui-monospace, monospace; color: var(--ink-3); letter-spacing: 0.02em; transition: color .2s; }
.pr2-demo-state-done { color: var(--success); }
.pr2-demo-rows { display: flex; flex-direction: column; gap: 6px; }
.pr2-demo-row { display: grid; grid-template-columns: 170px 1fr 80px 44px; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 6px; border: 1px solid transparent; transition: all .25s ease; font-size: 12.5px; }
.pr2-row-webp { background: var(--bg-2); }
.pr2-row-converting { border-color: var(--ink); }
.pr2-demo-row-label { font-family: var(--font-geist-mono), ui-monospace, monospace; color: var(--ink); letter-spacing: -0.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pr2-demo-row-bar { height: 4px; border-radius: 999px; background: var(--line); position: relative; overflow: hidden; }
.pr2-demo-row-bar-fill { position: absolute; left: 0; top: 0; bottom: 0; transition: width .1s linear, background .2s; }
.pr2-demo-row-size { font-family: var(--font-geist-mono), ui-monospace, monospace; text-align: right; color: var(--ink); font-variant-numeric: tabular-nums; }
.pr2-demo-row-format { font-family: var(--font-geist-mono), ui-monospace, monospace; font-size: 10.5px; font-weight: 500; padding: 2px 6px; border-radius: 4px; text-align: center; background: var(--bg-2); color: var(--ink-3); transition: background .2s, color .2s; }
.pr2-fmt-webp { background: var(--ink); color: var(--bg); }
.pr2-demo-totals { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.pr2-demo-totals-row { display: flex; gap: 18px; font-size: 12px; }
.pr2-demo-total-val { font-family: var(--font-geist-mono), ui-monospace, monospace; font-weight: 500; color: var(--ink); transition: color .3s; }
.pr2-demo-total-done { color: var(--success); }
.pr2-demo-arrow { font-size: 14px; color: var(--ink-3); align-self: flex-end; padding-bottom: 1px; }
.pr2-demo-saved { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 6px; background: var(--bg-2); color: var(--ink-3); font-size: 12px; font-weight: 500; font-family: var(--font-geist-mono), ui-monospace, monospace; letter-spacing: -0.01em; transition: all .3s; }
.pr2-demo-saved-on { background: var(--ink); color: var(--bg); }
.pr2-demo-saved-sub { opacity: 0.7; }
@media (max-width: 760px) {
  .pr2-demo-grid { grid-template-columns: 1fr; }
  .pr2-demo-left { border-right: none; border-bottom: 1px solid var(--line); }
  .pr2-demo-left, .pr2-demo-right { padding: 16px; }
}
@media (max-width: 520px) {
  /* Collapse the demo's 4-col row grid into label + compact stats so nothing
     overflows the container at ~320px viewport. */
  .pr2-demo-row { grid-template-columns: 1fr auto auto; gap: 8px; padding: 7px 8px; font-size: 12px; }
  .pr2-demo-row-bar { display: none; }
  .pr2-demo-row-label { font-size: 11.5px; }
  .pr2-demo-right-head { gap: 8px; }
  .pr2-demo-section-label { font-size: 10px; }
  .pr2-demo-totals-row { gap: 12px; }
  .pr2-demo-filename, .pr2-demo-filemeta { font-size: 11.5px; }
}

.pr2-statsbar { border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.pr2-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.pr2-stat { padding: 32px 20px; text-align: center; border-right: 1px solid var(--line); }
.pr2-stat:last-child { border-right: none; }
.pr2-stat-k { font-size: 32px; font-weight: 500; letter-spacing: -0.04em; color: var(--ink); margin-bottom: 4px; }
.pr2-stat-v { font-size: 12.5px; color: var(--ink-3); font-family: var(--font-geist-mono), ui-monospace, monospace; letter-spacing: -0.01em; }

.pr2-trap { padding: 120px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); background: var(--bg-2); }
.pr2-section-head { max-width: 640px; margin: 0 auto 48px; text-align: center; }
.pr2-eyebrow { font-family: var(--font-geist-mono), ui-monospace, monospace; font-size: 11px; font-weight: 400; letter-spacing: 0.02em; color: var(--ink-3); }
.pr2-section-h { font-size: clamp(26px, 4.8vw, 60px); font-weight: 600; letter-spacing: -0.04em; margin: 10px 0 14px; line-height: 1.08; color: var(--ink); text-wrap: balance; }
.pr2-section-h-accent { color: var(--ink-3); }
.pr2-section-lead { font-size: 16px; color: var(--ink-2); line-height: 1.55; letter-spacing: -0.01em; }
.pr2-trap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; max-width: 960px; margin: 0 auto; }
.pr2-trap-card { padding: 24px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
.pr2-trap-card-highlight { border-color: var(--ink); }
.pr2-trap-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
.pr2-trap-name { font-weight: 500; font-size: 14px; color: var(--ink); }
.pr2-trap-sub { font-size: 11px; color: var(--ink-3); }
.pr2-trap-bundled { color: var(--ink); font-weight: 500; }
.pr2-trap-eyebrow { font-size: 12.5px; color: var(--ink-3); margin-bottom: 20px; }
.pr2-trap-boxes { display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px; margin-bottom: 20px; }
.pr2-trap-boxes-bundle { margin: 0 -4px 20px; padding: 0; border: 1px dashed transparent; border-radius: 6px; transition: padding .3s, border-color .3s; }
.pr2-trap-boxes-bundle-on { padding: 4px; border-color: var(--ink); }
.pr2-trap-box { aspect-ratio: 1; border-radius: 4px; background: var(--bg-2); border: 1px solid var(--line); opacity: 0.5; transform: scale(0.92); transition: all .3s; }
.pr2-trap-box-on { background: var(--ink); opacity: 1; transform: scale(1); }
.pr2-trap-bars { display: flex; gap: 4px; margin-bottom: 16px; }
.pr2-trap-bar { flex: 1; height: 3px; border-radius: 999px; background: var(--bg-2); transition: background .2s; }
.pr2-trap-bar-danger { background: var(--danger); }
.pr2-trap-bar-ink { background: var(--ink); }
.pr2-trap-footer { display: flex; justify-content: space-between; align-items: baseline; padding-top: 14px; border-top: 1px solid var(--line); font-size: 12px; color: var(--ink-3); }
.pr2-trap-count { font-size: 30px; font-weight: 500; letter-spacing: -0.04em; line-height: 1; color: var(--ink); }
.pr2-trap-count-danger { color: var(--danger); }
.pr2-trap-coda { max-width: 580px; margin: 40px auto 0; text-align: center; font-size: 15px; color: var(--ink-2); line-height: 1.6; letter-spacing: -0.01em; }
@media (max-width: 860px) {
  .pr2-trap-grid { grid-template-columns: 1fr; }
}

.pr2-pricing { padding: 112px 0 96px; }
.pr2-billing-toggle-wrap { margin-top: 24px; }
.pr2-bt { display: inline-flex; padding: 3px; background: var(--bg-2); border: 1px solid var(--line); border-radius: 8px; }
.pr2-bt-btn { padding: 6px 14px; border: none; background: transparent; color: var(--ink-3); border-radius: 6px; font-size: 13px; font-weight: 450; letter-spacing: -0.01em; cursor: pointer; transition: all .15s; display: inline-flex; align-items: center; gap: 6px; font-family: inherit; }
.pr2-bt-on { background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 0 0 1px var(--line-2); }
.pr2-bt-save { font-size: 10.5px; padding: 1px 5px; border-radius: 4px; background: transparent; color: var(--ink-3); font-weight: 500; }
.pr2-bt-save-on { background: var(--accent-wash); color: var(--ink); }

.pr2-pricing-featured { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; max-width: 1080px; margin: 0 auto 12px; }
.pr2-pricing-rows { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; max-width: 1080px; margin: 0 auto; }
.pr2-plan { position: relative; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 24px 22px; display: flex; flex-direction: column; height: 100%; }
.pr2-plan-hl { border-color: var(--ink); }
.pr2-plan-badge { position: absolute; top: -10px; right: 18px; background: var(--ink); color: var(--bg); padding: 3px 9px; border-radius: 4px; font-size: 10.5px; font-weight: 500; letter-spacing: 0.01em; }
.pr2-plan-name { font-size: 14px; font-weight: 500; margin-bottom: 4px; color: var(--ink); }
.pr2-plan-tag { font-size: 12.5px; margin: 0 0 20px; color: var(--ink-3); min-height: 32px; line-height: 1.5; }
.pr2-plan-price-block { margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid var(--line); }
.pr2-plan-price-row { display: flex; align-items: baseline; gap: 4px; }
.pr2-plan-price { font-size: 34px; font-weight: 500; letter-spacing: -0.04em; line-height: 1; color: var(--ink); }
.pr2-plan-per { font-size: 13px; color: var(--ink-3); }
.pr2-plan-bill { font-size: 12px; color: var(--ink-3); margin-top: 4px; }
.pr2-plan-meta { margin-bottom: 20px; }
.pr2-plan-meta-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; color: var(--ink-3); }
.pr2-plan-meta-row + .pr2-plan-meta-row { margin-top: 6px; }
.pr2-plan-meta-val { font-size: 14px; font-weight: 500; color: var(--ink); letter-spacing: -0.01em; }
.pr2-plan-meta-unit { color: var(--ink-3); font-weight: 400; }
.pr2-plan-feats { margin: 0 0 22px; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; flex: 1; }
.pr2-plan-feats li { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; line-height: 1.5; color: var(--ink-2); }
.pr2-feat-check { color: var(--ink); margin-top: 3px; flex-shrink: 0; }
.pr2-plan-cta { width: 100%; height: 36px; }

.pr2-smallrow { padding: 18px 20px; border: 1px solid var(--line); background: var(--surface); border-radius: 10px; display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
.pr2-smallrow-col { flex: 1 1 180px; min-width: 160px; }
.pr2-smallrow-name { font-weight: 500; font-size: 14px; margin-bottom: 2px; color: var(--ink); }
.pr2-smallrow-tag { font-size: 12.5px; color: var(--ink-3); }
.pr2-smallrow-note { font-size: 11px; color: var(--ink-3); font-weight: 400; margin-left: 6px; cursor: help; border-bottom: 1px dotted var(--line-2); }
.pr2-smallrow-meta { font-size: 12.5px; color: var(--ink-3); flex: 1 1 180px; letter-spacing: -0.01em; }
.pr2-smallrow-quota { color: var(--ink); }
.pr2-smallrow-price { font-size: 14px; color: var(--ink); font-weight: 500; min-width: 90px; }

.pr2-faq { padding: 120px 0; }
.pr2-faq-item { border-bottom: 1px solid var(--line); }
.pr2-faq-q { width: 100%; text-align: left; background: transparent; border: none; padding: 20px 0; display: flex; align-items: center; justify-content: space-between; gap: 20px; cursor: pointer; color: var(--ink); font-family: inherit; }
.pr2-faq-q > span:first-child { font-size: 16px; font-weight: 500; letter-spacing: -0.02em; line-height: 1.4; }
.pr2-faq-plus { width: 24px; height: 24px; border-radius: 6px; border: 1px solid var(--line-2); display: grid; place-items: center; flex-shrink: 0; transition: all .2s; color: var(--ink-2); }
.pr2-faq-plus-open { transform: rotate(45deg); color: var(--ink); }
.pr2-faq-a { overflow: hidden; max-height: 0; opacity: 0; transition: max-height .3s ease, opacity .2s, padding .2s; padding-bottom: 0; }
.pr2-faq-a-open { max-height: 400px; opacity: 1; padding-bottom: 22px; }
.pr2-faq-a p { margin: 0; font-size: 14.5px; line-height: 1.65; color: var(--ink-2); max-width: 680px; letter-spacing: -0.01em; }

.pr2-final { padding: 112px 0; background: var(--ink); color: var(--bg); position: relative; overflow: hidden; }
.pr2-final-inner { position: relative; text-align: center; }
.pr2-final-h { font-size: clamp(28px, 5.2vw, 68px); font-weight: 600; letter-spacing: -0.04em; margin: 0 0 20px; line-height: 1.06; color: var(--bg); text-wrap: balance; }
.pr2-final-h-accent { color: var(--ink-3); font-weight: 400; }
.pr2-final-lead { font-size: 17px; color: rgba(237, 237, 237, 0.6); max-width: 500px; margin: 0 auto 30px; letter-spacing: -0.01em; }
.pr2-root[data-theme="dark"] .pr2-final-lead { color: rgba(10, 10, 10, 0.6); }
.pr2-final-ctas { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.pr2-btn-final-primary { height: 42px; padding: 0 20px; font-size: 14px; background: var(--bg); color: var(--ink); border: none; }
.pr2-btn-final-primary:hover { filter: brightness(0.96); }
.pr2-btn-final-ghost { height: 42px; padding: 0 20px; font-size: 14px; background: rgba(255,255,255,0.08); color: var(--bg); border: 1px solid rgba(255,255,255,0.22); }
.pr2-root[data-theme="dark"] .pr2-btn-final-ghost { background: rgba(0,0,0,0.08); color: var(--ink); border-color: rgba(0,0,0,0.22); }
.pr2-btn-final-ghost:hover { background: rgba(255,255,255,0.14); }

.pr2-footer { padding: 56px 0; border-top: 1px solid var(--line); background: var(--bg); }
.pr2-footer-inner { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 32px; }
.pr2-footer-brand { max-width: 320px; }
.pr2-footer-brand p { font-size: 12.5px; color: var(--ink-3); margin: 14px 0 0; line-height: 1.55; }
.pr2-footer-cols { display: flex; gap: 56px; font-size: 13px; flex-wrap: wrap; }
.pr2-footer-col-h { font-size: 11px; letter-spacing: 0.02em; color: var(--ink-3); margin-bottom: 12px; font-family: var(--font-geist-mono), ui-monospace, monospace; }
.pr2-footer-col { display: flex; flex-direction: column; gap: 10px; }
.pr2-footer-col a { color: var(--ink-2); transition: color .15s; }
.pr2-footer-col a:hover { color: var(--ink); }
.pr2-footer-inline { display: inline-flex; align-items: center; gap: 6px; }
.pr2-footer-inline-muted { color: var(--ink-3) !important; }
.pr2-footer-tag { font-size: 10px; }
.pr2-footer-tag-live { color: var(--success); }

/* Trust chips under hero primary CTA */
.pr2-trust-chips {
  list-style: none;
  margin: 18px 0 0;
  padding: 0;
  display: flex;
  justify-content: center;
  gap: 18px;
  flex-wrap: wrap;
  font-size: 12.5px;
  color: var(--ink-3);
}
.pr2-trust-chips li { display: inline-flex; align-items: center; gap: 5px; }
.pr2-trust-chips svg { color: var(--ink-2); flex-shrink: 0; }

/* How it works */
.pr2-how {
  padding: 112px 0 96px;
  border-top: 1px solid var(--line);
}
.pr2-how-grid {
  list-style: none; margin: 0; padding: 0;
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px; max-width: 1200px; margin: 0 auto;
  counter-reset: how;
}
@media (max-width: 960px) { .pr2-how-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 540px) { .pr2-how-grid { grid-template-columns: 1fr; } }
.pr2-how-step {
  position: relative;
  padding: 22px 20px 20px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: border-color .15s, transform .15s;
}
.pr2-how-step:hover { border-color: var(--line-2); transform: translateY(-2px); }
.pr2-how-n {
  font-size: 11px;
  color: var(--ink-3);
  letter-spacing: 0.04em;
}
.pr2-how-title {
  font-size: 18px; font-weight: 600; letter-spacing: -0.02em;
  color: var(--ink); margin: 0;
}
.pr2-how-copy {
  font-size: 13.5px; color: var(--ink-2); margin: 0;
  line-height: 1.55; flex: 1;
}
.pr2-how-cmd {
  display: block;
  margin-top: 4px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--bg-2);
  border: 1px solid var(--line);
  font-size: 11.5px;
  color: var(--ink-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Compatibility */
.pr2-compat {
  padding: 112px 0;
  border-top: 1px solid var(--line);
  background: var(--bg-2);
}
.pr2-compat-grid {
  list-style: none; margin: 0 auto; padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  max-width: 1080px;
}
.pr2-compat-card {
  padding: 18px 18px 16px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: border-color .15s, transform .15s;
}
.pr2-compat-card:hover { border-color: var(--line-2); transform: translateY(-2px); }
.pr2-compat-name {
  font-size: 14px; font-weight: 500; letter-spacing: -0.015em;
  color: var(--ink);
}
.pr2-compat-kind {
  font-size: 11px; color: var(--ink-3); letter-spacing: 0.02em;
}
.pr2-compat-note {
  max-width: 720px; margin: 28px auto 0;
  text-align: center;
  font-size: 13px; color: var(--ink-3);
  letter-spacing: -0.01em;
}

/* Reveal-on-scroll wrapper */
.pr2-reveal {
  opacity: 0;
  transform: translateY(14px);
  transition: opacity 600ms cubic-bezier(.2,.7,.3,1), transform 600ms cubic-bezier(.2,.7,.3,1);
  will-change: opacity, transform;
}
.pr2-reveal-in { opacity: 1; transform: none; }

/* Focus-visible on pricing cards — when the inner button catches focus,
   highlight the whole card so keyboard users know which plan is targeted. */
.pr2-plan:focus-within {
  border-color: var(--ink);
  box-shadow: 0 0 0 1px var(--ink);
}
.pr2-smallrow:focus-within {
  border-color: var(--ink);
  box-shadow: 0 0 0 1px var(--ink);
}

/* Use Cases */
.pr2-uc {
  padding: 112px 0 96px;
  border-top: 1px solid var(--line);
  background: var(--bg-2);
}
.pr2-uc-grid {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px; max-width: 1120px; margin: 0 auto;
}
@media (max-width: 900px) { .pr2-uc-grid { grid-template-columns: 1fr; max-width: 560px; } }
.pr2-uc-card {
  padding: 28px 26px 24px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
  display: flex; flex-direction: column; gap: 10px;
  transition: border-color .15s, transform .15s;
}
.pr2-uc-card:hover { border-color: var(--line-2); transform: translateY(-3px); }
.pr2-uc-tag {
  align-self: flex-start;
  font-family: var(--font-geist-mono), ui-monospace, monospace;
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: var(--ink-3);
  padding: 3px 8px;
  border: 1px solid var(--line-2);
  border-radius: 999px;
  text-transform: uppercase;
}
.pr2-uc-title {
  font-size: 28px; font-weight: 600; letter-spacing: -0.035em;
  color: var(--ink); margin: 6px 0 0;
  white-space: pre-line;
  line-height: 1.05;
}
.pr2-uc-copy {
  font-size: 14px; color: var(--ink-2); line-height: 1.55; margin: 0;
  flex: 1;
}
.pr2-uc-link {
  font-size: 13px; font-weight: 500; color: var(--ink);
  display: inline-flex; align-items: center; gap: 4px;
  margin-top: 4px;
  border-bottom: 1px solid var(--line-2);
  padding-bottom: 2px;
  align-self: flex-start;
  transition: border-color .15s;
}
.pr2-uc-link:hover { border-color: var(--ink); }

/* Security */
.pr2-sec {
  padding: 112px 0 96px;
  border-top: 1px solid var(--line);
}
.pr2-sec-grid {
  list-style: none; margin: 0 auto; padding: 0;
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px; max-width: 1080px;
}
@media (max-width: 900px) { .pr2-sec-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 560px) { .pr2-sec-grid { grid-template-columns: 1fr; } }
.pr2-sec-card {
  padding: 20px 22px 18px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  transition: border-color .15s;
}
.pr2-sec-card:hover { border-color: var(--line-2); }
.pr2-sec-title {
  font-size: 14px; font-weight: 500; color: var(--ink);
  margin-bottom: 6px; letter-spacing: -0.015em;
}
.pr2-sec-copy {
  margin: 0; font-size: 13px; color: var(--ink-2); line-height: 1.55;
}

/* Inline cross-link to the dedicated /webp/vs-* comparison pages, surfaced
   at the end of ThumbnailTrap so visitors who want a head-to-head can
   click through to a page where each cell is sourced + dated. */
.pr2-trap-vs {
  max-width: 580px; margin: 18px auto 0; text-align: center;
  font-size: 13px; color: var(--ink-3); letter-spacing: -0.01em;
}
.pr2-trap-vs a {
  color: var(--ink); border-bottom: 1px solid var(--line-2); padding-bottom: 1px;
  transition: border-color .15s;
}
.pr2-trap-vs a:hover { border-bottom-color: var(--ink); }

/* Sticky mobile bottom CTA */
.pr2-sticky-cta {
  display: none;
}
@media (max-width: 768px) {
  .pr2-sticky-cta {
    display: block;
    position: fixed;
    left: 0; right: 0; bottom: 0;
    z-index: 60;
    background: color-mix(in oklab, var(--bg) 90%, transparent);
    backdrop-filter: blur(14px) saturate(180%);
    -webkit-backdrop-filter: blur(14px) saturate(180%);
    border-top: 1px solid var(--line-2);
    transform: translateY(110%);
    transition: transform .25s cubic-bezier(.2, .7, .3, 1);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .pr2-sticky-on { transform: translateY(0); }
}
.pr2-sticky-inner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 14px;
  max-width: 640px; margin: 0 auto;
  padding: 12px 20px;
}
.pr2-sticky-copy {
  display: flex; flex-direction: column; gap: 2px;
  font-size: 13.5px; color: var(--ink);
  letter-spacing: -0.01em;
  line-height: 1.2;
}
.pr2-sticky-copy strong { font-weight: 600; }
.pr2-sticky-sub { color: var(--ink-3); font-size: 11.5px; }

/* Mobile nav: burger appears below 720px; sign-in label hides below 520px;
   the "Get started" text collapses below 420px, leaving just the arrow. */
.pr2-nav-burger { display: none; }
@media (max-width: 720px) {
  /* Drop the center column entirely so the logo + right cluster don't
     get pinned to a 1fr-auto-1fr layout that wastes horizontal space. */
  .pr2-nav-inner { grid-template-columns: auto 1fr; }
  .pr2-nav-links { display: none; }
  .pr2-nav-burger { display: inline-flex; }
}
@media (max-width: 520px) {
  .pr2-nav-signin { display: none; }
}
@media (max-width: 420px) {
  .pr2-nav-cta-label { display: none; }
  .pr2-nav-cta { padding: 0 12px; }
}

/* Mobile drawer — lives outside the sticky <nav> so the fixed positioning
   is always relative to the viewport, not a containing block. */
.pr2-mobile-menu {
  position: fixed; inset: 0;
  z-index: 80;
  pointer-events: none;
}
.pr2-mobile-menu-open { pointer-events: auto; }
.pr2-mobile-menu[aria-hidden="true"] .pr2-mobile-panel { transform: translateX(100%); }
.pr2-mobile-menu[aria-hidden="true"] .pr2-mobile-scrim { opacity: 0; }
.pr2-mobile-scrim {
  position: absolute; inset: 0;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  cursor: pointer;
  opacity: 1;
  transition: opacity .2s ease;
  /* Don't let a scrim touch pass through to the page underneath. */
  touch-action: none;
}
.pr2-mobile-panel {
  position: absolute; top: 0; right: 0; bottom: 0;
  width: min(320px, 86vw);
  background: var(--bg);
  border-left: 1px solid var(--line-2);
  padding: calc(72px + env(safe-area-inset-top)) 24px calc(32px + env(safe-area-inset-bottom));
  display: flex; flex-direction: column; gap: 24px;
  transition: transform .25s cubic-bezier(.2,.7,.3,1);
  box-shadow: -16px 0 48px -16px rgba(0,0,0,0.3);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain; /* panel scroll does not bleed to document */
}
.pr2-mobile-links { display: flex; flex-direction: column; gap: 2px; }
.pr2-mobile-links a {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 12px;
  font-size: 17px; font-weight: 500;
  color: var(--ink);
  letter-spacing: -0.015em;
  border-radius: 8px;
  transition: background .12s;
}
.pr2-mobile-links a:hover { background: var(--bg-2); }
.pr2-mobile-soon {
  font-size: 10.5px; font-weight: 500;
  padding: 2px 7px; border-radius: 999px;
  background: var(--bg-2); color: var(--ink-3);
  letter-spacing: 0.02em; text-transform: uppercase;
  font-family: var(--font-geist-mono), ui-monospace, monospace;
}
.pr2-mobile-ctas {
  display: flex; flex-direction: column; gap: 10px;
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}
.pr2-mobile-ctas .pr2-btn { width: 100%; height: 44px; font-size: 15px; }
@media (min-width: 721px) {
  /* Above the breakpoint the drawer must stay inert even if state flipped
     — e.g. during a viewport resize mid-open. */
  .pr2-mobile-menu { display: none; }
}

/* Pricing: below 820px force a single-column stack so the
   highlighted Growth card keeps its lift without crashing into neighbours. */
@media (max-width: 820px) {
  .pr2-pricing-featured { grid-template-columns: 1fr; max-width: 480px; }
  .pr2-pricing-rows     { grid-template-columns: 1fr; max-width: 480px; }
  .pr2-plan.pr2-plan-hl { transform: none; }
}

/* Very small phones (iPhone SE 1st gen, 320-420 wide). */
@media (max-width: 440px) {
  .pr2-hero { padding: 48px 0 64px; }
  .pr2-hero-lead { font-size: 16px; }
  .pr2-hero-viz { margin-top: 48px; }
  .pr2-final { padding: 64px 0; }
  .pr2-how, .pr2-compat, .pr2-pricing, .pr2-faq, .pr2-trap, .pr2-uc, .pr2-sec, .pr2-cmp {
    padding-top: 64px; padding-bottom: 64px;
  }
  .pr2-hero-ctas .pr2-btn { flex: 1 1 100%; }
  .pr2-trust-chips { gap: 10px 14px; font-size: 12px; }
}

/* Landscape phones: hide the heavy demo, keep the CTA-first experience. */
@media (orientation: landscape) and (max-height: 500px) {
  .pr2-hero-viz { display: none; }
  .pr2-hero     { padding: 32px 0 48px; }
}

/* Bottom padding for the sticky mobile CTA bar so it doesn't hide footer content. */
@media (max-width: 768px) {
  .pr2-footer { padding-bottom: 96px; }
}
`;
