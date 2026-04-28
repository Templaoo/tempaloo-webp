import { config } from "../config.js";
import type { SendOpts } from "./email.js";

/**
 * Email templates — brand-styled HTML + plain-text fallback.
 *
 * Design constraints (intentional):
 *   · 600px max width, single column — universal email-client support
 *   · No external CSS, no media queries that don't work in Outlook
 *   · Inline styles only (Gmail strips <style> blocks in many clients)
 *   · Uses the same brand tokens as the web app, hard-coded (CSS vars
 *     don't render in email)
 *
 * Each template returns a complete `SendOpts` payload so the caller
 * just does `sendTransactional(welcomeFreeEmail({...}))`.
 */

const BRAND = {
    bg: "#FFFFFF",
    bg2: "#FAFAFA",
    ink: "#0A0A0A",
    ink2: "#3A3A3A",
    ink3: "#6E6E6E",
    line: "rgba(0, 0, 0, 0.06)",
    accent: "#0A0A0A",         // Tempaloo: ink-on-bg primary
    success: "#17C964",
    warn: "#F5A524",
    danger: "#E5484D",
};

/** Wraps body content in the standard Tempaloo email shell. */
function shell({ title, preheader, bodyHtml }: { title: string; preheader: string; bodyHtml: string }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escape(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg2};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${BRAND.ink};">
<!-- Preheader (hidden but shown in inbox preview) -->
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${BRAND.bg2};">${escape(preheader)}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.bg2};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${BRAND.bg};border:1px solid ${BRAND.line};border-radius:12px;overflow:hidden;">

<tr><td style="padding:24px 32px;border-bottom:1px solid ${BRAND.line};">
    <a href="${config.WEB_BASE_URL}" style="text-decoration:none;color:${BRAND.ink};font-size:15px;font-weight:600;letter-spacing:-0.015em;">
        Tempaloo<span style="color:${BRAND.ink3};font-weight:400;"> / WebP</span>
    </a>
</td></tr>

<tr><td style="padding:32px;">${bodyHtml}</td></tr>

<tr><td style="padding:20px 32px;background:${BRAND.bg2};border-top:1px solid ${BRAND.line};font-size:12px;color:${BRAND.ink3};line-height:1.55;">
    Sent by Tempaloo · <a href="${config.WEB_BASE_URL}" style="color:${BRAND.ink3};">tempaloo.com</a><br>
    Need help? Reply to this email and we'll get back to you.
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function btn(href: string, label: string) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
        <tr><td style="background:${BRAND.accent};border-radius:8px;">
            <a href="${href}" style="display:inline-block;padding:12px 22px;color:${BRAND.bg};font-size:14px;font-weight:500;text-decoration:none;letter-spacing:-0.01em;">
                ${escape(label)}
            </a>
        </td></tr>
    </table>`;
}

function p(text: string) {
    return `<p style="margin:0 0 14px;font-size:14.5px;line-height:1.6;color:${BRAND.ink2};">${text}</p>`;
}

function code(text: string) {
    return `<div style="margin:16px 0;padding:14px 16px;background:${BRAND.bg2};border:1px solid ${BRAND.line};border-radius:8px;font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:13px;color:${BRAND.ink};word-break:break-all;">${escape(text)}</div>`;
}

function escape(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]!));
}

// ─── Templates ──────────────────────────────────────────────────────

interface UserCtx { email: string; firstName?: string; }
interface LicenseCtx extends UserCtx { licenseKey: string; planName: string; }
interface QuotaCtx extends UserCtx { planName: string; usedPct: number; imagesUsed: number; imagesQuota: number; }
interface TrialCtx extends LicenseCtx { daysLeft: number; trialEndsOn: string; }
interface PaymentCtx extends UserCtx { planName: string; amountCents: number; currency: string; nextBillingOn?: string; }

function greet(ctx: UserCtx): string {
    return ctx.firstName ? `Hi ${escape(ctx.firstName)},` : "Hi,";
}

export function welcomeFreeEmail(ctx: LicenseCtx): SendOpts {
    const dashUrl = `${config.WEB_BASE_URL}/webp/dashboard`;
    const html = shell({
        title: "Welcome to Tempaloo WebP",
        preheader: `Your free license key is ready — start optimizing images in 30 seconds.`,
        bodyHtml: `
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;letter-spacing:-0.02em;color:${BRAND.ink};">Welcome to Tempaloo WebP.</h1>
            ${p(`${greet(ctx)}`)}
            ${p(`Your free license is active. Here's your key — paste it into the plugin's <strong>License</strong> tab in your WordPress admin:`)}
            ${code(ctx.licenseKey)}
            ${p(`The Free plan covers <strong>250 images per month</strong>, with rollover for 30 days. You can upgrade any time from your dashboard if you need more.`)}
            ${btn(dashUrl, "Open dashboard →")}
            ${p(`<a href="${config.WEB_BASE_URL}/docs" style="color:${BRAND.ink2};">Quick-start guide</a> · <a href="${config.WEB_BASE_URL}/webp" style="color:${BRAND.ink2};">Plugin features</a>`)}
        `,
    });
    return {
        to: ctx.email, toName: ctx.firstName,
        subject: "Welcome to Tempaloo WebP — your license key is inside",
        html,
        text: `${greet(ctx)}

Your free Tempaloo WebP license is active.

License key:
${ctx.licenseKey}

Paste it into the License tab of the plugin in your WordPress admin.

The Free plan covers 250 images per month with 30-day rollover. Upgrade any time at ${dashUrl}.

Need help? Reply to this email.

— Julia, Tempaloo`,
        tag: "welcome-free",
    };
}

export function trialStartedEmail(ctx: TrialCtx): SendOpts {
    const dashUrl = `${config.WEB_BASE_URL}/webp/dashboard`;
    const html = shell({
        title: `Your ${ctx.planName} trial is live`,
        preheader: `${ctx.daysLeft} days to try every feature on the ${ctx.planName} plan.`,
        bodyHtml: `
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;letter-spacing:-0.02em;color:${BRAND.ink};">Your ${escape(ctx.planName)} trial is live.</h1>
            ${p(`${greet(ctx)}`)}
            ${p(`You've got <strong>${ctx.daysLeft} days</strong> of full ${escape(ctx.planName)} access — no charge until ${escape(ctx.trialEndsOn)}.`)}
            ${p(`Your license key:`)}
            ${code(ctx.licenseKey)}
            ${btn(dashUrl, "Open dashboard →")}
            ${p(`We'll remind you 3 days before the trial ends. Cancel any time from your <a href="https://users.freemius.com/" style="color:${BRAND.ink2};">Freemius portal</a> — no questions asked.`)}
        `,
    });
    return {
        to: ctx.email, toName: ctx.firstName,
        subject: `${ctx.planName} trial active — ${ctx.daysLeft} days to explore`,
        html,
        text: `${greet(ctx)}

Your ${ctx.planName} trial is live for ${ctx.daysLeft} days. No charge until ${ctx.trialEndsOn}.

License key:
${ctx.licenseKey}

Dashboard: ${dashUrl}

Cancel any time at https://users.freemius.com/ — no questions asked.

— Julia, Tempaloo`,
        tag: "trial-started",
    };
}

export function trialEndingEmail(ctx: TrialCtx): SendOpts {
    const dashUrl = `${config.WEB_BASE_URL}/webp/dashboard`;
    const html = shell({
        title: `Your trial ends in ${ctx.daysLeft} days`,
        preheader: `Your ${ctx.planName} trial ends on ${ctx.trialEndsOn}.`,
        bodyHtml: `
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;letter-spacing:-0.02em;color:${BRAND.ink};">Your trial ends in ${ctx.daysLeft} days.</h1>
            ${p(`${greet(ctx)}`)}
            ${p(`Your ${escape(ctx.planName)} trial ends on <strong>${escape(ctx.trialEndsOn)}</strong>. After that, the card on file will be charged unless you cancel.`)}
            ${p(`Loving it? Nothing to do — you'll keep all features and your settings.`)}
            ${btn(dashUrl, "View my dashboard →")}
            ${p(`Not for you? <a href="https://users.freemius.com/" style="color:${BRAND.ink2};">Cancel from your Freemius portal</a> — takes 30 seconds.`)}
        `,
    });
    return {
        to: ctx.email, toName: ctx.firstName,
        subject: `Your Tempaloo trial ends in ${ctx.daysLeft} days`,
        html,
        text: `${greet(ctx)}

Your ${ctx.planName} trial ends on ${ctx.trialEndsOn} (${ctx.daysLeft} days from now).

Loving it? Nothing to do.
Not for you? Cancel at https://users.freemius.com/ in 30 seconds.

Dashboard: ${dashUrl}

— Julia, Tempaloo`,
        tag: "trial-ending",
    };
}

export function paymentReceivedEmail(ctx: PaymentCtx): SendOpts {
    const amount = new Intl.NumberFormat("en-EU", { style: "currency", currency: ctx.currency }).format(ctx.amountCents / 100);
    const dashUrl = `${config.WEB_BASE_URL}/webp/dashboard`;
    const html = shell({
        title: `Payment received — ${amount}`,
        preheader: `Receipt for your ${ctx.planName} subscription.`,
        bodyHtml: `
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;letter-spacing:-0.02em;color:${BRAND.ink};">Payment received.</h1>
            ${p(`${greet(ctx)}`)}
            ${p(`We've received <strong>${amount}</strong> for your ${escape(ctx.planName)} subscription. Thanks for sticking with us.`)}
            ${ctx.nextBillingOn ? p(`Next renewal: <strong>${escape(ctx.nextBillingOn)}</strong>.`) : ""}
            ${btn("https://users.freemius.com/", "Download invoice →")}
            ${p(`<a href="${dashUrl}" style="color:${BRAND.ink2};">View dashboard</a>`)}
        `,
    });
    return {
        to: ctx.email, toName: ctx.firstName,
        subject: `Payment received — ${amount} (${ctx.planName})`,
        html,
        text: `${greet(ctx)}

We've received ${amount} for your ${ctx.planName} subscription. Thanks!

${ctx.nextBillingOn ? `Next renewal: ${ctx.nextBillingOn}.` : ""}

Invoice + payment history: https://users.freemius.com/
Dashboard: ${dashUrl}

— Julia, Tempaloo`,
        tag: "payment-received",
    };
}

export function quotaWarnEmail(ctx: QuotaCtx): SendOpts {
    const dashUrl = `${config.WEB_BASE_URL}/webp/dashboard`;
    const html = shell({
        title: `${ctx.usedPct}% of your monthly quota used`,
        preheader: `You've used ${ctx.imagesUsed.toLocaleString()} of ${ctx.imagesQuota.toLocaleString()} images this month.`,
        bodyHtml: `
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;letter-spacing:-0.02em;color:${BRAND.ink};">You're at ${ctx.usedPct}% of your quota.</h1>
            ${p(`${greet(ctx)}`)}
            ${p(`You've used <strong>${ctx.imagesUsed.toLocaleString()} / ${ctx.imagesQuota.toLocaleString()}</strong> images this month on your ${escape(ctx.planName)} plan.`)}
            ${p(`Heads up so you don't hit the cap mid-traffic. The quota resets on the 1st — or upgrade now and the unused part rolls over.`)}
            ${btn(dashUrl, "See usage & upgrade →")}
        `,
    });
    return {
        to: ctx.email, toName: ctx.firstName,
        subject: `${ctx.usedPct}% of your Tempaloo quota used — heads up`,
        html,
        text: `${greet(ctx)}

You're at ${ctx.usedPct}% of your monthly quota: ${ctx.imagesUsed.toLocaleString()} / ${ctx.imagesQuota.toLocaleString()} images.

Resets on the 1st — or upgrade now and unused images roll over.

Dashboard: ${dashUrl}

— Julia, Tempaloo`,
        tag: "quota-warn",
    };
}

export function quotaExceededEmail(ctx: QuotaCtx): SendOpts {
    const dashUrl = `${config.WEB_BASE_URL}/webp/dashboard`;
    const html = shell({
        title: `Monthly quota reached`,
        preheader: `New uploads aren't being optimized — upgrade or wait for reset.`,
        bodyHtml: `
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;letter-spacing:-0.02em;color:${BRAND.ink};">You've hit your monthly quota.</h1>
            ${p(`${greet(ctx)}`)}
            ${p(`You've used <strong>${ctx.imagesUsed.toLocaleString()} / ${ctx.imagesQuota.toLocaleString()}</strong> images on your ${escape(ctx.planName)} plan. New uploads will be skipped (originals still serve normally) until the quota resets on the 1st.`)}
            ${p(`Need to keep optimizing? Upgrade in one click — your remaining quota carries over.`)}
            ${btn(dashUrl, "Upgrade now →")}
        `,
    });
    return {
        to: ctx.email, toName: ctx.firstName,
        subject: `Tempaloo: monthly quota reached`,
        html,
        text: `${greet(ctx)}

You've hit your ${ctx.planName} monthly quota: ${ctx.imagesUsed.toLocaleString()} / ${ctx.imagesQuota.toLocaleString()} images.

New uploads won't be optimized until the 1st (originals still serve).

Upgrade and unused images roll over: ${dashUrl}

— Julia, Tempaloo`,
        tag: "quota-exceeded",
    };
}

// ─── Admin internal alerts ──────────────────────────────────────────

export function adminCriticalAlertEmail(ctx: { to: string; action: string; actorEmail: string; ip: string; metadata: Record<string, unknown> }): SendOpts {
    const meta = JSON.stringify(ctx.metadata, null, 2);
    const auditUrl = `${config.WEB_BASE_URL}/admin/audit?severity=critical`;
    const html = shell({
        title: `ADMIN ALERT: ${ctx.action}`,
        preheader: `Critical admin event by ${ctx.actorEmail} from ${ctx.ip}`,
        bodyHtml: `
            <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;letter-spacing:-0.02em;color:${BRAND.danger};">⚠ Critical admin event</h1>
            ${p(`A <strong>severity=critical</strong> event was just recorded in the admin audit log:`)}
            <table style="width:100%;border-collapse:collapse;margin:8px 0 16px;font-size:13px;">
                <tr><td style="padding:6px 0;color:${BRAND.ink3};width:120px;">Action</td><td style="padding:6px 0;font-family:ui-monospace,monospace;color:${BRAND.ink};">${escape(ctx.action)}</td></tr>
                <tr><td style="padding:6px 0;color:${BRAND.ink3};">Actor</td><td style="padding:6px 0;color:${BRAND.ink};">${escape(ctx.actorEmail)}</td></tr>
                <tr><td style="padding:6px 0;color:${BRAND.ink3};">IP</td><td style="padding:6px 0;font-family:ui-monospace,monospace;color:${BRAND.ink};">${escape(ctx.ip)}</td></tr>
            </table>
            ${code(meta)}
            ${btn(auditUrl, "Open audit log →")}
            ${p(`If this wasn't you, run <code style="background:${BRAND.bg2};padding:2px 6px;border-radius:4px;">npm run admin:revoke-sessions</code> immediately to invalidate every active admin session.`)}
        `,
    });
    return {
        to: ctx.to,
        subject: `⚠ Tempaloo admin alert — ${ctx.action}`,
        html,
        text: `Critical admin event:

  Action:  ${ctx.action}
  Actor:   ${ctx.actorEmail}
  IP:      ${ctx.ip}

Metadata:
${meta}

Audit log: ${auditUrl}

If this wasn't you: cd api && npm run admin:revoke-sessions`,
        tag: "admin-alert",
    };
}

export function subscriptionCancelledEmail(ctx: LicenseCtx): SendOpts {
    const html = shell({
        title: `Your subscription has been cancelled`,
        preheader: `Sorry to see you go — here's what happens next.`,
        bodyHtml: `
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;letter-spacing:-0.02em;color:${BRAND.ink};">Your subscription has been cancelled.</h1>
            ${p(`${greet(ctx)}`)}
            ${p(`Your ${escape(ctx.planName)} subscription is cancelled. You'll keep paid features until the end of the current billing period — after that, your license drops to Free.`)}
            ${p(`If this was a mistake, you can resubscribe in one click from your dashboard.`)}
            ${btn(`${config.WEB_BASE_URL}/webp/dashboard`, "Open dashboard →")}
            ${p(`Mind sharing why? <a href="mailto:${config.EMAIL_REPLY_TO ?? config.EMAIL_FROM}" style="color:${BRAND.ink2};">A two-line reply</a> helps us improve.`)}
        `,
    });
    return {
        to: ctx.email, toName: ctx.firstName,
        subject: `Your Tempaloo subscription has been cancelled`,
        html,
        text: `${greet(ctx)}

Your ${ctx.planName} subscription is cancelled. You'll keep paid features until the end of the current period, then drop to Free.

Resubscribe any time: ${config.WEB_BASE_URL}/webp/dashboard

Mind sharing why? Just reply to this email — it really helps.

— Julia, Tempaloo`,
        tag: "subscription-cancelled",
    };
}
