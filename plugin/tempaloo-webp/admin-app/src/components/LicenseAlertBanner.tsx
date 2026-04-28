import type { LicenseStatus } from "../api";

/**
 * Persistent banner inside the plugin admin when the license is in a
 * bad state (canceled / expired / past_due). Always visible — can't be
 * dismissed from inside the React app, only from the global WP notice
 * (which has the snooze).
 *
 * The strict no-dismiss rule here is deliberate: the React banner is
 * the in-context "your plugin won't work" reminder. A user who clicks
 * around the plugin should always see it. The wp-admin notice covers
 * the global "elsewhere on the site" surface, with a snooze.
 */

const HEADLINE: Record<string, string> = {
    expired:  "Your license has expired.",
    canceled: "Your subscription was cancelled.",
    past_due: "Your payment is past due.",
};

const SUB: Record<string, string> = {
    expired:  "Tempaloo WebP no longer optimizes new uploads. Reactivate to keep AVIF and your full plan.",
    canceled: "You'll keep paid features until the end of the current period — then drop to Free.",
    past_due: "We couldn't charge your card. Update payment to avoid service interruption.",
};

export function LicenseAlertBanner({ status }: { status: LicenseStatus }) {
    if (status !== "expired" && status !== "canceled" && status !== "past_due") return null;

    return (
        <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900"
            style={{
                borderColor: "color-mix(in oklab, #E5484D 30%, transparent)",
                background: "color-mix(in oklab, #E5484D 8%, transparent)",
                color: "#991B1B",
            }}
        >
            <div className="flex items-start gap-3">
                <span style={{ fontSize: 18, lineHeight: 1, color: "#E5484D" }}>⚠</span>
                <div className="flex-1 min-w-0">
                    <p className="m-0 font-semibold" style={{ color: "#0A0A0A" }}>{HEADLINE[status]}</p>
                    <p className="mt-1 mb-3 text-sm" style={{ color: "#3A3A3A" }}>{SUB[status]}</p>
                    <div className="flex flex-wrap gap-2">
                        <a
                            href="https://users.freemius.com/"
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium"
                            style={{ background: "#0A0A0A", color: "#fff" }}
                        >
                            {status === "past_due" ? "Update payment ↗" : "Reactivate ↗"}
                        </a>
                        <a
                            href="https://tempaloo.com/webp/dashboard"
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm"
                            style={{ borderColor: "rgba(0,0,0,0.12)", color: "#0A0A0A", background: "#fff" }}
                        >
                            View dashboard
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
