#!/usr/bin/env node
/**
 * Lista modelos disponíveis na API Gemini para a chave em `.env` (GEMINI_API_KEY).
 * GET https://generativelanguage.googleapis.com/v1beta/models?key=...
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error("Ficheiro não encontrado:", filePath);
    process.exit(1);
  }
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const env = loadDotEnv(envPath);
const key = env.GEMINI_API_KEY?.trim();
if (!key) {
  console.error("Defina GEMINI_API_KEY no ficheiro .env na raiz do projeto.");
  process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;

const res = await fetch(url);
const text = await res.text();

if (!res.ok) {
  console.error("Erro HTTP", res.status);
  console.error(text.slice(0, 800));
  process.exit(1);
}

let data;
try {
  data = JSON.parse(text);
} catch {
  console.error("Resposta não é JSON:", text.slice(0, 400));
  process.exit(1);
}

const models = data.models ?? [];
console.log(`Modelos Gemini (${models.length}):\n`);

for (const m of models) {
  const id = typeof m.name === "string" ? m.name.replace(/^models\//, "") : m.name;
  const methods = Array.isArray(m.supportedGenerationMethods)
    ? m.supportedGenerationMethods.join(", ")
    : "";
  const extra = [m.displayName, methods].filter(Boolean).join(" — ");
  console.log(`- ${id}${extra ? ` (${extra})` : ""}`);
}

if (models.length === 0) {
  console.log("(nenhum modelo — verifique a chave e permissões na Google AI Studio)");
}
