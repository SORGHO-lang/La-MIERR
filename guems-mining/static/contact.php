<?php
/**
 * GUEM'S MINING SARL — Réception du formulaire de contact.
 *
 * Transmet le message par e-mail à l'adresse professionnelle configurée.
 * Aucun succès n'est simulé : sans configuration, le script répond 503.
 *
 * Configuration (premier fichier trouvé) :
 *   1. variable d'environnement GM_CONTACT_CONFIG (chemin absolu) ;
 *   2. ../contact-config.php (recommandé : hors du dossier public) ;
 *   3. ./contact-config.php
 * Modèle : contact-config.example.php
 */

declare(strict_types=1);

header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

$candidates = array_filter([
    getenv('GM_CONTACT_CONFIG') ?: null,
    dirname(__DIR__) . '/contact-config.php',
    __DIR__ . '/contact-config.php',
]);
$config = [];
foreach ($candidates as $file) {
    if (is_file($file)) {
        $loaded = require $file;
        if (is_array($loaded)) { $config = $loaded; break; }
    }
}
$config += [
    'to' => '',
    'from' => '',
    'subject_prefix' => "[Site GUEM'S MINING]",
    'allowed_hosts' => [],
    'rate_limit' => 5,
    'rate_window' => 3600,
    'min_seconds' => 3,
];

$lang = (($_POST['lang'] ?? '') === 'en') ? 'en' : 'fr';
$wantsJson = stripos($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json') !== false;

function respond(bool $ok, string $code, int $http, string $lang, bool $json): void
{
    http_response_code($http);
    if ($json) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($ok ? ['ok' => true] : ['ok' => false, 'error' => $code]);
    } else {
        // Sans JavaScript : retour vers la page de contact avec le statut.
        $base = rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/'), '/');
        $path = $base . '/' . $lang . '/contact/?envoi=' . ($ok ? 'sent' : $code) . '#contenu';
        header('Location: ' . $path, true, 303);
    }
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    header('Allow: POST');
    respond(false, 'error', 405, $lang, $wantsJson);
}

// Vérification de l'origine (protection CSRF basique).
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
    $originHost = parse_url($origin, PHP_URL_HOST) ?: '';
    $allowed = array_merge([$_SERVER['HTTP_HOST'] ?? ''], (array) $config['allowed_hosts']);
    $allowed = array_map(static fn ($h) => strtolower(preg_replace('/:\d+$/', '', (string) $h)), $allowed);
    if (!in_array(strtolower($originHost), $allowed, true)) {
        respond(false, 'spam', 403, $lang, $wantsJson);
    }
}

// Piège à robots (champ invisible) et délai minimal de saisie.
if (trim((string) ($_POST['website'] ?? '')) !== '') {
    respond(false, 'spam', 400, $lang, $wantsJson);
}
$ts = (string) ($_POST['ts'] ?? '');
if ($ts !== '' && ctype_digit($ts)) {
    $elapsed = (microtime(true) * 1000 - (float) $ts) / 1000;
    if ($elapsed < (int) $config['min_seconds']) {
        respond(false, 'spam', 400, $lang, $wantsJson);
    }
}

// Service non configuré : on le dit clairement.
$to = trim((string) $config['to']);
if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
    respond(false, 'unavailable', 503, $lang, $wantsJson);
}

// Nettoyage et validation.
$clean = static function (string $key, int $max, bool $multiline = false): string {
    $v = (string) ($_POST[$key] ?? '');
    $v = str_replace("\0", '', $v);
    $v = $multiline ? preg_replace("/\r\n?/", "\n", $v) : preg_replace('/[\r\n\t]+/', ' ', $v);
    $v = trim((string) $v);
    return mb_substr($v, 0, $max);
};
$name = $clean('name', 120);
$company = $clean('company', 160);
$email = $clean('email', 160);
$phone = $clean('phone', 40);
$subject = $clean('subject', 120);
$message = $clean('message', 5000, true);
$consent = ($_POST['consent'] ?? '') === '1';

$valid = mb_strlen($name) >= 2
    && filter_var($email, FILTER_VALIDATE_EMAIL)
    && preg_match('/^[0-9+()\s.\-]{6,40}$/', $phone)
    && $subject !== ''
    && mb_strlen($message) >= 10
    && $consent;
if (!$valid) {
    respond(false, 'error', 422, $lang, $wantsJson);
}

// Limitation du nombre d'envois par adresse IP (empreinte hachée, fenêtre glissante).
$dir = sys_get_temp_dir() . '/gm-contact-rl';
if (!is_dir($dir)) { @mkdir($dir, 0700, true); }
$ipHash = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . __FILE__);
$rlFile = $dir . '/' . $ipHash;
$now = time();
$hits = [];
if (is_file($rlFile)) {
    $hits = array_filter(
        array_map('intval', explode(',', (string) file_get_contents($rlFile))),
        static fn ($t) => $t > $now - (int) $config['rate_window']
    );
}
if (count($hits) >= (int) $config['rate_limit']) {
    respond(false, 'rate', 429, $lang, $wantsJson);
}
// Purge des empreintes expirées.
foreach (glob($dir . '/*') ?: [] as $f) {
    if (filemtime($f) < $now - (int) $config['rate_window']) { @unlink($f); }
}

// Composition et envoi.
$host = preg_replace('/[^a-z0-9.\-]/i', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
$from = trim((string) $config['from']) ?: ('no-reply@' . preg_replace('/^www\./', '', $host));
$encode = static fn (string $s): string => '=?UTF-8?B?' . base64_encode($s) . '?=';

$body = "Nouveau message reçu depuis le site internet (" . strtoupper($lang) . ")\n"
    . str_repeat('-', 60) . "\n"
    . "Nom : {$name}\n"
    . 'Entreprise : ' . ($company !== '' ? $company : '—') . "\n"
    . "E-mail : {$email}\n"
    . "Téléphone : {$phone}\n"
    . "Objet : {$subject}\n"
    . "Consentement au traitement des données : oui\n"
    . str_repeat('-', 60) . "\n\n"
    . $message . "\n\n"
    . str_repeat('-', 60) . "\n"
    . 'Envoyé le ' . gmdate('Y-m-d H:i') . " UTC\n";

$headers = [
    'From: ' . $encode("GUEM'S MINING — Site web") . " <{$from}>",
    'Reply-To: ' . $encode($name) . " <{$email}>",
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'X-Mailer: GUEMS-MINING-Site',
];

$sent = @mail(
    $to,
    $encode(trim($config['subject_prefix'] . ' ' . $subject . ' — ' . $name)),
    $body,
    implode("\r\n", $headers),
    filter_var($from, FILTER_VALIDATE_EMAIL) ? '-f' . $from : ''
);

if (!$sent) {
    respond(false, 'error', 502, $lang, $wantsJson);
}

$hits[] = $now;
@file_put_contents($rlFile, implode(',', $hits), LOCK_EX);
respond(true, 'sent', 200, $lang, $wantsJson);
