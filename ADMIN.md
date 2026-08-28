# Espace d'administration MIERR — guide d'utilisation

Ce guide explique comment mettre le site en ligne sur Hostinger avec son
espace d'administration, et comment l'utiliser au quotidien pour modifier le
contenu **sans écrire de code**.

## 1. Mettre le site en ligne sur Hostinger

1. Dans **hPanel** (le tableau de bord Hostinger), ouvre le **Gestionnaire de
   fichiers** (ou connecte-toi en FTP) et va dans le dossier de ton domaine
   (souvent `public_html`).
2. Dépose **tout le contenu** de ce dossier `La-MIERR` (les fichiers `.html`
   à la racine, ainsi que les dossiers `assets/`, `content/`, `admin/`) —
   pas besoin d'installation ni de build, ce sont de vrais fichiers finis.
3. Vérifie que le site utilise **PHP 8.0 ou plus récent** : dans hPanel,
   section « PHP Configuration » (ou « Avancé » → « PHP »), choisis une
   version PHP 8.x pour ton domaine. C'est nécessaire uniquement pour
   `admin/` — les pages publiques (`.html`) n'ont besoin de rien de spécial.
4. Ouvre `https://ton-domaine.com/admin/` dans un navigateur : la page de
   connexion doit s'afficher.

Aucune base de données, aucune commande à exécuter : tout le contenu est
stocké dans de simples fichiers `.json` du dossier `content/`.

## 2. Se connecter

- Adresse : `https://ton-domaine.com/admin/`
- Mot de passe par défaut : **`MIERR2026!`**

**Change ce mot de passe dès la première connexion** (voir § 5).

## 3. Ce que tu peux modifier

Le tableau de bord (`/admin/dashboard.php`) donne accès à cinq sections :

| Section | Ce qu'elle modifie sur le site |
|---|---|
| **Actualités** | Les cartes de la page *Actualités* (titre, catégorie, date, résumé, image) |
| **Agenda / Événements** | Les cartes de la page *Activités*, le calendrier interactif, et le rappel « Prochains événements » de l'accueil |
| **Galerie** | Les photos de la page *Galerie*, classées par album |
| **Direction** | Les portraits des responsables sur la page *La MIERR* (photo, nom, fonction) |
| **Coordonnées** | Téléphone, WhatsApp, e-mail, adresse, horaires, Facebook, YouTube, Instagram, TikTok, carte Google Maps — utilisés partout sur le site (en-tête, pied de page, page Contact) |

Pour chaque section (sauf Coordonnées, qui est unique) : une liste des
éléments existants, avec des boutons **Modifier** et **Supprimer**, et un
bouton **+ Ajouter** en haut à droite pour créer un nouvel élément.

**Important — événements avec affiche** : si tu ajoutes une image à un
événement (dans « Agenda / Événements »), elle s'affiche en pleine largeur
comme une affiche (comme pour la Convention). Sans image, l'événement garde
la présentation classique avec une photo de format standard.

**Contenu de démonstration** : tant qu'une section est vide (aucune
actualité ajoutée, par exemple), le site continue d'afficher les exemples de
mise en page prévus au départ. Dès que tu ajoutes un premier élément réel,
il remplace ces exemples.

## 4. Les photos

- Formats acceptés : JPEG, PNG, WebP, GIF — 8 Mo maximum.
- Elles sont automatiquement enregistrées dans `assets/img/uploads/` avec un
  nom unique — pas besoin de choisir un nom de fichier.
- Pour un événement ou une actualité, laisser le champ photo vide en
  modifiant un élément existant conserve la photo déjà en place.

## 5. Changer le mot de passe

1. Sur ton ordinateur, ouvre un terminal (ou demande à quelqu'un de
   technique de le faire pour toi) et exécute, en remplaçant
   `nouveau-mot-de-passe` par le mot de passe choisi :

   ```
   php -r "echo password_hash('nouveau-mot-de-passe', PASSWORD_DEFAULT), PHP_EOL;"
   ```

   (Si tu n'as pas PHP installé, n'importe quel générateur de hash
   « bcrypt » en ligne fait aussi l'affaire, ou demande à Claude de le
   générer pour toi dans une prochaine conversation.)

2. Ouvre le fichier `admin/inc/config.php` (Gestionnaire de fichiers
   Hostinger, ou FTP), et remplace la valeur de `ADMIN_MOT_DE_PASSE_HASH`
   par le résultat obtenu à l'étape précédente.
3. Enregistre le fichier. Le nouveau mot de passe est actif immédiatement.

## 6. Sécurité

- L'accès à `/admin/` est protégé par mot de passe (session + jeton anti-CSRF
  sur chaque formulaire).
- Le dossier `assets/img/uploads/` interdit l'exécution de scripts, même si
  un fichier malveillant y était déposé par erreur.
- Une fois le site en ligne, utilise si possible **HTTPS** (Hostinger propose
  un certificat SSL gratuit dans hPanel → « SSL ») pour que le mot de passe
  ne circule jamais en clair.
- Il n'y a pas de limite de tentatives de connexion intégrée : si tu
  soupçonnes un accès non autorisé, change le mot de passe immédiatement
  (§ 5).

## 7. Limites actuelles (et comment les dépasser)

- **Un seul compte administrateur** (un seul mot de passe partagé). Pour
  plusieurs comptes distincts avec des rôles différents, il faudrait une
  évolution plus poussée (base de données) — demande à Claude si ce besoin
  se présente.
- **Pas de réorganisation par glisser-déposer** : les nouveaux éléments
  s'ajoutent à la fin de la liste. Pour réordonner (par exemple remettre un
  événement passé plus bas), demande à Claude de le faire directement dans
  les fichiers `content/*.json`, ou modifie l'ordre toi-même si tu es à
  l'aise avec l'édition de fichiers texte.
- **Les boutons d'action et l'étiquette spéciale** (comme « Édition spéciale
  jubilé ») ne sont proposés que pour les événements, via des champs dédiés
  dans le formulaire.

Pour toute évolution (nouvelle section éditable, champ supplémentaire,
plusieurs comptes…), il suffit de le redemander dans une conversation avec
Claude Code — le moteur de l'administration (`admin/editer.php` +
`admin/inc/schema.php`) est conçu pour être étendu facilement.
