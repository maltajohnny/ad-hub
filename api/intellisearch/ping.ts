/**
 * GET /api/intellisearch/ping
 * Handler mínimo: sem `res.status`/`res.json` (não existem no Node puro) e sem imports de runtime
 * além do default export (tipos só em compile-time).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse): void {
  const body = JSON.stringify({
    ok: true,
    route: "intellisearch/ping",
    t: Date.now(),
  });
  if (!res.headersSent) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }
  res.end(body);
}
