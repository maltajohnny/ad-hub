/**
 * SerpAPI: evitar `process.env.SERPAPI_KEY` literal no bundle (Vercel/esbuild).
 * Nome da variável só em runtime (base64). Sem `import "node:process"` — evita falha no worker.
 */
export function getSerpApiKey(): string | undefined {
  const name = Buffer.from("U0VSUEFQSV9LRVk=", "base64").toString("utf8");
  const env = typeof process !== "undefined" ? process.env : undefined;
  const v = env?.[name];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}
