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
        imagesLimit: number;        // base plan cap
        imagesEffective: number;    // base + rollover (what the user can actually consume)
        imagesRollover: number;     // carried over from last month
        imagesRemaining: number;
        sitesUsed: number;
        sitesLimit: number;
        periodStart: string;
        periodEnd: string;
        /** Free-plan daily bulk cap from the server (0 = no daily cap). */
        dailyBulkLimit: number;
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
        // 'both' generates AVIF + WebP siblings in one API batch (1 credit).
        // Best browser coverage; same approach as ShortPixel's "Create WebP
        // versions" + "Create AVIF versions" combo. AVIF requires a paid plan.
        outputFormat: "webp" | "avif" | "both";
        autoConvert: boolean;
        serveWebp: boolean;
        // How the optimized version reaches the browser:
        //   url_rewrite — replace .jpg URLs with .jpg.webp at PHP filter
        //                 level. Lighter HTML, depends on host MIME config.
        //   picture_tag — wrap <img> in <picture> with <source> entries.
        //                 CDN-friendly, theme-tolerant. Default for new installs.
        deliveryMode: "url_rewrite" | "picture_tag";
        // When true, the plugin stops rewriting URLs and stops wrapping
        // <img> in <picture>. The CDN (Cloudflare Polish, BunnyCDN
        // Optimizer, ImageKit, Cloudinary…) serves WebP/AVIF transparently
        // from the same .jpg URL via Accept + Vary. Conversion still runs
        // server-side so siblings exist if the user disables passthrough later.
        cdnPassthrough: boolean;
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
            settings: { quality: 82, outputFormat: "webp", autoConvert: true, serveWebp: true, deliveryMode: "picture_tag", cdnPassthrough: false, resizeMaxWidth: 2560, cptQuality: {} },
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

/**
 * Structured error so the UI can branch on the error CODE (e.g.
 * "site_limit_reached") and render the right inline guidance instead
 * of swallowing it into a generic toast.
 */
export class ApiError extends Error {
    constructor(public readonly code: string, message: string, public readonly status: number) {
        super(message);
    }
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
        // WP REST returns { code, message }; our upstream API errors come
        // through as WP_Error with the same shape.
        const code = (data && (data.code || data.error?.code)) || `http_${res.status}`;
        const msg = (data && (data.message || data.error?.message)) || `HTTP ${res.status}`;
        throw new ApiError(String(code), String(msg), res.status);
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
        restFetch<{ state: AppState; restored: number; filesRemoved: number; deleteFailures?: number; failureSamples?: string[] }>(
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

export interface BulkScanReport {
    /** Total scannable attachments (jpeg/png/gif). */
    total: number;
    /** Already have every expected sibling on disk for the current format. */
    fullyConverted: number;
    /** Need at least one missing sibling — these are what bulk will process. */
    pending: number;
    /** Subset of pending whose .webp sibling is missing on at least one size. */
    missingWebp: number;
    /** Subset of pending whose .avif sibling is missing on at least one size. */
    missingAvif: number;
    /**
     * Attachments with siblings on disk but no `tempaloo_webp` meta block —
     * almost always the trace of a Restore that hit a permission/lock and
     * didn't fully clean up. Surfaces drift instead of letting the scan
     * silently treat these as "fully converted".
     */
    orphanedSiblings: number;
    /** Attachments whose original file is missing on disk (broken WP record). */
    brokenPaths: number;
    /**
     * Attachments where the API declined to encode AVIF because the input
     * was too big for the current dyno memory budget. WebP coverage is
     * unaffected; these images simply don't get an AVIF source emitted.
     * Subsequent scans no longer flag them (the meta records the skip).
     */
    avifSkippedTier: number;
    /** Resolved target format after the supports_avif downgrade step. */
    targetFormat: "webp" | "avif" | "both";
    /** Extensions the scan considers "complete" — informative for the UI. */
    expectedExts: string[];
}

export const bulk = {
    scan: () => ajax<BulkScanReport>("bulk_scan"),
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
