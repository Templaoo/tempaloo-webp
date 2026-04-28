"use client";

import { useState } from "react";

/**
 * Quick send-a-test-email widget. Lives on the admin dashboard so we
 * can validate template changes without making real signups. Audited
 * server-side at severity=warn.
 */
const TEMPLATES = [
    { value: "welcome-free",           label: "Welcome (free signup)" },
    { value: "trial-started",          label: "Trial started" },
    { value: "trial-ending",           label: "Trial ending soon" },
    { value: "payment-received",       label: "Payment received" },
    { value: "quota-warn",             label: "Quota warn (80%)" },
    { value: "quota-exceeded",         label: "Quota exceeded (100%)" },
    { value: "subscription-cancelled", label: "Subscription cancelled" },
] as const;

export function EmailTestPanel({ defaultTo }: { defaultTo: string }) {
    const [to, setTo] = useState(defaultTo);
    const [template, setTemplate] = useState<typeof TEMPLATES[number]["value"]>("welcome-free");
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    async function send() {
        if (busy) return;
        setBusy(true);
        setMsg(null);
        try {
            const res = await fetch("/api/admin/email-test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ to, template }),
            });
            const j = await res.json().catch(() => null);
            if (res.ok && j?.ok) {
                setMsg(`✓ Sent to ${to}${j.messageId ? ` (id ${String(j.messageId).slice(0, 12)}…)` : ""}`);
            } else {
                setMsg(`✗ ${j?.reason ?? j?.error?.message ?? `HTTP ${res.status}`}`);
            }
        } catch (e) {
            setMsg(`✗ ${e instanceof Error ? e.message : "send failed"}`);
        } finally {
            setBusy(false);
        }
    }

    const ok = msg?.startsWith("✓");
    return (
        <div className="surface-card" style={{ padding: 18, marginTop: 24 }}>
            <div className="eyebrow">EMAIL · QA</div>
            <div style={{ marginTop: 8, fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>Send a test email</div>
            <p style={{ margin: "4px 0 12px", fontSize: 12.5, color: "var(--ink-3)" }}>
                Fires any template with sample data. Audited as severity=warn.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input type="email" value={to} onChange={(e) => setTo(e.target.value)}
                    style={{ flex: 1, minWidth: 200, height: 34, padding: "0 12px", borderRadius: 7, border: "1px solid var(--line-2)", background: "var(--bg)", color: "var(--ink)", fontSize: 13 }} />
                <select value={template} onChange={(e) => setTemplate(e.target.value as typeof template)}
                    style={{ height: 34, padding: "0 10px", borderRadius: 7, border: "1px solid var(--line-2)", background: "var(--bg)", color: "var(--ink)", fontSize: 13 }}>
                    {TEMPLATES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <button onClick={send} disabled={busy} className="btn btn-primary btn-sm">
                    {busy ? "Sending…" : "Send"}
                </button>
            </div>
            {msg && (
                <div style={{
                    marginTop: 10, fontSize: 12.5, padding: "8px 10px", borderRadius: 6,
                    color: ok ? "var(--success)" : "var(--danger)",
                    background: ok ? "color-mix(in oklab, var(--success) 12%, transparent)" : "color-mix(in oklab, var(--danger) 12%, transparent)",
                }}>{msg}</div>
            )}
        </div>
    );
}
