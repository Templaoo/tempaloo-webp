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

    const { rows } = await query<{
        license_id: string;
        user_id: string;
        plan_code: string;
        images_per_month: number;
        max_sites: number;
        supports_avif: boolean;
        status: string;
    }>(
        `SELECT l.id AS license_id, l.user_id, p.code AS plan_code,
                p.images_per_month, p.max_sites, p.supports_avif,
                l.status::text AS status
         FROM licenses l
         JOIN plans p ON p.id = l.plan_id
         WHERE l.license_key = $1
         LIMIT 1`,
        [licenseKey],
    );

    const row = rows[0];
    if (!row) throw err.unauthorized();
    if (row.status !== "active" && row.status !== "trialing") {
        throw err.unauthorized(`License ${row.status}`);
    }

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
