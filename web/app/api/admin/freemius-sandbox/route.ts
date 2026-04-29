import { NextResponse, type NextRequest } from "next/server";

const API_BASE = process.env.TEMPALOO_API_BASE ?? "http://localhost:3000/v1";

/**
 * Forwards the admin cookie to /v1/admin/freemius/sandbox-params on
 * Fastify and returns { sandbox: { token, ctx } } to the browser.
 * Keeps the API URL out of the client.
 */
export async function GET(req: NextRequest) {
    const upstream = await fetch(`${API_BASE}/admin/freemius/sandbox-params`, {
        headers: { cookie: req.headers.get("cookie") ?? "" },
        cache: "no-store",
    });
    const json = await upstream.json().catch(() => null);
    return NextResponse.json(json, { status: upstream.status });
}
