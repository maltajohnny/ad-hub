/**
 * Cliente para rotas `/api/ad-hub/*` e `/api/public/booking` (tenant + utilizador via cabeçalhos).
 */

function growthHeaders(): HeadersInit {
  let tenant = "norter";
  let userKey = "";
  try {
    tenant = sessionStorage.getItem("norter_active_tenant_slug") ?? "norter";
    const raw = sessionStorage.getItem("norter_user");
    if (raw) {
      const u = JSON.parse(raw) as { username?: string };
      userKey = u.username ?? "";
    }
  } catch {
    /* ignore */
  }
  return {
    "Content-Type": "application/json",
    "X-Tenant-Slug": tenant,
    "X-User-Key": userKey,
  };
}

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export async function schedulingGet(): Promise<unknown> {
  const res = await fetch("/api/ad-hub/scheduling", { method: "GET", headers: growthHeaders() });
  return parseJson(res);
}

export async function schedulingPost(body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch("/api/ad-hub/scheduling", {
    method: "POST",
    headers: growthHeaders(),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function automationPost(body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch("/api/ad-hub/automation", {
    method: "POST",
    headers: growthHeaders(),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function automationGet(): Promise<unknown> {
  const res = await fetch("/api/ad-hub/automation", { method: "GET", headers: growthHeaders() });
  return parseJson(res);
}

export async function prospectingPost(body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch("/api/ad-hub/prospecting", {
    method: "POST",
    headers: growthHeaders(),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function domainIntelligencePost(domain: string): Promise<unknown> {
  const res = await fetch("/api/ad-hub/domain-intelligence", {
    method: "POST",
    headers: growthHeaders(),
    body: JSON.stringify({ domain }),
  });
  return parseJson(res);
}

export async function adsLibraryPost(query: string, searchType: "keyword" | "advertiser"): Promise<unknown> {
  const res = await fetch("/api/ad-hub/ads-library", {
    method: "POST",
    headers: growthHeaders(),
    body: JSON.stringify({ query, searchType }),
  });
  return parseJson(res);
}

export async function leadsGet(): Promise<unknown> {
  const res = await fetch("/api/ad-hub/leads", { method: "GET", headers: growthHeaders() });
  return parseJson(res);
}

export async function leadsPost(body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch("/api/ad-hub/leads", {
    method: "POST",
    headers: growthHeaders(),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function publicBookingGet(token: string, date?: string): Promise<unknown> {
  const q = new URLSearchParams({ token });
  if (date) q.set("date", date);
  const res = await fetch(`/api/public/booking?${q.toString()}`, { cache: "no-store" });
  return parseJson(res);
}

export async function publicBookingPost(payload: {
  token: string;
  start: string;
  guestName: string;
  guestEmail: string;
}): Promise<unknown> {
  const res = await fetch("/api/public/booking", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}
