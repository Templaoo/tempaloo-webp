import { NextResponse, type NextRequest } from "next/server";

const API_BASE = process.env.TEMPALOO_API_BASE ?? "http://localhost:3000/v1";
const ADMIN_COOKIE = process.env.ADMIN_COOKIE_NAME ?? "tempaloo_admin_sid";

export async function POST(req: NextRequest) {
    const upstream = await fetch(`${API_BASE}/admin/auth/logout`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            cookie: req.headers.get("cookie") ?? "",
        },
        cache: "no-store",
    });
    const json = await upstream.json().catch(() => null);
    const res = NextResponse.json(json, { status: upstream.status });

    // Belt-and-braces: even if the upstream Set-Cookie didn't make it,
    // we clear the cookie locally so the next request can't replay it.
    res.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "strict" });
    return res;
}
