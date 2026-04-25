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
        // Canonical brand mark — the geometric T from /public/favicon.svg
        // with its background rectangle stripped and the fill swapped to
        // currentColor so it adapts to light + dark themes. The viewBox
        // matches the path's `translate(334, 334)` origin and the figure's
        // bounding box (it ends near 1714, 1714 in the 2048 canvas).
        return (
            <svg
                width={size}
                height={size}
                viewBox="334 334 1380 1380"
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                aria-label={ariaLabel}
                className={className}
            >
                <path
                    fill="currentColor"
                    transform="translate(334,334)"
                    d="m0 0h29l25 2 36 6 30 7 37 12 29 12 29 14 24 14 24 16 16 12 16 13 11 9 7 7 8 7 15 15 7 8 13 15 13 17 13 18 12 19 12 21 9 17 13 30 10 27 9 31 7 34 5 36 1 14 3-34 6-35 8-32 12-36 13-30 8-16 10-19 12-19 10-15 12-16 8-10 12-14 7-8 12-13 5-5h2v-2l8-7 14-13 28-22 27-18 15-9 24-13 21-10 28-11 30-10 33-8 36-6 27-2h489v461l-875 1 30 4 31 6 26 7 27 9 29 12 32 16 20 12 22 15 16 12 10 8 13 11 13 12 27 27 9 11 12 14 14 19 18 27 14 26 14 28 9 24 10 30 7 27 6 29 4 28 2 26v478h-460v-919h-460z"
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
