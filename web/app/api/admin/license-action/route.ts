import { NextResponse, type NextRequest } from "next/server";

const API_BASE = process.env.TEMPALOO_API_BASE ?? "http://localhost:3000/v1";

/**
 * Browser → admin → API proxy for license block / unblock actions.
 * Body: { id: string, action: "block" | "unblock", reason?: string }
 */
export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null) as { id?: string; action?: string; reason?: string } | null;
    if (!body || !body.id || (body.action !== "block" && body.action !== "unblock")) {
        return NextResponse.json({ error: "bad request" }, { status: 400 });
    }
    const path = body.action === "block"
        ? `/admin/licenses/${encodeURIComponent(body.id)}/block`
        : `/admin/licenses/${encodeURIComponent(body.id)}/unblock`;

    const upstream = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: req.headers.get("cookie") ?? "" },
        body: body.action === "block" ? JSON.stringify({ reason: body.reason ?? "" }) : "{}",
        cache: "no-store",
    });
    const json = await upstream.json().catch(() => null);
    return NextResponse.json(json, { status: upstream.status });
}
