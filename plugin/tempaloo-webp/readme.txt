=== Tempaloo WebP – Image Optimizer & AVIF Converter ===
Contributors: tempaloo
Tags: webp, avif, image-optimization, lazy-load, performance
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 0.4.1
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

== Screenshots ==

1. The dashboard — monthly quota, savings stats, license management.
2. Bulk conversion in progress.
3. Per-attachment conversion badges in the media library.
4. Settings — quality, output format, auto-convert toggle.

== Changelog ==

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
