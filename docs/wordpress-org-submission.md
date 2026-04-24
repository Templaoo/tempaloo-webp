# WordPress.org submission — audit & publishing guide

**Plugin** : Tempaloo WebP — Image Optimizer & AVIF Converter
**Slug prévu** : `tempaloo-webp` (à vérifier dispo : https://wordpress.org/plugins/tempaloo-webp/)
**Version cible** : 0.3.0

---

## Verdict exécutif

🟡 **Presque prêt — 2 h de polish restent avant soumission.**

- ✅ **Structure technique conforme** (GPL, headers, sécurité WP, uninstall clean)
- ✅ **Disclosure externe OK** (fixée dans ce commit via la section External services du readme)
- ⚠ **Assets manquants** (banner + icon + screenshots) — requis dans le SVN `/assets/` pour la fiche publique, optionnels pour la soumission initiale
- ⚠ **Slug à réserver** — rien ne prouve encore que `tempaloo-webp` est libre
- ⚠ **Pages légales manquantes** (Terms + Privacy à tempaloo.com/terms et /privacy) — obligatoires car le readme y réfère
- ⚠ **Freemius SDK** pas bundlé côté PHP (on utilise seulement Checkout overlay JS admin-only) → probablement OK, mais à re-vérifier si on ajoute un jour le SDK Freemius WP

---

## 1. Conformité aux standards WordPress.org

### ✅ Ce qui est bon

| Point | État | Détail |
|---|---|---|
| **Licence GPL-compatible** | ✓ | GPL-2.0-or-later, déclarée dans header + readme |
| **Plugin header complet** | ✓ | Plugin Name, URI, Description, Version, Requires at least (6.0), Requires PHP (7.4), Author, License, Text Domain |
| **`defined('ABSPATH') || exit`** | ✓ | Sur TOUS les fichiers PHP |
| **Capability checks** | ✓ | `current_user_can('manage_options')` sur toute action admin |
| **Nonces** | ✓ | `check_ajax_referer` + `wp_create_nonce` pour AJAX + REST |
| **Escaping** | ✓ | `esc_html`, `esc_url_raw` sur les outputs HTML |
| **Uninstall clean** | ✓ | `uninstall.php` supprime les options |
| **`wp_remote_*`** | ✓ | Pas de cURL direct, utilise l'API WP standard |
| **Pas de binary blobs** | ✓ | Seulement du code + readme + (futurs) assets transparents |
| **Slug unique dans header** | ✓ | `tempaloo-webp`, slug de fichier principal correspond |
| **Text Domain** | ✓ | Déclaré + `load_plugin_textdomain()` wiré |

### ⚠ Ce qui reste à nettoyer

#### 1.1. Assets pour la fiche WordPress.org (requis pour la publication finale)

À fournir dans le SVN à `/assets/` :

- **`icon-256x256.png`** (ou `.svg`) — icône carrée, visible partout dans le Directory
- **`icon-128x128.png`** — fallback pour anciens navigateurs
- **`banner-1544x500.png`** — bannière en haut de la fiche (format large)
- **`banner-772x250.png`** — bannière version retina
- **`screenshot-1.png`** à **`screenshot-4.png`** — copies d'écran qui correspondent à `== Screenshots ==` dans le readme

Le readme référence déjà 4 screenshots, à produire :
1. Dashboard (quota ring + savings)
2. Bulk conversion en cours
3. Badges WEBP dans la médiathèque
4. Settings panel

Outils suggérés : LocalWP pour le screenshot, Figma/Canva pour l'icône et la bannière, style cohérent avec le logo `T` slash qu'on a dans `web/components/Logo.tsx`.

#### 1.2. Pages légales (tempaloo.com)

Le readme cite :
- `https://tempaloo.com/terms` → à créer
- `https://tempaloo.com/privacy` → à créer (OBLIGATOIRE si on collecte des données utilisateur)

Minimum viable Privacy Policy pour un plugin image optimizer :
- Liste des données transmises (images en flux, clé de licence, URL du site, version WP/plugin)
- Durée de rétention (logs d'usage : tant que la licence est active, images : jamais)
- Base légale (consentement à l'activation + exécution du contrat d'abonnement)
- Droits RGPD (accès, suppression, portabilité)
- Contact DPO
- Sous-traitants (Freemius, Render, Neon) + pays

#### 1.3. Slug disponibility

Vérifier **MAINTENANT** : https://wordpress.org/plugins/tempaloo-webp/ → doit renvoyer 404. Si un autre plugin utilise déjà `tempaloo-webp`, impossible de publier. Le slug est sensible — on ne peut pas le changer après soumission.

#### 1.4. "Tested up to" à mettre à jour

`readme.txt` ligne 5 : `Tested up to: 6.7`. À bumper à la dernière WP stable au moment de la soumission (actuellement 6.9 selon le footer LocalWP qu'on a vu dans un screenshot — vérifier avant submit).

#### 1.5. Doublon `register_activation_hook`

`tempaloo-webp.php` enregistre 2 activation hooks :
```php
register_activation_hook( __FILE__, [ 'Tempaloo_WebP_Plugin', 'on_activate' ] );
register_activation_hook( __FILE__, [ 'Tempaloo_WebP_Retry_Queue', 'on_activate' ] );
```
WP n'exécute qu'un seul callback par plugin pour ce hook → le 2e écrase le 1er. À corriger en fusionnant dans une fonction `on_activate` commune (non-critique, la retry queue s'auto-inscrit via `plugins_loaded` de toute façon — mais à nettoyer).

---

## 2. Security review (du code PHP)

### Audit SQL / sanitization

Une seule requête SQL directe dans `class-bulk.php::find_pending_ids` :

```php
$sql = "SELECT ID FROM {$wpdb->posts}
         WHERE post_type = 'attachment' AND post_status = 'inherit'
           AND post_mime_type IN ('image/jpeg','image/png','image/gif')
         ORDER BY ID ASC
         LIMIT {$limit}";
$ids = $wpdb->get_col( $sql );
```

**Verdict** : sûre — `$limit` est `(int) $limit`, pas d'input utilisateur dans la query. Le reviewer WP.org pourrait néanmoins préférer un `$wpdb->prepare()` par principe. Recommandé :

```php
$sql = $wpdb->prepare(
    "SELECT ID FROM {$wpdb->posts}
       WHERE post_type = 'attachment' AND post_status = 'inherit'
         AND post_mime_type IN ('image/jpeg','image/png','image/gif')
       ORDER BY ID ASC
       LIMIT %d",
    $limit
);
```

### Autres points

| Check | Status |
|---|---|
| XSS — output escaping | ✅ `esc_html`, `esc_url_raw` utilisés |
| CSRF — nonces | ✅ `check_ajax_referer` + `wp_verify_nonce` (via WP REST nonce) |
| Authz — capability | ✅ `manage_options` requis pour toute action admin |
| File upload — path traversal | ✅ `get_attached_file` utilisé, pas de manip de chemin brute |
| Remote requests — timeout | ✅ Tous les `wp_remote_*` ont un `timeout` explicite |
| Headers injection | ✅ Pas de headers construits depuis de l'input user |
| Cookies / sessions | ✅ Aucun cookie custom, utilise les sessions WP standard |

---

## 3. Disclosure des services externes (crucial WP.org)

WordPress.org refuse tout plugin qui communique avec un service externe sans disclosure claire. C'est la raison #1 de rejet pour les freemium plugins.

**Fait dans ce commit** : nouvelle section `== External services ==` dans `readme.txt` qui documente :
- Le service appelé (`api.tempaloo.com`)
- Les endpoints utilisés (verify, convert, quota, webhooks)
- Les données envoyées (clé, image bytes, site URL, version WP)
- La rétention (images = jamais, logs = le temps de la licence)
- Le sous-traitant de paiement (Freemius)
- Les liens vers Terms & Privacy

---

## 4. Update mechanism — comment ça marche

C'est la partie que tu demandes explicitement : **comment les users mettent à jour le plugin quand tu ships une nouvelle version ?**

### Option A — Publié sur WordPress.org (recommandé pour Tempaloo Free)

#### Côté WordPress du user
- WP core fait un check automatique **toutes les 12 heures** vers `api.wordpress.org/plugins/update-check/1.1/`
- Il envoie la liste des plugins installés + leur version
- WP.org compare à la `Stable tag` déclarée dans le `readme.txt` **publié sur le repo WP.org**
- Si `readme.txt.Stable_tag > installed_version` → l'user voit une notif "Update available" dans **Dashboard → Updates**
- Clic → WP télécharge le ZIP depuis WP.org et écrase le dossier plugin
- **Zéro configuration** côté plugin : c'est le rôle du core WP

#### Côté toi (release d'une version)
WP.org utilise **SVN** (oui, SVN pas git). Voici le workflow exact :

1. Tu reçois un accès SVN après l'approbation de ton plugin
2. `svn co https://plugins.svn.wordpress.org/tempaloo-webp/ tempaloo-webp-svn`
3. Structure SVN :
   ```
   tempaloo-webp/
   ├── trunk/           ← la dernière version (dev)
   ├── tags/
   │   ├── 0.3.0/       ← tag = copie figée d'une version précise
   │   ├── 0.4.0/
   │   └── …
   └── assets/          ← icon, banner, screenshots (PAS dans le ZIP téléchargé)
   ```
4. Pour publier une nouvelle version :
   ```bash
   # Mettre à jour trunk avec le nouveau code
   cp -R <ton_repo_git>/plugin/tempaloo-webp/* trunk/
   svn add --force trunk/*

   # Mettre à jour la Stable tag dans trunk/readme.txt
   # (déclencheur de la notif update pour les users)
   sed -i 's/Stable tag: .*/Stable tag: 0.4.0/' trunk/readme.txt

   # Tagger la version
   svn cp trunk tags/0.4.0

   # Commit
   svn ci -m "Release 0.4.0"
   ```
5. ~10-15 min plus tard, l'update est disponible pour tous les users.

#### Automatisation recommandée
Créer `.github/workflows/wp-org-release.yml` qui :
- Se déclenche sur un git tag `v*.*.*`
- Build le plugin (admin-app bundle)
- Pousse dans SVN automatiquement via l'action `10up/action-wordpress-plugin-deploy`
- Update les assets si changés

### Option B — Auto-hébergé (sans WordPress.org)

Si tu refuses WP.org (ex: tu veux garder le plugin premium only, pas de Free listing) :

- Librairie `YahnisElsts/plugin-update-checker` (GPL, utilisée par ~10k plugins premium)
- Elle s'accroche au hook WP `pre_set_site_transient_update_plugins`
- Elle query TON endpoint custom (ex: `https://api.tempaloo.com/v1/plugin/update-check`)
- Ton endpoint retourne :
  ```json
  {
    "version": "0.4.0",
    "download_url": "https://downloads.tempaloo.com/tempaloo-webp-0.4.0.zip",
    "tested": "6.9",
    "requires": "6.0",
    "sections": { "description": "...", "changelog": "..." }
  }
  ```
- L'user voit l'update dans le même WP admin que WordPress.org

**Trade-offs** :
- ✅ Pas de review WP.org (tu pushes quand tu veux)
- ❌ Pas de discovery gratuite (perte de ~80% du trafic install)
- ❌ Tu dois servir les ZIPs + endpoint d'update toi-même
- ❌ Les users ne peuvent pas installer depuis "Plugins → Add New" (obligé de fournir un ZIP manuel au premier install)

### Ma reco pour Tempaloo

**Publier le Free sur WordPress.org** (Option A) ET garder l'option B en parallèle si un jour tu veux une version Pro totalement séparée. Mais pour l'instant, une seule version, sur WP.org, suffit — le modèle freemium est supporté via Freemius.

---

## 5. Checklist avant soumission

### À faire MAINTENANT (avant de remplir le formulaire WP.org)

- [ ] Vérifier slug dispo : https://wordpress.org/plugins/tempaloo-webp/ → 404 attendu
- [ ] Page **https://tempaloo.com/terms** live avec texte réel
- [ ] Page **https://tempaloo.com/privacy** live avec disclosure complète
- [ ] Produire les 4 screenshots (LocalWP → F12 → device toolbar → screenshot)
- [ ] Produire `icon-256x256.png`, `banner-1544x500.png`, `banner-772x250.png`
- [ ] Bumper `Tested up to:` à la dernière WP stable
- [ ] Corriger le doublon `register_activation_hook`
- [ ] Ajouter `$wpdb->prepare()` à la requête SQL dans `class-bulk.php` (non-bloquant mais propre)
- [ ] Rotater les 5 secrets (cf. `project_security_rotate_keys.md`) — **si pas encore fait**
- [ ] Générer un build de production propre : `cd plugin/tempaloo-webp/admin-app && npm ci && npm run build`
- [ ] Créer un ZIP clean du plugin (sans `admin-app/node_modules`, `.git`, `.env`) :
  ```bash
  cd plugin/ && zip -r tempaloo-webp-0.3.0.zip tempaloo-webp/ \
      -x "*/admin-app/node_modules/*" -x "*/admin-app/dist/*" -x "*/admin-app/.vite/*"
  ```

### Soumission

1. https://wordpress.org/plugins/developers/add/
2. Upload du ZIP généré
3. Remplir le formulaire :
   - Name : Tempaloo WebP — Image Optimizer & AVIF Converter
   - Description courte : reprendre ligne 11 du readme
   - GPL-2.0-or-later
4. **Attente 2-4 semaines** pour le review manuel de l'équipe des plugins
5. Si rejeté : tu reçois un email avec les raisons (souvent disclosure, nonce, ou external calls)
6. Si accepté : tu reçois un email avec l'accès SVN
7. Tu pousses le premier commit SVN → la fiche est live

### Après acceptation

- [ ] Pousser trunk + tag 0.3.0 dans SVN
- [ ] Pousser les assets dans `/assets/` SVN
- [ ] Setup GitHub Action `10up/action-wordpress-plugin-deploy` pour automatiser les prochains releases
- [ ] Monitoring installs + reviews via https://wordpress.org/plugins/tempaloo-webp/stats/

---

## 6. Ce que je peux automatiser tout de suite

Tu me dis go, je fais :
- [x] readme.txt conforme (**fait dans ce commit**)
- [x] `load_plugin_textdomain()` câblé (**fait dans ce commit**)
- [ ] Correction doublon `register_activation_hook`
- [ ] `$wpdb->prepare()` dans la query bulk
- [ ] Script `scripts/build-wp-org-zip.sh` qui produit le ZIP propre
- [ ] GitHub Action `.github/workflows/wp-org-release.yml` (à activer après l'acceptation SVN)

Je peux PAS faire :
- Les assets graphiques (icône + bannière + screenshots) — à produire par toi ou un designer
- Les pages légales sur tempaloo.com — à rédiger (ou à faire rédiger par un avocat si tu vends en B2B)
- La réservation du slug `tempaloo-webp` (tu dois soumettre le formulaire toi-même avec ton identité)
