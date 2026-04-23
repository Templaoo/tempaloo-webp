import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Returns the signed-in user's email and name, or null when not authenticated. */
export async function GET() {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ user: null });
    return NextResponse.json({
        user: { email: user.email, name: user.name ?? null },
    });
}
