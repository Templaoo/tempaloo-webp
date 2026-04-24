/**
 * Tempaloo logo system.
 *
 * All marks use `currentColor` so they follow the parent's text color
 * (via our light/dark theme tokens). Give the mark a `color: var(--ink)`
 * from its wrapper and the logo adapts automatically.
 *
 * Variants:
 *   - "brand" (default)  — the full brand mark (two-tone T, derived from
 *                          the canonical tempaloo-logo.svg). Adapts to
 *                          theme: solid in currentColor, accent at 35%.
 *   - "slash"            — bold T with a diagonal chamfer on the top-left.
 *                          Compact alternative, single-tone.
 *   - "outline"          — hollow T with an inner stroke. Editorial feel.
 *   - "block"            — clean geometric T. Timeless.
 *
 * Use cases:
 *   - <LogoMark size={24} />          icon / favicon size
 *   - <LogoWordmark />                logo + "Tempaloo" text (nav)
 *   - <LogoWordmark showProduct />    "Tempaloo / WebP" (product pages)
 */

type Variant = "brand" | "slash" | "outline" | "block";

export function LogoMark({
    size = 24,
    variant = "brand",
    className,
    ariaLabel = "Tempaloo",
}: {
    size?: number;
    variant?: Variant;
    className?: string;
    ariaLabel?: string;
}) {
    if (variant === "brand") {
        // Canonical brand mark, derived from /public/favicon.svg. Background
        // rectangle removed, viewBox trimmed to the letterforms, the
        // blue-grey fill swapped to currentColor + the light accent kept at
        // 35% opacity — so it reads correctly in both light and dark
        // themes without a hardcoded bg behind it.
        return (
            <svg
                width={size}
                height={size}
                viewBox="390 600 1130 860"
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                aria-label={ariaLabel}
                className={className}
            >
                <g fill="currentColor">
                    <path d="m1200 621h288l-3 10-23 62-15 41-26 70-16 43-1 2-246 1-9 3-8 7-5 10-5 18-18 94-10 54-13 71-12 63-13 70-20 107-15 79-1 1-7 1h-187l-12-1 2-14 14-74 12-64 21-111 24-129 24-128 7-37 8-32 11-33 10-23 12-24 12-19 13-17 12-14 17-17 14-11 15-11 15-9 19-10 27-11 15-5 24-6 29-5z" />
                    <path d="m746 621h315l-4 2-22 8-24 12-24 16-11 9-12 11-10 10-3 1-204 1-19 4-19 8-11 7-10 8-11 11-12 16-10 18-8 18 253-1-2 9-10 30-8 29-1 1h-319l6-35 7-28 9-27 8-18 10-20 10-16 10-14 12-14 12-12 11-9 18-12 15-8 22-8 21-5z" />
                </g>
                <path
                    d="m1372 689h19l-1 6-19 51-13 34-1 1h-194l-18 2-16 5-14 7-12 9-12 12-9 14-7 15-6 18-6 28-14 74-18 95-23 122-17 90-15 80-2 7h-66l1-9 17-89 46-242 21-110 9-42 8-27 11-28 12-23 11-16 9-11 9-10 8-8 14-11 13-9 16-9 19-9 24-8 22-5 23-3z"
                    fill="currentColor"
                    opacity="0.35"
                />
            </svg>
        );
    }

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
