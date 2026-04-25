import { DocPage, Section, P, H3, Pre, Callout, Mockup } from "@/components/docs/Doc";

export const metadata = {
    title: "WP-CLI commands — Tempaloo WebP Docs",
    description: "Six commands to manage license, bulk conversion, restore and settings from the terminal — built for agencies running many sites.",
};

export default function CliPage() {
    return (
        <DocPage
            eyebrow="DOCUMENTATION · WP-CLI"
            title="WP-CLI commands"
            lead="Six commands that cover the full plugin lifecycle from the terminal. Designed for agencies, platform engineers and CI pipelines that manage multiple WordPress sites."
        >
            <Section title="Why WP-CLI">
                <P>If you manage 1 site, you'll never need this — the WordPress admin does everything. If you manage 30 client sites, you'll script the activation and bulk conversion across all of them in one bash loop:</P>
                <Pre lang="bash" code={`for site in client1.com client2.com client3.com; do
    wp --url="$site" plugin install tempaloo-webp --activate
    wp --url="$site" tempaloo activate "$LICENSE_KEY"
    wp --url="$site" tempaloo bulk --limit=500
done`} />
                <P>Same setup, 30 sites, one terminal. That's the agency pattern that drives the bulk of revenue at ShortPixel and Imagify — and it's now first-class on Tempaloo.</P>
            </Section>

            <Section title="Prerequisites">
                <ul>
                    <li><strong>WP-CLI installed</strong> on your server. Check with <code>wp --info</code>.</li>
                    <li><strong>Plugin v0.5.0+</strong> activated (commands are auto-registered when WP-CLI is detected).</li>
                </ul>
                <Callout kind="tip" title="LocalWP users">
                    Open your site → menu → <strong>Open site shell</strong>. WP-CLI is bundled. Type <code>wp tempaloo status</code> to confirm.
                </Callout>
            </Section>

            {/* ─── status ────────────────────────────────────────── */}
            <Section id="status" title="wp tempaloo status">
                <P>Show license, plan, quota, settings, and current API health. Always start here when troubleshooting.</P>

                <Mockup chrome="terminal">
                    <pre>{`$ wp tempaloo status
+---------------+--------------+-----+
| field         | value        |     |
+---------------+--------------+-----+
| license_valid | yes          |     |
| plan          | growth       |     |
| images_limit  | 25000        |     |
| sites_limit   | 5            |     |
| output_format | webp         |     |
| quality       | 85           |     |
| auto_convert  | yes          |     |
| serve_webp    | yes          |     |
| resize_max_px | 2560         |     |
| api_health    | ok           |     |
+---------------+--------------+-----+`}</pre>
                </Mockup>

                <P>Add <code>--format=json</code> for machine-readable output (useful in CI).</P>
            </Section>

            {/* ─── activate ──────────────────────────────────────── */}
            <Section id="activate" title="wp tempaloo activate &lt;license-key&gt;">
                <P>Activate a license key. Verifies it against the API and stores the plan, format support, and quotas locally.</P>

                <Mockup chrome="terminal">
                    <pre>{`$ wp tempaloo activate tw_live_8b7f2c3a4e5d6
Success: License activated on growth plan.`}</pre>
                </Mockup>

                <Callout kind="warn" title="Idempotent but not free">
                    Each call hits the API. Don't put this in a loop that runs every minute — once on
                    install is enough.
                </Callout>
            </Section>

            {/* ─── bulk ──────────────────────────────────────────── */}
            <Section id="bulk" title="wp tempaloo bulk [--dry-run] [--limit=N]">
                <P>Convert every supported attachment that doesn't already have a <code>tempaloo_webp</code> meta block. Shows a progress bar and stops cleanly if the monthly quota is reached mid-run.</P>

                <H3>Preview without running</H3>
                <Mockup chrome="terminal">
                    <pre>{`$ wp tempaloo bulk --dry-run
1247 pending attachment(s) would be converted.`}</pre>
                </Mockup>

                <H3>Process a capped batch</H3>
                <Mockup chrome="terminal">
                    <pre>{`$ wp tempaloo bulk --limit=200
Converting  100% [========================================]  0:42 / 0:42
Success: 198 converted, 2 failed.`}</pre>
                </Mockup>

                <Callout kind="info" title="Quota exhaustion is graceful">
                    If you hit your monthly cap mid-run, the command stops, prints how many remain, and
                    leaves the progress bar in a clean state. Upgrade or wait for the rollover, then
                    re-run the command — it picks up where it stopped.
                </Callout>
            </Section>

            {/* ─── restore ───────────────────────────────────────── */}
            <Section id="restore" title="wp tempaloo restore [--ids=...] [--yes]">
                <P>
                    Delete every <code>.webp</code> / <code>.avif</code> sibling we wrote.
                    Originals (<code>.jpg</code>, <code>.png</code>, <code>.gif</code>) are <strong>never touched</strong>.
                </P>

                <H3>Restore everything</H3>
                <Mockup chrome="terminal">
                    <pre>{`$ wp tempaloo restore
Are you sure you want to delete .webp/.avif siblings for 847 attachment(s)? Originals are NOT touched. [y/n] y
Restoring  100% [========================================]  0:12 / 0:12
Success: Restored 847 attachment(s); removed 6584 sibling file(s).`}</pre>
                </Mockup>

                <H3>Restore specific attachments only</H3>
                <Pre lang="bash" code={`wp tempaloo restore --ids=12,34,56 --yes`} />
                <P><code>--yes</code> skips the confirmation prompt — useful in CI / scripts.</P>
            </Section>

            {/* ─── quota ─────────────────────────────────────────── */}
            <Section id="quota" title="wp tempaloo quota">
                <P>Live quota check from the API.</P>

                <Mockup chrome="terminal">
                    <pre>{`$ wp tempaloo quota
+------------------+----------------------+
| field            | value                |
+------------------+----------------------+
| plan             | growth               |
| images_used      | 4287                 |
| images_limit     | 25000                |
| images_remaining | 20713                |
| sites_used       | 3                    |
| period_end       | 2026-05-01           |
+------------------+----------------------+`}</pre>
                </Mockup>

                <Callout kind="tip" title="Use in monitoring">
                    Combine with <code>--format=json</code> + jq to plug into your alerting:
                    <code>{` wp tempaloo quota --format=json | jq '.[].images_remaining'`}</code>.
                </Callout>
            </Section>

            {/* ─── settings ──────────────────────────────────────── */}
            <Section id="settings" title="wp tempaloo settings get|set &lt;key&gt; [&lt;value&gt;]">
                <P>Read or write any setting from the CLI. Useful when rolling out a config change to multiple sites.</P>

                <H3>Allowed keys</H3>
                <ul>
                    <li><code>quality</code> — integer 1-100</li>
                    <li><code>output_format</code> — <code>webp</code> or <code>avif</code></li>
                    <li><code>auto_convert</code> — <code>true</code> / <code>false</code></li>
                    <li><code>serve_webp</code> — <code>true</code> / <code>false</code></li>
                    <li><code>resize_max_width</code> — integer 320-7680, or <code>0</code> to disable</li>
                </ul>

                <H3>Read</H3>
                <Mockup chrome="terminal">
                    <pre>{`$ wp tempaloo settings get quality
85`}</pre>
                </Mockup>

                <H3>Write</H3>
                <Mockup chrome="terminal">
                    <pre>{`$ wp tempaloo settings set quality 75
Success: Set quality = 75

$ wp tempaloo settings set resize_max_width 2560
Success: Set resize_max_width = 2560`}</pre>
                </Mockup>

                <Callout kind="info" title="Validation is built in">
                    Out-of-range values are clamped (<code>quality</code> to 1-100, <code>resize_max_width</code> to 320-7680).
                    Booleans accept <code>true</code>/<code>false</code>/<code>1</code>/<code>0</code>/<code>yes</code>/<code>no</code>.
                </Callout>
            </Section>
        </DocPage>
    );
}
