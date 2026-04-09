<?php
/**
 * Proxy IntelliSearch → API Go (mesmo servidor).
 *
 * Ordem de URL tentada:
 * 1) Variável de ambiente INTELLISEARCH_BACKEND (Apache SetEnv no .htaccess)
 * 2) Ficheiro backend.local.php nesta pasta (return 'http://...';) — útil na HostGator
 * 3) http://127.0.0.1:3042 e http://localhost:3042
 *
 * Se tudo falhar: na HostGator o PHP por vezes NÃO consegue falar com processos do teu utilizador
 * em 127.0.0.1 (CageFS). Testa por SSH: curl http://127.0.0.1:3042/api/intellisearch/ping
 * Se aí funcionar mas o site não, pergunta ao suporte ou usa app Node/cPanel a expor a porta em HTTPS.
 */
declare(strict_types=1);

$uri = $_SERVER['REQUEST_URI'] ?? '/';
if (strpos($uri, '/api/intellisearch') !== 0) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'invalid path']);
    exit;
}

$candidates = [];
$envB = getenv('INTELLISEARCH_BACKEND');
if (is_string($envB) && $envB !== '') {
    $candidates[] = rtrim($envB, '/');
}
$localFile = __DIR__ . '/backend.local.php';
if (is_readable($localFile)) {
    $override = include $localFile;
    if (is_string($override) && $override !== '') {
        $candidates[] = rtrim($override, '/');
    }
}
$candidates[] = 'http://127.0.0.1:3042';
$candidates[] = 'http://localhost:3042';
$candidates = array_values(array_unique($candidates));

if (!function_exists('curl_init')) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'PHP cURL não está disponível neste servidor.']);
    exit;
}

$lastErr = '';
$body = false;
$code = 0;
foreach ($candidates as $backend) {
    $url = $backend . $uri;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 90,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
    ]);
    $body = curl_exec($ch);
    $err = curl_error($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body !== false) {
        http_response_code($code > 0 ? $code : 502);
        header('Content-Type: application/json; charset=utf-8');
        echo $body;
        exit;
    }
    $lastErr = $err !== '' ? $err : 'ligação recusada ou timeout';
}

http_response_code(502);
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'error' => 'proxy: API Go inacessível. Tentado: ' . implode(', ', $candidates),
    'detail' => $lastErr,
    'hint' => 'SSH: cd ~/apps/minha-api && ./restart-api.sh && curl -sS http://127.0.0.1:3042/api/intellisearch/ping — se aqui OK mas o site falha, o PHP do hosting pode estar isolado do processo Go (CageFS). Soluções: expor a API por subdomínio/proxy no cPanel ou alojar a API noutro serviço e definir VITE_INTELLISEARCH_API_URL no build.',
], JSON_UNESCAPED_UNICODE);
