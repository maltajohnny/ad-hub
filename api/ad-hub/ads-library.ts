/**
 * POST /api/ad-hub/ads-library — Meta Ads Library (token) ou demo.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendJson } from "../lib/sendJson";
import { withApiErrorBoundary } from "../lib/withApiErrorBoundary";
import { getGrowthActor, parseJsonBody } from "../lib/growthRequest";
import { getMetaAdsAccessToken } from "../lib/growthEnv";

type AdRow = {
  id: string;
  pageName: string;
  headline: string;
  body: string;
  creativeUrl: string | null;
  isActive: boolean;
};

function demoAds(q: string): AdRow[] {
  const seed = q.length * 131;
  return [0, 1, 2, 3, 4].map((i) => ({
    id: `demo_${seed + i}`,
    pageName: `Marca ${(seed % 90) + i}`,
    headline: `Oferta relacionada a «${q.slice(0, 40)}»`,
    body: "Texto do anuncio simulado para referencia criativa dentro do AD-Hub.",
    creativeUrl: null,
    isActive: true,
  }));
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
  const searchType = String(body?.searchType ?? "keyword");
  const query = String(body?.query ?? "").trim();
  if (!query) {
    sendJson(res, 400, { ok: false, error: "query obrigatorio." });
    return;
  }

  const token = getMetaAdsAccessToken();
  if (token) {
    try {
      const params = new URLSearchParams({
        access_token: token,
        search_terms: query,
        ad_reached_countries: "BR",
        ...(searchType === "advertiser" ? { search_page_ids: query } : {}),
      });
      const url = `https://graph.facebook.com/v21.0/ads_archive?${params.toString()}`;
      const r = await fetch(url);
      const data = (await r.json()) as {
        data?: Array<{
          id?: string;
          page_name?: string;
          ad_snapshot_url?: string;
          ad_creative_bodies?: string[];
          ad_creative_link_titles?: string[];
        }>;
      };
      if (r.ok && data.data) {
        const ads: AdRow[] = (data.data ?? []).slice(0, 25).map((row, i) => ({
          id: row.id ?? `fb_${i}`,
          pageName: row.page_name ?? "—",
          headline: row.ad_creative_link_titles?.[0] ?? "—",
          body: row.ad_creative_bodies?.[0] ?? "—",
          creativeUrl: row.ad_snapshot_url ?? null,
          isActive: true,
        }));
        sendJson(res, 200, { ok: true, demo: false, ads });
        return;
      }
    } catch {
      /* demo */
    }
  }

  sendJson(res, 200, {
    ok: true,
    demo: true,
    message: "Configure META_ADS_LIBRARY_TOKEN (Graph API) para resultados reais da Biblioteca de Anuncios.",
    ads: demoAds(query),
  });
}

export default withApiErrorBoundary(handler);
