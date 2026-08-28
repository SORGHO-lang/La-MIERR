#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Construit des versions autonomes (CSS/JS/images inlinés) des pages du site
MIERR, prêtes à être publiées comme Artifacts de prévisualisation.
Ne touche pas aux fichiers sources du site (index.html, assets/...).
"""
import base64
import os
import re

RACINE = os.path.join(os.path.dirname(__file__), "..")
SORTIE = os.path.join(RACINE, "_artifacts_preview")
os.makedirs(SORTIE, exist_ok=True)

PAGES = [
    "index.html", "la-mierr.html", "departements.html", "activites.html",
    "institut-biblique.html", "presse.html", "galerie.html", "actualites.html",
    "contact.html",
]

def lire(chemin):
    with open(chemin, encoding="utf-8") as f:
        return f.read()

MIME = {".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}

def data_uri(chemin):
    ext = os.path.splitext(chemin)[1].lower()
    with open(chemin, "rb") as f:
        b = f.read()
    return f"data:{MIME.get(ext, 'application/octet-stream')};base64," + base64.b64encode(b).decode("ascii")

# Carte de toutes les images assets/img/* -> data URI
dossier_img = os.path.join(RACINE, "assets", "img")
images = {}
for nom in os.listdir(dossier_img):
    if os.path.splitext(nom)[1].lower() in MIME:
        images[nom] = data_uri(os.path.join(dossier_img, nom))

def inliner_images(texte):
    def remplace(m):
        nom = m.group(1)
        return images.get(nom, "assets/img/" + nom)
    return re.sub(r'assets/img/([A-Za-z0-9_.-]+\.(?:svg|png|jpe?g))', remplace, texte)

css = lire(os.path.join(RACINE, "assets", "css", "style.css"))
css = inliner_images(css)
data_js = lire(os.path.join(RACINE, "assets", "js", "data.js"))
script_js = lire(os.path.join(RACINE, "assets", "js", "script.js"))

for nom_page in PAGES:
    html = lire(os.path.join(RACINE, nom_page))

    titre_m = re.search(r"<title>(.*?)</title>", html, re.S)
    titre = titre_m.group(1).strip() if titre_m else "MIERR"

    corps_m = re.search(r"<body>(.*?)</body>", html, re.S)
    corps = corps_m.group(1) if corps_m else html

    # Inliner les images référencées dans le corps
    corps = inliner_images(corps)

    # Remplacer les <script src="assets/js/...">/</script> par le contenu inliné
    corps = corps.replace(
        '<script src="assets/js/data.js"></script>',
        "<script>\n" + data_js + "\n</script>"
    )
    corps = corps.replace(
        '<script src="assets/js/script.js"></script>',
        "<script>\n" + script_js + "\n</script>"
    )

    # La carte Google Maps (contact.html) : l'iframe externe est bloqué dans
    # l'aperçu Artifact (hôte non autorisé par la CSP) -> on la remplace par
    # un aperçu statique fidèle, sans toucher au site réel.
    corps = re.sub(
        r'<iframe data-maps-embed[^>]*></iframe>',
        '<div style="height:420px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; background:linear-gradient(135deg,var(--bleu-nuit),var(--bleu-profond)); color:#fff;">'
        '<span style="font-size:2rem;">📍</span>'
        '<strong>Carte interactive</strong>'
        '<span style="opacity:.75; font-size:.85rem;">La carte Google Maps s\'affichera ici sur le site publié.</span>'
        '</div>',
        corps
    )

    fragment = (
        f"<title>{titre}</title>\n"
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Work+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">\n'
        f"<style>\n{css}\n</style>\n"
        f"{corps}\n"
    )

    chemin_sortie = os.path.join(SORTIE, nom_page)
    with open(chemin_sortie, "w", encoding="utf-8") as f:
        f.write(fragment)
    print(nom_page, "->", len(fragment.encode("utf-8")), "octets")
