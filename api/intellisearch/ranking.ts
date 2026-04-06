/**
 * GET /api/intellisearch/ranking?keyword=&domain= — posição orgânica (SerpAPI), alinhado ao handler Go.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSerpApiKey } from "../lib/env";
import { sendJson, sendNoContent } from "../lib/sendJson";
import { withApiErrorBoundary } from "../lib/withApiErrorBoundary";

function normalizeDomain(d: string): string {
  return d
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

async function rankingHandler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "OPTIONS") {
      sendNoContent(res);
      return;
    }
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const rawK = req.query.keyword;
    const rawD = req.query.domain;
    const keyword = (Array.isArray(rawK) ? rawK[0] : rawK)?.toString().trim() ?? "";
    const domain = (Array.isArray(rawD) ? rawD[0] : rawD)?.toString().trim() ?? "";

    if (!keyword || !domain) {
      sendJson(res, 400, { error: "indique palavra-chave e domínio" });
      return;
    }

    const key = getSerpApiKey();
    const norm = normalizeDomain(domain);

    if (!key) {
      sendJson(res, 200, {
        ok: true,
        demo: true,
        message: "Configure SERPAPI_KEY para posição real nos resultados orgânicos.",
        keyword,
        domain: norm,
        position: null,
        checked: 0,
      });
      return;
    }

    const u = `https://serpapi.com/search.json?${new URLSearchParams({
      engine: "google",
      q: keyword,
      api_key: key,
      num: "100",
    })}`;
    const r = await fetch(u);
    let data: {
      organic_results?: Array<{ link?: string; position?: number }>;
      error?: string;
    };
    try {
      data = (await r.json()) as typeof data;
    } catch {
      sendJson(res, 502, { error: "Resposta SerpAPI não é JSON." });
      return;
    }

    if (!r.ok || data.error) {
      sendJson(res, 502, { error: data.error || "Falha ao consultar SerpAPI." });
      return;
    }

    const organic = data.organic_results ?? [];
    let position: number | null = null;
    for (let i = 0; i < organic.length; i++) {
      const link = (organic[i].link || "").toLowerCase();
      if (link.includes(norm)) {
        position = organic[i].position ?? i + 1;
        break;
      }
    }

    sendJson(res, 200, {
      ok: true,
      demo: false,
      keyword,
      domain: norm,
      position,
      checked: organic.length,
    });
  } catch (fatal) {
    const msg = fatal instanceof Error ? fatal.message : String(fatal);
    console.error("[api/intellisearch/ranking]", fatal);
    if (!res.headersSent) {
      sendJson(res, 500, { error: msg });
    }
  }
}

export default withApiErrorBoundary(rankingHandler);
