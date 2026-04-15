<?php
/**
 * Proxy IntelliSearch → API Go (mesmo servidor).
 *
 * Ordem de URL tentada:
 * 1) Ficheiro backend.local.php nesta pasta (return 'http://...';) — prioridade na HostGator
 * 2) INTELLISEARCH_BACKEND (getenv ou $_SERVER, ex.: SetEnv no .htaccess)
 * 3) INTELLISEARCH_BIND_EXTRA — URLs extra separadas por vírgula (ex.: IP público:3041 quando o PHP
 *    não alcança 127.0.0.1 mas o Go ouve em 0.0.0.0:3041)
 * 4) Loopback 127.0.0.1 / localhost nas portas 3041 e (legado) 3042
 * 5) IP do servidor ($_SERVER['SERVER_ADDR']) nas mesmas portas
 *
 * Se tudo falhar: na HostGator o PHP por vezes NÃO consegue falar com processos do teu utilizador
 * em 127.0.0.1 (CageFS). Testa por SSH: curl http://127.0.0.1:3041/api/intellisearch/ping
 * Se aí funcionar mas o site não, pergunta ao suporte ou usa app Node/cPanel a expor a porta em HTTPS.
 */
declare(strict_types=1);

/**
 * @return list<string>
 */
function intellisearch_proxy_bind_extra_urls(string $envKey): array
{
    $raw = getenv($envKey);
    if (!is_string($raw) || $raw === '') {
        $raw = isset($_SERVER[$envKey]) ? (string) $_SERVER[$envKey] : '';
    }
    if ($raw === '') {
        return [];
    }
    $out = [];
    foreach (explode(',', $raw) as $u) {
        $u = trim($u);
        if ($u === '' || strlen($u) > 512) {
            continue;
        }
        if (!preg_match('#^https?://#i', $u)) {
            continue;
        }
        $out[] = rtrim($u, '/');
    }
    return $out;
}

$uri = $_SERVER['REQUEST_URI'] ?? '/';
if (strpos($uri, '/api/intellisearch') !== 0) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'invalid path']);
    exit;
}

$candidates = [];
$localFile = __DIR__ . '/backend.local.php';
if (is_readable($localFile)) {
    $override = include $localFile;
    if (is_string($override) && $override !== '') {
        $candidates[] = rtrim($override, '/');
    }
}
$envB = getenv('INTELLISEARCH_BACKEND');
if (!is_string($envB) || $envB === '') {
    $envB = isset($_SERVER['INTELLISEARCH_BACKEND']) ? (string) $_SERVER['INTELLISEARCH_BACKEND'] : '';
}
if (is_string($envB) && $envB !== '') {
    $candidates[] = rtrim($envB, '/');
}
foreach (intellisearch_proxy_bind_extra_urls('INTELLISEARCH_BIND_EXTRA') as $u) {
    $candidates[] = $u;
}
$candidates[] = 'http://127.0.0.1:3041';
$candidates[] = 'http://localhost:3041';
$serverAddr = isset($_SERVER['SERVER_ADDR']) ? (string) $_SERVER['SERVER_ADDR'] : '';
if ($serverAddr !== '' && filter_var($serverAddr, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
    $candidates[] = 'http://' . $serverAddr . ':3041';
    $candidates[] = 'http://' . $serverAddr . ':3042';
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
    'hint' => 'SSH: curl -sS http://127.0.0.1:3041/api/intellisearch/ping — se OK mas o site falha, CageFS/isolamento PHP↔Go: em public/api/intellisearch/.htaccess use SetEnv INTELLISEARCH_BIND_EXTRA http://IP_PUBLICO_DO_SERVIDOR:3041 (Go a ouvir em 0.0.0.0:3041), ou crie backend.local.php com return desse URL, ou subdomínio HTTPS→Go e VITE_INTELLISEARCH_API_URL no build.',
], JSON_UNESCAPED_UNICODE);
