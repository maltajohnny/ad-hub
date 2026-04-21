import type { VercelRequest } from "@vercel/node";

export type GrowthActor = {
  tenantSlug: string;
  userKey: string;
};

export function parseJsonBody(req: VercelRequest): unknown {
  if (req.body == null) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

/** Cabeçalhos enviados pelo cliente (`growthHubApi`). Sem JWT no serverless: alinhar a produção ao validar token. */
export function getGrowthActor(req: VercelRequest): GrowthActor | null {
  const h = req.headers;
  const rawTs = h["x-tenant-slug"] ?? h["X-Tenant-Slug"];
  const rawUk = h["x-user-key"] ?? h["X-User-Key"];
  const tenantSlug = typeof rawTs === "string" ? rawTs.trim() : "";
  const userKey = typeof rawUk === "string" ? rawUk.trim() : "";
  if (!tenantSlug || !userKey) return null;
  return { tenantSlug, userKey };
}
