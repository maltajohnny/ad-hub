/**
 * SerpAPI: nome da env só em runtime (base64). Usa `atob` (Node 18+ / Vercel) — evita depender de `Buffer` no worker.
 */
export function getSerpApiKey(): string | undefined {
  let name: string;
  try {
    name = atob("U0VSUEFQSV9LRVk=");
  } catch {
    return undefined;
  }
  const env = typeof process !== "undefined" ? process.env : undefined;
  const v = env?.[name];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}
