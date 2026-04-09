<?php
/**
 * Proxy IntelliSearch: o site estático em ad-hub.digital não corre o Go.
 * Este ficheiro (PHP no mesmo domínio) encaminha GET /api/intellisearch/* para o binário local.
 *
 * Backend predefinido: http://127.0.0.1:3042 (igual ao PORT típico no .env de ~/apps/minha-api).
 * Personalizar: no .htaccess desta pasta, descomente SetEnv INTELLISEARCH_BACKEND ...
 */
declare(strict_types=1);

$backend = getenv('INTELLISEARCH_BACKEND') ?: 'http://127.0.0.1:3042';
$backend = rtrim($backend, '/');

$uri = $_SERVER['REQUEST_URI'] ?? '/';
if (strpos($uri, '/api/intellisearch') !== 0) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'invalid path']);
    exit;
}

$url = $backend . $uri;

if (!function_exists('curl_init')) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'PHP cURL não está disponível neste servidor.']);
    exit;
}

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT => 90,
    CURLOPT_HTTPHEADER => ['Accept: application/json'],
]);
$body = curl_exec($ch);
$code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
curl_close($ch);

if ($body === false) {
    http_response_code(502);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'error' => 'proxy: API Go inacessível em ' . $backend . '. Confirme PORT no .env de minha-api e se o processo está a correr.',
        'detail' => $err,
    ]);
    exit;
}

http_response_code($code > 0 ? $code : 502);
header('Content-Type: application/json; charset=utf-8');
echo $body;
