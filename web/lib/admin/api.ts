/**
 * Server-only API client for the admin backoffice.
 *
 * Forwards the admin session cookie from the incoming request to the
 * Fastify API. The API enforces the auth (we do NOT trust the browser to
 * have already done the cookie check — the middleware just gates network
 * access, the API gates data).
 *
 * Throws on non-2xx so pages can render an error boundary cleanly.
 */
import { cookies } from "next/headers";

const API_BASE = process.env.TEMPALOO_API_BASE ?? "http://localhost:3000/v1";
const ADMIN_COOKIE = process.env.ADMIN_COOKIE_NAME ?? "tempaloo_admin_sid";

export class AdminApiError extends Error {
    constructor(public readonly status: number, message: string, public readonly code?: string) {
        super(message);
    }
}

function buildCookieHeader(): string {
    const jar = cookies();
    const c = jar.get(ADMIN_COOKIE);
    return c ? `${ADMIN_COOKIE}=${encodeURIComponent(c.value)}` : "";
}

export async function adminGet<T>(path: string): Promise<T> {
    const cookieHeader = buildCookieHeader();
    if (!cookieHeader) throw new AdminApiError(401, "no_session", "no_session");

    const res = await fetch(`${API_BASE}${path}`, {
        headers: { cookie: cookieHeader },
        cache: "no-store",
    });
    if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
        throw new AdminApiError(res.status, body?.error?.message ?? `API ${res.status}`, body?.error?.code);
    }
    return res.json() as Promise<T>;
}

export async function adminPost<T>(path: string, body: unknown): Promise<T> {
    const cookieHeader = buildCookieHeader();
    const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        body: JSON.stringify(body ?? {}),
        cache: "no-store",
    });
    if (!res.ok) {
        const j = await res.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
        throw new AdminApiError(res.status, j?.error?.message ?? `API ${res.status}`, j?.error?.code);
    }
    return res.json() as Promise<T>;
}
