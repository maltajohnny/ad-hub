/** GET /api/ping — healthcheck na raiz de /api */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApiErrorBoundary } from "./lib/withApiErrorBoundary";

function pingRoot(_req: VercelRequest, res: VercelResponse): void {
  const body = JSON.stringify({ ok: true, route: "ping", t: Date.now() });
  if (!res.headersSent) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }
  res.end(body);
}

export default withApiErrorBoundary(pingRoot);
