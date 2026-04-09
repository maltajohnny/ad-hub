<?php
/**
 * Proxy JSON para sugestões de pesquisa do Instagram (web/topsearch).
 * Pode devolver lista vazia se o Instagram bloquear o IP do servidor — o front ainda oferece «Utilizar este utilizador».
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$q = isset($_GET['q']) ? trim((string) $_GET['q']) : '';
$q = preg_replace('/[^a-zA-Z0-9._]/', '', $q);
if (strlen($q) < 1 || strlen($q) > 64) {
    echo json_encode(['users' => []], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!function_exists('curl_init')) {
    http_response_code(500);
    echo json_encode(['users' => []]);
    exit;
}

$url = 'https://www.instagram.com/web/search/topsearch/?query=' . rawurlencode($q);
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT => 18,
    CURLOPT_HTTPHEADER => [
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept: application/json, text/plain, */*',
        'Accept-Language: en-US,en;q=0.9,pt;q=0.8',
        'X-IG-App-ID: 936619743392459',
        'X-Requested-With: XMLHttpRequest',
        'Referer: https://www.instagram.com/',
    ],
]);
$body = curl_exec($ch);
$code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$out = [];
if ($body !== false && $code < 400) {
    $j = json_decode($body, true);
    if (is_array($j) && isset($j['users']) && is_array($j['users'])) {
        foreach ($j['users'] as $row) {
            if (!is_array($row)) {
                continue;
            }
            $u = $row['user'] ?? null;
            if (!is_array($u)) {
                continue;
            }
            $uname = isset($u['username']) ? (string) $u['username'] : '';
            $uname = preg_replace('/[^a-zA-Z0-9._]/', '', $uname);
            if ($uname === '') {
                continue;
            }
            $full = isset($u['full_name']) ? (string) $u['full_name'] : '';
            $pic = isset($u['profile_pic_url']) ? (string) $u['profile_pic_url'] : '';
            $out[] = [
                'username' => $uname,
                'full_name' => $full,
                'profile_pic_url' => $pic !== '' ? $pic : null,
            ];
            if (count($out) >= 20) {
                break;
            }
        }
    }
}

echo json_encode(['users' => $out], JSON_UNESCAPED_UNICODE);
