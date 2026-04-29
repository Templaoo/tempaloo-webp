// Bootstrapped state + REST helpers. The PHP side emits `window.TempalooBoot`
// before our script runs, so we can render with SSR-ish data immediately.

export interface BootState {
    rest: { root: string; nonce: string };
    ajax: { url: string; nonce: string };
    activateUrl: string;
    apiBase: string;     // e.g. https://api.tempaloo.com/v1 — used by fetchPlans()
    siteUrl: string;
    state: AppState;
}

export type LicenseStatus = "active" | "trialing" | "past_due" | "canceled" | "expired" | "unknown";

export interface AppState {
    license: {
        valid: boolean;
        key: string;
        plan: string;
        status: LicenseStatus;
        /** Email of the Tempaloo account that owns this license. Empty
         *  on Free/unverified installs; filled after /license/verify. */
        email: string;
        supportsAvif: boolean;
        imagesLimit: number;
        sitesLimit: number;
    };
    quota: null | {
        imagesUsed: number;
        imagesLimit: number;
        imagesRemaining: number;
        sitesUsed: number;
        sitesLimit: number;
        periodStart: string;
        periodEnd: string;
    };
    quotaExceededAt: number | null;
    apiHealth: {
        ok: boolean;
        failedAt: number;
        code: string;
        message: string;
        attempts: number;
    };
    retryQueue: {
        pending: number;
        dueNow: number;
        nextRetryAt: number;
    };
    settings: {
        quality: number;
        outputFormat: "webp" | "avif";
        autoConvert: boolean;
        serveWebp: boolean;
        // 0 = off; otherwise the max width in px above which uploads are
        // resized before conversion (hooks into core's big_image_size_threshold).
        resizeMaxWidth: number;
        // Map of post-type slug -> quality 1..100. Empty object = no overrides.
        cptQuality: Record<string, number>;
    };
    savings: null | {
        bytesIn: number;
        bytesOut: number;
        converted: number;
    };
}

export interface BulkStatus {
    status: "idle" | "running" | "paused_quota" | "paused_daily_limit" | "done" | "canceled";
    total: number;
    processed: number;
    succeeded: number;
    failed: number;
    errors: { id: number; code: string; message: string }[];
}

declare global {
    interface Window {
        TempalooBoot?: BootState;
    }
}

export const boot: BootState =
    window.TempalooBoot ?? {
        rest: { root: "/wp-json/", nonce: "" },
        ajax: { url: "/wp-admin/admin-ajax.php", nonce: "" },
        activateUrl: "",
        apiBase: "https://api.tempaloo.com/v1",
        siteUrl: "",
        state: {
            license: { valid: false, key: "", plan: "", status: "unknown", email: "", supportsAvif: false, imagesLimit: 0, sitesLimit: 0 },
            quota: null,
            quotaExceededAt: null,
            apiHealth: { ok: true, failedAt: 0, code: "", message: "", attempts: 0 },
            retryQueue: { pending: 0, dueNow: 0, nextRetryAt: 0 },
            settings: { quality: 82, outputFormat: "webp", autoConvert: true, serveWebp: true, resizeMaxWidth: 2560, cptQuality: {} },
            savings: null,
        },
    };

// Freemius product identity (these two IDs never change per product — kept
// as constants). Plan-level IDs come from the /v1/plans endpoint now.
export const FREEMIUS = {
    productId: 28337,
    publicKey: "pk_259a7f9b6c36048a8ee79c2f9dd0b",
} as const;

// Shape returned by GET /v1/plans — one entry per code, ordered by sort_order.
export interface Plan {
    code: "free" | "starter" | "growth" | "business" | "unlimited";
    name: string;
    tagline: string;
    imagesPerMonth: number;   // -1 = unlimited
    maxSites: number;         // -1 = unlimited
    supportsAvif: boolean;
    supportsCdn: boolean;
    supportsApiDirect: boolean;
    priceMonthlyCents: number;
    priceAnnualCents: number;
    fairUseCap: number | null;
    freemiusPlanId: number | null; // null for free
    bullets: string[];
    badge: string | null;
    ctaLabel: string;
    isFeatured: boolean;
}

export type PaidPlanCode = Exclude<Plan["code"], "free">;

export async function fetchPlans(): Promise<Plan[]> {
    const base = boot.apiBase.replace(/\/+$/, "");
    const res = await fetch(`${base}/plans`, { credentials: "omit" });
    if (!res.ok) throw new Error(`Plans feed ${res.status}`);
    const data = (await res.json()) as { plans: Plan[] };
    return data.plans;
}

async function restFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(boot.rest.root + "tempaloo-webp/v1" + path, {
        credentials: "same-origin",
        ...init,
        headers: {
            "Content-Type": "application/json",
            "X-WP-Nonce": boot.rest.nonce,
            ...(init?.headers ?? {}),
        },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const err = (data && (data.message || data.error?.message)) || `HTTP ${res.status}`;
        throw new Error(err);
    }
    return data as T;
}

export const api = {
    refreshState: () => restFetch<AppState>("/state"),
    activate: (licenseKey: string) =>
        restFetch<AppState>("/activate", { method: "POST", body: JSON.stringify({ license_key: licenseKey }) }),
    refreshLicense: () =>
        restFetch<AppState>("/refresh-license", { method: "POST", body: "{}" }),
    disconnectLicense: () =>
        restFetch<AppState>("/disconnect-license", { method: "POST", body: "{}" }),
    saveSettings: (patch: Partial<AppState["settings"]>) =>
        restFetch<AppState>("/settings", { method: "POST", body: JSON.stringify(patch) }),
    runRetry: () =>
        restFetch<{ ran: number; succeeded: number; failed: number; state: AppState }>(
            "/retry/run", { method: "POST", body: "{}" }
        ),
    restore: (ids?: number[]) =>
        restFetch<{ state: AppState; restored: number; filesRemoved: number }>(
            "/restore", { method: "POST", body: JSON.stringify({ ids: ids ?? [] }) }
        ),
    activity: () =>
        restFetch<{ events: ActivityEvent[] }>("/activity?limit=200"),
    clearActivity: () =>
        restFetch<{ ok: boolean }>("/activity", { method: "DELETE" }),
    cpts: () =>
        restFetch<{ cpts: { slug: string; label: string }[] }>("/cpts"),
};

export interface ActivityEvent {
    id: number;
    at: number;
    type: "convert" | "convert_failed" | "bulk" | "license" | "restore" | "retry" | "upload";
    level: "success" | "info" | "warn" | "error";
    message: string;
    meta: Record<string, unknown>;
}

// Bulk operations still use admin-ajax (existing backend, keeps parity).
export async function ajax<T>(action: string, extra: Record<string, string> = {}): Promise<T> {
    const body = new URLSearchParams();
    body.append("action", `tempaloo_webp_${action}`);
    body.append("nonce", boot.ajax.nonce);
    for (const [k, v] of Object.entries(extra)) body.append(k, v);
    const res = await fetch(boot.ajax.url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
    });
    const data = await res.json();
    if (!data?.success) throw new Error(data?.data?.message ?? "Request failed");
    return data.data as T;
}

export const bulk = {
    scan: () => ajax<{ pending: number }>("bulk_scan"),
    start: () => ajax<BulkStatus>("bulk_start"),
    tick: () => ajax<BulkStatus>("bulk_tick"),
    cancel: () => ajax<BulkStatus>("bulk_cancel"),
    status: () => ajax<BulkStatus>("bulk_status"),
    resume: () => ajax<BulkStatus>("bulk_resume"),
};

export function formatBytes(n: number): string {
    if (!Number.isFinite(n) || n <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
