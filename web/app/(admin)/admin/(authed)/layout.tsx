import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/Logo";
import { adminGet, AdminApiError } from "@/lib/admin/api";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { ClearAndSignIn } from "@/components/admin/ClearAndSignIn";

/**
 * Authed sub-layout — applies to every admin page EXCEPT /admin/login.
 *
 * Calls /admin/auth/me on every render. On 401/403 (cookie missing,
 * expired, revoked, or MFA still pending), redirects the user back to
 * /admin/login via a hard <a> link AND offers to clear the bad cookie
 * via the existing logout endpoint.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

interface Me {
    ok: boolean;
    user?: { id: string; email: string; name: string; role: "owner" | "staff" | "readonly" };
}

export default async function AuthedAdminLayout({ children }: { children: ReactNode }) {
    let me: Me["user"] | undefined;
    try {
        const res = await adminGet<Me>("/admin/auth/me");
        me = res.user;
    } catch (e) {
        if (e instanceof AdminApiError && (e.status === 401 || e.status === 403)) {
            // Stale or rejected session — clear the bad cookie and bounce
            // to the login page. The clear-cookie call uses the same proxy
            // route as the Sign-out button, so it's safe to chain even when
            // the cookie no longer maps to a valid session row.
            return (
                <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 24 }}>
                    <div className="surface-card" style={{ padding: 32, maxWidth: 420, textAlign: "center" }}>
                        <h2 style={{ margin: 0, fontSize: 18 }}>Session expired</h2>
                        <p style={{ margin: "8px 0 16px", color: "var(--ink-3)", fontSize: 13.5 }}>
                            Your admin session is no longer valid. Sign in again to continue.
                        </p>
                        <ClearAndSignIn />
                    </div>
                </div>
            );
        }
        throw e;
    }

    return (
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh" }}>
            <Sidebar />
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                <TopBar me={me} />
                <div style={{ padding: "24px 28px 80px", flex: 1 }}>{children}</div>
            </div>
        </div>
    );
}

function Sidebar() {
    const items = [
        { href: "/admin",            label: "Dashboard",  icon: "▦" },
        { href: "/admin/users",      label: "Users",      icon: "◉" },
        { href: "/admin/licenses",   label: "Licenses",   icon: "◇" },
        { href: "/admin/installs",   label: "Installs",   icon: "▢" },
        { href: "/admin/webhooks",   label: "Webhooks",   icon: "↯" },
        { href: "/admin/abuse",      label: "Abuse",      icon: "⚠" },
        { href: "/admin/audit",      label: "Audit",      icon: "✓" },
        { href: "/admin/sandbox",    label: "Sandbox",    icon: "▶" },
    ];
    return (
        <aside style={{ borderRight: "1px solid var(--line)", background: "var(--bg-2)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 20px 24px" }}>
                <Link href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <LogoMark size={28} />
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
