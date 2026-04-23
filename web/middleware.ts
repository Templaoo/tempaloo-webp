import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Runs Neon Auth's middleware only when we really need it:
 *   1. On any URL carrying `?neon_auth_session_verifier=...` — the OAuth callback
 *      lands here after Google. The middleware swaps the one-time token for a
 *      session cookie and redirects to the original page.
 *   2. On protected routes (`/webp/dashboard/*`) — to refresh the session and
 *      send unauthenticated users to the activate page.
 *
 * On public pages (/, /webp, /webp/activate) without a verifier we short-circuit
 * so the landing doesn't get redirected away.
 */
export default async function middleware(req: NextRequest) {
    const baseUrl = process.env.NEON_AUTH_BASE_URL;
    const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;
    if (!baseUrl || !cookieSecret) return NextResponse.next();

    const url = req.nextUrl;
    const hasVerifier = url.searchParams.has("neon_auth_session_verifier");
    const isProtected = url.pathname.startsWith("/webp/dashboard");
    if (!hasVerifier && !isProtected) return NextResponse.next();

    const { createNeonAuth } = await import("@neondatabase/auth/next/server");
    const auth = createNeonAuth({ baseUrl, cookies: { secret: cookieSecret } });
    const mw = (auth as unknown as { middleware: (opts: { loginUrl: string }) => (r: NextRequest) => Promise<Response> })
        .middleware({ loginUrl: "/webp/activate" });
    return mw(req);
}

export const config = {
    // Skip static assets — otherwise run on everything (the function above
    // gates further based on path + verifier).
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
