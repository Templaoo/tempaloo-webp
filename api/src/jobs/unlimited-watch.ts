// Daily watcher: flag Unlimited licenses approaching/exceeding the soft fair-use cap.
// Run via a scheduler (Render Cron, Fly scheduled machine, GitHub Actions). Example:
//   node dist/jobs/unlimited-watch.js
//
// What it does:
//  - Queries every active Unlimited license whose usage in the current period
//    is >= UNLIMITED_FAIR_USE (default 500k).
//  - Posts a JSON payload to UNLIMITED_NOTIFY_WEBHOOK if set (Slack-compatible).
//  - Always logs a structured summary so cron logs alone are enough to triage.
//
// Not user-facing: the cap is a "soft" threshold per the validated product rules
// (2026-04-24). No throttling, no email to the user — that's a manual conversation.

import { config } from "../config.js";
import { closePool, query } from "../db.js";
import { currentPeriod } from "../auth.js";

interface FlaggedLicense {
    license_id: string;
    license_key: string;
    email: string;
    images_used: number;
    started_at: Date;
}

async function findFlagged(periodStart: string, threshold: number): Promise<FlaggedLicense[]> {
    const { rows } = await query<FlaggedLicense>(
        `SELECT l.id  AS license_id,
                l.license_key,
                u.email,
                uc.images_used,
                l.created_at AS started_at
           FROM licenses l
           JOIN plans p ON p.id = l.plan_id
           JOIN users u ON u.id = l.user_id
           JOIN usage_counters uc
             ON uc.license_id = l.id AND uc.period = $1
          WHERE p.code = 'unlimited'
            AND l.status IN ('active', 'trialing')
            AND uc.images_used >= $2
          ORDER BY uc.images_used DESC`,
        [periodStart, threshold],
    );
    return rows;
}

async function notify(payload: object): Promise<void> {
    const url = config.UNLIMITED_NOTIFY_WEBHOOK;
    if (!url) return;
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            console.error(`[unlimited-watch] notify webhook returned ${res.status}`);
        }
    } catch (e) {
        console.error("[unlimited-watch] notify webhook failed:", e);
    }
}

async function main(): Promise<void> {
    const period = currentPeriod();
    const threshold = config.UNLIMITED_FAIR_USE;
    const flagged = await findFlagged(period, threshold);

    const summary = {
        job: "unlimited-watch",
        period,
        threshold,
        flagged_count: flagged.length,
        ranAt: new Date().toISOString(),
    };
    console.log(JSON.stringify(summary));

    if (flagged.length === 0) return;

    for (const f of flagged) {
        const overage = f.images_used - threshold;
        const line = {
            license_id: f.license_id,
            email: f.email,
            images_used: f.images_used,
            overage,
            started_at: f.started_at,
        };
        console.log(JSON.stringify({ event: "flagged_license", ...line }));
    }

    await notify({
        text: `${flagged.length} Unlimited licence(s) at/above the ${threshold.toLocaleString()} fair-use cap for ${period}.`,
        period,
        threshold,
        licenses: flagged.map((f) => ({
            license_id: f.license_id,
            email: f.email,
            images_used: f.images_used,
        })),
    });
}

main()
    .catch((e) => {
        console.error("[unlimited-watch] fatal:", e);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closePool();
    });
