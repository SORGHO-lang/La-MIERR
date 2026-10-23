<?php
// Faux serveur de l'API Messages : enregistre la requête et renvoie un plan JSON valide.
$body = file_get_contents('php://input');
file_put_contents(sys_get_temp_dir() . '/gm-mock-last-request.json', json_encode(['uri' => $_SERVER['REQUEST_URI'], 'headers' => getallheaders(), 'body' => json_decode($body, true)], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
$plan = ['title' => 'Pub minière', 'summary' => 'Test', 'aspect' => '16:9',
  'style' => ['palette' => ['background' => '#101010', 'primary' => '#F96A00', 'accent' => '#FFB15C', 'text' => '#FFFFFF'], 'fontHeading' => 'Manrope', 'fontBody' => 'Inter', 'mood' => 'cinématique', 'effects' => ['vignette']],
  'music' => ['mood' => 'épique', 'bpm' => 100, 'suggestions' => ['cinematic corporate (Pixabay Music)']],
  'scenes' => [
    ['duration' => 4, 'purpose' => 'Ouverture', 'visual' => 'logo', 'headline' => "GUEM'S MINING", 'subtext' => '', 'mediaHint' => '', 'textAnimation' => 'pop', 'transition' => 'fade', 'effects' => ['glow'], 'camera' => 'static', 'voiceover' => ''],
    ['duration' => 6, 'purpose' => 'Message', 'visual' => 'text', 'headline' => 'Partenaire de la chaîne minière', 'subtext' => '[Votre numéro]', 'mediaHint' => '', 'textAnimation' => 'fade', 'transition' => 'fade', 'effects' => [], 'camera' => 'static', 'voiceover' => ''],
  ], 'notes' => 'Numéro manquant'];
header('Content-Type: application/json');
header('request-id: req_mock');
echo json_encode(['id' => 'msg_mock', 'type' => 'message', 'role' => 'assistant', 'model' => $body ? json_decode($body, true)['model'] : 'x',
  'content' => [['type' => 'text', 'text' => json_encode($plan, JSON_UNESCAPED_UNICODE)]],
  'stop_reason' => 'end_turn', 'stop_sequence' => null, 'usage' => ['input_tokens' => 10, 'output_tokens' => 10]]);
