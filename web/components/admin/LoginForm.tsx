"use client";

import { useState } from "react";

/**
 * Two-step admin login. Step 1 sets a half-session cookie; step 2
 * promotes it to mfa_passed = true. On success, hard-navigates to
 * /admin so no auth-less Server Component cache can leak in.
 */
type Step = "creds" | "totp";

export function LoginForm() {
    const [step, setStep] = useState<Step>("creds");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [useBackup, setUseBackup] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function submitCreds(e: React.FormEvent) {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setErr(null);
        try {
            const res = await fetch("/api/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const j = await res.json().catch(() => null);
            if (!res.ok) throw new Error(j?.error?.message ?? "Sign-in failed");
            if (j?.mfa_required) setStep("totp");
            else window.location.replace("/admin");
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Sign-in failed");
        } finally {
            setBusy(false);
        }
    }

    async function submitTotp(e: React.FormEvent) {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setErr(null);
        try {
            const body = useBackup ? { backup_code: code } : { code };
            const res = await fetch("/api/admin/totp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const j = await res.json().catch(() => null);
            if (!res.ok) throw new Error(j?.error?.message ?? "Invalid 2FA code");
            window.location.replace("/admin");
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Invalid 2FA code");
        } finally {
            setBusy(false);
        }
    }

    return step === "creds" ? (
        <form onSubmit={submitCreds} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Email">
                <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Password">
                <input type="password" autoComplete="current-password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
            </Field>
            {err && <div style={errStyle}>{err}</div>}
            <button type="submit" disabled={busy} className="btn btn-primary" style={{ marginTop: 4 }}>
                {busy ? "…" : "Continue →"}
            </button>
        </form>
    ) : (
        <form onSubmit={submitTotp} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label={useBackup ? "Backup code" : "6-digit code from your authenticator"}>
                <input
                    inputMode={useBackup ? "text" : "numeric"}
                    autoComplete="one-time-code"
                    required
                    autoFocus
                    pattern={useBackup ? undefined : "\\d{6}"}
                    maxLength={useBackup ? 20 : 6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    style={{ ...inputStyle, letterSpacing: useBackup ? "normal" : "0.4em", textAlign: "center", fontSize: 18 }}
                />
            </Field>
            {err && <div style={errStyle}>{err}</div>}
            <button type="submit" disabled={busy} className="btn btn-primary" style={{ marginTop: 4 }}>
                {busy ? "…" : "Verify"}
            </button>
            <button type="button" onClick={() => { setUseBackup(!useBackup); setCode(""); setErr(null); }}
                style={{ background: "none", border: "none", padding: 0, color: "var(--ink-3)", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
                {useBackup ? "Use authenticator code instead" : "Use a backup code instead"}
            </button>
        </form>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--ink-3)", letterSpacing: "-0.01em" }}>{label}</span>
            {children}
        </label>
    );
}

const inputStyle: React.CSSProperties = {
    width: "100%", height: 38, padding: "0 12px",
    borderRadius: 8, border: "1px solid var(--line-2)",
    background: "var(--bg)", color: "var(--ink)",
    fontSize: 14, fontFamily: "inherit",
};
const errStyle: React.CSSProperties = {
    fontSize: 12.5, padding: "8px 10px", borderRadius: 7,
    background: "color-mix(in oklab, var(--danger) 14%, transparent)",
    color: "var(--danger)",
};
