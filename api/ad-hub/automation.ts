/**
 * POST /api/ad-hub/automation — automações tipo Zapier (memória + logs).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendJson } from "../lib/sendJson";
import { withApiErrorBoundary } from "../lib/withApiErrorBoundary";
import { getGrowthActor, parseJsonBody } from "../lib/growthRequest";
import {
  getGrowthMemory,
  growthNewId,
  ingestLead,
  type AutomationAction,
  type AutomationTrigger,
} from "../lib/growthMemoryStore";

async function handler(req: VercelRequest, res: VercelResponse) {
  const actor = getGrowthActor(req);
  if (!actor) {
    sendJson(res, 401, { ok: false, error: "Cabecalhos X-Tenant-Slug e X-User-Key obrigatorios." });
    return;
  }

  const mem = getGrowthMemory();
  const body = parseJsonBody(req) as Record<string, unknown>;
  const action = String(body?.action ?? "list");

  if (req.method === "GET" || action === "list") {
    const rows = mem.automations.filter((a) => a.tenantSlug === actor.tenantSlug);
    const logs = mem.automationLogs
      .filter((l) => l.tenantSlug === actor.tenantSlug)
      .slice(-80)
      .reverse();
    sendJson(res, 200, { ok: true, automations: rows, logs });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  switch (action) {
    case "create": {
      const name = String(body?.name ?? "Automacao").trim();
      const trigger = String(body?.trigger ?? "lead_created") as AutomationTrigger;
      const act = String(body?.actionType ?? "webhook") as AutomationAction;
      const config = (body?.config as Record<string, unknown>) ?? {};
      const row = {
        id: growthNewId("auto"),
        tenantSlug: actor.tenantSlug,
        userKey: actor.userKey,
        name,
        enabled: true,
        trigger,
        action: act,
        config,
        createdAt: new Date().toISOString(),
      };
      mem.automations.push(row);
      sendJson(res, 200, { ok: true, automation: row });
      return;
    }
    case "delete": {
      const id = String(body?.id ?? "");
      mem.automations = mem.automations.filter((a) => !(a.id === id && a.tenantSlug === actor.tenantSlug));
      sendJson(res, 200, { ok: true });
      return;
    }
    case "toggle": {
      const id = String(body?.id ?? "");
      const a = mem.automations.find((x) => x.id === id && x.tenantSlug === actor.tenantSlug);
      if (!a) {
        sendJson(res, 404, { ok: false, error: "Nao encontrado." });
        return;
      }
      a.enabled = Boolean(body?.enabled ?? !a.enabled);
      sendJson(res, 200, { ok: true, automation: a });
      return;
    }
    case "run": {
      const id = String(body?.id ?? "");
      const a = mem.automations.find((x) => x.id === id && x.tenantSlug === actor.tenantSlug);
      if (!a) {
        sendJson(res, 404, { ok: false, error: "Nao encontrado." });
        return;
      }
      const log = {
        id: growthNewId("log"),
        automationId: a.id,
        tenantSlug: actor.tenantSlug,
        ok: true,
        message: `Execucao demo: ${a.action} para trigger ${a.trigger}`,
        payload: { webhookUrl: a.config.url, sheetsId: a.config.spreadsheetId },
        createdAt: new Date().toISOString(),
      };
      mem.automationLogs.push(log);

      if (a.action === "webhook" && typeof a.config.url === "string") {
        log.message = "Webhook: em producao, POST assinado para a URL configurada.";
      }
      if (a.trigger === "lead_created") {
        ingestLead(actor.tenantSlug, {
          source: "automation",
          name: "Lead (automacao demo)",
          email: `auto-${Date.now()}@exemplo.invalid`,
          meta: { automationId: a.id },
        });
      }

      sendJson(res, 200, { ok: true, log });
      return;
    }
    default:
      sendJson(res, 400, { ok: false, error: "Acao desconhecida." });
  }
}

export default withApiErrorBoundary(handler);
