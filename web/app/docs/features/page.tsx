import { DocPage, Section, P, H3, Pre, Callout, Mockup, AdminUploadRow } from "@/components/docs/Doc";

export const metadata = {
    title: "Features — Tempaloo WebP Docs",
    description: "Compression stats, per-image restore, async upload pipeline, Diagnostic tab, cache compatibility — every Tempaloo WebP feature explained.",
    openGraph: {
        title: "Tempaloo WebP — Features",
        description: "Per-image restore, async upload, Diagnostic tab, cache compatibility. Every feature explained with examples.",
        url: "https://tempaloo.com/docs/features",
        type: "article",
    },
    twitter: { card: "summary_large_image" },
    alternates: { canonical: "https://tempaloo.com/docs/features" },
};

export default function FeaturesPage() {
    return (
        <DocPage
            eyebrow="DOCUMENTATION · FEATURES"
            title="Features"
            lead="Everything Tempaloo WebP does, in one place. From per-upload conversion stats to the Diagnostic tab that surfaces drift between WordPress meta and disk state — every feature is visible in your WP admin without extra setup."
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
                    <code>tempaloo_webp_quality_for</code> filter — see <a href="/docs/hooks#quality">Developer hooks</a>.
                </Callout>
            </Section>

            {/* ─── Media Library actions ─────────────────────────── */}
            <Section id="media-library" title="Media Library actions — per-image control">
                <P>
                    The <strong>Optimized</strong> column on <code>/wp-admin/upload.php</code> is more than a status
                    indicator. Every row carries a complete control surface: the conversion badge, savings
                    breakdown, an expandable detail panel, and a one-click restore.
                </P>

                <Mockup chrome="browser" url="wp-admin / upload.php">
                    <div style={{ padding: "16px 18px", background: "var(--bg)" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ display: "inline-flex", alignItems: "center", height: 19, padding: "0 7px", borderRadius: 4, background: "#dcfce7", color: "#15803d", fontWeight: 700, fontSize: 10, letterSpacing: "0.05em" }}>WEBP</span>
                                <span style={{ color: "#15803d", fontWeight: 700, fontSize: 13 }}>−96%</span>
                                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-3)" }}>Detail ▾</span>
                            </div>
                            <div style={{ color: "var(--ink-3)", fontSize: 11 }}>
                                2.0 MB → <strong style={{ color: "#15803d" }}>67 KB</strong>
                            </div>
                            <div style={{ marginTop: 4 }}>
                                <button style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #d1d5db", background: "#fff", color: "#4b5563", fontSize: 11, cursor: "pointer" }}>
                                    ↻ Restore
                                </button>
                            </div>
                        </div>
                    </div>
                </Mockup>

                <H3>Per-row capabilities</H3>
                <ul>
                    <li><strong>Format badge</strong> — color-coded by output: emerald (WebP), violet (AVIF), gradient (Both).</li>
                    <li><strong>Detail accordion</strong> — expand to see per-size breakdown (original, thumbnail, medium, large…) with bytes-in / bytes-out / saved-percent for each.</li>
                    <li><strong>Convert now</strong> — for unconverted images, a one-click button that runs the full conversion (1 credit, every WP-generated size).</li>
                    <li><strong>Restore original</strong> — opens an inline confirm panel (no native browser dialog), wipes the <code>.webp</code> / <code>.avif</code> siblings, leaves your original JPEG/PNG/GIF on disk untouched.</li>
                </ul>

                <H3>Bulk row-actions</H3>
                <P>
                    The standard WordPress bulk-actions dropdown above the list view also carries our two operations:
                </P>
                <ul>
                    <li><strong>Optimize with Tempaloo</strong> — convert every selected image. Already-converted ones are skipped (no credit burn).</li>
                    <li><strong>Restore originals (Tempaloo)</strong> — restore every selected image at once.</li>
                </ul>
                <P>
                    Capped at 100 attachments per submit — beyond that, use the dedicated Bulk page with its
                    pause / resume / retry queue.
                </P>
            </Section>

            {/* ─── Async upload pipeline ─────────────────────────── */}
            <Section id="async" title="Async upload pipeline — uploads never wait on conversion">
                <P>
                    Conversion-on-upload doesn't run synchronously inside the WordPress filter chain, where it
                    would have to share the request with LiteSpeed Image Optimization, Wordfence, host security
                    scanners, and any other plugin hooked on the same filter. Instead, Tempaloo WebP captures
                    the attachment ID at upload time and dispatches a non-blocking loopback request.
                </P>

                <H3>How it works</H3>
                <ol>
                    <li>You upload an image. WordPress finishes its standard upload flow (DB insert, thumbnail generation).</li>
                    <li>The plugin enqueues the attachment ID and returns immediately. <strong>The user's upload finishes within milliseconds.</strong></li>
                    <li>On <code>shutdown</code>, a fire-and-forget <code>wp_remote_post</code> hits <code>admin-post.php</code>.</li>
                    <li>The loopback lands in a fresh PHP process and runs the conversion in isolation. No competing filter, no race condition.</li>
                    <li>Result: the converter writes <code>.webp</code> / <code>.avif</code> siblings, updates the attachment meta. The Overview "this month" counter reflects the new conversion within seconds.</li>
                </ol>

                <Callout kind="tip" title="Fallback for hosts that block loopback HTTP">
                    Some hosts (Hostinger behind aggressive WAFs, certain shared providers) block server-to-self
                    HTTP calls. Tempaloo's <strong>Diagnostic poll</strong> notices stalled pending uploads and
                    drains them inline on the next admin refresh. Worst-case, the retry-queue cron picks them
                    up within 5 minutes. You never see a missed conversion.
                </Callout>

                <H3>Emergency rollback</H3>
                <P>
                    If you need to disable the async pipeline (testing, debugging, host quirks), drop a constant
                    in <code>wp-config.php</code>:
                </P>
                <Pre lang="php" code={`define( 'TEMPALOO_WEBP_DISABLE_ASYNC', true );`} />
                <P>
                    The plugin reverts to synchronous conversion-on-upload — same behavior as v1.8.x and earlier.
                    Remove the line to switch back.
                </P>
            </Section>

            {/* ─── Diagnostic ────────────────────────────────────── */}
            <Section id="diagnostic" title="Diagnostic tab — state audit & repair">
                <P>
                    The <strong>Diagnostic</strong> tab in your WP admin is a forensics surface for "what's
                    actually going on with my images". Three tools, one place.
                </P>

                <H3>State audit</H3>
                <P>
                    Walks four sources of truth in parallel and surfaces drift between them:
                </P>
                <ul>
                    <li><strong>Filesystem</strong> — what <code>.webp</code> / <code>.avif</code> files actually exist in <code>/wp-content/uploads/</code>.</li>
                    <li><strong>Attachment meta</strong> — what the <code>_tempaloo_webp</code> post_meta key says was converted.</li>
                    <li><strong>Bulk state</strong> — the running / paused / done state of the last bulk job.</li>
                    <li><strong>Retry queue</strong> — attachments whose first conversion failed and are scheduled for cron retry.</li>
                </ul>
                <P>
                    The audit detects orphans (files on disk with no meta record), ghosts (meta records pointing
                    at missing files), stuck running jobs, and overage retries. <strong>Reconcile</strong> fixes
                    them in one click.
                </P>

                <H3>Inspect attachment by ID</H3>
                <P>
                    Type any attachment ID, get a forensic dump: meta in both storage locations side-by-side
                    (<code>_tempaloo_webp</code> vs legacy in-metadata), the original file existence + bytes,
                    per-size disk state for <code>.webp</code> and <code>.avif</code>, plus a directory listing
                    of every file matching the attachment's filename pattern. Surfaces immediately whether
                    another optimizer touched the same files.
                </P>

                <H3>Filesystem self-test</H3>
                <P>
                    Writes a real (tiny, 26-byte) <code>.webp</code> into your uploads directory, immediately
                    re-checks existence, sleeps 5 seconds, re-checks, then fetches the file via HTTP and
                    inspects the Content-Type. Returns one verdict line that names the failure mode:
                </P>
                <ul>
                    <li><code>WRITE_FAILED</code> — permissions issue.</li>
                    <li><code>POST_WRITE_VANISH</code> — host security caught the write.</li>
                    <li><code>PERSISTENCE_FAILURE</code> — something deleted it within 5 seconds (LiteSpeed Image Opt, Wordfence, host WAF).</li>
                    <li><code>WRONG_MIME</code> — file persists but served as <code>image/jpeg</code> → browser can't decode.</li>
                    <li><code>OK</code> — write, persistence, and serve all healthy.</li>
                </ul>
            </Section>

            {/* ─── Cache compatibility ───────────────────────────── */}
            <Section id="cache" title="Cache compatibility — survives every page-cache plugin">
                <P>
                    LiteSpeed Cache, WP Rocket, W3 Total Cache, Cache Enabler, and Hummingbird all sometimes
                    cache authenticated REST responses by URL — even when those responses carry per-user data.
                    Without active opt-out, the Overview "this month" counter would freeze after every upload
                    until a manual cache purge.
                </P>

                <H3>Four-layer cache opt-out</H3>
                <ol>
                    <li>Every REST callback sends <code>nocache_headers()</code> + defines <code>DONOTCACHEPAGE</code> / <code>DONOTCACHEOBJECT</code> / <code>DONOTCACHEDB</code> — the constants every major page-cache plugin checks.</li>
                    <li>Explicit <code>litespeed_control_set_nocache</code> action on every request — no-op without LSCache, immediate opt-out where it's installed.</li>
                    <li>The plugin self-registers its REST namespace with <code>litespeed_cache_excludes_uri</code>, <code>rocket_cache_reject_uri</code>, and <code>w3tc_minify_pgcache_reject_uri</code> filters, so cache layers skip us at config-resolution time, not just runtime.</li>
                    <li>Frontend appends a <code>?_=Date.now()</code> cache-buster on every fetch and sends <code>Cache-Control: no-cache</code> + <code>Pragma: no-cache</code> headers — last line of defence against Cloudflare APO and Varnish without ESI.</li>
                </ol>

                <Callout kind="info" title="No setup required">
                    All four layers fire automatically. You don't need to add cache exclusion rules to your
                    LSCache / Rocket / W3TC settings. The plugin's REST namespace
                    (<code>/wp-json/tempaloo-webp/v1</code>) is already excluded.
                </Callout>
            </Section>

            {/* ─── Troubleshooting ───────────────────────────────── */}
            <Section id="troubleshooting" title="Troubleshooting — common issues">
                <H3>"This month" counter doesn't update after an upload</H3>
                <P>
                    Almost always a page-cache layer holding a stale <code>/state</code> response. Open the
                    Diagnostic tab and click the <strong>Reconcile</strong> button — it forces a fresh audit
                    and bypasses cached data. If the issue persists, your cache plugin needs to be told to
                    skip <code>/wp-json/tempaloo-webp/v1</code> manually (Tempaloo registers itself
                    automatically with LSCache / Rocket / W3TC; if you're on a different cache, add the rule).
                </P>

                <H3>Conversion logs success but .webp files vanish</H3>
                <P>
                    A host-level scanner (Wordfence, iThemes Security, Hostinger LSCache stack) is
                    quarantining the freshly-written sibling. Run the <strong>Filesystem self-test</strong> in
                    Diagnostic — if it returns <code>PERSISTENCE_FAILURE</code> or
                    <code>POST_WRITE_VANISH</code>, you have evidence to escalate to your host. Tempaloo
                    writes via the atomic <code>temp + rename</code> pattern (inspired by WP Smush) so the
                    scanner doesn't catch a half-written file — but if it specifically targets the
                    <code>.jpg.webp</code> pattern post-rename, only host-side allow-listing fixes it.
                </P>

                <H3>Free plan AVIF dropdown won't stay selected</H3>
                <P>
                    AVIF is paid-only. The Free plan's settings UI lets you click AVIF, but it's quietly
                    re-saved as WebP on submit. Upgrade to Starter or above to unlock AVIF and the
                    dual-format <strong>Both</strong> mode that generates both siblings in one credit.
                </P>

                <H3>Bulk page shows "Converting…" but no progress</H3>
                <P>
                    The Bulk loop pings <code>ajax_tick</code> every 350 ms. If you see no progress, your
                    server's <code>admin-ajax.php</code> is probably rate-limited. Check the
                    <strong>API health</strong> banner — if it shows a 5xx error, the worker is rebooting and
                    Bulk will resume on its own with adaptive backoff (5s → 10s → 15s → 20s).
                </P>

                <H3>Need direct help?</H3>
                <P>
                    Reach out via the <a href="/contact">contact page</a> — we read every message. Include
                    your site URL, plugin version, and a screenshot of the Diagnostic tab if relevant.
                </P>
            </Section>
        </DocPage>
    );
}
