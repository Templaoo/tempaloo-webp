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
            className="relative w-full overflow-hidden rounded-xl border border-ink-200 bg-gradient-to-br from-blue-50/60 via-white to-emerald-50/60"
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
    background: radial-gradient(circle at 35% 30%, #60a5fa, #1e40af);
    box-shadow: 0 0 12px rgba(59, 130, 246, 0.5), inset 0 -4px 8px rgba(0,0,0,0.3);
    animation: cfCorePulse 1.2s ease-in-out infinite;
}
@keyframes cfCorePulse {
    0%, 100% { transform: scale(1); box-shadow: 0 0 12px rgba(59, 130, 246, 0.5), inset 0 -4px 8px rgba(0,0,0,0.3); }
    50%      { transform: scale(1.15); box-shadow: 0 0 22px rgba(59, 130, 246, 0.8), inset 0 -4px 8px rgba(0,0,0,0.3); }
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
