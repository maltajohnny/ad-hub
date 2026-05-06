# Google Ads OAuth Bridge (Cloudflare Worker)

Este Worker recebe o callback do Google Ads OAuth e repassa `code + state` para o endpoint interno:

- `POST /api/ad-hub/insight-hub/oauth/google-ads/finish`

## 1) Variáveis no backend (`.env`)

```env
INSIGHT_HUB_OAUTH_CALLBACK_SHARED_SECRET=<openssl rand -hex 32>
```

## 2) Variáveis no Worker

- `APP_URL`  
  Ex.: `https://ad-hub.digital`
- `API_FINISH_URL`  
  Ex.: `https://ad-hub.digital/api/ad-hub/insight-hub/oauth/google-ads/finish`
- `CALLBACK_SHARED_SECRET`  
  Mesmo valor de `INSIGHT_HUB_OAUTH_CALLBACK_SHARED_SECRET`

## 3) Publicar Worker

Com Wrangler:

1. `npm i -g wrangler`
2. `wrangler login`
3. criar projeto e substituir o conteúdo por `scripts/google-ads-oauth-bridge-worker.js`
4. configurar as 3 variáveis acima
5. `wrangler deploy`

## 4) Configurar redirect URI no Google Cloud

No OAuth Client do Google Ads:

- adicionar `https://SEU_WORKER_DOMAIN/google-ads/callback`

Também use esse mesmo URL no fluxo de autorização do app (`redirectUri`).
