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
        // Canonical brand mark — synced with /public/favicon.svg
        // (logos/logo templaoo (1).svg). viewBox cropped to the
        // glyph's bounding box (3,259 → ~1330,1300) so the same
        // `size={N}` callers pass fills N pixels of width — no empty
        // padding wasted. currentColor adapts to the parent's text
        // color (light/dark themes) without branching.
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 240 1560 1080"
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                aria-label={ariaLabel}
                className={className}
            >
                <path
                    fill="currentColor"
                    transform="translate(3,259)"
                    d="m0 0h385l33 2 34 4 32 5 28 6 26 7 25 8 24 9 26 11 25 12 21 11 21 12 19 12 20 14 16 12 9 7 10 8 14 12 24 22 8 8 2 1v2h2l7 8 11 11 7 8 10 11 9 11 12 15 14 19 14 20 17 28 9 16 15 29 12 26 13 34 12 36 10 41 7 36 4 31 3 37v56l-4 44-4 27-7 34-10 37-13 38-11 27-11 25-12 26-13 28-14 30-16 34-11 24-1 1h-448l-1-2 13-28 17-35 13-28 16-34 17-36 16-34 9-20 18-38 16-34 19-41 17-36 16-34 12-26 19-40 16-34 13-28 18-38 13-28 15-31 3-8-480-1-5-6-13-22-16-28-9-15-17-29-15-26-10-17-12-21-13-22-15-26-8-13-11-20-14-23-15-26-16-27-15-26-10-17-10-18-6-11z"
                />
                <path
                    fill="currentColor"
                    transform="translate(884,259)"
                    d="m0 0h446l8 13 16 28 13 22 17 29 16 28 15 25 13 22 13 23 17 29 17 28 15 27 14 24 17 29 13 22 14 24 10 18 2 4v4h-234l-33-2-27-4-23-5-33-10-21-8-20-9-28-15-17-11-17-12-12-9-10-9-8-7-7-7-8-7-9-9-7-8-11-13-10-13-13-18-13-21-12-21-15-26-12-21-12-20-11-19-34-58-20-34z"
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
