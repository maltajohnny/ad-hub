/**
 * GET/POST /api/public/booking — agendamento publico (token na query ou corpo).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendJson } from "../lib/sendJson";
import { withApiErrorBoundary } from "../lib/withApiErrorBoundary";
import { parseJsonBody } from "../lib/growthRequest";
import { ensureSchedulingProfile, getGrowthMemory, growthNewId, ingestLead } from "../lib/growthMemoryStore";
import { slotsForDate } from "../lib/schedulingSlots";

async function handler(req: VercelRequest, res: VercelResponse) {
  const mem = getGrowthMemory();

  if (req.method === "GET") {
    const token = String(req.query?.token ?? "").trim();
    const date = String(req.query?.date ?? "").slice(0, 10);
    if (!token) {
      sendJson(res, 400, { ok: false, error: "token obrigatorio" });
      return;
    }
    const owner = mem.publicTokenToOwner.get(token);
    if (!owner) {
      sendJson(res, 404, { ok: false, error: "Link invalido ou expirado." });
      return;
    }
    const profile = ensureSchedulingProfile(owner.tenantSlug, owner.userKey, owner.userKey);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      sendJson(res, 200, {
        ok: true,
        displayName: profile.displayName,
        slotMinutes: profile.slotMinutes,
        message: "Escolha uma data para ver horarios.",
      });
      return;
    }
    const bookings = mem.bookings.filter(
      (b) => b.tenantSlug === owner.tenantSlug && b.ownerUserKey === owner.userKey,
    );
    const slots = slotsForDate(profile, date, bookings);
    sendJson(res, 200, {
      ok: true,
      displayName: profile.displayName,
      slotMinutes: profile.slotMinutes,
      date,
      slots,
    });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  const body = parseJsonBody(req) as Record<string, unknown>;
  const token = String(body?.token ?? "").trim();
  const start = String(body?.start ?? "");
  const guestName = String(body?.guestName ?? "").trim();
  const guestEmail = String(body?.guestEmail ?? "").trim();
  if (!token || !start || !guestName || !guestEmail) {
    sendJson(res, 400, { ok: false, error: "token, start, guestName e guestEmail sao obrigatorios." });
    return;
  }
  const owner = mem.publicTokenToOwner.get(token);
  if (!owner) {
    sendJson(res, 404, { ok: false, error: "Link invalido." });
    return;
  }
  const profile = ensureSchedulingProfile(owner.tenantSlug, owner.userKey, owner.userKey);
  const startMs = Date.parse(start);
  if (!Number.isFinite(startMs)) {
    sendJson(res, 400, { ok: false, error: "Horario invalido." });
    return;
  }
  const endMs = startMs + profile.slotMinutes * 60 * 1000;
  const bookings = mem.bookings.filter(
    (b) => b.tenantSlug === owner.tenantSlug && b.ownerUserKey === owner.userKey,
  );
  const dateIso = start.slice(0, 10);
  const valid = slotsForDate(profile, dateIso, bookings).some((s) => s.start === start);
  if (!valid) {
    sendJson(res, 409, { ok: false, error: "Horario ja ocupado ou indisponivel." });
    return;
  }

  const booking = {
    id: growthNewId("bk"),
    tenantSlug: owner.tenantSlug,
    ownerUserKey: owner.userKey,
    start,
    end: new Date(endMs).toISOString(),
    guestName,
    guestEmail,
    createdAt: new Date().toISOString(),
  };
  mem.bookings.push(booking);

  ingestLead(owner.tenantSlug, {
    source: "scheduling",
    name: guestName,
    email: guestEmail,
    meta: { bookingId: booking.id, start },
  });

  sendJson(res, 200, {
    ok: true,
    booking,
    notifications: {
      email: "Pendente: configure SENDGRID_API_KEY ou SMTP na Vercel para envio real.",
      whatsapp: "Pendente: Twilio ou Meta WhatsApp API.",
    },
  });
}

export default withApiErrorBoundary(handler);
