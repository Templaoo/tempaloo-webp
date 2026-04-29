/**
 * Aggressive logout — kills ALL session cookies the browser sent us.
 *
 * Why this exists:
 * The earlier flow (POST /api/auth/sign-out + window.location.replace)
 * silently failed for some users — Better Auth would respond 200 but
 * leave the cookies in place, so the next request to /webp/dashboard
 * still saw them as authenticated. Possible causes:
 *   · Better Auth uses multiple cookies (session_token + session_data
 *     + maybe csrf), and the sign-out endpoint only expires one.
 *   · Set-Cookie expiry needs to match the original Path / Domain;
 *     Better Auth wasn't always echoing the right combo back.
 *   · The browser's bfcache (back/forward cache) keeps the dashboard
 *     in memory even when cookies change.
 *
 * Fix: don't trust upstream. We iterate every cookie the request came
 * with and emit Set-Cookie expiry headers for each, with multiple Path
 * variations (/, /webp, /api/auth) so the browser can't pick a "wrong
 * path" copy to keep alive. Finally call Better Auth's sign-out so
 * the server-side session row is invalidated too — best-effort, we
 * don't fail the logout if it errors.
 */
import { NextResponse, type NextRequest } from "next/server";

const COOKIE_PATHS_TO_KILL = ["/", "/webp", "/api", "/api/auth"];

export async function POST(req: NextRequest) {
    return doLogout(req);
}

// Allow GET too — some browsers strip the body on Beacon-style logout.
// Same effect either way.
export async function GET(req: NextRequest) {
    return doLogout(req);
}

async function doLogout(req: NextRequest): Promise<NextResponse> {
    // 1. Best-effort: tell Better Auth to invalidate the server-side session.
    //    We forward the cookie header so it can identify the session.
    try {
        const baseUrl = process.env.NEON_AUTH_BASE_URL;
        const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;
        if (baseUrl && cookieSecret) {
            const proto = req.headers.get("x-forwarded-proto") ?? "https";
            const host  = req.headers.get("host") ?? "tempaloo.com";
            await fetch(`${proto}://${host}/api/auth/sign-out`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    cookie: req.headers.get("cookie") ?? "",
                },
                body: "{}",
                cache: "no-store",
            }).catch(() => { /* not fatal */ });
        }
    } catch { /* not fatal */ }

    // 2. Build a response that nukes every cookie we received.
    const res = NextResponse.json({ ok: true }, {
        status: 200,
        headers: {
            // Defensive against bfcache + ISP-level caching of the
            // 200 response. Force fresh state on every navigation.
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
            // Clear only cookies + storage. Adding "cache" was too
            // aggressive — it purged Service Worker / IndexedDB / Cache
            // Storage that the next sign-in flow may depend on (CSRF
            // tokens stashed by Better Auth, etc.). Cookies + storage
            // are enough to wipe the session state.
            "Clear-Site-Data": "\"cookies\", \"storage\"",
        },
    });

    // 3. Iterate every incoming cookie and emit Set-Cookie expiries
    //    for each (with multiple Paths). Belt-and-braces — if Better
    //    Auth originally set a cookie at Path=/api/auth, expiring it
    //    at Path=/ won't kill it; we cover the common roots.
    const incoming = req.cookies.getAll();
    for (const c of incoming) {
        for (const path of COOKIE_PATHS_TO_KILL) {
            res.cookies.set({
                name: c.name,
                value: "",
                path,
                expires: new Date(0),
                maxAge: 0,
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
            });
        }
    }

    return res;
}
