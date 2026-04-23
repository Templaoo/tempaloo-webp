"use client";
import clsx from "clsx";

export type Billing = "monthly" | "annual";

export function BillingToggle({ value, onChange }: { value: Billing; onChange: (v: Billing) => void }) {
    return (
        <div className="inline-flex items-center gap-2 rounded-full glass p-1" role="tablist" aria-label="Billing cycle">
            <ToggleBtn active={value === "monthly"} onClick={() => onChange("monthly")}>
                Monthly
            </ToggleBtn>
            <ToggleBtn active={value === "annual"} onClick={() => onChange("annual")}>
                <span>Annual</span>
                <span
                    className={clsx(
                        "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                        value === "annual" ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/80",
                    )}
                >
                    −20%
                </span>
            </ToggleBtn>
        </div>
    );
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            role="tab"
            aria-selected={active}
            className={clsx(
                "relative inline-flex h-9 items-center gap-1 rounded-full px-4 text-sm font-medium transition",
                active ? "bg-white text-ink-950 shadow-pop" : "text-white/70 hover:text-white",
            )}
        >
            {children}
        </button>
    );
}
