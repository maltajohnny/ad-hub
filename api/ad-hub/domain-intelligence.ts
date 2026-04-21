/**
 * POST /api/ad-hub/domain-intelligence — visão tipo SimilarWeb (DataForSEO / SerpAPI / demo).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendJson } from "../lib/sendJson";
import { withApiErrorBoundary } from "../lib/withApiErrorBoundary";
import { getGrowthActor, parseJsonBody } from "../lib/growthRequest";
import { getDataForSeoLogin, getDataForSeoPassword, getSerpApiKeyGrowth } from "../lib/growthEnv";

function normDomain(d: string): string {
  return d
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

function demoReport(domain: string) {
  const base = domain.replace(/\./g, "").length * 9137;
  const monthly = Array.from({ length: 6 }, (_, i) => ({
    month: `2025-${String(11 + i).padStart(2, "0")}`,
    visits: Math.round(8000 + (base % 5000) + i * 420),
  }));
  return {
    domain,
    estimatedMonthlyVisits: monthly[monthly.length - 1].visits,
    trafficShare: {
      organic: 42 + (base % 15),
      paid: 28 + (base % 10),
      social: 18 + (base % 8),
      referral: 12,
    },
    topKeywords: [
      { keyword: `${domain.split(".")[0]} login`, volume: 1200 + (base % 400) },
      { keyword: `${domain.split(".")[0]} preços`, volume: 890 + (base % 200) },
      { keyword: `alternativa ${domain.split(".")[0]}`, volume: 450 + (base % 150) },
    ],
    competitors: [`concorrente-a.com`, `concorrente-b.com`, `similar-${domain.split(".")[0]}.io`],
    monthlyHistory: monthly,
    demo: true,
  };
}

async function handler(req: VercelRequest, res: VercelResponse) {
  const actor = getGrowthActor(req);
  if (!actor) {
    sendJson(res, 401, { ok: false, error: "Cabecalhos X-Tenant-Slug e X-User-Key obrigatorios." });
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  const body = parseJsonBody(req) as Record<string, unknown>;
  const domain = normDomain(String(body?.domain ?? ""));
  if (!domain) {
    sendJson(res, 400, { ok: false, error: "Dominio obrigatorio." });
    return;
  }

  const login = getDataForSeoLogin();
  const pass = getDataForSeoPassword();
  if (login && pass) {
    try {
      const auth = Buffer.from(`${login}:${pass}`).toString("base64");
      const url = "https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live";
      const r = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify([
          {
            target: domain,
            language_name: "Portuguese",
            location_code: 2076,
          },
        ]),
      });
      const data = (await r.json()) as { tasks?: Array<{ result?: unknown }> };
      if (r.ok && data.tasks?.[0]?.result) {
        sendJson(res, 200, { ok: true, demo: false, provider: "dataforseo", raw: data.tasks[0].result, domain });
        return;
      }
    } catch {
      /* demo */
    }
  }

  const serp = getSerpApiKeyGrowth();
  if (serp) {
    try {
      const q = encodeURIComponent(domain);
      const url = `https://serpapi.com/search.json?engine=google&q=${q}&api_key=${encodeURIComponent(serp)}`;
      const r = await fetch(url);
      const organic = (await r.json()) as { organic_results?: Array<{ title?: string }> };
      sendJson(res, 200, {
        ok: true,
        demo: false,
        provider: "serpapi_snippet",
        domain,
        note: "Resposta parcial via SerpAPI; combine com DataForSEO para estimativas de trafego.",
        sampleTitles: (organic.organic_results ?? []).slice(0, 5).map((o) => o.title),
        report: demoReport(domain),
      });
      return;
    } catch {
      /* demo */
    }
  }

  sendJson(res, 200, {
    ok: true,
    message:
      "Modo demonstracao: configure DATAFORSEO_LOGIN/PASSWORD ou SERPAPI_KEY na Vercel para dados enriquecidos.",
    report: demoReport(domain),
  });
}

export default withApiErrorBoundary(handler);
