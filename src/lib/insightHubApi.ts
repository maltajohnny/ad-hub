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

export type InsightHubConnection = {
  id: string;
  brandId: string;
  provider: string;
  externalAccountId?: string;
  displayLabel?: string;
  status: string;
  lastSyncedAt?: string | null;
  createdAt: string;
};

export type InsightHubOverview = {
  brandId: string;
  range: string;
  from: string;
  to: string;
  totals: Record<string, number>;
  series: {
    date: string;
    metricKey: string;
    value: number;
    connectionId?: string;
    provider?: string;
  }[];
  connectedProviders: string[];
};

export type InsightHubAggregateRow = {
  brandId: string;
  name: string;
  totals: Record<string, number>;
};

export type InsightHubAggregate = {
  range: string;
  from: string;
  to: string;
  keys: string[];
  rows: InsightHubAggregateRow[];
};

export type InsightHubPost = {
  id: string;
  brandId: string;
  provider: string;
  externalId: string;
  permalink?: string;
  message?: string;
  mediaType?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  publishedAt?: string;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  videoViews: number;
  engagement: number;
};

export type InsightHubReportRow = {
  id: string;
  brandId?: string;
  title: string;
  templateKey?: string;
  createdAt: string;
  updatedAt: string;
};

export type InsightHubScheduledReportRow = {
  id: string;
  reportId?: string;
  cronExpr: string;
  timezone: string;
  recipients: string[];
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  enabled: boolean;
  createdAt: string;
};

export type MetaPageOption = {
  id: string;
  name: string;
  category?: string;
  access_token?: string;
  instagramBusinessId?: string;
};

export type MetaAdAccountOption = {
  id: string;
  account_id: string;
  name?: string;
  currency?: string;
  account_status?: number;
};

export type GoogleAdsAccountOption = {
  id: string;
  name: string;
  manager: boolean;
  loginCustomerId: string;
  hint?: string;
};

function authHeaders(): HeadersInit {
  const t = getAdHubToken();
  const h: Record<string, string> = { Accept: "application/json" };
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

async function ihFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(adHubApiUrl(path), {
    cache: "no-store",
    credentials: "same-origin",
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let msg = "";
    try {
      const j = (await res.json()) as { error?: string };
      msg = typeof j.error === "string" ? j.error : "";
    } catch {
      /* ignore */
    }
    if (res.status === 404 && !msg) {
      msg =
        "Insight Hub (HTTP 404): atualize o binário Go **e** o ficheiro `public/api/ad-hub/proxy.php` no servidor (rewrite pode enviar o caminho errado ao Go). Faça deploy completo do `dist/` + API.";
    }
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchInsightHubBootstrap(): Promise<InsightHubBootstrap> {
  return ihFetch<InsightHubBootstrap>("/api/ad-hub/insight-hub/bootstrap");
}

export async function fetchInsightHubBrands(): Promise<InsightHubBrandRow[]> {
  const data = await ihFetch<{ brands?: InsightHubBrandRow[] }>("/api/ad-hub/insight-hub/brands");
  return data.brands ?? [];
}

export async function createInsightHubBrand(body: { name: string; email?: string }): Promise<{ id: string }> {
  return ihFetch<{ id: string }>("/api/ad-hub/insight-hub/brands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function fetchInsightHubConnections(brandId?: string): Promise<InsightHubConnection[]> {
  const qs = brandId ? `?brandId=${encodeURIComponent(brandId)}` : "";
  const data = await ihFetch<{ connections?: InsightHubConnection[] }>(
    `/api/ad-hub/insight-hub/connections${qs}`,
  );
  return data.connections ?? [];
}

export async function deleteInsightHubConnection(id: string): Promise<void> {
  await ihFetch<{ ok: boolean }>(`/api/ad-hub/insight-hub/connections/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export type ConnectionAvailable = {
  pages?: MetaPageOption[];
  adAccounts?: MetaAdAccountOption[];
  googleAdsAccounts?: GoogleAdsAccountOption[];
};
export async function fetchConnectionAvailable(id: string): Promise<ConnectionAvailable> {
  return ihFetch<ConnectionAvailable>(`/api/ad-hub/insight-hub/connections/${encodeURIComponent(id)}/available`);
}

export async function selectConnectionAccount(
  id: string,
  body: {
    externalAccountId: string;
    displayLabel: string;
    pageAccessToken?: string;
    loginCustomerId?: string;
  },
): Promise<{ ok: boolean }> {
  return ihFetch<{ ok: boolean }>(`/api/ad-hub/insight-hub/connections/${encodeURIComponent(id)}/select`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function startMetaAuthorize(body: {
  brandId: string;
  provider?: "facebook_insights" | "meta_ads" | "instagram";
  returnPath?: string;
  redirectUri?: string;
}): Promise<{ state: string; authorizeUrl: string }> {
  return ihFetch<{ state: string; authorizeUrl: string }>("/api/ad-hub/insight-hub/oauth/meta/authorize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function startGoogleAdsAuthorize(body: {
  brandId: string;
  returnPath?: string;
  redirectUri?: string;
}): Promise<{ state: string; authorizeUrl: string }> {
  return ihFetch<{ state: string; authorizeUrl: string }>("/api/ad-hub/insight-hub/oauth/google-ads/authorize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export type RangeLabel = "7d" | "14d" | "30d" | "90d" | "mtd" | "ytd";

export async function fetchInsightHubOverview(brandId: string, range: RangeLabel = "30d"): Promise<InsightHubOverview> {
  return ihFetch<InsightHubOverview>(
    `/api/ad-hub/insight-hub/overview?brandId=${encodeURIComponent(brandId)}&range=${encodeURIComponent(range)}`,
  );
}

export async function fetchInsightHubAggregate(range: RangeLabel = "30d", keys?: string[]): Promise<InsightHubAggregate> {
  const params = new URLSearchParams({ range });
  if (keys && keys.length) params.set("keys", keys.join(","));
  return ihFetch<InsightHubAggregate>(`/api/ad-hub/insight-hub/aggregate/accounts?${params.toString()}`);
}

export type PostsListResp = {
  brandId: string;
  range: string;
  from: string;
  to: string;
  posts: InsightHubPost[];
  total: number;
};

export async function fetchInsightHubPosts(
  brandId: string,
  opts: { range?: RangeLabel; sortBy?: string; sortDir?: "asc" | "desc"; limit?: number; offset?: number } = {},
): Promise<PostsListResp> {
  const params = new URLSearchParams({ brandId, range: opts.range ?? "30d" });
  if (opts.sortBy) params.set("sortBy", opts.sortBy);
  if (opts.sortDir) params.set("sortDir", opts.sortDir);
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.offset) params.set("offset", String(opts.offset));
  return ihFetch<PostsListResp>(`/api/ad-hub/insight-hub/posts?${params.toString()}`);
}

export async function fetchInsightHubReports(brandId?: string): Promise<InsightHubReportRow[]> {
  const qs = brandId ? `?brandId=${encodeURIComponent(brandId)}` : "";
  const data = await ihFetch<{ reports?: InsightHubReportRow[] }>(`/api/ad-hub/insight-hub/reports${qs}`);
  return data.reports ?? [];
}

export async function createInsightHubReport(body: {
  brandId?: string;
  title: string;
  definition?: Record<string, unknown>;
  templateKey?: string;
}): Promise<{ id: string }> {
  return ihFetch<{ id: string }>("/api/ad-hub/insight-hub/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteInsightHubReport(id: string): Promise<void> {
  await ihFetch<{ ok: boolean }>(`/api/ad-hub/insight-hub/reports/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchInsightHubScheduledReports(): Promise<InsightHubScheduledReportRow[]> {
  const data = await ihFetch<{ schedules?: InsightHubScheduledReportRow[] }>(
    "/api/ad-hub/insight-hub/scheduled-reports",
  );
  return data.schedules ?? [];
}

export async function createInsightHubScheduledReport(body: {
  reportId?: string;
  cronExpr: string;
  timezone?: string;
  recipients: string[];
  enabled: boolean;
}): Promise<{ id: string }> {
  return ihFetch<{ id: string }>("/api/ad-hub/insight-hub/scheduled-reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export type BillingInvoiceRow = {
  id: string;
  description: string;
  amountCents: number;
  currency: string;
  status: string;
  dueAt?: string | null;
  paidAt?: string | null;
  invoiceUrl?: string;
  createdAt: string;
};

export async function fetchAdHubInvoices(): Promise<{ invoices: BillingInvoiceRow[]; pendingCount: number }> {
  return ihFetch<{ invoices: BillingInvoiceRow[]; pendingCount: number }>("/api/ad-hub/auth/billing/invoices");
}
