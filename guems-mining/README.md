# Site officiel de GUEM'S MINING SARL

Site vitrine bilingue (français / anglais), identité noir et orange, généré en pages statiques
par un petit script Node.js **sans aucune dépendance**. Le formulaire de contact est traité
par un script PHP compatible avec les hébergements mutualisés classiques.

> Avant la mise en ligne, lisez [`A-COMPLETER.md`](A-COMPLETER.md) : il liste les informations
> confirmées et celles que l'entreprise doit encore fournir (e-mail, domaine, photos…).

## Contenu

| Page | Français | Anglais |
|---|---|---|
| Accueil | `/fr/` | `/en/` |
| À propos | `/fr/a-propos/` | `/en/about/` |
| Activités | `/fr/activites/` | `/en/activities/` |
| Expertise et engagements | `/fr/expertise/` | `/en/expertise/` |
| Réalisations (liste + fiches) | `/fr/realisations/` | `/en/projects/` |
| Actualités (liste, filtres, articles, partage) | `/fr/actualites/` | `/en/news/` |
| Contact (formulaire, appel, WhatsApp) | `/fr/contact/` | `/en/contact/` |
| Mentions légales et confidentialité | `/fr/mentions-legales/` | `/en/legal/` |
| Page 404 bilingue | `/404.html` | |
| Administration (actualités, projets) | `/admin/` | |

La racine `/` redirige vers la langue mémorisée du visiteur, sinon vers celle de son navigateur.
Le sélecteur FR / EN mène à la page équivalente dans l'autre langue.

## Arborescence

```
guems-mining/
├── build.mjs                 Générateur du site (→ dist/)
├── src/lib.mjs               Utilitaires : échappement, Markdown, icônes
├── content/
│   ├── site.json             Informations de l'entreprise, options, images
│   ├── i18n/fr.json, en.json Tous les textes (pages, menus, formulaires, SEO)
│   ├── news/*.json           Actualités (un fichier par article)
│   └── projects/*.json       Réalisations (un fichier par projet)
├── static/                   Copié tel quel dans dist/
│   ├── assets/css, js, img   Styles, scripts, logo, illustrations
│   ├── contact.php           Réception du formulaire
│   ├── contact-config.example.php
│   ├── admin/                Interface Decap CMS
│   └── .htaccess             Configuration Apache (404, cache, sécurité)
├── tests/check.mjs           Vérifications automatiques
└── tools/generate-illustrations.mjs
```

## Installation et prévisualisation

Prérequis : Node.js 18 ou plus récent ; PHP 8 pour tester le formulaire en local.

```bash
cd guems-mining
npm run build      # génère dist/
npm test           # génère puis vérifie liens, H1, SEO, hreflang, alt, traductions
npm run serve      # http://localhost:8080 (serveur PHP intégré)
```

Pour obtenir **un seul fichier HTML** à ouvrir directement dans un navigateur (sans serveur) :
`npm run preview` → `preview/guems-mining-apercu.html`. Dans cet aperçu, le formulaire n'envoie rien.

Pour générer avec le domaine définitif sans modifier le fichier : `SITE_URL=https://www.mon-domaine.bf npm run build`.

## Mise en ligne (hébergement mutualisé PHP / Apache)

1. Renseigner `siteUrl` dans `content/site.json` (domaine définitif, en `https://`).
2. `npm test`
3. Envoyer **le contenu** de `dist/` (y compris le fichier caché `.htaccess`) dans le dossier
   public de l'hébergement (souvent `public_html/` ou `www/`), par FTP/SFTP.
4. Configurer le formulaire (section suivante).
5. Installer un certificat SSL puis décommenter la redirection HTTPS dans `.htaccess`.
6. Déclarer le site dans Google Search Console et y soumettre `https://…/sitemap.xml`.

Si le site est publié dans un sous-dossier (ex. `https://domaine.bf/site/`), indiquer
`"basePath": "/site/"` dans `content/site.json` et adapter `ErrorDocument` dans `.htaccess`.

## Formulaire de contact

Le formulaire est validé dans le navigateur **et** sur le serveur. Il est protégé par un champ
piège invisible, un délai minimal de saisie, une vérification d'origine et une limite de
5 envois par heure et par adresse IP. **Aucun envoi réussi n'est simulé** : le message de
confirmation ne s'affiche que si le serveur confirme l'envoi de l'e-mail.

1. Copier `contact-config.example.php` en `contact-config.php`, **un niveau au-dessus** du
   dossier public (ex. `/home/compte/contact-config.php` si le site est dans `/home/compte/public_html/`).
2. Renseigner `to` (adresse professionnelle de réception) et `from` (adresse du domaine du site,
   ex. `no-reply@mon-domaine.bf`, pour limiter le classement en indésirables).
3. Tester un envoi depuis la page Contact.

Tant que `to` est vide, le formulaire répond « service non disponible » et invite à appeler.

**Alternative sans PHP** (Netlify, GitHub Pages…) : créer un formulaire sur un service tel que
Formspree et indiquer son URL dans `content/site.json` → `contact.endpoint`. Le script attend une
réponse JSON `{"ok": true}`, format renvoyé par Formspree.

## Administration du contenu

### Option 1 — Modifier les fichiers (simple)

- Textes des pages : `content/i18n/fr.json` et `content/i18n/en.json`.
- Actualité : copier `content/news/_exemple-format.json` vers `content/news/mon-article.json`
  (sans « _ »), compléter, mettre `"draft": false`, puis `npm run build` et republier `dist/`.
  Les champs `_en` sont facultatifs : sans traduction, la version anglaise affiche l'article
  en français avec un avertissement.
- Projet : même principe avec `content/projects/_exemple-format.json`.
- Les contenus acceptent un Markdown simple : `## Intertitre`, `**gras**`, `*italique*`,
  listes `- …`, liens `[texte](https://…)`.

### Option 2 — Interface web `/admin/` (Decap CMS)

L'interface permet d'ajouter actualités et projets (FR/EN, images, brouillons) sans toucher
au code. Les contenus sont enregistrés dans le dépôt GitHub ; le site doit ensuite être
regénéré et republié (automatiquement ou manuellement).

1. Vérifier `repo` et `branch` dans `static/admin/config.yml`.
2. Authentification GitHub : Decap a besoin d'un service OAuth.
   - Sur **Netlify** : activer l'authentification GitHub dans les paramètres du site
     (Access control → OAuth). Commande de build : `cd guems-mining && npm run build`,
     dossier publié : `guems-mining/dist`. Utiliser alors l'option Formspree pour le formulaire.
   - Ailleurs : déployer un petit service OAuth compatible Decap (par ex. sur Cloudflare Workers)
     et indiquer son URL dans `base_url`.
3. Se connecter sur `https://mon-domaine/admin/` avec un compte GitHub ayant accès au dépôt.

Les nouveaux contenus sont créés en **brouillon** : décocher « Brouillon » pour publier.

## Photographies

Les bannières et cartes utilisent des illustrations vectorielles abstraites (noir et orange) tant
qu'aucune photographie n'est fournie. Pour utiliser de vraies photos :

1. Déposer les fichiers (JPEG ou WebP, environ 1920 px de large pour la bannière, < 400 Ko)
   dans `static/assets/uploads/`.
2. Indiquer les chemins dans `content/site.json` → `images` (ex. `"hero": "assets/uploads/site.jpg"`).

N'utiliser que des photos appartenant à l'entreprise ou sous licence libre (Unsplash, Pexels…),
et ne pas présenter une photo d'illustration comme une réalisation de l'entreprise.

## Options (`content/site.json`)

| Clé | Rôle |
|---|---|
| `siteUrl`, `basePath` | Domaine et sous-dossier de publication |
| `company.*` | Coordonnées (un champ vide est masqué) |
| `contact.endpoint` | `contact.php` ou URL d'un service de formulaires |
| `features.showHsePolicy` | Affiche les textes sécurité/environnement **validés** |
| `features.mapEmbedUrl` | URL d'intégration Google Maps / OpenStreetMap (adresse confirmée uniquement) |
| `images.*` | Photographies de la bannière, de la page À propos et des activités |

## Technique

- HTML sémantique, une seule balise H1 par page, fil d'Ariane, lien d'évitement, navigation
  clavier, menu mobile accessible (Échap pour fermer), animations désactivées si l'utilisateur
  le demande (`prefers-reduced-motion`).
- SEO : titres et descriptions uniques FR/EN, canoniques, `hreflang` (fr, en, x-default),
  `sitemap.xml` avec alternatives, `robots.txt`, Open Graph, données structurées
  `Organization`, `BreadcrumbList` et `NewsArticle` limitées aux informations vérifiées.
- Performance : aucune bibliothèque JavaScript, CSS et JS versionnés pour le cache,
  images différées (`loading="lazy"`), logo en WebP.
- Données personnelles : pas de cookies ni de mesure d'audience ; messages transmis par e-mail
  sans stockage en base de données.
