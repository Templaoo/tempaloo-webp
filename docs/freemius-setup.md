# Configuration Freemius — Tempaloo WebP

Checklist complète pour créer le produit et les 5 plans dans le Developer Dashboard Freemius. Temps estimé : **15-20 minutes**.

---

## 0. Prérequis

- Compte Freemius créé (Developer Dashboard) : https://dashboard.freemius.com
- Accès à l'email de confirmation (certaines actions demandent une vérification)

---

## 1. Créer le produit

**Chemin** : Dashboard → `+ Add New Product` → **WordPress Plugin**

| Champ | Valeur |
|---|---|
| **Product Name** | `Tempaloo WebP` |
| **Slug** | `tempaloo-webp` |
| **Plugin Type** | WordPress Plugin |
| **Category** | Media / Image Optimization |
| **Homepage URL** | `https://tempaloo.com/webp` |
| **Description** (short) | `Image Optimizer & AVIF Converter — 1 credit per image, all thumbnail sizes included.` |
| **Monetization** | `Paid (Freemium)` |
| **Pricing Model** | `Subscription-based` |
| **Support URL** | `https://tempaloo.com/webp#support` (optionnel pour l'instant) |

Sauvegarder. Le produit reçoit un **Plugin ID** numérique (notez-le).

---

## 2. Créer les 5 plans

**Chemin** : Products → `Tempaloo WebP` → **Plans** → `+ Add Plan` pour chacun.

> **Convention** : le "Name" est interne Freemius, le "Title" est affiché publiquement dans le Checkout.

### Plan 1 — Free

| Champ | Valeur |
|---|---|
| **Name** | `free` |
| **Title** | `Free` |
| **Is Free Plan** | ✅ cocher |
| **Description** | `250 images per month, renewable forever. No card required.` |
| **License Activations** | `1` |
| **Features** (liste visible dans checkout) | `WebP conversion`<br>`250 images per month`<br>`1 credit per upload (all sizes included)`<br>`Automatic on upload`<br>`Credit rollover 30 days`<br>`Community support` |
| **Is Hidden** | ❌ non |
| **Trial** | `No trial` (plan gratuit) |
| **Support Level** | `Standard` |

> Pour les plans "Free", Freemius ne demande **pas** de pricing. Pas de trial, pas de CB.

### Plan 2 — Starter

| Champ | Valeur |
|---|---|
| **Name** | `starter` |
| **Title** | `Starter` |
| **Description** | `5 000 images/month, for a single blog or portfolio.` |
| **License Activations** | `1` |
| **Features** | `WebP + AVIF`<br>`5 000 images per month`<br>`1 site per license`<br>`Credit rollover 30 days`<br>`Unlimited bulk`<br>`Email support (48h)` |
| **Pricing** | (voir section 3 ci-dessous) |
| **Trial** | `7 days, no credit card required` |
| **Support Level** | `Standard` |

### Plan 3 — Growth (most popular)

| Champ | Valeur |
|---|---|
| **Name** | `growth` |
| **Title** | `Growth` |
| **Description** | `25 000 images/month, up to 5 sites. For small agencies.` |
| **License Activations** | `5` |
| **Features** | `WebP + AVIF`<br>`25 000 images per month`<br>`5 sites per license`<br>`Credit rollover 30 days`<br>`Priority conversion queue`<br>`Email support (24h)` |
| **Pricing** | (voir section 3) |
| **Trial** | `7 days, no credit card required` |
| **Support Level** | `Priority` |
| **Is Recommended** | ✅ cocher si l'option existe (badge "Most popular") |

### Plan 4 — Business

| Champ | Valeur |
|---|---|
| **Name** | `business` |
| **Title** | `Business` |
| **Description** | `150 000 images/month, unlimited sites. For agencies managing many client sites.` |
| **License Activations** | `0` (= unlimited dans Freemius — à défaut mettre `999`) |
| **Features** | `Everything in Growth`<br>`150 000 images per month`<br>`Unlimited sites per license`<br>`Direct API access`<br>`Chat support (24h)`<br>`99.9% SLA` |
| **Pricing** | (voir section 3) |
| **Trial** | `7 days, no credit card required` |
| **Support Level** | `Priority` |

### Plan 5 — Unlimited

| Champ | Valeur |
|---|---|
| **Name** | `unlimited` |
| **Title** | `Unlimited` |
| **Description** | `Unlimited images (fair use 500k/mo), unlimited sites. For hosts and platforms.` |
| **License Activations** | `0` (unlimited) |
| **Features** | `Everything in Business`<br>`Unlimited images (fair use 500k/mo)`<br>`Unlimited sites`<br>`Priority SLA`<br>`Dedicated onboarding`<br>`White-label reports (soon)` |
| **Pricing** | (voir section 3) |
| **Trial** | `7 days, no credit card required` |
| **Support Level** | `Priority` |

---

## 3. Configurer le pricing (monthly + annual)

Dans chaque plan payant, onglet **Pricing** → `+ Add Pricing`. Créer **deux** entrées pricing par plan :

### Starter
| Billing Cycle | Amount | Currency | Currency Symbol |
|---|---|---|---|
| Monthly | `5` | EUR | € |
| Annual | `48` | EUR | € |

### Growth
| Billing Cycle | Amount | Currency |
|---|---|---|
| Monthly | `12` | EUR |
| Annual | `115` | EUR |

### Business
| Billing Cycle | Amount | Currency |
|---|---|---|
| Monthly | `29` | EUR |
| Annual | `278` | EUR |

### Unlimited
| Billing Cycle | Amount | Currency |
|---|---|---|
| Monthly | `59` | EUR |
| Annual | `566` | EUR |

> **Remarque** : Freemius calcule automatiquement l'économie annuelle dans le checkout ("Save X%"). Nos prix annuels correspondent à −20 % (10 mois payés pour 12).

> **USD & autres devises** : Freemius peut auto-convertir. Pour l'instant, laissez uniquement **EUR** configuré. On ajoutera USD plus tard si besoin.

---

## 4. Paramétrer les options globales du produit

**Chemin** : Product → **Settings** → chaque onglet ci-dessous.

### 4.1 General
- **Default Plan** : `Free`
- **Currency** : `EUR`
- **Billing Address** : facultatif (laissez vide si particulier)

### 4.2 Checkout
- **Allow Coupons** : ✅ oui (utile pour promos lancement)
- **Require Email Verification** : ✅ oui
- **Show Trial Notice** : ✅ oui
- **Default Billing Cycle** : `Annual` (pour pousser l'annuel)
- **Require Physical Address** : ❌ non (sauf pour clients B2B EU, Freemius le demande auto au besoin pour la TVA)

### 4.3 Emails
- **From Name** : `Tempaloo WebP`
- **From Email** : `hello@tempaloo.com` (ou équivalent)
- **Transactional emails** : ✅ activer tous (purchase, renewal, cancellation, trial reminders)

### 4.4 Webhooks
Pas maintenant pour cette étape — nous les configurerons une fois l'API déployée en prod (on a l'endpoint `POST /v1/webhooks/freemius` prêt, il attend juste une URL publique).

**Quand vous aurez l'URL prod de l'API** (ex. `https://api.tempaloo.com/v1/webhooks/freemius`) :
- Events à cocher : `license.*`, `subscription.*`, `user.*`, `payment.*`, `install.*`
- Copier le **Signing Secret** → à coller dans `api/.env` comme `FREEMIUS_SECRET_KEY` (celui-là, spécifique webhooks)

### 4.5 Keys (onglet critique)
Dans **Settings → Keys** (ou équivalent), vous verrez trois clés :

| Clé affichée | Format | À noter comme |
|---|---|---|
| `Plugin ID` ou `Product ID` | numérique (ex. `12345`) | `FREEMIUS_PLUGIN_ID` |
| `Public Key` | commence par `pk_…` | `FREEMIUS_PUBLIC_KEY` |
| `Secret Key` | commence par `sk_…` — cliquer Reveal | `FREEMIUS_SECRET_KEY` |

### 4.6 API Token (scope product)
Onglet **API Token** (ou **Settings → API**) :

| Clé affichée | À noter comme |
|---|---|
| `API Bearer Token` | `FREEMIUS_API_TOKEN` |

Celui-ci servira à interroger l'API Freemius depuis notre backend (invoices, self-service cancel, sync).

---

## 5. À me retourner (4 valeurs + 1 info)

Copiez ces **5 éléments** dans un message (format libre, je parse) :

```
FREEMIUS_PLUGIN_ID=12345                            # nombre, depuis Settings → Keys
FREEMIUS_PUBLIC_KEY=pk_abcdef1234567890             # depuis Settings → Keys
FREEMIUS_SECRET_KEY=sk_abcdef1234567890             # depuis Settings → Keys (Reveal)
FREEMIUS_API_TOKEN=sk_token_xxxxxxxxxxxx            # depuis Settings → API Token
PRODUCT_SLUG=tempaloo-webp                          # confirmation du slug public
```

⚠️ **Considérez Secret Key et API Token comme des mots de passe** — je les coupe de l'historique dès que les credentials sont posés, et ils vont dans `api/.env` gitignoré.

---

## 6. Ce que je ferai avec (pipeline)

1. **Vérifier la config** avec un GET `/products/{id}/plans.json` via votre Bearer — confirme que les 5 plans sont bien créés avec les bons prix/activations.
2. **Intégrer le Freemius WordPress SDK** dans le plugin (`plugin/tempaloo-webp/vendor/freemius/`) — débloque MAJ auto, licences côté WP, et boutons Upgrade natifs.
3. **Configurer le Checkout** (JS overlay) sur `/webp/activate` — remplace les boutons "Start 7-day trial" en vrais boutons payants.
4. **Finaliser le webhook handler** côté API (signature HMAC vérifiée, upsert licence en DB).
5. **Billing card du dashboard** — appel Bearer `GET /products/{id}/users/{fs_user_id}/billing/invoices.json` pour afficher les factures.
6. **Bouton "Cancel subscription"** self-service via `DELETE /subscriptions/{id}.json`.
7. **Test E2E** : achat avec carte test Freemius → webhook → licence en DB → visible dans `/webp/dashboard`.

---

## 7. Carte de test Freemius (pour le test E2E plus tard)

Quand on testera le flux d'achat, Freemius accepte en mode test :
- Numéro : `4242 4242 4242 4242`
- Date : n'importe quelle future
- CVV : 3 chiffres
- Nom : n'importe
- Pays : FR

---

## 8. Si un champ de l'UI Freemius ne correspond pas à ce doc

L'UI Freemius change parfois. Si vous voyez un champ qui n'est pas dans ce doc, ou l'inverse :
- **Ne bloquez pas** : notez la différence et continuez
- **Dites-le moi** à la fin, j'ajuste le doc
- Les **valeurs prioritaires** sont : nom du plan, activations, prix, trial — le reste est cosmétique

---

**Quand tout est fait** → copiez-moi les 5 valeurs, et on passe au câblage.
