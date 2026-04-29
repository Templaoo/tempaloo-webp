/**
 * Browser-facing PDF download proxy.
 *
 * The browser hits /api/invoices?id=<paymentId>. We:
 *   1. Verify the user is authenticated via Better Auth.
 *   2. Pass their session email + the requested paymentId to the
 *      Fastify API along with the X-Internal-Key.
 *   3. Stream the PDF blob back to the browser.
 *
 * Why not link directly to the Fastify endpoint: the API is on a
 * different origin AND requires the internal key (which must never
 * touch the browser). The proxy keeps both invariants intact.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";

const API_BASE = process.env.TEMPALOO_API_BASE ?? "http://localhost:3000/v1";
const INTERNAL_KEY = process.env.TEMPALOO_INTERNAL_KEY ?? "dev-internal-17f4e6a9-please-change-in-prod";

export async function GET(req: NextRequest) {
    const paymentId = req.nextUrl.searchParams.get("id");
    if (!paymentId) {
        return NextResponse.json({ error: "missing id" }, { status: 400 });
    }
    const user = await getCurrentUser();
    if (!user?.email) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const upstream = await fetch(`${API_BASE}/account/invoices/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Internal-Key": INTERNAL_KEY },
        body: JSON.stringify({ email: user.email, paymentId }),
        cache: "no-store",
    });

    if (!upstream.ok) {
        const j = await upstream.json().catch(() => null);
        return NextResponse.json(j ?? { error: `HTTP ${upstream.status}` }, { status: upstream.status });
    }

    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
        status: 200,
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": upstream.headers.get("content-disposition") ?? `attachment; filename="invoice-${paymentId}.pdf"`,
            "Cache-Control": "no-store",
        },
    });
}
