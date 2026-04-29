"use client";

import { useEffect } from "react";

/**
 * Catches users who got stranded on the home page (or anywhere) after
 * an OAuth round-trip when Better Auth dropped the callbackURL.
 *
 * The activate modal stashes the intended post-auth path into
 * sessionStorage["tempaloo_post_auth"] BEFORE kicking off Google sign-in.
 * After the OAuth redirect chain settles, this component reads the
 * value (if any), clears it, and navigates the user to where they
 * actually wanted to go.
 *
 * Mounted on every page that's a likely OAuth landing target (home,
 * /webp). Cheap: runs once on mount, no-op if no value stored, no
 * subscriptions left behind.
 */
export function PostAuthRedirector() {
    useEffect(() => {
        try {
            const target = sessionStorage.getItem("tempaloo_post_auth");
            if (!target) return;
            // Clear immediately so back navigation doesn't loop us
            // through the redirect again.
            sessionStorage.removeItem("tempaloo_post_auth");
            // Same-origin guard — never redirect to an absolute URL
            // even though we only ever stash relative paths.
            if (target.startsWith("/") && !target.startsWith("//")) {
                window.location.replace(target);
            }
        } catch { /* private mode */ }
    }, []);
    return null;
}
