import { query } from "../db.js";

/**
 * Race-safe "claim" of a notification slot.
 *
 * Returns true ONLY if this caller won the INSERT — meaning it's
 * responsible for actually sending the email. False means another
 * worker already claimed it (or already sent it in a previous run).
 *
 * Use:
 *   if (await claimNotification(licenseId, "quota-warn", period)) {
 *       await sendTransactional(quotaWarnEmail({ ... }));
 *       await markNotificationMessageId(...); // optional
 *   }
 *
 * Safety: the UNIQUE (license_id, kind, period) constraint is the
 * source of truth. ON CONFLICT DO NOTHING + RETURNING gives us 0 rows
 * when the slot was already taken, regardless of how many workers
 * compete for it concurrently.
 */
export async function claimNotification(licenseId: string, kind: string, period: Date | string, metadata?: Record<string, unknown>): Promise<boolean> {
    const periodStr = typeof period === "string" ? period : period.toISOString().slice(0, 10);
    const { rowCount } = await query(
        `INSERT INTO notifications_sent (license_id, kind, period, metadata)
         VALUES ($1, $2, $3::date, $4::jsonb)
         ON CONFLICT (license_id, kind, period) DO NOTHING`,
        [licenseId, kind, periodStr, JSON.stringify(metadata ?? {})],
    );
    return (rowCount ?? 0) > 0;
}

/** Stamp a Brevo message id onto a previously-claimed notification row. */
export async function markNotificationMessageId(licenseId: string, kind: string, period: Date | string, messageId: string): Promise<void> {
    const periodStr = typeof period === "string" ? period : period.toISOString().slice(0, 10);
    await query(
        `UPDATE notifications_sent
            SET message_id = $4
          WHERE license_id = $1 AND kind = $2 AND period = $3::date`,
        [licenseId, kind, periodStr, messageId],
    ).catch(() => { /* logging only — losing the id doesn't break anything */ });
}

/**
 * Returns the first day of the current month (UTC) — the canonical
 * period bucket for monthly notifications.
 */
export function currentMonthBucket(): string {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}
