import Link from "next/link";
import { TrustRow } from "@/components/pricing/TrustRow";

export const metadata = {
    title: "Tempaloo WebP – Image Optimizer & AVIF Converter for WordPress",
    description:
        "Convert your WordPress images to WebP and AVIF automatically. 30-70% lighter pages, no setup.",
};

export default function WebPLanding() {
    return (
        <main className="mx-auto max-w-6xl px-6 py-16 md:py-24 space-y-20">
            <nav className="flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2.5">
                    <span className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                        T
                    </span>
                    <span className="text-sm font-semibold text-white/90">Tempaloo WebP</span>
                </Link>
                <div className="flex items-center gap-4 text-sm">
                    <a href="https://wordpress.org/plugins/tempaloo-webp/" className="text-white/60 hover:text-white">
                        WordPress.org
                    </a>
                    <Link
                        href="/webp/activate"
                        className="rounded-lg bg-white text-ink-950 px-3 py-1.5 font-medium hover:bg-white/90"
                    >
                        Get started
                    </Link>
                </div>
            </nav>

            <section className="text-center rise">
                <span className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-white/70">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    WordPress 6.0+ · PHP 7.4+ · All major browsers
                </span>
                <h1 className="mt-6 text-5xl md:text-7xl font-bold tracking-tight leading-[1.02]">
                    <span className="text-white">Faster sites,</span>
                    <br />
                    <span className="text-gradient">one upload at a time.</span>
                </h1>
                <p className="mt-6 text-lg text-white/70 max-w-2xl mx-auto">
                    Install the plugin, generate a key, and every image on your WordPress site becomes 30-70% lighter —
                    in <strong className="text-white">WebP</strong> and <strong className="text-white">AVIF</strong>.
                </p>
                <div className="mt-10 flex flex-col sm:flex-row justify-center gap-3">
                    <Link
                        href="/webp/activate"
                        className="h-12 px-6 rounded-xl bg-gradient-to-r from-brand-500 to-purple-500 text-white font-semibold flex items-center justify-center glow"
                    >
                        Start free — 150 images/mo
                    </Link>
                    <Link
                        href="/webp/activate?plan=growth"
                        className="h-12 px-6 rounded-xl glass text-white font-medium flex items-center justify-center hover:bg-white/5"
                    >
                        See pricing →
                    </Link>
                </div>
            </section>

            <section className="rise rise-delay-1">
                <TrustRow />
            </section>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 rise rise-delay-2">
                {[
                    {
                        h: "Automatic",
                        p: "New uploads are optimized the moment they land in your media library. Existing ones — bulk convert with one click.",
                    },
                    {
                        h: "Safe by default",
                        p: "Originals stay untouched. Optimized versions are served only to browsers that support them, with a clean fallback.",
                    },
                    {
                        h: "Simple pricing",
                        p: "1 credit per image. All thumbnail sizes included. No visit counting, no per-megabyte trick, no surprise bills.",
                    },
                ].map((f) => (
                    <div key={f.h} className="glass rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-white">{f.h}</h3>
                        <p className="mt-2 text-sm text-white/70 leading-relaxed">{f.p}</p>
                    </div>
                ))}
            </section>

            <section className="text-center rise rise-delay-3">
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">Ready to ship lighter pages?</h2>
                <p className="mt-3 text-white/60">Start free. Upgrade when you grow.</p>
                <div className="mt-8">
                    <Link
                        href="/webp/activate"
                        className="inline-flex h-12 px-6 rounded-xl bg-gradient-to-r from-brand-500 to-purple-500 text-white font-semibold items-center glow"
                    >
                        Pick a plan →
                    </Link>
                </div>
            </section>

            <footer className="text-center text-xs text-white/40 pt-10 border-t border-white/5">
                © {new Date().getFullYear()} Tempaloo. Made for WordPress creators.
            </footer>
        </main>
    );
}
