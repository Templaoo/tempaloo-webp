import Link from "next/link";
import { redirect } from "next/navigation";
import { fetchInvoicesByEmail, fetchLicensesByEmail } from "@/lib/account";
import { getCurrentUser } from "@/lib/auth";
import { LicenseCard } from "@/components/dashboard/LicenseCard";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { DashboardScorecard } from "@/components/dashboard/DashboardScorecard";
import { UpgradeCardSmart } from "@/components/dashboard/UpgradeCardSmart";
import { LicenseListClient } from "@/components/dashboard/LicenseListClient";
import { InvoicesCard } from "@/components/dashboard/InvoicesCard";
import { ActivationConfetti, QuotaAlertBanner, ThemeToggle } from "@/components/dashboard/DashboardExtras";
import { PostPurchaseWaiting } from "@/components/dashboard/PostPurchaseWaiting";
import { LogoMark } from "@/components/Logo";

// Authenticated content — never let any layer (browser, ISP proxy,
// Vercel edge) cache it. Without this, after sign-out the user could
// hit Back and see their old dashboard pulled from disk cache.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata = {
    title: "Dashboard — Tempaloo WebP",
};

async function resolveUserEmail(searchEmail: string | undefined): Promise<{ email: string; name?: string; authed: boolean } | null> {
    const user = await getCurrentUser();
    if (user?.email) return { email: user.email, name: user.name, authed: true };
    if (searchEmail && /.+@.+\..+/.test(searchEmail)) return { email: searchEmail, authed: false };
    return null;
}

export default async function DashboardPage({ searchParams }: { searchParams: { email?: string; signup?: string; purchase?: string } }) {
    const user = await resolveUserEmail(searchParams.email);
    if (!user) redirect("/webp/activate?redirect=dashboard");

    // Parallel fetches — same server cycle, half the latency. Both are
    // server-only (internal-key gated) so they share no client state.
    const [initialLicenses, invoices] = await Promise.all([
        fetchLicensesByEmail(user.email).catch(() => []),
        user.authed ? fetchInvoicesByEmail(user.email).catch(() => []) : Promise.resolve([]),
    ]);
    let licenses = initialLicenses;

    if (user.authed && licenses.length === 0 && searchParams.signup) {
        const apiBase = process.env.TEMPALOO_API_BASE ?? "http://localhost:3000/v1";
        try {
            await fetch(`${apiBase}/license/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: user.email, site_url: "https://pending.tempaloo.local" }),
            });
            licenses = await fetchLicensesByEmail(user.email).catch(() => []);
        } catch { /* non-blocking */ }
    }

    return (
        <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--ink)" }}>
            <ActivationConfetti signup={!!searchParams.signup} />
            <TopBar email={user.email} name={user.name} authed={user.authed} />

            <div className="app-container" style={{ padding: "40px 24px 80px" }}>
                {/* Quota alert — only renders when ≥80% on any license */}
                <QuotaAlertBanner licenses={licenses} />

                <section className="rise" style={{ marginBottom: 32 }}>
                    <h1 className="h-display" style={{ fontSize: "clamp(32px, 4vw, 44px)", fontWeight: 600, letterSpacing: "-0.035em", margin: 0, color: "var(--ink)" }}>
                        Welcome back{user.name ? `, ${user.name.split(" ")[0]}` : ""}.
                    </h1>
                    <p style={{ margin: "8px 0 0", fontSize: 15, color: "var(--ink-3)", letterSpacing: "-0.01em" }}>
                        Overview of your licenses, sites, and usage.
                    </p>
                </section>

                {/* Hero scorecard — emotional payoff above the chrome */}
                {licenses.length > 0 && (
                    <section className="rise rise-delay-1" style={{ marginBottom: 24 }}>
                        <DashboardScorecard licenses={licenses} />
                    </section>
                )}

                <section className="rise rise-delay-2" style={{ marginBottom: 32 }}>
                    <StatsRow licenses={licenses} />
                </section>

                <section className="rise rise-delay-3" style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)", gap: 20 }}>
                    <div style={{ minWidth: 0 }}>
                        {licenses.length === 0 ? (
                            // Right after a Freemius checkout the webhook hasn't
                            // landed yet — poll for ~30s with a friendly spinner
                            // instead of falsely telling the user "no license".
                            searchParams.purchase ? (
                                <PostPurchaseWaiting />
                            ) : (
                                <EmptyState email={user.email} />
                            )
                        ) : (
                            <LicenseListClient licenses={licenses} />
                        )}
                    </div>
                    <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <UpgradeCardSmart licenses={licenses} />
                        <InvoicesCard invoices={invoices} />
                        <SupportCard />
                    </aside>
                </section>
            </div>

            <footer style={{ borderTop: "1px solid var(--line)", padding: "24px 0", textAlign: "center", fontSize: 12, color: "var(--ink-3)" }}>
                © {new Date().getFullYear()} Tempaloo.
            </footer>
        </main>
    );
}

function TopBar({ email, name, authed }: { email: string; name?: string; authed: boolean }) {
    const initial = (name ?? email).trim()[0]?.toUpperCase() ?? "?";
    return (
        <header style={{ borderBottom: "1px solid var(--line)", background: "color-mix(in oklab, var(--bg) 80%, transparent)", backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 40 }}>
            <div className="app-container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
                <Link href="/webp" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <LogoMark size={22} />
                    <span style={{ fontWeight: 500, fontSize: 14.5, letterSpacing: "-0.015em" }}>
                        Tempaloo<span style={{ color: "var(--ink-3)" }}> / WebP</span>
                    </span>
                </Link>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {!authed && (
                        <span className="font-mono" style={{ fontSize: 10.5, padding: "4px 10px", borderRadius: 999, background: "rgba(245, 165, 36, 0.15)", color: "var(--warn)", letterSpacing: "0.02em" }}>
                            · PREVIEW
                        </span>
                    )}
                    <ThemeToggle />
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 12px 4px 4px", borderRadius: 999, border: "1px solid var(--line)", background: "var(--bg-2)" }}>
                        <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--ink)", color: "var(--bg)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }}>{initial}</span>
                        <span style={{ fontSize: 13, color: "var(--ink)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name ?? email}</span>
                    </div>
                    {authed ? (
                        <Link href="/webp/logout?return=/webp" style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Sign out</Link>
                    ) : (
                        <Link href="/webp/activate" style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Sign in</Link>
                    )}
                </div>
            </div>
        </header>
    );
}

function EmptyState({ email }: { email: string }) {
    return (
        <div className="surface-card" style={{ padding: "48px 32px", textAlign: "center" }}>
            <span className="eyebrow">NO LICENSE</span>
            <h3 style={{ margin: "12px 0 6px", fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink)" }}>
                No license yet
            </h3>
            <p style={{ margin: "0 auto", maxWidth: 440, fontSize: 14, color: "var(--ink-3)", lineHeight: 1.5 }}>
                We couldn&apos;t find a license for <span style={{ color: "var(--ink)" }}>{email}</span>. Generate one — it takes 10 seconds.
            </p>
            <Link href="/webp/activate" className="btn btn-primary" style={{ marginTop: 24, display: "inline-flex" }}>
                Generate a key →
            </Link>
        </div>
    );
}

function SupportCard() {
    return (
        <div className="surface-card" style={{ padding: 18 }}>
            <div className="eyebrow">SUPPORT</div>
            <div style={{ marginTop: 8, fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>We answer fast</div>
            <p style={{ margin: "4px 0 10px", fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
                Docs, troubleshooting and direct contact — we read every message.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
                <Link href="/docs" className="btn btn-ghost btn-sm">Docs</Link>
                <a href="mailto:support@tempaloo.com" className="btn btn-ghost btn-sm">Email</a>
            </div>
        </div>
    );
}
