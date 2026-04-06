/**
 * GET /api/intellisearch/ranking?keyword=&domain= — posição orgânica (SerpAPI), alinhado ao handler Go.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSerpApiKey } from "../lib/env";

function normalizeDomain(d: string): string {
  return d
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const rawK = req.query.keyword;
    const rawD = req.query.domain;
    const keyword = (Array.isArray(rawK) ? rawK[0] : rawK)?.toString().trim() ?? "";
    const domain = (Array.isArray(rawD) ? rawD[0] : rawD)?.toString().trim() ?? "";

    if (!keyword || !domain) {
      res.status(400).json({ error: "indique palavra-chave e domínio" });
      return;
    }

    const key = getSerpApiKey();
    const norm = normalizeDomain(domain);

    if (!key) {
      res.status(200).json({
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
      res.status(502).json({ error: "Resposta SerpAPI não é JSON." });
      return;
    }

    if (!r.ok || data.error) {
      res.status(502).json({ error: data.error || "Falha ao consultar SerpAPI." });
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

    res.status(200).json({
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
      res.status(500).json({ error: msg });
    }
  }
}
