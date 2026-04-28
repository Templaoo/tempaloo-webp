/**
 * Browser → /api/admin/login → Fastify /v1/admin/auth/login
 *
 * Reason for the proxy: the API and web apps live on different
 * subdomains (api.tempaloo.com vs admin.tempaloo.com), so a Set-Cookie
 * issued by the API can't be silently bound to the web origin in all
 * browsers. The proxy receives the API's Set-Cookie, rewrites the
 * domain, and re-issues it on the web origin. Bonus: keeps the API key
 * out of the browser entirely.
 */
import { NextResponse, type NextRequest } from "next/server";

const API_BASE = process.env.TEMPALOO_API_BASE ?? "http://localhost:3000/v1";

export async function POST(req: NextRequest) {
    const body = await req.text();
    const upstream = await fetch(`${API_BASE}/admin/auth/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "",
        },
        body,
        cache: "no-store",
    });

    const json = await upstream.json().catch(() => null);
    const res = NextResponse.json(json, { status: upstream.status });

    // Forward the upstream Set-Cookie verbatim (same path, sameSite=Strict).
    const setCookie = upstream.headers.get("set-cookie");
    if (setCookie) res.headers.set("set-cookie", setCookie);

    return res;
}
