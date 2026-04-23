import clsx from "clsx";
import { useEffect, useState } from "react";
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

/** Very small toast system — just enough for success/error feedback. */
let toastSubs: ((t: ToastItem) => void)[] = [];
export interface ToastItem { id: string; kind: "success" | "error" | "info"; text: string }
export function toast(kind: ToastItem["kind"], text: string) {
    const id = Math.random().toString(36).slice(2);
    toastSubs.forEach((fn) => fn({ id, kind, text }));
}
export function Toasts() {
    const [items, setItems] = useState<ToastItem[]>([]);
    useEffect(() => {
        const h = (t: ToastItem) => {
            setItems((cur) => [...cur, t]);
            setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== t.id)), 4000);
        };
        toastSubs.push(h);
        return () => { toastSubs = toastSubs.filter((f) => f !== h); };
    }, []);
    return (
        <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-[100000]">
            {items.map((t) => (
                <div
                    key={t.id}
                    className={clsx(
                        "rounded-lg shadow-pop px-4 py-3 text-sm max-w-sm border",
                        t.kind === "success" && "bg-emerald-50 border-emerald-200 text-emerald-900",
                        t.kind === "error"   && "bg-red-50 border-red-200 text-red-900",
                        t.kind === "info"    && "bg-ink-50 border-ink-200 text-ink-900",
                    )}
                    role="status"
                >
                    {t.text}
                </div>
            ))}
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
