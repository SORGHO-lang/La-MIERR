#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Réécrit les liens inter-pages des fragments d'aperçu vers les URLs
des artifacts déjà publiés, afin d'obtenir un aperçu multi-pages navigable."""
import os
import re

RACINE = os.path.join(os.path.dirname(__file__), "..", "_artifacts_preview")

URLS = {
    "index.html": "https://claude.ai/code/artifact/aaadfdef-085c-4ca2-a69b-638eeac53cd7",
    "la-mierr.html": "https://claude.ai/code/artifact/ea126909-f7b9-4e5e-9972-513d6a7f6db1",
    "departements.html": "https://claude.ai/code/artifact/ab752647-f43d-4dac-a0f4-c9ac49a48350",
    "activites.html": "https://claude.ai/code/artifact/436b2c6f-f465-433f-a626-0ba3d82ad5b1",
    "institut-biblique.html": "https://claude.ai/code/artifact/36c6d992-80fb-427f-9ed2-c803396d0939",
    "presse.html": "https://claude.ai/code/artifact/01289621-c4b3-4c92-b0fc-d6937f82b2ba",
    "galerie.html": "https://claude.ai/code/artifact/83105d3d-4510-44cd-b046-7f61d7512134",
    "actualites.html": "https://claude.ai/code/artifact/849b3c0b-0c8d-4ab3-94e5-da45b706d392",
    "contact.html": "https://claude.ai/code/artifact/805facfa-ab22-44d5-abd5-975384e4c9aa",
}

motif = re.compile(r'href="(' + "|".join(re.escape(p) for p in URLS) + r')(#[^"]*)?"')

def remplace(m):
    page, ancre = m.group(1), m.group(2) or ""
    return f'href="{URLS[page]}{ancre}"'

for nom in URLS:
    chemin = os.path.join(RACINE, nom)
    texte = open(chemin, encoding="utf-8").read()
    nouveau, n = motif.subn(remplace, texte)
    open(chemin, "w", encoding="utf-8").write(nouveau)
    print(nom, "->", n, "liens réécrits")
