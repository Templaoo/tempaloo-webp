import { NextResponse, type NextRequest } from "next/server";

const API_BASE = process.env.TEMPALOO_API_BASE ?? "http://localhost:3000/v1";

/** Forwards the admin cookie to /v1/admin/email/test on Fastify. */
export async function POST(req: NextRequest) {
    const body = await req.text();
    const upstream = await fetch(`${API_BASE}/admin/email/test`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            cookie: req.headers.get("cookie") ?? "",
        },
        body,
        cache: "no-store",
    });
    const json = await upstream.json().catch(() => null);
    return NextResponse.json(json, { status: upstream.status });
}
