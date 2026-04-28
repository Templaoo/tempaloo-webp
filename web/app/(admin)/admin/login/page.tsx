import { LoginForm } from "@/components/admin/LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin sign in", robots: { index: false, follow: false } };

export default function AdminLoginPage() {
    return (
        <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 24 }}>
            <div className="surface-card" style={{ padding: 32, width: "100%", maxWidth: 380 }}>
                <div className="eyebrow">TEMPALOO ADMIN</div>
                <h1 style={{ margin: "8px 0 4px", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>Sign in</h1>
                <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--ink-3)" }}>
                    Backoffice access. 2FA required.
                </p>
                <LoginForm />
            </div>
        </div>
    );
}
