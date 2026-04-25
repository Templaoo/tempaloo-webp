import { DocPage, Section, P, H3, Pre, Callout, Mockup, AdminUploadRow } from "@/components/docs/Doc";

export const metadata = {
    title: "New features — Tempaloo WebP Docs",
    description: "Compression stats, restore originals, resize on upload, quality presets — what shipped in v0.4.0+.",
};

export default function FeaturesPage() {
    return (
        <DocPage
            eyebrow="DOCUMENTATION · FEATURES"
            title="New features"
            lead="Four features shipped in v0.4.x that close the parity gap with Imagify and ShortPixel and add a few touches that go beyond. All visible in your WP admin, no extra setup."
        >
            {/* ─── Stats ─────────────────────────────────────────── */}
            <Section id="stats" title="Compression stats — every uploaded image">
                <P>
                    The moment an upload finishes on <code>/wp-admin/media-new.php</code>, a stats line appears
                    right under the filename — no need to click <strong>Edit</strong> to see what just happened.
                </P>

                <Mockup chrome="browser" url="wp-admin / media-new.php">
                    <AdminUploadRow
                        filename="dreamstime_xxl_367422651.jpg"
                        sizes={7}
                        oldSize="1.24 MB"
                        newSize="412 KB"
                        savedPct={67}
                    />
                </Mockup>

                <P>The same data is visible in three other places:</P>
                <ul>
                    <li><strong>Media Library list view</strong> — a new <em>Optimized</em> column with the saved % and before/after sizes.</li>
                    <li><strong>Attachment edit modal</strong> — a green stats block in the right sidebar.</li>
                    <li><strong>Block editor / Gutenberg</strong> — every <code>attachment</code> object now carries a <code>tempaloo</code> field readable by any custom block.</li>
                </ul>

                <Callout kind="tip" title="No data costs">
                    Stats are computed by reading the file sizes of the <code>.webp</code> /
                    <code>.avif</code> siblings on disk — a <code>filesize()</code> call. Zero API
                    round-trips, zero storage, zero quota.
                </Callout>
            </Section>

            {/* ─── Restore ───────────────────────────────────────── */}
            <Section id="restore" title="Restore originals — one click, no risk">
                <P>
                    Found in <strong>Tempaloo WebP → Settings</strong>, at the bottom: a button that wipes every
                    <code>.webp</code> / <code>.avif</code> sibling we ever wrote.
                </P>

                <Mockup chrome="browser" url="wp-admin / admin.php?page=tempaloo-webp">
                    <div style={{ padding: "16px", background: "var(--bg)" }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", marginBottom: 4 }}>Restore originals</div>
                        <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 14, lineHeight: 1.5 }}>
                            One-click delete of every .webp/.avif file we generated. Your original JPEG/PNG/GIF files are never touched and remain on the server.
                        </div>
                        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                            <button style={{ padding: "8px 14px", borderRadius: 6, background: "var(--bg-2)", border: "1px solid var(--line-2)", color: "var(--ink)", fontSize: 13, cursor: "pointer" }}>
                                Restore (847 images)
                            </button>
                            <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Safe: only the converted siblings are removed.</span>
                        </div>
                    </div>
                </Mockup>

                <H3>What gets deleted</H3>
                <ul>
                    <li>Every <code>.webp</code> file matching <code>{`{filename}.{ext}.webp`}</code> in your uploads folder.</li>
                    <li>Every <code>.avif</code> file similarly.</li>
                    <li>The <code>tempaloo_webp</code> meta block on each attachment.</li>
                </ul>

                <H3>What stays untouched</H3>
                <ul>
                    <li><strong>Your originals</strong> (<code>.jpg</code>, <code>.png</code>, <code>.gif</code>) — never written, never deleted.</li>
                    <li>Your monthly quota — restoring doesn't refund credits because the work was already done.</li>
                </ul>

                <Callout kind="info" title="Reversible by design">
                    After restoring, you can re-run a Bulk conversion to regenerate the
                    <code>.webp</code> files with new settings (different quality, different
                    format). It's a clean reset, not a destruction.
                </Callout>
            </Section>

            {/* ─── Resize ────────────────────────────────────────── */}
            <Section id="resize" title="Resize on upload — shrink huge photos automatically">
                <P>
                    Most photos uploaded by editors are 4000–8000 px wide — way more than any browser will ever display.
                    Resize-on-upload caps the width before WordPress generates thumbnails, saving disk space, conversion
                    quota, and outbound bandwidth.
                </P>

                <Mockup chrome="browser" url="wp-admin / admin.php?page=tempaloo-webp">
                    <div style={{ padding: "16px", background: "var(--bg)" }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", marginBottom: 4 }}>Resize on upload</div>
                        <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 14, lineHeight: 1.5 }}>
                            Shrink huge photos down to a sensible web width before WordPress generates thumbnails.
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, maxWidth: 360 }}>
                            {["Off", "1920", "2560", "3840"].map((label, i) => (
                                <div key={label} style={{
                                    padding: "8px 4px", textAlign: "center",
                                    border: "1px solid " + (i === 2 ? "var(--ink)" : "var(--line-2)"),
                                    background: i === 2 ? "var(--bg-2)" : "var(--bg)",
                                    color: "var(--ink)", borderRadius: 8, fontSize: 13, fontWeight: 500,
                                }}>
                                    {label}{label !== "Off" && <span style={{ fontSize: 10, color: "var(--ink-3)", marginLeft: 2 }}>px</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                </Mockup>

                <H3>How it works</H3>
                <P>
                    The plugin hooks into WordPress core's <code>big_image_size_threshold</code> filter (added in WP 5.3).
                    When a user uploads an image wider than the threshold, WP automatically scales it down and saves the
                    untouched original as <code>{`{filename}-scaled-original.{ext}`}</code> for safekeeping.
                </P>

                <Callout kind="tip" title="Default 2560 px is right for most sites">
                    On a 4K display the largest image you'll ever render is around 2560 px wide.
                    Going higher just bloats your storage. Pick 3840 only if you serve real Retina /
                    print assets.
                </Callout>
            </Section>

            {/* ─── Presets ───────────────────────────────────────── */}
            <Section id="presets" title="Quality presets — three buttons covering 95% of cases">
                <P>
                    The quality slider is still there for power users. But picking <em>72</em> vs <em>78</em> isn't
                    a decision most users want to make. Three named presets do the work:
                </P>

                <Mockup chrome="browser" url="wp-admin / admin.php?page=tempaloo-webp">
                    <div style={{ padding: "16px", background: "var(--bg)" }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", marginBottom: 8 }}>Compression preset</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, maxWidth: 480 }}>
                            {[
                                { name: "Normal", q: 85, hint: "Visually identical, ~50% smaller" },
                                { name: "Aggressive", q: 75, hint: "Indistinguishable on web, ~65% smaller" },
                                { name: "Ultra", q: 60, hint: "Smallest files, slight artifacts" },
                            ].map((p, i) => (
                                <div key={p.name} style={{
                                    padding: 12, borderRadius: 8,
                                    border: "1px solid " + (i === 0 ? "var(--ink)" : "var(--line-2)"),
                                    background: i === 0 ? "var(--bg-2)" : "var(--bg)",
                                }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{p.name}</div>
                                    <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2, lineHeight: 1.3 }}>{p.hint}</div>
                                    <div style={{ fontSize: 10, fontFamily: "var(--font-geist-mono)", color: "var(--ink-3)", marginTop: 6 }}>q={p.q}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </Mockup>

                <H3>What each preset means</H3>
                <ul>
                    <li><strong>Normal (q=85)</strong> — visually identical to the original on any monitor. Use for portfolios, photography sites, anything where image quality is part of the product.</li>
                    <li><strong>Aggressive (q=75)</strong> — the default, recommended for blogs, news sites, e-commerce. Indistinguishable from the original at typical viewing distances.</li>
                    <li><strong>Ultra (q=60)</strong> — 30%+ smaller than Aggressive. You'll start to see banding on gradients, but typical photos still look fine. Use on landing pages where speed beats fidelity.</li>
                </ul>

                <Callout kind="info" title="Per-attachment override">
                    Need a different quality for one specific image? Use the
                    <code>tempaloo_quality_for</code> filter — see <a href="/docs/hooks#quality">Developer hooks</a>.
                </Callout>
            </Section>
        </DocPage>
    );
}
