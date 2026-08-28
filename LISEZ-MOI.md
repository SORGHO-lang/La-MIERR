# Site institutionnel — MIERR

Site officiel de la **Mission Internationale Évangélique de Réveil et de Restauration**
(MIERR), fondée en 2006. Célébration des 20 ans en 2026.

Site statique en **HTML5 / CSS3 / JavaScript natif**, sans dépendance ni étape de
build : il s'ouvre et se déploie tel quel sur n'importe quel hébergement web.

## 1. Structure du projet

```
La-MIERR/
├── index.html                 Accueil
├── la-mierr.html               Identité, vision, mission, histoire (timeline), organisation
├── departements.html           SEMIC, JEMOC, SEMIFIG + 6 services (une page, ancres par section)
├── activites.html               Agenda, calendrier interactif, archives
├── institut-biblique.html       Institut biblique de formation pastorale de Sion + inscription
├── presse.html                  Médiathèque (vidéos, podcasts, publications, communiqués)
├── galerie.html                  Galerie photos & vidéos filtrable
├── actualites.html               Fil des actualités
├── contact.html                  Formulaire, coordonnées, carte, FAQ, mentions légales
├── 404.html                      Page d'erreur
├── robots.txt / sitemap.xml      SEO
├── assets/
│   ├── css/style.css             Système de design complet (variables, composants, pages)
│   ├── js/data.js                Contenu structuré (coordonnées, agenda, timeline, recherche)
│   ├── js/script.js              Comportements (nav, animations, lightbox, calendrier, formulaires…)
│   └── img/*.svg                 Visuels de substitution (logo, bannières, cartes, portraits…)
└── scripts/generer_visuels.py    Générateur des visuels de substitution SVG
```

Chaque page partage le même en-tête, menu mobile, pied de page et composants
(recherche, lightbox, retour en haut) : c'est volontairement une architecture
« pages statiques + composants copiés », adaptée à un site sans back-end. Le
jour où un CMS est branché, ces blocs deviendront des `include`/`partial`
générés côté serveur ou côté build — la structure HTML/CSS n'aura pas à
changer.

## 2. Identité visuelle

- **Couleurs** : la charte graphique tient en **trois couleurs de marque**,
  définies dans `assets/css/style.css`, section « Variables & fondations » :
  1. **Couleur principale** — dégradé Signal rouge/orange
     (`--signal-1 #FF6B35` → `--signal-2 #FF1840`,
     `linear-gradient(90deg, ...)`), utilisé comme cadre continu autour des
     panneaux de contenu sur toutes les pages (voir `body`/`.entete`/`.hero`/
     `.pied`) ;
  2. **Golden Yellow** (`--or #FFDD00`, avec ses déclinaisons
     `--or-clair #FFE74D`, `--or-pale #FFF6B8` et une version assombrie
     `--or-fonce #7A6200` réservée au texte pour rester lisible sur fond
     clair) — couleur des boutons, accents et petits repères visuels ;
  3. **Dark Purple** (`--bleu-nuit #3D0B37`, avec ses déclinaisons
     `--bleu-profond #2B0826`, `--bleu-moyen #54104A`, `--bleu-clair` et
     `--bleu-glace` pour les fonds très pâles) — couleur des bandeaux de
     page, de l'en-tête sombre, du pied de page et des titres. Les noms de
     variables `--bleu-*`/`--or-*` sont historiques (héritage de la première
     charte bleu nuit/or) mais pointent désormais vers le violet et le jaune
     doré ci-dessus.
  Le blanc, le crème et quelques neutres (gris, bordures) complètent la
  palette pour la lisibilité du texte ; les couleurs sémantiques
  (succès/erreur) restent inchangées.
- **Palette secondaire** (badges/étiquettes) : repliée sur les trois
  couleurs de marque — `--azur-brant` et `--sol-de-minas` pointent
  respectivement vers le Dark Purple et le Golden Yellow, `--horizon-clair`/
  `--horizon-pale` vers des teintes de violet, `--nuage` vers un neutre pâle
  — utilisée par `.badge`, `.badge--azur`, `.badge--sol`, `.badge--nuage`
  pour différencier catégories, statuts ou départements sans introduire de
  nouvelle teinte.
- **Typographies** : *Playfair Display* (titres, élégance institutionnelle) et
  *Work Sans* (texte courant, lisibilité).
- **Logo** : `assets/img/logo-mierr-sombre.svg` (texte foncé, utilisé sur fond
  clair) et `assets/img/logo-mierr.svg` (texte clair, utilisé sur fond sombre).
  Ce sont des emblèmes de substitution — à remplacer par le logo officiel dès
  qu'il est disponible (mêmes noms de fichiers pour ne rien casser).

## 3. Remplacer les visuels de substitution

En l'absence de photographies officielles, tous les visuels du site
(`assets/img/*.svg`) sont générés par `scripts/generer_visuels.py` : des
compositions vectorielles bleu/or cohérentes avec la charte, portant une
légende discrète indiquant la photo à intégrer.

Pour remplacer un visuel par une vraie photo :
1. Déposer le fichier (`.jpg`/`.webp`, idéalement compressé) dans `assets/img/`.
2. Reprendre le **même nom de fichier** que le SVG remplacé (ou mettre à jour
   la référence `src="assets/img/…"` dans le HTML concerné).
3. Renseigner un texte alternatif (`alt="…"`) descriptif pour l'accessibilité et le SEO.

Relancer `python3 scripts/generer_visuels.py` régénère l'ensemble des
placeholders (utile si de nouvelles pages ont besoin de nouveaux visuels).

## 4. Contenu à compléter

Les blocs marqués d'un encart **« Contenu à activer / à compléter »** ou d'un
texte entre crochets (`[Titre à venir]`, `[Lieu à préciser]`…) sont des
emplacements prêts à recevoir le contenu réel : actualités, dates et lieux
d'événements, noms des responsables, adresse et coordonnées du siège, etc.

Les coordonnées de contact (téléphone, e-mail, adresse, réseaux sociaux,
lien WhatsApp, emplacement Google Maps) sont centralisées dans
**`assets/js/data.js`** (`window.MIERR.config`). Modifier une valeur ici la
met à jour automatiquement sur toutes les pages (grâce aux attributs
`data-config` et `data-config-href` du HTML).

Le fil du temps de la page « La MIERR » (`la-mierr.html#histoire`) est
généré depuis `window.MIERR.timeline` (même fichier) : ajouter une étape se
résume à ajouter un objet `{ annee, titre, texte }` au tableau.

L'agenda et le calendrier interactif (`activites.html`) sont pilotés par
`window.MIERR.evenements` : chaque événement (id, type, titre, dates, lieu,
responsable, description) alimente à la fois le calendrier et les filtres.

L'index de recherche globale (`window.MIERR.recherche`, raccourci clavier
`Ctrl/Cmd + K`) référence les pages et sections clés du site.

## 5. Évolution vers un CMS / back-office

Le site est conçu pour être « CMS-ready » sans réécriture profonde :

- **Contenu structuré séparé du HTML** : `assets/js/data.js` joue déjà le
  rôle de couche de données pour les blocs dynamiques (agenda, timeline,
  recherche, coordonnées). Il peut être remplacé par un ou plusieurs appels
  `fetch()` vers une API (ex. `/api/evenements`, `/api/actualites`) sans
  changer la structure des composants qui les consomment
  (`initCalendrier`, `initFilDuTemps`… dans `assets/js/script.js`).
- **Composants réutilisables** : chaque type de contenu (actualité, carte
  événement, carte département, carte membre, publication, vidéo…) est un
  bloc HTML/CSS autonome (`.carte`, `.carte-evenement`, `.carte-dept`,
  `.carte-membre`, `.carte-publication`, `.video-tuile`…). Un back-office
  n'aurait qu'à générer ces mêmes blocs à partir d'une base de données.
- **Formulaires** : tous les formulaires (`contact.html`,
  `institut-biblique.html#inscription`) sont marqués `data-formulaire` et
  gérés par `initFormulaires()` dans `script.js`. En l'absence de back-end,
  une soumission valide ouvre le client e-mail du visiteur via un lien
  `mailto:` vers `config.email` (`assets/js/data.js`), avec l'objet et le
  corps du message pré-remplis à partir des champs du formulaire (l'objet
  peut être personnalisé par formulaire via l'attribut `data-mail-sujet`
  sur la balise `<form>`). Pour brancher un vrai service d'envoi plus tard
  (API interne, Formspree, Netlify Forms, etc.), il suffit de remplacer ce
  bloc — clairement identifié par le commentaire « Envoi » dans
  `initFormulaires()` — par un `fetch()` vers votre service.
- **Modules envisagés pour l'administration** (non développés dans cette
  version statique, mais anticipés par la structure du contenu) :
  actualités, événements & calendrier, albums photos/vidéos, audios,
  documents/publications, départements & responsables, formations &
  inscriptions à l'Institut biblique.

## 6. Départements : d'une page unique vers des pages dédiées

`departements.html` régroupe aujourd'hui les 9 départements/services sur une
seule page (ancres `#semic`, `#jemoc`, `#semifig`, `#travailleurs`,
`#entrepreneurs`, `#evenements-service`, `#communication`, `#presse-mierr`,
`#schekina`) pour rester simple à maintenir sans back-end. Le bloc SEMIC
(présentation, responsables, activités, photos) sert de **gabarit** : pour
transformer un département en page dédiée, dupliquer ce bloc dans un nouveau
fichier `departement-semic.html` en reprenant l'en-tête/pied communs.

## 7. Accessibilité, performance & SEO

- Navigation clavier complète (menus, modales, lightbox, accordéons),
  lien d'évitement (« Aller au contenu principal »), `aria-current`,
  `aria-expanded`, focus visibles, `prefers-reduced-motion` respecté.
- Images vectorielles légères, polices avec `preconnect`, CSS/JS uniques
  et minimalistes (aucun framework) pour un chargement rapide.
- Balises `title`/`description`/Open Graph par page, `canonical`,
  `robots.txt`, `sitemap.xml`, données structurées (`schema.org/Church`,
  `BreadcrumbList`) pour le référencement.

## 8. Lancer le site en local

Aucune installation n'est nécessaire. Pour un confort de développement
optimal (certains navigateurs restreignent `fetch`/modules en `file://`),
servir le dossier avec un petit serveur local, par exemple :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## 9. Prochaines étapes suggérées

1. Fournir le logo officiel et les photographies réelles de la MIERR.
2. Compléter les coordonnées dans `assets/js/data.js`.
3. Renseigner les vraies dates/lieux d'événements et les responsables de chaque département.
4. Brancher les formulaires à un service d'envoi ou à une API.
5. Élaborer le back-office d'administration (actualités, événements, galerie, formations, inscriptions).
