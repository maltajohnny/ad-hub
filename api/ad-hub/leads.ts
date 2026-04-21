/**
 * GET/POST /api/ad-hub/leads — pipeline central de leads (memória).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendJson } from "../lib/sendJson";
import { withApiErrorBoundary } from "../lib/withApiErrorBoundary";
import { getGrowthActor, parseJsonBody } from "../lib/growthRequest";
import { getGrowthMemory, ingestLead, type LeadRecord } from "../lib/growthMemoryStore";

function aggregate(leads: LeadRecord[]) {
  const bySource: Record<string, number> = {};
  for (const l of leads) {
    bySource[l.source] = (bySource[l.source] ?? 0) + 1;
  }
  const organic = (bySource.organic ?? 0) + (bySource.form ?? 0);
  const paid = (bySource.paid ?? 0) + (bySource.campaign ?? 0);
  const prospecting = (bySource.prospecting ?? 0) + (bySource.scheduling ?? 0) + (bySource.automation ?? 0);
  return { bySource, buckets: { organic, paid, prospecting } };
}

async function handler(req: VercelRequest, res: VercelResponse) {
  const actor = getGrowthActor(req);
  if (!actor) {
    sendJson(res, 401, { ok: false, error: "Cabecalhos X-Tenant-Slug e X-User-Key obrigatorios." });
    return;
  }

  const mem = getGrowthMemory();

  if (req.method === "GET") {
    const leads = mem.leads.filter((l) => l.tenantSlug === actor.tenantSlug).slice(-500).reverse();
    sendJson(res, 200, { ok: true, leads, stats: aggregate(leads) });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  const body = parseJsonBody(req) as Record<string, unknown>;
  const action = String(body?.action ?? "ingest");

  if (action === "ingest") {
    const name = String(body?.name ?? "").trim();
    const email = String(body?.email ?? "").trim();
    const source = String(body?.source ?? "other") as LeadRecord["source"];
    if (!name || !email) {
      sendJson(res, 400, { ok: false, error: "name e email obrigatorios." });
      return;
    }
    const row = ingestLead(actor.tenantSlug, {
      source,
      name,
      email,
      meta: (body?.meta as Record<string, unknown>) ?? {},
    });
    sendJson(res, 200, { ok: true, lead: row });
    return;
  }

  if (action === "seedDemo") {
    const samples: Omit<LeadRecord, "id" | "tenantSlug" | "createdAt">[] = [
      { source: "organic", name: "Lead Orgânico 1", email: "org1@exemplo.invalid" },
      { source: "paid", name: "Lead Pago 1", email: "ads1@exemplo.invalid" },
      { source: "prospecting", name: "Prospecção 1", email: "pro1@exemplo.invalid" },
    ];
    const created = samples.map((s) => ingestLead(actor.tenantSlug, s));
    sendJson(res, 200, { ok: true, leads: created });
    return;
  }

  sendJson(res, 400, { ok: false, error: "Acao desconhecida." });
}

export default withApiErrorBoundary(handler);
