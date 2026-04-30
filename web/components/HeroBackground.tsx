"use client";

/**
 * Animated mesh background — three drifting colour blobs (blue / emerald
 * / violet) on top of an SVG fractal-noise grain. Same visual language
 * as /sign-in so the brand feel is cohesive across landing, sign-in
 * and home.
 *
 * Designed to live as the FIRST child of a hero section that already
 * has `position: relative` + `overflow: hidden`. The container expands
 * itself UPWARD via `top: -120px` so it slides under a sticky / fixed
 * navbar (the navbar already has its own backdrop-filter blur, so the
 * blobs read clearly through it).
 *
 * The bottom 30% of the layer fades to transparent via a CSS
 * mask — the hero content sits crisp on top, and the gradient melts
 * into the next section's background instead of cutting hard.
 *
 * Pure CSS animations (transform / opacity) — GPU-friendly, no JS,
 * `prefers-reduced-motion` honoured.
 */
export function HeroBackground({
    /** Pixel offset above the hero where the layer starts. Use the
     *  combined nav height so the blobs reach behind it. */
    coverNavHeightPx = 80,
    /** Layer intensity. "subtle" works on dense landings, "bold" on
     *  empty hero pages where you want the gradient to breathe. */
    intensity = "subtle",
}: {
    coverNavHeightPx?: number;
    intensity?: "subtle" | "bold";
}) {
    return (
        <div
            className={`hero-bg hero-bg-${intensity}`}
            aria-hidden
            style={{ top: -coverNavHeightPx }}
        >
            <style dangerouslySetInnerHTML={{ __html: css }} />
            <div className="hero-bg-blob hero-bg-blob-1" />
            <div className="hero-bg-blob hero-bg-blob-2" />
            <div className="hero-bg-blob hero-bg-blob-3" />
            <svg
                className="hero-bg-grain"
                xmlns="http://www.w3.org/2000/svg"
                width="100%"
                height="100%"
            >
                <filter id="hero-bg-noise">
                    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
                    <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.4 0" />
                </filter>
                <rect width="100%" height="100%" filter="url(#hero-bg-noise)" />
            </svg>
        </div>
    );
}

const css = `
.hero-bg {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
    /* Bottom 30% of the layer fades out so the gradient melts into
       the section below instead of clipping hard. The mask runs
       on the layer itself, not on the children, so blobs that drift
       through the fade zone fade with the rest. */
    -webkit-mask-image: linear-gradient(to bottom, #000 70%, transparent 100%);
            mask-image: linear-gradient(to bottom, #000 70%, transparent 100%);
}

.hero-bg-blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(110px);
    mix-blend-mode: screen;
    will-change: transform;
}
[data-theme="light"] .hero-bg-blob {
    mix-blend-mode: multiply;
}

/* Subtle: lower opacity, suits content-heavy pages so the gradient
   doesn't fight readability. */
.hero-bg-subtle .hero-bg-blob { opacity: 0.42; }
[data-theme="light"] .hero-bg-subtle .hero-bg-blob { opacity: 0.22; }

.hero-bg-bold .hero-bg-blob { opacity: 0.6; }
[data-theme="light"] .hero-bg-bold .hero-bg-blob { opacity: 0.34; }

.hero-bg-blob-1 {
    width: 620px; height: 620px;
    top: -180px; left: -120px;
    background: radial-gradient(circle, #2a57e6 0%, transparent 60%);
    animation: hero-bg-drift-1 22s ease-in-out infinite alternate;
}
.hero-bg-blob-2 {
    width: 560px; height: 560px;
    bottom: -160px; right: -120px;
    background: radial-gradient(circle, #10b981 0%, transparent 60%);
    animation: hero-bg-drift-2 28s ease-in-out infinite alternate;
}
.hero-bg-blob-3 {
    width: 480px; height: 480px;
    top: 38%; left: 52%;
    background: radial-gradient(circle, #7c4dff 0%, transparent 60%);
    animation: hero-bg-drift-3 32s ease-in-out infinite alternate;
    transform: translate(-50%, -50%);
}

@keyframes hero-bg-drift-1 {
    0%   { transform: translate(0, 0) scale(1); }
    50%  { transform: translate(180px, 90px) scale(1.08); }
    100% { transform: translate(80px, 220px) scale(0.96); }
}
@keyframes hero-bg-drift-2 {
    0%   { transform: translate(0, 0) scale(1); }
    50%  { transform: translate(-160px, -110px) scale(1.06); }
    100% { transform: translate(-80px, -220px) scale(1.02); }
}
@keyframes hero-bg-drift-3 {
    0%   { transform: translate(-50%, -50%) scale(1); }
    50%  { transform: translate(-58%, -42%) scale(1.1); }
    100% { transform: translate(-46%, -54%) scale(0.94); }
}

.hero-bg-grain {
    position: absolute;
    inset: 0;
    width: 100%; height: 100%;
    opacity: 0.06;
    mix-blend-mode: overlay;
    pointer-events: none;
}
[data-theme="light"] .hero-bg-grain { opacity: 0.035; }

@media (prefers-reduced-motion: reduce) {
    .hero-bg-blob, .hero-bg-grain { animation: none !important; }
}
`;
