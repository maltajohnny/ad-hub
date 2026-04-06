/**
 * GET /api/intellisearch/ranking?keyword=&domain=
 * Versão JS pura para Vercel.
 */
const SERP_BASE = "https://serpapi.com/search.json";

function sendJson(res, status, body) {
  if (!res.headersSent) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }
  res.end(JSON.stringify(body));
}

function normalizeDomain(d) {
  return String(d || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

function getSerpKey() {
  const key = process?.env?.SERPAPI_KEY;
  return typeof key === "string" && key.trim() ? key.trim() : "";
}

export default async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const rawK = req.query?.keyword;
    const rawD = req.query?.domain;
    const keyword = Array.isArray(rawK) ? String(rawK[0] || "").trim() : String(rawK || "").trim();
    const domain = Array.isArray(rawD) ? String(rawD[0] || "").trim() : String(rawD || "").trim();
    if (!keyword || !domain) {
      sendJson(res, 400, { error: "indique palavra-chave e domínio" });
      return;
    }

    const key = getSerpKey();
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

    const u = `${SERP_BASE}?${new URLSearchParams({ engine: "google", q: keyword, api_key: key, num: "100" }).toString()}`;
    const r = await fetch(u);
    const txt = await r.text();
    let data;
    try {
      data = JSON.parse(txt);
    } catch {
      sendJson(res, 502, { error: "Resposta SerpAPI não é JSON." });
      return;
    }
    if (!r.ok || data?.error) {
      sendJson(res, 502, { error: data?.error || "Falha ao consultar SerpAPI." });
      return;
    }

    const organic = Array.isArray(data?.organic_results) ? data.organic_results : [];
    let position = null;
    for (let i = 0; i < organic.length; i++) {
      const link = String(organic[i]?.link || "").toLowerCase();
      if (link.includes(norm)) {
        position = organic[i]?.position || i + 1;
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
  } catch (err) {
    sendJson(res, 500, {
      error: err && err.message ? err.message : String(err),
      code: "FUNCTION_INVOCATION_FAILED",
      doc: "https://vercel.com/docs/errors/FUNCTION_INVOCATION_FAILED",
    });
  }
}
