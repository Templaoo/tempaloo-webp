import "./setup.js";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

type QueryRow = Record<string, unknown>;
interface QueryCall { text: string; params?: readonly unknown[] }
const queryMock = vi.fn<(text: string, params?: readonly unknown[]) => Promise<{ rows: QueryRow[]; rowCount: number }>>();
const txMock = vi.fn();

vi.mock("../src/db.js", () => ({
    pool: { on: () => {}, end: async () => {} },
    query: (text: string, params?: readonly unknown[]) => queryMock(text, params),
    withTx: async <T>(fn: (client: unknown) => Promise<T>): Promise<T> => txMock(fn),
}));

const { buildApp } = await import("../src/app.js");
const app = await buildApp({ logger: false });
afterAll(async () => { await app.close(); });

beforeEach(() => {
    queryMock.mockReset();
    txMock.mockReset();
});

async function pngBuffer(): Promise<Buffer> {
    return await sharp({
        create: { width: 60, height: 40, channels: 3, background: { r: 200, g: 80, b: 30 } },
    }).png().toBuffer();
}

const FREE_LICENSE = {
    license_id: "11111111-1111-1111-1111-111111111111",
    user_id:    "22222222-2222-2222-2222-222222222222",
    plan_code:  "free",
    images_per_month: 150,
    max_sites: 1,
    supports_avif: false,
    status: "active",
};

function setupLicenseLookup(license = FREE_LICENSE) {
    queryMock.mockImplementation(async (text, params) => {
        const t = String(text);
        if (t.includes("FROM licenses l") && t.includes("JOIN plans p")) {
            return { rows: [license], rowCount: 1 };
        }
        if (t.includes("consume_quota")) {
            return { rows: [{ consume_quota: true }], rowCount: 1 };
        }
        if (t.includes("INSERT INTO usage_logs")) {
            return { rows: [], rowCount: 1 };
        }
        if (t.includes("FROM usage_counters uc") && t.includes("JOIN licenses l")) {
            return { rows: [{ used: 1, limit: license.images_per_month }], rowCount: 1 };
        }
        if (t.includes("COALESCE(uc.images_used, 0)")) {
            return {
                rows: [{ images_used: 0, sites_used: 0, period_start: new Date(), period_end: new Date() }],
                rowCount: 1,
            };
        }
        throw new Error(`Unexpected query in test: ${t.slice(0, 80)}…  params=${JSON.stringify(params)}`);
    });
}

describe("health", () => {
    it("returns ok", async () => {
        const res = await app.inject({ method: "GET", url: "/health" });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ ok: true });
    });
});

describe("auth", () => {
    it("rejects missing X-License-Key", async () => {
        const res = await app.inject({ method: "GET", url: "/v1/quota" });
        expect(res.statusCode).toBe(401);
        expect(res.json().error.code).toBe("unauthorized");
    });

    it("rejects unknown license", async () => {
        queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await app.inject({
            method: "GET",
            url: "/v1/quota",
            headers: { "x-license-key": "f".repeat(64) },
        });
        expect(res.statusCode).toBe(401);
    });
});

describe("convert", () => {
    const key = "a".repeat(64);

    it("400s on empty JSON body", async () => {
        setupLicenseLookup();
        const res = await app.inject({
            method: "POST",
            url: "/v1/convert",
            headers: { "x-license-key": key, "x-site-url": "https://test.local" },
            payload: {},
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error.code).toBe("validation_failed");
    });

    it("rejects AVIF on Free plan", async () => {
        setupLicenseLookup();
        const res = await app.inject({
            method: "POST",
            url: "/v1/convert",
            headers: { "x-license-key": key, "x-site-url": "https://test.local" },
            payload: { image_url: "https://example.com/x.png", format: "avif" },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json().error.code).toBe("forbidden");
    });

    it("returns 402 when quota exceeded", async () => {
        // Simulate quota full: consume_quota returns false.
        queryMock.mockImplementation(async (text) => {
            const t = String(text);
            if (t.includes("FROM licenses l") && t.includes("JOIN plans p")) {
                return { rows: [FREE_LICENSE], rowCount: 1 };
            }
            if (t.includes("consume_quota")) {
                return { rows: [{ consume_quota: false }], rowCount: 1 };
            }
            throw new Error("unexpected");
        });
        const png = await pngBuffer();
        const boundary = "----t";
        const body = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="x.png"\r\nContent-Type: image/png\r\n\r\n`),
            png,
            Buffer.from(`\r\n--${boundary}--\r\n`),
        ]);
        const res = await app.inject({
            method: "POST",
            url: "/v1/convert",
            headers: {
                "x-license-key": key,
                "x-site-url": "https://test.local",
                "content-type": `multipart/form-data; boundary=${boundary}`,
            },
            payload: body,
        });
        expect(res.statusCode).toBe(402);
        expect(res.json().error.code).toBe("quota_exceeded");
    });

    it("converts multipart PNG -> WebP successfully", async () => {
        setupLicenseLookup();
        const png = await pngBuffer();
        const boundary = "----t";
        const body = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="x.png"\r\nContent-Type: image/png\r\n\r\n`),
            png,
            Buffer.from(`\r\n--${boundary}--\r\n`),
        ]);
        const res = await app.inject({
            method: "POST",
            url: "/v1/convert",
            headers: {
                "x-license-key": key,
                "x-site-url": "https://test.local",
                "content-type": `multipart/form-data; boundary=${boundary}`,
            },
            payload: body,
        });
        expect(res.statusCode).toBe(200);
        expect(res.headers["content-type"]).toBe("image/webp");
        expect(Number(res.headers["x-quota-used"])).toBeGreaterThanOrEqual(0);
        const out = Buffer.from(res.rawPayload);
        // WebP files start with "RIFF....WEBP"
        expect(out.slice(0, 4).toString()).toBe("RIFF");
        expect(out.slice(8, 12).toString()).toBe("WEBP");
    });
});

describe("quota", () => {
    it("returns usage info", async () => {
        setupLicenseLookup();
        const res = await app.inject({
            method: "GET",
            url: "/v1/quota",
            headers: { "x-license-key": "a".repeat(64) },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.plan).toBe("free");
        expect(body.images_limit).toBe(150);
    });
});
