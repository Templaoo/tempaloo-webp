"use client";

import { useState } from "react";

/**
 * Clears the bad admin cookie via the logout endpoint, then hard-navigates
 * to the login page so no Server-Component cache from the dead session can
 * be replayed. Used by the "Session expired" panel to break the loop where
 * a rejected cookie would otherwise keep rendering the same panel forever.
 */
export function ClearAndSignIn() {
    const [busy, setBusy] = useState(false);
    async function go() {
        if (busy) return;
        setBusy(true);
        try {
            await fetch("/api/admin/logout", { method: "POST", cache: "no-store" });
        } catch { /* ignore */ }
        window.location.replace("/admin/login");
    }
    return (
        <button onClick={go} disabled={busy} className="btn btn-primary btn-sm" style={{ display: "inline-flex" }}>
            {busy ? "…" : "Sign in"}
        </button>
    );
}
