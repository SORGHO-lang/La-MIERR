<?php
/**
 * Modèle de configuration du formulaire de contact.
 * Copiez ce fichier en « contact-config.php », de préférence UN NIVEAU AU-DESSUS
 * du dossier public (ex. /home/compte/contact-config.php si le site est dans
 * /home/compte/public_html/), puis renseignez l'adresse de réception.
 */
return [
    // Adresse professionnelle qui recevra les messages (OBLIGATOIRE).
    'to' => '',
    // Adresse d'expédition appartenant au domaine du site (ex. no-reply@votre-domaine.bf).
    'from' => '',
    'subject_prefix' => "[Site GUEM'S MINING]",
    // Domaines supplémentaires autorisés à soumettre le formulaire (facultatif).
    'allowed_hosts' => [],
    // Nombre maximal d'envois par adresse IP et par fenêtre (en secondes).
    'rate_limit' => 5,
    'rate_window' => 3600,
    // Délai minimal (secondes) entre l'affichage du formulaire et l'envoi.
    'min_seconds' => 3,
];
