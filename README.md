# Tempaloo WebP

Plugin WordPress freemium de conversion d'images en **WebP** (et **AVIF** en Pro), adossé à une API Node.js.

- **Plugin WP** (`plugin/tempaloo-webp/`) — hooks WP, bulk, filtres URL, page réglages.
- **API** (`api/`) — Fastify + sharp (libvips), tests Vitest. Spec dans `api/openapi.yaml`.
- **Base de données** (`db/`) — schéma Postgres (Neon en prod).
- **Landing** (`web/`) — Next.js déployé sur Vercel, `tempaloo.com/webp` et `/webp/activate`.

Plan produit complet : voir [`plan-de-travail.md`](./plan-de-travail.md).

---

## Prérequis

| Outil | Version min. | Usage |
|---|---|---|
| Node.js | 20.x LTS | API + landing |
| pnpm | 9.x | gestion des deps |
| PostgreSQL | 15+ | base (local Docker ou Neon) |
| Docker | 24+ (optionnel) | Postgres local |
| PHP | 7.4+ | plugin WP (dev) |
| Composer | 2.x | deps PHP (Freemius SDK) |
| wp-cli | 2.x (optionnel) | scripts plugin |

Comptes à créer :
- [Neon](https://neon.tech) — Postgres gratuit (0,5 Go)
- [Freemius](https://freemius.com) — paiement + licences (compte créé ✅)
- [Vercel](https://vercel.com) — landing (à venir)
- [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) — stockage transit (Phase 2)
- [Sentry](https://sentry.io) — monitoring erreurs (Phase 1.5)

---

## Variables d'environnement

Copier `.env.example` en `.env` dans chaque package.

**API** (`api/.env`) :
```
DATABASE_URL=postgresql://user:pass@host/db
PORT=3000
NODE_ENV=development

FREEMIUS_PLUGIN_ID=xxxxx
FREEMIUS_SECRET_KEY=sk_xxx
FREEMIUS_PUBLIC_KEY=pk_xxx

MAX_IMAGE_BYTES=26214400          # 25 Mo
DEFAULT_QUALITY=82

SENTRY_DSN=
```

---

## Setup initial

```bash
# 1. Base de données (Neon ou local)
psql "$DATABASE_URL" -f db/schema.sql

# 2. API
cd api
pnpm install
pnpm dev

# 3. Plugin WP (via Local/LocalWP ou wp-env)
# à venir en Phase 1
```

---

## État d'avancement

- [x] Phase 0 — Cadrage : grille tarifaire, branding, schéma DB, spec OpenAPI
- [x] Phase 1 — MVP API : `/convert`, `/quota`, `/license/*`, `/webhooks/freemius`, tests Vitest
- [x] Phase 1 — Plugin WordPress : settings, API client, auto-conversion, URL filter, bulk
- [x] Phase 2 — Conversion en masse (bulk UI + resumable)
- [x] Phase 3 — Landing Next.js + page `/activate` (flux Free fonctionnel)
- [ ] Phase 3b — Checkout payant Freemius (bloqué sur Plugin ID)
- [ ] Phase 4 — Bêta privée
- [ ] Phase 5 — Lancement WordPress.org
