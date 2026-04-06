import { env } from "node:process";

/**
 * SerpAPI: o nome `SERPAPI_KEY` não pode surgir como acesso estático a `process.env.*` no bundle
 * (esbuild na Vercel pode substituir por `undefined` no deploy). O identificador é reconstruído em runtime.
 */
export function getSerpApiKey(): string | undefined {
  const name = Buffer.from("U0VSUEFQSV9LRVk=", "base64").toString("utf8");
  const v = (env as Record<string, string | undefined>)[name];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}
