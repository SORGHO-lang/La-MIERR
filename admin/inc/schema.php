<?php
/* ==========================================================================
   MIERR — Schéma des sections éditables
   --------------------------------------------------------------------------
   Chaque entrée décrit une collection (une liste d'éléments, stockée dans un
   fichier JSON de content/) et les champs de son formulaire d'édition.
   Le moteur générique (editer.php) lit ce tableau pour afficher la liste,
   le formulaire d'ajout/modification et gérer la suppression — sans code
   dupliqué par section.
   ========================================================================== */

return [

    'actualites' => [
        'titre' => 'Actualités',
        'titre_singulier' => 'une actualité',
        'fichier' => 'actualites.json',
        'titre_affiche' => 'titre',
        'champs' => [
            'titre'     => ['label' => 'Titre',      'type' => 'text',     'requis' => true],
            'categorie' => ['label' => 'Catégorie',  'type' => 'select',   'requis' => true,
                             'options' => ['Annonce', 'Communiqué', 'Témoignage', 'Formation']],
            'date'      => ['label' => 'Date',       'type' => 'date',     'requis' => true],
            'resume'    => ['label' => 'Résumé (2-3 lignes)', 'type' => 'textarea', 'requis' => true],
            'image'     => ['label' => 'Image',      'type' => 'image',    'requis' => false],
        ],
    ],

    'evenements' => [
        'titre' => 'Agenda / Événements',
        'titre_singulier' => 'un événement',
        'fichier' => 'evenements.json',
        'titre_affiche' => 'titre',
        'champs' => [
            'titre'         => ['label' => 'Titre',              'type' => 'text',     'requis' => true],
            'type'          => ['label' => 'Type',                'type' => 'select',   'requis' => true,
                                 'options' => ['Convention', 'SEMIC', 'JEMOC', 'SEMIFIG', 'Séminaire']],
            'debut'         => ['label' => 'Date de début',       'type' => 'date',     'requis' => true],
            'fin'           => ['label' => 'Date de fin',         'type' => 'date',     'requis' => false],
            'lieu'          => ['label' => 'Lieu',                'type' => 'text',     'requis' => false],
            'responsable'   => ['label' => 'Responsable',         'type' => 'text',     'requis' => false],
            'description'   => ['label' => 'Description',         'type' => 'textarea', 'requis' => true],
            'image'         => ['label' => 'Affiche / photo (optionnel)', 'type' => 'image', 'requis' => false],
            'badge'         => ['label' => 'Étiquette spéciale (optionnel, ex. « Édition spéciale »)', 'type' => 'text', 'requis' => false],
            'bouton1_texte' => ['label' => 'Bouton 1 — texte (optionnel)', 'type' => 'text', 'requis' => false],
            'bouton1_url'   => ['label' => 'Bouton 1 — lien',      'type' => 'text',     'requis' => false],
            'bouton2_texte' => ['label' => 'Bouton 2 — texte (optionnel)', 'type' => 'text', 'requis' => false],
            'bouton2_url'   => ['label' => 'Bouton 2 — lien',      'type' => 'text',     'requis' => false],
        ],
    ],

    'galerie' => [
        'titre' => 'Galerie photos',
        'titre_singulier' => 'une photo',
        'fichier' => 'galerie.json',
        'titre_affiche' => 'legende',
        'champs' => [
            'legende' => ['label' => 'Légende',  'type' => 'text', 'requis' => true],
            'album'   => ['label' => 'Album / catégorie', 'type' => 'select', 'requis' => true,
                           'options' => ['Convention', 'SEMIC', 'JEMOC', 'SEMIFIG', 'Institut biblique', '20 ans', 'Baptêmes', 'Séminaires', 'Autre']],
            'image'   => ['label' => 'Photo', 'type' => 'image', 'requis' => true],
        ],
    ],

    'direction' => [
        'titre' => 'Direction (responsables)',
        'titre_singulier' => 'un responsable',
        'fichier' => 'direction.json',
        'titre_affiche' => 'nom',
        'champs' => [
            'nom'      => ['label' => 'Nom et titre (ex. Pasteur Jean OUEDRAOGO)', 'type' => 'text', 'requis' => true],
            'fonction' => ['label' => 'Fonction (facultatif, ex. pour une fiche « Couple pastoral »)', 'type' => 'text', 'requis' => false],
            'groupe'   => ['label' => 'Groupe',     'type' => 'select', 'requis' => true,
                            'options' => ['Garants de la Vision', 'Les Pasteurs']],
            'image'    => ['label' => 'Portrait',    'type' => 'image', 'requis' => true],
        ],
    ],

];
