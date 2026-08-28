<?php
/* Authentification simple par mot de passe unique (session PHP).
   Adaptée à un site sans base de données ni service d'e-mail. */

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/config.php';

function estConnecte() {
    return !empty($_SESSION['mierr_admin_connecte']);
}

function exigerConnexion() {
    if (!estConnecte()) {
        header('Location: index.php');
        exit;
    }
}

function jetonCsrf() {
    if (empty($_SESSION['mierr_csrf'])) {
        $_SESSION['mierr_csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['mierr_csrf'];
}

function verifierCsrf() {
    $envoye = $_POST['csrf'] ?? '';
    if (!hash_equals($_SESSION['mierr_csrf'] ?? '', $envoye)) {
        http_response_code(400);
        die('Session expirée, merci de recharger la page et réessayer.');
    }
}
