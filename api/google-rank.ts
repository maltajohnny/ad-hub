/**
 * POST /api/google-rank — posição aproximada do domínio nos resultados orgânicos Google.
 * Requer `SERPAPI_KEY` na Vercel. Sem chave, devolve modo demonstração.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSerpApiKey } from "./lib/env";
import { sendJson } from "./lib/sendJson";
import { withApiErrorBoundary } from "./lib/withApiErrorBoundary";

function normalizeDomain(d: string): string {
  return d
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

async function googleRankHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const keyword = String(body?.keyword ?? "").trim();
    const domain = String(body?.domain ?? "").trim();
    if (!keyword || !domain) {
      sendJson(res, 400, { ok: false, error: "Indique palavra-chave e domínio." });
      return;
    }

    const key = getSerpApiKey();
    const norm = normalizeDomain(domain);

    if (!key) {
      const samplePosition = 6 + Math.floor(Math.random() * 18);
      sendJson(res, 200, {
        ok: true,
        demo: true,
        message:
          "Modo demonstração: configure SERPAPI_KEY no projeto (Vercel) para consultas reais ao Google via SerpAPI.",
        position: null,
        samplePosition,
        keyword,
        domain: norm,
      });
      return;
    }

    const q = encodeURIComponent(keyword);
    const url = `https://serpapi.com/search.json?engine=google&q=${q}&api_key=${encodeURIComponent(key)}&num=100`;
    const r = await fetch(url);
    const data = (await r.json()) as {
      organic_results?: Array<{ link?: string; position?: number }>;
      error?: string;
    };

    if (!r.ok || data.error) {
      sendJson(res, 502, {
        ok: false,
        error: data.error || "Falha ao consultar SerpAPI.",
      });
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
  } catch (e) {
    sendJson(res, 500, {
      ok: false,
      error: e instanceof Error ? e.message : "Erro interno.",
    });
  }
}

export default withApiErrorBoundary(googleRankHandler);
