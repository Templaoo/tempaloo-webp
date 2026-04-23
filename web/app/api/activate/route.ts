import { NextResponse } from "next/server";

const API_BASE = process.env.TEMPALOO_API_BASE ?? "http://localhost:3000/v1";

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const { email, site_url, plan } = body ?? {};

    if (plan && plan !== "free") {
        return NextResponse.json(
            { error: { code: "not_implemented", message: "Paid plans require Freemius checkout (pending)." } },
            { status: 501 },
        );
    }

    if (!email || !site_url) {
        return NextResponse.json(
            { error: { code: "validation", message: "email and site_url are required" } },
            { status: 400 },
        );
    }

    try {
        const upstream = await fetch(`${API_BASE}/license/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, site_url }),
        });
        const data = await upstream.json().catch(() => null);
        return NextResponse.json(data, { status: upstream.status });
    } catch (e) {
        return NextResponse.json(
            { error: { code: "upstream_error", message: e instanceof Error ? e.message : "Upstream failed" } },
            { status: 502 },
        );
    }
}
