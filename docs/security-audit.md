# Security audit — Tempaloo WebP

**Date**: 2026-04-24
**Scope**: plugin WordPress PHP (`plugin/tempaloo-webp/`), API Fastify (`api/`), app Next.js (`web/`)
**Method**: static code review + `npm audit` + `composer phpcs` (WP security ruleset) + grep-based pattern scan against OWASP Top 10

---

## 0. Résumé exécutif

| Sévérité | Compte | Surface principalement affectée |
|---|---|---|
| 🔴 **Critical** | 2 | Next.js (dep), secrets |
| 🟠 **High** | 3 | Node deps (Fastify, Next) |
| 🟡 **Medium** | 6 | API hardening, rate limiting, headers |
| 🟢 **Low** | 5 | Defense-in-depth, polish |
| ℹ️ **Info** | 4 | Bonnes pratiques absentes mais non-exploitables |

### Les 5 actions à faire **avant** d'accepter du trafic public

1. **🔴 SEC-001** — Rotation effective des 5 secrets listés dans `project_security_rotate_keys.md`. La valeur actuelle de `FREEMIUS_API_KEY` a été observée égale à la valeur listée comme exposée. La rotation est peut-être incomplète.
2. **🔴 SEC-002** — Upgrade `better-auth` (CVE critique, 2FA bypass via session.cookieCache) et `@neondatabase/auth` qui en dépend.
3. **🟠 SEC-003** — Upgrade `fastify` (au moins patcher vers la dernière 4.x) pour les 3 CVEs (DoS sendWebStream, body validation bypass, X-Forwarded-Proto spoofing).
4. **🟠 SEC-004** — Upgrade `next` (au moins vers le patch le plus récent 14.2.x) pour les DoS HTTP request deserialization + rewrites smuggling.
5. **🟡 SEC-005** — Ajouter `@fastify/helmet` + rate-limit par license_key sur `/convert/*`.

---

## 1. Méthodologie

### Outils utilisés
- **`npm audit`** sur les 3 `package.json` (api, web, plugin/admin-app)
- **`composer exec phpcs`** avec WordPress Security ruleset
- **`grep -E` pattern scan** pour les failles OWASP classiques (SQL injection, XSS, open redirect, CSRF, path traversal, insecure deserialization)
- **Revue manuelle** des chemins d'authentification et authorization

### Surfaces auditées

| # | Surface | Entrée utilisateur |
|---|---|---|
| 1 | **Plugin WordPress** (PHP) | WP admin UI, REST API `/tempaloo-webp/v1/*`, AJAX `wp_ajax_*`, `wp_handle_upload` hook |
| 2 | **API Fastify** (Node.js) | HTTP endpoints publics : `/v1/convert`, `/v1/quota`, `/v1/license/*`, `/v1/webhooks/freemius` + internal `/v1/account/*` |
| 3 | **App Next.js** (Web) | Pages publiques (`/webp`, `/webp/activate`), pages authed (`/webp/dashboard`), API routes (`/api/me`, `/api/sites/deactivate`, `/api/activate`, `/api/auth/*`) |

---

## 2. Findings par sévérité

### 🔴 SEC-001 — Rotation des secrets possiblement incomplète

**Sévérité** : Critical
**Surface** : tous les services (API, Web, plugin en local)
**Statut** : à vérifier côté humain

**Description** : La mémoire `project_security_rotate_keys.md` liste 5 credentials exposés en clair dans des transcripts de conversation (Neon password, 2 Freemius keys, INTERNAL_API_KEY, Stitch key). L'utilisateur a confirmé une rotation le 2026-04-24, **mais un screenshot IDE postérieur montrait toujours la valeur leaked `b9a835...` dans `api/.env`**. Soit la rotation a été faite mais le fichier local n'a pas été mis à jour, soit une seule clé a été rotée sur cinq.

**Impact** : Un attaquant qui découvre les anciens tokens dans un log/transcript peut :
- Lire et modifier la DB Neon (DATABASE_URL)
- Falsifier des webhooks Freemius (SECRET_KEY)
- Appeler l'API Freemius au nom du compte (API_KEY)
- Bypass l'auth serveur-à-serveur entre web et API (INTERNAL_API_KEY)

**Remédiation** :
1. Dans Neon Console → Project `restless-cherry-57470983` → Settings → Roles → `neondb_owner` → **Reset password** (si pas déjà fait)
2. Dans Freemius Dashboard → Product 28337 → Settings → Keys → **Regenerate Secret**
3. Dans Freemius Dashboard → Product 28337 → API & Keys → **Regenerate Token**
4. Dans Freemius Dashboard → My Profile → Keys → **Regenerate Developer Secret**
5. Mettre les nouvelles valeurs dans Render Env vars ET dans `api/.env` local
6. Vérifier que chaque nouvelle valeur est **différente** de la valeur listée dans la mémoire de rotation

**Effort** : ~15 min côté dashboards + update env vars Render

---

### 🔴 SEC-002 — Vulnérabilité critique dans `better-auth` (2FA bypass)

**Sévérité** : Critical
**Surface** : Web Next.js (auth session)
**CVE** : [GHSA inside better-auth + `@neondatabase/auth`](https://github.com/advisories) — *"Two-Factor Authentication Bypass via Premature Session Caching (session.cookieCache)"*

**Description** : La session cookie est mise en cache avant que la vérif 2FA soit complète, permettant à un attaquant qui intercepte un login en cours de contourner le second facteur.

**Impact** : Si tu actives jamais le 2FA pour tes clients dashboard, un attaquant peut bypass. Pour l'instant on n'utilise pas 2FA → **risque latent, pas exploité** en prod actuelle.

**Remédiation** :
```bash
cd web && npm install better-auth@latest @neondatabase/auth@latest
```
Tester que le flow Google OAuth + dashboard marche toujours après l'upgrade. Si breaking changes, consulter le changelog.

**Effort** : 30 min-1h selon breaking changes

---

### 🟠 SEC-003 — `fastify` 4.x vulnérable (3 CVEs)

**Sévérité** : High (global : 1 high + 2 moderate cumulés)
**Surface** : API
**CVEs** :
- `GHSA-mrq3-vjjr-p77c` — **High**. DoS via unbounded memory allocation dans `sendWebStream`.
- `GHSA-jx2c-rxcm-jvmq` — Content-Type header avec tab character bypass la body validation.
- `GHSA-444r-cwp2-x5xf` — `request.protocol` et `request.host` spoofables via `X-Forwarded-Proto/Host` depuis des connexions untrusted.

**Impact** : Le spoofing X-Forwarded-Host est le plus concret — notre API est derrière le proxy Render qui set ces headers. Si un attaquant arrive à envoyer directement à l'origin Render (très difficile mais pas impossible selon config), il peut manipuler `req.host` et éventuellement bypass certains checks. DoS possible sur le streaming endpoint.

**Remédiation** :
```bash
cd api && npm install fastify@^4.29  # dernière 4.x patchée
# OU migrer vers fastify@5 (breaking, évaluer):
npm install fastify@latest
```
Recommandation : **stay on 4.x** pour l'instant, bump minor. Migration 4→5 est coûteuse.

Vérifier aussi dans `api/src/app.ts` que `trustProxy: true` est bien ciblé (actuellement c'est le cas, mais avec un CIDR d'IPs Render explicites c'est encore mieux — hors scope MVP).

**Effort** : 30 min (patch minor) ou 2-4h (migration majeure)

---

### 🟠 SEC-004 — `next@14.2.15` : 4 CVEs (2 high, 2 moderate)

**Sévérité** : High
**Surface** : Web
**CVEs** :
- High : DoS via HTTP request deserialization (React Server Components mal configurés)
- High : DoS with Server Components
- Moderate : HTTP request smuggling dans `rewrites`
- Moderate : Image Optimizer `remotePatterns` config DoS + unbounded disk cache

**Impact** : Tous sont des DoS. Pas d'exposition directe de données, mais un attaquant peut saturer nos fonctions Vercel (limit free tier = problème facturation).

**Remédiation** :
```bash
cd web && npm install next@^14.2.35  # dernière 14.2.x stable (pas 16 qui est breaking)
```
Next 16 est indiqué par `npm audit fix --force` mais casse énormément. Reste sur 14.2.x patch version.

**Effort** : 15 min + retest du build Vercel

---

### 🟠 SEC-005 — Rate limiting API trop permissif (IP-based global, pas per-license)

**Sévérité** : High (DoS + bill explosion)
**Surface** : API

**Description** : `api/src/app.ts` enregistre `@fastify/rate-limit` avec `max: 120` / `timeWindow: "1 minute"`. C'est **global, par IP**. Trois problèmes :
1. Un attaquant avec 10 proxies peut faire 1200 req/min
2. Pas de rate limit distinct sur `/convert/*` qui est **CPU-intensive** (sharp + libvips)
3. Un user Unlimited légitime peut envoyer 120 conversions/min pendant des heures — les sharp workers bouffent tout le CPU de la VM Render Starter (0.5 CPU)

**Impact** :
- **Coût runtime** : Render Starter 0.5 CPU saturé → lenteur pour tous les users
- **Coût monétaire** : si auto-scale activé (pas le cas actuel), factorisé par 10

**Remédiation** : ajouter un rate-limit par licence sur `/convert/*` :
```ts
await app.register(rateLimit, {
    global: false,  // déjà OK
    max: 120, timeWindow: "1 minute",
});
// Dans routes/convert.ts, avant la logique :
fastify.post("/convert/batch", {
    config: {
        rateLimit: {
            max: 30, timeWindow: "1 minute",
            keyGenerator: (req) => req.headers["x-license-key"] as string ?? req.ip,
        },
    },
}, handler);
```

**Effort** : 1h

---

### 🟡 SEC-006 — Pas de security headers sur l'API Fastify

**Sévérité** : Medium
**Surface** : API

**Description** : Aucun middleware `helmet` ou équivalent n'est enregistré dans `api/src/app.ts`. Headers manquants :
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY` (peu utile pour API JSON mais ne coûte rien)
- `Permissions-Policy: ...`

**Impact** : Faible car l'API ne sert que du JSON (pas d'HTML exploité via MIME sniffing) et n'est jamais embarquée dans une iframe. Mais best practice + futur-proof si un jour on sert du HTML d'erreur.

**Remédiation** :
```bash
cd api && npm install @fastify/helmet
```
```ts
// api/src/app.ts
import helmet from "@fastify/helmet";
await app.register(helmet, {
    contentSecurityPolicy: false, // JSON API, pas de HTML à protéger
    crossOriginResourcePolicy: { policy: "same-origin" },
});
```

**Effort** : 15 min

---

### 🟡 SEC-007 — Comparaison non timing-safe pour `INTERNAL_API_KEY`

**Sévérité** : Medium (théorique, difficilement exploitable)
**Surface** : API

**Description** : Dans `api/src/routes/account.ts`, l'auth interne est vérifiée par :
```ts
if (key !== config.INTERNAL_API_KEY) return reply.code(401)...
```
Le `!==` JavaScript est non-constant-time. Un attaquant mesurant la latence de réponse sur des centaines de tentatives pourrait théoriquement extraire le secret caractère par caractère.

**Impact** : Vraiment théorique. Le jitter réseau dépasse largement la différence de temps causée par une comparaison de 32 chars. Mais c'est trivial à fixer.

**Remédiation** :
```ts
import { timingSafeEqual } from "node:crypto";

function secureEquals(a: string, b: string): boolean {
    const aBuf = Buffer.from(a, "utf8");
    const bBuf = Buffer.from(b, "utf8");
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
}

// puis :
if (!secureEquals(key, config.INTERNAL_API_KEY)) return reply.code(401)...
```

**Effort** : 20 min (+ appliquer la même logique aux comparaisons `license_key` dans `auth.ts` — marginal mais cohérent)

---

### 🟡 SEC-008 — Script Freemius Checkout chargé sans SRI

**Sévérité** : Medium
**Surface** : Plugin + Web

**Description** : Le bouton "Upgrade" charge `https://checkout.freemius.com/checkout.min.js` dynamiquement. Pas de `integrity="sha384-..."` attribute → si freemius.com est compromis, un JS malveillant peut s'exécuter dans le contexte de `wp-admin`.

**Impact** : Probabilité : très faible (Freemius est une société établie). Gravité si exploit : accès complet à la session WP admin du client = **RCE de facto** sur tous les sites de nos users.

**Remédiation** :
1. Récupérer le hash SHA-384 du script Freemius actuel :
   ```
   curl -s https://checkout.freemius.com/checkout.min.js | openssl dgst -sha384 -binary | openssl base64 -A
   ```
2. Ajouter `integrity="sha384-<hash>" crossorigin="anonymous"` au `<script>` tag (dans le plugin admin-app ET web/webp/activate)
3. Prévoir un système de mise à jour du hash (Freemius update le script → SRI casse → on doit re-pinner) : via un cron qui alert si hash change ; OU ne pas pinner et accepter le risque

**Trade-off honnête** : le SRI de scripts tiers mis à jour fréquemment est une plaie à maintenir. La plupart des plugins WP ne le font pas. **Acceptable de skipper** pour un MVP, à reconsidérer si Tempaloo grossit.

**Effort** : 1h pour setup + monitoring de hash

---

### 🟡 SEC-009 — `uninstall.php` incomplet

**Sévérité** : Medium (propreté + privacy)
**Surface** : Plugin

**Description** : `uninstall.php` supprime `tempaloo_webp_settings` et `tempaloo_webp_quota_exceeded_at` MAIS pas :
- `tempaloo_webp_api_health` (option d'état API)
- `tempaloo_webp_retry_queue` (peut contenir des IDs d'attachments)
- `tempaloo_webp_bulk_state` (état bulk en cours)
- L'event cron `tempaloo_webp_retry_tick` → continuera à s'exécuter à vide

**Impact** : Pollution de la DB WP du user après désinstall. L'event cron fantôme log une entrée muette toutes les 5 min.

**Remédiation** :
```php
// uninstall.php
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) exit;

$options = [
    'tempaloo_webp_settings',
    'tempaloo_webp_quota_exceeded_at',
    'tempaloo_webp_api_health',
    'tempaloo_webp_retry_queue',
    'tempaloo_webp_bulk_state',
];
foreach ( $options as $opt ) {
    delete_option( $opt );
}
wp_clear_scheduled_hook( 'tempaloo_webp_retry_tick' );
```

**Effort** : 10 min

---

### 🟡 SEC-010 — Pas de Content-Security-Policy sur le web

**Sévérité** : Medium
**Surface** : Web

**Description** : `next.config.mjs` n'a pas de `headers()` custom qui pose un CSP. Le navigateur accepte donc tout script inline, tout iframe, tout `fetch` externe.

**Impact** : Si jamais une faille XSS passe (ex: on introduit un jour un CMS editor user-driven), pas de filet de sécurité.

**Remédiation** :
```js
// next.config.mjs
const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://checkout.freemius.com https://va.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://api.tempaloo.com https://va.vercel-scripts.com",
    "frame-src https://checkout.freemius.com",
    "base-uri 'self'",
    "form-action 'self'",
].join("; ");

export default {
    async headers() {
        return [{
            source: "/:path*",
            headers: [
                { key: "Content-Security-Policy", value: csp },
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
            ],
        }];
    },
};
```

`'unsafe-inline'` est regrettable mais notre LandingPage utilise `<style dangerouslySetInnerHTML>`. À terme, migrer vers CSS modules pour supprimer `unsafe-inline`.

**Effort** : 30 min + test cross-page

---

### 🟡 SEC-011 — CSRF sur `/api/sites/deactivate` sans double vérification

**Sévérité** : Medium (théorique en 2026)
**Surface** : Web

**Description** : `POST /api/sites/deactivate` ne fait AUCUNE vérif CSRF explicite. Il s'appuie uniquement sur :
- Session cookie (set par Better Auth avec `SameSite=Lax` par défaut)

**Impact** : `SameSite=Lax` bloque la plupart des attaques CSRF en 2026 (tous les navigateurs majeurs le respectent). Mais un attaquant qui exploite un XSS sur `tempaloo.com` peut toujours faire l'appel (SameSite permet le même-site). Défense en profondeur recommande un double-check origin/referer.

**Remédiation** :
```ts
// web/app/api/sites/deactivate/route.ts
export async function POST(req: Request) {
    const origin = req.headers.get("origin");
    if (origin && !origin.endsWith("tempaloo.com") && !origin.includes("localhost")) {
        return NextResponse.json({ error: "bad_origin" }, { status: 403 });
    }
    // … rest unchanged
}
```

**Effort** : 15 min

---

### 🟢 SEC-012 — License keys en plaintext dans `wp_options`

**Sévérité** : Low (acceptable industry-standard)
**Surface** : Plugin

**Description** : La clé API (`license_key`) est stockée en clair dans `wp_options.tempaloo_webp_settings`. N'importe qui avec accès à la DB WP (root MySQL, shared hosting backup exposé) peut la lire.

**Impact** : Un attaquant avec accès DB a déjà compromis le site, donc le risque incrémental est faible. Standard industry (ShortPixel, Imagify font pareil).

**Remédiation** : optionnel — chiffrer avec `wp_salt()` en before-store / decrypt-on-read. Pas vraiment nécessaire à l'échelle actuelle.

**Effort** : 2h si on veut le faire ; sinon accepter le risque.

---

### 🟢 SEC-013 — Pas de per-license rate limiting sur `/api/sites/deactivate`

**Sévérité** : Low
**Surface** : Web

**Description** : Un attaquant avec session valide peut appeler `deactivate` 1000x/s. Pas destructif (idempotent) mais peut saturer notre API.

**Remédiation** : ajouter un compteur in-memory ou Neon pour limiter à 60/min/user. Ou accepter (saturation se propage juste au proxy Next → Render).

**Effort** : 30 min pour un rate limit naïf

---

### 🟢 SEC-014 — `error_log()` dans retry queue

**Sévérité** : Low (audit trail only)
**Surface** : Plugin

**Description** : `class-retry-queue.php` utilise `error_log()` pour tracer les abandons. Le message inclut `$attachment_id` et `$error_code`. **Pas de données sensibles**, mais sur un shared hosting mal configuré, error_log peut atterrir dans un fichier world-readable.

**Impact** : Faible — pas de PII, juste des IDs numériques.

**Remédiation** : acceptable en l'état. Si on veut être strict, remplacer par `do_action( 'tempaloo_webp_log', ... )` que les admins peuvent hooker.

**Effort** : marginal.

---

### 🟢 SEC-015 — Pas de CSP Report-Only pour détecter les XSS futurs

**Sévérité** : Low
**Surface** : Web

**Description** : Une fois le CSP implémenté (SEC-010), penser à ajouter un endpoint `report-uri` pour être alerté si le CSP est violé → détecte des XSS avant qu'un user les subisse.

**Remédiation** : post-SEC-010, ajouter `report-uri https://tempaloo.report-uri.com/r/d/csp/enforce` (gratuit jusqu'à 10k reports/jour).

**Effort** : 15 min après SEC-010.

---

### 🟢 SEC-016 — Pas de logging centralisé des auth failures

**Sévérité** : Low (detection)
**Surface** : API

**Description** : Les 401 sur `/convert/*` sont retournés via `err.unauthorized()` mais jamais agrégés côté monitoring. Un attaquant qui brute-force des clés API n'est pas détecté.

**Remédiation** : quand on branchera Sentry (`SENTRY_DSN` déjà prévu dans config), ajouter un capture manuel sur les 401 consécutifs depuis même IP > N. Ou dashboard basique Render logs.

**Effort** : 1h après mise en place Sentry.

---

### ℹ️ SEC-017 — Pas de 2FA sur le dashboard users

Information only — pas prévu par la spec, acceptable pour MVP.

### ℹ️ SEC-018 — Pas de backup strategy documentée pour Neon

Information only — Neon fait des backups auto, mais pas de restore drill documenté. Voir `docs/disaster-recovery.md` à créer post-launch.

### ℹ️ SEC-019 — Pas de WAF devant l'API

Information only — Render n'a pas de WAF intégré. Si on veut ce niveau, Cloudflare devant `api.tempaloo.com` pour $0 en Free tier.

### ℹ️ SEC-020 — Pas de bug bounty / responsible disclosure policy

Information only — poster `SECURITY.md` à la racine du repo GitHub avec un contact `security@tempaloo.com` est recommandé avant go-live public.

---

## 3. Ce qui est déjà solide

### ✅ Points forts validés

| Contrôle | Surface | Détail |
|---|---|---|
| **SQL injection prevention** | Plugin + API | Toutes les requêtes paramétrisées (`$wpdb->prepare()`, `$1/$2` dans pg) |
| **Output escaping (XSS)** | Plugin | `esc_html`, `esc_url_raw` sur toutes les sorties HTML |
| **CSRF — WP admin** | Plugin | Nonces + `check_ajax_referer` partout + `current_user_can('manage_options')` |
| **Input validation** | API | Zod schemas sur tous les endpoints publics |
| **Webhook signature** | API | Freemius HMAC vérifié via leur SDK officiel |
| **File upload limits** | API | `@fastify/multipart` avec `fileSize: 25 MB` hard cap (ligne 25 `app.ts`) |
| **Session cookie security** | Web | Better Auth default: `HttpOnly` + `Secure` + `SameSite=Lax` |
| **HTTPS enforced** | Partout | Render + Vercel auto-SSL, pas de fallback HTTP |
| **Secrets not in git** | Tous | `.env` gitignoré, seul `.env.example` tracké |
| **Text domain / i18n** | Plugin | Toutes les user-facing strings passent par `__()` |
| **Capability checks** | Plugin | `manage_options` sur toute action admin |
| **Image storage** | API | Zéro rétention — files streamés, jamais écrits sur disque API |
| **Quota atomicity** | API | `consume_quota()` SQL function (lock + increment en transaction) |
| **Sanitization** | Plugin | `$_SERVER['HTTP_ACCEPT']` passe par `sanitize_text_field(wp_unslash(...))` |

---

## 4. Roadmap de remédiation

### 🚨 Avant trafic public (P0, ~3-4 h)
- [ ] **SEC-001** Rotation effective des 5 secrets + verification
- [ ] **SEC-002** Upgrade `better-auth` + `@neondatabase/auth` + test flow auth
- [ ] **SEC-003** Upgrade `fastify@^4.29`
- [ ] **SEC-004** Upgrade `next@^14.2.35`

### 🟠 Avant premiers 100 clients payants (P1, ~3-4 h)
- [ ] **SEC-005** Rate-limit per-license sur `/convert/*`
- [ ] **SEC-006** Ajouter `@fastify/helmet`
- [ ] **SEC-009** Compléter `uninstall.php`
- [ ] **SEC-010** CSP + security headers Next.js
- [ ] **SEC-011** Origin check sur `/api/sites/deactivate`

### 💡 Quand tu as du temps (P2)
- [ ] **SEC-007** `timingSafeEqual` pour les comparaisons de clés
- [ ] **SEC-008** SRI sur le script Freemius (avec monitoring)
- [ ] **SEC-015** CSP report-uri
- [ ] **SEC-016** Sentry sur 401 patterns
- [ ] **SEC-020** Publier `SECURITY.md` avec `security@tempaloo.com`

### ℹ️ Post-scale
- [ ] **SEC-012** Chiffrer license_key dans wp_options
- [ ] **SEC-017** 2FA dashboard
- [ ] **SEC-018** Disaster recovery runbook
- [ ] **SEC-019** Cloudflare WAF devant api.tempaloo.com

---

## 5. Commandes de réexécution

Pour rerun cet audit après changements :

```bash
# Dépendances Node
(cd api && npm audit --omit=dev)
(cd web && npm audit --omit=dev)
(cd plugin/tempaloo-webp/admin-app && npm audit --omit=dev)

# PHP static analysis (ruleset sécurité)
composer exec phpcs

# Grep patterns OWASP
grep -rn "\$_GET\|\$_POST\|\$_REQUEST" plugin/tempaloo-webp/includes/ | grep -v 'sanitize\|wp_unslash'
grep -rn "innerHTML\|dangerouslySetInnerHTML" web/ api/ --include="*.ts" --include="*.tsx"
grep -rn "eval\|Function\|setTimeout.*string" web/ api/ plugin/
```

---

## 6. Contacts et refs

- **OWASP Top 10 2021** : https://owasp.org/Top10/
- **WordPress Plugin Handbook — Security** : https://developer.wordpress.org/plugins/security/
- **Fastify Security Considerations** : https://fastify.dev/docs/latest/Reference/Recommendations/
- **Next.js Security Headers** : https://nextjs.org/docs/app/building-your-application/configuring/security-headers
- **GHSA Advisory Database** : https://github.com/advisories
- **Internal — rotation des secrets** : voir mémoire `project_security_rotate_keys.md`

---

**Dernière mise à jour** : 2026-04-24
**Re-auditer** : après chaque major upgrade de dep, avant chaque milestone produit (beta, launch, paid feature), et tous les 6 mois minimum.
