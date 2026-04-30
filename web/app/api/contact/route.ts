import { NextResponse, type NextRequest } from "next/server";

/**
 * POST /api/contact
 *
 * Receives the contact-form submission, validates it server-side
 * (defence in depth — never trust the client form), rejects honeypot
 * hits, applies a soft per-IP rate limit, and forwards the payload
 * to the Tempaloo team's inbox via Brevo's transactional email API.
 *
 * Email destination is otmane.hammadi.1@gmail.com today (Tempaloo
 * founder inbox); flip to a routing alias once the team grows.
 *
 * Required env (production):
 *   BREVO_API_KEY         — secret key from app.brevo.com
 *   EMAIL_FROM            — verified sender on Brevo (shared with the
 *                           Fastify API, so we don't have to verify a
 *                           second sender). Default matches api/src/config.ts.
 *   EMAIL_FROM_NAME       — display name for the From: header
 *   CONTACT_TO_EMAIL      — destination inbox (defaults below)
 *
 * If BREVO_API_KEY is missing (local dev), we log the payload to
 * stdout and return success so the form flow stays testable without
 * spamming a real inbox. In production a missing key would silently
 * accept submissions and lose them — we now log a CLEAR warning when
 * that happens so the bug is visible in Vercel logs.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TO_EMAIL   = process.env.CONTACT_TO_EMAIL ?? "otmane.hammadi.1@gmail.com";
// Use the same verified sender as the Fastify API (Brevo only sends from
// senders explicitly verified in the dashboard — using a fresh / unverified
// "noreply@tempaloo.com" address would silently fail on every send).
const FROM_EMAIL = process.env.EMAIL_FROM      ?? "julia.paterson@tempaloo.com";
const FROM_NAME  = process.env.EMAIL_FROM_NAME ?? "Tempaloo Contact";

// In-memory rate limit. Sufficient for the load Tempaloo gets today
// (single-instance Vercel serverless cold-starts notwithstanding —
// each cold instance has its own limiter, so a hammered attacker
// could theoretically dodge it across instances. Brevo's anti-abuse
// kicks in well before that becomes a real problem).
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
    if (cur.count > MAX_HITS) return true;
    return false;
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

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function buildEmail(p: Payload, ip: string): { subject: string; html: string; text: string } {
    const topicLabel: Record<string, string> = {
        support: "Support",
        sales: "Sales",
        partnership: "Partnership",
        press: "Press",
        other: "Other",
    };
    const subject = `[Tempaloo Contact] ${topicLabel[p.topic] ?? p.topic} — ${p.name}`;

    const text = [
        `New contact form submission`,
        ``,
        `Topic:   ${topicLabel[p.topic] ?? p.topic}`,
        `Name:    ${p.name}`,
        `Email:   ${p.email}`,
        p.company ? `Company: ${p.company}` : null,
        p.siteUrl ? `Site:    ${p.siteUrl}` : null,
        `IP:      ${ip}`,
        ``,
        `Message:`,
        p.message,
    ].filter(Boolean).join("\n");

    const html = `
<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;">
  <div style="border-bottom: 2px solid #2a57e6; padding-bottom: 12px; margin-bottom: 24px;">
    <h1 style="margin: 0; font-size: 18px; color: #111827;">New contact form submission</h1>
    <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Tempaloo · ${topicLabel[p.topic] ?? p.topic}</div>
  </div>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
    <tr><td style="padding: 6px 0; color: #6b7280; width: 100px;">Name</td><td style="padding: 6px 0; color: #111827;"><strong>${escapeHtml(p.name)}</strong></td></tr>
    <tr><td style="padding: 6px 0; color: #6b7280;">Email</td><td style="padding: 6px 0; color: #111827;"><a href="mailto:${escapeHtml(p.email)}" style="color: #2a57e6;">${escapeHtml(p.email)}</a></td></tr>
    ${p.company ? `<tr><td style="padding: 6px 0; color: #6b7280;">Company</td><td style="padding: 6px 0;">${escapeHtml(p.company)}</td></tr>` : ""}
    ${p.siteUrl ? `<tr><td style="padding: 6px 0; color: #6b7280;">Site</td><td style="padding: 6px 0;"><a href="${escapeHtml(p.siteUrl)}" style="color: #2a57e6;">${escapeHtml(p.siteUrl)}</a></td></tr>` : ""}
    <tr><td style="padding: 6px 0; color: #6b7280;">IP</td><td style="padding: 6px 0; font-family: monospace; font-size: 12px; color: #6b7280;">${escapeHtml(ip)}</td></tr>
  </table>
  <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 6px;">Message</div>
  <div style="background: #f9fafb; border-left: 3px solid #2a57e6; padding: 14px 16px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; color: #1f2937; border-radius: 0 6px 6px 0;">${escapeHtml(p.message)}</div>
  <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af;">
    Reply directly — Brevo&rsquo;s reply-to header points back to ${escapeHtml(p.email)}.
  </div>
</body></html>`.trim();

    return { subject, html, text };
}

/**
 * Confirmation copy for the user who submitted the form. Lets them
 * (a) know we got their message — no anxious "did it send?" support
 * tickets, (b) keep a copy of what they wrote in their own inbox,
 * (c) reply to the email to add follow-up info if they want.
 */
function buildClientAck(p: Payload): { subject: string; html: string; text: string } {
    const subject = "We got your message — Tempaloo";
    const text = [
        `Hi ${p.name},`,
        ``,
        `Thanks for reaching out to Tempaloo. We received your message and`,
        `we'll reply to ${p.email} within 24 hours, business days.`,
        ``,
        `For your records, here is a copy of what you sent:`,
        ``,
        `─────────────`,
        p.message,
        `─────────────`,
        ``,
        `If you need to add information, just reply to this email.`,
        ``,
        `— The Tempaloo team`,
        `https://tempaloo.com`,
    ].join("\n");

    const html = `
<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1f2937; line-height: 1.55;">
  <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 24px;">
    <div style="font-weight: 600; font-size: 18px; color: #111827; letter-spacing: -0.02em;">Tempaloo</div>
    <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">Image optimization for WordPress</div>
  </div>
  <p style="font-size: 15px; margin: 0 0 14px;">Hi <strong>${escapeHtml(p.name)}</strong>,</p>
  <p style="font-size: 14.5px; margin: 0 0 14px;">
    Thanks for reaching out — we got your message and we&rsquo;ll reply within
    <strong>24 hours</strong> on business days. We read every message ourselves;
    no triage layer, no canned responses.
  </p>
  <p style="font-size: 13px; color: #6b7280; margin: 24px 0 8px; text-transform: uppercase; letter-spacing: 0.04em;">Your message, for reference</p>
  <div style="background: #f9fafb; border-left: 3px solid #2a57e6; padding: 12px 14px; font-size: 13.5px; line-height: 1.6; white-space: pre-wrap; color: #374151; border-radius: 0 6px 6px 0;">${escapeHtml(p.message)}</div>
  <p style="font-size: 13.5px; margin: 24px 0 0; color: #4b5563;">
    Need to add something? Just reply to this email — it goes straight to the team.
  </p>
  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11.5px; color: #9ca3af;">
    Tempaloo SAS · 12 rue de la Paix, 75002 Paris, France<br>
    <a href="https://tempaloo.com" style="color: #6b7280;">tempaloo.com</a> · <a href="https://tempaloo.com/privacy" style="color: #6b7280;">Privacy</a> · <a href="https://tempaloo.com/terms" style="color: #6b7280;">Terms</a>
  </div>
</body></html>`.trim();

    return { subject, html, text };
}

async function sendViaBrevo(payload: { from: { email: string; name: string }; to: { email: string; name?: string }[]; replyTo: { email: string; name: string }; subject: string; htmlContent: string; textContent: string }): Promise<{ ok: boolean; status: number; body?: string }> {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
        // Dev fallback: log the payload, pretend success. In production
        // the absence of BREVO_API_KEY is a real bug (silent submission
        // loss), so the warning is loud-enough to catch in Vercel logs.
        // eslint-disable-next-line no-console
        console.warn(
            "[contact] BREVO_API_KEY is not set — submission accepted but NOT sent. From=%s To=%s Subject=%s",
            payload.from.email,
            payload.to[0]?.email,
            payload.subject,
        );
        return { ok: true, status: 200 };
    }

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            "api-key": apiKey,
            "content-type": "application/json",
            accept: "application/json",
        },
        body: JSON.stringify({
            sender: payload.from,
            to: payload.to,
            replyTo: payload.replyTo,
            subject: payload.subject,
            htmlContent: payload.htmlContent,
            textContent: payload.textContent,
        }),
    });

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        // Surface the real cause in Vercel logs. Most common: HTTP 400
        // with `{"code":"invalid_parameter","message":"sender ... is
        // not valid"}` when the From address isn't verified in Brevo.
        // eslint-disable-next-line no-console
        console.error(
            "[contact] Brevo /smtp/email failed — status=%d From=%s To=%s body=%s",
            res.status,
            payload.from.email,
            payload.to[0]?.email,
            body,
        );
        return { ok: false, status: res.status, body };
    }
    return { ok: true, status: res.status };
}

export async function POST(req: NextRequest) {
    const ip = ipFromRequest(req);

    // Origin check — reject cross-origin POSTs from anywhere outside
    // tempaloo.com (and dev origins). Cheap CSRF guard.
    const origin = req.headers.get("origin") ?? "";
    if (origin) {
        const allowed = [
            "https://tempaloo.com",
            "https://www.tempaloo.com",
            "https://staging.tempaloo.com",
            "http://localhost:3001",
            "http://localhost:3000",
        ];
        const ok = allowed.some((o) => origin === o) || /\.vercel\.app$/.test(new URL(origin).hostname);
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
    // one (CSS-hidden + tabindex=-1). If it's non-empty, silently
    // pretend success so bots don't retune.
    if (v.data.website && v.data.website.trim() !== "") {
        return NextResponse.json({ ok: true });
    }

    // Two parallel emails:
    //   1. NOTIFICATION to the Tempaloo inbox so we know someone reached
    //      out. Reply-To is the visitor's address — hitting Reply on the
    //      mail client lands directly in their inbox.
    //   2. CONFIRMATION to the visitor so they know we received it,
    //      keep a copy of what they wrote, and can reply to extend the
    //      thread if they need to.
    //
    // We treat the notification as the "must succeed" path. The
    // confirmation is best-effort — a failure there shouldn't reject
    // the form (the team email is what matters for follow-up). Both
    // failures are logged to Vercel for diagnostics.
    const notify = buildEmail(v.data, ip);
    const ack    = buildClientAck(v.data);

    const [notifyResult, ackResult] = await Promise.all([
        sendViaBrevo({
            from:    { email: FROM_EMAIL, name: FROM_NAME },
            to:      [{ email: TO_EMAIL }],
            replyTo: { email: v.data.email, name: v.data.name },
            subject: notify.subject,
            htmlContent: notify.html,
            textContent: notify.text,
        }),
        sendViaBrevo({
            from:    { email: FROM_EMAIL, name: FROM_NAME },
            to:      [{ email: v.data.email, name: v.data.name }],
            // Reply-To = our inbox so when the user replies to the
            // confirmation, the thread continues with the team rather
            // than bouncing back to the From: address.
            replyTo: { email: TO_EMAIL, name: "Tempaloo" },
            subject: ack.subject,
            htmlContent: ack.html,
            textContent: ack.text,
        }),
    ]);

    if (!notifyResult.ok) {
        // eslint-disable-next-line no-console
        console.error("[contact] Brevo NOTIFICATION send failed", notifyResult);
        return NextResponse.json(
            { error: "We couldn't send your message. Try again in a moment or use a different browser." },
            { status: 502 },
        );
    }
    if (!ackResult.ok) {
        // The team got it — the visitor just won't see a confirmation
        // in their inbox. Log it but don't fail the request: the
        // submission is successful from the support standpoint.
        // eslint-disable-next-line no-console
        console.warn("[contact] Brevo CONFIRMATION send failed (notification ok)", ackResult);
    }

    return NextResponse.json({ ok: true });
}

// 405 for everything else.
export async function GET() {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
