# Studio — montage vidéo et motion design assisté par l'IA

Application web servie à l'adresse `/studio/` du site, à côté du site vitrine (qui reste inchangé).
Les montages se font **dans le navigateur** : les médias ne quittent pas l'ordinateur de l'utilisateur,
le rendu et l'encodage vidéo sont réalisés localement. Seul l'assistant IA appelle un serveur.

## 1. Audit du projet existant (phase 1)

| Élément | Constat |
|---|---|
| Technologies | Générateur statique Node.js sans dépendance (`build.mjs`), HTML/CSS/JS, PHP (formulaire de contact), Decap CMS |
| Fonctionnalités | Site vitrine bilingue FR/EN, contact, actualités/projets, tests de génération |
| Réutilisable | Chaîne de build (`static/` → `dist/`), hébergement PHP (utilisé pour l'IA), identité visuelle (orange du logo), tests |
| Limites | Aucun code vidéo existant ; pas de serveur applicatif Node en production (hébergement PHP mutualisé visé) |
| Décision | Ajouter le Studio comme application séparée (`static/studio/`) sans toucher au site ; IA côté PHP (clé protégée) |

## 2. Architecture

```
static/studio/
├── index.html, css/studio.css         Interface (thème sombre, responsive)
├── js/main.js                         Démarrage, routage tableau de bord / éditeur
├── js/model.js                        Modèle : projet, pistes, clips, images clés
├── js/store.js                        État, historique annuler/rétablir, sauvegarde auto
├── js/db.js                           IndexedDB (projets + fichiers médias)
├── js/media.js                        Import sécurisé, métadonnées, miniatures, formes d'onde
├── js/projectio.js                    Fichier portable .gmstudio (projet + médias)
├── js/builder.js                      Plan (scènes) → composition multipiste
├── js/templates.js                    18 modèles, 14 catégories
├── js/subtitles.js                    Import SRT
├── js/engine/renderer.js              Moteur de rendu Canvas 2D (aperçu = export)
├── js/engine/easing.js                Courbes et interpolation des images clés
├── js/engine/text.js                  Texte : mise en page, 16 animations
├── js/engine/effects.js               9 effets de calque + 10 effets plein cadre / caméra
├── js/engine/transitions.js           20 transitions
├── js/engine/audio.js                 Web Audio : lecture, fondus, mixage hors ligne
├── js/engine/player.js                Lecture temps réel synchronisée
├── js/engine/exporter.js              Export WebCodecs + Mediabunny (MP4/WebM), repli MediaRecorder
├── js/ai/assistant.js, planner.js     Client IA, planificateur local (sans IA)
├── js/ui/*.js                         Tableau de bord, éditeur, timeline, inspecteur, fenêtres
├── api/ai.php                         Passerelle IA (SDK PHP officiel Anthropic)
└── vendor/mediabunny.min.mjs          Multiplexeur/démultiplexeur (MPL-2.0, v1.61.3)
server/                                Hors du dossier public : SDK PHP (Composer) + configuration IA
```

**Ajouter un effet** : déclarer une entrée dans `LAYER_EFFECTS` ou `FRAME_EFFECTS` (`effects.js`) avec ses
paramètres et une fonction `apply()`. L'inspecteur et la bibliothèque l'affichent automatiquement.
**Ajouter une transition / animation de texte / modèle** : même principe dans `transitions.js`, `text.js`, `templates.js`.
**Changer de moteur IA** : `api/ai.php` est le seul point de contact ; le client attend un plan JSON validé
par `normalizePlan()` (toute sortie est filtrée et bornée avant usage).

## 3. Fonctionnalités et état réel

| Domaine | Disponible | Remarques |
|---|---|---|
| Import | Vidéos (MP4, WebM, MOV…), images (PNG, JPG, WebP, SVG, GIF), audio (MP3, WAV, OGG, M4A, FLAC) | Contrôle du type, de l'extension, de la taille et de la lisibilité réelle ; stockage local IndexedDB |
| Timeline | Pistes vidéo, texte, audio, effets ; déplacement entre pistes, rognage, magnétisme, découpe (S), duplication, verrouillage, masquage, muet, zoom, règle | Pas de chevauchement sur une même piste (contrôlé) |
| Édition | Volume, fondus audio, vitesse (0,1×–8×), point d'entrée, recadrage, ajustement, position, échelle, rotation, opacité, flou, modes de fusion | La vitesse modifie aussi la hauteur du son |
| Textes | Titres, sous-titres, génériques, bandeaux, 12 polices, contour, ombre, bandeau de fond, mots en couleur, 16 animations par lettre/mot/ligne | Import de sous-titres SRT |
| Motion design | Images clés sur 8 propriétés + caméra, 12 courbes + Bézier personnalisée, 10 préréglages de mouvement, formes animées | « 3D » = rendu 2,5D (perspective simulée par rotation X/Y) |
| Effets | Flou, lueur, ombre, étalonnage, aberration chromatique, glitch, ondulation, pixellisation, contour ; particules (5 styles), vignettage, grain, fuite de lumière, bandes cinéma, étalonnage global, glitch plein cadre, flash | Déterministes : aperçu identique à l'export |
| Caméra | Panoramique, zoom, roulis, tremblement, parallaxe par profondeur de calque, profondeur de champ (flou selon le plan de netteté) | Animables par images clés |
| Transitions | 20 (fondus, glissements, volets, iris, zoom, rotation, panoramique filé, glitch, flash) | Fondu enchaîné par chevauchement sur deux pistes |
| Aperçu | Lecture temps réel synchronisée (horloge audio), image par image, boucle, qualité réglable | |
| Annuler/rétablir | 150 étapes, gestes regroupés (curseurs) | Ctrl+Z / Ctrl+Maj+Z |
| Sauvegarde | Automatique (IndexedDB) + fichier portable `.gmstudio` (projet + médias) | |
| Modèles | 18 modèles, 14 catégories, personnalisation : textes, couleurs, polices, durée, format, logo, médias, musique | |
| Assistant IA | Brief → scénario → storyboard scène par scène → plan de montage (durées, textes, animations, transitions, effets, caméra, musique suggérée) → composition ; révision en langage naturel | Nécessite la clé API et un code d'accès (voir §5). Planificateur local sans IA disponible, clairement signalé |
| Export | MP4 et WebM, 480p → 2160p (4K), 16:9 / 9:16 / 1:1 / 4:5, 24–60 i/s, 4 niveaux de qualité, progression réelle, annulation, aperçu et téléchargement | Codecs selon le navigateur : H.264/AAC sur Chrome/Edge ; VP9/Opus sinon. Export image par image (précis à l'image près) |

### Limitations connues et solutions proposées

| Fonction demandée | État | Solution technique réaliste |
|---|---|---|
| Sous-titres générés depuis la voix | **Non connecté** (import SRT disponible) | Brancher un service de reconnaissance vocale (API speech-to-text) dans `api/` : envoyer la piste audio extraite (`AudioEngine.mixdown`), recevoir un SRT, réutiliser `parseSrt()` |
| Génération de musique ou de voix | **Non disponible** ; l'IA suggère des recherches dans des bibliothèques libres de droits | Importer une musique sous licence ; un service de synthèse vocale pourrait produire la voix off via `api/` |
| Génération d'images / vidéos par IA | **Non disponible** ; l'IA décrit l'image idéale par scène (`mediaHint`) | Intégrer une API de génération d'images dans `api/` et ajouter le résultat à la médiathèque |
| Suivi de mouvement (tracking) | **Non implémenté** | Ajouter OpenCV.js (suivi de points par flux optique) pour produire des images clés `x`/`y` à partir d'une zone sélectionnée |
| 3D réelle | Pseudo-3D (2,5D) | Moteur WebGL (three.js) pour des calques dans un espace 3D avec caméra perspective |
| Rendu serveur (FFmpeg) | Non nécessaire pour l'usage courant (encodage navigateur) | Pour les rendus longs/4K en lot : file de tâches (Redis/BullMQ ou table SQL), workers Node + Chromium headless exécutant le même moteur, ou FFmpeg pour la conversion finale ; hébergement VPS requis (pas d'hébergement mutualisé) |
| Projets très lourds | Limités par la mémoire du navigateur et l'espace IndexedDB | Médias proxy (versions basse résolution) pour l'aperçu, stockage serveur des sources |

## 4. Installation et déploiement

1. `npm run build` génère `dist/` (site + Studio).
2. Publier le contenu de `dist/` dans le dossier public (le Studio est servi sous `/studio/`).
3. Assistant IA (facultatif) — sur le serveur, **hors du dossier public** :
   ```bash
   cd guems-mining/server
   composer install --no-dev          # SDK PHP Anthropic + client HTTP Guzzle (versions verrouillées)
   cp studio-config.example.php studio-config.php
   php -r "echo password_hash('VOTRE-CODE', PASSWORD_DEFAULT), PHP_EOL;"   # coller le résultat dans access_code_hash
   ```
   Renseigner `anthropic_api_key`. Disposition attendue : `…/public_html/studio/api/ai.php` et `…/server/`
   (même parent que `public_html`). Sinon, définir `GM_STUDIO_SERVER` / `GM_STUDIO_CONFIG`.
   PHP ≥ 8.1 avec les extensions `curl`, `json`, `mbstring`.
4. Le Studio n'est pas lié depuis le site vitrine et est exclu de l'indexation (`robots.txt`, `noindex`).

## 5. Sécurité

- **Clé API** : uniquement sur le serveur, dans `server/studio-config.php` (ignoré par Git, hors du dossier public).
- **Code d'accès obligatoire** pour l'IA (haché avec `password_hash`), vérification d'origine, limitation à
  30 requêtes/heure/IP par défaut, tailles d'entrée bornées, vocabulaire filtré avant d'entrer dans le schéma JSON.
- **Sortie du modèle** : sortie structurée (schéma JSON strict) puis validation/normalisation côté client.
- **Médias** : jamais envoyés à un serveur ; types et tailles contrôlés à l'import ; SVG affichés comme images
  (aucun script exécuté).
- Modèle : `claude-opus-5-5`, effort `medium`, repli serveur en cas de refus (`fallbacks: "default"`).

## 6. Tests

```bash
npm run test:studio      # tests unitaires (logique du moteur, modèles, plans, SRT, export)
npm run test:e2e         # navigateur réel : modèles, import, lecture, découpe, export vérifié par ffprobe, IA simulée
```
`test:e2e` nécessite PHP, ffmpeg/ffprobe et Playwright. L'IA y est testée contre un faux serveur
(`tests/fixtures/mock-anthropic.php`) qui vérifie la forme exacte de la requête envoyée par le SDK.

## 7. Raccourcis clavier

Espace : lecture/pause · S : couper · Suppr : supprimer · Ctrl+D : dupliquer · Ctrl+Z / Ctrl+Maj+Z : annuler/rétablir ·
← / → : image précédente/suivante (Maj : 1 s) · Début / Fin · + / − : zoom de la timeline · Échap : désélectionner.
