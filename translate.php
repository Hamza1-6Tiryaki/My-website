<?php
// Google Cloud Translation proxy for shared hosting (FTP upload, PHP 7.4+ with cURL).
// The API key lives in config.php on the server and is never sent to the browser.

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

const SOURCE_LANG = 'en';
const ALLOWED_TARGETS = ['tr', 'de', 'ru'];
const MAX_TEXTS = 100;
const MAX_TEXT_LENGTH = 5000;
const MAX_TOTAL_LENGTH = 15000;
const RATE_LIMIT = 20;        // requests per window, per IP
const RATE_WINDOW = 60;       // seconds

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, ['error' => 'Method not allowed.']);
}

$configFile = __DIR__ . '/config.php';
$config = is_file($configFile) ? require $configFile : [];
$apiKey = $config['api_key'] ?? '';
if ($apiKey === '' || $apiKey === 'your-google-cloud-api-key') {
    respond(500, ['error' => 'API key is not configured on the server.']);
}

// Simple file-based rate limiting (protects your Google quota)
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateFile = sys_get_temp_dir() . '/translate_rate_' . md5($ip) . '.json';
$now = time();
$rate = is_file($rateFile) ? json_decode((string) file_get_contents($rateFile), true) : null;
if (!is_array($rate) || $now - ($rate['start'] ?? 0) > RATE_WINDOW) {
    $rate = ['start' => $now, 'count' => 0];
}
$rate['count']++;
@file_put_contents($rateFile, json_encode($rate), LOCK_EX);
if ($rate['count'] > RATE_LIMIT) {
    respond(429, ['error' => 'Too many requests. Please try again later.']);
}

// Validate input
$raw = file_get_contents('php://input', false, null, 0, 100 * 1024);
$body = json_decode((string) $raw, true);
$texts = $body['texts'] ?? null;
$target = $body['target'] ?? null;

$valid = is_array($texts)
    && count($texts) > 0
    && count($texts) <= MAX_TEXTS
    && in_array($target, ALLOWED_TARGETS, true);

$total = 0;
if ($valid) {
    foreach ($texts as $text) {
        if (!is_string($text) || mb_strlen($text) > MAX_TEXT_LENGTH) {
            $valid = false;
            break;
        }
        $total += mb_strlen($text);
    }
}
if (!$valid || $total > MAX_TOTAL_LENGTH) {
    respond(400, ['error' => 'Invalid "texts" or "target".']);
}

// Call Google Cloud Translation v2
$ch = curl_init('https://translation.googleapis.com/language/translate/v2');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'X-goog-api-key: ' . $apiKey,
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'q' => array_values($texts),
        'source' => SOURCE_LANG,
        'target' => $target,
        'format' => 'html',
    ], JSON_UNESCAPED_UNICODE),
]);
$response = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false) {
    error_log('Translate request failed: ' . $curlError);
    respond(502, ['error' => 'Translation service unreachable.']);
}
if ($status !== 200) {
    error_log('Google Translate error ' . $status . ': ' . $response);
    respond(502, ['error' => 'Translation service error.']);
}

$data = json_decode($response, true);
$translations = array_map(
    fn($t) => $t['translatedText'],
    $data['data']['translations'] ?? []
);
respond(200, ['translations' => $translations]);
