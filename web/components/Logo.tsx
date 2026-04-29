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
    size = 32,
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
        // Canonical brand mark — synced with /public/favicon.svg.
        // The viewBox crops to the glyph's bounding box (300,540 →
        // 1820,1500) so the same `size={N}` callers pass actually
        // fills N pixels — instead of N×0.6 because of the empty
        // padding in the source 2048×2048 canvas.
        // currentColor inherits the parent's CSS color, so the mark
        // adapts to light + dark themes without branching.
        return (
            <svg
                width={size}
                height={size}
                viewBox="300 540 1520 960"
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                aria-label={ariaLabel}
                className={className}
            >
                <path
                    fill="currentColor"
                    transform="translate(338,570)"
                    d="m0 0h345l36 3 38 5 26 5 24 6 31 10 21 8 28 12 24 12 18 10 23 14 16 11 19 14 16 13 13 11 15 14 12 11 18 18 7 8 1 3h2l9 11 9 10 14 19 12 16 12 19 15 25 12 23 7 14 13 31 10 28 8 26 9 39 5 30 3 26 2 32v35l-2 30-4 31-7 36-8 30-11 33-11 27-14 32-16 34-13 28-14 30-11 24-1 1h-395l3-9 17-35 13-28 19-40 28-60 16-34 13-28 16-34 13-28 32-68 13-28 13-27 11-24 19-40 14-30 10-22 11-22h-422l-4-4-10-17-12-21-13-22-14-24-15-26-10-17-15-26-8-13-9-16-10-17-15-26-11-18-13-23-8-13-12-21-10-17-10-18-6-10z"
                />
                <path
                    fill="currentColor"
                    transform="translate(1112,570)"
                    d="m0 0h394l6 9 12 21 7 12 8 13 16 28 17 29 16 27 14 24 13 23 8 13 12 20 11 20 28 48 13 22 16 28 6 11v3h-215l-24-2-29-5-20-5-25-8-22-9-28-14-18-11-18-13-13-10-11-10-8-7-18-18-9-11-11-13-13-18-11-18-16-28-10-17-16-28-8-13-8-14-10-17-13-22-10-17-11-19z"
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
