import { getAdHubToken } from "@/lib/adhubAuthApi";

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
  const res = await fetch("/api/ad-hub/insight-hub/bootstrap", {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.error === "string" ? err.error : `HTTP ${res.status}`);
  }
  return (await res.json()) as InsightHubBootstrap;
}

export async function fetchInsightHubBrands(): Promise<InsightHubBrandRow[]> {
  const res = await fetch("/api/ad-hub/insight-hub/brands", {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.error === "string" ? err.error : `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { brands?: InsightHubBrandRow[] };
  return data.brands ?? [];
}

export async function createInsightHubBrand(body: { name: string; email?: string }): Promise<{ id: string }> {
  const res = await fetch("/api/ad-hub/insight-hub/brands", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `HTTP ${res.status}`);
  }
  return data as { id: string };
}
