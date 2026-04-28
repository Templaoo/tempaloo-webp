import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isIpAllowed } from "@/lib/admin/ip";

/**
 * Two responsibilities — handled in priority order:
 *
 * 1. Admin gate (/admin/*): IP allowlist + cookie presence.
 *    The IP check happens at the edge so even probing the login page
 *    requires the correct IP. The cookie check is just "do we have one?"
 *    — the API does the actual auth (token hash + session row + MFA).
 *    Adds strict no-cache + DENY framing headers on every admin response.
 *
 * 2. Neon Auth on the customer surface (existing behavior).
 */
export default async function middleware(req: NextRequest) {
    const url = req.nextUrl;
    const path = url.pathname;

    // ─── /admin/* gate ─────────────────────────────────────────────
    if (path.startsWith("/admin")) {
        // IP allowlist (CIDR list in env). Empty list = allow all.
        const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim()
            || req.headers.get("x-real-ip")
            || "";
        if (!isIpAllowed(ip, process.env.ADMIN_IP_ALLOWLIST)) {
            // 404 instead of 403 — don't reveal that an admin surface exists.
            return new NextResponse("Not found", { status: 404 });
        }

        const adminCookie = process.env.ADMIN_COOKIE_NAME ?? "tempaloo_admin_sid";
        const hasSession = !!req.cookies.get(adminCookie);
        const isLogin = path === "/admin/login" || path.startsWith("/admin/login/");

        if (!hasSession && !isLogin) {
            const dest = new URL("/admin/login", url);
            return NextResponse.redirect(dest);
        }

        const res = NextResponse.next();
        // Defense in depth — admin pages must never be cached or framed.
        res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.headers.set("Pragma", "no-cache");
        res.headers.set("Expires", "0");
        res.headers.set("X-Frame-Options", "DENY");
        res.headers.set("Referrer-Policy", "no-referrer");
        res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
        return res;
    }

    // ─── Customer auth (existing) ──────────────────────────────────
    const baseUrl = process.env.NEON_AUTH_BASE_URL;
    const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;
    if (!baseUrl || !cookieSecret) return NextResponse.next();

    const hasVerifier = url.searchParams.has("neon_auth_session_verifier");
    const isProtected = path.startsWith("/webp/dashboard");
    if (!hasVerifier && !isProtected) return NextResponse.next();

    const { createNeonAuth } = await import("@neondatabase/auth/next/server");
    const auth = createNeonAuth({ baseUrl, cookies: { secret: cookieSecret } });
    const mw = (auth as unknown as { middleware: (opts: { loginUrl: string }) => (r: NextRequest) => Promise<Response> })
        .middleware({ loginUrl: "/webp/activate" });
    return mw(req);
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
