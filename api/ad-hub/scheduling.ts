/**
 * POST /api/ad-hub/scheduling — configuração e reservas (multi-tenant via cabeçalhos).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendJson } from "../lib/sendJson";
import { withApiErrorBoundary } from "../lib/withApiErrorBoundary";
import { getGrowthActor, parseJsonBody } from "../lib/growthRequest";
import {
  ensureSchedulingProfile,
  getGrowthMemory,
  growthProfileKey,
  rotatePublicToken,
  type DayAvailability,
} from "../lib/growthMemoryStore";
import { slotsForDate } from "../lib/schedulingSlots";

async function handler(req: VercelRequest, res: VercelResponse) {
  const actor = getGrowthActor(req);
  if (!actor) {
    sendJson(res, 401, { ok: false, error: "Cabecalhos X-Tenant-Slug e X-User-Key obrigatorios." });
    return;
  }

  const mem = getGrowthMemory();
  const body = parseJsonBody(req) as Record<string, unknown>;
  const action = String(
    body?.action ?? (typeof req.query?.action === "string" ? req.query.action : "") ?? (req.method === "GET" ? "get" : ""),
  );

  if (req.method === "GET" || action === "get" || action === "") {
    const displayName = String(body?.displayName ?? (typeof req.query?.displayName === "string" ? req.query.displayName : ""));
    const p = ensureSchedulingProfile(
      actor.tenantSlug,
      actor.userKey,
      displayName || actor.userKey,
    );
    if (displayName) {
      const updated = { ...p, displayName };
      mem.schedulingProfiles.set(growthProfileKey(actor.tenantSlug, actor.userKey), updated);
    }
    const finalP = mem.schedulingProfiles.get(growthProfileKey(actor.tenantSlug, actor.userKey))!;
    const bookings = mem.bookings.filter(
      (b) => b.tenantSlug === actor.tenantSlug && b.ownerUserKey === actor.userKey,
    );
    sendJson(res, 200, {
      ok: true,
      profile: {
        slotMinutes: finalP.slotMinutes,
        availability: finalP.availability,
        publicToken: finalP.publicToken,
        googleCalendarConnected: finalP.googleCalendarConnected,
        displayName: finalP.displayName,
        publicPath: `/book/${finalP.publicToken}`,
      },
      bookings: bookings.slice(-50).reverse(),
    });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  switch (action) {
    case "saveAvailability": {
      const slotMinutes = Number(body?.slotMinutes ?? 30);
      const availability = body?.availability as DayAvailability[] | undefined;
      const p = ensureSchedulingProfile(actor.tenantSlug, actor.userKey, String(body?.displayName ?? actor.userKey));
      const next = {
        ...p,
        slotMinutes: Number.isFinite(slotMinutes) ? Math.min(120, Math.max(15, slotMinutes)) : 30,
        availability: Array.isArray(availability) && availability.length ? availability : p.availability,
        displayName: String(body?.displayName ?? p.displayName),
      };
      mem.schedulingProfiles.set(growthProfileKey(actor.tenantSlug, actor.userKey), next);
      sendJson(res, 200, { ok: true, profile: next });
      return;
    }
    case "rotateLink": {
      const p = rotatePublicToken(actor.tenantSlug, actor.userKey);
      sendJson(res, 200, { ok: true, publicToken: p.publicToken, publicPath: `/book/${p.publicToken}` });
      return;
    }
    case "slots": {
      const date = String(body?.date ?? "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        sendJson(res, 400, { ok: false, error: "Data invalida (YYYY-MM-DD)." });
        return;
      }
      const p = ensureSchedulingProfile(actor.tenantSlug, actor.userKey, actor.userKey);
      const bookings = mem.bookings.filter(
        (b) => b.tenantSlug === actor.tenantSlug && b.ownerUserKey === actor.userKey,
      );
      const slots = slotsForDate(p, date, bookings);
      sendJson(res, 200, { ok: true, date, slots });
      return;
    }
    case "connectGoogle": {
      const p = ensureSchedulingProfile(actor.tenantSlug, actor.userKey, actor.userKey);
      const next = { ...p, googleCalendarConnected: true };
      mem.schedulingProfiles.set(growthProfileKey(actor.tenantSlug, actor.userKey), next);
      sendJson(res, 200, {
        ok: true,
        googleCalendarConnected: true,
        message:
          "Modo demo: flag ativada. Em producao, ligue OAuth Google Calendar e sincronize eventos.",
      });
      return;
    }
    default:
      sendJson(res, 400, { ok: false, error: "Acao desconhecida." });
  }
}

export default withApiErrorBoundary(handler);
