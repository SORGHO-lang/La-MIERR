<?php
/**
 * Configuration de l'assistant IA du Studio.
 * Copiez ce fichier en « studio-config.php » dans ce même dossier (server/),
 * qui doit se trouver EN DEHORS du dossier public de l'hébergement.
 */
return [
    // Clé de l'API Anthropic (console.anthropic.com). Ne jamais la placer dans le dossier public.
    'anthropic_api_key' => '',
    // Hachage du code d'accès demandé aux utilisateurs du Studio pour utiliser l'IA.
    // Générer avec : php -r "echo password_hash('VOTRE-CODE', PASSWORD_DEFAULT), PHP_EOL;"
    'access_code_hash' => '',
    // Modèle et niveau d'effort (low, medium, high, xhigh, max).
    'model' => 'claude-opus-5-5',
    'effort' => 'medium',
    // Nombre maximal de requêtes IA par adresse IP et par fenêtre (secondes).
    'rate_limit' => 30,
    'rate_window' => 3600,
    // Domaines supplémentaires autorisés à appeler l'API (facultatif).
    'allowed_hosts' => [],
    // URL d'une passerelle compatible avec l'API Anthropic (facultatif ; vide = API officielle).
    'base_url' => '',
];
