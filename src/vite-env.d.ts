/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SLACK_WEBHOOK_URL?: string;
  /** Incoming Webhook global (fallback). Preferir webhook por cliente nas definições. */
  readonly SLACK_WEBHOOK_URL?: string;
  /** URL base do relay (ex.: backend em produção). Vazio = mesmo origin (`/api/slack-webhook`). */
  readonly VITE_SLACK_RELAY_URL?: string;
  /**
   * URL pública HTTPS da app (sem barra final). Usada na imagem composta das roscas para o Slack
   * ir buscar o PNG — em dev com túnel/ngrok, defina aqui; localhost não é acessível pelo Slack.
   */
  readonly VITE_PUBLIC_APP_URL?: string;
  /** Chave API OpenAI (alternativa ao nome `OPENAI_API_KEY`, comum em tutoriais Vite). */
  readonly VITE_OPENAI_API_KEY?: string;
  /** Chave API OpenAI (análise de campanhas). Preferir backend em produção. */
  readonly OPENAI_API_KEY?: string;
  /** Modelo opcional (ex.: gpt-4o-mini, gpt-4o). */
  readonly VITE_OPENAI_MODEL?: string;
  /** Modelo opcional (ex.: gpt-4o-mini, gpt-4o). */
  readonly OPENAI_MODEL?: string;
  /** Chave API Google Gemini — usada em `?key=` no generateContent. */
  readonly GEMINI_API_KEY?: string;
  /** Modelo (predef.: gemini-2.5-flash). */
  readonly GEMINI_MODEL?: string;
  /** App Meta — URL de redirect OAuth deve coincidir (ex.: https://localhost:8080/gestao-midias). */
  readonly VITE_META_APP_ID?: string;
  /** Opcional: override do redirect OAuth (predef.: origin + /gestao-midias). */
  readonly VITE_PLATFORM_OAUTH_REDIRECT_URI?: string;
  readonly VITE_TIKTOK_APP_ID?: string;
  readonly VITE_GOOGLE_OAUTH_CLIENT_ID?: string;
  /**
   * URL base da API IntelliSearch (Go). Vazio = mesmo origin (`/api/intellisearch/...`).
   * Obrigatório em deploy estático se a API estiver noutro domínio/subdomínio.
   */
  readonly VITE_INTELLISEARCH_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
