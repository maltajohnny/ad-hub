/**
 * GET /api/intellisearch/ping
 * Resposta só com APIs nativas de `http.ServerResponse` (sem `res.status` / `res.json`).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApiErrorBoundary } from "../lib/withApiErrorBoundary";

function pingHandler(_req: VercelRequest, res: VercelResponse): void {
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

export default withApiErrorBoundary(pingHandler);
