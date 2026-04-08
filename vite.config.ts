import type { IncomingMessage, ServerResponse } from "http";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { slackWebhookRelayPlugin } from "./vite-plugin-slack-webhook-relay";

/** Se a API Go não estiver na porta 3042, o proxy devolvia corpo vazio → o cliente falhava ao fazer parse do JSON. */
function intellisearchProxyOnError(err: Error, _req: IncomingMessage, res: ServerResponse | undefined) {
  console.error("[vite proxy /api/intellisearch]", err.message);
  if (!res || res.writableEnded) return;
  try {
    res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        error:
          "API IntelliSearch offline. Noutro terminal (raiz do projeto): npm run intellisearch-api (porta 3042). Defina SERPAPI_KEY no ambiente.",
      }),
    );
  } catch {
    /* ignore */
  }
}

const intellisearchProxy = {
  target: "http://127.0.0.1:3042",
  changeOrigin: true,
  configure: (proxy: { on: (ev: string, fn: (...args: unknown[]) => void) => void }) => {
    proxy.on("error", intellisearchProxyOnError as (...args: unknown[]) => void);
  },
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  /** Expõe `VITE_*`, `SLACK_*`, `OPENAI_*` e `GEMINI_*` ao cliente (ex.: chaves no `.env`). */
  envPrefix: ["VITE_", "SLACK_", "OPENAI_", "GEMINI_"],
  plugins: [react(), slackWebhookRelayPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    /** Backend Go (SerpAPI) em `backend/intellisearch` — `npm run intellisearch-api` na porta 3042. */
    proxy: {
      "/api/intellisearch": intellisearchProxy,
    },
  },
  preview: {
    proxy: {
      "/api/intellisearch": intellisearchProxy,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
