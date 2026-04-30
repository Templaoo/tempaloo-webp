import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { PostAuthRedirector } from "@/components/PostAuthRedirector";
import { HeroBackground } from "@/components/HeroBackground";

export const metadata = {
    title: "Tempaloo — WordPress plugins & templates",
    description: "Modern tools for WordPress creators. WebP plugin live, templates coming soon.",
};

type Product = {
    id: string;
    name: string;
    tagline: string;
    status: "live" | "soon";
    href: string;
};

const PRODUCTS: Product[] = [
    {
        id: "webp",
        name: "Tempaloo WebP",
        tagline: "Drop-in WebP & AVIF for WordPress. One credit per image — every thumbnail size bundled.",
        status: "live",
        href: "/webp",
    },
    {
        id: "templates",
        name: "Tempaloo Templates",
        tagline: "Premium WordPress templates, hand-crafted for WooCommerce, portfolios and editorial sites.",
        status: "soon",
        href: "#",
    },
];

export default function Home() {
    return (
        <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            {/* Catches users stranded here after OAuth — the modal stashed
                their intended post-auth path in sessionStorage. No-op
                if the storage slot is empty. */}
            <PostAuthRedirector />

            {/* Header + hero share a single relative-positioned wrapper so
                the animated background can stretch behind both. The
                wrapper has `overflow: hidden` to contain the blob blur,
                and the inner content sits on z-index 1 so the gradient
                stays decorative. */}
            <div style={{ position: "relative", overflow: "hidden" }}>
                <HeroBackground coverNavHeightPx={0} intensity="subtle" />

                <header className="app-container" style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
                    <Link href="/" aria-label="Tempaloo home" style={{ display: "inline-flex", alignItems: "center" }}>
                        <LogoMark size={32} />
                    </Link>
                    <nav style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 14 }}>
                        <Link href="/webp" style={{ color: "var(--ink-2)" }}>WebP plugin</Link>
                        <Link href="/sign-in" style={{ color: "var(--ink-2)" }}>Sign in</Link>
                        <Link href="/webp/activate" className="btn btn-primary btn-sm">
                            Get started
                            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </Link>
                    </nav>
                </header>

                <section className="app-container rise" style={{ position: "relative", zIndex: 1, padding: "96px 0 64px", textAlign: "center" }}>
                    <span className="eyebrow" style={{ display: "inline-block", marginBottom: 16 }}>
                        WORDPRESS TOOLS, DONE RIGHT
                    </span>
                    <h1 className="h-display" style={{ fontSize: "clamp(32px, 7vw, 84px)", letterSpacing: "-0.04em", lineHeight: 1.04, margin: 0, fontWeight: 600, textWrap: "balance" }}>
                        Tools for builders.{" "}
                        <span className="font-serif" style={{ color: "var(--ink-3)", fontWeight: 400 }}>
                            Priced<br />like a friend.
                        </span>
                    </h1>
                    <p style={{ fontSize: 18, color: "var(--ink-2)", maxWidth: 580, margin: "24px auto 36px", letterSpacing: "-0.01em", lineHeight: 1.55 }}>
                        Plugins and templates for WordPress creators who are tired of
                        complicated pricing, bloated settings, and upsell traps.
                    </p>
                    <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                        <Link href="/webp" className="btn btn-primary">
                            Explore WebP plugin
                            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </Link>
                        <a href="#products" className="btn btn-ghost">See all products</a>
                    </div>
                </section>
            </div>

            <section id="products" className="app-container rise rise-delay-1" style={{ padding: "40px 0 96px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 24 }}>
                    <h2 className="h-display" style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.03em", margin: 0 }}>
                        Products
                    </h2>
                    <span className="eyebrow">{PRODUCTS.length} · 1 LIVE</span>
                </div>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
                    {PRODUCTS.map((p) => (
                        <ProductCard key={p.id} product={p} />
                    ))}
                </div>
            </section>

            <footer style={{ borderTop: "1px solid var(--line)", padding: "40px 0", marginTop: "auto" }}>
                <div className="app-container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, fontSize: 12.5, color: "var(--ink-3)" }}>
                    <span>© {new Date().getFullYear()} Tempaloo · 12 rue de la Paix, 75002 Paris</span>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                        <Link href="/about">About</Link>
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

function ProductCard({ product }: { product: Product }) {
    const isLive = product.status === "live";
    const cardStyle: React.CSSProperties = {
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        cursor: isLive ? "pointer" : "default",
        opacity: isLive ? 1 : 0.75,
        transition: "border-color .15s, transform .15s",
    };
    const inner = (
        <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.015em" }}>
                    {product.name}
                </span>
                <StatusBadge status={product.status} />
            </div>
            <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: 0, lineHeight: 1.5 }}>
                {product.tagline}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: isLive ? "var(--ink)" : "var(--ink-3)", fontWeight: 450, marginTop: 4 }}>
                {isLive ? "View plugin" : "In development"}
                {isLive && (
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
            </div>
        </>
    );
    if (isLive) {
        return <Link href={product.href} className="surface-card" style={cardStyle}>{inner}</Link>;
    }
    return <div aria-disabled className="surface-card" style={cardStyle}>{inner}</div>;
}

function StatusBadge({ status }: { status: "live" | "soon" }) {
    const isLive = status === "live";
    return (
        <span
            className="font-mono"
            style={{
                fontSize: 10,
                letterSpacing: "0.05em",
                padding: "3px 8px",
                borderRadius: 4,
                background: isLive ? "var(--accent-wash)" : "var(--bg-2)",
                color: isLive ? "var(--success)" : "var(--ink-3)",
                fontWeight: 500,
            }}
        >
            {isLive ? "· LIVE" : "· SOON"}
        </span>
    );
}
