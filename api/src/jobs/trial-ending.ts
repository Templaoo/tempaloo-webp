// Daily cron: notify trialing users 3 days before their trial ends.
// Run via Render Cron / Fly scheduled machine / GitHub Actions:
//   node dist/jobs/trial-ending.js
//
// Idempotent: notifications_sent UNIQUE (license_id, kind, period) means
// re-running the job in the same day is a no-op. Period bucket = the
// trial-end date itself, so a user only ever gets ONE trial-ending
// email per trial (even if their period_end shifts ±1 day).
//
// Window: licenses where current_period_end is between 60h and 84h
// from now (≈2.5 to 3.5 days). Tighter than "3 days exactly" so we
// don't miss anyone if the cron runs slightly off-schedule.

import { closePool, query } from "../db.js";
import { sendTransactional } from "../lib/email.js";
import { trialEndingEmail } from "../lib/email-templates.js";
import { claimNotification, markNotificationMessageId } from "../lib/notifications.js";

interface TrialingRow {
    license_id: string;
    license_key: string;
    email: string;
    first_name: string | null;
    plan_name: string;
    current_period_end: Date;
}

async function findTrialing(): Promise<TrialingRow[]> {
    const { rows } = await query<TrialingRow>(
        `SELECT l.id  AS license_id,
                l.license_key,
                u.email,
                NULL  AS first_name,                     -- we don't store first_name yet
                p.name AS plan_name,
                l.current_period_end
           FROM licenses l
           JOIN users u ON u.id = l.user_id
           JOIN plans p ON p.id = l.plan_id
          WHERE l.status = 'trialing'
            AND l.current_period_end IS NOT NULL
            AND l.current_period_end >  NOW() + INTERVAL '60 hours'
            AND l.current_period_end <= NOW() + INTERVAL '84 hours'`,
    );
    return rows;
}

async function main() {
    const startedAt = Date.now();
    const candidates = await findTrialing();
    console.log(`[trial-ending] candidates=${candidates.length}`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const r of candidates) {
        const periodBucket = r.current_period_end.toISOString().slice(0, 10);
        const won = await claimNotification(r.license_id, "trial-ending", periodBucket, {
            trialEndsAt: r.current_period_end.toISOString(),
        });
        if (!won) { skipped++; continue; }

        const daysLeft = Math.max(1, Math.ceil((r.current_period_end.getTime() - Date.now()) / 86_400_000));
        const result = await sendTransactional(trialEndingEmail({
            email: r.email,
            firstName: r.first_name ?? undefined,
            licenseKey: r.license_key,
            planName: r.plan_name,
            daysLeft,
            trialEndsOn: periodBucket,
        }));

        if (result.ok) {
            sent++;
            if (result.messageId) {
                await markNotificationMessageId(r.license_id, "trial-ending", periodBucket, result.messageId);
            }
        } else {
            failed++;
            console.error(`[trial-ending] send failed license=${r.license_id} reason=${result.reason}`);
        }
    }

    const tookMs = Date.now() - startedAt;
    console.log(`[trial-ending] done sent=${sent} skipped=${skipped} failed=${failed} took=${tookMs}ms`);
}

main()
    .catch((e) => {
        console.error("[trial-ending] fatal", e);
        process.exitCode = 1;
    })
    .finally(() => closePool());
