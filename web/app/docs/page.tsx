import Link from "next/link";
import { DocPage, Section, P, H3, Pre, Callout } from "@/components/docs/Doc";

export const metadata = {
    title: "Docs — Tempaloo WebP",
    description: "Install, activate, and integrate Tempaloo WebP in your WordPress workflow.",
};

export default function DocsIndex() {
    return (
        <DocPage
            eyebrow="DOCUMENTATION"
            title="Tempaloo WebP — Documentation"
            lead="Everything you need to install the plugin, get a license key, and ship faster pages. From a one-click install to per-attachment hooks for power users."
        >
            <div className="doc-grid doc-grid-2">
                <Link href="/docs/features" className="doc-card" style={{ textDecoration: "none", borderBottom: "1px solid var(--line)" }}>
                    <div className="doc-card-h">New features</div>
                    <p className="doc-card-p">Compression stats, restore originals, resize on upload, quality presets.</p>
                    <span className="doc-card-link">Read →</span>
                </Link>
                <Link href="/docs/cli" className="doc-card" style={{ textDecoration: "none", borderBottom: "1px solid var(--line)" }}>
                    <div className="doc-card-h">WP-CLI</div>
                    <p className="doc-card-p">Six commands to manage license, bulk, restore and settings from your terminal.</p>
                    <span className="doc-card-link">Read →</span>
                </Link>
                <Link href="/docs/hooks" className="doc-card" style={{ textDecoration: "none", borderBottom: "1px solid var(--line)" }}>
                    <div className="doc-card-h">Developer hooks</div>
                    <p className="doc-card-p">Three filters / actions to skip, override quality, or react to conversions.</p>
                    <span className="doc-card-link">Read →</span>
                </Link>
                <a href="mailto:support@tempaloo.com" className="doc-card" style={{ textDecoration: "none", borderBottom: "1px solid var(--line)" }}>
                    <div className="doc-card-h">Support</div>
                    <p className="doc-card-p">Stuck on something the docs don't cover? Email support — we read every message.</p>
                    <span className="doc-card-link">Contact →</span>
                </a>
            </div>

            <Section id="install" title="Install & activate (3 minutes)">
                <P>The plugin works on any WordPress install running PHP 7.4+ and WP 6.0+. No CDN, no external library to set up.</P>

                <H3>1. Install the plugin</H3>
                <P>From your WordPress admin, go to <strong>Plugins → Add New</strong>, search for <code>Tempaloo WebP</code>, click <strong>Install</strong> then <strong>Activate</strong>. Or upload the <code>.zip</code> from <Link href="/webp">tempaloo.com/webp</Link> via <strong>Plugins → Add New → Upload</strong>.</P>

                <H3>2. Generate a license key</H3>
                <P>Open the new <strong>Tempaloo WebP</strong> menu in your sidebar. Click <strong>Generate a key</strong> — a new tab opens on tempaloo.com. Pick the Free plan (250 images/month, no credit card) or any paid plan. You'll be back in WP admin in under 30 seconds with a license key.</P>

                <H3>3. Activate</H3>
                <P>Paste the key in the <strong>Activate Tempaloo WebP</strong> card and click <strong>Activate</strong>. You're done — every new image upload is now converted automatically.</P>

                <Callout kind="tip" title="Bulk-convert your existing library">
                    Open the <strong>Bulk</strong> tab and click <strong>Start conversion</strong>. Long jobs survive page refreshes and PHP timeouts thanks to a resumable batch loop.
                </Callout>
            </Section>

            <Section id="under-the-hood" title="Under the hood">
                <P>What the plugin does, in one sentence: it intercepts WordPress's media pipeline (<code>wp_handle_upload</code> + <code>wp_get_attachment_image</code>), sends each new upload to <code>api.tempaloo.com</code> for in-memory conversion, writes the resulting <code>.webp</code> / <code>.avif</code> file alongside the original, and rewrites image URLs so browsers receive the optimized version.</P>

                <P>The original files (<code>.jpg</code>, <code>.png</code>, <code>.gif</code>) are never modified. Restoring is one click — see <Link href="/docs/features#restore">the Restore section</Link>.</P>

                <H3>Where data goes</H3>
                <Pre lang="text" code={`Your WP admin
   ↓ POST /v1/convert (multipart, image bytes + license key + site URL)
api.tempaloo.com (Frankfurt EU, GDPR)
   ↓ in-memory conversion via libvips, never persisted
Your WP server
   .webp / .avif written next to the original`} />
                <P>
                    Originals stay on your server. We are not a storage service.
                    See the readme's <code>== External services ==</code> section for a full disclosure
                    or read the <Link href="/privacy">Privacy Policy</Link>.
                </P>
            </Section>
        </DocPage>
    );
}
