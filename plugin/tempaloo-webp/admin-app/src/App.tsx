import { useState } from "react";
import { boot, type AppState } from "./api";
import { Badge, Tabs, Toasts } from "./components/ui";
import Overview from "./pages/Overview";
import Bulk from "./pages/Bulk";
import Settings from "./pages/Settings";
import Upgrade from "./pages/Upgrade";

type Tab = "overview" | "bulk" | "settings" | "upgrade";

export default function App() {
    const [state, setState] = useState<AppState>(boot.state);
    const [tab, setTab] = useState<Tab>("overview");

    const plan = state.license.valid ? state.license.plan : "free";
    const planLabel = plan ? plan[0]!.toUpperCase() + plan.slice(1) : "Free";

    return (
        <div className="tempaloo-wrap">
            <Toasts />

            {/* Top bar */}
            <header className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Logo />
                    <div>
                        <h1 className="text-xl font-semibold text-ink-900">Tempaloo WebP</h1>
                        <p className="text-xs text-ink-500">Image optimizer &amp; AVIF converter</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant={state.license.valid ? "brand" : "neutral"}>
                        {state.license.valid ? `${planLabel} plan` : "No license"}
                    </Badge>
                    <a
                        className="text-xs font-medium text-ink-500 hover:text-ink-900"
                        href="https://tempaloo.com/webp"
                        target="_blank"
                        rel="noopener"
                    >
                        Dashboard ↗
                    </a>
                </div>
            </header>

            {/* Sidebar + content */}
            <div className="grid grid-cols-[180px_1fr] gap-6 items-start">
                <aside className="sticky top-8">
                    <Tabs
                        value={tab}
                        onChange={setTab}
                        items={[
                            { value: "overview", label: "Overview", icon: <IconOverview /> },
                            { value: "bulk",     label: "Bulk",     icon: <IconBulk /> },
                            { value: "settings", label: "Settings", icon: <IconSettings /> },
                            { value: "upgrade",  label: "Upgrade",  icon: <IconUpgrade /> },
                        ]}
                    />
                    {!state.license.valid && (
                        <div className="mt-6 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-4 text-white">
                            <div className="text-xs uppercase tracking-wider opacity-80">Free plan</div>
                            <div className="mt-1 text-sm font-semibold leading-tight">150 images per month — no credit card.</div>
                            <a
                                href={boot.activateUrl}
                                target="_blank"
                                rel="noopener"
                                className="mt-3 inline-flex text-xs font-medium rounded-md bg-white/20 hover:bg-white/30 px-2.5 py-1"
                            >
                                Get my key →
                            </a>
                        </div>
                    )}
                </aside>

                <main className="min-w-0">
                    {tab === "overview" && <Overview state={state} onState={setState} />}
                    {tab === "bulk"     && <Bulk state={state} />}
                    {tab === "settings" && <Settings state={state} onState={setState} />}
                    {tab === "upgrade"  && <Upgrade state={state} />}
                </main>
            </div>
        </div>
    );
}

function Logo() {
    return (
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-sm shadow-pop">
            T
        </div>
    );
}
function IconOverview() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
    );
}
function IconBulk() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.22-8.56" />
            <polyline points="21 4 21 10 15 10" />
        </svg>
    );
}
function IconUpgrade() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" fillOpacity="0.15" />
        </svg>
    );
}
function IconSettings() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.14.46.56.99 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    );
}
