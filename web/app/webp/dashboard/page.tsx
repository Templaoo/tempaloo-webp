import Link from "next/link";
import { redirect } from "next/navigation";
import { fetchLicensesByEmail } from "@/lib/account";
import { getCurrentUser } from "@/lib/auth";
import { LicenseCard } from "@/components/dashboard/LicenseCard";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { LogoMark } from "@/components/Logo";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Dashboard — Tempaloo WebP",
};

async function resolveUserEmail(searchEmail: string | undefined): Promise<{ email: string; name?: string; authed: boolean } | null> {
    const user = await getCurrentUser();
    if (user?.email) return { email: user.email, name: user.name, authed: true };
    if (searchEmail && /.+@.+\..+/.test(searchEmail)) return { email: searchEmail, authed: false };
    return null;
}

export default async function DashboardPage({ searchParams }: { searchParams: { email?: string; signup?: string } }) {
    const user = await resolveUserEmail(searchParams.email);
    if (!user) redirect("/webp/activate?redirect=dashboard");

    let licenses = await fetchLicensesByEmail(user.email).catch(() => []);

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
            <TopBar email={user.email} name={user.name} authed={user.authed} />

            <div className="app-container" style={{ padding: "40px 24px 80px" }}>
                <section className="rise" style={{ marginBottom: 32 }}>
                    <h1 className="h-display" style={{ fontSize: "clamp(32px, 4vw, 44px)", fontWeight: 600, letterSpacing: "-0.035em", margin: 0, color: "var(--ink)" }}>
                        Welcome back{user.name ? `, ${user.name.split(" ")[0]}` : ""}.
                    </h1>
                    <p style={{ margin: "8px 0 0", fontSize: 15, color: "var(--ink-3)", letterSpacing: "-0.01em" }}>
                        Overview of your licenses, sites, and usage.
                    </p>
                </section>

                <section className="rise rise-delay-1" style={{ marginBottom: 32 }}>
                    <StatsRow licenses={licenses} />
                </section>

                <section className="rise rise-delay-2" style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)", gap: 20 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {licenses.length === 0 ? (
                            <EmptyState email={user.email} />
                        ) : (
                            licenses.map((l) => <LicenseCard key={l.id} license={l} />)
                        )}
                    </div>
                    <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <UpgradeCard hasPaid={licenses.some((l) => l.plan.code !== "free")} />
                        <BillingCard />
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
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {!authed && (
                        <span className="font-mono" style={{ fontSize: 10.5, padding: "4px 10px", borderRadius: 999, background: "rgba(245, 165, 36, 0.15)", color: "var(--warn)", letterSpacing: "0.02em" }}>
                            · PREVIEW
                        </span>
                    )}
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
            <a href="/webp/activate" className="btn btn-primary" style={{ marginTop: 24 }}>
                Generate a key →
            </a>
        </div>
    );
}

function UpgradeCard({ hasPaid }: { hasPaid: boolean }) {
    if (hasPaid) {
        return (
            <div className="surface-card" style={{ padding: 18 }}>
                <div className="eyebrow">PLAN</div>
                <div style={{ marginTop: 8, fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>You&apos;re on a paid plan</div>
                <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
                    Manage your subscription from the billing section.
                </p>
            </div>
        );
    }
    return (
        <div style={{ padding: 20, borderRadius: 10, background: "var(--ink)", color: "var(--bg)", position: "relative", overflow: "hidden" }}>
            <div className="eyebrow" style={{ color: "var(--ink-3)" }}>UPGRADE</div>
            <div className="h-display" style={{ marginTop: 10, fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                Ship lighter pages<br />on more sites.
            </div>
            <ul style={{ margin: "14px 0 16px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, color: "rgba(237,237,237,0.75)" }}>
                <li>— AVIF + larger quotas</li>
                <li>— Multi-site licences</li>
                <li>— Priority support</li>
            </ul>
            <Link
                href="/webp/activate?plan=growth"
                style={{ display: "inline-flex", alignItems: "center", height: 32, padding: "0 12px", borderRadius: 6, background: "var(--bg)", color: "var(--ink)", fontSize: 12.5, fontWeight: 500 }}
            >
                See plans →
            </Link>
        </div>
    );
}

function BillingCard() {
    return (
        <div className="surface-card" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div className="eyebrow">BILLING</div>
                <span className="font-mono" style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "var(--bg-2)", color: "var(--ink-3)", fontWeight: 500 }}>SOON</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>Invoices &amp; payment</div>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
                Your invoices will appear here once paid plans are live. Payments are handled securely by Freemius.
            </p>
        </div>
    );
}

function SupportCard() {
    return (
        <div className="surface-card" style={{ padding: 18 }}>
            <div className="eyebrow">SUPPORT</div>
            <div style={{ marginTop: 8, fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>We answer fast</div>
            <p style={{ margin: "4px 0 10px", fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
                Docs, troubleshooting and direct contact.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
                <a href="/webp" className="btn btn-ghost btn-sm">Docs</a>
                <a href="mailto:support@tempaloo.com" className="btn btn-ghost btn-sm">Email</a>
            </div>
        </div>
    );
}
