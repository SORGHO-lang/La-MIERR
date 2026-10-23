<?php
/**
 * Studio — passerelle vers l'assistant IA (Claude, API Anthropic, SDK PHP officiel).
 *
 * Actions (POST JSON) :
 *   status  → { ok, configured, model }
 *   plan    → { ok, plan, model }      à partir d'un brief
 *   revise  → { ok, plan, model }      modification d'un plan par une instruction
 *
 * Sécurité :
 *   - la clé API reste sur le serveur (fichier de configuration hors du dossier public) ;
 *   - un code d'accès est obligatoire (en-tête X-Studio-Code), comparé à un hachage ;
 *   - limitation du nombre de requêtes par adresse IP ; tailles d'entrée bornées ;
 *   - le vocabulaire (énumérations) fourni par le client est filtré avant d'entrer dans le schéma.
 *
 * Configuration : voir server/studio-config.example.php et studio/README.md.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function reply(int $status, array $data): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(int $status, string $code, string $message = ''): never
{
    reply($status, ['ok' => false, 'error' => $code, 'message' => $message]);
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    header('Allow: POST');
    fail(405, 'bad_request', 'Méthode non autorisée.');
}

// ------------------------------------------------------------------ configuration
$serverDir = getenv('GM_STUDIO_SERVER') ?: dirname(__DIR__, 3) . '/server';
$configFile = getenv('GM_STUDIO_CONFIG') ?: $serverDir . '/studio-config.php';
$config = is_file($configFile) ? (require $configFile) : [];
if (!is_array($config)) {
    $config = [];
}
$config += [
    'anthropic_api_key' => getenv('ANTHROPIC_API_KEY') ?: '',
    'access_code_hash' => '',
    'model' => 'claude-opus-5-5',
    'effort' => 'medium',
    'rate_limit' => 30,
    'rate_window' => 3600,
    'allowed_hosts' => [],
    'base_url' => '',
];

// Origine : même hôte (ou hôtes explicitement autorisés).
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
    $host = strtolower((string) parse_url($origin, PHP_URL_HOST));
    $allowed = array_map(
        static fn ($h) => strtolower(preg_replace('/:\d+$/', '', (string) $h)),
        array_merge([$_SERVER['HTTP_HOST'] ?? ''], (array) $config['allowed_hosts'])
    );
    if (!in_array($host, $allowed, true)) {
        fail(403, 'bad_request', 'Origine non autorisée.');
    }
}

$raw = file_get_contents('php://input', false, null, 0, 300_000);
$input = json_decode((string) $raw, true);
if (!is_array($input)) {
    fail(400, 'bad_request', 'Corps JSON invalide.');
}
$action = (string) ($input['action'] ?? '');

$configured = $config['anthropic_api_key'] !== '' && $config['access_code_hash'] !== '';
if ($action === 'status') {
    reply(200, ['ok' => true, 'configured' => $configured, 'model' => $config['model'], 'needsCode' => true]);
}
if (!in_array($action, ['plan', 'revise'], true)) {
    fail(400, 'bad_request', 'Action inconnue.');
}
if (!$configured) {
    fail(503, 'not_configured');
}

// Code d'accès.
$code = (string) ($_SERVER['HTTP_X_STUDIO_CODE'] ?? '');
if ($code === '') {
    fail(401, 'code_required');
}
if (!password_verify($code, (string) $config['access_code_hash'])) {
    usleep(400_000);
    fail(401, 'code_invalid');
}

// Limitation par adresse IP (empreinte hachée, fenêtre glissante).
$dir = sys_get_temp_dir() . '/gm-studio-rl';
if (!is_dir($dir)) {
    @mkdir($dir, 0700, true);
}
$rlFile = $dir . '/' . hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|studio');
$now = time();
$hits = is_file($rlFile)
    ? array_filter(array_map('intval', explode(',', (string) file_get_contents($rlFile))), static fn ($t) => $t > $now - (int) $config['rate_window'])
    : [];
if (count($hits) >= (int) $config['rate_limit']) {
    fail(429, 'rate');
}
$hits[] = $now;
@file_put_contents($rlFile, implode(',', $hits), LOCK_EX);

// ------------------------------------------------------------------ vocabulaire et schéma
$vocab = is_array($input['vocabulary'] ?? null) ? $input['vocabulary'] : [];
$list = static function (string $key, array $fallback) use ($vocab): array {
    $v = $vocab[$key] ?? $fallback;
    if (!is_array($v)) {
        return $fallback;
    }
    $clean = array_values(array_unique(array_filter($v, static fn ($s) => is_string($s) && preg_match('/^[\p{L}0-9 \'-]{1,40}$/u', $s))));
    return $clean !== [] ? array_slice($clean, 0, 60) : $fallback;
};
$V = [
    'visuals' => $list('visuals', ['logo', 'media', 'text', 'kinetic', 'cta']),
    'textAnimations' => $list('textAnimations', ['fade', 'slide-up']),
    'transitions' => $list('transitions', ['fade']),
    'sceneEffects' => $list('sceneEffects', ['glow']),
    'cameraMoves' => $list('cameraMoves', ['static']),
    'globalEffects' => $list('globalEffects', ['vignette']),
    'fonts' => $list('fonts', ['Inter']),
];
$str = ['type' => 'string'];
$enum = static fn (array $values) => ['type' => 'string', 'enum' => $values];
$obj = static fn (array $props) => ['type' => 'object', 'additionalProperties' => false, 'required' => array_keys($props), 'properties' => $props];

$schema = $obj([
    'title' => $str,
    'summary' => ['type' => 'string', 'description' => 'Résumé du concept en 2 phrases.'],
    'aspect' => $enum(['16:9', '9:16', '1:1', '4:5']),
    'style' => $obj([
        'palette' => $obj([
            'background' => ['type' => 'string', 'description' => 'Couleur #RRGGBB'],
            'primary' => ['type' => 'string', 'description' => 'Couleur #RRGGBB'],
            'accent' => ['type' => 'string', 'description' => 'Couleur #RRGGBB'],
            'text' => ['type' => 'string', 'description' => 'Couleur #RRGGBB'],
        ]),
        'fontHeading' => $enum($V['fonts']),
        'fontBody' => $enum($V['fonts']),
        'mood' => $str,
        'effects' => ['type' => 'array', 'items' => $enum($V['globalEffects'])],
    ]),
    'music' => $obj([
        'mood' => $str,
        'bpm' => ['type' => 'integer'],
        'suggestions' => ['type' => 'array', 'items' => $str, 'description' => 'Pistes de recherche dans des bibliothèques libres de droits ; jamais un titre commercial protégé.'],
    ]),
    'scenes' => ['type' => 'array', 'items' => $obj([
        'duration' => ['type' => 'number', 'description' => 'Durée en secondes.'],
        'purpose' => $str,
        'visual' => $enum($V['visuals']),
        'headline' => $str,
        'subtext' => $str,
        'mediaHint' => ['type' => 'string', 'description' => 'Image ou plan vidéo idéal pour cette scène.'],
        'textAnimation' => $enum($V['textAnimations']),
        'transition' => $enum($V['transitions']),
        'effects' => ['type' => 'array', 'items' => $enum($V['sceneEffects'])],
        'camera' => $enum($V['cameraMoves']),
        'voiceover' => ['type' => 'string', 'description' => 'Texte de voix off facultatif (vide si aucun).'],
    ])],
    'notes' => ['type' => 'string', 'description' => 'Remarques : informations manquantes, conseils de tournage, licences.'],
]);

$system = <<<TXT
Tu es directeur artistique, monteur vidéo et motion designer. Tu conçois des plans de montage exécutés par un moteur de composition vidéo : chaque scène devient des calques animés (fond média ou dégradé, titres, sous-titres, effets, transitions).

Règles :
- Réponds dans la langue du brief.
- Respecte la durée totale demandée (somme des durées des scènes) et le format d'image.
- Titres courts et percutants (7 mots maximum), sous-titres d'une ligne ou deux.
- N'invente aucun fait : ni chiffres, ni récompenses, ni certifications, ni coordonnées, ni noms de clients. Si une information manque, écris un repère explicite entre crochets, par exemple [Votre numéro], et signale-le dans "notes".
- Utilise visual = "media" uniquement si l'utilisateur dispose d'images ou de vidéos (nombre indiqué) ; sinon privilégie "text", "kinetic", "logo" (si un logo est fourni) et "cta".
- Musique : décris l'ambiance et le tempo, et propose des recherches dans des bibliothèques libres de droits (YouTube Audio Library, Pixabay Music, Free Music Archive). Ne cite jamais un morceau commercial protégé ; rappelle de vérifier la licence.
- Choisis des animations, transitions et effets cohérents avec le secteur et le ton ; évite de surcharger : 1 ou 2 effets globaux suffisent souvent.
- Couleurs au format #RRGGBB, avec un bon contraste entre texte et fond.
TXT;

$assets = is_array($input['assets'] ?? null) ? $input['assets'] : [];
$assetsText = sprintf(
    'Médias disponibles : logo %s, %d image(s)/vidéo(s), musique %s, voix off %s.',
    !empty($assets['logo']) ? 'oui' : 'non',
    max(0, min(100, (int) ($assets['visuals'] ?? 0))),
    !empty($assets['music']) ? 'oui' : 'non',
    !empty($assets['voice']) ? 'oui' : 'non'
);

if ($action === 'plan') {
    $brief = trim(mb_substr((string) ($input['brief'] ?? ''), 0, 4000));
    if (mb_strlen($brief) < 10) {
        fail(400, 'bad_request', 'Le brief est trop court.');
    }
    $aspect = in_array($input['aspect'] ?? '', ['16:9', '9:16', '1:1', '4:5'], true) ? $input['aspect'] : 'à choisir selon le brief';
    $duration = (float) ($input['duration'] ?? 0);
    $brand = trim(mb_substr((string) ($input['brand'] ?? ''), 0, 120));
    $userText = "Brief :\n{$brief}\n\nFormat : {$aspect}\nDurée totale : " . ($duration > 0 ? "{$duration} secondes" : 'à choisir selon le brief')
        . ($brand !== '' ? "\nMarque : {$brand}" : '') . "\n{$assetsText}\n\nPropose le plan de montage complet.";
} else {
    $plan = $input['plan'] ?? null;
    $instruction = trim(mb_substr((string) ($input['instruction'] ?? ''), 0, 2000));
    $planJson = json_encode($plan, JSON_UNESCAPED_UNICODE);
    if (!is_array($plan) || $planJson === false || strlen($planJson) > 60_000 || mb_strlen($instruction) < 3) {
        fail(400, 'bad_request', 'Plan ou instruction invalide.');
    }
    $userText = "Plan actuel (JSON) :\n{$planJson}\n\n{$assetsText}\n\nModification demandée :\n{$instruction}\n\nRenvoie le plan complet révisé. Conserve tout ce que la demande ne modifie pas.";
}

// ------------------------------------------------------------------ appel au modèle
$autoload = $serverDir . '/vendor/autoload.php';
if (!is_file($autoload)) {
    fail(503, 'sdk_missing');
}
require $autoload;

try {
    $client = new \Anthropic\Client(
        apiKey: (string) $config['anthropic_api_key'],
        baseUrl: $config['base_url'] !== '' ? (string) $config['base_url'] : null,
    );
    $message = $client->beta->messages->create(
        model: (string) $config['model'],
        maxTokens: 16000,
        system: $system,
        messages: [['role' => 'user', 'content' => $userText]],
        outputConfig: [
            'effort' => (string) $config['effort'],
            'format' => ['type' => 'json_schema', 'schema' => $schema],
        ],
        // Repli côté serveur si le modèle décline la demande (catégorie de refus).
        fallbacks: 'default',
        betas: ['server-side-fallback-2026-07-01'],
    );
} catch (\Anthropic\Core\Exceptions\AuthenticationException | \Anthropic\Core\Exceptions\PermissionDeniedException $e) {
    fail(502, 'auth');
} catch (\Anthropic\Core\Exceptions\RateLimitException $e) {
    fail(429, 'rate');
} catch (\Anthropic\Core\Exceptions\BadRequestException $e) {
    fail(502, 'server', 'Requête refusée par l\'API.');
} catch (\Anthropic\Core\Exceptions\APITimeoutException | \Anthropic\Core\Exceptions\APIConnectionException $e) {
    fail(504, 'network');
} catch (\Anthropic\Core\Exceptions\APIStatusException $e) {
    fail(502, 'server', 'Le service d\'IA a renvoyé une erreur.');
} catch (\Throwable $e) {
    error_log('[studio-ai] ' . $e->getMessage());
    fail(500, 'server');
}

if ($message->stopReason === 'refusal') {
    fail(422, 'refusal');
}
if ($message->stopReason === 'max_tokens') {
    fail(502, 'invalid_output', 'Réponse tronquée.');
}
$text = '';
foreach ($message->content as $block) {
    if ($block->type === 'text') {
        $text .= $block->text;
    }
}
$plan = json_decode($text, true);
if (!is_array($plan) || !isset($plan['scenes']) || !is_array($plan['scenes'])) {
    fail(502, 'invalid_output');
}

reply(200, ['ok' => true, 'plan' => $plan, 'model' => $message->model ?? $config['model']]);
