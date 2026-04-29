"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Confirm-and-block button for the /admin/abuse page.
 * Suggests a reason based on the heuristic that flagged this row, but
 * lets the admin edit it before submitting — the reason is logged in
 * the audit trail and emailed to other owner admins (severity=critical).
 */
export function BlockButton({ licenseId, suggestedReason }: { licenseId: string; suggestedReason: string }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);

    async function go() {
        const reason = window.prompt("Block reason (visible in audit + emailed to owners):", suggestedReason);
        if (!reason || reason.trim().length < 8) return;
        setBusy(true);
        try {
            const res = await fetch("/api/admin/license-action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: licenseId, action: "block", reason: reason.trim() }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => null);
                alert(`Block failed: ${j?.error?.message ?? `HTTP ${res.status}`}`);
                return;
            }
            router.refresh();
        } finally {
            setBusy(false);
        }
    }

    return (
        <button onClick={go} disabled={busy} className="btn btn-ghost btn-sm" style={{ height: 28, padding: "0 10px", fontSize: 12, color: "var(--danger)" }}>
            {busy ? "…" : "Block"}
        </button>
    );
}

/**
 * Lightweight unblock — single confirm, no reason required (un-blocking
 * is the safer direction and usually a quick "false-positive" reversal).
 */
export function UnblockButton({ licenseId }: { licenseId: string }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);

    async function go() {
        if (!window.confirm("Unblock this license? The user will regain immediate API access.")) return;
        setBusy(true);
        try {
            const res = await fetch("/api/admin/license-action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: licenseId, action: "unblock" }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => null);
                alert(`Unblock failed: ${j?.error?.message ?? `HTTP ${res.status}`}`);
                return;
            }
            router.refresh();
        } finally {
            setBusy(false);
        }
    }

    return (
        <button onClick={go} disabled={busy} className="btn btn-ghost btn-sm" style={{ height: 28, padding: "0 10px", fontSize: 12 }}>
            {busy ? "…" : "Unblock"}
        </button>
    );
}
