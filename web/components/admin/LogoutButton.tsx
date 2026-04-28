"use client";

import { useState } from "react";

/**
 * Posts to /admin/auth/logout (which revokes the session row server-side),
 * then hard-navigates to the login page so no Server-Component cache from
 * the authed session leaks back if the user hits Back.
 */
export function LogoutButton() {
    const [busy, setBusy] = useState(false);

    async function logout() {
        if (busy) return;
        setBusy(true);
        try {
            await fetch("/api/admin/logout", { method: "POST", cache: "no-store" });
        } catch { /* ignore */ }
        window.location.replace("/admin/login");
    }

    return (
        <button onClick={logout} disabled={busy} className="btn btn-ghost btn-sm">
            {busy ? "…" : "Sign out"}
        </button>
    );
}
