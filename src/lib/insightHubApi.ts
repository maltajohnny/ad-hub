import { adHubApiUrl, getAdHubToken } from "@/lib/adhubAuthApi";

export type InsightHubBootstrapActive = {
  active: true;
  tier: string;
  limits: {
    maxBrands: number;
    maxDashboards: number;
    maxGuestUsers: number;
    maxScheduledReports: number;
    aiAnalysis: boolean;
    competitorAnalysis: boolean;
    groupReports: boolean;
    clientPortal: boolean;
  };
  usage: {
    brands: number;
    dashboards: number;
  };
  workspace?: {
    agencyName?: string;
    portalSlug?: string;
  };
};

export type InsightHubBootstrapInactive = {
  active: false;
  reason?: string;
  status?: string;
};

export type InsightHubBootstrap = InsightHubBootstrapActive | InsightHubBootstrapInactive;

export type InsightHubBrandRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  logoUrl?: string | null;
  createdAt: string;
};

function authHeaders(): HeadersInit {
  const t = getAdHubToken();
  const h: Record<string, string> = { Accept: "application/json" };
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

export async function fetchInsightHubBootstrap(): Promise<InsightHubBootstrap> {
  const res = await fetch(adHubApiUrl("/api/ad-hub/insight-hub/bootstrap"), {
    headers: authHeaders(),
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = typeof err.error === "string" ? err.error : "";
    if (res.status === 404) {
      throw new Error(
        msg ||
          "Rota Insight Hub não encontrada (HTTP 404). Em produção: faça deploy da API Go com as rotas /api/ad-hub/insight-hub e reinicie o binário no servidor.",
      );
    }
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return (await res.json()) as InsightHubBootstrap;
}

export async function fetchInsightHubBrands(): Promise<InsightHubBrandRow[]> {
  const res = await fetch(adHubApiUrl("/api/ad-hub/insight-hub/brands"), {
    headers: authHeaders(),
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.error === "string" ? err.error : `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { brands?: InsightHubBrandRow[] };
  return data.brands ?? [];
}

export async function createInsightHubBrand(body: { name: string; email?: string }): Promise<{ id: string }> {
  const res = await fetch(adHubApiUrl("/api/ad-hub/insight-hub/brands"), {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `HTTP ${res.status}`);
  }
  return data as { id: string };
}
