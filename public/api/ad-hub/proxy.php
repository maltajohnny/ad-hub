<?php
/**
 * Proxy /api/ad-hub/* → API Go (auth utilizadores MySQL).
 * Mesma lógica de candidatos que api/intellisearch/proxy.php (PORT 3041).
 */
declare(strict_types=1);

/**
 * @return list<string>
 */
function adhub_proxy_bind_extra_urls(string $envKey): array
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

/**
 * URI efetiva do pedido ao Go. Com RewriteRule → proxy.php, REQUEST_URI pode vir como
 * /api/ad-hub/proxy.php e o Go recebe 404; REDIRECT_URL guarda o caminho real em muitos hosts.
 */
function adhub_effective_request_uri(): string
{
    $uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
    $redirect = (string) ($_SERVER['REDIRECT_URL'] ?? '');
    if (
        $redirect !== ''
        && strncmp($redirect, '/api/ad-hub/', strlen('/api/ad-hub/')) === 0
        && strpos($redirect, 'proxy.php') === false
    ) {
        $uri = $redirect;
        $qs = (string) ($_SERVER['QUERY_STRING'] ?? '');
        if ($qs !== '' && strpos($uri, '?') === false) {
            $uri .= '?' . $qs;
        }
        return $uri;
    }
    $orig = (string) ($_SERVER['HTTP_X_ORIGINAL_URL'] ?? '');
    if (
        $orig !== ''
        && strncmp($orig, '/api/ad-hub/', strlen('/api/ad-hub/')) === 0
        && strpos($orig, 'proxy.php') === false
    ) {
        return $orig;
    }
    return $uri;
}

$uri = adhub_effective_request_uri();
if (strpos($uri, '/api/ad-hub') !== 0) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'invalid path']);
    exit;
}

$candidates = [];
// 1) backend.local.php primeiro (HostGator: porta fixa sem depender de env no cPanel)
$localFile = __DIR__ . '/backend.local.php';
if (is_readable($localFile)) {
    $override = include $localFile;
    if (is_string($override) && $override !== '') {
        $candidates[] = rtrim($override, '/');
    }
}
$envB = getenv('ADHUB_GO_BACKEND');
if (!is_string($envB) || $envB === '') {
    $envB = isset($_SERVER['ADHUB_GO_BACKEND']) ? (string) $_SERVER['ADHUB_GO_BACKEND'] : '';
}
if (is_string($envB) && $envB !== '') {
    $candidates[] = rtrim($envB, '/');
}
foreach (adhub_proxy_bind_extra_urls('ADHUB_GO_BIND_EXTRA') as $u) {
    $candidates[] = $u;
}
$reqHost = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
if ($reqHost === 'ad-hub.digital' || $reqHost === 'www.ad-hub.digital') {
    $candidates[] = 'http://162.241.2.132:3041';
}
$candidates[] = 'http://127.0.0.1:3041';
$candidates[] = 'http://localhost:3041';
$serverAddr = isset($_SERVER['SERVER_ADDR']) ? (string) $_SERVER['SERVER_ADDR'] : '';
if ($serverAddr !== '' && filter_var($serverAddr, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
    $candidates[] = 'http://' . $serverAddr . ':3041';
}
$candidates = array_values(array_unique($candidates));

if (!function_exists('curl_init')) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'PHP cURL não está disponível neste servidor.']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$rawBody = file_get_contents('php://input');
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if ($auth === '' && !empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
    $auth = (string) $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
}

$lastErr = '';
$body = false;
$code = 0;
foreach ($candidates as $backend) {
    $url = $backend . $uri;
    $ch = curl_init($url);
    $headers = ['Accept: application/json'];
    if ($auth !== '') {
        $headers[] = 'Authorization: ' . $auth;
    }
    $ct = $_SERVER['CONTENT_TYPE'] ?? '';
    if ($ct !== '' && ($method === 'POST' || $method === 'PATCH' || $method === 'PUT')) {
        $headers[] = 'Content-Type: ' . $ct;
    }
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 90,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_CUSTOMREQUEST => $method,
    ];
    if ($rawBody !== '' && ($method === 'POST' || $method === 'PATCH' || $method === 'PUT')) {
        $opts[CURLOPT_POSTFIELDS] = $rawBody;
    }
    curl_setopt_array($ch, $opts);
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
    'error' => 'proxy: API Go (ad-hub) inacessível. Tentado: ' . implode(', ', $candidates),
    'detail' => $lastErr,
    'hint' => 'Se o IP público:3041 já foi tentado e falhou, o PHP não consegue falar com o Go neste alojamento. IntelliSearch: variável de build VITE_INTELLISEARCH_API_URL=https://… (subdomínio HTTPS com proxy para o Go). Auth /api/ad-hub usa o mesmo proxy PHP até o hosting desbloquear ou expor o Go em HTTPS.',
], JSON_UNESCAPED_UNICODE);
