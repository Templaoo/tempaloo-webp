import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { deactivateSite } from "@/lib/account";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
    licenseId: z.string().uuid(),
    siteHost: z.string().min(1),
});

export async function POST(req: Request) {
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
