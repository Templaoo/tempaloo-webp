"use client";
import { useState } from "react";
import clsx from "clsx";

const ITEMS = [
    {
        q: "Does my credit count every thumbnail WordPress generates?",
        a: "No. One credit covers the original upload and every automatically-generated size. If WordPress creates 8 thumbnails for a photo, that still consumes exactly 1 credit — a big difference vs. ShortPixel or Imagify.",
    },
    {
        q: "What happens if I hit my monthly quota?",
        a: "New uploads simply stop being converted until your quota resets at the start of the next month, or until you upgrade. Images already optimized keep being served as WebP — nothing breaks.",
    },
    {
        q: "Do you keep my images?",
        a: "No. Conversion happens in-memory and the converted file is streamed right back to your site. Originals stay on your server.",
    },
    {
        q: "Can I cancel anytime?",
        a: "Yes. Cancel with one click, any day. No hidden fees. Paid plans include a 7-day free trial and a 30-day money-back guarantee.",
    },
    {
        q: "Do you support AVIF?",
        a: "Yes, on Starter and above. AVIF produces ~20% smaller files than WebP at equivalent quality and is supported by Chrome, Firefox, Edge and Safari.",
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
