import type { IncomingMessage, ServerResponse } from "http";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { slackWebhookRelayPlugin } from "./vite-plugin-slack-webhook-relay";

/** URL base da API Go no dev (Vite proxy). Deve coincidir com `PORT` no `.env` da API (ex.: 3042). */
function goBackendTarget(mode: string): string {
  const env = loadEnv(mode, process.cwd(), "");
  const t = (env.ADHUB_GO_PROXY ?? "").trim();
  if (t !== "") return t.replace(/\/$/, "");
  return "http://127.0.0.1:3041";
}

function intellisearchProxyOnError(err: Error, _req: IncomingMessage, res: ServerResponse | undefined) {
  console.error("[vite proxy /api/intellisearch]", err.message);
  if (!res || res.writableEnded) return;
  try {
    res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        error:
          "API IntelliSearch offline. Noutro terminal: npm run intellisearch-api. Se a API Go usar outra porta, defina ADHUB_GO_PROXY no .env (ex.: http://127.0.0.1:3042). Defina SERPAPI_KEY.",
      }),
    );
  } catch {
    /* ignore */
  }
}

function adPlatformProxyOnError(err: Error, _req: IncomingMessage, res: ServerResponse | undefined) {
  console.error("[vite proxy /api/ad-platform]", err.message);
  if (!res || res.writableEnded) return;
  try {
    res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        error:
          "API AD-Hub (OAuth) offline. npm run intellisearch-api; ajuste ADHUB_GO_PROXY se a porta não for 3041. Defina META_APP_SECRET / TIKTOK_APP_SECRET no .env.",
      }),
    );
  } catch {
    /* ignore */
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const goTarget = goBackendTarget(mode);
  const intellisearchProxy = {
    target: goTarget,
    changeOrigin: true,
    configure: (proxy: { on: (ev: string, fn: (...args: unknown[]) => void) => void }) => {
      proxy.on("error", intellisearchProxyOnError as (...args: unknown[]) => void);
    },
  };
  const adPlatformProxy = {
    target: goTarget,
    changeOrigin: true,
    configure: (proxy: { on: (ev: string, fn: (...args: unknown[]) => void) => void }) => {
      proxy.on("error", adPlatformProxyOnError as (...args: unknown[]) => void);
    },
  };
  const adHubAuthProxy = {
    target: goTarget,
    changeOrigin: true,
  };

  return {
  /** Expõe `VITE_*`, `SLACK_*`, `OPENAI_*` e `GEMINI_*` ao cliente (ex.: chaves no `.env`). */
  envPrefix: ["VITE_", "SLACK_", "OPENAI_", "GEMINI_"],
  plugins: [react(), slackWebhookRelayPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    /** Backend Go — `npm run intellisearch-api`; URL em ADHUB_GO_PROXY (predef.: http://127.0.0.1:3041). */
    proxy: {
      "/api/intellisearch": intellisearchProxy,
      "/api/ad-platform": adPlatformProxy,
      "/api/ad-hub": adHubAuthProxy,
    },
  },
  preview: {
    proxy: {
      "/api/intellisearch": intellisearchProxy,
      "/api/ad-platform": adPlatformProxy,
      "/api/ad-hub": adHubAuthProxy,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
};
});
