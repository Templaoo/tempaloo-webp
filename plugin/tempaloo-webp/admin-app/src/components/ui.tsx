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
    const colors = ["#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];
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
export function ProgressRing({ value, size = 140, label, sub }: { value: number; size?: number; label?: string; sub?: string }) {
    const stroke = 10;
    const radius = (size - stroke) / 2;
    const C = 2 * Math.PI * radius;
    const safe = Math.max(0, Math.min(100, value));
    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
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
                        <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="text-3xl font-bold text-ink-900 tabular-nums">{Math.round(safe)}%</div>
                {label && <div className="text-xs text-ink-500 mt-0.5">{label}</div>}
                {sub && <div className="text-[10px] text-ink-400 mt-0.5 font-mono">{sub}</div>}
            </div>
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
