/**
 * GET /api/intellisearch/ping — diagnóstico (sem SerpAPI).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSerpApiKey } from "../lib/env";
import { sendJson } from "../lib/sendJson";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  sendJson(res, 200, {
    ok: true,
    route: "intellisearch/ping",
    hasSerpKey: Boolean(getSerpApiKey()),
    t: Date.now(),
  });
}
