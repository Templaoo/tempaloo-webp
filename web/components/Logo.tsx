/**
 * Tempaloo logo system.
 *
 * All marks use `currentColor` so they follow the parent's text color
 * (via our light/dark theme tokens). Give the mark a `color: var(--ink)`
 * from its wrapper and the logo adapts automatically.
 *
 * Variants:
 *   - "slash" (default)  — bold T with a diagonal cut on the top-left
 *                          of the crossbar. Strongest character.
 *   - "outline"          — hollow T with an inner stroke. Editorial feel.
 *   - "block"            — clean geometric T. Timeless.
 *
 * Use cases:
 *   - <LogoMark size={24} />          icon / favicon size
 *   - <LogoWordmark />                logo + "Tempaloo" text (nav)
 *   - <LogoWordmark showProduct />    "Tempaloo / WebP" (product pages)
 */

type Variant = "slash" | "outline" | "block";

export function LogoMark({
    size = 24,
    variant = "slash",
    className,
    ariaLabel = "Tempaloo",
}: {
    size?: number;
    variant?: Variant;
    className?: string;
    ariaLabel?: string;
}) {
    const common = {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        xmlns: "http://www.w3.org/2000/svg",
        role: "img" as const,
        "aria-label": ariaLabel,
        className,
    };

    if (variant === "outline") {
        // Outlined T with a hollow inner line. Stroke is 1.5 so it stays
        // crisp from 16 px to 128 px. No fill — truly theme-neutral.
        return (
            <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                {/* outer T */}
                <path d="M4 5.5 H20 V8.5 H13.5 V19 H10.5 V8.5 H4 Z" />
                {/* inner accent — the defining detail */}
                <path d="M7 7 H17 M12 9.5 V17" strokeLinecap="round" />
            </svg>
        );
    }

    if (variant === "block") {
        // Clean geometric T built from two rounded rectangles.
        // Monolithic — works down to 16 px without visual noise.
        return (
            <svg {...common} fill="currentColor">
                <rect x="3" y="4" width="18" height="5" rx="1" />
                <rect x="10" y="9" width="4" height="12" rx="1" />
            </svg>
        );
    }

    // Default: "slash" — bold T with a diagonal chamfer cut on the
    // top-left corner. Single closed path, no evenodd needed.
    return (
        <svg {...common} fill="currentColor">
            <path d="M4 7 L7 4 L20 4 L20 9 L14 9 L14 20 L10 20 L10 9 L4 9 Z" />
        </svg>
    );
}

export function LogoWordmark({
    size = 22,
    variant = "slash",
    showProduct = false,
    productName = "WebP",
    className,
}: {
    size?: number;
    variant?: Variant;
    showProduct?: boolean;
    productName?: string;
    className?: string;
}) {
    return (
        <span
            className={className}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                color: "inherit",
                lineHeight: 1,
            }}
        >
            <LogoMark size={size} variant={variant} />
            <span
                style={{
                    fontWeight: 500,
                    fontSize: 14.5,
                    letterSpacing: "-0.015em",
                    color: "var(--ink)",
                }}
            >
                Tempaloo
                {showProduct && (
                    <span style={{ color: "var(--ink-3)" }}> / {productName}</span>
                )}
            </span>
        </span>
    );
}
