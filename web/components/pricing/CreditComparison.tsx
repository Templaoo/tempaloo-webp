export function CreditComparison() {
    return (
        <div className="glass-strong rounded-2xl p-6 md:p-10">
            <div className="text-center max-w-2xl mx-auto">
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/15 text-brand-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider">
                    The thumbnail trap
                </span>
                <h3 className="mt-4 text-2xl md:text-3xl font-bold text-white tracking-tight">
                    One upload = <span className="text-gradient">one credit.</span>
                </h3>
                <p className="mt-3 text-white/70 text-sm md:text-base">
                    WordPress quietly generates 6 to 8 thumbnail sizes for every image you upload.
                    Most optimizers count each of those as a separate credit. We don't.
                </p>
            </div>

            <div className="mt-8 grid md:grid-cols-2 gap-4">
                <Column
                    title="ShortPixel · Imagify · Elementor"
                    subtitle="1 upload × 6 sizes"
                    result="6 credits consumed"
                    tone="red"
                    thumbs={["Full", "1536", "1024", "768", "300", "150"]}
                    fills={[true, true, true, true, true, true]}
                />
                <Column
                    title="Tempaloo WebP"
                    subtitle="1 upload, all sizes bundled"
                    result="1 credit consumed"
                    tone="brand"
                    thumbs={["Full", "1536", "1024", "768", "300", "150"]}
                    fills={[true, false, false, false, false, false]}
                    highlight
                />
            </div>

            <p className="mt-6 text-center text-xs text-white/50">
                On a typical media library of 1 000 uploads, that's the difference between paying for
                <span className="text-white/80 font-semibold"> 6 000 credits</span> vs
                <span className="text-emerald-300 font-semibold"> 1 000 credits</span>.
            </p>
        </div>
    );
}

function Column({
    title,
    subtitle,
    result,
    tone,
    thumbs,
    fills,
    highlight,
}: {
    title: string;
    subtitle: string;
    result: string;
    tone: "red" | "brand";
    thumbs: string[];
    fills: boolean[];
    highlight?: boolean;
}) {
    const border = highlight ? "border-brand-400/40 ring-1 ring-brand-400/20" : "border-white/10";
    const resultClass = tone === "red" ? "text-rose-300" : "text-emerald-300";
    const dotClass = tone === "red" ? "bg-rose-400/80" : "bg-emerald-400/80";
    return (
        <div className={`rounded-xl border ${border} bg-white/[0.02] p-5`}>
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-sm font-semibold text-white">{title}</div>
                    <div className="text-xs text-white/50">{subtitle}</div>
                </div>
                <span className={`text-sm font-bold ${resultClass}`}>{result}</span>
            </div>
            <div className="mt-4 grid grid-cols-6 gap-1.5">
                {thumbs.map((t, i) => (
                    <div key={t} className="flex flex-col items-center gap-1">
                        <div
                            className={`w-full aspect-square rounded-md border border-white/10 relative overflow-hidden`}
                            style={{
                                background: fills[i]
                                    ? "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))"
                                    : "rgba(255,255,255,0.02)",
                            }}
                        >
                            {fills[i] && <span className={`absolute top-1 right-1 h-1.5 w-1.5 rounded-full ${dotClass}`} />}
                        </div>
                        <span className="text-[9px] uppercase tracking-wider text-white/40">{t}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
