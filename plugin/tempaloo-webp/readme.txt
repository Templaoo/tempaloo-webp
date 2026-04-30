=== Tempaloo WebP – Image Optimizer & AVIF Converter ===
Contributors: tempaloo
Tags: webp, avif, image-optimization, lazy-load, performance
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 1.8.2
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Convert your WordPress images to WebP and AVIF automatically. Lighter pages, faster loads, no setup.

== Description ==

Tempaloo WebP converts your images to modern formats (WebP, and AVIF on paid plans) via our conversion API, and serves the optimized version to browsers that support it. No local libraries to install, no cron jobs, no CDN to configure.

**Why Tempaloo?**

Most WordPress image optimizers count every thumbnail WordPress generates as a separate credit. A single upload can burn 6-8 credits before you even touch your first paid image. Tempaloo charges **1 credit per upload** — every thumbnail size is bundled in. You get 6-8x more conversions for the same price.

**Features**

* Automatic conversion on every new upload
* Bulk convert your existing media library in one click
* Serves WebP/AVIF to supported browsers, falls back to the original for others
* Per-image quality control
* Credit rollover up to 30 days on paid plans
* Works with Gutenberg, Elementor, Bricks, Divi, Beaver Builder, WooCommerce and any theme

**Pricing**

* **Free plan**: 250 images / month, 1 site, no credit card required
* **Starter** (5 €/mo): 5,000 images/month + AVIF
* **Growth** (12 €/mo): 25,000 images/month + 5 sites per license
* **Business** (29 €/mo): 150,000 images/month + unlimited sites
* **Unlimited** (59 €/mo): fair-use policy (500k/mo), priority SLA

Full details at [https://tempaloo.com/webp](https://tempaloo.com/webp).

**Trademarks**

WebP and AVIF are open image formats developed by Google and the Alliance for Open Media respectively. Tempaloo is an independent product and is not affiliated with, endorsed by, or sponsored by Google or the Alliance for Open Media.

== External services ==

This plugin connects to the Tempaloo conversion API hosted at `https://api.tempaloo.com` to:

* Verify your license key when you activate the plugin.
* Convert images to WebP or AVIF — the plugin sends your image files (temporarily, not stored) along with your license key and site URL.
* Fetch your current monthly quota.
* Receive webhooks from Freemius (our payment processor) for subscription events.

**What data is sent**

* Your license key (required for authentication).
* Your site URL (for license-to-site binding).
* The image bytes to be converted (streamed, never persisted on our servers — originals stay on your server).
* Your WordPress and plugin version (for compatibility diagnostics).

**Data retention**

* Image data is held in memory only during conversion, then discarded.
* Usage logs (count of conversions, byte totals, duration) are stored for billing and analytics, associated with your license.
* No PII is sent.

**Providers**

* Conversion API: **Tempaloo** (hosted in Frankfurt, EU).
  * [Terms of Service](https://tempaloo.com/terms)
  * [Privacy Policy](https://tempaloo.com/privacy)
* Payment processing (paid plans only, triggered by clicking "Upgrade"): **Freemius, Inc.**
  * [Freemius Privacy Policy](https://freemius.com/privacy/)
  * [Freemius Terms](https://freemius.com/terms/)

By activating this plugin and entering a license key, you agree to Tempaloo's Terms and Privacy Policy.

== Installation ==

1. Upload the plugin to `/wp-content/plugins/tempaloo-webp/`, or install via **Plugins → Add New**.
2. Activate the plugin through the **Plugins** menu in WordPress.
3. Go to the **Tempaloo WebP** menu in your admin sidebar.
4. Click **Generate an API key** (opens tempaloo.com/webp/activate) or paste an existing key.
5. Click **Activate**. New uploads will be converted automatically.
6. (Optional) Go to the **Bulk** tab and click **Start conversion** to convert your existing library.

== Frequently Asked Questions ==

= Do I need an account to use this plugin? =

Yes. Conversion happens on our API, so a license key is required. The Free plan (250 images/month) takes 10 seconds to generate and requires no credit card.

= What happens if I hit my quota? =

New uploads stop being converted until the next monthly reset, or until you upgrade. Images already converted keep being served as WebP/AVIF — nothing breaks.

= Are my images stored on your servers? =

No. Conversion happens in-memory. The converted file is streamed back to your site; the input and output are not persisted. Originals always stay on your server.

= Will it work with my page builder / theme? =

Yes. The plugin is standalone — it hooks into WordPress's media pipeline via `wp_handle_upload` and `wp_get_attachment_image`. It works with Gutenberg, Elementor, Bricks, Divi, Beaver Builder, WooCommerce and any theme, without modification.

= Can I uninstall and keep my converted images? =

Yes. Uninstalling only removes the plugin settings. The `.webp` / `.avif` files we wrote next to your originals stay on your server. Your originals are never touched.

= What's the difference with ShortPixel / Imagify / Elementor Image Optimizer? =

They charge one credit per thumbnail WordPress generates (6-8 per upload). We charge one credit per upload, all sizes bundled. For the same monthly quota, you get 6-8x more usable conversions.

= Does the Free plan require a credit card? =

No. Paid plans include a 7-day trial and a 30-day money-back guarantee.

== Privacy ==

See the **External services** section above for a full disclosure of the data this plugin sends to the Tempaloo API.

== Developer hooks ==

Three hooks let you tailor the plugin's behavior from your own theme or custom plugin. They fire on both the auto-convert-on-upload path and the bulk path (CLI or admin), so a single rule applies everywhere.

`apply_filters( 'tempaloo_skip_attachment', false, $attachment_id, $mode )`
Return `true` to bypass conversion for a specific attachment. Useful to exclude a folder, a CPT, or images larger than a threshold.

`apply_filters( 'tempaloo_quality_for', $quality, $attachment_id, $format )`
Override the quality value (1–100) per attachment. Returned values are clamped to 1–100. Useful to lift quality on portfolio shots or drop it on product thumbnails.

`do_action( 'tempaloo_after_convert', $attachment_id, $info )`
Fired after a successful conversion (one or more sizes written). `$info` contains `format`, `converted`, `failed`, `mode`, `quality`, `sizes`. Useful for CDN purges, custom logging, webhooks, manifest rebuilds.

Example — skip conversion for any attachment in the `private/` upload subfolder:

`add_filter( 'tempaloo_skip_attachment', function( $skip, $id ) {
    $path = get_attached_file( $id );
    return $path && false !== strpos( $path, '/uploads/private/' );
}, 10, 2 );`

== Screenshots ==

1. The dashboard — monthly quota, savings stats, license management.
2. Bulk conversion in progress.
3. Per-attachment conversion badges in the media library.
4. Settings — quality, output format, auto-convert toggle.

== Changelog ==

= 1.8.2 =
* New: **Filesystem self-test** in the Diagnostic tab. Writes a real (tiny, 26-byte) WebP into `/uploads/`, immediately re-checks existence, sleeps 5 seconds, re-checks again, then fetches the file via HTTP and inspects the Content-Type. Returns one verdict line that names the failure mode: `WRITE_FAILED` (permissions), `POST_WRITE_VANISH` (host security caught the write), `PERSISTENCE_FAILURE` (something deleted it within 5s — LiteSpeed Image Optimization, Wordfence, host WAF), `WRONG_MIME` (file persists but served as image/jpeg → browser can't decode), or `OK`. Surfaces in one button click why the user's converter writes WebPs the disk doesn't keep.
* New: REST endpoint `POST /tempaloo-webp/v1/filesystem-test` returning the same data scriptable for support.

= 1.8.1 =
* New: **Inspect attachment by ID** in the Diagnostic tab. Type any attachment ID, get a forensic dump: meta in both storage locations side-by-side (`_tempaloo_webp` post_meta vs legacy in-metadata), the original file existence + bytes, and per-size disk state for `.webp` and `.avif` siblings. Surfaces immediately whether the converter actually wrote files, whether they got deleted right after by another plugin, or whether the meta got stripped — instead of guessing between Activity log success and a "Convert now" button on the same row.
* New: REST endpoint `GET /tempaloo-webp/v1/attachment-debug?id=X` returning the same forensic data.
* Fix: Converter now verifies disk state AFTER `file_put_contents`. Some hosts (LiteSpeed configs, `mod_security`, `open_basedir` edge cases) accept the write but the file disappears moments later — we counted those as `converted=N` while the disk had zero siblings. Now the post-write `file_exists()` check runs `clearstatcache()` first, treats vanished files as failed, and writes an Activity error entry naming the file path so the user can see what went wrong.

= 1.8.0 =
* **Architectural fix**: Conversion state moved from inside `_wp_attachment_metadata.tempaloo_webp` to a dedicated `_tempaloo_webp` post_meta key. Reason: when LiteSpeed Cache (default on Hostinger), Smush, ShortPixel, Imagify or any image optimizer hooks `wp_generate_attachment_metadata` at a later priority than ours, they sometimes rebuild the standard metadata array for their own queue and strip non-WP sub-keys in the process. Result for the user: Activity logs "Auto-convert success — 6 sizes converted", but the Optimized column shows nothing, Bulk says pending, and the frontend has no `<picture>` wrap — because the meta marker we wrote got overwritten right after. The new dedicated post_meta key is invisible to those filters; nothing can strip what nothing else knows about. Same approach ShortPixel uses (`_shortpixel_status` post_meta).
* New: helper trio `Tempaloo_WebP_Plugin::get_conversion_meta()` / `set_conversion_meta()` / `delete_conversion_meta()`. Single source of truth for our state. Reads always check the new key first, fall back to the legacy in-metadata key for backward compat (so attachments converted before this release keep working until they get re-converted). Writes go to the new key only. Deletes clear both, plus dual cache invalidation.
* Updated: every reader (`compute_attachment_savings`, `scan_breakdown`, audit endpoint, reconcile endpoint, restore endpoint, attachment field, REST stats, JS data filter) now goes through the helper. No more direct `$meta['tempaloo_webp']` reads anywhere — the access pattern is centralised and immune to future filter-chain regressions.

= 1.7.3 =
* New: Every auto-convert outcome on upload is now logged to Activity. Until now the only way to know why a freshly-uploaded image hadn't been converted was to guess: license expired? Toggle off? Unsupported mime? API error? The Optimized column just showed "—" silently. Each upload now produces one of: `success`, `warn` (license inactive), `info` (mime not convertible), or `error` (API failure with code). The user can open Activity right after upload and see exactly what happened.

= 1.7.2 =
* New: **"Convert now" button** on every unconverted row in the Media Library list view (`wp-admin/upload.php`). One AJAX call per click triggers the same code path as Bulk (`convert_all_sizes` in auto mode → 1 credit, every WordPress thumbnail size in one batch). The cell updates in place to show the post-conversion stats — no page reload, no leaving the Media Library. Errors (quota exceeded, unauthorized, network) surface inline below the button so the user knows why and can retry.
* New: AJAX endpoint `wp_ajax_tempaloo_convert_one` with per-attachment nonce. Capability check (`upload_files`) + license validity check before any conversion work, so a tab left open with stale state can't burn credits on rejected calls.

= 1.7.1 =
* Fix: Diagnostic Reconcile now actually clears the meta the audit flagged. v1.7.0 used two different ghost definitions — the audit was strict ("any size missing → ghost"), reconcile was looser ("only ALL sizes missing → clear"). Result: partially-broken attachments showed up as ghosts every refresh and Reconcile reported zero cleared. The two are now aligned: any missing sibling triggers a meta clear, the next bulk re-flags the attachment as pending and re-encodes every size cleanly.
* Fix: Reconcile now uses `update_post_meta` directly + double cache invalidation (`clean_post_cache` + `wp_cache_delete`). Some sites with persistent object cache (Redis, LiteSpeed Object Cache) and image-optimizer plugins on the `wp_update_attachment_metadata` filter could leave the meta unchanged after a successful clear. Belt-and-suspender against both.

= 1.7.0 =
* New: **Diagnostic tab** in the plugin admin. Walks the four sources of truth side by side — WordPress attachments table, `tempaloo_webp` meta on each attachment, the `.webp`/`.avif` files actually on disk, and the bulk + retry queue options — and surfaces every drift between them. Counts orphans (siblings on disk with no meta), ghosts (meta says converted but no file), stuck-running bulks (>30 min idle), retry queue entries past max-attempts, and effective settings.
* New: **Reconcile button** with dry-run preview. Resets stuck-running bulks to idle, drops retry queue entries past the attempt cap, clears ghost meta so the next bulk re-flags those attachments. Optional opt-in for orphan file deletion (destructive — separate flag). Activity log records every reconcile pass.
* New: REST endpoints `GET /tempaloo-webp/v1/state-audit` (read-only inventory) and `POST /tempaloo-webp/v1/state-reconcile` (idempotent fixer). Power tooling for support/debug — same data the new tab shows, scriptable.

= 1.6.3 =
* Fix: Bulk breakdown card now refreshes automatically the moment a run finishes. Previously the panel held the snapshot taken BEFORE the run ("Pending: 1, Already done: 0"), and only flipped to the right numbers after the user manually clicked Scan again or refreshed the page. We now re-scan from disk in `handleTerminalState` once the bulk loop reports `done` — the visible state matches the actual filesystem state without an extra click.

= 1.6.2 =
* Fix: Removed the duplicate "X images queued for retry" panel I introduced on the Overview tab in 1.6.1 — there was already a global `RetryQueueBanner` rendering the same information across every tab. The existing banner now mentions the email-on-completion (Phase 2 addition) so users see the wrap-up promise without two stacked banners.
* Fix: Two strings I had inadvertently shipped in French ("en cours de retry…", "Erreurs réseau ou serveur surchargé…") translated back to English to match the rest of the plugin.

= 1.6.1 =
* New: **"Conversion complete" email at the end of the background retry run.** When the WP-cron retry tick (every 5 minutes) drains the last attachment from the queue, the plugin asks the API to send a single wrap-up email summarising what was recovered (e.g. "28 images recovered · 1 couldn't be converted"). API-side dedup ensures one email per license per day even if the user cancels and restarts bulk a few times. Lets users close the tab, come back later, and trust that everything happened.
* New: **"En cours de retry" indicator in Overview** — a small blue panel at the top of the Overview tab whenever the retry queue isn't empty. Tells the user how many images are still being processed in the background and when the next cron tick fires. Disappears the moment the queue drains.
* New: API endpoint `POST /v1/notify/bulk-retry-complete` (license-authed) for plugins to trigger the wrap-up email. Brevo deliverability beats `wp_mail` on most shared hosts; rate-limit / dedup state lives next to the rest of the API's notification machinery.
* Fix: Background retry tally is now persisted across cron ticks in a dedicated option (`tempaloo_webp_retry_run`). Without this the email could never fire — one tick recovers some, the next tick doesn't have the count, the queue drains and we'd lose the running total.

= 1.6.0 =
* New: **Classified error panel** in the Bulk Idle view replaces the old verbose error list. Failures are now sorted into two buckets: a friendly blue "🔄 X images en cours de retry — pas besoin d'attendre" panel for transient failures (network errors, server overload — already auto-enqueued in the background retry queue, with the planned email-on-completion in v1.6.1), and a separate amber "⚠ X images need attention — retry won't help" panel for permanent rejections (oversized for tier, broken file, missing on disk) with one-line explanations of each cause. Lifts the "everything is on fire" anxiety when most failures are recoverable in the background.
* Improved: **Free plan locked to WebP only** at the server too. The Settings UI was already gating the AVIF + Both buttons when `supports_avif=false`, but the REST endpoint accepted the requested format anyway and relied on the converter to silently downgrade. Now `output_format` is forced to `webp` for any plan whose license doesn't include AVIF — protects against stale local cache and direct option pokes. Free users get fast, light WebP conversion that the Render Starter dyno handles without breaking a sweat.

= 1.5.4 =
* Improved: AVIF size threshold raised to 6 megapixels (~2450×2450) — live API logs showed successful encodes up to 4.2 MB JPEG / ~2400×2400, so the previous 1500×1500 cap was over-rejecting. Configurable via `AVIF_MAX_PIXELS` env var on the API for higher tiers.
* Fix: When ALL inputs in a batch are server-side-skipped (every size of an attachment too big for AVIF), the API now returns 200 with the `skipped` array instead of 422. The plugin records the skips on the meta and treats the attachment as resolved. Without this, bulk looped forever on attachments where every size exceeded the budget.
* New: AVIF/Both bulk runs use `BATCH_SIZE=1` (was 3) — one attachment per tick. The dyno only ever holds one libavif working set at a time, removing cascade-OOM where attachment N's encode runs into attachment N-1's not-yet-released RSS. WebP-only stays at 3 (light memory profile).
* New: Adaptive backoff in the bulk loop. After a tick whose errors include any `http_error` / `status_5xx` / `connection_reset`, the next tick waits 5s instead of 350ms (then 10s, 15s, 20s capped). Lets a just-restarted Render worker boot back up before slamming it again. Resets to 350ms on the first clean tick.
* Fix: The plugin's API client now reads back the `skipped` array from the response (was being dropped), so the converter can persist server-side skip flags on the attachment meta.

= 1.5.3 =
* Fix: AVIF over-large inputs no longer crash the API dyno. v1.5.2 already pinned Sharp to one thread and ran AVIF sequentially, but real WordPress originals (3000×3000 photos, ~10 MP) need ~600 MB of libavif working heap, which still OOM-kills a 512 MB Render Starter dyno. The API now reads each image header (cheap, no full decode) and refuses to start an AVIF encode whose pixel count exceeds the dyno budget — returns a clean `avif_oversized_input` skip entry instead of crashing.
* New: skipped encodes are persisted on the attachment meta (`tempaloo_webp.skipped`). The next bulk scan honours this and stops re-flagging those (file × format) pairs as pending — without this the same images burned 1 credit per scan for an outcome we already knew (no AVIF possible on this tier).
* New: bulk Idle pane shows a blue info banner counting "X images had AVIF skipped on at least one size — original too large for current memory budget. Enable Resize on upload, or upgrade the API tier." The WebP coverage on those sizes is intact, so the <picture> still serves an optimized format; only the AVIF source for the affected size is missing.

= 1.5.2 =
* (API-side) Fixed AVIF OOM on the 512 MB Render dyno. v1.4.1's `concurrency=2` cap still ran out of memory on real WordPress thumbnail batches because libavif peak heap is ~200 MB per encode, not ~150 MB. AVIF is now strictly sequential (concurrency=1) and runs at `effort=3` (Sharp default is 4) — files are 3–5 % larger but encode time drops ~30 % and peak heap drops ~10–15 %. `sharp.concurrency(1)` + `sharp.cache(false)` at app boot pins the libvips thread pool to one worker so RSS only ever carries one libavif working set at a time. No plugin code changed; redeploy the API and re-run bulk.

= 1.5.1 =
* Fix: **Restore now verifies every deletion.** `wp_delete_file()` returns void and silently swallows permission errors and file-in-use locks (LiteSpeed object cache, FTP transfer in progress, etc.) — we used to count those as "removed" and the user ended up with leftover siblings the bulk scan then treated as "fully converted". The post-delete `file_exists()` check now falls back to a raw `unlink()`, counts true failures, and surfaces them in the modal with sample paths so you can see exactly which files are stuck.
* New: **Orphaned-sibling detection in the bulk scan.** An attachment whose `tempaloo_webp` meta is gone but whose `.webp`/`.avif` files are still on disk gets flagged with a yellow warning band. Almost always the trace of a Restore that hit a lock.
* New: **Broken-path detection.** Attachments whose original file is missing from disk are counted separately so the math (total = done + pending + broken) finally adds up — used to be silently dropped from the scan.
* Fix: **Bulk scan auto-invalidates after Restore.** The cached scan report drops the moment `state.savings.converted` decreases (Restore is the only path that shrinks the library), so you don't see stale numbers when navigating from Settings → Bulk.
* Fix: **Restore purges page caches and per-attachment metadata cache.** Without this, LiteSpeed Cache could keep serving cached pages whose `<picture>` tags pointed at the just-deleted siblings, and `wp_get_attachment_metadata()` could return the pre-restore meta block to other plugin code paths until the next save.

= 1.5.0 =
* Fix: **Bulk scan now respects the current "Image format(s)" setting.** Until now, an image converted in WebP-only mode counted as "fully done" forever — switching to "Both" later did nothing because bulk skipped any attachment whose `tempaloo_webp` meta block existed. The scan is now disk-based per format: an attachment is "pending" if at least one expected sibling (`.webp` and/or `.avif`) is missing for any size. So "WebP → Both" instantly re-flags every image whose AVIF sibling is missing, and bulk fills the gap on the next run.
* New: **Pre-flight breakdown.** The bulk scan now returns total / fully-converted / pending counts plus a per-format split (how many need WebP, how many need AVIF). The Idle pane shows the inventory at a glance and the pre-flight modal explains what the next batch will do — including a "Why two siblings per size?" panel when "Both" is the target.
* Improved: Bulk "How it works" copy clarifies that switching formats later only re-processes the gaps — same credit math, never double-charged.
* Verified: Restore originals already removes both `.webp` and `.avif` siblings in one pass (`includes/class-rest.php`), so dual-format users get a clean undo.

= 1.4.0 =
* New: **Dual-format generation** — pick "Both" in Settings → Image format(s) and the plugin generates AVIF + WebP siblings in a single API call. Same approach as ShortPixel's "Create WebP versions" + "Create AVIF versions" combo. **Still 1 credit per upload**, regardless of how many output formats. The `<picture>` automatically serves AVIF to browsers that support it (≈80% of 2026 traffic — Chrome / Edge / Safari 16+ / Firefox 113+ / iOS 16+) and falls back to WebP everywhere else. Requires Starter plan or above for AVIF.
* Improved: Settings UI cleanup. The "Serve WebP/AVIF" toggle was removed (it duplicated the CDN passthrough switch). The "Convert on upload" toggle is now grouped under the Conversion card as "Auto-convert new uploads". The Output format dropdown is renamed "Image format(s) to generate" with three explicit choices: Both / WebP only / AVIF only.

= 1.3.2 =
* Fix: **Picture-tag mode now works on page builders** (Elementor, Bricks, Divi, Beaver Builder, Oxygen…). Previously the wrapper relied on the `wp_content_img_tag` filter, which only fires for output that goes through `the_content()` — page-builder output bypasses that filter entirely, so most images were never wrapped. We now post-process the full HTML response on `template_redirect` via output buffering (same approach as Imagify, ShortPixel and other mature WebP plugins). Coverage is total: every `<img>` in `/uploads/` gets wrapped, regardless of which renderer emitted it. Existing manual `<picture>` blocks (theme retina sources, etc.) are detected and left untouched.

= 1.3.1 =
* Fix: Settings changes now auto-purge known page caches (LiteSpeed Cache, WP Rocket, W3 Total Cache, WP Super Cache, SiteGround Optimizer, Cache Enabler, Hummingbird, Autoptimize) so toggles like Display method or CDN passthrough take effect immediately on the frontend instead of needing a manual "Purge all". Each branch is a no-op when the matching plugin isn't installed.
* Fix: The plugin's admin page now sends `nocache_headers()` so aggressive cache layers (e.g. LiteSpeed on Hostinger) can't serve a stale snapshot of `window.TempalooBoot` that would silently roll back saved settings on refresh.

= 1.3.0 =
* New: **CDN passthrough toggle** (Settings → Display method). When you're already on Cloudflare Polish, BunnyCDN Optimizer, ImageKit, Cloudinary, or any similar service that serves WebP from the same `.jpg` URL via Accept negotiation, switch this on and the plugin stops touching your HTML. No URL rewriting, no `<picture>` wrapping — the CDN does its job uninterrupted. Conversion keeps running, so the siblings stay on disk if you ever turn passthrough off.

= 1.2.0 =
* New: **Picture tag display mode** (Settings → Display method). Wraps every `<img>` in `<picture>` with `<source type="image/avif">` + `<source type="image/webp">` entries, leaving the original `<img src="…jpg">` as the universal fallback. Same approach as Imagify (default) and ShortPixel (recommended). More robust than URL rewrite, CDN-friendly (Cloudflare/BunnyCDN/etc.), theme-tolerant. **Default for fresh installs.** Existing installs keep their current URL-rewrite mode — switch in Settings if you want.
* Improved: When picture-tag mode is on, all URL-rewrite filters short-circuit so a single `<img>` never gets double-processed.

= 1.1.9 =
* Fix: Front-end `<img src="…">` now rewrites to the WebP/AVIF sibling on every render. The Gutenberg / classic editor saves the literal `src` into post_content and core only recalculates `srcset` at render time, so without this hook the visible `src` stayed on the original JPG/PNG even when every srcset URL was rewritten — it looked like the bulk did nothing when you viewed the page source. Hooks `wp_content_img_tag` (WP 6.0+).

= 1.1.8 =
* Fix: Media Library thumbnails appeared as solid blue tiles after conversion on some hosts. Root cause: the URL filter rewrote admin URLs to the `.jpg.webp` sibling, and a number of web servers map MIME types from the first recognised extension and end up serving WebP bytes with `Content-Type: image/jpeg`, which the browser can't decode. Admin / AJAX / REST contexts now always serve the original; frontend `<img>` requests still negotiate WebP normally via the Accept header.

= 1.1.7 =
* Improved: Replaced the 8-second admin polling tick with event-driven refresh (tab change, window focus regain, post-action). Removes the "page reloads constantly" feeling.
* Improved: Fresh brand mark across the Next.js favicon, the plugin admin header, and the WordPress sidebar menu icon.
* Improved: Daily bulk cap and free-plan quota are now read live from `/v1/quota` instead of being hardcoded.

= 0.9.0 =
* Improved: Overview now shows the active plan's monthly capacity prominently — a brand-colored pill ("847 / 5,000 images this month"), a 0→max gauge under the quota ring, and a new Quick Actions row (Run Bulk · View activity · Open dashboard).
* New: Skeleton primitive (shimmer animation) used everywhere a fetch is in flight — Activity, Sites, Upgrade, Settings (CPT list).
* Improved: Color tokens audit — every off-brand blue/purple/pink swapped for the brand palette (brand-* / emerald-* / amber-* / red-* / ink-*). ProgressRing gradient, CompressionFactory grinder core, Confetti palette, Toast info kind, and the upgrade nudge are all on-brand now.
* Improved: "Dashboard ↗" link in the admin header now opens /webp/dashboard directly (was the public landing). The dashboard handles the auth flow.

= 0.8.0 =
* New: Activity log tab — chronological event timeline (last 200 events: conversions, license changes, restores, retries) with level filters (success/info/warn/error), CSV export for client invoicing, clear-log action.
* New: Sites tab (visible only on multi-site plans) — current site card, quota visualisation, link to manage all sites on tempaloo.com/dashboard.
* New: Per-content-type quality presets in Settings — pick Inherit / Normal / Aggressive / Ultra per detected public CPT (post, page, product, …). Powered by the existing `tempaloo_quality_for` filter, no PHP needed from you.

= 0.7.1 =
* Fix: missing `useRef` import in ui.tsx broke the admin app entirely on 0.7.0 (`ReferenceError: useRef is not defined`). The PerformanceScorecard / useTween hook needed it. Restored.

= 0.7.0 =
* New: Performance scorecard hero on the Overview tab — big "X% lighter" headline with animated counter, two sub-gauges (bandwidth saved, estimated LCP impact), and a CDN-bill projection at 5,000 visitors/month.
* New: Toast system v2 — typed icons, optional title + description, optional action button, auto-dismiss progress bar at the bottom (pauses on hover), stacks up to 4 visible. Backward-compatible with the old `toast(kind, text)` API.

= 0.6.2 =
* Fix: Bulk page no longer flashes "Scan & start" before showing the real state on reload — replaced with a skeleton during the initial bulk-status fetch. Mid-job reloads land directly on the running view.
* Fix: Free users hitting the daily cap mid-bulk no longer see a misleading celebration. Each terminal state has its own pane (done / paused-quota / paused-daily / canceled) with messaging tailored to it.
* New: PausedView with a clear "what happens next" panel — countdown until the daily cap resets at 00:00 UTC, explicit answer to "will it auto-resume?" (no, click Resume tomorrow OR upgrade), and a progress bar showing how far the original job got.
* New: Cross-fade pane transitions (320ms cubic-bezier) so going between states feels continuous.
* Improved: Completion celebration stays open longer (12s auto-dismiss vs 6s, with a manual Done button always available).

= 0.6.1 =
* New: Restore originals now opens a custom React modal (3-state machine: confirm → running → done) instead of the native browser confirm. Includes a "type RESTORE to confirm" guardrail, animated decompression visual, and a clear what-will-and-won't-be-deleted breakdown.
* New: Animated CompressionFactory mockup in the Bulk pre-flight modal — pulsing core, particle stream, JPG → WebP visual.
* New: Animated FilesStream tape during bulk runs and restore — gives a sense of motion beyond the progress ring.
* New: 3 reusable UI primitives: CompressionFactory (blue/green factory), DecompressionWave (amber wave for restore), FilesStream (horizontal scrolling card tape).

= 0.6.0 =
* New: Bulk pre-flight modal — shows quota, daily-cap and API health checks before starting, with an estimated runtime.
* New: Live processing view during bulk runs — animated progress ring, live-rate ETA, success/failed/remaining counters.
* New: Completion celebration with confetti + 3 next-step CTAs when a bulk job finishes.
* New: Cancel-job confirmation modal (no more accidental cancels).
* New: Smart upgrade nudge in Overview — only appears for engaged Free users (>=40% quota used), dismissible for 30 days, projects when you'll hit the cap.
* New: License key is now locked & masked once active. A "Change" button opens a verify-and-switch modal — kills the footgun where users could wipe their key by tapping the input.
* Improved: shared Modal + Confetti + ProgressRing primitives in the admin UI.

= 0.5.1 =
* New: three developer hooks documented in the new "Developer hooks" section.
  * `tempaloo_skip_attachment` — bypass conversion per attachment
  * `tempaloo_quality_for` — override quality per attachment / format
  * `tempaloo_after_convert` — react to successful conversions (CDN purge, webhooks, logging)

= 0.5.0 =
* New: WP-CLI commands for the agency segment.
  * `wp tempaloo status` — license, plan, quota, API health
  * `wp tempaloo activate <key>` — activate a license
  * `wp tempaloo bulk [--dry-run] [--limit=N]` — convert every pending attachment with a progress bar
  * `wp tempaloo restore [--ids=…] [--yes]` — delete .webp/.avif siblings
  * `wp tempaloo quota` — current monthly usage
  * `wp tempaloo settings get|set <key> [<value>]` — read/write settings (quality, output_format, auto_convert, serve_webp, resize_max_width)

= 0.4.5 =
* Fix (real this time): the multi-file uploader gives each row an id of `media-item-{plupload_uid}`, NOT `media-item-{wp_attachment_id}`. The post-upload stats script now sniffs the real attachment id from the row's Edit link `?post=N`, `data-id`, or `attachments[N]` input names — so the stats line finally appears on `media-new.php`.

= 0.4.4 =
* Fix: post-upload stats now appear reliably on `/wp-admin/media-new.php`. Replaces the previous wp.media-based read with a dedicated admin-ajax endpoint (`tempaloo_stats`) so the script works on the legacy uploader page where wp.media isn't loaded.

= 0.4.3 =
* Fix: post-upload compression stats now appear reliably on `media-new.php` even after WP rewrites the row. Per-row MutationObserver re-injects on every WP render pass.
* Fix: the `tempaloo` payload is now also exposed via the WordPress REST API (`/wp/v2/media/{id}`), so `wp.media.attachment(id).fetch()` sees it.
* Improved: smaller, more accurate dependency on `media-models` instead of `media-views`.

= 0.4.2 =
* New: inline compression stats on the post-upload row of /wp-admin/media-new.php — see "✓ WEBP −67% 1.2 MB → 412 KB · 7 sizes" right next to the filename, no need to click Edit.

= 0.4.1 =
* New: per-attachment compression stats in the Media Library attachment edit panel — instantly visible after upload (`media-new.php`) and in the Media Library modal.
* New: `attachment.tempaloo` field on `wp_prepare_attachment_for_js` so the block editor and custom UIs can read savings without reparsing meta.

= 0.4.0 =
* New: One-click "Restore originals" — wipes every .webp/.avif sibling we wrote, never touches your original JPEG/PNG/GIF files.
* New: Resize-on-upload — pipe a max-width threshold (1920 / 2560 / 3840 / Off) into WordPress core's big-image scaler so huge photos shrink before conversion.
* New: Three quality presets (Normal 85 / Aggressive 75 / Ultra 60) above the slider — covers 95% of use cases without exposing the full range.
* Improved: Settings tab redesigned with clearer sections and a sticky save bar.

= 0.3.0 =
* New: daily bulk cap on the Free plan (50 images/day) — auto-convert on upload stays unlimited within the monthly quota.
* New: in-admin retry queue (WP cron) for conversions that fail due to temporary API unavailability.
* New: "API live" / "API down" status chip in the admin header.
* New: sticky mobile CTA on the public landing page.
* Fix: bulk job now surfaces a clear paused state when the daily limit or monthly quota is hit, with a Resume button.

= 0.2.0 =
* New: Upgrade tab in the admin with in-admin Freemius checkout overlay.
* New: self-service site deactivation to free up license slots.
* New: amber banner when the monthly quota is reached.
* Improved: bulk conversion pause/resume UX.

= 0.1.0 =
* Initial release.

== Upgrade Notice ==

= 0.4.0 =
Adds one-click restore, automatic resize on upload, and 3 quality presets — major UX upgrade.

= 0.3.0 =
Adds a Free-plan daily bulk cap (50/day) and a background retry queue for failed conversions. Upgrade recommended.
