// Bootstrapped state + REST helpers. The PHP side emits `window.TempalooBoot`
// before our script runs, so we can render with SSR-ish data immediately.

export interface BootState {
    rest: { root: string; nonce: string };
    ajax: { url: string; nonce: string };
    activateUrl: string;
    siteUrl: string;
    state: AppState;
}

export interface AppState {
    license: {
        valid: boolean;
        key: string;
        plan: string;
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
    settings: {
        quality: number;
        outputFormat: "webp" | "avif";
        autoConvert: boolean;
        serveWebp: boolean;
    };
    savings: null | {
        bytesIn: number;
        bytesOut: number;
        converted: number;
    };
}

export interface BulkStatus {
    status: "idle" | "running" | "paused_quota" | "done" | "canceled";
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
        siteUrl: "",
        state: {
            license: { valid: false, key: "", plan: "", supportsAvif: false, imagesLimit: 0, sitesLimit: 0 },
            quota: null,
            settings: { quality: 82, outputFormat: "webp", autoConvert: true, serveWebp: true },
            savings: null,
        },
    };

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
    saveSettings: (patch: Partial<AppState["settings"]>) =>
        restFetch<AppState>("/settings", { method: "POST", body: JSON.stringify(patch) }),
};

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
};

export function formatBytes(n: number): string {
    if (!Number.isFinite(n) || n <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
