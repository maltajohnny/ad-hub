import type { ManagedAdAccountRef } from "@/lib/mediaManagementStore";

const apiBase = () => (import.meta.env.VITE_ADHUB_API_URL ?? "").replace(/\/$/, "");

function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${apiBase()}${p}`;
}

function internalHeaders(): Record<string, string> {
  const k = import.meta.env.VITE_ADHUB_INTERNAL_API_KEY?.trim();
  if (!k) return {};
  return { "X-AdHub-Internal-Key": k };
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

export async function exchangeMetaOAuthCode(code: string, redirectUri: string): Promise<{ access_token: string }> {
  const res = await fetch(apiUrl("/api/ad-platform/meta/oauth/token"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  });
  const data = (await parseJson(res)) as { error?: string; access_token?: string };
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : `Meta token HTTP ${res.status}`);
  }
  if (!data.access_token) {
    throw new Error("Resposta Meta sem access_token");
  }
  return { access_token: data.access_token };
}

export async function fetchMetaAdAccounts(accessToken: string): Promise<ManagedAdAccountRef[]> {
  const res = await fetch(apiUrl("/api/ad-platform/meta/adaccounts"), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await parseJson(res)) as { error?: string; data?: { account_id?: string; name?: string }[] };
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : `Meta adaccounts HTTP ${res.status}`);
  }
  const rows = data.data ?? [];
  return rows.map((r) => {
    const id = String(r.account_id ?? "");
    const externalId = id.startsWith("act_") ? id : `act_${id}`;
    return { externalId, name: r.name?.trim() || externalId };
  });
}

export type MetaInsightsSummary = {
  total_spend: number;
  conversions: number;
  cpa: number;
  roi: number;
  currency: string;
  synced_at: string;
};

export async function fetchMetaInsightsSummary(accessToken: string, adAccountId: string): Promise<MetaInsightsSummary> {
  const q = new URLSearchParams({ ad_account_id: adAccountId });
  const res = await fetch(`${apiUrl("/api/ad-platform/meta/insights")}?${q}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await parseJson(res)) as MetaInsightsSummary & { error?: string };
  if (!res.ok) {
    const msg = typeof data?.error === "string" ? data.error : `Meta insights HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function exchangeTikTokOAuthCode(authCode: string): Promise<{ access_token: string }> {
  const res = await fetch(apiUrl("/api/ad-platform/tiktok/oauth/token"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ auth_code: authCode }),
  });
  const data = (await parseJson(res)) as { error?: string; access_token?: string };
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : `TikTok token HTTP ${res.status}`);
  }
  if (!data.access_token) {
    throw new Error("Resposta TikTok sem access_token");
  }
  return { access_token: data.access_token };
}

export async function fetchTikTokAdvertisers(accessToken: string): Promise<ManagedAdAccountRef[]> {
  const res = await fetch(apiUrl("/api/ad-platform/tiktok/advertisers"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Access-Token": accessToken,
    },
    body: "{}",
  });
  const raw = (await parseJson(res)) as {
    error?: string;
    message?: string;
    code?: number;
    data?: { list?: { advertiser_id?: string; advertiser_name?: string }[] };
  };
  if (!res.ok) {
    throw new Error(typeof raw?.error === "string" ? raw.error : `TikTok advertisers HTTP ${res.status}`);
  }
  if (raw.code != null && raw.code !== 0) {
    throw new Error(raw.message ?? raw.error ?? `TikTok code ${raw.code}`);
  }
  const list = raw.data?.list ?? [];
  return list.map((x) => ({
    externalId: String(x.advertiser_id ?? ""),
    name: x.advertiser_name?.trim() || String(x.advertiser_id ?? ""),
  })).filter((x) => x.externalId.length > 0);
}

export type TikTokReportSummary = {
  total_spend: number;
  conversions: number;
  cpa: number;
  roi: number;
  currency: string;
  synced_at: string;
};

export async function fetchTikTokBasicReport(accessToken: string, advertiserId: string): Promise<TikTokReportSummary> {
  const res = await fetch(apiUrl("/api/ad-platform/tiktok/report/basic"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Access-Token": accessToken,
    },
    body: JSON.stringify({ advertiser_id: advertiserId }),
  });
  const data = (await parseJson(res)) as TikTokReportSummary & { error?: string; partial?: boolean };
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : `TikTok report HTTP ${res.status}`);
  }
  return data;
}

/** Resposta 503 = MySQL não configurado → usar fluxo só no browser. */
export async function persistMetaOAuthFinish(input: {
  code: string;
  redirect_uri: string;
  org_id: string;
  media_client_id: string;
  platform: string;
}): Promise<{ storage: "server"; accounts: ManagedAdAccountRef[] } | { storage: "browser" }> {
  const res = await fetch(apiUrl("/api/ad-platform/persist/meta/oauth/finish"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...internalHeaders() },
    body: JSON.stringify(input),
  });
  if (res.status === 503) {
    return { storage: "browser" };
  }
  const data = (await parseJson(res)) as { error?: string; ad_accounts?: { external_id?: string; name?: string }[] };
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : `persist meta HTTP ${res.status}`);
  }
  const list = data.ad_accounts ?? [];
  return {
    storage: "server",
    accounts: list.map((a) => ({
      externalId: String(a.external_id ?? ""),
      name: (a.name ?? a.external_id ?? "").trim() || String(a.external_id ?? ""),
    })).filter((a) => a.externalId.length > 0),
  };
}

export async function persistTikTokOAuthFinish(input: {
  auth_code: string;
  org_id: string;
  media_client_id: string;
}): Promise<{ storage: "server"; accounts: ManagedAdAccountRef[] } | { storage: "browser" }> {
  const res = await fetch(apiUrl("/api/ad-platform/persist/tiktok/oauth/finish"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...internalHeaders() },
    body: JSON.stringify(input),
  });
  if (res.status === 503) {
    return { storage: "browser" };
  }
  const data = (await parseJson(res)) as { error?: string; ad_accounts?: { external_id?: string; name?: string }[] };
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : `persist tiktok HTTP ${res.status}`);
  }
  const list = data.ad_accounts ?? [];
  return {
    storage: "server",
    accounts: list.map((a) => ({
      externalId: String(a.external_id ?? ""),
      name: (a.name ?? a.external_id ?? "").trim() || String(a.external_id ?? ""),
    })).filter((a) => a.externalId.length > 0),
  };
}

export type PersistMetricsPayload = {
  total_spend: number;
  roi: number;
  cpa: number;
  currency: string;
  synced_at: string;
};

export async function persistLinkAndSync(input: {
  org_id: string;
  media_client_id: string;
  platform: string;
  external_account_id: string;
  external_account_label?: string;
}): Promise<{ metrics: PersistMetricsPayload }> {
  const res = await fetch(apiUrl("/api/ad-platform/persist/link-and-sync"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...internalHeaders() },
    body: JSON.stringify(input),
  });
  const data = (await parseJson(res)) as { error?: string; metrics?: PersistMetricsPayload };
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : `link-and-sync HTTP ${res.status}`);
  }
  if (!data.metrics) {
    throw new Error("Resposta sem métricas");
  }
  return { metrics: data.metrics };
}

/** Agrega todas as plataformas com token na base (útil para o card único). */
export async function refreshPersistedClientMetrics(
  org_id: string,
  media_client_id: string,
): Promise<PersistMetricsPayload> {
  const res = await fetch(apiUrl("/api/ad-platform/persist/metrics/refresh-client"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...internalHeaders() },
    body: JSON.stringify({ org_id, media_client_id }),
  });
  const data = (await parseJson(res)) as { error?: string; metrics?: PersistMetricsPayload };
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : `refresh-client HTTP ${res.status}`);
  }
  if (!data.metrics) {
    throw new Error("Resposta sem métricas");
  }
  return data.metrics;
}
