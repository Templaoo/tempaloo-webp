// Neon Auth (Better Auth) — server-side instance.
// Returns null when the env vars are missing so pages can degrade gracefully
// into the email-only fallback until Neon Auth is enabled.

export interface NeonAuthConfig {
    baseUrl: string;
    cookieSecret: string;
}

export function readAuthConfig(): NeonAuthConfig | null {
    const baseUrl = process.env.NEON_AUTH_BASE_URL;
    const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;
    if (!baseUrl || !cookieSecret || cookieSecret.length < 32) return null;
    return { baseUrl, cookieSecret };
}

export const isAuthConfigured = readAuthConfig() !== null;

/**
 * Lazily builds a Neon Auth instance.
 * Returns null when not configured — callers must handle that path.
 */
export async function loadAuth() {
    const cfg = readAuthConfig();
    if (!cfg) return null;
    const mod = (await import("@neondatabase/auth/next/server")) as {
        createNeonAuth: (opts: { baseUrl: string; cookies: { secret: string } }) => NeonAuthInstance;
    };
    return mod.createNeonAuth({
        baseUrl: cfg.baseUrl,
        cookies: { secret: cfg.cookieSecret },
    });
}

// Minimal shape of the Neon Auth instance we rely on. The real SDK exposes
// more; we only type what we use so pages stay strict-safe.
export interface NeonAuthInstance {
    handler: () => { GET: unknown; POST: unknown };
    getSession: () => Promise<{
        data: { user?: { id?: string; email?: string; name?: string | null; image?: string | null } | null } | null;
    }>;
}

export async function getCurrentUser(): Promise<{
    id?: string;
    email: string;
    name?: string;
    image?: string;
} | null> {
    const auth = await loadAuth();
    if (!auth) return null;
    try {
        const res = await auth.getSession();
        const u = res?.data?.user;
        if (!u?.email) return null;
        return {
            id: u.id,
            email: u.email,
            name: u.name ?? undefined,
            image: u.image ?? undefined,
        };
    } catch {
        return null;
    }
}
