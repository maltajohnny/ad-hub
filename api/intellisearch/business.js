/**
 * GET /api/intellisearch/business?query=...
 * Versão JS pura para Vercel (evita crash de invocação em bundle TS).
 */
const SERP_BASE = "https://serpapi.com/search.json";

function sendJson(res, status, body) {
  if (!res.headersSent) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }
  res.end(JSON.stringify(body));
}

function getSerpKey() {
  const key = process?.env?.SERPAPI_KEY;
  return typeof key === "string" && key.trim() ? key.trim() : "";
}

function str(obj, key, fallback = "") {
  const v = obj && typeof obj === "object" ? obj[key] : undefined;
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return fallback;
}

function num(obj, key, fallback = 0) {
  const v = obj && typeof obj === "object" ? obj[key] : undefined;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

async function fetchSerp(params) {
  const key = getSerpKey();
  if (!key) {
    throw new Error("SERPAPI_KEY ausente: configure a variável no projeto Vercel (Settings → Environment Variables).");
  }
  params.set("api_key", key);
  const url = `${SERP_BASE}?${params.toString()}`;
  const r = await fetch(url);
  const txt = await r.text();
  let json;
  try {
    json = JSON.parse(txt);
  } catch {
    throw new Error(`SerpAPI devolveu resposta inválida (HTTP ${r.status}).`);
  }
  if (!r.ok || (json && json.error)) {
    throw new Error((json && json.error) || `Falha na SerpAPI (HTTP ${r.status}).`);
  }
  return json;
}

function buildChecklist(business) {
  const items = [];
  let weak = 0;
  let reasonable = 0;
  let good = 0;
  const add = (id, category, label, status, detail) => {
    if (status === "good") good += 1;
    else if (status === "reasonable") reasonable += 1;
    else weak += 1;
    items.push({ id, category, label, status, detail });
  };

  add(
    "rating",
    "Reputação",
    "Avaliação média",
    business.rating >= 4.2 ? "good" : business.rating >= 3.8 ? "reasonable" : "weak",
    business.rating ? `Nota ${business.rating.toFixed(1)}.` : "Sem nota visível.",
  );
  add(
    "reviews",
    "Reputação",
    "Volume de avaliações",
    business.reviews_count >= 100 ? "good" : business.reviews_count >= 20 ? "reasonable" : "weak",
    `${business.reviews_count || 0} avaliações públicas.`,
  );
  add(
    "contact",
    "Perfil",
    "Contacto",
    business.phone && business.website ? "good" : business.phone || business.website ? "reasonable" : "weak",
    business.phone || business.website ? "Pelo menos um canal de contacto disponível." : "Sem telefone e sem website.",
  );
  add(
    "media",
    "Conteúdo",
    "Fotos",
    (business.photo_urls || []).length >= 5 ? "good" : (business.photo_urls || []).length >= 1 ? "reasonable" : "weak",
    `${(business.photo_urls || []).length} imagem(ns) encontrada(s).`,
  );

  return { checklist: items, tier_counts: { weak, reasonable, good } };
}

function computeScore(tiers) {
  const total = tiers.weak + tiers.reasonable + tiers.good;
  if (!total) return 0;
  const pts = tiers.good * 25 + tiers.reasonable * 15 + tiers.weak * 5;
  return Math.max(0, Math.min(100, Math.round((pts / (total * 25)) * 100)));
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

    const rawQ = req.query?.query ?? req.query?.q ?? "";
    const query = Array.isArray(rawQ) ? String(rawQ[0] || "").trim() : String(rawQ).trim();
    if (!query) {
      sendJson(res, 400, { error: "query vazia" });
      return;
    }

    const p = new URLSearchParams({ engine: "google_maps", q: query, hl: "pt", gl: "br" });
    const data = await fetchSerp(p);
    const results = Array.isArray(data?.local_results) ? data.local_results : [];
    if (!results.length || typeof results[0] !== "object") {
      sendJson(res, 400, { error: "nenhum resultado local no Google Maps para esta pesquisa" });
      return;
    }

    const first = results[0];
    const photos = [];
    const thumb = str(first, "thumbnail", "");
    if (thumb) photos.push(thumb);

    const business = {
      name: str(first, "title", "Sem nome"),
      category: str(first, "type", str(first, "category", "")),
      rating: num(first, "rating", 0),
      reviews_count: num(first, "reviews", 0),
      address: str(first, "address", ""),
      hours_summary: str(first, "hours", ""),
      website: str(first, "website", ""),
      phone: str(first, "phone", ""),
      description: str(first, "description", ""),
      google_maps_url: str(first, "link", ""),
      thumbnail: thumb || undefined,
      photo_urls: photos,
      place_id: str(first, "place_id", "") || undefined,
    };

    const { checklist, tier_counts } = buildChecklist(business);
    const score = computeScore(tier_counts);

    sendJson(res, 200, {
      query,
      score,
      checklist,
      tier_counts,
      business,
      source: "serpapi",
    });
  } catch (err) {
    sendJson(res, 500, {
      error: err && err.message ? err.message : String(err),
      code: "FUNCTION_INVOCATION_FAILED",
      doc: "https://vercel.com/docs/errors/FUNCTION_INVOCATION_FAILED",
    });
  }
}
