"use client";
import { useState } from "react";
import clsx from "clsx";

const ITEMS = [
    {
        q: "Do you charge per thumbnail like ShortPixel or Elementor?",
        a: "No — and that's the main reason people switch. WordPress generates 6-8 thumbnails for every image you upload. ShortPixel, Imagify, Elementor Image Optimizer count each of those as a separate credit. We count the upload itself: 1 image uploaded = 1 credit, no matter how many sizes WordPress creates. In practice you get 6-8× more conversions for the same price.",
    },
    {
        q: "Do I need Elementor, Gutenberg or any specific page builder?",
        a: "No. Our plugin is a standalone WordPress plugin — it works with Gutenberg, Elementor, Bricks, Divi, Beaver Builder, classic editor, WooCommerce, and any theme. You are never locked into an ecosystem.",
    },
    {
        q: "What happens to my unused images at the end of the month?",
        a: "They roll over automatically for 30 days, capped at one month's worth of your plan. Example: on Starter (5 000/mo), if you only use 2 000 in March, April opens at 8 000 available (5 000 new + 3 000 rolled over). No more \"use it or lose it\".",
    },
    {
        q: "What happens if I hit my quota?",
        a: "New uploads simply stop being converted until the next month's quota resets, or until you upgrade in one click. Images already optimized keep being served as WebP — nothing breaks.",
    },
    {
        q: "Do you keep my images?",
        a: "No. Conversion happens in-memory and the converted file is streamed back to your site. Originals stay on your server, untouched. We are not a storage service.",
    },
    {
        q: "Can I cancel anytime? What about refunds?",
        a: "Cancel any day, in one click, no penalty. All paid plans include a 7-day free trial and a 30-day money-back guarantee. (Some competitors explicitly state their plans are \"non-refundable\" — we don't play that game.)",
    },
    {
        q: "Do you support AVIF?",
        a: "Yes, on Starter and above. AVIF produces ~20% smaller files than WebP at equivalent quality and is supported by every major modern browser.",
    },
];

export function FAQ() {
    const [open, setOpen] = useState<number | null>(0);
    return (
        <div className="divide-y divide-white/10 glass rounded-2xl overflow-hidden">
            {ITEMS.map((it, i) => (
                <div key={i}>
                    <button
                        onClick={() => setOpen(open === i ? null : i)}
                        className="w-full flex items-start justify-between gap-4 px-6 py-5 text-left hover:bg-white/5 transition"
                        aria-expanded={open === i}
                    >
                        <span className="text-sm font-medium text-white">{it.q}</span>
                        <svg
                            className={clsx("shrink-0 mt-0.5 transition", open === i ? "rotate-180" : "")}
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>
                    {open === i && (
                        <div className="px-6 pb-5 text-sm text-white/70 leading-relaxed">{it.a}</div>
                    )}
                </div>
            ))}
        </div>
    );
}
