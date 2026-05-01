# Tempaloo Studio — Widget Authoring Specification

> **Single source of truth.** Every landing page authored on Stitch / Claude Design / hand-coded HTML+CSS+GSAP **must** follow this spec to be cleanly converted into a Tempaloo Studio widget. Following this spec is not optional — it's the contract that makes the conversion possible (and eventually automatic via the planned converter tool).

> **Status:** v0.4 — 2026-05-01. Living document. Every new constraint discovered during a real conversion is added here.
>
> **Plugin identity:**
> - Display name: `Tempaloo Studio`
> - Slug: `tempaloo-studio`
> - PHP namespace: `Tempaloo\Studio\`
> - Text domain: `tempaloo-studio`
> - CSS class prefix: `tw-` (Tempaloo Widget)
> - Token prefix: `--tw-{template-slug}-{role}`

---

## 0. The big idea in 90 seconds

A Tempaloo template (e.g. *Avero Consulting*, *Luxe WooCommerce*) is a **bundle**:

```
{template-slug}/
├── widgets/             ← N PHP widgets, each = one section of a landing page
│   ├── {slug}-hero/
│   ├── {slug}-services/
│   ├── {slug}-pricing/
│   └── …
├── pages/               ← Mockup Elementor pages that compose the widgets
│   ├── home.json
│   ├── about.json
│   └── pricing.json
├── global.css           ← ONE stylesheet, scoped via prefix, owns all design tokens
├── global.js            ← ONE shared JS file (GSAP boot, Lenis, IntersectionObserver helpers)
└── template.json        ← The manifest (variables, fonts, required widgets, pages)
```

When you design on Stitch / Claude:
1. You create **one full landing page** with N sections.
2. You split that page into **independent sections** (each one = a future widget).
3. You apply the rules below to the HTML + CSS so each section becomes droppable as an Elementor widget.
4. (Future) The converter ingests the section + emits the PHP widget skeleton + appends scoped CSS to `global.css`.

**Today's pain:** without this spec, every section conversion = manual rewrite from scratch.
**Tomorrow's win:** with this spec, a section conversion is a 10-minute review of converter output.

---

## 1. The 14 commandments

A widget that follows all 14 rules is **conversion-ready**. A widget that misses any one is **not safe to ship**.

### 1. Top-level wrapper carries the widget identity

```html
<!-- ✅ CORRECT -->
<section class="tw-{template-slug}-{widget-slug}">
  …
</section>
```

- Class prefix is **always** `tw-` (Tempaloo Widget) so we never collide with WordPress core, Elementor, or any other plugin.
- Slug pattern: `tw-{template}-{widget}` → e.g. `tw-avero-hero`, `tw-luxe-shop`.
- Element type can be `section`, `div`, `article`, `header`, `footer` — pick what's semantically correct.

❌ **Banned**: `class="hero"`, `class="container"`, `class="wrapper"`, `class="row"`. Generic words break things downstream.

### 2. BEM-style naming inside the wrapper

```html
<section class="tw-avero-hero">
  <div class="tw-avero-hero__container">
    <div class="tw-avero-hero__content">
      <h1 class="tw-avero-hero__title">…</h1>
      <p class="tw-avero-hero__lead">…</p>
      <div class="tw-avero-hero__cta-row">
        <a class="tw-avero-hero__cta tw-avero-hero__cta--primary">…</a>
        <a class="tw-avero-hero__cta tw-avero-hero__cta--secondary">…</a>
      </div>
    </div>
    <div class="tw-avero-hero__media">
      <img class="tw-avero-hero__image" />
    </div>
  </div>
</section>
```

- `__element` for parts.
- `--modifier` for variants (primary/secondary, light/dark, hover, active).
- **No** generic Tailwind utility classes (`flex`, `mt-4`, `text-xl`). Tempaloo widgets use **semantic class names** with the design tokens applied via `global.css`.

### 3. Every design value = CSS variable, never hardcoded

```css
/* ❌ WRONG */
.tw-avero-hero { background: #ffffff; color: #1a1a1a; padding: 80px 24px; }

/* ✅ CORRECT */
.tw-avero-hero {
  background: var(--tw-avero-bg);
  color: var(--tw-avero-text);
  padding: var(--tw-avero-section-py) var(--tw-avero-section-px);
}
```

**The variable naming pattern is strict:**

```
--tw-{template-slug}-{role}         ← Default value (light theme)
--tw-{template-slug}-{role}-dark    ← Dark theme override (auto-applied via dark selector)
```

Roles allowed (extend as needed but stay semantic, never visual):

| Role | Example use |
|---|---|
| `bg`, `bg-soft`, `bg-strong` | Background colors |
| `text`, `text-soft`, `text-muted` | Text colors |
| `accent`, `accent-hover` | Brand color |
| `border`, `border-strong` | Borders |
| `nav-text`, `nav-hover` | Navigation specific |
| `cta-primary`, `cta-primary-hover`, `cta-secondary`, `cta-secondary-hover` | Buttons |
| `radius-sm`, `radius-md`, `radius-lg` | Border radius scale |
| `space-1`, `space-2`, `space-3`, `space-4`, `space-5` | Spacing scale |
| `shadow-sm`, `shadow-md`, `shadow-lg` | Shadow scale |
| `font-heading`, `font-body`, `font-mono` | Font families |

**Banned roles**: visual-named tokens (`--tw-avero-orange`, `--tw-avero-large-padding`). Pick the semantic name; the value can change without renaming.

### 4. Light + dark mode is the SAME class, different variable values

The dark mode is **not** a separate class structure. It's the same widget with overridden variables.

```css
/* In global.css */

:root {
  --tw-avero-bg:           #ffffff;
  --tw-avero-text:         #1a1a1a;
  --tw-avero-accent:       #214d47;
  --tw-avero-cta-primary:  #214d47;
}

[data-theme="dark"] {
  --tw-avero-bg:           #0a0f0e;
  --tw-avero-text:         #f5f5f5;
  --tw-avero-accent:       #3fb2a2;
  --tw-avero-cta-primary:  #3fb2a2;
}

/* Widget rules NEVER reference the dark selector — they only consume vars */
.tw-avero-hero { background: var(--tw-avero-bg); color: var(--tw-avero-text); }
```

The **dark selector** (`[data-theme="dark"]`, `body.dark-mode`, `.dark`, etc.) is declared **once** in `template.json` and only the variable block above re-declares values under it. **Never** write `.dark .tw-avero-hero { color: white; }` — that's the legacy approach we're abandoning.

### 5. All editable text = an Elementor control

If a piece of text could ever change between sites (= 99% of text), it must come from an Elementor control:

```php
// In the widget's register_controls()
$this->add_control('title', [
  'label'   => __('Title', 'tempaloo-studio'),
  'type'    => Controls_Manager::TEXTAREA,
  'default' => 'Expert consulting that drives real growth',
]);
```

Then in `render()`:
```php
$settings = $this->get_settings_for_display();
echo '<h1 class="tw-avero-hero__title">' . wp_kses_post($settings['title']) . '</h1>';
```

The default value **lives in the PHP widget**, not in the HTML mockup. The HTML mockup uses placeholder text only for the design phase.

### 6. All editable images = MEDIA control

```php
$this->add_control('hero_image', [
  'label'   => __('Hero image', 'tempaloo-studio'),
  'type'    => Controls_Manager::MEDIA,
  'default' => ['url' => Tempaloo_Plugin::ASSETS_URL . 'images/avero/hero.png'],
]);
```

Default lives in `assets/images/{template}/`. Path is resolved via the plugin's URL constant — never hardcoded.

### 7. All links = URL control

```php
$this->add_control('cta_url', [
  'label'   => __('CTA link', 'tempaloo-studio'),
  'type'    => Controls_Manager::URL,
  'default' => ['url' => '#contact', 'is_external' => false, 'nofollow' => false],
]);
```

In `render()`:
```php
$cta = $settings['cta_url'];
$attrs = '';
if (!empty($cta['is_external'])) $attrs .= ' target="_blank" rel="noopener"';
if (!empty($cta['nofollow']))    $attrs .= ' rel="nofollow"';
echo '<a href="' . esc_url($cta['url']) . '"' . $attrs . ' class="tw-avero-hero__cta tw-avero-hero__cta--primary">' . esc_html($cta_text) . '</a>';
```

### 8. Repeating items = REPEATER control

A list of features, services, testimonials, pricing tiers — anything that's **N items of the same shape** — uses `Controls_Manager::REPEATER`.

```php
$repeater = new Repeater();
$repeater->add_control('item_title', [...]);
$repeater->add_control('item_icon', [...]);
$repeater->add_control('item_description', [...]);

$this->add_control('items', [
  'type'    => Controls_Manager::REPEATER,
  'fields'  => $repeater->get_controls(),
  'default' => [/* 3 sample items */],
  'title_field' => '{{{ item_title }}}',
]);
```

Then in `render()`, foreach. **Never** hardcode a number of items in the HTML.

### 9. Animations: GSAP via shared `global.js`, scoped to root

```js
// global.js — loaded once per template
window.tempaloo = window.tempaloo || {};
window.tempaloo.avero = {
  hero: function(rootEl) {
    if (!window.gsap) return;
    const title = rootEl.querySelector('.tw-avero-hero__title');
    const cta   = rootEl.querySelectorAll('.tw-avero-hero__cta');
    gsap.from(title, { opacity: 0, y: 30, duration: 0.8, ease: 'power3.out' });
    gsap.from(cta,   { opacity: 0, y: 20, duration: 0.6, delay: 0.3, stagger: 0.1 });
  },
};

// Auto-init on frontend
document.querySelectorAll('.tw-avero-hero').forEach(window.tempaloo.avero.hero);

// Auto-init in Elementor editor (re-fires on each edit)
if (window.elementorFrontend) {
  elementorFrontend.hooks.addAction('frontend/element_ready/avero-hero.default', ($el) => {
    window.tempaloo.avero.hero($el[0]);
  });
}
```

**Three rules for JS**:
1. **One init function per widget**, takes `rootEl` as parameter.
2. **Scoped queries** (`rootEl.querySelector(…)`), never `document.querySelector(…)`.
3. **Both frontend AND editor handlers** (Elementor reloads widgets on every edit).

GSAP is loaded once per template via the template's `global.js`. Don't re-include it per widget.

### 10. Responsive = Elementor breakpoints + CSS clamp

For most spacing/typography, prefer `clamp()` so the widget scales fluidly without needing per-breakpoint controls:

```css
.tw-avero-hero__title {
  font-size: clamp(2rem, 5vw, 4rem);
  line-height: 1.1;
}
.tw-avero-hero { padding: clamp(48px, 8vw, 120px) clamp(16px, 4vw, 48px); }
```

For things the user must control per-device (e.g. hide-on-mobile, change-image-on-tablet), use Elementor's responsive controls:

```php
$this->add_responsive_control('show_image', [
  'label' => __('Show image', 'tempaloo-studio'),
  'type'  => Controls_Manager::SWITCHER,
  'desktop_default' => 'yes',
  'tablet_default'  => 'yes',
  'mobile_default'  => 'no',
  'selectors' => [
    '{{WRAPPER}} .tw-avero-hero__media' => 'display: {{VALUE}};',
  ],
]);
```

#### 10.b — Elementor ships SIX breakpoint slots — know which are active

Elementor exposes 6 breakpoint slots in **Site Settings → Layout → Breakpoints**, but only **2 are active by default** (mobile + tablet). The user can toggle the other 4 on at any time. A widget claiming to be "natively Elementor-compatible" must be aware of all 6.

| Alias          | Default value | Direction  | Active **out of the box** | Common use |
|----------------|---------------|------------|---------------------------|------------|
| `mobile`       |  767 px       | max-width  | ✅ yes                    | Phone-only changes |
| `mobile_extra` |  880 px       | max-width  | ❌ off                    | Large phones / phablets |
| `tablet`       | 1024 px       | max-width  | ✅ yes                    | Typical 2-col → 1-col collapse |
| `tablet_extra` | 1200 px       | max-width  | ❌ off                    | Small laptops |
| `laptop`       | 1366 px       | max-width  | ❌ off                    | Standard laptops |
| `widescreen`   | 2400 px       | **min-width** | ❌ off                | Very large screens (note: `min`, not `max`) |

**Rules for `global.css` authoring:**

✅ **Correct**: `@media (max-width: 1024px) { … }` (Elementor's tablet default)
✅ **Correct**: `@media (min-width: 2400px) { … }` (Elementor's widescreen — note `min`)
❌ **Wrong**: `@media (max-width: 880px) { … }` (`mobile_extra` is OFF by default — most sites won't have this enabled, so the threshold won't snap with Elementor's other widgets)

**Pick from {mobile, tablet} for default-on rules.** If you need the optional thresholds (mobile_extra / tablet_extra / laptop / widescreen), the template's documentation must tell users to enable them — otherwise the Breakpoints class can't override them at runtime.

#### 10.c — `template.json::responsive_overrides` (declare what to re-emit)

If the user customizes Elementor breakpoints (e.g. moves `tablet` from 1024 → 960), `global.css` is now wrong for that site. The runtime `Breakpoints` class fixes it — but only if the template declares **which structural rules need re-emitting** at the user's chosen value. Schema:

```json
"responsive_overrides": [
  {
    "alias":     "tablet",      // any of the 6 slots above
    "direction": "max",         // "max" or "min" — must match the alias's direction
    "default":   1024,          // value used when authoring global.css
    "rules":     ".tw-avero-hero__container { grid-template-columns: 1fr; gap: 48px; }"
  },
  {
    "alias":     "mobile",
    "direction": "max",
    "default":   767,
    "rules":     ".tw-avero-hero { padding: clamp(48px,12vw,96px) clamp(16px,5vw,32px); }"
  }
]
```

When the active breakpoint value matches `default`, no override is emitted (no-op). When it differs (or the alias was disabled and got re-enabled with a custom value), the same rules are re-emitted at the new threshold. Yes, this is duplicated authoring (CSS in `global.css` AND mirrored in `template.json`), but it's the only way to support customized breakpoints without parsing arbitrary CSS at runtime.

#### 10.d — Reading active breakpoints in widget JS

The Breakpoints class exposes the active site values plus two helpers to widget JS:

```js
var ts = (window.tempaloo && window.tempaloo.studio) || {};

// Raw map: alias → { value: <px>, direction: 'max' | 'min' }
var bps = ts.breakpoints || {};
console.log(bps.mobile);  // → { value: 767, direction: 'max' }

// Helper 1 — build a matchMedia query string for an alias
var q = ts.bpQuery && ts.bpQuery('mobile');   // → "(max-width: 767px)"

// Helper 2 — boolean shortcut
if (ts.bpMatches && ts.bpMatches('mobile')) {
  // Mobile-only animation tweak.
}

// Optional aliases — guard, the user might not have enabled them
if (ts.bpMatches && ts.bpMatches('widescreen')) {
  // Only fires on sites that turned widescreen on.
}
```

**Never hardcode `767`, `1024`, or any breakpoint value in widget JS.** Always go through `bpQuery` / `bpMatches` so the widget tracks the user's Site Settings.

### 11. Output escaping is non-negotiable

Plugin Check rejects unescaped output. Use the right wrapper for each context:

| Context | Function |
|---|---|
| Plain text | `esc_html($x)` |
| HTML attribute (class, id, data-*) | `esc_attr($x)` |
| URL (href, src) | `esc_url($x)` |
| Rich text with limited HTML (titles with `<em>`) | `wp_kses_post($x)` |
| Inline SVG block | `tempaloo_safe_svg($x)` (custom helper that whitelists svg tags) |
| Translation | `esc_html__($x, 'tempaloo-studio')` or `esc_attr__(…)` |

**Never** echo a variable directly. Even `echo $settings['title']` is a rejection.

### 12. The widget MUST be re-renderable infinitely

Elementor re-renders widgets on every edit in the editor. Your widget must survive that.

- ❌ Don't use `setInterval` without cleanup.
- ❌ Don't append global event listeners (`window.addEventListener('scroll', …)`) without an unregister.
- ❌ Don't rely on the widget being inserted only once per page.
- ✅ Idempotent JS: re-initing the same widget on the same root element does nothing harmful.
- ✅ Multiple instances of the same widget on the same page work without conflict.

### 13. Live preview via `_content_template()` (text-heavy widgets)

Elementor renders widgets server-side via PHP `render()` — so by default, every keystroke in a control would require a full iframe reload to be reflected in the preview. That's painfully slow.

The fix: ship a `_content_template()` method that re-implements `render()` as an Underscore.js template. When the user edits a control in the panel, Elementor runs this template client-side inside the editor iframe and the change appears **instantly**.

```php
protected function _content_template(): void {
    ?>
    <#
    var title = settings.title || '';
    // _.escape() is Underscore's built-in escape — Elementor preloads it.
    var safeTitle = _.escape(title)
        .replace(/&lt;em&gt;/g, '<em>')
        .replace(/&lt;\/em&gt;/g, '</em>')
        .replace(/\n/g, '<br>');
    #>
    <section class="tw-avero-hero">
        <h1 class="tw-avero-hero__title">{{{ safeTitle }}}</h1>
        <# if ( settings.lead ) { #>
            <p class="tw-avero-hero__lead">{{{ settings.lead }}}</p>
        <# } #>
    </section>
    <?php
}
```

Rules:
- **Method name MUST be `_content_template`** (with leading underscore — Elementor's canonical hook).
- **Mirror the structure of `render()` exactly** — same classes, same nesting. Otherwise the preview shifts when the user saves.
- **`{{ x }}`** → escaped, **`{{{ x }}}`** → unescaped. Use `{{ }}` by default, `{{{ }}}` only when you've already sanitized via `_.escape()` + manual un-escape of allowed tags.
- **Skip URL controls and complex MEDIA controls** — those rarely matter for live preview and adding them just bloats the template. The user can save then preview for those.
- **`settings` is the JS counterpart of `$this->get_settings_for_display()`** — every control name you used in `register_controls()` is on it.
- **Idempotent**: this template runs many times per second while the user types. No side effects, no listeners — just markup.

When you ship a widget without `_content_template()`, the editor shows a "Click to start editing" placeholder until the user saves. That's not what users expect from a "premium template" plugin — every text-heavy widget MUST have it.

### 14. ALL JS via `tempaloo.studio.delegate()` + `onReady()` — never element-bound listeners

The plugin core ships `tempaloo.studio.delegate(selector, eventType, handler)` for clicks/changes and `tempaloo.studio.onReady(selector, fn)` for per-instance setup (animations, scroll listeners). **Every widget script.js MUST use these** — never `el.addEventListener()` directly on widget DOM elements.

```js
// ❌ WRONG — element-bound listener
btn.addEventListener('click', handler);

// ✅ CORRECT — document-level delegation
ts.delegate('.tw-{template}-mywidget__btn', 'click', function (e, btn) {
    e.preventDefault();
    /* handler */
});

// ✅ CORRECT — per-instance animation init
ts.onReady('.tw-{template}-mywidget', function (rootEl) {
    /* setup GSAP timeline / scroll listener / etc. */
});
```

**Why this is non-negotiable:**

1. **Survives Elementor editor re-renders.** Every keystroke in a widget's control replaces the widget DOM via the underscore template (rule §13). Old element-bound listeners disappear silently. Delegation is bound to `document` ONCE — clicks always reach the handler regardless of how many times Elementor re-mounts the markup.

2. **Survives Elementor's editor click-swallowers.** The editor wraps widgets in click-capturing overlays so users can select+edit them. Delegation runs in the **capture phase** (`addEventListener(..., true)`) — our handlers fire BEFORE Elementor's interceptor.

3. **No timing race.** When the script loads, the widget DOM may not exist yet (Elementor renders it asynchronously). Delegation is registered before any DOM exists; clicks on widgets that mount later still work without retries or polling.

4. **Idempotent by construction.** `onReady` re-fires when Elementor mounts a new instance. Each call to `delegate` adds to a single document dispatcher — no duplicate listeners no matter how many times the widget script evaluates.

**The audit:** every widget that has any JS interactivity has been migrated to this pattern. Reference implementations:

| Widget | Has clicks | Has init | Pattern |
|---|---|---|---|
| header     | yes (toggle, menu, drawer close, ESC, backdrop) | yes (sticky section, scroll) | `delegate` × 4 + `onReady` |
| services   | no | yes (GSAP stagger) | `onReady` |
| testimonials | yes (dots) | yes (rotator + autoplay timer) | `delegate` + `onReady` |
| faq        | yes (question buttons) | no | `delegate` only |
| cta        | no | yes (entrance + halo) | `onReady` |
| hero       | no | yes (timeline) | `onReady` |
| pricing, footer | no | no | no script.js needed |

**Future widgets that don't follow this pattern will be reverted in code review** — there is no scenario where direct element binding is acceptable inside a Tempaloo Studio widget.

---

## 2. Anatomy of a widget — the file layout

```
widgets/avero-hero/
├── widget.php       ← The PHP class (always present)
├── script.js        ← Optional — only if widget needs custom JS animations
└── README.md        ← Optional — design-spec notes, palette refs, sources
```

The `class-{widget}.php` extends a shared `Tempaloo\Elementor\Widget_Base` (our own thin layer over `\Elementor\Widget_Base`) which:
- Auto-registers `script.js` if present.
- Emits the widget into the right category (`tempaloo-{template-slug}`).
- Provides shared helpers (`render_cta()`, `render_icon()`, etc.).

---

## 3. Anatomy of a template — the file layout

```
templates/avero-consulting/
├── template.json         ← Manifest (variables, fonts, widgets, pages)
├── global.css            ← ONE stylesheet for all widgets in this template
├── global.js             ← ONE bootstrapper (GSAP, Lenis, observer helpers)
├── pages/
│   ├── home.json         ← Elementor JSON export of the home page mockup
│   ├── about.json
│   ├── services.json
│   └── contact.json
├── widgets/
│   ├── avero-header/
│   ├── avero-hero/
│   ├── avero-services/
│   ├── avero-pricing/
│   ├── avero-testimonials/
│   ├── avero-faq/
│   ├── avero-cta/
│   └── avero-footer/
└── assets/
    ├── images/
    │   ├── hero.png
    │   ├── feature-1.png
    │   └── …
    └── fonts/            ← Optional — only if not using Google Fonts
```

### `template.json` schema

```json
{
  "slug": "avero-consulting",
  "name": "Avero Consulting",
  "version": "1.0.0",
  "description": "Premium consulting agency template with GSAP scroll animations.",
  "category": "consulting",
  "thumbnail": "assets/images/thumbnail.jpg",

  "fonts": {
    "primary": "'Inter', sans-serif",
    "heading": "'Hedvig Letters Serif', serif",
    "google_fonts_url": "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Hedvig+Letters+Serif:opsz@12..24&display=swap"
  },

  "tokens": {
    "light": {
      "--tw-avero-bg":               "#ffffff",
      "--tw-avero-text":             "#1a1a1a",
      "--tw-avero-accent":           "#214d47",
      "--tw-avero-cta-primary":      "#214d47",
      "--tw-avero-cta-primary-hover": "#2a615a",
      "--tw-avero-border":           "rgba(0, 0, 0, 0.05)"
    },
    "dark": {
      "--tw-avero-bg":               "#0a0f0e",
      "--tw-avero-text":             "#f5f5f5",
      "--tw-avero-accent":           "#3fb2a2",
      "--tw-avero-cta-primary":      "#3fb2a2",
      "--tw-avero-cta-primary-hover": "#4dcabd",
      "--tw-avero-border":           "rgba(255, 255, 255, 0.08)"
    },
    "dark_selector": "[data-theme=\"dark\"]"
  },

  "global_css": "global.css",
  "global_js":  "global.js",

  "required_plugins": [
    { "slug": "elementor", "min_version": "3.20.0" }
  ],

  "widgets": [
    "avero-header",
    "avero-hero",
    "avero-services",
    "avero-pricing",
    "avero-testimonials",
    "avero-faq",
    "avero-cta",
    "avero-footer"
  ],

  "responsive_overrides": [
    {
      "alias":     "tablet",
      "direction": "max",
      "default":   1024,
      "rules":     ".tw-avero-hero__container{grid-template-columns:1fr;gap:48px;}"
    },
    {
      "alias":     "mobile",
      "direction": "max",
      "default":   767,
      "rules":     ".tw-avero-hero{padding:clamp(48px,12vw,96px) clamp(16px,5vw,32px);} .tw-avero-hero__container{gap:32px;}"
    }
  ],

  "pages": [
    {
      "title":           "Home",
      "slug":            "home",
      "page_template":   "elementor_canvas",
      "elementor_data":  "pages/home.json"
    },
    { "title": "About",    "slug": "about",    "page_template": "elementor_canvas", "elementor_data": "pages/about.json" },
    { "title": "Services", "slug": "services", "page_template": "elementor_canvas", "elementor_data": "pages/services.json" },
    { "title": "Contact",  "slug": "contact",  "page_template": "elementor_canvas", "elementor_data": "pages/contact.json" }
  ]
}
```

---

## 4. Authoring workflow — Stitch / Claude → widget

### Step 1 — Brief
Write a 1-page brief in `templates/{template-slug}/BRIEF.md`:
- Niche (consulting, e-commerce, agency, …)
- Vibe (premium, playful, editorial, …)
- Color palette (5-7 colors, light + dark)
- Typography (heading + body fonts)
- Pages needed (home, about, …)
- Sections per page (hero, services, …)

### Step 2 — Generate the design
Use Stitch / Claude Design / hand-coded HTML to produce **one full landing page per page in the brief**. Constraints during generation (paste these in the prompt):
- Use BEM class names with prefix `tw-{template-slug}-{section-slug}`.
- Use CSS custom properties for ALL colors, spacings, fonts.
- No Tailwind utility classes — semantic class names only.
- Animations via GSAP in a `<script>` block (we'll extract later).

### Step 3 — Section breakdown
List each section of the page that will become a widget. Example for an Avero homepage:
```
home.html sections:
  1. tw-avero-header        → widget avero-header
  2. tw-avero-hero          → widget avero-hero
  3. tw-avero-services      → widget avero-services
  4. tw-avero-stats         → widget avero-stats
  5. tw-avero-pricing       → widget avero-pricing
  6. tw-avero-testimonials  → widget avero-testimonials
  7. tw-avero-cta           → widget avero-cta
  8. tw-avero-footer        → widget avero-footer
```

### Step 4 — CSS extraction
Move all CSS to `templates/{slug}/global.css`. Order:
```css
/* 1. Token declarations */
:root { --tw-avero-bg: …; … }
[data-theme="dark"] { --tw-avero-bg: …; … }

/* 2. Reset / base for the template scope (optional) */

/* 3. Per-widget rules, grouped by widget-slug */
.tw-avero-header { … }
.tw-avero-header__nav { … }
.tw-avero-header__cta { … }

.tw-avero-hero { … }
.tw-avero-hero__title { … }
…
```

### Step 5 — Widget conversion
For each section, create `widgets/{slug}/widget.php` with:
- `register_controls()` — every editable text/image/link gets a control. Defaults match the design.
- `render()` — outputs the exact same HTML structure as the design, but values come from `$settings`.

Use the **starter template** in section 6 below.

### Step 6 — Page mockup export
After installing the plugin and assembling the page in Elementor with the widgets, **export the Elementor page** (Templates → Saved Templates → Export) and save the JSON to `templates/{slug}/pages/{page-slug}.json`. This is what the Import Engine will replay on user installs.

### Step 7 — Test
- Install the plugin on a clean WP local.
- Activate the template from the React admin.
- Verify the home page renders identically to the original Stitch/Claude design.
- Toggle dark mode → all colors swap, no broken contrast.
- Edit one widget's title → page updates.
- Run Plugin Check → 0 errors.

### Step 8 — Ship
Bump version, build ZIP, push to WordPress.org (same flow as Tempaloo WebP).

---

## 5. Prompting playbook — engineering prompts for Stitch / Claude Design / Claude

> The unlock: **constrain the AI before it generates**, not after. Every "fix the CSS naming" round-trip you skip = 30 minutes saved. The prompts below bake this entire spec into the design phase, so the HTML you receive is already conversion-ready.

### 5.0 Why prompt engineering matters here

Generic prompt:
> "Build me a SaaS landing page hero in HTML and CSS"

Result: random class names (`hero`, `container`), Tailwind utilities, hardcoded `#fff` colors, no dark mode, GSAP not scoped, untranslatable text. **3-5 hours of cleanup per section.**

Engineered prompt (using the templates below):
> Same brief + 80 lines of constraints from this spec.

Result: HTML already named `tw-{template}-hero`, CSS variables for every value, dark mode block, GSAP scoped. **10-minute review.**

The leverage ratio is roughly **18-30×**. That's the ROI of investing in prompt engineering.

---

### 5.1 The anatomy of a good Tempaloo Studio prompt

Every prompt has **6 blocks**, in this exact order. Skip any block → you'll re-do work.

```
┌─────────────────────────────────────────────────────────┐
│ 1. ROLE       — who the AI is acting as                 │
│ 2. CONTEXT    — what we're building (Tempaloo Studio)   │
│ 3. CONSTRAINTS — the spec rules, in machine-checkable form │
│ 4. INPUTS     — design brief (palette, fonts, sections) │
│ 5. OUTPUT FORMAT — exact deliverable shape (HTML+CSS+JS) │
│ 6. EXAMPLES   — 1-2 mini-snippets to anchor the style   │
└─────────────────────────────────────────────────────────┘
```

The constraint block (#3) is the **non-negotiable contract**. Always paste the same canonical version. The brief (#4) is the only block that changes per section.

---

### 5.2 Master prompt template (copy + paste, full)

> **Use this for**: generating a complete landing page or a single section. Replace the `{{PLACEHOLDERS}}`. The 6 blocks are labeled with comments.

````
# 1. ROLE
You are a senior front-end engineer specialized in WordPress + Elementor.
You design HTML + CSS + (optionally) GSAP-powered JS that follows the
Tempaloo Studio Widget Authoring Specification verbatim. Treat the
constraints in section 3 as a contract: any deviation forces hours of
manual rewrite, so you must respect every rule.

# 2. CONTEXT
We are authoring a section that will be converted into a PHP Elementor
widget for the "Tempaloo Studio" plugin. The plugin ships premium
templates organized by niche; each template (slug = "{{TEMPLATE_SLUG}}")
has its own widgets, CSS variables, and dark/light theme. Your output
is the HTML/CSS/JS for ONE section that will become ONE widget.

Template slug:  {{TEMPLATE_SLUG}}    e.g. "avero", "luxe", "aero"
Widget slug:    {{WIDGET_SLUG}}      e.g. "hero", "pricing", "footer"
Section name:   {{SECTION_NAME}}     e.g. "Hero with rating + dual CTA"

# 3. CONSTRAINTS — non-negotiable, the build-or-die rules

## CSS class naming
- Top-level wrapper: `tw-{{TEMPLATE_SLUG}}-{{WIDGET_SLUG}}` (no exceptions)
- Inside the wrapper: BEM with the same prefix:
    `tw-{{TEMPLATE_SLUG}}-{{WIDGET_SLUG}}__{element}`
    `tw-{{TEMPLATE_SLUG}}-{{WIDGET_SLUG}}__{element}--{modifier}`
- BANNED class names: `hero`, `container`, `wrapper`, `row`, `col`, `box`,
  `card`, `btn`, `text`, `title` — anything generic.
- BANNED utility classes: NO Tailwind, NO Bootstrap, NO `flex`, `mt-4`,
  `text-xl`, `grid-cols-3`, etc. Use semantic class names that describe
  the element's role, not its appearance.

## CSS variables (design tokens)
- Every color, font, spacing, radius, shadow MUST be a CSS custom
  property. NEVER hardcode hex/rgb/px values in widget rules.
- Variable naming: `--tw-{{TEMPLATE_SLUG}}-{role}` where role is one of:
    bg, bg-soft, bg-strong
    text, text-soft, text-muted
    accent, accent-hover
    border, border-strong
    nav-text, nav-hover
    cta-primary, cta-primary-hover, cta-secondary, cta-secondary-hover
    radius-sm, radius-md, radius-lg
    space-1 .. space-5
    shadow-sm, shadow-md, shadow-lg
    font-heading, font-body, font-mono
- Declare the FULL set of tokens at `:root`, then OVERRIDE the colors
  under `[data-theme="dark"]`. Widget rules consume `var(--tw-...)`
  ONLY — they NEVER reference the dark selector.
- Banned token names: visual-named ones like `--tw-{{TEMPLATE_SLUG}}-orange`.
  Always semantic.

## Light + dark mode
- Same HTML, same classes. Only the variable VALUES change.
- Dark selector: `[data-theme="dark"]` (will be flipped at runtime by
  the plugin). Do NOT write `.dark .my-class { ... }` rules.

## Fonts
- Two families: heading + body. Both declared as CSS variables
  (`--tw-{{TEMPLATE_SLUG}}-font-heading`, `--tw-{{TEMPLATE_SLUG}}-font-body`).
- Provide the Google Fonts URL as a comment at the top of the CSS.
- Use `clamp()` for fluid font-size scaling instead of media queries
  whenever possible (hero titles especially).

## Animations
- If the section needs animation, write a SINGLE init function that
  takes `rootEl` as parameter:
    function init(rootEl) { /* GSAP queries are rootEl.querySelector(...) */ }
- All queries scoped to `rootEl`, NEVER `document.querySelector(...)`.
- The function must be IDEMPOTENT (re-running it on the same root is
  harmless) and SCOPED (multiple instances on the same page work).
- Auto-init both for frontend AND for the Elementor editor:
    document.querySelectorAll('.tw-{{TEMPLATE_SLUG}}-{{WIDGET_SLUG}}').forEach(init);
    if (window.elementorFrontend) {
      elementorFrontend.hooks.addAction(
        'frontend/element_ready/{{TEMPLATE_SLUG}}-{{WIDGET_SLUG}}.default',
        ($el) => init($el[0])
      );
    }

## HTML output rules
- Use semantic HTML (`section`, `article`, `header`, `footer`, `nav`).
- All editable text is plain text inside the markup (no JS interpolation).
- All editable images use `<img src="placeholder">` with descriptive alt.
- All editable links use real `<a href="#anchor">` (#anchor placeholders ok).
- Repeating items (services, pricing tiers, testimonials) appear as
  N items hard-coded in the HTML mockup — they will be turned into a
  REPEATER control later. Use 3 sample items as default.

## Banned patterns (will fail conversion)
- Inline `style="..."` attributes
- `<script>` tags inside `render()` zones
- `getElementById()`, `document.querySelector()` in widget JS
- Hardcoded counts of items (use a repeater pattern instead)
- Per-widget GSAP load (loaded once at template level)
- Generic class names from rule above

# 4. INPUTS — the design brief (you fill these)

Niche/vibe:        {{e.g. "Premium consulting agency, calm + editorial"}}
Color palette:
  Light mode primary background:    {{#ffffff}}
  Light mode primary text:           {{#1a1a1a}}
  Light mode brand accent:           {{#214d47}}
  Light mode brand accent hover:     {{#2a615a}}
  Light mode subtle border:          {{rgba(0,0,0,0.05)}}
  Dark mode primary background:      {{#0a0f0e}}
  Dark mode primary text:            {{#f5f5f5}}
  Dark mode brand accent:            {{#3fb2a2}}
  Dark mode brand accent hover:      {{#4dcabd}}
  Dark mode subtle border:           {{rgba(255,255,255,0.08)}}
Typography:
  Heading font:  {{'Hedvig Letters Serif', serif}}
  Body font:     {{'Inter', sans-serif}}
  Google Fonts URL: {{https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Hedvig+Letters+Serif&display=swap}}
Section spec:
  Layout:   {{e.g. "Two-column, content left + image right, 60/40 split"}}
  Content:  {{e.g. "Rating badge (e.g. 'Rated 4.9/5'), H1 (~10 words), lead paragraph (~25 words), 2 CTA buttons (primary filled + secondary outline), product hero image"}}
  Vibe:     {{e.g. "Premium and calm, generous whitespace, restrained motion"}}
  Animation: {{e.g. "Title slides up + fades in on load (GSAP), CTAs stagger in 200ms after"}}

# 5. OUTPUT FORMAT — exactly 3 code blocks in this order

Block 1: HTML
- Single self-contained `<section class="tw-{{TEMPLATE_SLUG}}-{{WIDGET_SLUG}}">` block
- No `<head>`, no `<html>` — just the section markup
- Comment one line above each major part (`<!-- Rating badge -->`, etc.)

Block 2: CSS
- Order: (a) Google Fonts @import comment, (b) :root token declarations,
  (c) [data-theme="dark"] token overrides, (d) widget rules, ordered
  parent-to-child.
- Wrap the CSS in a `/* ====== tw-{{TEMPLATE_SLUG}}-{{WIDGET_SLUG}} ====== */`
  banner comment.

Block 3: JavaScript (only if the section has animations)
- Single IIFE
- Implements the init(rootEl) pattern documented in Constraints/Animations
- Loads GSAP via the global tempaloo namespace assumption (don't import
  GSAP — assume `window.gsap` is available, fallback to noop if not)

After the three blocks, write a 4-bullet "Conversion notes" section that
lists for the human reviewer:
  - Editable controls expected (Title, Lead, CTA Primary text + URL, ...)
  - Repeater controls expected (if any)
  - Default values to use in the PHP widget
  - Any departure from the spec (justified, ideally none)

# 6. EXAMPLES — anchor the style

Reference structure (do not copy verbatim, this is a style anchor):

```html
<section class="tw-avero-hero">
  <div class="tw-avero-hero__container">
    <div class="tw-avero-hero__content">
      <span class="tw-avero-hero__rating">⭐ Rated 4.9/5</span>
      <h1 class="tw-avero-hero__title">Expert consulting that drives real growth</h1>
      <p class="tw-avero-hero__lead">Tailored strategies for serious teams.</p>
      <div class="tw-avero-hero__cta-row">
        <a class="tw-avero-hero__cta tw-avero-hero__cta--primary" href="#contact">Get in touch</a>
        <a class="tw-avero-hero__cta tw-avero-hero__cta--secondary" href="#services">What we do</a>
      </div>
    </div>
    <div class="tw-avero-hero__media">
      <img class="tw-avero-hero__image" src="placeholder.jpg" alt="Consulting team in workshop" />
    </div>
  </div>
</section>
```

```css
/* ====== tw-avero-hero ====== */
/* @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Hedvig+Letters+Serif&display=swap'); */

:root {
  --tw-avero-bg:                 #ffffff;
  --tw-avero-text:               #1a1a1a;
  --tw-avero-accent:             #214d47;
  --tw-avero-cta-primary:        #214d47;
  --tw-avero-cta-primary-hover:  #2a615a;
  --tw-avero-border:             rgba(0,0,0,0.05);
  --tw-avero-font-heading:       'Hedvig Letters Serif', serif;
  --tw-avero-font-body:          'Inter', sans-serif;
}
[data-theme="dark"] {
  --tw-avero-bg:                 #0a0f0e;
  --tw-avero-text:               #f5f5f5;
  --tw-avero-accent:             #3fb2a2;
  --tw-avero-cta-primary:        #3fb2a2;
  --tw-avero-cta-primary-hover:  #4dcabd;
  --tw-avero-border:             rgba(255,255,255,0.08);
}

.tw-avero-hero {
  background: var(--tw-avero-bg);
  color: var(--tw-avero-text);
  font-family: var(--tw-avero-font-body);
  padding: clamp(48px, 8vw, 120px) clamp(16px, 4vw, 48px);
}
.tw-avero-hero__container {
  max-width: 1200px; margin: 0 auto;
  display: grid; grid-template-columns: 6fr 4fr; gap: clamp(24px, 4vw, 64px);
  align-items: center;
}
.tw-avero-hero__title {
  font-family: var(--tw-avero-font-heading);
  font-size: clamp(2rem, 5vw, 3.75rem);
  line-height: 1.1; margin: 0 0 16px;
}
/* ... rest follows the same pattern */
```

Now produce the section using the inputs in block 4. Adhere strictly to
every constraint in block 3.
````

---

### 5.3 Per-section quick prompt (when you already have tokens declared)

When the template's `:root` and `[data-theme="dark"]` blocks already exist (you've shipped 1+ widgets in this template), you only need a SHORTER prompt for the next section. Use this:

```
# Tempaloo Studio — additional widget for template "{{TEMPLATE_SLUG}}"

Existing tokens (do NOT redeclare): refer to global.css of template "{{TEMPLATE_SLUG}}".
Available roles: bg, bg-soft, text, text-soft, text-muted, accent, accent-hover,
border, cta-primary, cta-primary-hover, cta-secondary, radius-{sm,md,lg},
space-{1..5}, shadow-{sm,md,lg}, font-heading, font-body.

Build a new widget:
  Slug:    {{WIDGET_SLUG}}
  Section: {{SECTION_NAME}}
  Layout:  {{LAYOUT_DESCRIPTION}}
  Content: {{CONTENT_LIST}}
  Vibe:    {{VIBE}}
  Animation: {{ANIMATION_NEEDS}}

Output 3 blocks (HTML + CSS-additions-only + JS-if-needed) following
the Tempaloo Studio spec rules:
  - Wrapper class: tw-{{TEMPLATE_SLUG}}-{{WIDGET_SLUG}}
  - BEM inside (__element, --modifier)
  - All values via var(--tw-{{TEMPLATE_SLUG}}-{role})
  - No new tokens unless absolutely necessary; if needed list them in
    a separate "New tokens to add" block at the end with proposed
    light + dark values.
  - clamp() for fluid sizing
  - JS scoped to rootEl, idempotent, with editor + frontend init.

Plus a "Conversion notes" bullet list (controls expected, defaults,
deviations).
```

---

### 5.4 Template-bootstrap prompt (run ONCE per new template)

The very first time you start a new template (e.g., starting a new "Aurora SaaS" template), use this prompt to generate the **entire foundation** — the token system, the global.css skeleton, the global.js skeleton — so subsequent widgets just consume what's there.

```
# Tempaloo Studio — bootstrap a new template

You're scaffolding the foundation of a new Tempaloo Studio template.
Output the THREE foundation files exactly:

  1. template.json (manifest) — without the `pages` array yet
  2. global.css — only the :root + [data-theme="dark"] blocks +
     a "Reset / base" block scoped to .tw-{{TEMPLATE_SLUG}}-* selectors
  3. global.js — IIFE with utility helpers (e.g. ScrollObserver, easing
     presets) that future widget JS files will rely on

Inputs:
  Template slug:  {{TEMPLATE_SLUG}}
  Display name:   {{DISPLAY_NAME}}
  Niche:          {{NICHE}}
  Vibe:           {{VIBE}}
  Color palette (light + dark for each role):
    bg:                    light={{...}}, dark={{...}}
    bg-soft:               light={{...}}, dark={{...}}
    text:                  light={{...}}, dark={{...}}
    text-soft:             light={{...}}, dark={{...}}
    text-muted:            light={{...}}, dark={{...}}
    accent:                light={{...}}, dark={{...}}
    accent-hover:          light={{...}}, dark={{...}}
    border:                light={{...}}, dark={{...}}
    cta-primary:           light={{...}}, dark={{...}}
    cta-primary-hover:     light={{...}}, dark={{...}}
    cta-secondary:         light={{...}}, dark={{...}}
  Spacing scale:          space-1=4px, space-2=8px, space-3=16px,
                          space-4=32px, space-5=64px (you can override)
  Radius scale:           radius-sm=4px, radius-md=8px, radius-lg=16px
  Shadow scale:           shadow-sm, shadow-md, shadow-lg
                          (you propose values appropriate to the vibe)
  Typography:
    Heading font:    {{e.g. "Hedvig Letters Serif"}}
    Body font:       {{e.g. "Inter"}}
    Google Fonts URL: {{...}}
  Required widgets list: {{e.g. ["header","hero","services","pricing",
                          "testimonials","faq","cta","footer"]}}

Constraints:
- Follow the Tempaloo Studio spec to the letter.
- ALL token names use --tw-{{TEMPLATE_SLUG}}-{role}.
- Dark selector is `[data-theme="dark"]`.
- global.js exposes a single namespace: window.tempaloo.{{TEMPLATE_SLUG}} = { init: () => {...} }
- Keep CSS reset minimal (box-sizing, font smoothing, link defaults inside
  the template scope only — do not touch global body styles).

Output the three files in three labeled code blocks. After them, write a
"Bootstrap notes" section listing:
  - Tokens you added beyond the brief (and why)
  - Any decision deferred to first widget
```

---

### 5.5 Animation-specific prompt (when GSAP is the focus)

Use this when adding scroll-triggered or complex motion to an existing widget:

```
# Tempaloo Studio — animation pass for widget "tw-{{TEMPLATE_SLUG}}-{{WIDGET_SLUG}}"

You're enriching an existing widget with GSAP animations. The widget HTML
+ CSS already exist (see attached). Your job is to write ONLY the
script.js for this widget, following the Tempaloo Studio rules.

Inputs:
  Existing HTML root class: tw-{{TEMPLATE_SLUG}}-{{WIDGET_SLUG}}
  Existing inner classes:   {{LIST_FROM_HTML}}
  Animation goals:          {{e.g. "Title fades in + slides up on first viewport entry; CTAs stagger 200ms; image scales 1.05 → 1 over 1.2s"}}
  Performance budget:       {{e.g. "Mobile-friendly, no continuous scroll-linked timelines"}}
  Reduced motion behaviour: {{e.g. "If prefers-reduced-motion, skip all transforms, only opacity 0→1 over 200ms"}}

Constraints:
- ONE init function: `init(rootEl)`. All queries via rootEl.querySelector(...).
- Idempotent: calling init twice on the same root is harmless (kill old
  ScrollTriggers if any, restart from initial state).
- Editor-aware: re-runs cleanly when Elementor reloads the widget.
- Honour `prefers-reduced-motion: reduce` — do the simplified version.
- Assume `window.gsap` is available; bail out if not.
- If using ScrollTrigger, assume `window.ScrollTrigger` is registered
  globally already (the template's global.js handles the gsap.registerPlugin).

Output: ONE JS code block, no preamble. Plus a 3-bullet "Notes"
section explaining the timeline structure and any cleanup hooks.
```

---

### 5.6 Quick checklist before sending any prompt

Before you click Send on a Stitch / Claude Design prompt:

- [ ] Did you fill `{{TEMPLATE_SLUG}}` and `{{WIDGET_SLUG}}` correctly?
- [ ] Did you list all the editable parts in the brief? (titles, CTAs,
      images, repeater items, etc.)
- [ ] Did you provide the FULL color palette (light + dark) or did you
      only say "make a dark mode"? Always provide both.
- [ ] Did you specify the heading + body fonts, with their Google
      Fonts URL? (Don't let the AI pick — you set the brand.)
- [ ] Did you describe the animation explicitly, including the
      reduced-motion fallback?
- [ ] Did you say "no Tailwind, no utility classes, semantic class
      names only"? (Even with the constraints block, repeating this
      one-liner reduces drift.)
- [ ] Did you specify the section LAYOUT, not just the content?
      (Two-column, full-width, asymmetric grid, etc.)

---

### 5.7 Quick checklist when reviewing the AI output

Before you commit the generated HTML/CSS/JS to a widget folder:

- [ ] Top-level wrapper class = exactly `tw-{{TEMPLATE_SLUG}}-{{WIDGET_SLUG}}`
- [ ] Zero generic class names (`hero`, `container`, `box`, `flex`)
- [ ] Zero hardcoded colors / fonts / pixel sizes in widget rules
- [ ] :root tokens block + [data-theme="dark"] override block both present
- [ ] No `style="..."` inline anywhere
- [ ] No `getElementById` or unscoped `document.querySelector`
- [ ] Init function takes `rootEl`, scoped queries
- [ ] `clamp()` used for fluid type/spacing (not media queries everywhere)
- [ ] Both frontend AND editor init handlers wired
- [ ] If repeater pattern: 3 sample items in HTML, will become REPEATER control
- [ ] `prefers-reduced-motion` respected in animations

If 1-2 items fail → fix manually (5 min). If 3+ fail → re-prompt with
the failing rules called out explicitly.

---

### 5.8 Examples — real prompts you can adapt today

**Example A — Avero Consulting hero**

```
[Paste master prompt 5.2 with these inputs filled:]

Template slug:  avero
Widget slug:    hero
Section name:   Hero with rating + dual CTA + product image right
Niche/vibe:     Premium consulting agency, calm + editorial
Color palette:  (the Avero palette from the screenshots — copied verbatim)
Typography:
  Heading: 'Hedvig Letters Serif', serif
  Body:    'Inter', sans-serif
  Google Fonts URL: https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Hedvig+Letters+Serif:opsz@12..24&display=swap
Section spec:
  Layout:   Two-column 60/40, content left, image right, vertically centered, max-width 1200px, generous py
  Content:  Rating pill ("⭐ Rated 4.9/5"), H1 (~10 words), lead paragraph (~25 words), 2 CTA buttons (primary filled "Get in touch" → #contact, secondary outline "What we do" → #services), hero image PNG
  Vibe:     Premium, calm, editorial, restrained motion
  Animation: Title slides up + fades in on load (GSAP, 0.8s ease-out), CTAs stagger in 200ms after, image fade-in 1s
```

**Example B — Luxe pricing tiers (existing template, quick prompt)**

```
[Paste prompt 5.3 with:]

Template slug: luxe
Widget slug:   pricing
Section name:  3-tier pricing with featured middle tier
Layout:        3-column equal-width grid, middle card scaled 1.05× and visually emphasized
Content:       Title above grid ("Choose your plan"), 3 tier cards each with: name, price (€/month), description (1 line), feature list (5 bullets), CTA button. Featured middle tier has a "Popular" badge top-right.
Vibe:          Luxury minimal, generous whitespace, gold accent on featured tier
Animation:     Cards enter on scroll, stagger 150ms, fade + slide-up 30px
```

**Example C — Bootstrap a new template "Aurora SaaS"**

```
[Paste prompt 5.4 with:]

Template slug:  aurora
Display name:   Aurora SaaS
Niche:          B2B SaaS landing pages (modern, conversion-focused)
Vibe:           Energetic but professional. Aurora gradient accents (cyan → violet). Generous whitespace. Bold typography.
Color palette:
  bg:                    light=#ffffff, dark=#0a0e1a
  bg-soft:               light=#f8fafc, dark=#0f1424
  text:                  light=#0f172a, dark=#f1f5f9
  text-soft:             light=#475569, dark=#94a3b8
  text-muted:            light=#94a3b8, dark=#64748b
  accent:                light=#7c3aed, dark=#a78bfa
  accent-hover:          light=#6d28d9, dark=#c4b5fd
  border:                light=#e2e8f0, dark=rgba(255,255,255,0.08)
  cta-primary:           light=linear-gradient(135deg,#06b6d4,#7c3aed), dark=linear-gradient(135deg,#22d3ee,#a78bfa)
  cta-primary-hover:     light=linear-gradient(135deg,#0891b2,#6d28d9), dark=linear-gradient(135deg,#06b6d4,#7c3aed)
  cta-secondary:         light=transparent (border 1px), dark=transparent (border 1px)
Spacing/radius/shadow:   defaults from spec
Typography:
  Heading font:  'Cal Sans', sans-serif (or fallback 'Inter')
  Body font:     'Inter', sans-serif
  Google Fonts URL: https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap
Required widgets: ["header","hero","logos","features","stats","pricing","testimonials","cta","footer"]
```

---

### 5.9 Anti-patterns in prompting (lessons learned)

| Anti-pattern | Why it bites | Fix |
|---|---|---|
| "Make it look good" | AI infers a default style → not yours | Provide explicit palette + vibe + 1 reference URL |
| "Add some animations" | AI generates random GSAP soup, not idempotent | Section 5.5 prompt with explicit timeline goals |
| Single big prompt for entire page | AI loses context, mixes class prefixes between sections | One prompt per section. Always. |
| "Use Tailwind for layout" | Defeats the spec, every section needs cleanup | Banned in section 3 of master prompt |
| Forgetting dark mode in brief | AI emits only light mode, dark added later as patch | Brief always lists both palettes upfront |
| Letting AI pick fonts | Brand drift across templates | Fonts in inputs block, never optional |
| No reduced-motion mention | AI ignores accessibility, your widgets fail a11y audits | Always specify the simplified version |
| Trusting first output blindly | Even good output has 1-2 violations | Run the 5.7 review checklist every time |

---

### 5.10 Where these prompts live

Save your filled-in prompts in `templates/{{TEMPLATE_SLUG}}/prompts/` next to each widget so you (or future contributors) can re-run the same prompt with tweaks. Convention:

```
templates/avero/prompts/
├── 00-bootstrap.md         ← Prompt that generated global.css + global.js
├── 01-hero.md              ← Prompt for tw-avero-hero
├── 02-services.md          ← Prompt for tw-avero-services
└── …
```

This is your **prompt history** — when a section needs an update 6 months later, you re-prompt from the saved version + delta, not from scratch.

---

## 6. The future: HTML → widget converter (planned, Phase 2)

Once 2-3 templates exist following this spec, we build a Node CLI:
```bash
npx tempaloo convert --section ./hero.html --template avero-consulting --slug avero-hero
```
which outputs:
- `widgets/avero-hero/widget.php` (skeleton with controls auto-detected from HTML structure)
- Appended block in `templates/avero-consulting/global.css`
- `widgets/avero-hero/script.js` if `<script>` was present in the section

The dev does a final review (5-15 min) instead of writing PHP from scratch (3-5 hours).

The converter only works because the SOURCE HTML follows this spec. Hence the spec is a prerequisite for the converter.

---

## 7. Starter template — copy this for every new widget

```php
<?php
/**
 * {Widget Title}
 *
 * @package Tempaloo\Elementor\Widgets\{TemplateSlug}
 */

namespace Tempaloo\Elementor\Widgets\{TemplateSlug};

if ( ! defined( 'ABSPATH' ) ) exit;

use Elementor\Controls_Manager;
use Elementor\Repeater;
use Tempaloo\Elementor\Widget_Base;

class {Widget_Class} extends Widget_Base {

    public function get_name(): string    { return '{template-slug}-{widget-slug}'; }
    public function get_title(): string   { return __( '{Widget Title}', 'tempaloo-studio' ); }
    public function get_icon(): string    { return 'eicon-{elementor-icon-name}'; }
    public function get_template(): string { return '{template-slug}'; }
    public function get_keywords(): array { return [ 'tempaloo', '{template-slug}', '{widget-slug}' ]; }

    protected function register_controls(): void {

        // ── Content tab ─────────────────────────────────────────────
        $this->start_controls_section( 'section_content', [
            'label' => __( 'Content', 'tempaloo-studio' ),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $this->add_control( 'title', [
            'label'   => __( 'Title', 'tempaloo-studio' ),
            'type'    => Controls_Manager::TEXTAREA,
            'default' => 'Default title here',
        ] );

        // … more controls …

        $this->end_controls_section();

        // ── Style tab — usually no widget-specific controls, the
        // template's global.css owns the look. Add one only if a
        // user-tunable style is genuinely needed (e.g., overlay opacity
        // on a hero with a background image).

    }

    protected function render(): void {
        $s = $this->get_settings_for_display();
        ?>
        <section class="tw-{template-slug}-{widget-slug}">
            <div class="tw-{template-slug}-{widget-slug}__container">
                <h2 class="tw-{template-slug}-{widget-slug}__title">
                    <?php echo wp_kses_post( $s['title'] ?? '' ); ?>
                </h2>
                <!-- … more output … -->
            </div>
        </section>
        <?php
    }
}
```

---

## 8. Banned patterns (will block the converter / cause review failures)

| Banned | Why | Use instead |
|---|---|---|
| `class="hero"`, `class="container"` | Generic, conflicts | `class="tw-{template}-{widget}__container"` |
| Tailwind utilities (`flex mt-4 text-xl`) | Not portable, no design system | Semantic classes consuming CSS variables |
| Hardcoded colors (`color: #214d47`) | Breaks dark mode + customization | `color: var(--tw-{template}-text)` |
| `style="…"` inline | Bypasses theming | `class` + `global.css` |
| `<script>` inline in `render()` | Breaks editor iframe | `widgets/{slug}/script.js` + scoped init |
| `document.querySelector()` in widget JS | Multi-instance conflicts | `rootEl.querySelector()` |
| `getElementById()` | Not allowed period | Class selectors only |
| `echo $variable` | Plugin Check ERROR | `echo esc_html($variable)` |
| Hardcoded N items in HTML | User can't edit count | `Controls_Manager::REPEATER` |
| Loaded GSAP per widget | Duplicate libs, slow | Loaded once via template `global.js` |
| `.dark .my-widget { … }` | Legacy theming pattern | Override variables under `[data-theme="dark"]` only |
| Random `@media` thresholds (e.g. 880px) | Doesn't snap with the user's Elementor breakpoints | Use Elementor stock values: 767, 1024, … (§1.10.b) |
| Using `mobile_extra` / `tablet_extra` / `laptop` / `widescreen` without docs | These slots are OFF by default — most sites won't have them | Stick to `mobile` + `tablet` for default-on rules; require user to enable optional slots |
| `widescreen` declared with `direction: "max"` | It's a `min-width` breakpoint in Elementor | Use `"direction": "min"` in `responsive_overrides` |
| Hardcoded breakpoint px in widget JS | Ignores Site Settings → Layout → Breakpoints | Read via `window.tempaloo.studio.bpQuery(alias)` / `bpMatches(alias)` |
| Text widget without `_content_template` | Each keystroke = full iframe reload, awful UX | Mirror `render()` as Underscore template (§1.13) |

---

## 9. Glossary

- **Template** — A complete bundle of widgets + pages + design tokens for one niche (e.g., Avero Consulting). One active at a time per WP site.
- **Widget** — A single Elementor element in PHP, ships with N user controls.
- **Token** — A CSS custom property (variable) at template level (e.g., `--tw-avero-bg`).
- **Mockup page** — An Elementor JSON export of a fully-assembled page (home, about…) that ships with the template and is auto-created on install.
- **Spec** — This document. The contract every author follows.

---

## 10. Versioning of this spec

Bump the version at the top when:
- A new rule is added (12 → 13 commandments).
- An existing rule changes (renaming convention, prefix, etc.).
- The template.json schema changes.

Old templates remain valid under the spec version they were authored against. The plugin checks `template.json::spec_version` on import and warns if a template is more than 2 spec-versions behind.

---

## 11. Next steps in this rebuild (Phase 1)

This file is the **first artifact** of the new plugin. The rest of Phase 1 will be:

1. ✅ `WIDGET-SPEC.md` — done (this file).
2. ⏳ `tempaloo-elementor.php` — main plugin bootstrap with PSR-4.
3. ⏳ `Tempaloo\Elementor\Widget_Base` — our shared widget abstract that extends `\Elementor\Widget_Base`.
4. ⏳ `Tempaloo\Elementor\Template_Manager` — JSON template loader (cleaner than the old one).
5. ⏳ `Tempaloo\Elementor\Theme_Tokens` — injects light/dark variables at runtime.
6. ⏳ `Tempaloo\Elementor\Widget_Registry` — registers active template's widgets.
7. ⏳ `Tempaloo\Elementor\Page_Importer` — creates pages from `template.json::pages`.
8. ⏳ React admin (Tempaloo WebP-style chrome): `Overview`, `Templates`, `Settings` (variables editor), `License`.
9. ⏳ One reference template fully shipping: `avero-consulting/`.
10. ⏳ Phase 2: the HTML → widget Node converter.
