import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/Logo";
import { adminGet, AdminApiError } from "@/lib/admin/api";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { cookies } from "next/headers";

// Admin pages are authenticated content — never let any layer (browser,
// CDN edge, ISP proxy) cache them. The middleware adds Cache-Control,
// these directives ensure the App Router itself never tries either.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata = {
    title: "Admin — Tempaloo",
    robots: { index: false, follow: false, nocache: true },
};

interface Me {
    ok: boolean;
    user?: { id: string; email: string; name: string; role: "owner" | "staff" | "readonly" };
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
    // No reliable way to read the request pathname from a Server-Component
    // layout in App Router, so we infer "is this the login page" by the
    // *absence* of the admin cookie. The middleware guarantees:
    //   · no cookie → only /admin/login is reachable
    //   · cookie    → all other /admin/* pages are reachable
    // So no-cookie ≡ login page from the layout's perspective.
    const adminCookieName = process.env.ADMIN_COOKIE_NAME ?? "tempaloo_admin_sid";
    const hasCookie = !!cookies().get(adminCookieName);

    if (!hasCookie) {
        return <main style={shellStyle}>{children}</main>;
    }

    let me: Me["user"] | undefined;
    try {
        const res = await adminGet<Me>("/admin/auth/me");
        me = res.user;
    } catch (e) {
        if (e instanceof AdminApiError && (e.status === 401 || e.status === 403)) {
            // Cookie present but rejected by API (revoked, expired, MFA pending).
            // Render a minimal "expired" panel pointing back to login.
            return (
                <main style={shellStyle}>
                    <div className="surface-card" style={{ padding: 32, maxWidth: 420, margin: "120px auto", textAlign: "center" }}>
                        <h2 style={{ margin: 0, fontSize: 18 }}>Session expired</h2>
                        <p style={{ marginTop: 8, color: "var(--ink-3)" }}>Please sign in again.</p>
                        <Link href="/admin/login" className="btn btn-primary btn-sm" style={{ marginTop: 16, display: "inline-flex" }}>Sign in</Link>
                    </div>
                </main>
            );
        }
        throw e;
    }

    return (
        <main style={shellStyle}>
            <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh" }}>
                <Sidebar />
                <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                    <TopBar me={me} />
                    <div style={{ padding: "24px 28px 80px", flex: 1 }}>{children}</div>
                </div>
            </div>
        </main>
    );
}

const shellStyle: React.CSSProperties = {
    background: "var(--bg)",
    color: "var(--ink)",
    minHeight: "100vh",
};

function Sidebar() {
    const items = [
        { href: "/admin",            label: "Dashboard",  icon: "▦" },
        { href: "/admin/users",      label: "Users",      icon: "◉" },
        { href: "/admin/licenses",   label: "Licenses",   icon: "◇" },
        { href: "/admin/installs",   label: "Installs",   icon: "▢" },
        { href: "/admin/webhooks",   label: "Webhooks",   icon: "↯" },
        { href: "/admin/audit",      label: "Audit",      icon: "✓" },
    ];
    return (
        <aside style={{ borderRight: "1px solid var(--line)", background: "var(--bg-2)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 20px 24px" }}>
                <Link href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <LogoMark size={22} />
                    <span style={{ fontWeight: 500, fontSize: 14, letterSpacing: "-0.015em" }}>
                        Tempaloo<span style={{ color: "var(--ink-3)" }}> / admin</span>
                    </span>
                </Link>
            </div>
            <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 12px" }}>
                {items.map((it) => (
                    <Link key={it.href} href={it.href} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px", borderRadius: 8,
                        color: "var(--ink-2)", fontSize: 13.5,
                        transition: "background .12s ease, color .12s ease",
                    }}>
                        <span style={{ width: 16, color: "var(--ink-3)", fontSize: 13 }}>{it.icon}</span>
                        {it.label}
                    </Link>
                ))}
            </nav>
            <div style={{ marginTop: "auto", padding: 16, fontSize: 11, color: "var(--ink-3)" }}>
                © Tempaloo
            </div>
        </aside>
    );
}

function TopBar({ me }: { me?: Me["user"] }) {
    return (
        <header style={{
            borderBottom: "1px solid var(--line)",
            background: "color-mix(in oklab, var(--bg) 80%, transparent)",
            backdropFilter: "blur(16px)",
            position: "sticky", top: 0, zIndex: 20,
        }}>
            <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 28px", height: 56,
            }}>
                <span className="font-mono" style={{
                    fontSize: 10.5, padding: "4px 10px", borderRadius: 999,
                    background: "color-mix(in oklab, var(--danger) 14%, transparent)",
                    color: "var(--danger)", letterSpacing: "0.04em",
                }}>
                    · ADMIN
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {me && (
                        <div style={{ fontSize: 12.5, color: "var(--ink-3)", textAlign: "right" }}>
                            <div style={{ color: "var(--ink)" }}>{me.name}</div>
                            <div style={{ fontSize: 11 }}>{me.email} · {me.role}</div>
                        </div>
                    )}
                    <LogoutButton />
                </div>
            </div>
        </header>
    );
}
