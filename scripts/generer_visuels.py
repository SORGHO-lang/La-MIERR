#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Générateur de visuels de substitution (placeholders) pour le site MIERR.

En l'absence de photographies officielles, ce script produit des visuels
SVG élégants (dégradés bleu nuit / or, motifs abstraits de rayons et de
cercles concentriques) portant une légende discrète indiquant le contenu
photographique à intégrer plus tard. Ils sont vectoriels (poids très
faible, définition parfaite à toute résolution) et cohérents avec la
charte graphique du site.

Pour remplacer un visuel par une vraie photographie : déposer le fichier
(jpg/webp) dans assets/img/ sous le même nom (en adaptant l'extension et
la référence dans le HTML), ou simplement écraser le composant --
voir LISEZ-MOI.md, section « Remplacer les visuels de substitution ».
"""
import os

DOSSIER = os.path.join(os.path.dirname(__file__), "..", "assets", "img")
os.makedirs(DOSSIER, exist_ok=True)

BLEU_NUIT = "#190B46"      # Bleu du logo — couleur secondaire de marque
BLEU_PROFOND = "#10082B"
BLEU_MOYEN = "#2C147B"
OR = "#FFDD00"             # Golden Yellow — couleur secondaire de marque
OR_CLAIR = "#FFE74D"
OR_PALE = "#FFF6B8"
CREME = "#FAF7F0"

VARIANTES = [
    (BLEU_NUIT, BLEU_PROFOND, OR_CLAIR),
    (BLEU_PROFOND, BLEU_MOYEN, OR),
    (BLEU_NUIT, BLEU_MOYEN, OR_PALE),
]


def motif_rayons(cx, cy, rayon, couleur, opacite, n=14):
    """Faisceau de rayons partant d'un point (symbole de gloire / réveil)."""
    import math
    chemins = []
    for i in range(n):
        angle = (2 * math.pi / n) * i
        x2 = cx + rayon * math.cos(angle)
        y2 = cy + rayon * math.sin(angle)
        chemins.append(
            f'<line x1="{cx:.1f}" y1="{cy:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
            f'stroke="{couleur}" stroke-width="1.4" opacity="{opacite}"/>'
        )
    return "\n".join(chemins)


def visuel(nom, largeur, hauteur, legende, sur_legende="Visuel de substitution", variante=0, motif=True, cercle=True):
    c1, c2, accent = VARIANTES[variante % len(VARIANTES)]
    cx, cy = largeur * 0.78, hauteur * 0.22
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {largeur} {hauteur}" width="{largeur}" height="{hauteur}" role="img" aria-label="{legende}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{c1}"/>
      <stop offset="100%" stop-color="{c2}"/>
    </linearGradient>
    <radialGradient id="r" cx="78%" cy="18%" r="60%">
      <stop offset="0%" stop-color="{accent}" stop-opacity=".35"/>
      <stop offset="100%" stop-color="{accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="{largeur}" height="{hauteur}" fill="url(#g)"/>
  <rect width="{largeur}" height="{hauteur}" fill="url(#r)"/>
  {motif_rayons(cx, cy, min(largeur, hauteur) * 0.32, accent, 0.22) if motif else ""}
  {f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{min(largeur, hauteur) * 0.09:.1f}" fill="none" stroke="{accent}" stroke-width="1.6" opacity=".55"/>' if cercle else ""}
  {f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{min(largeur, hauteur) * 0.16:.1f}" fill="none" stroke="{accent}" stroke-width="1" opacity=".3"/>' if cercle else ""}
  <rect x="0" y="{hauteur-64}" width="{largeur}" height="64" fill="{BLEU_NUIT}" opacity=".38"/>
  <text x="24" y="{hauteur-32}" font-family="Georgia, serif" font-size="{max(13, largeur*0.021):.0f}" fill="{OR_PALE}" opacity=".92">{legende}</text>
  <text x="24" y="{hauteur-14}" font-family="Arial, sans-serif" font-size="{max(10, largeur*0.013):.0f}" letter-spacing="1.5" fill="{CREME}" opacity=".55">{sur_legende.upper()}</text>
</svg>'''
    with open(os.path.join(DOSSIER, nom), "w", encoding="utf-8") as f:
        f.write(svg)


def logo(nom, couleur_texte, fond=None):
    """Emblème MIERR : flamme stylisée inscrite dans un cercle + signature typographique."""
    fond_rect = f'<rect width="220" height="64" fill="{fond}"/>' if fond else ""
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 64" width="220" height="64" role="img" aria-label="Logo MIERR">
  {fond_rect}
  <g transform="translate(4,6)">
    <circle cx="26" cy="26" r="25" fill="none" stroke="{OR}" stroke-width="2"/>
    <circle cx="26" cy="26" r="19" fill="{BLEU_NUIT}"/>
    <path d="M26 12c5 6 8 10 8 15a8 8 0 1 1-16 0c0-5 3-9 8-15z" fill="{OR_CLAIR}"/>
    <path d="M26 20c2.6 3.2 4 5.4 4 8a4 4 0 1 1-8 0c0-2.6 1.4-4.8 4-8z" fill="{OR}"/>
  </g>
  <text x="62" y="30" font-family="'Playfair Display', Georgia, serif" font-weight="700" font-size="24" fill="{couleur_texte}">MIERR</text>
  <text x="63" y="46" font-family="Arial, sans-serif" font-size="7.6" letter-spacing="1.3" fill="{couleur_texte}" opacity=".72">RÉVEIL &amp; RESTAURATION</text>
</svg>'''
    with open(os.path.join(DOSSIER, nom), "w", encoding="utf-8") as f:
        f.write(svg)


def favicon():
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <circle cx="32" cy="32" r="31" fill="{BLEU_NUIT}"/>
  <circle cx="32" cy="32" r="31" fill="none" stroke="{OR}" stroke-width="2"/>
  <path d="M32 14c6.5 7.5 10.5 12.8 10.5 19.2A10.5 10.5 0 1 1 21.5 33.2C21.5 26.8 25.5 21.5 32 14z" fill="{OR_CLAIR}"/>
  <path d="M32 24c3.2 4 5 6.8 5 10a5 5 0 1 1-10 0c0-3.2 1.8-6 5-10z" fill="{OR}"/>
</svg>'''
    with open(os.path.join(DOSSIER, "favicon.svg"), "w", encoding="utf-8") as f:
        f.write(svg)


def texture_etoiles():
    pts = [(10, 12, 1.4), (55, 8, 1), (95, 30, 1.6), (30, 45, 1), (70, 60, 1.3),
           (110, 95, 1), (18, 90, 1.5), (85, 105, 1), (50, 100, .9), (105, 55, 1.1)]
    cercles = "\n".join(
        f'<circle cx="{x}" cy="{y}" r="{r}" fill="{OR_CLAIR}" opacity=".5"/>' for x, y, r in pts
    )
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  {cercles}
</svg>'''
    with open(os.path.join(DOSSIER, "texture-etoiles.svg"), "w", encoding="utf-8") as f:
        f.write(svg)


def og_pattern():
    """Motif décoratif clair pour arrière-plans crème (sections alternées)."""
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140">
  <circle cx="70" cy="70" r="1.2" fill="{BLEU_NUIT}" opacity=".06"/>
  <circle cx="10" cy="10" r="1.2" fill="{BLEU_NUIT}" opacity=".06"/>
  <circle cx="130" cy="10" r="1.2" fill="{BLEU_NUIT}" opacity=".06"/>
  <circle cx="10" cy="130" r="1.2" fill="{BLEU_NUIT}" opacity=".06"/>
  <circle cx="130" cy="130" r="1.2" fill="{BLEU_NUIT}" opacity=".06"/>
</svg>'''
    with open(os.path.join(DOSSIER, "texture-legere.svg"), "w", encoding="utf-8") as f:
        f.write(svg)


# ---------------------------------------------------------------------------
# Génération des fichiers utilisés dans le HTML du site
# ---------------------------------------------------------------------------

favicon()
texture_etoiles()
og_pattern()
logo("logo-mierr.svg", CREME)
logo("logo-mierr-sombre.svg", BLEU_NUIT)

# Bannières héros (larges, 16:9 environ)
BANNIERES = [
    ("banniere-accueil.svg", "20 ans de réveil et de restauration", "MIERR — 2006-2026", 0),
    ("banniere-la-mierr.svg", "Identité, vision & mission de la MIERR", "La MIERR", 1),
    ("banniere-departements.svg", "SEMIC · JEMOC · SEMIFIG et les services de la mission", "Départements", 2),
    ("banniere-activites.svg", "Conventions, séminaires et grands rendez-vous", "Activités", 0),
    ("banniere-institut.svg", "Institut biblique de formation pastorale de Sion", "Formation", 1),
    ("banniere-presse.svg", "Prédications, enseignements & publications", "Presse & médias", 2),
    ("banniere-galerie.svg", "Les temps forts de la MIERR en images", "Galerie", 0),
    ("banniere-contact.svg", "L'équipe de la MIERR à votre écoute", "Contact", 1),
    ("banniere-actualites.svg", "Annonces, communiqués et témoignages", "Actualités", 2),
]
for nom, legende, sur, var in BANNIERES:
    visuel(nom, 1600, 900, legende, sur, variante=var)

# Illustrations d'histoire (accueil / page La MIERR)
for i in range(1, 7):
    visuel(f"histoire-{i:02d}.svg", 640, 480, f"Étape {i} — histoire de la MIERR", "Photo à intégrer", variante=i % 3)

# Institut biblique
for i in range(1, 4):
    visuel(f"institut-{i:02d}.svg", 640, 480, "Institut biblique de formation pastorale de Sion", "Photo à intégrer", variante=i % 3)

# Vidéos (16:9)
LIBELLES_VIDEO = ["Prédication", "Enseignement", "Conférence", "Témoignage", "Interview", "Reportage", "Culte", "Formation"]
for i, lib in enumerate(LIBELLES_VIDEO, start=1):
    visuel(f"video-{i:02d}.svg", 640, 360, lib, "Vidéothèque MIERR", variante=i % 3, cercle=True)

# Galerie (16 visuels répartis par catégories)
CATEGORIES_GALERIE = ["Convention", "SEMIC", "JEMOC", "SEMIFIG", "Institut biblique", "20 ans de la MIERR", "Baptêmes", "Séminaires"]
n = 1
for cat in CATEGORIES_GALERIE:
    for k in range(2):
        visuel(f"galerie-{n:02d}.svg", 640, 480, cat, "Photo à intégrer", variante=n % 3)
        n += 1

# Portraits (organigramme / responsables) — carrés
for i in range(1, 9):
    visuel(f"membre-{i:02d}.svg", 400, 400, "Responsable MIERR", "Portrait à intégrer", variante=i % 3, motif=False)

# Publications / magazines (format portrait 3:4)
for i in range(1, 5):
    visuel(f"publication-{i:02d}.svg", 480, 640, f"SCHÉKINA — Publication {i}", "Couverture à intégrer", variante=i % 3)

print("Visuels générés dans", os.path.abspath(DOSSIER))
