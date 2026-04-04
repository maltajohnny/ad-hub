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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
