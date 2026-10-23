# GUEM'S MINING SARL — Informations confirmées et informations à compléter

Ce document fait le point sur les informations utilisées dans le site. Une information non confirmée
**n'apparaît pas** dans la version publique : elle est omise, jamais inventée.

## 1. Informations confirmées (documents administratifs fournis)

| Information | Valeur | Où elle apparaît |
|---|---|---|
| Dénomination | GUEM'S MINING SARL | Partout |
| Nom commercial | GUEM'S MINING | Partout |
| Forme juridique | SARL unipersonnelle | À propos, Mentions légales |
| Secteur d'activité | Exploitation minière | Accueil, À propos |
| Activité principale déclarée | Autres extractions | Accueil, À propos, Activités |
| Activité secondaire déclarée | Exploitation minière | Accueil, À propos, Activités |
| Établissement principal | Nouveau Secteur 37, Ouagadougou, Burkina Faso | Contact, pied de page, données structurées |
| Téléphone | +226 76 32 87 49 | Contact, pied de page, boutons d'appel |
| Capital social | 3 000 000 FCFA | À propos, Mentions légales |
| Logo | Fourni (noir et orange) — ses couleurs servent de charte au site | En-tête, favicon, image de partage, couleurs |

Volontairement **non publiés** (décision explicite de l'entreprise requise) : IFU, RCCM, numéro de
sécurité sociale (CNSS), signatures, identité et coordonnées personnelles du gérant.

## 1 bis. Informations fournies par l'entreprise

| Information | Valeur |
|---|---|
| Présentation | Entreprise burkinabè spécialisée dans les activités minières et services connexes : sous-traitance minière, fourniture d'équipements et appui à l'exploitation |
| Ambition | Devenir un partenaire fiable de la chaîne de valeur minière au Burkina Faso et dans l'espace AES |
| Activités | Prestations de services pour sociétés minières ; fourniture et location d'équipements ; approvisionnement et logistique minière |

## 2. Informations manquantes — à fournir par l'entreprise

| # | Information | Effet sur le site | Où la renseigner |
|---|---|---|---|
| 1 | **Adresse e-mail professionnelle** de réception des messages | Le formulaire affiche « service non disponible » tant qu'elle n'est pas configurée | `contact-config.php` (voir README) et `content/site.json` → `company.email` |
| 2 | **Nom de domaine** définitif | Canoniques, sitemap et partages utilisent un domaine provisoire | `content/site.json` → `siteUrl` |
| 3 | Confirmation que le **+226 76 32 87 49 est actif sur WhatsApp** | Le bouton WhatsApp pointe vers ce numéro | `content/site.json` → `company.whatsapp` |
| 4 | **Adresse exacte / coordonnées GPS** du siège | Pas de carte affichée tant que l'adresse n'est pas confirmée | `content/site.json` → `features.mapEmbedUrl` |
| 5 | **Photographies** : 4 photos d'engins fournies et intégrées comme images d'illustration (marques JCB et CAT visibles). Vérifier les **droits d'utilisation** et, idéalement, les remplacer par des photos **propres à l'entreprise**, en meilleure résolution (≥ 1600 px de large pour la bannière) | Les mentions légales précisent qu'il s'agit d'illustrations | `static/assets/img/photos/` et `content/site.json` → `images` |
| 6 | Validation des textes **mission et valeurs** (proposés à titre éditorial ; la présentation « Qui sommes-nous » et l'ambition ont été fournies par l'entreprise) | Publiés comme propositions | `content/i18n/fr.json` et `en.json` (`about.mission`, `home.values`) |
| 7 | Détails des **3 activités** fournies (types d'équipements proposés, zones d'intervention, références) et **suite éventuelle de la liste d'activités** | Les descriptions restent générales | `content/i18n/*.json` → `activities.items` |
| 8 | **Permis ou autorisations** minières (le cas échéant, avec justificatifs) | Aucune mention de permis sur le site | À ajouter dans À propos après validation |
| 9 | **Politiques sécurité (HSE) et environnement** réellement appliquées | Un message invitant à contacter l'entreprise est affiché à la place | `content/i18n/*.json` → `expertise.safety/environment.text`, `home.hse.text`, puis `features.showHsePolicy: true` |
| 10 | **Projets et réalisations** documentés et autorisés à la publication | La page affiche un message sobre « aucune réalisation publiée » | Interface `/admin/` ou `content/projects/` |
| 11 | **Actualités** à publier | La page affiche « aucune actualité publiée » | Interface `/admin/` ou `content/news/` |
| 12 | Date de création, historique, dirigeants, effectifs, partenaires | Non mentionnés | À ajouter après validation |
| 13 | Réseaux sociaux officiels (Facebook, LinkedIn…) | Icônes masquées | `content/site.json` → `company.social` |
| 14 | Hébergeur du site et responsable de publication | Absents des mentions légales | `content/i18n/*.json` → `legal` |

## 3. Points d'attention

- Aucune statistique, certification, badge ISO, partenariat ou promesse commerciale n'a été ajouté.
- Les photos d'engins sont présentées comme illustrations, jamais comme du matériel ou des réalisations de l'entreprise ; les mentions légales le précisent.
- Le site ne promet aucun classement dans les moteurs de recherche.
