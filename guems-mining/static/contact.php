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
 *
 * Envoi : par SMTP authentifié (recommandé, ex. smtp.hostinger.com) dès que le mot de passe
 * SMTP est renseigné dans contact-config.php ; sinon par la fonction mail() de PHP.
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
    // Adresses fournies par l'entreprise ; un fichier contact-config.php peut les remplacer.
    'to' => 'direction@guemsmining.com',
    'from' => 'direction@guemsmining.com',
    'subject_prefix' => "[Site GUEM'S MINING]",
    'allowed_hosts' => [],
    'rate_limit' => 5,
    'rate_window' => 3600,
    'min_seconds' => 3,
    'smtp' => [],
];
$config['smtp'] = (array) $config['smtp'] + [
    'host' => 'smtp.hostinger.com',
    'port' => 465,
    'secure' => 'ssl', // ssl (port 465), tls (STARTTLS, port 587) ou none
    'user' => '',
    'pass' => '',
    'timeout' => 15,
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

$subjectLine = $encode(trim($config['subject_prefix'] . ' ' . $subject . ' — ' . $name));
$smtp = $config['smtp'];
if ($smtp['user'] !== '' && $smtp['pass'] !== '') {
    $sent = smtp_send($smtp, $from, $to, $subjectLine, $body, $headers);
} else {
    $sent = @mail($to, $subjectLine, $body, implode("\r\n", $headers), filter_var($from, FILTER_VALIDATE_EMAIL) ? '-f' . $from : '');
    if (!$sent) { error_log('[contact] mail() a échoué'); }
}

if (!$sent) {
    respond(false, 'error', 502, $lang, $wantsJson);
}

$hits[] = $now;
@file_put_contents($rlFile, implode(',', $hits), LOCK_EX);
respond(true, 'sent', 200, $lang, $wantsJson);

/**
 * Envoi SMTP minimal avec authentification (AUTH LOGIN), sans dépendance.
 * Les erreurs sont écrites dans le journal PHP, jamais affichées au visiteur.
 */
function smtp_send(array $c, string $from, string $to, string $subject, string $body, array $headers): bool
{
    $secure = strtolower((string) $c['secure']);
    $target = ($secure === 'ssl' ? 'ssl://' : 'tcp://') . $c['host'] . ':' . (int) $c['port'];
    $fp = @stream_socket_client($target, $errno, $errstr, (int) $c['timeout']);
    if (!$fp) { error_log("[contact] connexion SMTP impossible : {$errstr} ({$errno})"); return false; }
    stream_set_timeout($fp, (int) $c['timeout']);
    $read = static function () use ($fp): string {
        $out = '';
        while (($line = fgets($fp, 1024)) !== false) {
            $out .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') { break; }
        }
        return $out;
    };
    $cmd = static function (?string $line, int $expect) use ($fp, $read): bool {
        if ($line !== null) { fwrite($fp, $line . "\r\n"); }
        $reply = $read();
        if ((int) substr($reply, 0, 3) !== $expect) {
            $shown = ($line !== null && str_starts_with($line, 'AUTH')) ? 'AUTH' : (string) $line;
            error_log('[contact] SMTP « ' . preg_replace('/^(.{0,40}).*$/s', '$1', $shown) . ' » → ' . trim($reply));
            return false;
        }
        return true;
    };
    $ehlo = 'EHLO ' . (preg_replace('/^.*@/', '', $from) ?: 'localhost');
    $ok = $cmd(null, 220) && $cmd($ehlo, 250);
    if ($ok && $secure === 'tls') {
        $ok = $cmd('STARTTLS', 220)
            && stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)
            && $cmd($ehlo, 250);
    }
    $ok = $ok
        && $cmd('AUTH LOGIN', 334)
        && $cmd(base64_encode((string) $c['user']), 334)
        && $cmd(base64_encode((string) $c['pass']), 235)
        && $cmd("MAIL FROM:<{$from}>", 250)
        && $cmd("RCPT TO:<{$to}>", 250)
        && $cmd('DATA', 354);
    if ($ok) {
        $msg = implode("\r\n", array_merge([
            "To: <{$to}>",
            "Subject: {$subject}",
            'Date: ' . date('r'),
            'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . (preg_replace('/^.*@/', '', $from) ?: 'localhost') . '>',
        ], $headers)) . "\r\n\r\n" . str_replace("\n", "\r\n", $body);
        // Un point en début de ligne doit être doublé (RFC 5321).
        $msg = preg_replace('/^\./m', '..', $msg);
        $ok = $cmd($msg . "\r\n.", 250);
    }
    @fwrite($fp, "QUIT\r\n");
    fclose($fp);
    return $ok;
}
