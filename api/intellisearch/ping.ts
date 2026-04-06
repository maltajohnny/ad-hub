/**
 * GET /api/intellisearch/ping — diagnóstico (sem chamar SerpAPI).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSerpApiKey } from "../lib/env";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const hasSerpKey = Boolean(getSerpApiKey());
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).end(
    JSON.stringify({
      ok: true,
      route: "intellisearch/ping",
      hasSerpKey,
      t: Date.now(),
    }),
  );
}
