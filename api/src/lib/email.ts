import { BrevoClient } from "@getbrevo/brevo";
import { config } from "../config.js";

/**
 * Brevo transactional email wrapper.
 *
 * Single entry point — `sendTransactional()` — used by every trigger
 * (welcome, trial-ending, payment, quota, …). Centralizes:
 *   · API key load (lazy — letting the API boot without Brevo configured)
 *   · From/reply-to defaults
 *   · Plain-text fallback (Brevo recommends both for inboxing)
 *   · Tagging (so we can filter by `welcome`, `trial`, … in Brevo dashboard)
 *
 * Failure is LOGGED, never thrown. A webhook handler must not 500
 * because Brevo had a hiccup — Freemius would retry the webhook and
 * the customer would get the email twice (or N times). Better to log
 * the failure and let it be retried via a dedicated path if needed.
 *
 * In dev (no BREVO_API_KEY): logs the email to stdout and returns ok.
 */
export interface SendOpts {
    to: string;
    toName?: string;
    subject: string;
    html: string;
    text: string;
    /** Brevo tag — surfaces in the dashboard for filtering. */
    tag: string;
    /** Optional headers — useful for Reply-To overrides per email. */
    headers?: Record<string, string>;
}

let cachedClient: BrevoClient | null = null;

function getClient(): BrevoClient | null {
    if (!config.BREVO_API_KEY) return null;
    if (cachedClient) return cachedClient;
    // SDK v5 exposes a single Fern-generated client; the constructor
    // accepts `apiKey` even though the public BaseClientOptions type
    // only lists transport-level fields (the Fern auth provider reads
    // it internally). Casting is the documented pattern.
    cachedClient = new BrevoClient({ apiKey: config.BREVO_API_KEY } as unknown as ConstructorParameters<typeof BrevoClient>[0]);
    return cachedClient;
}

export async function sendTransactional(
    opts: SendOpts,
    log?: { error: (...a: unknown[]) => void; info: (...a: unknown[]) => void },
): Promise<{ ok: boolean; messageId?: string; reason?: string }> {
    const client = getClient();
    if (!client) {
        // Dev / unconfigured: log + skip. Don't pretend it sent.
        const line = `[email:dev] tag=${opts.tag} to=${opts.to} subject="${opts.subject}"`;
        (log?.info ?? console.log)(line);
        return { ok: false, reason: "brevo_not_configured" };
    }

    try {
        const res = await client.transactionalEmails.sendTransacEmail({
            sender: { email: config.EMAIL_FROM, name: config.EMAIL_FROM_NAME },
            replyTo: config.EMAIL_REPLY_TO ? { email: config.EMAIL_REPLY_TO } : undefined,
            to: [{ email: opts.to, name: opts.toName ?? opts.to }],
            subject: opts.subject,
            htmlContent: opts.html,
            textContent: opts.text,
            tags: [opts.tag],
            headers: opts.headers,
        } as unknown as Parameters<BrevoClient["transactionalEmails"]["sendTransacEmail"]>[0]);
        const messageId = (res as { messageId?: string } | undefined)?.messageId;
        return { ok: true, messageId };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        (log?.error ?? console.error)(`[email] send failed tag=${opts.tag} to=${opts.to}: ${msg}`);
        return { ok: false, reason: msg };
    }
}
