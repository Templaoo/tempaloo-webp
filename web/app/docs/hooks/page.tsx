import { DocPage, Section, P, H3, Pre, Callout } from "@/components/docs/Doc";

export const metadata = {
    title: "Developer hooks — Tempaloo WebP Docs",
    description: "Three filters and actions to skip conversions, override quality per attachment, or react to successful conversions.",
    openGraph: {
        title: "Tempaloo WebP — Developer hooks",
        description: "PHP hooks to skip conversions, override quality, or react after a successful convert.",
        url: "https://tempaloo.com/docs/hooks",
        type: "article",
    },
    twitter: { card: "summary_large_image" },
    alternates: { canonical: "https://tempaloo.com/docs/hooks" },
};

export default function HooksPage() {
    return (
        <DocPage
            eyebrow="DOCUMENTATION · DEVELOPER HOOKS"
            title="Developer hooks"
            lead="Three hooks to integrate Tempaloo with your custom theme or plugin. They fire identically on the auto-convert-on-upload path and the bulk path, so a single rule applies everywhere."
        >
            <Section title="At a glance">
                <ul>
                    <li><strong><a href="#skip">tempaloo_webp_skip_attachment</a></strong> — bypass conversion per attachment.</li>
                    <li><strong><a href="#quality">tempaloo_webp_quality_for</a></strong> — override quality (1-100) per attachment.</li>
                    <li><strong><a href="#after">tempaloo_webp_after_convert</a></strong> — fire on every successful conversion.</li>
                </ul>
                <Callout kind="info" title="Where to put the code">
                    Drop these snippets in your theme's <code>functions.php</code> or in a tiny custom
                    plugin file at <code>wp-content/plugins/your-tempaloo-tweaks/your-tempaloo-tweaks.php</code>.
                    They take effect on the next upload or bulk run — no plugin reactivation needed.
                </Callout>
            </Section>

            {/* ─── skip ──────────────────────────────────────────── */}
            <Section id="skip" title="tempaloo_webp_skip_attachment">
                <P>Filter that decides whether an attachment should be converted at all. Return <code>true</code> to skip.</P>

                <H3>Signature</H3>
                <Pre lang="php" code={`apply_filters( 'tempaloo_webp_skip_attachment',
    bool $skip,            // default false
    int  $attachment_id,
    string $mode           // 'auto' | 'bulk'
);`} />

                <H3>Example: exclude a folder</H3>
                <Pre lang="php" code={`add_filter( 'tempaloo_webp_skip_attachment', function( $skip, $id ) {
    $path = get_attached_file( $id );
    return $path && false !== strpos( $path, '/uploads/private/' );
}, 10, 2 );`} />

                <H3>Example: only convert published media</H3>
                <Pre lang="php" code={`add_filter( 'tempaloo_webp_skip_attachment', function( $skip, $id ) {
    $parent = wp_get_post_parent_id( $id );
    if ( ! $parent ) return $skip;
    return get_post_status( $parent ) !== 'publish';
}, 10, 2 );`} />

                <H3>Example: skip by mime type or size</H3>
                <Pre lang="php" code={`add_filter( 'tempaloo_webp_skip_attachment', function( $skip, $id ) {
    $mime = get_post_mime_type( $id );
    if ( 'image/gif' === $mime ) return true;          // never touch GIFs
    $path = get_attached_file( $id );
    if ( $path && filesize( $path ) < 50 * 1024 ) {
        return true;                                    // skip files < 50 KB
    }
    return $skip;
}, 10, 2 );`} />
            </Section>

            {/* ─── quality ───────────────────────────────────────── */}
            <Section id="quality" title="tempaloo_webp_quality_for">
                <P>Filter that overrides the quality value (1-100) for a specific attachment. Returned values are clamped to 1-100, so a typo can't break your conversion.</P>

                <H3>Signature</H3>
                <Pre lang="php" code={`apply_filters( 'tempaloo_webp_quality_for',
    int    $quality,        // current quality from settings
    int    $attachment_id,
    string $format          // 'webp' | 'avif' (the chosen target)
);`} />

                <H3>Example: lift quality on portfolio images</H3>
                <Pre lang="php" code={`add_filter( 'tempaloo_webp_quality_for', function( $q, $id, $format ) {
    if ( has_term( 'portfolio', 'attachment_category', $id ) ) {
        return 92;
    }
    return $q;
}, 10, 3 );`} />

                <H3>Example: drop quality for AVIF (it tolerates lower q)</H3>
                <Pre lang="php" code={`add_filter( 'tempaloo_webp_quality_for', function( $q, $id, $format ) {
    return $format === 'avif' ? max( 50, $q - 10 ) : $q;
}, 10, 3 );`} />

                <H3>Example: per-CPT presets</H3>
                <Pre lang="php" code={`add_filter( 'tempaloo_webp_quality_for', function( $q, $id ) {
    $parent = wp_get_post_parent_id( $id );
    if ( $parent && get_post_type( $parent ) === 'product' ) {
        return 80;   // crisper product photos
    }
    return $q;
}, 10, 2 );`} />
            </Section>

            {/* ─── after ─────────────────────────────────────────── */}
            <Section id="after" title="tempaloo_webp_after_convert">
                <P>Action fired after a successful conversion (one or more sizes written). Hook in here to invalidate your CDN, log to your own system, or trigger a webhook.</P>

                <H3>Signature</H3>
                <Pre lang="php" code={`do_action( 'tempaloo_webp_after_convert',
    int   $attachment_id,
    array $info {
        string $format;       // 'webp' | 'avif'
        int    $converted;    // number of sizes converted
        int    $failed;
        string $mode;         // 'auto' | 'bulk'
        int    $quality;      // post-filter quality used
        array  $sizes;        // map of generated files: orig_basename => { file, bytes }
    }
);`} />

                <H3>Example: purge Cloudflare</H3>
                <Pre lang="php" code={`add_action( 'tempaloo_webp_after_convert', function( $id, $info ) {
    if ( $info['converted'] === 0 ) return;
    $url = wp_get_attachment_url( $id );
    wp_remote_post(
        'https://api.cloudflare.com/client/v4/zones/' . CF_ZONE . '/purge_cache',
        [
            'headers' => [
                'Authorization' => 'Bearer ' . CF_TOKEN,
                'Content-Type'  => 'application/json',
            ],
            'body' => wp_json_encode( [ 'files' => [ $url, $url . '.webp', $url . '.avif' ] ] ),
        ]
    );
}, 10, 2 );`} />

                <H3>Example: log to your analytics</H3>
                <Pre lang="php" code={`add_action( 'tempaloo_webp_after_convert', function( $id, $info ) {
    error_log( sprintf(
        '[tempaloo] #%d %s converted %d sizes (q=%d) via %s',
        $id, $info['format'], $info['converted'], $info['quality'], $info['mode']
    ) );
}, 10, 2 );`} />

                <H3>Example: trigger a webhook</H3>
                <Pre lang="php" code={`add_action( 'tempaloo_webp_after_convert', function( $id, $info ) {
    if ( $info['mode'] !== 'bulk' ) return;            // only batch webhooks
    wp_remote_post( 'https://hooks.example.com/tempaloo', [
        'body' => wp_json_encode( [
            'site' => home_url(),
            'attachment_id' => $id,
            'format'        => $info['format'],
            'sizes'         => $info['converted'],
        ] ),
        'blocking' => false,                            // fire-and-forget
    ] );
}, 10, 2 );`} />

                <Callout kind="warn" title="Don't slow the upload">
                    The action fires <strong>synchronously</strong> on upload — heavy work (large HTTP
                    calls, blocking I/O) will delay the user's upload response. Use
                    <code>{`'blocking' => false`}</code> on outbound HTTP, or queue a background job.
                </Callout>
            </Section>

            <Section title="What's NOT a hook (yet)">
                <P>If you need any of these, open an issue — the more we hear them, the faster they ship:</P>
                <ul>
                    <li><code>tempaloo_webp_before_convert</code> — pre-flight modify image bytes</li>
                    <li><code>tempaloo_webp_convert_failed</code> — react to errors specifically</li>
                    <li><code>tempaloo_webp_alternate_url</code> — customize how the .webp URL is computed</li>
                </ul>
            </Section>
        </DocPage>
    );
}
