// Neon Auth catch-all handler. Only active when Neon Auth env vars are set;
// otherwise responds 404 so the email-only flow keeps working unchanged.

import { loadAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

type RouteContext = { params: { path: string[] } | Promise<{ path: string[] }> };

async function handler(req: Request, context: RouteContext) {
    const auth = await loadAuth();
    if (!auth) {
        return NextResponse.json(
            { error: "Neon Auth is not configured yet" },
            { status: 404 },
        );
    }
    const routes = auth.handler() as Record<string, (r: Request, ctx: RouteContext) => Promise<Response>>;
    const fn = routes[req.method === "POST" ? "POST" : "GET"];
    if (!fn) {
        return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
    }
    return fn(req, context);
}

export const GET = handler;
export const POST = handler;
