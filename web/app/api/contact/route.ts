import { NextResponse, type NextRequest } from "next/server";

/**
 * POST /api/contact — public contact-form endpoint.
 *
 * The visitor's submission is validated, rate-limited, honeypot-checked
 * here on the Vercel edge, then forwarded to the Fastify API
 * (api.tempaloo.com/v1/contact) which actually sends the two emails
 * via Brevo. The API already has BREVO_API_KEY + a verified sender
 * configured on Render, so we don't have to duplicate that setup on
 * Vercel — one source of truth for transactional email config.
 *
 * Two emails go out per submission:
 *   1. NOTIFICATION → otmane.hammadi.1@gmail.com (or CONTACT_TO_EMAIL).
 *      Reply-To = the visitor, so a reply lands directly in their inbox.
 *   2. CONFIRMATION → the visitor. Reply-To = our team inbox, so a
 *      reply continues the thread on our side.
 *
 * Optional env (web project on Vercel):
 *   NEXT_PUBLIC_TEMPALOO_API_BASE — defaults to https://api.tempaloo.com/v1
 *   TEMPALOO_API_BASE             — server-only override (alternate to above)
 *   CONTACT_FORWARD_TOKEN         — shared secret with the API. When set
 *                                   here AND on Render, the API rejects
 *                                   requests missing the matching token.
 *                                   Optional in dev, recommended in prod.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In-memory rate limit. Each Vercel serverless instance has its own
// counter, so a hammered attacker could in theory dodge it across
// cold starts — Brevo's anti-abuse kicks in well before that becomes
// a real problem.
const HITS = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_HITS = 5;              // 5 submissions / 5 min / IP

function ipFromRequest(req: NextRequest): string {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim();
    const real = req.headers.get("x-real-ip");
    if (real) return real;
    return "unknown";
}

function rateLimited(ip: string): boolean {
    const now = Date.now();
    const cur = HITS.get(ip);
    if (!cur || cur.resetAt < now) {
        HITS.set(ip, { count: 1, resetAt: now + WINDOW_MS });
        return false;
    }
    cur.count += 1;
    return cur.count > MAX_HITS;
}

interface Payload {
    name: string;
    email: string;
    company?: string;
    topic: string;
    siteUrl?: string;
    message: string;
    consent: boolean;
    website?: string; // honeypot
}

function isEmail(s: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function validate(body: unknown): { ok: true; data: Payload } | { ok: false; error: string } {
    if (!body || typeof body !== "object") return { ok: false, error: "Invalid request body" };
    const b = body as Record<string, unknown>;

    const name    = typeof b.name === "string" ? b.name.trim() : "";
    const email   = typeof b.email === "string" ? b.email.trim() : "";
    const company = typeof b.company === "string" ? b.company.trim().slice(0, 200) : "";
    const topic   = typeof b.topic === "string" ? b.topic.trim() : "";
    const siteUrl = typeof b.siteUrl === "string" ? b.siteUrl.trim().slice(0, 300) : "";
    const message = typeof b.message === "string" ? b.message.trim() : "";
    const consent = b.consent === true;
    const website = typeof b.website === "string" ? b.website.trim() : "";

    if (!name || name.length > 200) return { ok: false, error: "Name is required (max 200 chars)" };
    if (!email || !isEmail(email))  return { ok: false, error: "Valid email is required" };
    if (!message || message.length < 10 || message.length > 5000) {
        return { ok: false, error: "Message must be between 10 and 5000 characters" };
    }
    if (!consent) return { ok: false, error: "Consent is required" };
    const allowedTopics = ["support", "sales", "partnership", "press", "other"];
    if (!allowedTopics.includes(topic)) return { ok: false, error: "Unknown topic" };

    return { ok: true, data: { name, email, company, topic, siteUrl, message, consent, website } };
}

function apiBaseUrl(): string {
    const base = process.env.NEXT_PUBLIC_TEMPALOO_API_BASE
        ?? process.env.TEMPALOO_API_BASE
        ?? "https://api.tempaloo.com/v1";
    return base.replace(/\/+$/, "");
}

export async function POST(req: NextRequest) {
    const ip = ipFromRequest(req);

    // Same-origin / dev-origin allowlist. Anything else is a CSRF
    // attempt — refuse on the spot.
    const origin = req.headers.get("origin") ?? "";
    if (origin) {
        const allowed = [
            "https://tempaloo.com",
            "https://www.tempaloo.com",
            "https://staging.tempaloo.com",
            "http://localhost:3001",
            "http://localhost:3000",
        ];
        let ok = allowed.includes(origin);
        try {
            if (!ok) ok = /\.vercel\.app$/.test(new URL(origin).hostname);
        } catch { ok = false; }
        if (!ok) {
            return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
        }
    }

    if (rateLimited(ip)) {
        return NextResponse.json(
            { error: "Too many submissions. Try again in a few minutes." },
            { status: 429 },
        );
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
    }

    const v = validate(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    // Honeypot — bots fill every text field. Real users never see this
    // one (CSS-hidden + tabindex=-1). Silently pretend success so bots
    // don't retune.
    if (v.data.website && v.data.website.trim() !== "") {
        return NextResponse.json({ ok: true });
    }

    // Forward to the Fastify API. It owns Brevo + sends the two emails.
    const forwardToken = process.env.CONTACT_FORWARD_TOKEN ?? "";
    const url = `${apiBaseUrl()}/contact`;

    try {
        const upstream = await fetch(url, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                accept: "application/json",
                ...(forwardToken ? { "x-tempaloo-contact-token": forwardToken } : {}),
            },
            body: JSON.stringify({
                name:    v.data.name,
                email:   v.data.email,
                company: v.data.company || undefined,
                topic:   v.data.topic,
                siteUrl: v.data.siteUrl || undefined,
                message: v.data.message,
                ip,
            }),
        });

        if (!upstream.ok) {
            const body = await upstream.text().catch(() => "");
            // eslint-disable-next-line no-console
            console.error("[contact] upstream API returned %d body=%s url=%s", upstream.status, body, url);
            // Bubble the upstream's own message when it carries one,
            // else a generic "couldn't deliver" fallback.
            let detail = "We couldn't deliver your message right now. Please try again in a minute.";
            try {
                const j = JSON.parse(body) as { error?: string };
                if (j?.error) detail = j.error;
            } catch { /* not JSON */ }
            return NextResponse.json({ error: detail }, { status: 502 });
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[contact] upstream API unreachable url=%s:", url, err);
        return NextResponse.json(
            { error: "We couldn't reach our messaging service. Please try again in a moment." },
            { status: 502 },
        );
    }
}

/**
 * GET /api/contact — diagnostic. Mirrors the upstream API's
 * /v1/contact/diag with one extra field (`reachable`) that pings the
 * upstream and reports whether the forwarding chain is wired end-to-
 * end. Hit this in a browser any time something feels off.
 */
export async function GET() {
    const url = `${apiBaseUrl()}/contact/diag`;
    let upstream: unknown = null;
    let reachable = false;
    try {
        const r = await fetch(url, { method: "GET", cache: "no-store" });
        reachable = r.ok;
        upstream = await r.json().catch(() => null);
    } catch {
        reachable = false;
    }
    return NextResponse.json({
        web: {
            apiBase: apiBaseUrl(),
            forwardTokenSet: !!process.env.CONTACT_FORWARD_TOKEN,
            nodeEnv: process.env.NODE_ENV ?? "unknown",
        },
        upstream: { reachable, diag: upstream },
        hint: reachable
            ? "Web → API forwarding is wired. If submissions still don't email, check the upstream `diag` payload."
            : `Web couldn't reach ${url}. Check that NEXT_PUBLIC_TEMPALOO_API_BASE is set on Vercel and the API is up.`,
    });
}
