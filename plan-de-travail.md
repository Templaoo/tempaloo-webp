# Plan de travail — Plugin WordPress de conversion WebP

> Produit SaaS freemium : plugin WordPress qui convertit les images (existantes + futures) en WebP via une API distante, avec quota gratuit et abonnements payants par volume.

---

## 1. Vision & objectifs

**Produit** : plugin WordPress professionnel qui optimise automatiquement les images d'un site en WebP (et AVIF en Pro), sans effort pour l'utilisateur.

**Promesse** : "Installez, activez, vos images sont 30-70 % plus légères — sans toucher à une ligne de code."

**Modèle** : freemium.
- **Free** : 100 images/mois (acquisition via WordPress.org)
- **Pro** : plusieurs paliers par volume mensuel (monétisation)

**Concurrents à étudier** : ShortPixel, Imagify, Smush Pro, Optimole, EWWW, Converter for Media.
**Différenciation possible** : qualité de compression (libvips), simplicité UX, prix, support francophone, AVIF inclus dès le Pro.

---

## 2. Architecture cible

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  Plugin WP   │────────▶│  API Node    │────────▶│  libvips /   │
│ (site client)│         │  (Fastify)   │         │  sharp       │
└──────────────┘         └──────────────┘         └──────────────┘
                                 │
                                 ▼
                         ┌──────────────┐
                         │  PostgreSQL  │
                         │ (licences +  │
                         │   quotas)    │
                         └──────────────┘
                                 │
                                 ▼
                         ┌──────────────┐
                         │ Freemius     │
                         │ (paiement,   │
                         │  licences)   │
                         └──────────────┘
```

**Flux standard** :
1. Image uploadée dans la médiathèque WP → hook `wp_handle_upload`
2. Plugin envoie l'image à l'API avec clé de licence
3. API vérifie licence + quota dans Postgres
4. Conversion via `sharp` (libvips)
5. WebP retourné au plugin → stocké à côté de l'original
6. Compteur de quota incrémenté
7. Plugin sert le WebP via `<picture>` ou filtre sur les URLs d'images

**Flux d'activation (onboarding utilisateur)** :
1. L'utilisateur installe et active le plugin dans WordPress
2. Écran réglages affiche un champ "Clé API" vide + un bouton **"Générer une clé API"**
3. Le bouton redirige (nouvel onglet) vers une page du site vitrine : `/activate?site=<url_site>&return=<url_reglages>`
4. L'utilisateur choisit un plan (Free, Starter, Growth, Business, Unlimited)
   - Free → création de compte (email) → génération immédiate de la clé
   - Payant → tunnel Freemius Checkout → paiement → génération de la clé à la réception du webhook
5. Page de confirmation affiche la clé API + bouton "Copier" + bouton "Retour au plugin"
6. L'utilisateur colle la clé dans le champ du plugin → clic "Activer"
7. Plugin appelle `POST /license/verify` → statut sauvegardé → conversion activée

**Points de conception** :
- Pré-remplir `site_url` dans la requête pour lier automatiquement la licence au domaine
- Envoyer la clé par email aussi (sécurité + récupération en cas de perte)
- Option "magic link" : au clic sur "Générer", envoyer un lien retour qui pré-remplit la clé dans le plugin (nonce + TTL 15 min)
- Écran réglages affiche ensuite : statut licence, plan actif, quota consommé, date de reset

---

## 3. Stack technique

| Couche | Outil | Rôle | Coût logiciel |
|---|---|---|---|
| Plugin WP | WP Plugin Boilerplate + **Freemius SDK** | Code client, intégration WP, licences | 0 € |
| API | **Node.js + Fastify** | Serveur HTTP rapide | 0 € |
| Conversion | **sharp** (sur libvips) | WebP + AVIF + redimensionnement | 0 € |
| Base de données | **PostgreSQL** | Licences, quotas, logs | 0 € |
| Stockage temp | **Cloudflare R2** | Fichiers en transit (pas de frais sortie) | 10 Go gratuits |
| Paiement + licences | **Freemius** | Gère ventes, TVA, MAJ plugin | 0 € install, 7 % commission |
| Monitoring | **Sentry** + **Better Stack** | Erreurs + uptime | Offres gratuites suffisantes |
| Site vitrine/dashboard | **Next.js** (optionnel) | Landing page, compte client | 0 € |

**Hébergement au démarrage** :
- API Node : **Render** (7 $/mois) ou **Fly.io**
- Base Postgres : **Neon** (offre gratuite 0,5 Go)
- Site vitrine : **Vercel** (Hobby gratuit)
- Domaine : ~10 €/an

**Budget estimé** : 0 € pour le MVP, ~30 $/mois une fois en production.

---

## 4. Offres commerciales (à valider)

### 4.1 Benchmark concurrentiel (avril 2026)

| Concurrent | Free | Entrée de gamme | Milieu | Unlimited | Modèle |
|---|---|---|---|---|---|
| **ShortPixel** | 100 crédits/mois | — | One-time 30 k images = $19.99 (never expire) | $9.99/mois | Crédits image |
| **Imagify** | ~200 images (20 Mo)/mois | $4.99/mois (5 000 images, annuel) | — | $9.99/mois (annuel) | Mo/mois |
| **Optimole** | 2 000 visites/mois | Starter $19.08/mois (48 k visites, annuel) | Business $22+/mois (120 k visites) | — | Visites/mois (CDN) |
| **EWWW** | Basique gratuit | Standard $8/mois (1 site, 200 Go) | Growth $16/mois (10 sites, 400 Go) | Infinite $32/mois (illimité, 800 Go) | Sites + bande passante |
| **Smush Pro** | Version Smush gratuite | $7.50/mois (1 site, bundle WPMU DEV) | — | $82.50/mois (illimité) | Sites + bundle |
| **Converter for Media** | Lite gratuit | $50/an (120 k images/an ≈ 10 k/mois) | $100/an (300 k/an ≈ 25 k/mois) | — | Images/an |

**Observations** :
- Deux modèles dominants : **crédits d'images** (ShortPixel, Imagify, CfM) et **visites/bande passante** (Optimole, EWWW, Smush).
- Free "sérieux" = 100-200 images/mois, ou 2 000 visites.
- Entrée payante : **4,99-9,99 $/mois**.
- Unlimited : **9,99-11,99 $/mois** (Imagify, ShortPixel). EWWW et Smush plus chers car bundles.
- Annuel = -17 à -20 % presque partout.
- **AVIF** : payant chez Imagify et CfM, inclus chez Optimole, peu mis en avant chez les autres.

### 4.2 Proposition de grille (à valider)

Modèle retenu : **crédits images/mois** (lisible, pas dépendant du trafic, aligné sur ShortPixel/Imagify).

| Offre | Quota images/mois | Sites | Formats | Bulk | Support | Prix mensuel | Prix annuel (−20 %) |
|---|---|---|---|---|---|---|---|
| **Free** | **250** | 1 | WebP | 50 max | Docs + forum | 0 € | 0 € |
| **Starter** | 5 000 | 1 | WebP + **AVIF** | Illimité | Email 48 h | **5 €/mois** | 48 €/an (4 €/mois) |
| **Growth** | 25 000 | **5** | WebP + AVIF + CDN | Illimité | Email 24 h | **12 €/mois** | 115 €/an (9,60 €/mois) |
| **Business** | 150 000 | **Illimité** | Tout + API directe | Illimité | Chat 24 h | **29 €/mois** | 278 €/an (23 €/mois) |
| **Unlimited** | ∞ équitable (fair use 500 k) | Illimité | Tout + white-label | Illimité | Prioritaire | **59 €/mois** | 566 €/an (47 €/mois) |

**Crédit rollover** : tous les plans incluent un report automatique des crédits non consommés sur 30 jours, plafonné à 1× le quota mensuel. Différenciateur vs Elementor/ShortPixel/Imagify qui ne reportent rien.

**Positionnement** :
- **Free 150** : plus généreux que ShortPixel (100), sous Imagify (~200). Suffisant pour petits sites.
- **Starter 5 €** : légèrement sous Imagify à 5,99 $ mensuel, **AVIF inclus** = différenciation forte.
- **Growth 12 €** : entre Imagify/ShortPixel unlimited et EWWW Growth. Multi-sites + CDN.
- **Unlimited 59 €** : bien en dessous du bundle Smush à 82,50 $ sur plusieurs sites, au-dessus d'Imagify Infinite (9,99 $) mais avec licence multi-sites sérieuse.
- Argument-clé : **AVIF dès le Starter** (vs payant/premium chez Imagify/CfM).

### 4.3 Règles à trancher

- [x] **Quota par image (attachement)** (pas par taille) — 1 crédit = 1 upload, toutes ses tailles incluses (original + thumbnails WP). **Différenciateur fort vs ShortPixel/Imagify qui facturent par taille**. Validé 2026-04-23.
- [x] **Annuel = -20 %** (standard du marché).
- [x] **Grille tarifaire validée** (2026-04-23).
- [x] **Licence liée au nombre de sites** : Free/Starter = 1, Growth = 5, Business/Unlimited = ∞. **Hard limit à l'activation** (Freemius `license_activations`), self-service via dashboard pour désactiver un site. Quota partagé entre tous les sites de la licence. Validé 2026-04-24.
- [x] **Dépassement quota** : **blocage dur, pas de surcharge**. Quota atteint → nouvelles images servies en original (site jamais cassé), banner amber "Quota reached, resets in X days. Upgrade for instant access.". Bulk pause + bouton resume. Le rollover 30j absorbe les pics. Validé 2026-04-24.
- [x] **Taille max par image** : **25 Mo, identique tous plans**. Erreur API `IMAGE_TOO_LARGE` au-delà. Pas de variation par palier. Validé 2026-04-24.
- [x] **Reset du quota** : **calendaire, 1er du mois UTC**. Combiné au rollover 30j. Aligné Stripe/Vercel/ShortPixel. Validé 2026-04-24.
- [x] **Fair use Unlimited** : **soft cap 500k/mois**. Pas de coupure auto. Au-delà → email "trafic légitime ou plan custom ?". Droit de throttle si abus évident (crawler, revente). À documenter dans CGU. Validé 2026-04-24.
- [ ] **One-time credits** (façon ShortPixel) : pack 30 k = 19 € à étudier pour les sites à volume irrégulier (post-MVP).

### 4.4 Branding & hébergement (décidé 2026-04-23)

- **Marque** : produit intégré à **Tempaloo** (ombrelle qui regroupera plusieurs plugins WordPress). Pas de marque autonome.
- **Page plugin** : `tempaloo.com/webp` (sous-chemin Next.js, Vercel Hobby gratuit) — capitalise le SEO au niveau du domaine racine pour tous les futurs produits Tempaloo.
- **Nom affiché du plugin** : `Tempaloo WebP – Image Optimizer & AVIF Converter`.
- **Slug WordPress.org** : `tempaloo-webp` (à vérifier libre : https://wordpress.org/plugins/tempaloo-webp/).
- **Short description** : "Convert images to WebP & AVIF automatically. Faster sites, no setup."
- **Alignement concurrents** : tous utilisent keyword-rich slugs (`shortpixel-image-optimiser`, `ewww-image-optimizer`, `webp-converter-for-media`). Le nom retenu couvre les 3 termes qui performent (`webp`, `image optimizer`, `avif`).

---

## 5. Phases de développement

### Phase 0 — Cadrage (1 semaine)
- [ ] Étude détaillée des 5 concurrents (fonctionnalités, tarifs, avis WordPress.org)
- [ ] Choix final de la grille tarifaire
- [ ] Choix du nom + réservation domaine + compte Freemius
- [ ] Maquette UX plugin (écran réglages + écran bulk + dashboard)
- [ ] Schéma base de données (tables `licenses`, `sites`, `usage_logs`, `plans`)
- [ ] Spec OpenAPI de l'API (endpoints et réponses figés avant de coder)

### Phase 1 — MVP technique (3-4 semaines)
- [ ] Projet API Node + Fastify + Postgres (Neon)
- [ ] Endpoint `POST /convert` (input : image ou URL + clé licence)
- [ ] Endpoint `GET /quota` (reste du mois)
- [ ] Endpoint `POST /license/verify`
- [ ] Conversion `sharp` : WebP qualité 82 par défaut, option custom
- [ ] Gestion quota : décrémentation atomique, reset mensuel via cron
- [ ] Logs basiques (Postgres + Sentry)
- [ ] Endpoint `POST /license/generate` (création après choix de plan, déclenché par webhook Freemius ou signup Free)
- [ ] Page `/activate` sur le site vitrine : choix de plan + génération de clé + retour vers le plugin
- [ ] Webhook Freemius → création licence en base + envoi email avec la clé
- [ ] Plugin WP squelette + Freemius SDK intégré
- [ ] Hook `wp_handle_upload` pour conversion auto
- [ ] Écran réglages : champ "Clé API", bouton "Générer une clé API" (redirige vers `/activate`), bouton "Activer", statut + quota
- [ ] Flux magic link (optionnel) : retour auto vers le plugin avec clé pré-remplie (nonce + TTL)
- [ ] Filtre `wp_get_attachment_image` pour servir le WebP
- [ ] Tests manuels bout en bout sur un WP local (activation Free + activation Pro)

### Phase 2 — Conversion en masse (2 semaines)
- [ ] Script bulk : scan de la médiathèque → queue de conversion
- [ ] Barre de progression + reprise après coupure
- [ ] Gestion des erreurs (image corrompue, quota atteint, API down)
- [ ] Queue côté API (BullMQ + Redis) pour gros volumes
- [ ] Limites de taille (max 25 Mo/image par exemple)

### Phase 3 — Tableau de bord & marketing (2 semaines)
- [ ] Site Next.js : landing page, tarifs, docs, FAQ
- [ ] Dashboard client : consommation du mois, historique, factures
- [ ] Intégration Freemius Checkout
- [ ] Onboarding : 3 étapes max pour que ça marche
- [ ] Articles SEO : "WebP sur WordPress", comparatifs, tutoriels

### Phase 4 — Bêta privée (2 semaines)
- [ ] 10-20 testeurs volontaires (Facebook WordPress FR, Twitter, newsletter)
- [ ] Collecte feedback structurée (formulaire + appels)
- [ ] Correction bugs, ajustement UX
- [ ] Monitoring prod sous charge réelle

### Phase 5 — Lancement public (1 semaine)
- [ ] Soumission version Free sur WordPress.org (validation 2-4 semaines)
- [ ] Version Pro sur site vitrine
- [ ] Annonce : WP Tavern, newsletters WP, Twitter, LinkedIn, ProductHunt
- [ ] Activation support client (Crisp ou HelpScout)

### Phase 6 — Itération continue
- [ ] AVIF automatique pour Pro
- [ ] Intégration CDN (Bunny.net ou Cloudflare)
- [ ] Resize responsive (servir la bonne taille selon l'écran)
- [ ] Lazy loading natif
- [ ] Compatibilité explicite : WooCommerce, Elementor, Divi, cache plugins
- [ ] White-label pour agences (palier supérieur)

---

## 6. Décisions à prendre avant de démarrer

- [ ] **Nom du produit** + disponibilité domaine + marque
- [ ] **Grille tarifaire définitive** (quota, prix, règles de dépassement)
- [ ] **Stockage des images côté serveur** : oui/non ? (RGPD → préférer non, conversion à la volée + suppression immédiate)
- [ ] **WordPress.org obligatoire** ? (oui fortement recommandé pour acquisition Free)
- [ ] **Stratégie de servi WebP** : réécriture HTML vs `<picture>` vs `.htaccess` (recommandé : filtre PHP `wp_get_attachment_image` = plus robuste)
- [ ] **Langues** : FR + EN au lancement ?
- [ ] **Support** : qui répond les 3 premiers mois ? délai promis ?

---

## 7. Risques & mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Plugin Free cracké | Élevée | Moyen | Conversion 100 % côté API = inexploitable sans licence valide |
| API down → sites clients cassés | Moyenne | Élevé | Fallback local (GD) optionnel + monitoring + SLA affiché |
| Quota non respecté côté client | Faible (vérif serveur) | Faible | Vérif stricte côté API, jamais côté plugin |
| RGPD (images perso EU) | Moyenne | Élevé | DPA, hébergement EU, pas de stockage durable |
| Croissance trop rapide → coûts | Faible au début | Moyen | Plafonds de consommation par compte + alertes Sentry |
| Rejet WordPress.org | Moyenne | Moyen | Respecter scrupuleusement les guidelines (pas d'obfuscation, GPL, etc.) |

---

## 8. KPIs à suivre

**Acquisition** : installs Free/mois, taux conversion Free → Pro, CAC.
**Engagement** : % sites actifs (au moins 1 image/mois), images converties/site.
**Revenu** : MRR, ARPU, churn mensuel, LTV.
**Technique** : latence API (p50/p95), taux d'erreur, uptime, coût par conversion.

---

## 9. Checklist de lancement

- [ ] Plugin testé sur WP 6.x, PHP 7.4 à 8.3
- [ ] Compatibilité WooCommerce vérifiée
- [ ] Docs utilisateur en ligne
- [ ] CGV + politique de confidentialité + DPA
- [ ] Page de support avec FAQ
- [ ] Mention légale domaine + hébergeur
- [ ] Soumission WordPress.org faite
- [ ] Monitoring + alertes configurés
- [ ] Backup automatique Postgres
- [ ] Plan de reprise si l'API tombe
- [ ] Freemius : produit créé, plans configurés, webhooks testés
- [ ] Email transactionnel (confirmation achat, quota atteint, facture)

---

## 10. Ressources & références

- WordPress Plugin Boilerplate : https://wppb.me/
- Freemius Developers : https://freemius.com/help/documentation/
- sharp (conversion) : https://sharp.pixelplumbing.com/
- libvips : https://www.libvips.org/
- Fastify : https://fastify.dev/
- WordPress.org guidelines : https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/
- Comparatif concurrents : étude à mener en Phase 0
