# Levantamento de APIs e Tokens (AD-Hub)

Este documento lista as funcionalidades que dependem de APIs externas e quais credenciais/tokens voce precisa levantar para ativar tudo em modo real (sem demo/fallback).

## 1) Midias pagas (Meta Ads / TikTok Ads / Google Ads)

### 1.1 Meta Ads (OAuth + contas + insights)
- Funcionalidades:
  - Login OAuth Meta na plataforma (popup).
  - Leitura de contas de anuncios.
  - Leitura de insights/metricas para vinculo de cliente.
  - Persistencia de token no backend (quando MySQL ativo).
- Frontend (ja usado):
  - `VITE_META_APP_ID`
  - `VITE_OAUTH_POPUP_REDIRECT_URI` (ou fallback em `/oauth/popup-callback`)
- Backend Go (obrigatorio para modo real com persistencia):
  - `META_APP_ID`
  - `META_APP_SECRET`
- Escopos solicitados no fluxo:
  - `ads_read`
  - `ads_management`
  - `business_management`
  - `pages_read_engagement`
  - `instagram_basic`
  - `instagram_manage_insights`
- Onde e usado:
  - `src/components/PlatformOAuthConnectPanel.tsx`
  - `src/services/adPlatformApi.ts`
  - `backend/intellisearch/internal/handlers/adplatform.go`

### 1.2 TikTok Ads (OAuth + advertisers + report)
- Funcionalidades:
  - Login OAuth TikTok na plataforma (popup).
  - Leitura de anunciantes.
  - Relatorio basico para metrica de vinculo.
  - Persistencia de token no backend (quando MySQL ativo).
- Frontend (ja usado):
  - `VITE_TIKTOK_APP_ID`
  - `VITE_OAUTH_POPUP_REDIRECT_URI`
- Backend Go (obrigatorio para modo real com persistencia):
  - `TIKTOK_APP_ID`
  - `TIKTOK_APP_SECRET`
- Onde e usado:
  - `src/components/PlatformOAuthConnectPanel.tsx`
  - `src/services/adPlatformApi.ts`
  - `backend/intellisearch/internal/handlers/adplatform.go`

### 1.3 Google Ads (OAuth URL no frontend, backend ainda parcial)
- Funcionalidades:
  - Botao/URL OAuth Google Ads no frontend.
  - Escopo `https://www.googleapis.com/auth/adwords`.
- Frontend (ja usado):
  - `VITE_GOOGLE_OAUTH_CLIENT_ID`
  - `VITE_PLATFORM_OAUTH_REDIRECT_URI` (ou `VITE_OAUTH_POPUP_REDIRECT_URI`, conforme fluxo)
- Observacao importante:
  - O fluxo de URL OAuth esta pronto no frontend, mas o backend dedicado para troca de code/tokens Google Ads nao esta no mesmo nivel de Meta/TikTok neste momento.
  - Se quiser ativar full Google Ads (contas + metricas), alem do client id voce vai precisar tambem de client secret no backend e implementacao de endpoints equivalentes aos de Meta/TikTok.
- Onde e usado:
  - `src/lib/platformLoginUrls.ts`
  - `src/pages/GestaoMidias.tsx`
  - `src/components/ClientesRegisterModal.tsx`

## 2) IntelliSearch e Inteligencia de mercado

### 2.1 SerpAPI
- Funcionalidades:
  - Ranking organico (`/api/intellisearch/ranking` e `api/google-rank.ts`).
  - Fallback em analises de dominio quando DataForSEO nao esta ativo.
- Credencial:
  - `SERPAPI_KEY`
- Onde e usado:
  - `backend/intellisearch/internal/services/serpapi.go`
  - `api/intellisearch/ranking.js`
  - `api/google-rank.ts`
  - `api/ad-hub/domain-intelligence.ts`

### 2.2 DataForSEO
- Funcionalidades:
  - Analise de dominio estilo SimilarWeb (`/api/ad-hub/domain-intelligence`).
- Credenciais:
  - `DATAFORSEO_LOGIN`
  - `DATAFORSEO_PASSWORD`
- Onde e usado:
  - `api/ad-hub/domain-intelligence.ts`

## 3) Biblioteca de anuncios (Campanhas)

### 3.1 Meta Ads Library API
- Funcionalidades:
  - Busca anuncios por palavra-chave/empresa.
  - Exibicao de criativo/texto/status.
- Credencial:
  - `META_ADS_LIBRARY_TOKEN`
- Onde e usado:
  - `api/ad-hub/ads-library.ts`
  - `src/pages/campanhas/CampanhasBibliotecaAnuncios.tsx`

## 4) Prospecting e extracao de dados

### 4.1 Hunter
- Funcionalidades:
  - Busca de emails por dominio.
- Credencial:
  - `HUNTER_API_KEY`
- Onde e usado:
  - `api/ad-hub/prospecting.ts`
  - `src/pages/prospecting/ProspectingPage.tsx`

### 4.2 Clearbit
- Estado atual:
  - Citado no plano do modulo, mas sem chamada ativa no endpoint atual.
- Acao recomendada:
  - Levantar token agora para proxima iteracao, caso queira enriquecer perfil de leads:
    - Exemplo de nome sugerido: `CLEARBIT_API_KEY` (ainda nao consumido no codigo atual).

### 4.3 Google Places API
- Funcionalidades:
  - Busca de empresas por nicho/localizacao (Google Maps).
- Credencial:
  - `GOOGLE_PLACES_API_KEY`
- Onde e usado:
  - `api/ad-hub/prospecting.ts`

### 4.4 Instagram followers (scraping controlado)
- Estado atual:
  - Endpoint em modo demo no backend (`instagramFollowers`).
  - Mensagem explicita que para real precisa Playwright/Puppeteer no servidor.
- Tokens:
  - Nao ha token configurado no codigo atual para essa parte.
  - Se for migrar para API oficial Meta/Instagram Graph, entrara no conjunto de credenciais Meta.

## 5) Scheduling (agendamento)

### 5.1 Google Calendar
- Estado atual:
  - Fluxo backend esta com flag demo para "connectGoogle".
  - Ainda nao ha OAuth real de Calendar no endpoint novo.
- Tokens/credenciais que vao ser necessarios para modo real:
  - Google OAuth client ID/client secret (novo fluxo backend especifico de Calendar).
  - Escopos de Calendar (`calendar.events`, etc.).

### 5.2 Notificacoes de agendamento
- Estado atual:
  - Endpoint informa pendencia de envio real.
- Credenciais previstas:
  - `SENDGRID_API_KEY` ou SMTP ja existente.
  - Twilio/WhatsApp Meta API (a definir nomes finais no backend).
- Onde aparece:
  - `api/public/booking.ts`

## 6) Automacao (webhooks, CRM, sheets, email)

- Estado atual:
  - Estrutura de automacao pronta com logs.
  - Acao webhook em modo demonstrativo.
  - Google Sheets/CRM/email ainda em placeholder.
- Credenciais previstas para ativacao real:
  - Google Sheets API (service account ou OAuth dedicado).
  - Tokens de CRM(s) que voce decidir integrar.
  - Provider de email (SendGrid/SMTP).
- Onde e usado:
  - `api/ad-hub/automation.ts`
  - `src/pages/automation/AutomationPage.tsx`

## 7) Infra e seguranca de APIs internas

- `ADHUB_INTERNAL_API_KEY`
  - Protege endpoints internos no backend Go via cabecalho `X-AdHub-Internal-Key`.
  - Frontend envia se `VITE_ADHUB_INTERNAL_API_KEY` estiver definido.
- `VITE_ADHUB_API_URL`
  - Base URL para chamadas `/api/ad-platform` fora do modo dev.
- `ADHUB_GO_PROXY`
  - Proxy do Vite local para API Go (dev).

## 8) Lista objetiva do que voce pode levantar agora

Prioridade alta (ja aproveitado no codigo atual):
- `META_APP_ID`
- `META_APP_SECRET`
- `VITE_META_APP_ID`
- `TIKTOK_APP_ID`
- `TIKTOK_APP_SECRET`
- `VITE_TIKTOK_APP_ID`
- `VITE_GOOGLE_OAUTH_CLIENT_ID`
- `SERPAPI_KEY`
- `DATAFORSEO_LOGIN`
- `DATAFORSEO_PASSWORD`
- `META_ADS_LIBRARY_TOKEN`
- `HUNTER_API_KEY`
- `GOOGLE_PLACES_API_KEY`

Prioridade media (proximas ativacoes):
- `SENDGRID_API_KEY` (ou confirmar uso apenas SMTP)
- Credenciais WhatsApp (Twilio ou Meta WhatsApp Cloud)
- Credenciais Google Calendar (backend novo para scheduling real)
- Token Clearbit (para enriquecimento futuro)
- Tokens de CRM escolhido (HubSpot, Pipedrive, Salesforce, etc.)

## 9) Observacao final

- Onde houver fallback/demo hoje, o sistema continua funcional em modo demonstracao.
- Para ficar 100% operacional em producao, o ideal e preencher os tokens de prioridade alta primeiro.
- Depois, ativamos os blocos pendentes (Calendar real, WhatsApp real, CRM real, Sheets real) em uma segunda rodada.
