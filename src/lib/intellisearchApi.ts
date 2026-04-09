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

/**
 * Base da API IntelliSearch (sem barra final).
 * 1) `VITE_INTELLISEARCH_API_URL` no build (outro domínio / CDN).
 * 2) Produção `ad-hub.digital` / `www.ad-hub.digital` sem env: mesmo origin (`/api/...`) — o deploy inclui
 *    `public/api/intellisearch/proxy.php` + `.htaccess` que encaminha para o Go em 127.0.0.1 (PORT do .env em minha-api).
 */
function getIntelliSearchApiPrefix(): string {
  const fromEnv = (import.meta.env.VITE_INTELLISEARCH_API_URL ?? "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (!import.meta.env.PROD || typeof window === "undefined") return "";
  const h = window.location.hostname;
  if (h === "ad-hub.digital" || h === "www.ad-hub.digital") {
    return "";
  }
  return "";
}

function buildApiUrl(pathWithQuery: string): string {
  const prefix = getIntelliSearchApiPrefix();
  if (!prefix) return pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`;
  return `${prefix}${pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`}`;
}

export async function fetchBusinessAnalysis(query: string): Promise<BusinessAnalysis> {
  const q = query.trim();
  if (!q) {
    throw new Error("Indique um termo de pesquisa.");
  }
  const url = buildApiUrl(`/api/intellisearch/business?${new URLSearchParams({ query: q })}`);
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(
      "Resposta vazia do servidor. Em desenvolvimento, inicie a API (npm run intellisearch-api) na porta 3042 para o proxy funcionar.",
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const html = trimmed.startsWith("<!") || trimmed.toLowerCase().includes("<html");
    const preview = trimmed.replace(/\s+/g, " ").slice(0, 140);
    const prefix = getIntelliSearchApiPrefix();
    const pingUrl = `${prefix || `${typeof window !== "undefined" ? window.location.origin : ""}`}/api/intellisearch/ping`;
    const prodHint = html
      ? prefix
        ? " Confirme o URL de ping abaixo (JSON). Verifique SSL e se o binário Go está a correr."
        : " Faça deploy do `dist/` com `api/intellisearch/proxy.php`, `.htaccess` nessa pasta e `.htaccess` na raiz; mantenha o Go em ~/apps/minha-api a correr (PORT predef. no proxy: 3042 — alinhe com o seu .env)."
      : "";
    throw new Error(
      html
        ? `Resposta inválida (HTTP ${res.status}): o servidor devolveu HTML em vez de JSON. Teste no browser: ${pingUrl} (JSON com ok:true).${prodHint}`
        : `Resposta inválida (HTTP ${res.status}): ${preview}${trimmed.length > 140 ? "…" : ""}`,
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

export type OrganicRankResponse = {
  ok: boolean;
  demo?: boolean;
  message?: string;
  keyword: string;
  domain: string;
  position: number | null;
  checked: number;
};

export async function fetchOrganicRank(keyword: string, domain: string): Promise<OrganicRankResponse> {
  const k = keyword.trim();
  const d = domain.trim();
  if (!k || !d) {
    throw new Error("Indique palavra-chave e domínio.");
  }
  const url = buildApiUrl(`/api/intellisearch/ranking?${new URLSearchParams({ keyword: k, domain: d })}`);
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Resposta vazia do servidor de ranking.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(`Resposta inválida (HTTP ${res.status}).`);
  }
  const json = parsed as OrganicRankResponse & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Erro ${res.status}`);
  }
  if (json.error) {
    throw new Error(String(json.error));
  }
  return json as OrganicRankResponse;
}
