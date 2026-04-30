import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Card({
    className,
    children,
    ...rest
}: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            {...rest}
            className={clsx(
                "rounded-xl border border-ink-200 bg-white shadow-card p-6",
                className,
            )}
        >
            {children}
        </div>
    );
}

export function CardHeader({ title, description, right }: { title: string; description?: string; right?: ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4 mb-5">
            <div>
                <h3 className="text-base font-semibold text-ink-900">{title}</h3>
                {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
            </div>
            {right && <div className="shrink-0">{right}</div>}
        </div>
    );
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
type BtnSize = "sm" | "md";
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: BtnVariant;
    size?: BtnSize;
    loading?: boolean;
}
export function Button({ variant = "primary", size = "md", loading, className, disabled, children, ...rest }: ButtonProps) {
    const base =
        "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition select-none disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-400";
    const sizes = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm" };
    const variants: Record<BtnVariant, string> = {
        primary: "bg-brand-600 text-white hover:bg-brand-700",
        secondary: "bg-white border border-ink-200 text-ink-800 hover:bg-ink-50",
        ghost: "bg-transparent text-ink-700 hover:bg-ink-100",
        danger: "bg-red-600 text-white hover:bg-red-700",
    };
    return (
        <button
            {...rest}
            disabled={disabled || loading}
            className={clsx(base, sizes[size], variants[variant], className)}
        >
            {loading && <Spinner />}
            {children}
        </button>
    );
}

export function Spinner({ className }: { className?: string }) {
    return (
        <svg className={clsx("animate-spin h-4 w-4", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
    );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...rest}
            className={clsx(
                "h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400",
                className,
            )}
        />
    );
}

export function Switch({ checked, onChange, label, description }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
    description?: string;
}) {
    return (
        <label className="flex items-start gap-3 cursor-pointer select-none">
            <span
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                className={clsx(
                    "relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition",
                    checked ? "bg-brand-600" : "bg-ink-300",
                )}
            >
                <span
                    className={clsx(
                        "inline-block h-4 w-4 rounded-full bg-white shadow transform transition",
                        checked ? "translate-x-[18px]" : "translate-x-0.5",
                    )}
                />
            </span>
            <span>
                <span className="text-sm font-medium text-ink-900">{label}</span>
                {description && <span className="block text-xs text-ink-500 mt-0.5">{description}</span>}
            </span>
        </label>
    );
}

export function Badge({ children, variant = "neutral" }: { children: ReactNode; variant?: "neutral" | "brand" | "success" | "warn" | "danger" }) {
    const classes = {
        neutral: "bg-ink-100 text-ink-700",
        brand:   "bg-brand-100 text-brand-700",
        success: "bg-emerald-100 text-emerald-700",
        warn:    "bg-amber-100 text-amber-800",
        danger:  "bg-red-100 text-red-700",
    }[variant];
    return <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", classes)}>{children}</span>;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
    return (
        <div>
            <div className="text-xs uppercase tracking-wide text-ink-500">{label}</div>
            <div className="mt-1 text-2xl font-semibold text-ink-900">{value}</div>
            {sub && <div className="mt-0.5 text-xs text-ink-500">{sub}</div>}
        </div>
    );
}

export function QuotaRing({ used, limit, size = 160 }: { used: number; limit: number; size?: number }) {
    const unlimited = limit === -1;
    const pct = unlimited ? 12 : Math.min(100, limit > 0 ? (used / limit) * 100 : 0);
    const r = size / 2 - 10;
    const c = 2 * Math.PI * r;
    const dash = (pct / 100) * c;
    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} stroke="#e2e8f0" strokeWidth="10" fill="none" />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    stroke="url(#grad)"
                    strokeWidth="10"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${c - dash}`}
                    style={{ transition: "stroke-dasharray 500ms ease" }}
                />
                <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#3b6cff" />
                        <stop offset="100%" stopColor="#1e42b8" />
                    </linearGradient>
                </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-3xl font-semibold text-ink-900 tabular-nums">{used}</div>
                <div className="text-xs text-ink-500">
                    {unlimited ? "of ∞" : `of ${limit.toLocaleString()}`}
                </div>
            </div>
        </div>
    );
}

export function Progress({ value, label }: { value: number; label?: string }) {
    return (
        <div>
            <div className="h-2 w-full rounded-full bg-ink-200 overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                />
            </div>
            {label && <div className="mt-1.5 text-xs text-ink-500 tabular-nums">{label}</div>}
        </div>
    );
}

/**
 * Skeleton — uniform shimmer block, used during initial fetches across
 * Activity / Sites / Upgrade / etc. so loading states feel consistent
 * (one primitive instead of every page rolling its own .animate-pulse).
 */
export function Skeleton({ className, height, width, circle }: {
    className?: string;
    height?: number | string;
    width?: number | string;
    circle?: boolean;
}) {
    const style: React.CSSProperties = {};
    if (height !== undefined) style.height = typeof height === "number" ? `${height}px` : height;
    if (width !== undefined)  style.width  = typeof width  === "number" ? `${width}px`  : width;
    return (
        <div
            aria-hidden
            className={clsx(
                "tempaloo-skel",
                circle ? "rounded-full" : "rounded-lg",
                className,
            )}
            style={style}
        />
    );
}

export function SkeletonStyles() {
    return (
        <style>{`
            .tempaloo-skel {
                background: linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%);
                background-size: 200% 100%;
                animation: tempalooSkel 1.4s ease-in-out infinite;
            }
            @keyframes tempalooSkel {
                from { background-position: 200% 0; }
                to   { background-position: -200% 0; }
            }
            @keyframes tempaloo-pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50%      { opacity: 0.5; transform: scale(1.4); }
            }
            @media (prefers-reduced-motion: reduce) {
                .tempaloo-skel { animation: none; background: #e2e8f0; }
                @keyframes tempaloo-pulse { 0%, 100% { opacity: 1; } }
            }
        `}</style>
    );
}

/* ── Toast system v2 ────────────────────────────────────────────────── */

export type ToastKind = "success" | "error" | "info" | "warn";
export interface ToastItem {
    id: string;
    kind: ToastKind;
    title?: string;
    text: string;
    duration?: number;            // ms; defaults below; pass 0 to disable auto-dismiss
    action?: { label: string; onClick: () => void };
}

let toastSubs: ((t: ToastItem) => void)[] = [];

/**
 * Backward-compatible: `toast("success", "Saved")` still works.
 * New form: `toast({ kind, title, text, action, duration })`.
 */
export function toast(kindOrItem: ToastKind | Omit<ToastItem, "id">, text?: string) {
    const id = Math.random().toString(36).slice(2);
    const item: ToastItem =
        typeof kindOrItem === "string"
            ? { id, kind: kindOrItem, text: text ?? "" }
            : { id, ...kindOrItem };
    toastSubs.forEach((fn) => fn(item));
}

const TOAST_DEFAULTS: Record<ToastKind, number> = {
    success: 4500,
    info:    4500,
    warn:    6000,
    error:   7000,
};

export function Toasts() {
    const [items, setItems] = useState<(ToastItem & { paused?: boolean; startedAt: number })[]>([]);

    useEffect(() => {
        const handler = (t: ToastItem) => {
            const startedAt = Date.now();
            setItems((cur) => [...cur, { ...t, startedAt }]);
        };
        toastSubs.push(handler);
        return () => { toastSubs = toastSubs.filter((f) => f !== handler); };
    }, []);

    // Auto-dismiss tick — every 200ms check what's expired (pauses while hovered)
    useEffect(() => {
        const t = setInterval(() => {
            setItems((cur) => cur.filter((it) => {
                if (it.paused) return true;
                const dur = it.duration ?? TOAST_DEFAULTS[it.kind];
                if (dur === 0) return true;
                return Date.now() - it.startedAt < dur;
            }));
        }, 200);
        return () => clearInterval(t);
    }, []);

    const dismiss = (id: string) =>
        setItems((cur) => cur.filter((x) => x.id !== id));

    const setPaused = (id: string, paused: boolean) =>
        setItems((cur) => cur.map((x) =>
            x.id === id
                ? { ...x, paused, startedAt: paused ? x.startedAt : Date.now() } // reset timer on resume
                : x
        ));

    return (
        <div className="fixed bottom-6 right-6 flex flex-col gap-2.5 z-[100000] pointer-events-none">
            {items.slice(-4).map((t) => (
                <ToastCard
                    key={t.id}
                    item={t}
                    onDismiss={() => dismiss(t.id)}
                    onPauseChange={(p) => setPaused(t.id, p)}
                />
            ))}
            <style>{`
                @keyframes toastIn {
                    0%   { opacity: 0; transform: translateX(40px) scale(0.96); }
                    60%  { opacity: 1; }
                    100% { opacity: 1; transform: none; }
                }
                @keyframes toastTimer {
                    from { transform: scaleX(1); }
                    to   { transform: scaleX(0); }
                }
                @keyframes toastIcon {
                    from { transform: scale(0.4); opacity: 0; }
                    to   { transform: scale(1);   opacity: 1; }
                }
            `}</style>
        </div>
    );
}

function ToastCard({ item, onDismiss, onPauseChange }: {
    item: ToastItem & { paused?: boolean; startedAt: number };
    onDismiss: () => void;
    onPauseChange: (paused: boolean) => void;
}) {
    const dur = item.duration ?? TOAST_DEFAULTS[item.kind];
    const palette: Record<ToastKind, { bar: string; bg: string; border: string; text: string; icon: string; iconBg: string }> = {
        success: { bar: "bg-emerald-500", bg: "bg-white",  border: "border-emerald-200", text: "text-ink-900", icon: "text-emerald-600", iconBg: "bg-emerald-100" },
        error:   { bar: "bg-red-500",     bg: "bg-white",  border: "border-red-200",     text: "text-ink-900", icon: "text-red-600",     iconBg: "bg-red-100"     },
        warn:    { bar: "bg-amber-500",   bg: "bg-white",  border: "border-amber-200",   text: "text-ink-900", icon: "text-amber-600",   iconBg: "bg-amber-100"   },
        info:    { bar: "bg-brand-500",   bg: "bg-white",  border: "border-ink-200",     text: "text-ink-900", icon: "text-brand-600",   iconBg: "bg-brand-50"    },
    };
    const p = palette[item.kind];
    const icon = item.kind === "success" ? "✓"
               : item.kind === "error"   ? "✕"
               : item.kind === "warn"    ? "!"
               : "i";

    return (
        <div
            role={item.kind === "error" ? "alert" : "status"}
            className={clsx(
                "pointer-events-auto relative flex items-start gap-3 max-w-sm min-w-[280px] rounded-xl shadow-2xl border overflow-hidden pr-2 pl-1.5 py-2.5",
                p.bg, p.border, p.text,
            )}
            style={{ animation: "toastIn 280ms cubic-bezier(.16,1,.3,1) both" }}
            onMouseEnter={() => onPauseChange(true)}
            onMouseLeave={() => onPauseChange(false)}
        >
            {/* Color bar on the left */}
            <span className={clsx("absolute left-0 top-0 bottom-0 w-1", p.bar)} />

            {/* Icon */}
            <div
                className={clsx("shrink-0 ml-1.5 mt-0.5 h-7 w-7 rounded-full grid place-items-center font-bold text-sm", p.icon, p.iconBg)}
                style={{ animation: "toastIcon 360ms cubic-bezier(.16,1,.3,1) both" }}
                aria-hidden
            >
                {icon}
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1 py-0.5">
                {item.title && <div className="text-sm font-semibold leading-tight">{item.title}</div>}
                <div className={clsx("text-sm leading-snug", item.title && "mt-0.5 text-ink-600")}>{item.text}</div>
                {item.action && (
                    <button
                        type="button"
                        onClick={() => { item.action!.onClick(); onDismiss(); }}
                        className={clsx("mt-1.5 text-xs font-semibold underline-offset-2 hover:underline", p.icon)}
                    >
                        {item.action.label}
                    </button>
                )}
            </div>

            {/* Dismiss button */}
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss"
                className="shrink-0 mt-0.5 h-6 w-6 rounded-md text-ink-400 hover:text-ink-700 hover:bg-ink-100 grid place-items-center text-xs"
            >
                ×
            </button>

            {/* Progress bar at the bottom — pauses on hover */}
            {dur > 0 && (
                <span
                    className={clsx("absolute bottom-0 left-0 right-0 h-0.5 origin-left", p.bar)}
                    style={{
                        animation: `toastTimer ${dur}ms linear forwards`,
                        animationPlayState: item.paused ? "paused" : "running",
                    }}
                />
            )}
        </div>
    );
}

/* ── PerformanceScorecard ───────────────────────────────────────────── */

/**
 * Hero card for Overview. The "you did good" emotional pay-off.
 * Headline number = % lighter, animated counter. Two sub-gauges: bandwidth
 * saved + estimated LCP impact. Tiny context line projects savings on a
 * 5,000-visitor base so the user can relate the number to euros.
 */
export function PerformanceScorecard({
    bytesIn, bytesOut, converted,
}: {
    bytesIn: number;
    bytesOut: number;
    converted: number;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [shown, setShown] = useState(false);
    useEffect(() => {
        if (!ref.current) return;
        const io = new IntersectionObserver(([e]) => {
            if (e?.isIntersecting) { setShown(true); io.disconnect(); }
        }, { threshold: 0.3 });
        io.observe(ref.current);
        return () => io.disconnect();
    }, []);

    const saved = Math.max(0, bytesIn - bytesOut);
    const savedPct = bytesIn > 0 ? Math.round((1 - bytesOut / bytesIn) * 100) : 0;
    // Rough LCP improvement model: assume hero photo is ~30% of bytes_in.
    // Saving X% of weight ≈ X * 0.03 seconds shaved off LCP on a 4G-class line.
    const lcpShaved = Math.min(3.0, savedPct * 0.03);
    // CDN cost projection: 5,000 visitors × ~3 image-page-views avg × bytes saved per page.
    // Result is monthly bandwidth savings in MB → divide by 1024 to GB → multiply by €0.04/GB (Bunny CDN typical).
    const monthlyGbSaved = (saved * 5000 * 3) / (1024 * 1024 * 1024);
    const monthlyEur = monthlyGbSaved * 0.04;

    const lightPct  = useTween(shown ? savedPct : 0, 1100);
    const savedB    = useTween(shown ? saved : 0, 1300);
    const lcpDisp   = useTween(shown ? lcpShaved * 10 : 0, 1100); // tween *10 so we get one decimal

    if (converted === 0) {
        // Empty state — gentler card so the new user isn't faced with a giant zero
        return (
            <div ref={ref} className="rounded-2xl border border-ink-200 bg-gradient-to-br from-ink-50 via-white to-brand-50/40 p-6">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-brand-50 grid place-items-center text-brand-600 text-xl">⚡</div>
                    <div>
                        <div className="text-base font-semibold text-ink-900">Ready to make your site faster.</div>
                        <div className="text-sm text-ink-600">Upload an image or run a Bulk to see your savings here.</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={ref}
            className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-brand-50/40 p-6 sm:p-8"
        >
            {/* Subtle decorative grid */}
            <div aria-hidden className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{
                backgroundImage: "linear-gradient(0deg, transparent 24%, currentColor 25%, currentColor 26%, transparent 27%, transparent 74%, currentColor 75%, currentColor 76%, transparent 77%), linear-gradient(90deg, transparent 24%, currentColor 25%, currentColor 26%, transparent 27%, transparent 74%, currentColor 75%, currentColor 76%, transparent 77%)",
                backgroundSize: "32px 32px",
            }} />

            <div className="relative grid gap-6 sm:grid-cols-[auto_1fr] items-center">
                {/* Big headline number */}
                <div className="text-center sm:text-left">
                    <div className="text-xs font-mono uppercase tracking-wider text-emerald-700 mb-1">YOUR PERFORMANCE</div>
                    <div className="flex items-baseline gap-2 justify-center sm:justify-start">
                        <span className="text-6xl sm:text-7xl font-bold text-ink-900 tabular-nums leading-none tracking-tight">
                            {Math.round(lightPct)}<span className="text-emerald-600">%</span>
                        </span>
                        <span className="text-base font-semibold text-ink-700 mb-1">lighter</span>
                    </div>
                    <div className="text-sm text-ink-600 mt-2">
                        Across <strong className="text-ink-900">{converted.toLocaleString()}</strong> converted image{converted > 1 ? "s" : ""}
                    </div>
                </div>

                {/* Two sub-gauges */}
                <div className="grid grid-cols-2 gap-3">
                    <Gauge
                        kind="bandwidth"
                        label="Bandwidth saved"
                        value={formatBytes(savedB)}
                        fillPct={Math.min(100, savedPct)}
                        shown={shown}
                    />
                    <Gauge
                        kind="lcp"
                        label="Est. LCP impact"
                        value={`−${(lcpDisp / 10).toFixed(1)}s`}
                        fillPct={Math.min(100, (lcpShaved / 3) * 100)}
                        shown={shown}
                    />
                </div>
            </div>

            {/* Projection line — only shown when meaningful */}
            {monthlyEur > 0.5 && (
                <div className="relative mt-5 pt-4 border-t border-emerald-100/80 flex items-start gap-2 text-sm text-ink-600">
                    <span className="text-emerald-600">💡</span>
                    <span>
                        At <strong className="text-ink-900">5,000 monthly visitors</strong>, that&apos;s
                        <strong className="text-ink-900"> ~{monthlyGbSaved.toFixed(1)} GB</strong> of bandwidth
                        saved per month — about
                        <strong className="text-emerald-700"> €{monthlyEur.toFixed(2)}/mo</strong> off a typical CDN bill.
                    </span>
                </div>
            )}
        </div>
    );
}

function Gauge({ kind, label, value, fillPct, shown }: {
    kind: "bandwidth" | "lcp";
    label: string;
    value: string;
    fillPct: number;
    shown: boolean;
}) {
    const grad = kind === "bandwidth"
        ? "from-emerald-400 to-emerald-600"
        : "from-brand-400 to-brand-600";
    const ring = kind === "bandwidth" ? "text-emerald-600" : "text-brand-600";
    const icon = kind === "bandwidth"
        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 1 0 -18 0" /><path d="M12 8 V12 L15 15" /></svg>
        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 L4 14 H11 L10 22 L20 10 H13 L14 2 Z" /></svg>;

    return (
        <div className="rounded-xl bg-white border border-ink-200 p-4 relative overflow-hidden">
            <div className="flex items-center gap-2 text-xs text-ink-500 font-medium mb-2">
                <span className={ring}>{icon}</span>
                <span>{label}</span>
            </div>
            <div className="text-2xl font-bold text-ink-900 tabular-nums">{value}</div>

            {/* Fill bar */}
            <div className="mt-3 h-1.5 rounded-full bg-ink-100 overflow-hidden">
                <div
                    className={clsx("h-full bg-gradient-to-r rounded-full", grad)}
                    style={{
                        width: shown ? fillPct + "%" : "0%",
                        transition: "width 1100ms cubic-bezier(.16,1,.3,1)",
                    }}
                />
            </div>
        </div>
    );
}

// Inline tween hook used by the scorecard (number-only, returns a number)
function useTween(target: number, duration = 800): number {
    const [value, setValue] = useState(0);
    const fromRef = useRef(0);
    useEffect(() => {
        const from = fromRef.current;
        const start = performance.now();
        let raf = 0;
        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            const v = from + (target - from) * eased;
            setValue(v);
            if (t < 1) raf = requestAnimationFrame(tick);
            else fromRef.current = target;
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, duration]);
    return value;
}

// formatBytes: re-export the helper (the api.ts version takes a number)
function formatBytes(n: number): string {
    if (!Number.isFinite(n) || n <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Modal — accessible, focus-trapped, escape-to-close, scale+fade animation.
 * Use for any destructive or commit-now action where the native browser
 * confirm() would feel cheap.
 */
export function Modal({
    open, onClose, title, description, children, size = "md", variant = "neutral",
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: ReactNode;
    children: ReactNode;
    size?: "sm" | "md" | "lg";
    variant?: "neutral" | "danger" | "success";
}) {
    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener("keydown", onKey);
        };
    }, [open, onClose]);

    if (!open) return null;

    const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };
    const accent = {
        neutral: "border-ink-200",
        danger:  "border-red-300 ring-2 ring-red-100",
        success: "border-emerald-300 ring-2 ring-emerald-100",
    }[variant];

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
            style={{ animation: "tempaloo-fadein 180ms ease forwards" }}
        >
            <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="absolute inset-0 bg-black/55 backdrop-blur-sm cursor-pointer border-0"
            />
            <div
                className={clsx(
                    "relative w-full bg-white rounded-2xl shadow-2xl border p-6",
                    widths[size],
                    accent,
                )}
                style={{ animation: "tempaloo-popin 220ms cubic-bezier(.16,1,.3,1) forwards", maxHeight: "calc(100vh - 32px)", overflowY: "auto" }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4">
                    <h3 className="text-lg font-semibold text-ink-900 tracking-tight">{title}</h3>
                    {description && <div className="mt-1 text-sm text-ink-500">{description}</div>}
                </div>
                {children}
            </div>
            <style>{`
                @keyframes tempaloo-fadein { from { opacity: 0 } to { opacity: 1 } }
                @keyframes tempaloo-popin {
                    from { opacity: 0; transform: translateY(8px) scale(0.96) }
                    to   { opacity: 1; transform: none }
                }
            `}</style>
        </div>
    );
}

/**
 * CSS-only confetti burst. Renders 24 particles falling with random offsets,
 * lifecycle = 1.6s. Safe inside any container that is `position: relative`.
 * Skips render entirely under prefers-reduced-motion.
 */
export function Confetti({ active }: { active: boolean }) {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        if (typeof window === "undefined") return;
        setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }, []);
    if (!active || reduced) return null;
    // Brand-aligned: emerald, brand-500, amber, brand-700, ink-400, emerald-700
    const colors = ["#10b981", "#3b6cff", "#f59e0b", "#1e42b8", "#94a3b8", "#047857"];
    return (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 24 }, (_, i) => {
                const left = (i / 24) * 100 + (Math.random() - 0.5) * 8;
                const delay = Math.random() * 250;
                const duration = 1300 + Math.random() * 600;
                const rotate = Math.random() * 720 - 360;
                const color = colors[i % colors.length];
                const w = 6 + Math.random() * 6;
                const h = 8 + Math.random() * 8;
                return (
                    <span
                        key={i}
                        style={{
                            position: "absolute",
                            top: -16,
                            left: left + "%",
                            width: w, height: h,
                            background: color,
                            borderRadius: 2,
                            opacity: 0,
                            animation: `tempaloo-confetti ${duration}ms cubic-bezier(.16,1,.3,1) ${delay}ms forwards`,
                            ["--tempaloo-rot" as never]: rotate + "deg",
                        }}
                    />
                );
            })}
            <style>{`
                @keyframes tempaloo-confetti {
                    0%   { opacity: 0; transform: translateY(-30px) rotate(0deg) }
                    10%  { opacity: 1 }
                    100% { opacity: 0; transform: translateY(420px) rotate(var(--tempaloo-rot, 360deg)) }
                }
            `}</style>
        </div>
    );
}

/**
 * SVG progress ring with a tweened percentage in the center.
 * Reused by the bulk live view + future onboarding flows.
 */
export function ProgressRing({ value, size = 140, label, sub, shimmer = false }: { value: number; size?: number; label?: string; sub?: string; shimmer?: boolean }) {
    const stroke = 10;
    const radius = (size - stroke) / 2;
    const C = 2 * Math.PI * radius;
    const safe = Math.max(0, Math.min(100, value));
    return (
        <div className="relative" style={{ width: size, height: size }}>
            {/* Rotating conic-gradient overlay behind the SVG. Signals
                "actively working" without burning eyeballs — opacity .12,
                3s rotation, only mounted when shimmer is on. */}
            {shimmer && (
                <div
                    aria-hidden
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{
                        background: "conic-gradient(from 0deg, transparent 0deg, rgba(42,87,230,0.45) 90deg, transparent 200deg)",
                        opacity: 0.12,
                        animation: "tempaloo-ring-shimmer 3s linear infinite",
                        WebkitMaskImage: `radial-gradient(circle, transparent ${radius - stroke}px, black ${radius - stroke + 1}px, black ${radius + 1}px, transparent ${radius + 2}px)`,
                        maskImage: `radial-gradient(circle, transparent ${radius - stroke}px, black ${radius - stroke + 1}px, black ${radius + 1}px, transparent ${radius + 2}px)`,
                    }}
                />
            )}
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative">
                <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgb(229 231 235)" strokeWidth={stroke} fill="none" />
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    stroke="url(#tempaloo-ring-grad)"
                    strokeWidth={stroke}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={C}
                    strokeDashoffset={C * (1 - safe / 100)}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    style={{ transition: "stroke-dashoffset .35s cubic-bezier(.4,0,.2,1)" }}
                />
                <defs>
                    <linearGradient id="tempaloo-ring-grad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#2a57e6" />
                    </linearGradient>
                </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="text-3xl font-bold text-ink-900 tabular-nums">{Math.round(safe)}%</div>
                {label && <div className="text-xs text-ink-500 mt-0.5">{label}</div>}
                {sub && <div className="text-[10px] text-ink-400 mt-0.5 font-mono">{sub}</div>}
            </div>
            <style>{`
                @keyframes tempaloo-ring-shimmer { to { transform: rotate(360deg); } }
                @media (prefers-reduced-motion: reduce) {
                    [style*="tempaloo-ring-shimmer"] { animation: none !important; }
                }
            `}</style>
        </div>
    );
}

/**
 * QuotaProgressBar — horizontal "fuel gauge" of monthly credits, ticking
 * down image-by-image during a bulk run. Designed to feel like a budget
 * being spent — green at full, ambering as it depletes, red below 10%.
 * Animations are intentionally short (300ms) so per-image updates feel
 * snappy ("ding ding ding") rather than laggy.
 *
 * Pass remaining/limit; component handles formatting + color thresholds.
 * unlimited=true displays an infinity glyph and skips the bar (used for
 * Unlimited plan).
 */
export function QuotaProgressBar({ used, limit, unlimited = false, label }: { used: number; limit: number; unlimited?: boolean; label?: string }) {
    const remaining = Math.max(0, limit - used);
    const pct = limit > 0 ? Math.max(0, Math.min(100, (remaining / limit) * 100)) : 0;
    const animatedRemaining = useCountUp(remaining, 300);
    const animatedPct = useCountUp(pct, 300);

    // Color thresholds — green > 30%, amber 10–30%, red < 10%.
    let barColor = "bg-emerald-500";
    let textColor = "text-emerald-700";
    if (pct < 10) { barColor = "bg-red-500"; textColor = "text-red-700"; }
    else if (pct < 30) { barColor = "bg-amber-500"; textColor = "text-amber-700"; }

    return (
        <div className="w-full">
            <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-xs font-medium uppercase tracking-wider text-ink-500">
                    {label ?? "Credits remaining"}
                </span>
                <span className={`text-sm font-bold tabular-nums ${unlimited ? "text-ink-700" : textColor}`}>
                    {unlimited ? (
                        <>∞ <span className="text-xs font-normal text-ink-500">unlimited</span></>
                    ) : (
                        <>{Math.round(animatedRemaining).toLocaleString()} <span className="text-xs font-normal text-ink-500">/ {limit.toLocaleString()}</span></>
                    )}
                </span>
            </div>
            {!unlimited && (
                <div className="relative h-2 rounded-full bg-ink-100 overflow-hidden">
                    <div
                        className={`absolute inset-y-0 left-0 ${barColor} transition-colors duration-300`}
                        style={{
                            width: `${animatedPct}%`,
                            transition: "width .3s cubic-bezier(.4,0,.2,1), background-color .3s ease",
                        }}
                    />
                    {/* Subtle shimmer sweep across the filled portion to
                        signal "actively counting" during a run. */}
                    <div
                        aria-hidden
                        className="absolute inset-y-0 left-0 pointer-events-none"
                        style={{
                            width: `${animatedPct}%`,
                            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
                            backgroundSize: "200% 100%",
                            animation: "tempaloo-bar-shimmer 2s linear infinite",
                        }}
                    />
                </div>
            )}
            <style>{`
                @keyframes tempaloo-bar-shimmer {
                    0%   { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                @media (prefers-reduced-motion: reduce) {
                    [style*="tempaloo-bar-shimmer"] { animation: none !important; }
                }
            `}</style>
        </div>
    );
}

/**
 * SavingsCounter — animates a "X MB freed" total during a bulk run.
 * Pass cumulative bytesIn / bytesOut from the bulk tick; component
 * computes savings + percentage, formats the numbers human-readable,
 * and tweens transitions so each batch update feels tactile.
 *
 * Visual: large savings number on the left, percentage badge + bytesIn
 * vs. bytesOut breakdown on the right. Designed to fit a half-width
 * card alongside CurrentlyProcessing during a run.
 */
export function SavingsCounter({ bytesIn, bytesOut, compact = false }: { bytesIn: number; bytesOut: number; compact?: boolean }) {
    const saved = Math.max(0, bytesIn - bytesOut);
    const pct = bytesIn > 0 ? (saved / bytesIn) * 100 : 0;
    const animatedSaved = useCountUp(saved, 600);
    const animatedPct = useCountUp(pct, 600);

    if (saved === 0) {
        return (
            <div className="rounded-lg bg-ink-50/50 border border-ink-200 px-4 py-3">
                <div className="text-xs uppercase tracking-wider text-ink-500 font-medium mb-1">
                    Space freed
                </div>
                <div className="text-2xl font-bold text-ink-300 tabular-nums">—</div>
                <div className="text-[11px] text-ink-400 mt-1">Computing as images convert…</div>
            </div>
        );
    }

    return (
        <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-50/40 border border-emerald-200 px-4 py-3 relative overflow-hidden">
            {/* Subtle radial glow that pulses when bytes increase. Pure
                CSS, no JS — :nth-of-type avoids re-mount churn. */}
            <div
                aria-hidden
                className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none"
                style={{
                    background: "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)",
                    animation: "tempaloo-savings-pulse 3s ease-in-out infinite",
                }}
            />
            <div className="relative">
                <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs uppercase tracking-wider text-emerald-700 font-medium">
                        Space freed
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 tabular-nums bg-emerald-100 rounded px-1.5 py-0.5">
                        {animatedPct.toFixed(0)}% smaller
                    </span>
                </div>
                <div className="text-3xl font-bold text-emerald-700 tabular-nums leading-none">
                    {fmtBytes(animatedSaved)}
                </div>
                {!compact && (
                    <div className="text-[11px] text-ink-500 mt-2 tabular-nums">
                        {fmtBytes(bytesIn)} → <span className="text-emerald-700 font-medium">{fmtBytes(bytesOut)}</span>
                    </div>
                )}
            </div>
            <style>{`
                @keyframes tempaloo-savings-pulse {
                    0%, 100% { transform: scale(1); opacity: 0.7; }
                    50%      { transform: scale(1.15); opacity: 1; }
                }
                @media (prefers-reduced-motion: reduce) {
                    [style*="tempaloo-savings-pulse"] { animation: none !important; }
                }
            `}</style>
        </div>
    );
}

/** Human-readable byte formatter — KB/MB/GB with one decimal where
 *  helpful. Public so other components can render savings consistently. */
export function fmtBytes(n: number): string {
    if (!Number.isFinite(n) || n <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${i === 0 ? v.toFixed(0) : v.toFixed(v < 10 ? 2 : 1)} ${units[i]}`;
}

/**
 * CurrentlyProcessing — feedback card showing the most recently
 * converted attachment (filename + format + per-image savings). Slides
 * in with a subtle translate-Y on each new lastItem, so the user sees
 * tangible progress per image instead of an abstract "running…" state.
 *
 * Pass null when there's no last item yet; component renders an
 * empty-state pulse instead.
 */
export function CurrentlyProcessing({ item }: { item: { id: number; name: string; format: string; bytesIn: number; bytesOut: number; at: number } | null | undefined }) {
    if (!item) {
        return (
            <div className="rounded-lg bg-white border border-ink-200 px-4 py-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded bg-ink-100 animate-pulse shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="h-3 w-32 rounded bg-ink-100 animate-pulse mb-1.5" />
                    <div className="h-2.5 w-20 rounded bg-ink-100/60 animate-pulse" />
                </div>
            </div>
        );
    }

    const saved = Math.max(0, item.bytesIn - item.bytesOut);
    const pct = item.bytesIn > 0 ? (saved / item.bytesIn) * 100 : 0;
    const formatBadge = item.format.toUpperCase();
    const formatColor = item.format === "avif"
        ? "bg-violet-100 text-violet-700"
        : item.format === "both"
        ? "bg-gradient-to-r from-emerald-100 to-violet-100 text-ink-700"
        : "bg-emerald-100 text-emerald-700";

    return (
        <div
            // Key by item.id+at so a new conversion remounts the card
            // and replays the slide-in animation. Without this the card
            // updates in place and the transition fires only once.
            key={`${item.id}-${item.at}`}
            className="rounded-lg bg-white border border-ink-200 px-4 py-3 flex items-center gap-3"
            style={{ animation: "tempaloo-cp-slide 240ms cubic-bezier(.16,1,.3,1) forwards" }}
        >
            <div className="h-9 w-9 rounded bg-gradient-to-br from-brand-100 to-emerald-100 flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-600">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="m21 15-5-5L5 21" />
                </svg>
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-ink-900 truncate">
                        {item.name}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 shrink-0 ${formatColor}`}>
                        {formatBadge}
                    </span>
                </div>
                <div className="text-[11px] text-ink-500 mt-0.5 tabular-nums">
                    {fmtBytes(item.bytesIn)} → <span className="text-emerald-700 font-medium">{fmtBytes(item.bytesOut)}</span>
                    {pct >= 1 && <span className="text-emerald-600 ml-1.5">−{pct.toFixed(0)}%</span>}
                </div>
            </div>
            <style>{`
                @keyframes tempaloo-cp-slide {
                    from { opacity: 0; transform: translateY(-4px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @media (prefers-reduced-motion: reduce) {
                    [style*="tempaloo-cp-slide"] { animation: none !important; }
                }
            `}</style>
        </div>
    );
}

/**
 * useCountUp — tweens a number toward a target over `duration` ms using
 * an ease-out curve. Returns the current value to render. Resets cleanly
 * when the target changes mid-tween (no double-counting). Used in the
 * bulk running view so `succeeded` and `remaining` numbers tick up
 * smoothly per batch instead of jumping in 3-image steps.
 */
export function useCountUp(target: number, duration = 400) {
    const [v, setV] = useState(target);
    const startRef = useRef(target);
    const startTsRef = useRef<number | null>(null);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        startRef.current = v;
        startTsRef.current = null;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        const tick = (ts: number) => {
            if (startTsRef.current === null) startTsRef.current = ts;
            const elapsed = ts - startTsRef.current;
            const t = Math.min(1, elapsed / duration);
            // ease-out cubic
            const eased = 1 - Math.pow(1 - t, 3);
            const next = startRef.current + (target - startRef.current) * eased;
            setV(next);
            if (t < 1) rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target, duration]);

    return v;
}

/**
 * CompressionFactory — animated 3-stage pipeline that loops infinitely while
 * mounted. Use it during bulk runs (anywhere a "we're working" feel helps),
 * or in pre-flight modals to telegraph what's about to happen.
 *
 * Stage 1: original photo card pulses in with size badge.
 * Stage 2: 8 colored particles stream right into a "grinder" zone with
 *          diagonal stripe animation + pulsing core.
 * Stage 3: fewer (4) particles emerge into a smaller compressed card.
 *
 * Whole sequence loops every 3.6s. GPU-only animations (transform + opacity).
 */
export function CompressionFactory({ height = 110 }: { height?: number }) {
    return (
        <div
            className="relative w-full overflow-hidden rounded-xl border border-ink-200 bg-gradient-to-br from-brand-50/50 via-white to-emerald-50/50"
            style={{ height }}
            aria-hidden
        >
            <div className="cf-stage">
                {/* IN — original photo card */}
                <div className="cf-card cf-card-in">
                    <div className="cf-photo cf-photo-orig">
                        <span className="cf-sun" />
                        <span className="cf-mountain" />
                    </div>
                    <div className="cf-meta">
                        <span className="cf-badge cf-badge-jpg">JPG</span>
                        <span className="cf-size">1.24&nbsp;MB</span>
                    </div>
                </div>

                {/* PIPELINE — particles flow */}
                <div className="cf-pipe">
                    {Array.from({ length: 8 }, (_, i) => (
                        <span key={`p-${i}`} className="cf-particle cf-particle-in" style={{ animationDelay: `${i * 0.18}s` }} />
                    ))}
                </div>

                {/* GRINDER — animated compressor */}
                <div className="cf-grinder" aria-label="compressor">
                    <span className="cf-grinder-core" />
                    <span className="cf-grinder-stripes" />
                </div>

                {/* OUT pipe — fewer particles */}
                <div className="cf-pipe cf-pipe-out">
                    {Array.from({ length: 4 }, (_, i) => (
                        <span key={`p-out-${i}`} className="cf-particle cf-particle-out" style={{ animationDelay: `${1.4 + i * 0.22}s` }} />
                    ))}
                </div>

                {/* OUT — compressed photo card */}
                <div className="cf-card cf-card-out">
                    <div className="cf-photo cf-photo-webp">
                        <span className="cf-sun" />
                        <span className="cf-mountain" />
                    </div>
                    <div className="cf-meta">
                        <span className="cf-badge cf-badge-webp">WEBP</span>
                        <span className="cf-size cf-size-good">412&nbsp;KB</span>
                    </div>
                </div>
            </div>

            {/* Saved % pill that pops in at the end of each loop */}
            <span className="cf-saved">−67%</span>

            <style>{cfCss}</style>
        </div>
    );
}

const cfCss = `
.cf-stage {
    position: absolute; inset: 0;
    display: grid;
    grid-template-columns: 64px 1fr 60px 1fr 64px;
    gap: 6px;
    align-items: center;
    padding: 14px 16px;
}
.cf-card {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    transform-origin: center;
}
.cf-card-in  { animation: cfCardIn 3.6s cubic-bezier(.16,1,.3,1) infinite; }
.cf-card-out { animation: cfCardOut 3.6s cubic-bezier(.16,1,.3,1) infinite; }
@keyframes cfCardIn  {
    0%, 100% { opacity: 1; transform: scale(1); }
    70%      { opacity: 0.4; transform: scale(0.92); }
    85%      { opacity: 1; transform: scale(1); }
}
@keyframes cfCardOut {
    0%, 60% { opacity: 0; transform: scale(0.5) translateX(-12px); }
    78%     { opacity: 1; transform: scale(1) translateX(0); }
    100%    { opacity: 1; transform: scale(1); }
}
.cf-photo {
    position: relative;
    width: 64px; height: 44px;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid rgba(0,0,0,0.08);
    background: linear-gradient(180deg, #e8d4b0 0%, #d4895a 55%, #8b3a1a 100%);
}
.cf-photo-webp {
    width: 50px; height: 36px;
    background: linear-gradient(180deg, #e8d4b0 0%, #d4895a 55%, #8b3a1a 100%);
}
.cf-sun {
    position: absolute; top: 6px; right: 10px;
    width: 14px; height: 14px;
    border-radius: 50%;
    background: radial-gradient(#fff5cf 30%, transparent 70%);
}
.cf-photo-webp .cf-sun { width: 10px; height: 10px; top: 4px; right: 7px; }
.cf-mountain {
    position: absolute; left: 0; right: 0; bottom: 0;
    height: 60%;
    background:
        linear-gradient(135deg, transparent 50%, #1a0e08 50%) 0 100% / 30px 14px no-repeat,
        linear-gradient(225deg, transparent 50%, #0f0805 50%) 100% 100% / 35px 16px no-repeat,
        #160d05;
    border-top: 1px solid #1a0e08;
}
.cf-meta {
    display: inline-flex; gap: 4px; align-items: center;
    font-family: ui-monospace, monospace;
    font-size: 9px;
}
.cf-badge {
    padding: 1px 4px;
    border-radius: 2px;
    font-weight: 700;
    letter-spacing: 0.04em;
}
.cf-badge-jpg  { background: #fee2e2; color: #b91c1c; }
.cf-badge-webp { background: #d1fae5; color: #047857; }
.cf-size       { color: #475569; font-weight: 600; }
.cf-size-good  { color: #059669; }

.cf-pipe {
    position: relative;
    height: 100%;
    overflow: hidden;
}
.cf-particle {
    position: absolute;
    top: 50%;
    left: -8px;
    width: 6px; height: 6px;
    border-radius: 50%;
    transform: translateY(-50%);
    opacity: 0;
}
.cf-particle-in  { background: linear-gradient(135deg, #f97316, #fb923c); animation: cfParticle 3.6s linear infinite; }
.cf-particle-out { background: linear-gradient(135deg, #10b981, #34d399); animation: cfParticleOut 3.6s linear infinite; }
@keyframes cfParticle {
    0%   { transform: translate(0, -50%) scale(0.6); opacity: 0; }
    8%   { opacity: 1; }
    35%  { transform: translate(calc(100% + 16px), -50%) scale(1); opacity: 1; }
    40%  { opacity: 0; transform: translate(calc(100% + 16px), -50%) scale(0); }
    100% { opacity: 0; }
}
@keyframes cfParticleOut {
    0%, 38%   { opacity: 0; transform: translate(0, -50%) scale(0); }
    45%       { opacity: 1; transform: translate(0, -50%) scale(1); }
    72%       { transform: translate(calc(100% + 16px), -50%) scale(1); opacity: 1; }
    78%, 100% { opacity: 0; transform: translate(calc(100% + 16px), -50%) scale(0); }
}

.cf-grinder {
    position: relative;
    height: 56px;
    border-radius: 8px;
    background: #0f172a;
    border: 1px solid #1e293b;
    overflow: hidden;
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
}
.cf-grinder-stripes {
    position: absolute; inset: 0;
    background:
        repeating-linear-gradient(45deg,
            rgba(255,255,255,0.08) 0 4px,
            transparent 4px 8px);
    animation: cfStripes 0.8s linear infinite;
}
@keyframes cfStripes {
    to { background-position: 16px 0; }
}
.cf-grinder-core {
    position: absolute; top: 50%; left: 50%;
    width: 28px; height: 28px;
    margin: -14px 0 0 -14px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #5688ff, #1a3891);
    box-shadow: 0 0 12px rgba(42, 87, 230, 0.5), inset 0 -4px 8px rgba(0,0,0,0.3);
    animation: cfCorePulse 1.2s ease-in-out infinite;
}
@keyframes cfCorePulse {
    0%, 100% { transform: scale(1); box-shadow: 0 0 12px rgba(42, 87, 230, 0.5), inset 0 -4px 8px rgba(0,0,0,0.3); }
    50%      { transform: scale(1.15); box-shadow: 0 0 22px rgba(42, 87, 230, 0.8), inset 0 -4px 8px rgba(0,0,0,0.3); }
}
.cf-saved {
    position: absolute;
    top: 8px; right: 12px;
    padding: 2px 8px;
    border-radius: 999px;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    font-family: ui-monospace, monospace;
    font-size: 10px;
    font-weight: 700;
    box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
    opacity: 0;
    transform: scale(0.6);
    animation: cfSavedPop 3.6s cubic-bezier(.16,1,.3,1) infinite;
}
@keyframes cfSavedPop {
    0%, 70%  { opacity: 0; transform: scale(0.6); }
    80%, 95% { opacity: 1; transform: scale(1); }
    100%     { opacity: 0; transform: scale(0.9); }
}

@media (prefers-reduced-motion: reduce) {
    .cf-stage * { animation: none !important; }
    .cf-card-out { opacity: 1; transform: none; }
    .cf-saved { opacity: 1; transform: none; }
}
`;

/**
 * DecompressionWave — the inverse visual for Restore. Shows compressed file
 * dissolving back to original via a wave / scanline effect. Calmer + warmer
 * palette than CompressionFactory (orange/amber, not blue/green).
 */
export function DecompressionWave({ height = 110 }: { height?: number }) {
    return (
        <div
            className="relative w-full overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/70 via-white to-orange-50/70"
            style={{ height }}
            aria-hidden
        >
            <div className="dw-stage">
                {/* Compressed file (left, fading out) */}
                <div className="dw-card dw-card-in">
                    <div className="dw-photo dw-photo-small">
                        <span className="dw-sun" />
                    </div>
                    <span className="dw-meta">
                        <span className="dw-badge dw-badge-webp">WEBP</span>
                        <span>412 KB</span>
                    </span>
                </div>

                {/* Wave / arrow */}
                <div className="dw-arrow">
                    <span className="dw-wave dw-wave-1" />
                    <span className="dw-wave dw-wave-2" />
                    <span className="dw-wave dw-wave-3" />
                    <span className="dw-arrow-head">↺</span>
                </div>

                {/* Original photo (right, expanding back) */}
                <div className="dw-card dw-card-out">
                    <div className="dw-photo dw-photo-orig">
                        <span className="dw-sun" />
                    </div>
                    <span className="dw-meta">
                        <span className="dw-badge dw-badge-jpg">JPG</span>
                        <span>1.24 MB</span>
                    </span>
                    <span className="dw-shield" title="Original — never deleted">🛡</span>
                </div>
            </div>

            <span className="dw-tag">Originals never touched</span>

            <style>{dwCss}</style>
        </div>
    );
}

const dwCss = `
.dw-stage {
    position: absolute; inset: 0;
    display: grid;
    grid-template-columns: 1fr 80px 1fr;
    gap: 8px; padding: 14px 16px;
    align-items: center;
}
.dw-card {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    position: relative;
}
.dw-card-in  { animation: dwIn 3s ease-in-out infinite; }
.dw-card-out { animation: dwOut 3s ease-in-out infinite; }
@keyframes dwIn  {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.35; transform: scale(0.92); filter: grayscale(0.4); }
}
@keyframes dwOut {
    0%, 30% { opacity: 0.6; transform: scale(0.92); }
    65%, 100% { opacity: 1; transform: scale(1); }
}
.dw-photo {
    position: relative;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid rgba(0,0,0,0.08);
    background: linear-gradient(180deg, #f9c47a, #d8845a 55%, #5a2e16);
}
.dw-photo-small { width: 50px; height: 36px; }
.dw-photo-orig  { width: 64px; height: 44px; }
.dw-sun {
    position: absolute; top: 5px; right: 8px;
    width: 12px; height: 12px;
    background: radial-gradient(#fff5c6, transparent 70%);
    border-radius: 50%;
}
.dw-meta {
    display: inline-flex; gap: 4px; align-items: center;
    font: 600 9px ui-monospace, monospace;
}
.dw-badge      { padding: 1px 4px; border-radius: 2px; letter-spacing: 0.04em; font-weight: 700; }
.dw-badge-webp { background: #d1fae5; color: #047857; }
.dw-badge-jpg  { background: #fee2e2; color: #b91c1c; }
.dw-shield     { position: absolute; top: -6px; right: -8px; font-size: 12px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2)); }

.dw-arrow { position: relative; height: 56px; display: grid; place-items: center; }
.dw-wave {
    position: absolute;
    width: 60px;
    height: 22px;
    border: 2px solid #f59e0b;
    border-radius: 50%;
    border-color: #f59e0b transparent transparent transparent;
    top: 50%; left: 50%;
    transform-origin: center;
    transform: translate(-50%, -50%);
    opacity: 0;
}
.dw-wave-1 { animation: dwWave 2s ease-out infinite; animation-delay: 0s; }
.dw-wave-2 { animation: dwWave 2s ease-out infinite; animation-delay: 0.5s; }
.dw-wave-3 { animation: dwWave 2s ease-out infinite; animation-delay: 1s; }
@keyframes dwWave {
    0%   { transform: translate(-50%, -50%) scale(0.4); opacity: 0.9; }
    100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
}
.dw-arrow-head {
    position: relative;
    z-index: 2;
    color: #d97706;
    font-size: 22px;
    font-weight: 700;
    background: white;
    width: 28px; height: 28px;
    border-radius: 50%;
    display: grid; place-items: center;
    border: 1.5px solid #f59e0b;
    box-shadow: 0 2px 4px rgba(245, 158, 11, 0.25);
}
.dw-tag {
    position: absolute;
    bottom: 6px; left: 50%;
    transform: translateX(-50%);
    font-family: ui-monospace, monospace;
    font-size: 9.5px;
    color: #92400e;
    background: rgba(255, 251, 235, 0.9);
    padding: 1px 8px;
    border-radius: 999px;
    border: 1px solid rgba(245, 158, 11, 0.3);
}
@media (prefers-reduced-motion: reduce) {
    .dw-card-in, .dw-card-out, .dw-wave { animation: none !important; opacity: 1 !important; transform: translate(-50%, -50%) !important; }
}
`;

/**
 * FilesStream — horizontal scrolling tape of fake/real file cards. Used as
 * a "live processing feed" during bulk runs to give a sense of motion
 * beyond the progress ring.
 */
export function FilesStream({ count = 12, kind = "compress" }: { count?: number; kind?: "compress" | "restore" }) {
    const names = ["sunset.jpg", "portrait.png", "product-01.jpg", "hero-bg.png", "team-photo.jpg", "logo-mark.png", "banner-spring.jpg", "icon-set.png", "cover-issue.jpg", "thumb-card.jpg", "feature.png", "homepage-hero.jpg"];
    const items = Array.from({ length: count }, (_, i) => names[i % names.length]);
    const isCompress = kind === "compress";
    return (
        <div className="fs-strip" aria-hidden>
            <div className="fs-track">
                {[...items, ...items].map((name, i) => (
                    <div key={i} className={`fs-card ${isCompress ? "fs-card-c" : "fs-card-r"}`}>
                        <div className="fs-thumb" />
                        <div className="fs-info">
                            <div className="fs-name">{name}</div>
                            <div className="fs-sub">
                                {isCompress
                                    ? <><span className="fs-old">1.2 MB</span> → <span className="fs-new">412 KB</span></>
                                    : <><span className="fs-rm">.webp removed</span></>}
                            </div>
                        </div>
                        {isCompress
                            ? <span className="fs-tick">✓</span>
                            : <span className="fs-x">↺</span>}
                    </div>
                ))}
            </div>
            <style>{`
                .fs-strip {
                    overflow: hidden;
                    width: 100%;
                    mask-image: linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%);
                    -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%);
                }
                .fs-track {
                    display: flex; gap: 8px;
                    width: max-content;
                    animation: fsScroll 22s linear infinite;
                }
                @keyframes fsScroll { to { transform: translateX(-50%); } }
                .fs-card {
                    display: flex; align-items: center; gap: 8px;
                    padding: 6px 10px 6px 6px;
                    border-radius: 8px;
                    background: white;
                    border: 1px solid rgb(229 231 235);
                    box-shadow: 0 1px 2px rgba(0,0,0,0.04);
                    min-width: 180px;
                    flex-shrink: 0;
                }
                .fs-card-c { border-left: 3px solid #10b981; }
                .fs-card-r { border-left: 3px solid #f59e0b; }
                .fs-thumb {
                    width: 28px; height: 28px;
                    border-radius: 4px;
                    background: linear-gradient(135deg, #f9c47a, #d8845a, #5a2e16);
                    flex-shrink: 0;
                }
                .fs-info { min-width: 0; flex: 1; }
                .fs-name { font: 600 11px ui-sans-serif, system-ui; color: #1f2937; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .fs-sub  { font: 400 10px ui-monospace, monospace; color: #6b7280; }
                .fs-old  { color: #9ca3af; text-decoration: line-through; }
                .fs-new  { color: #059669; font-weight: 600; }
                .fs-rm   { color: #d97706; font-style: italic; }
                .fs-tick { color: #10b981; font-weight: 700; font-size: 14px; }
                .fs-x    { color: #f59e0b; font-weight: 700; font-size: 14px; }
                @media (prefers-reduced-motion: reduce) {
                    .fs-track { animation: none; }
                }
            `}</style>
        </div>
    );
}

export function Tabs<T extends string>({ value, onChange, items }: {
    value: T;
    onChange: (v: T) => void;
    items: { value: T; label: string; icon?: ReactNode }[];
}) {
    return (
        <nav className="flex flex-col gap-0.5" aria-label="Sections">
            {items.map((it) => (
                <button
                    key={it.value}
                    onClick={() => onChange(it.value)}
                    className={clsx(
                        "flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-medium text-left transition",
                        value === it.value
                            ? "bg-brand-50 text-brand-700"
                            : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
                    )}
                >
                    {it.icon}
                    <span>{it.label}</span>
                </button>
            ))}
        </nav>
    );
}
