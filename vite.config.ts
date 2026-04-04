import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { slackWebhookRelayPlugin } from "./vite-plugin-slack-webhook-relay";

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
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
