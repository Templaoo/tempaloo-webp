import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { deactivateSite } from "@/lib/account";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
    licenseId: z.string().uuid(),
    siteHost: z.string().min(1),
});

/**
 * Defense in depth on top of SameSite=Lax session cookies:
 * accept the request only when Origin matches our own site. Blocks a
 * compromised partner subdomain from piggy-backing on an authenticated
 * session, even in the unlikely event a CSRF bypass ever lands.
 */
function isAllowedOrigin(origin: string | null): boolean {
    if (!origin) return true; // same-origin fetch (no Origin header) — Next/browser internals
    try {
        const host = new URL(origin).host;
        return (
            host === "tempaloo.com" ||
            host.endsWith(".tempaloo.com") ||
            host === "localhost:3001" ||
            host.endsWith(".vercel.app")  // preview deployments
        );
    } catch {
        return false;
    }
}

export async function POST(req: Request) {
    if (!isAllowedOrigin(req.headers.get("origin"))) {
        return NextResponse.json({ error: "bad_origin" }, { status: 403 });
    }
    const user = await getCurrentUser();
    if (!user?.email) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    let parsed;
    try {
        parsed = bodySchema.parse(await req.json());
    } catch {
        return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    try {
        await deactivateSite({ email: user.email, licenseId: parsed.licenseId, siteHost: parsed.siteHost });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Deactivate failed";
        const status = msg.includes("not found") ? 404 : 500;
        return NextResponse.json({ error: msg }, { status });
    }
    return new NextResponse(null, { status: 204 });
}
