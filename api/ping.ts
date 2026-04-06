/** GET /api/ping — healthcheck mínimo na raiz de /api */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse): void {
  const body = JSON.stringify({ ok: true, route: "ping", t: Date.now() });
  if (!res.headersSent) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }
  res.end(body);
}
