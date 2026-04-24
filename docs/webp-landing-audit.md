# Audit — `/webp` landing page

**Date** : 2026-04-24
**Cible** : `https://tempaloo.com/webp` (composant `web/components/webp/LandingPage.tsx`)
**Méthodo** : Nielsen's 10 usability heuristics (skill `ux-audit`) + Page Conversion Readiness Index 0-100 (skill `page-cro`)

---

## 0. Résumé exécutif

### Score de conversion : **65 / 100 — Low Readiness**

> Problèmes fondamentaux qui limitent la conversion. **Ne pas lancer d'A/B test tant que le score est < 70.** Corriger les fondations d'abord.

### Les 5 priorités P0 (à faire avant le lancement public)

1. 🚨 **Ajouter de la preuve sociale réelle ou l'enlever complètement** — Le "pill v1.4.0" suggère une maturité qui n'existe pas (produit en bêta). Risque de crédibilité si un lead vérifie sur WordPress.org.
2. 🚨 **Reformuler la H1 en OUTCOME** — "Lighter images. One credit per upload." décrit le produit, pas le bénéfice. Un WP admin veut des "pages plus rapides", "meilleur SEO", "Core Web Vitals verts".
3. 🚨 **Rendre fonctionnel ou enlever le bouton "$ wp plugin install"** — actuellement décoratif, clic sans effet → brise la confiance dès le hero.
4. 🚨 **Section "How it works" manquante** — 3 étapes install → activate → convert. C'est la 2e question que se pose tout WP admin après "qu'est-ce que ça fait".
5. 🚨 **Section "Compatibility / Works with"** manquante — grille logos des page builders (Gutenberg, Elementor, Bricks, Divi, WooCommerce). La question #2 de la FAQ y répond en texte, mais visuel > texte ici.

---

## 1. Scoring de conversion (Readiness Index)

| Catégorie | Score | Analyse |
|---|---|---|
| **Value Proposition Clarity** | 18 / 25 | H1 claire sur le QUOI ("1 credit per upload") et le différenciateur, mais zéro sur le POURQUOI (faster sites, SEO, LCP). |
| **Conversion Goal Focus** | 14 / 20 | Primary CTA bien identifié et répété 4× (nav, hero, pricing, final CTA). Mais hero a 2 CTAs qui se font concurrence, et pas de sticky mobile. |
| **Traffic–Message Match** | 11 / 15 | Match OK pour SEO "WordPress WebP plugin" + referrers WP.org. Pas de personnalisation par UTM. |
| **Trust & Credibility Signals** | **6 / 15** ⚠️ | Gros trou : zéro vrai social proof (pas de testimonials, pas de user count, pas de note WP.org). Le pill "v1.4.0" est fake et potentiellement auto-sabotant. |
| **Friction & UX Barriers** | 10 / 15 | Flow activate fluide (Google 1-click). Mais : CTA "$ wp plugin install" cassé, FAQ manque d'`aria-expanded`, font @import bloquant. |
| **Objection Handling** | 6 / 10 | FAQ solide (7 items alignés aux règles produit). Manque la comparaison compétitive explicite, la partie sécurité/privacy, et le "et si vous fermez ?". |
| **TOTAL** | **65 / 100** | Low Readiness — fondamentaux à fixer avant A/B test |

---

## 2. Nielsen's heuristics — findings

### H1. Visibility of system status
- ✅ **Nav sticky + backdrop blur** au scroll : l'utilisateur sait toujours où il est
- ✅ **MediaLibraryDemo** : le state (`·IDLE → …GENERATING → …CONVERTING → ✓ DONE`) est un brillant signal de transparence
- ❌ **Theme toggle** sans feedback visuel lors de la bascule (pas de transition douce entre light/dark → flash brutal sur tout l'écran)
- ❌ **FAQ accordion** : l'icône `+ → ×` rotate, mais aucune annonce pour screen readers (`aria-expanded` manquant)

### H2. Match between system and real-world
- ✅ **"Drop-in WebP"** : vocabulaire WP connu
- ✅ **"wp plugin install"** : commande WP-CLI qui parle aux devs/power users
- ⚠️ **"1 credit per upload"** : le mot "credit" est du jargon SaaS — un WP admin casual dirait "image" ou "conversion"
- ⚠️ **"Rollover 30 days"** : anglicisme, un user FR pourrait ne pas comprendre (mais la cible est probablement EN de toute façon)

### H3. User control and freedom
- ✅ **FAQ accordion** : ouverture/fermeture libre
- ✅ **Billing toggle Monthly/Annual** : réversible instantanément
- ❌ **Theme toggle persiste dans localStorage MAIS** : aucun moyen de revenir à "System theme (auto)" — l'user est bloqué sur son choix manuel
- ❌ **Pricing modal** (dans `/webp/activate`) : modal overlay qui ne se ferme pas à `Escape` (à vérifier)

### H4. Consistency and standards
- ✅ **Design tokens globalisés** (après le refactor globals.css) — typo/couleurs cohérentes sur toutes les pages
- ✅ **Patterns web modernes** : sticky nav, glass, hero+demo, pricing cards, FAQ accordéon, dark CTA band
- ⚠️ **Inconsistance entre `/webp` et `/webp/activate`** : le toggle thème n'existe qu'en header sur `/webp`, pas sur `/webp/activate`. Navigation entre les deux = l'user "perd" le toggle
- ⚠️ **Section IDs inconsistants** : `#pricing`, `#faq`, mais `#features` (dans nav) n'existe pas dans le code → clic mène nulle part

### H5. Error prevention
- ✅ **Activate flow** : skip-auth si déjà signed-in = évite la double saisie
- ❌ **Pricing cards** : CTA "Start trial" sur Business/Unlimited — l'user peut cliquer par erreur sur Unlimited (59€/mo = 7-10× Growth) sans second écran de confirmation
- ❌ **Aucun garde-fou sur la commande "$ wp plugin install"** — le bouton ne fait rien, pas d'info que ça devrait copier la commande

### H6. Recognition rather than recall
- ✅ **Plan cards** ré-affichent tout : nom, prix, credits, sites, features, CTA
- ✅ **Footer** liste les sections (Pricing, FAQ) = sitemap léger
- ❌ **Quand l'user fait "Voir plans" depuis `/webp/activate`, il revient sur `/webp` mais son plan sélectionné n'est pas mis en évidence** → il doit re-scanner les 5 cards

### H7. Flexibility and efficiency
- ✅ **Theme toggle** (clair/sombre)
- ✅ **Billing toggle** (monthly/annual)
- ❌ **Pas de recherche/filtrage dans la FAQ** (7 questions OK aujourd'hui, mais si ça croît…)
- ❌ **Pas de shortcut clavier** pour ouvrir la modal activate (ex: `G` then `P` = Go to Pricing)

### H8. Aesthetic and minimalist design
- ✅ **Le design est excellent** sur ce point : Geist font, espacement généreux, couleurs monochromes, animations ciselées
- ⚠️ **MediaLibraryDemo** peut être visuellement dense à petit écran (grid 280px + 1fr → stack → min 340px hauteur right col)
- ⚠️ **StatsBar** : 4 chiffres mono très petits (12.5px), contraste `var(--ink-3) = #8F8F8F` sur blanc = **ratio 2.6:1, WCAG AA FAIL pour texte non-gras**

### H9. Help users recognize, diagnose, recover from errors
- ❌ **Aucun empty state / error state** sur la landing (rien ne peut fail ici — la page est statique)
- ❌ **Si JS désactivé** : toute l'animation MediaLibraryDemo ne s'affiche pas, le FAQ accordéon est cassé, les toggles ne marchent pas. Pas de graceful degradation

### H10. Help and documentation
- ⚠️ **"Docs"** dans la nav est un lien mort (`href="#"` avec `title="Coming soon"`)
- ❌ **Aucun lien vers une vraie documentation plugin** (pourtant WordPress.org listing existera)
- ❌ **Pas de widget support / chat / contact** pour les hésitants

### Mobile-specific (réachabilité, ergonomie tactile)
- ⚠️ **Nav à droite** : thème toggle + "Sign in" + "Get started" cramp sur 380px (3 éléments)
- ❌ **Aucun sticky bottom CTA** mobile (pattern standard SaaS depuis 2020)
- ⚠️ **MediaLibraryDemo** left column 280px forcée → sur 375px écran, ça prend toute la largeur, bien — mais le contenu reste figé (l'image, la ribbon) et peut déborder
- ⚠️ **Pricing grid** : 5 col → 2 col → 1 col — OK mais Growth highlight (`translateY(-8px)`) dépasse le viewport si pas de padding-top sur la grille

---

## 3. Sections manquantes (ranked by impact sur conversion)

### 🔥 P0 — Avant lancement

#### 3.1. **"How it works"** — 3 ou 4 étapes visuelles
Position : juste après Hero, avant StatsBar
Contenu proposé :
1. **Install plugin** (screenshot WP admin → "Plugins → Add New → Tempaloo WebP" ou commande `wp plugin install`)
2. **Activate** (screenshot de votre onglet Activate, clé API en 10 s via Google)
3. **Upload or Bulk** (screenshot de la médiathèque avec les badges `WEBP` sur les thumbnails)
4. **Done — faster pages** (comparatif Core Web Vitals / page weight avant-après)

**Impact** : répond à *"OK j'achète, mais est-ce que c'est compliqué à installer ?"* — objection #1 des non-devs WP.

#### 3.2. **Compatibility grid** — logos page builders + stacks
Position : après "How it works"
Contenu : grille 6-8 logos (Gutenberg, Elementor, Bricks, Divi, Beaver Builder, WooCommerce, Polylang, WPML, etc.)
Format : monochrome (grayscale) pour match design, titre "Works out of the box with your stack"

**Impact** : répond à *"Ça va pas casser mon site Elementor ?"* — l'objection la plus fréquente en commentaires WP.

#### 3.3. **Comparison table** — vs ShortPixel / Imagify / EWWW
Position : après Thumbnail Trap, avant Pricing
Contenu : tableau 4 colonnes (Tempaloo + 3 concurrents) × 8 lignes (credits model, AVIF, bulk, rollover, sites per license, price 5k/mo, price 25k/mo, WP.org rating)
Design : la ligne Tempaloo sur-mise en avant, les concurrents en gris

**Impact** : répond à *"Pourquoi pas ShortPixel qui a 1M+ installs ?"* — tu ES cette comparaison implicite dans Thumbnail Trap, mais un tableau explicite convertit mieux les comparateurs actifs.

### 💡 P1 — Avant premiers 100 clients

#### 3.4. **Testimonials / logos**
3-5 témoignages (1 solo blogger, 1 agence, 1 e-commerce) avec photo + nom + rôle + sitename. Ou, si pas encore de clients : strip de logos de sites bêta avec leur accord. **Ne jamais inventer.**

#### 3.5. **Use cases**
3 cartes : "Solo blogger" / "Agency / freelance" / "E-commerce (WooCommerce)" avec benefits spécifiques (ex: "Agency: 5 sites per license, white-label reports, priority support").

#### 3.6. **Security / privacy section**
Courte : "No image storage" / "EU-hosted (GDPR)" / "Originals stay on your server" / "Secure API with key rotation support" — en 4 chips avec icônes.

#### 3.7. **"Ready to ship" pre-footer stat strip**
Juste avant le FinalCTA, une bande avec des chiffres réels :
- "X images converted since launch"
- "X TB saved"
- "X.XX% uptime last 30 days"
- Mettre à jour dynamiquement (pull from /api)

### 📈 P2 — Growth (après)

#### 3.8. **Video demo** (30-60 s)
Un screencast WordPress admin installant + activant + uploadant + voyant le résultat. Remplace ou complète MediaLibraryDemo.

#### 3.9. **Changelog / roadmap inline**
Section en bas : "Last 5 releases" (dernière date + highlight) + "Coming soon" (AVIF batch, Cloudflare integration, white-label).

#### 3.10. **Partner / affiliate mention**
Si applicable : "30 % recurring commission for agencies" — attire le segment reseller.

---

## 4. CTA strategy — le cœur du sujet

### Hiérarchie actuelle

| Emplacement | CTA | Destination | Commentaire |
|---|---|---|---|
| Nav (sticky) | `Get started →` | `/webp/activate?plan=free` | ✅ Primary claire |
| Hero primary | `Start free` | `/webp/activate?plan=free` | ✅ Same destination, cohérent |
| Hero secondary | `$ wp plugin install` | ⚠️ WP.org link | ⚠️ Pas un vrai CTA de conversion, et le bouton ne copie rien |
| Pricing × 5 | `Start free` / `Start trial` / `Talk to sales` | `/webp/activate?plan=X&billing=Y` | ✅ Per-plan |
| FinalCTA primary | `Start free →` | `/webp/activate?plan=free` | ✅ Réaffirme |
| FinalCTA secondary | `Read the docs` | WP.org link | ⚠️ Détourne au dernier moment |

### Propositions d'amélioration

#### 4.1. **Fix the hero secondary CTA**
Actuellement `<a href="https://wordpress.org/plugins/tempaloo-webp/">` sur le bouton "$ wp plugin install" — mais le plugin n'y est PAS encore listé → 404 pour l'user.

**3 options classées** :
- **A (recommandée)** : copy-to-clipboard de la commande `wp plugin install tempaloo-webp`, toast "Copied! Paste in your SSH"
- B : remplacer par `See how it works →` qui smooth-scroll à la future section How it works
- C : retirer le 2e bouton (un seul CTA hero, plus focus)

#### 4.2. **Ajouter un sticky bottom CTA sur mobile**
Bar fixe en bas de viewport qui apparaît après que l'user ait scrollé passé le hero :
```
┌─────────────────────────────────────┐
│ Free · 250 images/mo       [Start →] │
└─────────────────────────────────────┘
```
Affichée uniquement < 768px + sur scrollY > viewport. Pattern Vercel/Linear/Resend.

#### 4.3. **CTA contextualisé au milieu de page**
Entre Thumbnail Trap et Pricing : mini-CTA avec loss aversion :
> *"Converting 10 images/day on Free would take 25 days. Start now — every day of delay = page weight bleed."*
> `[Start free — 30 s setup →]`

#### 4.4. **Trust chips collés au CTA principal**
Juste sous "Start free" en hero :
```
🛡 30-day money back   ⏱ 7-day trial   ✕ Cancel anytime
```
Réduit le risque perçu au moment du clic. Actuellement les chips sont dans la Pricing section — trop loin du moment de décision.

#### 4.5. **Urgency douce** (pas de dark patterns)
Sur les plans payants :
- "7-day free trial — card required only to reserve your slot"
- "Price locked for 12 months from signup" (si vrai)
- Annual : "Save €XX vs monthly" (montrer la différence numérique)

### Alternatives de copy (A/B testables quand readiness > 70)

**Hero H1 actuel** : "Lighter images. One credit per upload."

**Variantes à tester** :
- **V1 — Outcome** : "Faster WordPress. One upload, every size." (parle au résultat, pas au mécanisme)
- **V2 — Painkiller** : "Stop paying 6× for each image. Convert the WordPress way." (vs thumbnail trap)
- **V3 — Authority** : "The WebP plugin WordPress should have shipped." (positioning agressif)

**Primary CTA actuel** : "Start free"

**Variantes** :
- "Get my free API key →" (spécifique, élève la value perçue)
- "Install in 30 seconds →" (temporality, réduit friction perçue)
- "Start converting — free forever" (emphase permanent, pas trial)

---

## 5. Animations & scroll effects

### Ce qui existe
- ✅ **MediaLibraryDemo** — rAF loop 7 s avec narrative claire
- ✅ **ThumbnailTrap animated** — setInterval 80 ms, compteurs qui s'incrémentent
- ✅ **FAQ accordion** — transition max-height + opacity
- ✅ **Nav sticky** — backdrop-blur au scroll
- ✅ **Dot pulse** sur pill v1.4.0

### Ce qui manque (ranked by impact)

#### 5.1. **🚨 `prefers-reduced-motion` support** (accessibility + legal risk)
Aucune des animations ne respecte `@media (prefers-reduced-motion: reduce)`. Les users sensibles à la motion (vertige, migraine, TSA) voient des animations continues impossibles à désactiver. En UE, ça peut être vu comme une violation d'accessibilité (WCAG 2.3.3). Fix :

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important; }
}
```

Et pour les rAF loops JS, au début du composant :
```tsx
const reducedMotion = useMedia("(prefers-reduced-motion: reduce)");
// Skip the rAF if reducedMotion === true
```

#### 5.2. **Stagger fade-in on scroll** pour les sections
Chaque section principale (StatsBar, ThumbnailTrap, Pricing, FAQ) apparaît avec opacity 0 → 1 + translateY(20px → 0) quand elle entre en viewport. Via `IntersectionObserver` (pas de lib, ~20 lignes).

#### 5.3. **Number counter animation** sur StatsBar
Quand StatsBar entre en viewport, les chiffres (−70%, 30s, 6.0+, 30d) s'animent depuis 0 en 800 ms via `requestAnimationFrame`. Ajoute du mouvement intentionnel là où c'est pertinent.

#### 5.4. **Pricing cards stagger entry**
Quand la section Pricing entre en viewport, les 3 cards featured apparaissent en cascade (50 ms de délai entre chaque).

#### 5.5. **Parallaxe subtile sur le fond**
Un radial-gradient très léger qui bouge avec le scroll (vitesse 0.3x) derrière le Hero → plus de profondeur. Doit être **opt-in via reduced-motion check**.

#### 5.6. **Hover micro-interactions sur Pricing cards**
- Tilt 3D léger (CSS `transform-style: preserve-3d` + transform sur mousemove)
- Badge "Popular" qui pulse doucement au hover
- Le check list qui s'illumine (couleur passant de ink-2 à ink) en cascade

#### 5.7. **Smooth scroll anchors**
Les liens `#pricing` / `#faq` sautent brutalement. Ajouter `html { scroll-behavior: smooth }` dans globals.css (mais reduced-motion annule automatiquement).

#### 5.8. **Pause MediaLibraryDemo quand hors viewport**
La rAF tourne en continu même quand la demo n'est pas visible → gaspille CPU mobile. IntersectionObserver pour play/pause.

---

## 6. Responsive — points de rupture

### Breakpoints actuels dans le code
- `@media (max-width: 720px)` : cache `.pr2-nav-links` (Pricing/FAQ/Docs/Changelog)
- `@media (max-width: 760px)` : MediaLibraryDemo grid → 1 col
- `@media (max-width: 860px)` : ThumbnailTrap grid → 1 col

### Problèmes détectés

#### 6.1. **Entre 720 et 900px** (tablette portrait / small laptop)
- Nav affiche seulement logo + theme + Sign in + Get started, OK
- Pricing `repeat(auto-fit, minmax(260px, 1fr))` : rentre en 3 col à ~900px mais à 760px c'est 2 col avec le 3e qui s'empile → Growth en bas sans mise en avant spéciale

**Fix** : forcer `grid-template-columns: 1fr` < 820px pour que la stack verticale soit propre et Growth reste highlighted en haut.

#### 6.2. **< 420px** (téléphones compacts, iPhone SE 1er gen)
- FinalCTA padding `112px 0` trop large, texte déborde
- Hero H1 clamp descend à 44px mais "One credit / per upload" s'affiche parfois sur 1 ligne avec débordement hors viewport

**Fix** : `@media (max-width: 440px)` qui ajuste :
- FinalCTA padding : `80px 16px`
- Hero H1 `font-size: clamp(36px, 7.2vw, 88px)` (baisse à 36)
- Forcer `word-break: normal` + `overflow-wrap: balance`

#### 6.3. **Pricing card highlighted (Growth)**
Sur mobile, `transform: translateY(-8px)` a pour effet de décoller la card du flux + ajouter du z-index. En mobile, ça fait un gap visuel bizarre (vide au-dessus de Growth, collision avec Starter au-dessus).

**Fix actuel** existe déjà (`.pr1-card.pr1-hl { transform: none }` sous 640px) mais le design est pauvre : à la place, mettre une **simple bordure colorée de 2px** pour indiquer "Most popular" en mobile.

#### 6.4. **Landscape mobile (800×400)**
- MediaLibraryDemo prend 100% de la hauteur → l'user doit scroller verticalement dans la demo ET puis dans la page
- Hero + demo remplit plus qu'un viewport en landscape

**Fix** : sur `@media (orientation: landscape) and (max-height: 500px)` → masquer la demo ou la mettre en bas.

### Outils à utiliser
- **Chrome DevTools** : device toolbar, tester iPhone 12 / Galaxy S20 / iPad Mini / desktop
- **Responsively App** (gratuit) : voir plusieurs devices en parallèle
- **LogRocket / Hotjar** (plus tard) : voir où les users réels scrollent et tapent

---

## 7. Accessibility (a11y)

### Erreurs critiques détectées

#### 7.1. 🚨 **Pas de support `prefers-reduced-motion`** (voir §5.1)

#### 7.2. 🚨 **FAQ buttons manquent `aria-expanded` et `aria-controls`**
```tsx
<button
    onClick={() => onToggle(i)}
    className="pr2-faq-q"
    aria-expanded={openIdx === i}
    aria-controls={`faq-a-${i}`}
>
```
Et le panel :
```tsx
<div id={`faq-a-${i}`} role="region" ...>
```

#### 7.3. ⚠️ **Contraste `ink-3` sur `bg`** = 2.6:1
Couleurs touchées : StatsBar labels, Billing toggle inactive, Card tagline, footer copy.
- Light mode : `#8F8F8F` sur `#FFFFFF` = 2.6:1 (AA fail pour < 18px)
- Fix : passer `--ink-3` à `#6E6E6E` (= 4.6:1, AA pass) et `--ink-2` à `#2F2F2F`

#### 7.4. ⚠️ **Heading hierarchy cassée**
La landing a :
- `<h1>` dans Hero ✓
- `<h2>` dans ThumbnailTrap + Pricing + FAQ + FinalCTA ✓
- Mais `<h3>` sauté (jamais utilisé) — screen readers ne savent pas que Pricing et Thumbnail sont au même niveau qu'un H2

**OK** au final, c'est acceptable avec seulement h1 et h2 — pas de bug.

#### 7.5. ⚠️ **Focus visible insuffisant**
`:focus-visible` dans globals.css = `outline: 2px solid var(--ink)` — OK pour les boutons. Mais les pricing cards sont des `<div>` non-focusables, seul le bouton à l'intérieur est focusable → on peut focus le bouton mais pas "voir" quelle card est surveyée. À améliorer avec un pattern de card qui forward le focus.

#### 7.6. ⚠️ **Theme toggle** : pas de label texte pour screen readers
`aria-label="Toggle theme"` présent, OK, mais les users audio-only ne savent pas l'état actuel. Ajouter :
```tsx
<button aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
```

### Quick audit WCAG 2.1 AA

| Critère | État | Note |
|---|---|---|
| 1.4.3 Contrast (min 4.5:1 pour texte normal) | ❌ | ink-3 = 2.6:1 |
| 2.1.1 Keyboard | ⚠️ | OK pour CTA, pas pour cards |
| 2.3.3 Animation from interactions | ❌ | pas de reduced-motion |
| 2.4.3 Focus order | ✓ | logique |
| 2.4.6 Headings and labels | ⚠️ | labels OK, headings basique |
| 3.2.4 Consistent identification | ✓ | buttons cohérents |
| 4.1.2 Name, Role, Value | ⚠️ | aria-expanded manque sur FAQ |

---

## 8. Performance

### Signes à auditer (via Lighthouse)

#### 8.1. **Fonts @import bloquant**
Dans `globals.css` :
```css
@import url('https://fonts.googleapis.com/css2?family=Geist:...');
```
Bloque le render du CSS jusqu'à ce que Google Fonts réponde. **Fix** :
```tsx
// Dans web/app/layout.tsx ou via next/font
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
const geist = Geist({ subsets: ['latin'], display: 'swap' });
```
`next/font` fait du self-hosting + preload automatique → LCP amélioré de 200-400 ms sur 3G.

#### 8.2. **MediaLibraryDemo rAF continuous**
La demo tourne même hors viewport. Pause-la avec IntersectionObserver — économie CPU & batterie mobile notable.

#### 8.3. **Aucun `next/image`**
La page a peu d'images (juste les SVGs inline), donc impact faible. Mais quand tu ajouteras logos compatibility grid / testimonials photos, utilise obligatoirement `next/image` pour le lazy-load + WebP auto.

#### 8.4. **Bundle size**
`LandingPage.tsx` = 900 lignes inlinées (markup + CSS dans une string). Compile en ~14 KB First Load JS (vu dans le build Vercel). Raisonnable.
Attention : chaque nouvelle section ajoute du bundle. Si tu scales, split par section (dynamic imports) quand > 50 KB.

### Budget cible pour un plugin landing
- **LCP < 2 s** (actuellement probablement ~1.5 s avec next/font)
- **CLS < 0.05** (fonts self-hosted, pas de shift)
- **FID < 100 ms** (OK, JS léger)
- **Total JS < 200 KB gzipped** (OK, Next.js de base fait ~85 KB)

---

## 9. Copywriting & psychology

### Headline actuel
> *"Lighter images. One credit per upload."*

**Score Headline Psychology** :
- Clarté : 9/10 ✓
- Specificity : 10/10 ✓ ("one credit")
- Outcome orientation : **3/10** ❌ (parle du mécanisme, pas du bénéfice utilisateur)
- Emotion : 5/10 (le serif italique aide visuellement)
- Differentiation : 8/10 ✓ (one credit = unique)

### Leviers psychologiques sous-utilisés

#### 9.1. **Loss aversion** (people hate losing > love winning)
Framer négativement : *"Stop paying 6× for the same image. One upload = one credit."*

#### 9.2. **Specificity bias** (details = credibility)
Actuel : "−70% avg. page weight"
Mieux : "An average of −73% page weight across 847 audited WordPress sites" (**si tu peux le mesurer**)

#### 9.3. **Authority / expertise** (who are you)
Ajouter 1 ligne near hero : *"Built by WordPress developers who got tired of counting thumbnails."* — humanise.

#### 9.4. **Social proof stacked** (quantity)
Remplacer pill "v1.4.0" fake par :
- v1 réel quand tu lances
- OR "Joined by 147 WordPress creators last week" (après X inscriptions)
- OR rien (honnête) tant que < 100 clients

#### 9.5. **Specificity in CTAs**
"Start free" → "**Get my free API key →**" (specific = 2-3% lift typique)
"Start trial" → "**Try Growth free for 7 days →**" (specific)

### Objections manquantes dans la FAQ

| Objection probable | Actuellement couverte ? | À ajouter |
|---|---|---|
| "Is it faster than ShortPixel?" | ⚠️ Implicit dans thumbnail trap | Q directe |
| "What's your uptime?" | ❌ | Q : "Can I rely on your API?" |
| "What if you shut down?" | ❌ | Q : "What happens to my site if you stop operating?" |
| "Do I need to change my theme?" | ✓ Covered in Q2 | OK |
| "Will it work with my CDN?" | ❌ | Q : "Does it work with Cloudflare/BunnyCDN?" |
| "How do I migrate from ShortPixel?" | ❌ | Q : "I use X, how do I migrate?" |

---

## 10. Design standards & layout

### Points forts
- ✅ Design tokens centralisés (après le refactor)
- ✅ Typography scale cohérente (Geist 15 base, clamp pour H1)
- ✅ Spacing system (multiples de 4/8 partout)
- ✅ Dark/light parity
- ✅ Brand logo désormais centralisé dans `Logo.tsx`

### Incohérences / améliorations

#### 10.1. **Spacing scale non-standardisé**
Valeurs utilisées : 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48, 56, 64, 72, 80, 96, 112, 120px.
→ Trop de valeurs. Consolider sur 4/8/12/16/24/32/48/64/80/96/128. Crée un script Tailwind ou génère des variables CSS `--space-N`.

#### 10.2. **Border-radius non-standardisé**
Valeurs : 4, 6, 7, 8, 10, 12, 14, 999.
→ Consolider sur 4/6/8/12/16/999. Table de correspondance :
- 4 : badges, chips
- 6 : buttons small
- 8 : buttons medium, cards small
- 12 : cards large, modals
- 16 : hero viz
- 999 : pills, dots

#### 10.3. **Type scale**
Mix de `clamp()` avec valeurs ad-hoc et valeurs fixes. Consolider :
```
--fs-xs: 11px     (eyebrow, mono labels)
--fs-sm: 12.5px   (captions, meta)
--fs-base: 14px   (body)
--fs-lg: 16px     (lead)
--fs-xl: 18px     (section lead)
--fs-2xl: clamp(24px, 3vw, 32px)
--fs-3xl: clamp(36px, 4.8vw, 60px)  -- section H2
--fs-4xl: clamp(44px, 7.2vw, 88px)  -- hero H1
```

#### 10.4. **Grid columns count inconsistent**
Différentes sections utilisent `repeat(3, 1fr)` vs `repeat(auto-fit, minmax(260px, 1fr))` vs fixed 280px/1fr → designer tools s'attendent à UNE grille cohérente. Pour un SaaS, standard = max-width 1200px, gutter 12-16px, breakpoints à 760/1024.

---

## 11. Implementation roadmap

### P0 — Avant lancement public (sprint de 1-2 jours)

| # | Item | Effort | Impact conversion |
|---|---|---|---|
| 1 | Fix headline (outcome-based) + 3 alternatives à A/B tester plus tard | 30 min | +15-25% (estimé) |
| 2 | Remplacer fake "v1.4.0" pill par contexte réel | 10 min | +5% (évite perte confiance) |
| 3 | Fix "$ wp plugin install" (copy-to-clipboard avec toast) | 30 min | +3% (conversion power users) |
| 4 | Ajouter trust chips sous le Hero primary CTA | 20 min | +5-10% |
| 5 | Section "How it works" (4 étapes) | 2-3 h | +10-15% |
| 6 | Section "Compatibility" (grille logos) | 2 h | +8-12% |
| 7 | Section "Comparison table" | 2 h | +12-18% (comparateurs actifs) |
| 8 | `prefers-reduced-motion` support + aria-expanded FAQ | 1 h | qualité + a11y légal |
| 9 | Augmenter `--ink-3` contrast (WCAG AA) | 10 min | qualité + a11y légal |
| 10 | Sticky bottom CTA mobile | 1 h | +10-15% sur mobile (40% du trafic) |

**Total P0 : ~10-12 h de dev. Gain conversion estimé cumulé : +40-70%**

### P1 — Avant 100 clients payants (sprint de 3-5 jours)

| # | Item | Effort |
|---|---|---|
| 11 | Section Testimonials (3-5) | 4 h (+ temps d'obtention) |
| 12 | Section Use cases (3 cartes) | 3 h |
| 13 | Section Security/privacy (chips) | 1 h |
| 14 | Fade-in on scroll + stagger pricing | 2 h |
| 15 | Number counter animation StatsBar | 1 h |
| 16 | IntersectionObserver pour pause MediaLibraryDemo | 1 h |
| 17 | `next/font` pour Geist | 30 min |
| 18 | Fix responsive breakpoints (720-900 + <420 + landscape) | 3 h |
| 19 | Améliorer focus states pricing cards | 1 h |
| 20 | Consolider spacing/radius scale (variables CSS) | 2 h |

### P2 — Growth optimization (itération continue)

| # | Item |
|---|---|
| 21 | Video demo 30-60 s (remplace ou complète MediaLibraryDemo) |
| 22 | Changelog / roadmap inline |
| 23 | A/B test H1 variantes (quand trafic > 1000/week) |
| 24 | Hover micro-interactions pricing |
| 25 | Smooth scroll + parallaxe subtile |
| 26 | Personnalisation par UTM (landing page qui match le source) |
| 27 | Exit intent popup (optionnel, popup-cro skill) |
| 28 | Widget chat / support (Crisp, HelpScout) |

---

## 12. Hypothèses A/B testables (quand readiness > 70)

Chaque test = 1 change, 1 metric, taille statistique correcte (min 5 000 visits/variant).

### H1 : Headline outcome-focused
- **Hypothèse** : Remplacer "Lighter images. One credit per upload." par "Faster WordPress. One upload, every size." augmente le CTR sur primary CTA de 10-20%.
- **Change** : Hero H1 texte uniquement
- **Impact attendu** : conversion hero → activate
- **Métrique primaire** : click-through rate sur "Start free"

### H2 : Trust chips près du CTA
- **Hypothèse** : Ajouter "30-day money back · 7-day trial · Cancel anytime" juste sous le Hero primary CTA réduit le bounce de 5-10% et augmente le CTR vers activate.
- **Change** : nouveau composant trust row dans Hero
- **Métrique primaire** : bounce rate + click-through

### H3 : Sticky mobile CTA
- **Hypothèse** : Ajouter un sticky bottom CTA sur mobile augmente les activations mobiles de 15-20%.
- **Change** : nouveau composant rendu uniquement < 768px
- **Métrique primaire** : activation rate par device

### H4 : Comparison table
- **Hypothèse** : Une table de comparaison explicite vs ShortPixel/Imagify juste avant Pricing convertit 10-15% de plus les visiteurs "comparateurs".
- **Change** : nouvelle section
- **Métrique primaire** : scroll depth → pricing CTR

### H5 : Number counters animated
- **Hypothèse** : Animer les stats (−70%, 30s, 6.0+, 30d) en rentrant en viewport augmente la dwell time de 20-30% et la mémorisation des chiffres.
- **Change** : IntersectionObserver + rAF sur StatsBar
- **Métrique primaire** : dwell time + conversion

---

## 13. Outils recommandés pour les étapes suivantes

| Besoin | Outil | Coût |
|---|---|---|
| Heatmap / session recording | Hotjar / Clarity | Gratuit (Microsoft Clarity) |
| Core Web Vitals monitoring | Vercel Analytics / Speed Insights | 0$ sur Hobby |
| A/B testing | GrowthBook (self-hosted) ou PostHog | Free tiers généreux |
| Screen reader testing | NVDA (Windows) / VoiceOver (macOS) | Gratuit |
| Accessibility audit automated | axe DevTools extension Chrome | Gratuit |
| Responsive testing | Responsively App | Gratuit |

---

## 14. Résumé actionnable — les 10 actions à faire ce week-end

Si tu ne fais qu'une chose, fais les 10 P0. Par ordre de priorité :

1. [ ] **Remplacer la H1** par une variante outcome-focused (30 min)
2. [ ] **Retirer le pill "v1.4.0"** ou le remplacer par un contexte réel (10 min)
3. [ ] **Fixer "$ wp plugin install"** : copy-to-clipboard + toast (30 min)
4. [ ] **Trust chips sous Hero CTA** (20 min)
5. [ ] **Section "How it works"** 4 étapes avec icônes (2 h)
6. [ ] **Section "Compatibility"** logos monochromes (2 h)
7. [ ] **Section "Comparison"** tableau vs concurrents (2 h)
8. [ ] **Support reduced-motion** + aria-expanded FAQ (1 h)
9. [ ] **Couleur `--ink-3`** : `#8F8F8F` → `#6E6E6E` (10 min)
10. [ ] **Sticky bottom CTA mobile** (1 h)

**Budget total : ~10 h de dev. Gain conversion estimé : 40-70% avant le 1er lancement.**

Après ça, score de readiness probable : **82-88 / 100** → OK pour A/B testing structuré.
