<?php
/* ==========================================================================
   MIERR — Configuration de l'espace d'administration
   --------------------------------------------------------------------------
   Mot de passe par défaut : MIERR2026!  — à changer dès la première connexion
   (voir « Changer le mot de passe » dans le tableau de bord, ou génère un
   nouveau hash avec la commande ci-dessous et remplace ADMIN_MOT_DE_PASSE_HASH) :

     php -r "echo password_hash('votre-nouveau-mot-de-passe', PASSWORD_DEFAULT), PHP_EOL;"

   ========================================================================== */

define('ADMIN_MOT_DE_PASSE_HASH', '$2y$12$qNp7mUzLohUsKbps6Nj6mefg3SZyQ3n.MqQrlE34EHyh1KZi8o0Na');

// Dossier où sont stockés les fichiers de contenu (JSON) lus par le site public.
define('DOSSIER_CONTENU', dirname(__DIR__, 2) . '/content');

// Dossier où sont enregistrées les images envoyées depuis l'administration.
define('DOSSIER_UPLOADS_DISQUE', dirname(__DIR__, 2) . '/assets/img/uploads');
// Chemin correspondant tel qu'utilisé dans le HTML/JSON (relatif à la racine du site).
define('DOSSIER_UPLOADS_WEB', 'assets/img/uploads');

// Taille maximale acceptée pour une image envoyée (en octets).
define('TAILLE_MAX_IMAGE', 8 * 1024 * 1024);
