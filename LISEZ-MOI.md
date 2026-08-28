# Site web de la MIERR

Site vitrine statique (HTML / CSS / JS, sans dépendance ni framework) de la
**Mission Internationale Évangélique de Réveil et de Restauration (MIERR)**.

## Structure du projet

```
La-MIERR/
├── index.html                Accueil
├── la-mierr.html              Identité : histoire, vision, mission, valeurs, gouvernance
├── departements.html          SEMIC, JEMOC, SEMIFIG et sections locales
├── activites.html             Convention, CO-SEMIC, CO-JEMOC, Vision de l'Aigle, calendrier
├── institut-biblique.html     Institut biblique de formation pastorale de Sion + inscription
├── presse.html                Communiqués et vidéothèque
├── galerie.html                Galerie photos filtrable
├── actualites.html            Liste des actualités
├── contact.html                Formulaire de contact + mentions légales
├── assets/
│   ├── css/style.css           Feuille de style unique du site
│   ├── js/script.js            Comportements (menu, animations, lightbox, WhatsApp…)
│   └── img/                    Visuels du site (voir « Visuels » ci-dessous)
└── LISEZ-MOI.md                Ce document
```

Aucune installation n'est nécessaire : ouvrez `index.html` dans un navigateur,
ou déployez le dossier tel quel sur n'importe quel hébergement statique
(GitHub Pages, Netlify, Vercel, OVH, cPanel…).

## Contenu à compléter

Ce dépôt livre la **structure et le design complets** du site. Le contenu
définitif (textes officiels, dates, noms des responsables, coordonnées) doit
encore être renseigné. Deux repères permettent de le retrouver facilement :

- Les textes entre crochets, ex. `[Adresse de la MIERR]`, `[JJ mois AAAA]`,
  `[Nom du responsable]`, sont à remplacer directement dans le HTML.
- Les blocs encadrés en pointillés doré sur les pages (classe
  `avis-provisoire`) signalent un contenu d'exemple (actualités, calendrier,
  sections locales…) destiné à être remplacé par du contenu réel.

Pour modifier un texte : ouvrez le fichier `.html` concerné avec un éditeur
de texte et remplacez le contenu entre les balises, sans toucher aux
attributs `class`, `id` ni à la structure des balises.

## Visuels

Le dossier `assets/img/` contient des **visuels de remplacement** (SVG,
générés vectoriellement) pour chaque emplacement du site : bannières de
page, photos illustratives, vignettes vidéo, galerie et logo. Ils tiennent
la mise en page en attendant les vraies photos et vidéos de la MIERR.

Pour remplacer une image :
1. Préparez la photo définitive (format `.jpg`, `.png` ou `.webp`
   recommandé, compressée pour le web).
2. Copiez-la dans `assets/img/` en conservant si possible le même nom de
   fichier (ex. remplacez `histoire-01.svg` par `histoire-01.jpg` puis mettez
   à jour l'extension dans la balise `<img src="...">` correspondante), ou
   utilisez un nouveau nom et mettez à jour la référence dans le HTML.
3. Le logo (`logo-mierr.svg`) et le favicon (`favicon.svg`) peuvent être
   remplacés par les fichiers officiels de la MIERR dès qu'ils sont
   disponibles (conserver un fond transparent pour le logo, utilisé aussi
   bien sur fond clair que sur fond marine dans le pied de page).

## Numéro WhatsApp

Tous les boutons WhatsApp du site (bouton flottant, pied de page, page
Contact) sont générés automatiquement par `assets/js/script.js`. Pour les
activer, ouvrez ce fichier et renseignez le numéro au tout début :

```js
var WHATSAPP_NUMERO = "243900000000"; // indicatif pays inclus, sans le +
```

Tant que ce numéro n'est pas renseigné, un clic sur ces boutons affiche un
message d'avertissement au lieu d'ouvrir WhatsApp.

## Formulaires (contact et inscription à l'institut biblique)

Les formulaires des pages `contact.html` et `institut-biblique.html#inscription`
sont des gabarits HTML statiques : ils ne sont, pour l'instant, reliés à
aucun service d'envoi. Pour les rendre fonctionnels, deux options simples :

- **Formspree, Getform, Basin…** : créez un compte, ajoutez l'action fournie
  à l'attribut `action` de la balise `<form>` et ajoutez `method="POST"`.
- **Back-office / API interne** : si un back-office est développé pour la
  MIERR, connectez le formulaire à son endpoint (le script `script.js`
  peut alors être complété pour gérer l'envoi en JavaScript et afficher un
  message de confirmation).

## Actualités, calendrier et galerie dynamiques

Actuellement, les actualités (`actualites.html`), le calendrier
(`activites.html#calendrier`) et la galerie (`galerie.html`) sont codés en
dur dans le HTML avec du contenu d'exemple. Si un back-office est mis en
place plus tard, chaque bloc de carte peut être généré dynamiquement à
partir d'une base de données, en reprenant strictement la même structure
HTML/CSS (classes `carte`, `carte-image`, `carte-corps`, `carte-etiquette`,
`evenement-ligne`, `galerie-item`…) afin de conserver le design existant.

## Personnalisation des couleurs et polices

Toutes les couleurs et polices sont centralisées en haut du fichier
`assets/css/style.css`, dans le bloc `:root` :

```css
:root{
  --bleu-nuit:#0b223f;   /* couleur principale (en-tête, textes de titre) */
  --or:#c9a227;          /* couleur d'accent (boutons, liens actifs) */
  --creme:#faf7f0;       /* fond général du site */
  ...
}
```

Modifier une de ces variables suffit à répercuter le changement sur
l'ensemble des pages.

## Fonctionnalités déjà en place

- Navigation responsive avec menu mobile (`assets/js/script.js`)
- Barre de progression de lecture en haut de page
- Animations d'apparition au défilement (attribut `data-anim`)
- Visionneuse (lightbox) pour la galerie photo, avec navigation clavier
- Filtres de catégorie sur la page Galerie
- Bouton WhatsApp flottant sur toutes les pages
- Année automatique dans le pied de page

## Compatibilité

Site testé pour un rendu correct sur les navigateurs récents (Chrome,
Firefox, Safari, Edge) et sur mobile. Aucune dépendance externe hormis les
polices Google Fonts (Playfair Display et Work Sans), chargées via CDN.
