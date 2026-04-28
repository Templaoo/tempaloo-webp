import { NextResponse, type NextRequest } from "next/server";

const API_BASE = process.env.TEMPALOO_API_BASE ?? "http://localhost:3000/v1";

export async function POST(req: NextRequest) {
    const body = await req.text();
    const upstream = await fetch(`${API_BASE}/admin/auth/totp`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            cookie: req.headers.get("cookie") ?? "",
            "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "",
        },
        body,
        cache: "no-store",
    });
    const json = await upstream.json().catch(() => null);
    const res = NextResponse.json(json, { status: upstream.status });
    const setCookie = upstream.headers.get("set-cookie");
    if (setCookie) res.headers.set("set-cookie", setCookie);
    return res;
}
