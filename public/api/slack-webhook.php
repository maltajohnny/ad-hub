<?php
/**
 * Relay POST /api/slack-webhook — mesmo contrato que `vite-plugin-slack-webhook-relay` / `api/slack-webhook.ts`.
 * O browser envia JSON com webhookUrl, text, blocks e opcionalmente budgetMerge (duas URLs quickchart.io).
 * Sem Jimp no servidor: expande budgetMerge em dois blocos image (Slack carrega as duas URLs HTTPS).
 *
 * Requer no .htaccess da raiz (public_html) uma regra que mapeie /api/slack-webhook → este ficheiro.
 */
declare(strict_types=1);

const SLACK_HOOK_PREFIX = 'https://hooks.slack.com/services/';

header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
    exit;
}

$raw = file_get_contents('php://input');
if ($raw === false || $raw === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Corpo vazio'], JSON_UNESCAPED_UNICODE);
    exit;
}

$body = json_decode($raw, true);
if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['error' => 'JSON inválido'], JSON_UNESCAPED_UNICODE);
    exit;
}

$wh = isset($body['webhookUrl']) ? trim((string) $body['webhookUrl']) : '';
if ($wh === '' || strpos($wh, SLACK_HOOK_PREFIX) !== 0) {
    http_response_code(400);
    echo json_encode(['error' => 'URL de webhook inválida (só hooks.slack.com/services/…).'], JSON_UNESCAPED_UNICODE);
    exit;
}

function isAllowedQuickChartUrl(string $u): bool
{
    $x = parse_url($u);
    if ($x === false || ($x['scheme'] ?? '') !== 'https') {
        return false;
    }
    if (($x['host'] ?? '') !== 'quickchart.io') {
        return false;
    }
    $path = $x['path'] ?? '';
    return strpos($path, '/chart') === 0;
}

/**
 * @param array<int, mixed> $blocks
 * @return array<int, mixed>
 */
function expandSingleBudgetImageToTwo(array $blocks, string $leftUrl, string $rightUrl): array
{
    foreach ($blocks as $i => $b) {
        if (!is_array($b)) {
            continue;
        }
        if (($b['type'] ?? '') === 'image' && ($b['image_url'] ?? '') === $leftUrl) {
            $insert = [
                [
                    'type' => 'image',
                    'image_url' => $rightUrl,
                    'alt_text' => 'Rosca: orçamento sugerido pela IA (Meta, Google, Instagram)',
                ],
            ];
            array_splice($blocks, $i + 1, 0, $insert);
            return $blocks;
        }
    }
    return $blocks;
}

$blocks = $body['blocks'] ?? null;
$merge = $body['budgetMerge'] ?? null;
if (
    is_array($blocks) &&
    is_array($merge) &&
    isset($merge['left'], $merge['right']) &&
    is_string($merge['left']) &&
    is_string($merge['right']) &&
    isAllowedQuickChartUrl($merge['left']) &&
    isAllowedQuickChartUrl($merge['right'])
) {
    $blocks = expandSingleBudgetImageToTwo($blocks, $merge['left'], $merge['right']);
}

$payload = [
    'text' => isset($body['text']) ? (string) $body['text'] : '',
    'blocks' => is_array($blocks) ? $blocks : [],
];

if (!function_exists('curl_init')) {
    http_response_code(500);
    echo json_encode(['error' => 'PHP cURL não está disponível neste servidor.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$jsonPayload = json_encode($payload, JSON_UNESCAPED_UNICODE);
if ($jsonPayload === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Falha ao serializar o payload para o Slack.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$ch = curl_init($wh);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json; charset=utf-8'],
    CURLOPT_POSTFIELDS => $jsonPayload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_CONNECTTIMEOUT => 15,
]);
$slackBody = curl_exec($ch);
$curlErr = curl_error($ch);
$code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);

if ($slackBody === false) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => $curlErr !== '' ? $curlErr : 'Falha ao contactar Slack'], JSON_UNESCAPED_UNICODE);
    exit;
}

$ok = $code >= 200 && $code < 300;
http_response_code($code > 0 ? $code : 502);
echo json_encode(['ok' => $ok, 'slack' => $slackBody], JSON_UNESCAPED_UNICODE);
