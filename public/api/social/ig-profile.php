<?php
/**
 * Devolve o HTML público de https://www.instagram.com/{user}/ para o cliente parsear contagens.
 * Uso no front: VITE_SOCIAL_PULSE_IG_PROXY_URL=/api/social/ig-profile.php?user=
 * Nota: respeite os ToS da Meta/Instagram; uso interno e rate-limit recomendado.
 */
declare(strict_types=1);

header('Content-Type: text/html; charset=utf-8');

$user = isset($_GET['user']) ? (string) $_GET['user'] : '';
$user = preg_replace('/[^a-zA-Z0-9._]/', '', $user);
if ($user === '') {
    http_response_code(400);
    echo '';
    exit;
}

if (!function_exists('curl_init')) {
    http_response_code(500);
    echo '';
    exit;
}

$url = 'https://www.instagram.com/' . rawurlencode($user) . '/';
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT => 25,
    CURLOPT_HTTPHEADER => [
        'User-Agent: Mozilla/5.0 (compatible; AD-HUB-SocialPulse/1.0)',
        'Accept-Language: pt-BR,pt;q=0.9,en;q=0.8',
    ],
]);
$body = curl_exec($ch);
$code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($body === false || $code >= 400) {
    http_response_code(502);
    echo '';
    exit;
}

http_response_code(200);
echo $body;
