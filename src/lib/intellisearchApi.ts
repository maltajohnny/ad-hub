/** Resposta do backend Go (SerpAPI) — sem dados inventados no servidor. */

export type CheckItem = {
  id: string;
  category: string;
  label: string;
  status: "good" | "reasonable" | "weak";
  detail: string;
};

export type TierCounts = {
  weak: number;
  reasonable: number;
  good: number;
};

export type BusinessCard = {
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

export type BusinessAnalysis = {
  query: string;
  score: number;
  checklist: CheckItem[];
  tier_counts: TierCounts;
  business: BusinessCard;
  source: string;
};

const apiPrefix = import.meta.env.VITE_INTELLISEARCH_API_URL ?? "";

export async function fetchBusinessAnalysis(query: string): Promise<BusinessAnalysis> {
  const q = query.trim();
  if (!q) {
    throw new Error("Indique um termo de pesquisa.");
  }
  const url = `${apiPrefix}/api/intellisearch/business?${new URLSearchParams({ query: q })}`;
  const res = await fetch(url);
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(
      "Resposta vazia do servidor. Em desenvolvimento, inicie a API (npm run intellisearch-api) na porta 3041 para o proxy funcionar.",
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(
      `Resposta inválida (HTTP ${res.status}). Verifique se a API IntelliSearch está ativa e devolve JSON.`,
    );
  }
  const json = parsed as BusinessAnalysis & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Erro ${res.status}`);
  }
  if (json.error) {
    throw new Error(json.error);
  }
  return json as BusinessAnalysis;
}
