# A/B testing plan — `tempaloo.com/webp`

**Status** : setup en place, tests pas encore lancés (attente trafic suffisant).
**Pré-requis trafic** : ≥ 1 000 visiteurs uniques / semaine sur `/webp`.
**Readiness score actuel** (depuis `webp-landing-audit.md`) : **~87-93 / 100**, donc OK pour tester quand le trafic suivra.

---

## 1. Infrastructure en place

### Analytics
- **Vercel Analytics** (`@vercel/analytics/react`) wiré dans `app/layout.tsx`
- Gratuit jusqu'à 2 500 page views / mois sur Hobby, puis bascule Pro
- RGPD-friendly, EU-hosted, zero cookie

### Event tracking
Défini dans `web/lib/track.ts`. Tous les events sont envoyés via `@vercel/analytics`.

| Event | Props | Trigger |
|---|---|---|
| `cta_click` | `{ location, plan }` | Clic sur un CTA du funnel |
| `activate_open` | `{ plan, billing }` | Arrivée sur `/webp/activate` |
| `activate_complete` | `{ plan }` | Licence générée (à câbler côté modal) |
| `checkout_open` | `{ plan }` | Ouverture Freemius overlay |
| `flag_assigned` | `{ flag, variant }` | Auto — à la 1re assignation d'un A/B |

### Feature-flag primitive (minimale)
`useFlag(flagKey, variants)` dans `web/lib/track.ts`. Ordre de priorité :

1. **`?<flagKey>=<value>` en URL** (sticky → écrit en `localStorage`) — permet de forcer une variante pour toi-même ou un reviewer
2. **`localStorage` existant** — garde la variante pour chaque visiteur entre sessions
3. **Hash déterministe du `visitorId`** — bucket aléatoire stable par utilisateur

**Upgrade path** : quand trafic ≥ 1k/semaine, swap pour **PostHog Cloud** (free 1M events/mo, A/B testing + feature flags joints avec analytics).

---

## 2. Les 5 tests à lancer dans l'ordre

Chaque test = **1 seul changement**, mesure **1 métrique primaire**, durée **≥ 2 semaines** ou taille d'échantillon **≥ 1 000 visits/variante**, selon ce qui arrive en premier.

### Test 1 — Hero headline (impact attendu : élevé)

**Hypothèse** : Une H1 plus outcome-focused ("Faster WordPress. One upload, every size.") convertit mieux qu'une H1 mécanique ("Lighter images. One credit per upload.").

| Variante | Texte H1 |
|---|---|
| A (control — actuelle) | `Faster WordPress.` **/ serif italic /** `One upload, every size.` |
| B (painkiller) | `Stop paying 6× for each image.` **/ serif italic /** `Convert the WordPress way.` |
| C (authority) | `The WebP plugin` **/ serif italic /** `WordPress should have shipped.` |

- **Flag key** : `hero_headline`
- **Métrique primaire** : CTR sur `cta_click { location: "hero", plan: "free" }`
- **Métrique secondaire** : scroll depth (via Vercel Analytics)
- **Succès** : B ou C bat A de ≥ 15 % en CTR avec p < 0.05

### Test 2 — Primary CTA copy (impact attendu : moyen)

**Hypothèse** : Une CTA copy plus spécifique (promesse temporelle ou value) convertit mieux que "Get my free API key".

| Variante | Texte bouton |
|---|---|
| A | `Get my free API key →` (actuelle) |
| B | `Install in 30 seconds →` |
| C | `Start converting — free forever →` |

- **Flag key** : `hero_primary_cta`
- **Métrique primaire** : CTR sur `cta_click { location: "hero" }`
- **Métrique secondaire** : `activate_open` / `activate_complete` funnel rate

### Test 3 — Sticky mobile CTA threshold (impact attendu : moyen sur mobile)

**Hypothèse** : Le seuil d'apparition du sticky (520 px actuellement) est peut-être trop bas ou trop haut.

| Variante | Seuil |
|---|---|
| A | 520 px (actuelle — juste après hero) |
| B | 800 px (après StatsBar) |
| C | 0 px (toujours visible une fois la page scrollée de 1 px) |

- **Flag key** : `sticky_threshold`
- **Filtre device** : uniquement `viewport < 768 px`
- **Métrique primaire** : CTR sur `cta_click { location: "sticky_mobile" }`
- **Garde-fou** : vérifier que ça ne baisse PAS la total `cta_click` de la page (un sticky trop présent peut juste cannibaliser les autres)

### Test 4 — Featured pricing card (impact attendu : élevé sur paid conversions)

**Hypothèse** : Le highlight du plan **Growth** (le plan "most popular") force vers un commitment trop élevé. Tester si highlight **Starter** booste les paid conversions (plus petit ticket = moins de friction).

| Variante | Plan mis en avant |
|---|---|
| A | Growth (€12/mo) — actuelle |
| B | Starter (€5/mo) |
| C | Aucun highlight (5 cards égales) |

- **Flag key** : `featured_plan`
- **Métrique primaire** : `activate_complete { plan ∈ paid }` taux
- **Métrique secondaire** : revenu total (somme annual_total des plans convertis)
- ⚠ **Attention** : tester **uniquement** les utilisateurs qui arrivent SANS `?plan=X` en URL

### Test 5 — Counter animation on StatsBar (impact attendu : faible mais facile)

**Hypothèse** : L'animation 0 → N des stats (−70 %, 30 s, 30 d) augmente le dwell time et la mémorisation → plus de scroll vers Pricing.

| Variante | Comportement |
|---|---|
| A | Animated (actuelle — easeOutCubic 900 ms au scroll in-view) |
| B | Static — les chiffres sont directement à la valeur finale |

- **Flag key** : `stats_animation`
- **Métrique primaire** : scroll depth moyen (a11y : respecte déjà `prefers-reduced-motion`)
- **Métrique secondaire** : `cta_click { location: "pricing" }` parmi les sessions qui ont vu StatsBar

---

## 3. Comment setup un test dans le code

```tsx
import { useFlag } from "@/lib/track";

function Hero() {
    const headline = useFlag("hero_headline", ["control", "painkiller", "authority"] as const);
    const h1 = {
        control: (
            <>Faster WordPress. <span className="font-serif">One upload,<br/>every size.</span></>
        ),
        painkiller: (
            <>Stop paying 6× for each image. <span className="font-serif">Convert the<br/>WordPress way.</span></>
        ),
        authority: (
            <>The WebP plugin <span className="font-serif">WordPress should<br/>have shipped.</span></>
        ),
    }[headline];
    return <h1 className="pr2-hero-h1">{h1}</h1>;
}
```

Pour forcer une variante pendant un review :
```
https://tempaloo.com/webp?hero_headline=painkiller
```

---

## 4. Comment lire les résultats (Vercel Analytics)

1. **https://vercel.com/<team>/tempaloo/analytics** → onglet **Custom Events**
2. Filtrer par `flag_assigned` → voir la répartition des variantes (sanity check : doit être ≈ équilibrée)
3. Filtrer par `cta_click` → grouper par `flag_variant` (custom Vercel dashboard)
4. Calculer le CTR par variante : `cta_click / page_view`

**Limitation Vercel Analytics** : pas de joins complexes sur le funnel entier. Dès qu'il te faut corréler `flag_variant` → `activate_complete` par visiteur, migre sur **PostHog** (setup ~1 h, plan gratuit suffit).

---

## 5. Garde-fous avant de lancer un test

Avant chaque test, vérifier :

- [ ] Tu as **≥ 1 000 visits/semaine sur `/webp`** (autrement, tu mesures du bruit)
- [ ] Tu es prêt à laisser tourner **≥ 2 semaines** (moins = faux positifs)
- [ ] Un **seul test actif à la fois** (éviter les interactions entre flags)
- [ ] La métrique primaire est **définie à l'avance** (pas de cherry-picking ex-post)
- [ ] Le changement est **réversible** en 1 commit si la variante cassée s'avère mal perçue

---

## 6. Mesure de baseline à faire en premier

**Avant tout test**, laisser l'actuelle tourner 2 semaines et collecter :

- Sessions / semaine
- Bounce rate (via Vercel Analytics pages)
- CTR par location de CTA (nav, hero, pricing, sticky, final)
- `activate_open` / `cta_click` funnel rate
- `activate_complete` / `activate_open` rate
- `checkout_open` / `activate_complete` rate (paid funnel)

Ces chiffres seront le **control absolu** contre lequel mesurer chaque test.

---

## 7. Upgrade path quand Vercel Analytics ne suffit plus

| Trigger | Migration vers |
|---|---|
| Besoin de funnels multi-event joint par user_id | PostHog Cloud (free jusqu'à 1M events/mo) |
| Besoin d'A/B testing intégré avec feature flags + stats | PostHog (inclus) ou GrowthBook self-hosted |
| Besoin de session replay / heatmaps | Microsoft Clarity (free) ou PostHog |
| Besoin d'analytics full EU / RGPD strict | Plausible ($9/mo) |

Le code dans `lib/track.ts` a été écrit de sorte que remplacer `@vercel/analytics` par `posthog-js` = swap de 5 lignes.
