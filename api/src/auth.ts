import type { FastifyRequest } from "fastify";
import { randomBytes } from "node:crypto";
import { query } from "./db.js";
import { err } from "./errors.js";

export interface LicenseContext {
    licenseId: string;
    userId: string;
    planCode: string;
    imagesPerMonth: number;
    maxSites: number;
    supportsAvif: boolean;
    status: string;
}

export function generateLicenseKey(): string {
    return randomBytes(32).toString("hex");
}

export async function resolveLicense(licenseKey: string | undefined): Promise<LicenseContext> {
    if (!licenseKey || licenseKey.length < 32) throw err.unauthorized();

    // Resilience to plan-change history.
    //
    // A user's plugin can be stranded on an OLD license_key whose row is
    // now `expired` because Freemius issued a fresh license_id when they
    // upgraded plan. The plan-continuity fix in the webhook handler
    // covers all upgrades AFTER that change ships, but plenty of users
    // are already in the stuck state.
    //
    // The lookup is therefore two-step:
    //   1. Find which USER the license_key belongs to (any status).
    //   2. From that user, return the current ACTIVE/TRIALING license.
    //
    // The plugin's stored key keeps working transparently — same user,
    // same identity, just a different row carrying the current plan.
    // Security is preserved: the key must still belong to a real user,
    // AND that user must have an active license. Leaked or revoked keys
    // for users with no active license are still rejected.
    const { rows } = await query<{
        license_id: string;
        user_id: string;
        plan_code: string;
        images_per_month: number;
        max_sites: number;
        supports_avif: boolean;
        status: string;
        blocked_at: Date | null;
    }>(
        `WITH key_user AS (
             SELECT user_id FROM licenses WHERE license_key = $1 LIMIT 1
         )
         SELECT l.id AS license_id, l.user_id, p.code AS plan_code,
                p.images_per_month, p.max_sites, p.supports_avif,
                l.status::text AS status,
                l.blocked_at
           FROM licenses l
           JOIN plans p ON p.id = l.plan_id
           JOIN key_user ku ON ku.user_id = l.user_id
          WHERE l.status IN ('active','trialing')
          ORDER BY l.updated_at DESC
          LIMIT 1`,
        [licenseKey],
    );

    const row = rows[0];
    if (!row) {
        // Either the key matches no user at all, or the user has no live
        // license. Surface the most useful error: distinguish unknown
        // key vs. user-with-only-expired-licenses so support can triage.
        const { rows: keyRows } = await query<{ status: string; blocked_at: Date | null }>(
            `SELECT status::text AS status, blocked_at FROM licenses WHERE license_key = $1 LIMIT 1`,
            [licenseKey],
        );
        if (keyRows.length === 0) throw err.unauthorized();
        if (keyRows[0]!.blocked_at) throw err.unauthorized("License blocked");
        throw err.unauthorized(`License ${keyRows[0]!.status}`);
    }
    // Admin block override beats Freemius status — reconcile won't
    // accidentally un-block, and we can shut down abuse without waiting
    // for the upstream cancel.
    if (row.blocked_at) throw err.unauthorized("License blocked");

    return {
        licenseId: row.license_id,
        userId: row.user_id,
        planCode: row.plan_code,
        imagesPerMonth: row.images_per_month,
        maxSites: row.max_sites,
        supportsAvif: row.supports_avif,
        status: row.status,
    };
}

export async function authMiddleware(req: FastifyRequest): Promise<LicenseContext> {
    const key = req.headers["x-license-key"];
    const licenseKey = Array.isArray(key) ? key[0] : key;
    return resolveLicense(licenseKey);
}

export function currentPeriod(date = new Date()): string {
    // First day of current month (UTC), YYYY-MM-01
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
}
