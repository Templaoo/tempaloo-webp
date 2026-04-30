import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { sendTransactional } from "../lib/email.js";

/**
 * Public contact-form endpoint.
 *
 * The Next.js website's /api/contact route forwards form submissions
 * here so we have ONE place that talks to Brevo (the Fastify API,
 * already configured with BREVO_API_KEY on Render). The Vercel web
 * project no longer needs its own Brevo env vars — saves config drift
 * and means the user only manages secrets in one place.
 *
 * Two emails are dispatched per submission:
 *   1. Notification to CONTACT_TO_EMAIL (our team inbox), reply-to set
 *      to the visitor's address so a single click answers them.
 *   2. Confirmation to the visitor's address with a copy of the
 *      message and reply-to pointing back at our team inbox.
 *
 * Validation, rate-limiting, origin check, and honeypot rejection
 * still happen on the Next.js side (it has the IP context and the
 * form-specific rules). This endpoint trusts only the same-origin
 * Vercel project plus a shared CONTACT_FORWARD_TOKEN to keep curious
 * scripts from spamming Brevo through our servers.
 */
const contactBody = z.object({
    name:    z.string().trim().min(1).max(200),
    email:   z.string().trim().email().max(200),
    company: z.string().trim().max(200).optional(),
    topic:   z.enum(["support", "sales", "partnership", "press", "other"]),
    siteUrl: z.string().trim().max(300).optional(),
    message: z.string().trim().min(10).max(5000),
    ip:      z.string().trim().max(64).optional(),
});

const TOPIC_LABEL: Record<z.infer<typeof contactBody>["topic"], string> = {
    support:     "Support",
    sales:       "Sales",
    partnership: "Partnership",
    press:       "Press",
    other:       "Other",
};

const TO_EMAIL = process.env.CONTACT_TO_EMAIL ?? "otmane.hammadi.1@gmail.com";

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export default async function contactRoute(app: FastifyInstance) {
    app.post("/contact", async (req, reply) => {
        // Same-origin / shared-secret guard. Anyone who learns this
        // endpoint's URL would otherwise spam Brevo through us — the
        // forwarding secret is shared between Vercel (CONTACT_FORWARD_TOKEN)
        // and Render (same name). When the env var is unset (early
        // dev), we accept the request to keep iteration easy.
        const expected = process.env.CONTACT_FORWARD_TOKEN;
        if (expected) {
            const got = req.headers["x-tempaloo-contact-token"];
            if (got !== expected) {
                return reply.code(403).send({ error: "Invalid forwarding token" });
            }
        }

        const parsed = contactBody.safeParse(req.body);
        if (!parsed.success) {
            return reply.code(400).send({
                error: "Invalid contact payload",
                detail: parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("; "),
            });
        }
        const p = parsed.data;
        const topicLabel = TOPIC_LABEL[p.topic];

        // ── Notification email (team inbox) ────────────────────────
        const notifySubject = `[Tempaloo Contact] ${topicLabel} — ${p.name}`;
        const notifyText = [
            `New contact form submission`,
            ``,
            `Topic:   ${topicLabel}`,
            `Name:    ${p.name}`,
            `Email:   ${p.email}`,
            p.company ? `Company: ${p.company}` : null,
            p.siteUrl ? `Site:    ${p.siteUrl}` : null,
            p.ip      ? `IP:      ${p.ip}`      : null,
            ``,
            `Message:`,
            p.message,
        ].filter(Boolean).join("\n");
        const notifyHtml = `<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;">
  <div style="border-bottom: 2px solid #2a57e6; padding-bottom: 12px; margin-bottom: 24px;">
    <h1 style="margin: 0; font-size: 18px; color: #111827;">New contact form submission</h1>
    <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Tempaloo · ${topicLabel}</div>
  </div>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
    <tr><td style="padding: 6px 0; color: #6b7280; width: 100px;">Name</td><td style="padding: 6px 0; color: #111827;"><strong>${escapeHtml(p.name)}</strong></td></tr>
    <tr><td style="padding: 6px 0; color: #6b7280;">Email</td><td style="padding: 6px 0; color: #111827;">${escapeHtml(p.email)}</td></tr>
    ${p.company ? `<tr><td style="padding: 6px 0; color: #6b7280;">Company</td><td style="padding: 6px 0;">${escapeHtml(p.company)}</td></tr>` : ""}
    ${p.siteUrl ? `<tr><td style="padding: 6px 0; color: #6b7280;">Site</td><td style="padding: 6px 0;">${escapeHtml(p.siteUrl)}</td></tr>` : ""}
    ${p.ip      ? `<tr><td style="padding: 6px 0; color: #6b7280;">IP</td><td style="padding: 6px 0; font-family: monospace; font-size: 12px; color: #6b7280;">${escapeHtml(p.ip)}</td></tr>` : ""}
  </table>
  <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 6px;">Message</div>
  <div style="background: #f9fafb; border-left: 3px solid #2a57e6; padding: 14px 16px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; color: #1f2937; border-radius: 0 6px 6px 0;">${escapeHtml(p.message)}</div>
</body></html>`;

        const notifyResult = await sendTransactional({
            to: TO_EMAIL,
            toName: "Tempaloo team",
            subject: notifySubject,
            html: notifyHtml,
            text: notifyText,
            tag: "contact-notify",
            // Reply directly = answer the visitor.
            headers: { "Reply-To": `${p.name} <${p.email}>` },
        }, req.log);

        if (!notifyResult.ok) {
            req.log.error(`[contact] notification send failed: ${notifyResult.reason}`);
            return reply.code(502).send({
                error: "We couldn't deliver your message to our team. Please try again in a minute.",
                detail: notifyResult.reason,
            });
        }

        // ── Confirmation email (visitor) ──────────────────────────
        const ackSubject = "We got your message — Tempaloo";
        const ackText = [
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
        const ackHtml = `<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1f2937; line-height: 1.55;">
  <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 24px;">
    <div style="font-weight: 600; font-size: 18px; color: #111827; letter-spacing: -0.02em;">Tempaloo</div>
    <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">Image optimization for WordPress</div>
  </div>
  <p style="font-size: 15px; margin: 0 0 14px;">Hi <strong>${escapeHtml(p.name)}</strong>,</p>
  <p style="font-size: 14.5px; margin: 0 0 14px;">
    Thanks for reaching out — we got your message and we'll reply within
    <strong>24 hours</strong> on business days. We read every message ourselves;
    no triage layer, no canned responses.
  </p>
  <p style="font-size: 13px; color: #6b7280; margin: 24px 0 8px; text-transform: uppercase; letter-spacing: 0.04em;">Your message, for reference</p>
  <div style="background: #f9fafb; border-left: 3px solid #2a57e6; padding: 12px 14px; font-size: 13.5px; line-height: 1.6; white-space: pre-wrap; color: #374151; border-radius: 0 6px 6px 0;">${escapeHtml(p.message)}</div>
  <p style="font-size: 13.5px; margin: 24px 0 0; color: #4b5563;">
    Need to add something? Just reply to this email — it goes straight to the team.
  </p>
  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11.5px; color: #9ca3af;">
    Tempaloo · 12 rue de la Paix, 75002 Paris, France<br>
    <a href="https://tempaloo.com" style="color: #6b7280;">tempaloo.com</a> · <a href="https://tempaloo.com/privacy" style="color: #6b7280;">Privacy</a> · <a href="https://tempaloo.com/terms" style="color: #6b7280;">Terms</a>
  </div>
</body></html>`;

        const ackResult = await sendTransactional({
            to: p.email,
            toName: p.name,
            subject: ackSubject,
            html: ackHtml,
            text: ackText,
            tag: "contact-ack",
            // Replies from the user go to the team inbox, not the
            // From: header sender.
            headers: { "Reply-To": `Tempaloo <${TO_EMAIL}>` },
        }, req.log);

        if (!ackResult.ok) {
            // Notification already sent; log the ack failure but don't
            // reject the form — the team got the message, the user
            // just won't see a confirmation in their inbox.
            req.log.warn(`[contact] confirmation send failed (notification ok): ${ackResult.reason}`);
        }

        return reply.send({ ok: true });
    });

    // Diagnostic — non-secret, used by the Next.js side and for manual
    // poking from a browser to confirm the API can reach Brevo.
    app.get("/contact/diag", async () => {
        return {
            brevoConfigured: !!config.BREVO_API_KEY,
            fromEmail: config.EMAIL_FROM,
            fromName: config.EMAIL_FROM_NAME,
            toEmail: TO_EMAIL,
            forwardTokenRequired: !!process.env.CONTACT_FORWARD_TOKEN,
        };
    });
}
