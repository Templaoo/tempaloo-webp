# Deploy — Tempaloo WebP API on Render

Plan en 3 phases. Phase 1 = Free (validation), Phase 2 = Starter $7 + custom domain (production), Phase 3 = web Next.js sur Vercel.

**Pré-requis** : repo poussé sur GitHub (✅ déjà fait), compte Render gratuit créé, accès au registrar de `tempaloo.com`.

---

## Phase 1 — Deploy sur Render Free (validation pipeline)

But : valider que **tout marche** (build, env vars, healthcheck, conversion E2E) à 0€ avant de payer.

### 1.1 Créer le Web Service

1. Dashboard Render → **`+ New`** → **`Web Service`**
2. **Connect a repository** → autoriser GitHub → choisir `Templaoo/tempaloo-webp`
3. Configuration :

| Champ | Valeur |
|---|---|
| **Name** | `tempaloo-api` |
| **Region** | `Frankfurt (EU Central)` (RGPD + proximité Neon) |
| **Branch** | `main` |
| **Root Directory** | `api` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | **`Free`** |
| **Health Check Path** | `/health` |

### 1.2 Variables d'environnement

Dans la section **Environment** du wizard, ajouter chaque variable de `api/.env.example`.

⚠️ **Avant de copier `.env` actuel** : lire `~/.claude/projects/.../memory/project_security_rotate_keys.md` — les 5 secrets ont transité en clair en chat. **Les rotater AVANT de les coller dans Render** :

1. **DATABASE_URL** : Neon Console → Settings → Reset password du rôle `neondb_owner` → copier la nouvelle URL (avec `?sslmode=require`)
2. **FREEMIUS_SECRET_KEY** : Freemius → Product → Settings → Keys → Regenerate Secret
3. **FREEMIUS_API_KEY** : Freemius → Product → API & Keys → Regenerate Token
4. **INTERNAL_API_KEY** : générer un nouveau (`openssl rand -hex 32`)
5. **FREEMIUS_PUBLIC_KEY** : safe à garder (public)

Les autres (`NODE_ENV=production`, `LOG_LEVEL=info`, `MAX_IMAGE_BYTES=26214400`, `DEFAULT_QUALITY=82`, `FREEMIUS_PRODUCT_ID=28337`, `UNLIMITED_FAIR_USE=500000`) sont des constantes.

⚠️ **Ne pas définir `PORT`** — Render l'injecte automatiquement.

### 1.3 Déploiement

Clique **`Create Web Service`** → Render commence le build (~3-5 min).

À la fin, tu obtiens une URL du type `https://tempaloo-api.onrender.com`.

### 1.4 Vérifications

```bash
# 1. Healthcheck
curl https://tempaloo-api.onrender.com/health
# → {"ok":true,"env":"production"}

# 2. Quota endpoint (avec ta vraie license_key)
curl -H "X-License-Key: <ta-clé>" https://tempaloo-api.onrender.com/v1/quota
# → {"plan":"free","images_used":0,...}
```

### 1.5 Test E2E avec WP local

Dans `wp-config.php` du LocalWP, modifie temporairement :
```php
define( 'TEMPALOO_WEBP_API_BASE_OVERRIDE', 'https://tempaloo-api.onrender.com/v1' );
```

Upload une image dans la médiathèque → vérifie qu'un `.webp` est créé + que **Used** monte dans l'admin Tempaloo.

⚠️ **Attendre la première requête peut prendre 50 s** (sleep Free tier). Le retry queue qu'on a implémenté absorbe ça automatiquement.

### 1.6 Si quelque chose foire

- **Build fails** : checker logs Render → souvent erreur npm install (pin Node version dans `package.json` engines OK = `>=20`)
- **Sharp install error** : Render Linux x64 → sharp précompile, devrait marcher. Si non, ajouter `npm rebuild sharp` au build command
- **DATABASE_URL refused** : vérifier `?sslmode=require` à la fin + utiliser le `*-pooler` host
- **Env var oubliée** : Render → service → Environment → Add → redeploy

---

## Phase 2 — Upgrade Starter $7 + custom domain `api.tempaloo.com`

Une fois Phase 1 validée, on enlève le sleep et on met le vrai domaine.

### 2.1 Upgrade plan

Dashboard Render → service `tempaloo-api` → **Settings** → **Instance Type** → **Starter $7/mo** → Save.

→ Render redémarre avec 512 MB / 0.5 CPU **always-on**, ~30 s de downtime. Carte demandée.

### 2.2 Custom domain

1. Render service → **Settings** → **Custom Domains** → **Add Custom Domain** → `api.tempaloo.com`
2. Render affiche un CNAME target (ex: `tempaloo-api.onrender.com`)

### 2.3 DNS chez ton registrar

Aller dans la zone DNS de `tempaloo.com` :

| Type | Name | Value | TTL |
|---|---|---|---|
| `CNAME` | `api` | `tempaloo-api.onrender.com` (la valeur que Render t'a donnée) | 300 |

Render valide le DNS en ~5-15 min puis génère le SSL Let's Encrypt automatiquement.

Test : `curl https://api.tempaloo.com/health` → `{"ok":true,...}`

### 2.4 Update plugin

Dans `plugin/tempaloo-webp/tempaloo-webp.php` :

```php
define( 'TEMPALOO_WEBP_API_BASE', defined( 'TEMPALOO_WEBP_API_BASE_OVERRIDE' )
    ? TEMPALOO_WEBP_API_BASE_OVERRIDE
    : 'https://api.tempaloo.com/v1' );  // ← déjà bon !
```

→ La default URL est déjà `https://api.tempaloo.com/v1`. Rien à changer côté plugin.

### 2.5 Update webhook Freemius

Dashboard Freemius → Product → **Webhooks** → URL : `https://api.tempaloo.com/v1/webhooks/freemius`

---

## Phase 3 — Deploy web Next.js sur Vercel

### 3.1 Créer le projet Vercel

1. https://vercel.com/new → Import GitHub `Templaoo/tempaloo-webp`
2. **Root Directory** : `web`
3. **Framework Preset** : Next.js (auto-détecté)
4. **Build Command** : `npm run build` (default)
5. **Output Directory** : `.next` (default)

### 3.2 Variables d'environnement

| Var | Valeur |
|---|---|
| `TEMPALOO_API_BASE` | `https://api.tempaloo.com/v1` |
| `TEMPALOO_INTERNAL_KEY` | (le même `INTERNAL_API_KEY` que Render) |
| `BETTER_AUTH_SECRET` | rotater |
| `BETTER_AUTH_URL` | `https://tempaloo.com` |
| `GOOGLE_CLIENT_ID` | depuis Neon Auth Console |
| `GOOGLE_CLIENT_SECRET` | depuis Neon Auth Console |
| `DATABASE_URL` | la même qu'API (Neon Auth lit Better Auth tables) |

### 3.3 DNS pour `tempaloo.com`

Vercel propose 2 options :

**Option A — racine apex** (`tempaloo.com`):
| Type | Name | Value |
|---|---|---|
| `A` | `@` | `76.76.21.21` (IP Vercel) |
| `CNAME` | `www` | `cname.vercel-dns.com` |

**Option B — utiliser Vercel comme DNS** (plus simple, Vercel gère tout) — pointer les nameservers du domaine vers `ns1.vercel-dns.com` + `ns2.vercel-dns.com`.

### 3.4 Vérifications finales E2E

1. https://tempaloo.com → landing visible
2. https://tempaloo.com/webp/activate → page activate D1 visible
3. Sign in Google → callback → /webp/dashboard → liste licences
4. Plugin WP avec default URL (= api.tempaloo.com) → activate → upload → conversion
5. Webhook Freemius : faire un achat test (carte `4242 4242 4242 4242`) → vérifier que la licence apparaît dans /webp/dashboard

---

## Coût récurrent total après Phase 3

- **Render Starter** : $7/mo
- **Vercel Hobby** : $0/mo
- **Neon Free** : $0/mo
- **Domaine `tempaloo.com`** : ~12€/an chez ton registrar

≈ **7 USD/mo + 1 €/mo amorti pour le domaine** = ~8€/mois total infra Tempaloo en production.

---

## Monitoring à brancher après Phase 3 (optionnel mais recommandé avant lancement public)

- **BetterStack Uptime** (free tier) → ping `https://api.tempaloo.com/health` toutes les 1 min, alerte email/SMS si down
- **Sentry** (free tier 5k events/mo) → set `SENTRY_DSN` côté Render et Vercel pour catch les crashs
- **Render Logs** intégrés (gratuits 7 jours) — checker régulièrement les WARN/ERROR
