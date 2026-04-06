/**
 * GET /api/intellisearch/business?query=...
 * Mesma lógica que o serviço Go em `backend/intellisearch` — para produção na Vercel.
 * Requer `SERPAPI_KEY` nas variáveis de ambiente do projeto (Dashboard Vercel).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSerpApiKey } from "../lib/env";

const serpBase = "https://serpapi.com/search.json";

type BusinessCard = {
  name: string;
  category: string;
  rating: number;
  reviews_count: number;
  address: string;
  hours_summary: string;
  website: string;
  phone: string;
  description: string;
  google_maps_url: string;
  thumbnail?: string;
  photo_urls: string[];
  place_id?: string;
};

type CheckItem = {
  id: string;
  category: string;
  label: string;
  status: "good" | "reasonable" | "weak";
  detail: string;
};

type TierCounts = { weak: number; reasonable: number; good: number };

type BusinessAnalysis = {
  query: string;
  score: number;
  checklist: CheckItem[];
  tier_counts: TierCounts;
  business: BusinessCard;
  source: string;
};

function str(m: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = m[k];
    if (v == null) continue;
    if (typeof v === "string" && v !== "") return v;
    if (typeof v === "number") return String(Math.round(v));
  }
  return "";
}

function num(m: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = m[k];
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const f = parseFloat(v);
      if (!Number.isNaN(f)) return f;
    }
  }
  return 0;
}

function intFrom(m: Record<string, unknown>, ...keys: string[]): number {
  const v = num(m, ...keys);
  return v > 0 ? Math.round(v) : 0;
}

function hoursText(m: Record<string, unknown>): string {
  const h = m.hours;
  if (h != null) {
    if (typeof h === "string") return h;
    try {
      return JSON.stringify(h);
    } catch {
      /* ignore */
    }
  }
  const open = m.operating_hours;
  if (open && typeof open === "object") {
    try {
      return JSON.stringify(open);
    } catch {
      /* ignore */
    }
  }
  return "";
}

function categoryText(m: Record<string, unknown>): string {
  const t = m.type;
  if (typeof t === "string" && t !== "") return t;
  if (Array.isArray(t) && t.length > 0 && typeof t[0] === "string") return t[0];
  const cats = m.categories;
  if (Array.isArray(cats) && cats.length > 0 && typeof cats[0] === "string") return cats[0];
  return str(m, "category");
}

function placeResultMap(placeResp: Record<string, unknown>): Record<string, unknown> | null {
  const pr = placeResp.place_results;
  if (pr && typeof pr === "object" && !Array.isArray(pr)) return pr as Record<string, unknown>;
  if (Array.isArray(pr) && pr.length > 0 && pr[0] && typeof pr[0] === "object") {
    return pr[0] as Record<string, unknown>;
  }
  return null;
}

function mergeBusiness(local: Record<string, unknown>, place: Record<string, unknown>): BusinessCard {
  const src: Record<string, unknown> = Object.keys(place).length > 0 ? place : local;
  let name = str(src, "title", "name");
  if (name === "") name = str(local, "title", "name");
  let address = str(src, "address", "snippet");
  if (address === "") address = str(local, "address");
  let rating = num(src, "rating");
  if (rating === 0) rating = num(local, "rating");
  let reviewsCount = intFrom(src, "reviews", "user_review_count", "user_ratings_total");
  if (reviewsCount === 0) reviewsCount = intFrom(local, "reviews", "user_review_count");
  let hoursSummary = hoursText(src);
  if (hoursSummary === "") hoursSummary = hoursText(local);
  let category = categoryText(src);
  if (category === "") category = categoryText(local);
  let thumbnail = str(local, "thumbnail", "img");
  if (thumbnail === "") thumbnail = str(src, "thumbnail");
  let googleMapsUrl = str(src, "link", "maps_uri", "google_maps_url", "search_link");
  if (googleMapsUrl === "") googleMapsUrl = str(local, "link", "search_link");
  let placeID = str(local, "place_id");
  if (placeID === "") placeID = str(src, "place_id");

  return {
    name,
    category,
    rating,
    reviews_count: reviewsCount,
    address,
    hours_summary: hoursSummary,
    website: str(src, "website", "link"),
    phone: str(src, "phone", "formatted_phone_number"),
    description: str(src, "description", "about"),
    google_maps_url: googleMapsUrl,
    thumbnail: thumbnail || undefined,
    photo_urls: [],
    place_id: placeID || undefined,
  };
}

function extractPhotoURLs(ph: Record<string, unknown>): string[] {
  const out: string[] = [];
  const imgs = ph.photos;
  if (!Array.isArray(imgs)) return out;
  for (const it of imgs) {
    if (!it || typeof it !== "object") continue;
    const m = it as Record<string, unknown>;
    const u = str(m, "image", "thumbnail", "url");
    if (u !== "") out.push(u);
    if (out.length >= 12) break;
  }
  return out;
}

function calculateScore(b: BusinessCard, photoCount: number, hasReviewsPayload: boolean): number {
  let score = 0;
  if (b.rating > 4.5) score += 20;
  else if (b.rating >= 4.0) score += 12;
  else if (b.rating > 0) score += 5;
  if (b.reviews_count > 50) score += 15;
  else if (b.reviews_count >= 10) score += 10;
  else if (b.reviews_count > 0) score += 5;
  if (photoCount > 0) score += 10;
  if (b.description !== "") score += 10;
  if (b.hours_summary !== "") score += 5;
  if (b.category !== "") score += 15;
  if (b.website !== "") score += 5;
  if (b.phone !== "") score += 5;
  if (hasReviewsPayload) score += 5;
  return score > 100 ? 100 : score;
}

function buildChecklist(b: BusinessCard, photoCount: number): { checklist: CheckItem[]; tier_counts: TierCounts } {
  const items: CheckItem[] = [];
  let weak = 0;
  let reasonable = 0;
  let good = 0;
  let n = 0;
  const add = (category: string, label: string, status: CheckItem["status"], detail: string) => {
    n += 1;
    items.push({ id: String(n), category, label, status, detail });
    if (status === "weak") weak += 1;
    else if (status === "reasonable") reasonable += 1;
    else good += 1;
  };

  if (b.rating <= 0) {
    add("Avaliações", "Nota média", "weak", "Sem nota pública no resultado da API.");
  } else if (b.rating >= 4.5) {
    add("Avaliações", "Nota média", "good", `${b.rating.toFixed(1)} — acima de 4,5.`);
  } else if (b.rating >= 4.0) {
    add("Avaliações", "Nota média", "reasonable", `${b.rating.toFixed(1)} — razoável; há margem para subir.`);
  } else {
    add("Avaliações", "Nota média", "weak", `${b.rating.toFixed(1)} — abaixo do ideal para confiança local.`);
  }

  if (b.reviews_count >= 50) {
    add("Avaliações", "Volume de avaliações", "good", `${b.reviews_count} avaliações — volume sólido.`);
  } else if (b.reviews_count >= 10) {
    add(
      "Avaliações",
      "Volume de avaliações",
      "reasonable",
      `${b.reviews_count} avaliações — pode crescer com pedidos aos clientes.`,
    );
  } else if (b.reviews_count > 0) {
    add("Avaliações", "Volume de avaliações", "weak", `Apenas ${b.reviews_count} avaliações — pouca prova social.`);
  } else {
    add("Avaliações", "Volume de avaliações", "weak", "Sem contagem de avaliações no resultado.");
  }

  if (photoCount > 5) {
    add("Mídia", "Fotos", "good", `${photoCount} fotos identificadas no resultado.`);
  } else if (photoCount > 0) {
    add("Mídia", "Fotos", "reasonable", `${photoCount} foto(s); considere mais imagens do espaço e produtos.`);
  } else {
    add("Mídia", "Fotos", "weak", "Nenhuma foto listada no payload devolvido pela API.");
  }

  if (b.category !== "") {
    add("Perfil", "Categoria", "good", b.category);
  } else {
    add("Perfil", "Categoria", "weak", "Categoria não encontrada no resultado.");
  }

  if (b.description.length > 80) {
    add("Perfil", "Descrição", "good", "Descrição com texto substancial.");
  } else if (b.description !== "") {
    add("Perfil", "Descrição", "reasonable", "Descrição curta — pode expandir com palavras-chave locais.");
  } else {
    add("Perfil", "Descrição", "weak", "Sem descrição no resultado da API.");
  }

  if (b.hours_summary !== "") {
    add("Horário", "Horário de funcionamento", "good", b.hours_summary);
  } else {
    add("Horário", "Horário de funcionamento", "weak", "Horário não disponível ou não estruturado na resposta.");
  }

  if (b.phone !== "" && b.website !== "") {
    add("Contacto", "Telefone e site", "good", "Telefone e website presentes.");
  } else if (b.phone !== "" || b.website !== "") {
    add("Contacto", "Telefone e site", "reasonable", "Complete telefone e website se faltar um deles.");
  } else {
    add("Contacto", "Telefone e site", "weak", "Telefone e website ausentes no resultado.");
  }

  return { checklist: items, tier_counts: { weak, reasonable, good } };
}

async function fetchSerpAPI(params: URLSearchParams): Promise<Record<string, unknown>> {
  const key = getSerpApiKey();
  if (!key) {
    throw new Error(
      "SERPAPI_KEY ausente: configure a variável no projeto Vercel (Settings → Environment Variables).",
    );
  }
  params.set("api_key", key);
  const u = `${serpBase}?${params.toString()}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 50_000);
  const resp = await fetch(u, { signal: ctrl.signal });
  clearTimeout(t);
  const body = await resp.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(body) as Record<string, unknown>;
  } catch {
    throw new Error("JSON SerpAPI inválido");
  }
  if (!resp.ok) {
    throw new Error(`SerpAPI HTTP ${resp.status}: ${body.slice(0, 200)}`);
  }
  const errStr = data.error;
  if (typeof errStr === "string" && errStr !== "") {
    throw new Error(`SerpAPI: ${errStr}`);
  }
  return data;
}

function searchMaps(q: string) {
  const p = new URLSearchParams();
  p.set("engine", "google_maps");
  p.set("q", q);
  p.set("hl", "pt");
  p.set("gl", "br");
  return fetchSerpAPI(p);
}

function getPlaceDetails(placeID: string) {
  const p = new URLSearchParams();
  p.set("engine", "google_maps");
  p.set("place_id", placeID);
  p.set("hl", "pt");
  p.set("gl", "br");
  return fetchSerpAPI(p);
}

function getReviews(dataID: string) {
  const p = new URLSearchParams();
  p.set("engine", "google_maps_reviews");
  p.set("data_id", dataID);
  p.set("hl", "pt");
  p.set("gl", "br");
  return fetchSerpAPI(p);
}

function getPhotos(dataID: string) {
  const p = new URLSearchParams();
  p.set("engine", "google_maps_photos");
  p.set("data_id", dataID);
  return fetchSerpAPI(p);
}

async function analyzeBusinessOrError(query: string): Promise<BusinessAnalysis> {
  const q = query.trim();
  if (!q) throw new Error("query vazia");

  const search = await searchMaps(q);
  const lrRaw = search.local_results;
  if (lrRaw == null) {
    throw new Error("nenhum resultado local no Google Maps para esta pesquisa");
  }
  const lr = lrRaw as unknown;
  if (!Array.isArray(lr) || lr.length === 0) {
    throw new Error("lista de resultados vazia no Google Maps");
  }
  const first = lr[0];
  if (!first || typeof first !== "object") {
    throw new Error("formato inesperado de resultado local");
  }
  const fm = first as Record<string, unknown>;
  const placeID = typeof fm.place_id === "string" ? fm.place_id : "";
  if (!placeID) {
    throw new Error("place_id ausente no primeiro resultado — não é possível obter detalhes reais");
  }

  let pr: Record<string, unknown> = {};
  try {
    const placeResp = await getPlaceDetails(placeID);
    const mapped = placeResultMap(placeResp);
    if (mapped) pr = mapped;
  } catch {
    /* usar só resultado local */
  }

  const b = mergeBusiness(fm, pr);
  let dataID = typeof fm.data_id === "string" ? fm.data_id : "";
  if (!dataID && pr.data_id) dataID = String(pr.data_id);

  let photoURLs: string[] = [];
  if (dataID) {
    try {
      const ph = await getPhotos(dataID);
      photoURLs = extractPhotoURLs(ph);
    } catch {
      /* ignore */
    }
  }
  if (photoURLs.length === 0 && b.thumbnail) {
    photoURLs = [b.thumbnail];
  }

  let hasReviewsPayload = false;
  if (dataID) {
    try {
      const rev = await getReviews(dataID);
      const rr = rev.reviews;
      if (Array.isArray(rr) && rr.length > 0) hasReviewsPayload = true;
    } catch {
      /* ignore */
    }
  }

  const photoCount = photoURLs.length;
  const score = calculateScore({ ...b, photo_urls: photoURLs }, photoCount, hasReviewsPayload);
  const { checklist, tier_counts } = buildChecklist({ ...b, photo_urls: photoURLs }, photoCount);
  b.photo_urls = photoURLs;

  return {
    query: q,
    score,
    checklist,
    tier_counts,
    business: b,
    source: "serpapi",
  };
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

    const rawQ = req.query.query ?? req.query.q;
    const q = Array.isArray(rawQ) ? rawQ[0] : rawQ;
    const query = (q != null ? String(q) : "").trim();

    try {
      const analysis = await analyzeBusinessOrError(query);
      res.status(200).json(analysis);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno.";
      res.status(400).json({ error: msg });
    }
  } catch (fatal) {
    const msg = fatal instanceof Error ? fatal.message : String(fatal);
    console.error("[api/intellisearch/business]", fatal);
    if (!res.headersSent) {
      res.status(500).json({ error: msg });
    }
  }
}
