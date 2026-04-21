/**
 * POST /api/ad-hub/prospecting — Hunter/Clearbit (env), Maps, Instagram (demo controlada).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendJson } from "../lib/sendJson";
import { withApiErrorBoundary } from "../lib/withApiErrorBoundary";
import { getGrowthActor, parseJsonBody } from "../lib/growthRequest";
import { getGrowthMemory, growthNewId, ingestLead } from "../lib/growthMemoryStore";
import { getGooglePlacesKey, getHunterApiKey } from "../lib/growthEnv";

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

async function handler(req: VercelRequest, res: VercelResponse) {
  const actor = getGrowthActor(req);
  if (!actor) {
    sendJson(res, 401, { ok: false, error: "Cabecalhos X-Tenant-Slug e X-User-Key obrigatorios." });
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  const mem = getGrowthMemory();
  const body = parseJsonBody(req) as Record<string, unknown>;
  const action = String(body?.action ?? "");

  switch (action) {
    case "domainEmails": {
      const domain = String(body?.domain ?? "")
        .trim()
        .replace(/^https?:\/\//, "")
        .split("/")[0];
      if (!domain) {
        sendJson(res, 400, { ok: false, error: "Dominio obrigatorio." });
        return;
      }

      const key = getHunterApiKey();
      if (key) {
        try {
          const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${encodeURIComponent(key)}`;
          const r = await fetch(url);
          const data = (await r.json()) as {
            data?: { emails?: Array<{ value: string; first_name?: string; last_name?: string; position?: string }> };
          };
          const emails = data.data?.emails ?? [];
          const prospects = emails.slice(0, 25).map((e) => ({
            id: growthNewId("pro"),
            tenantSlug: actor.tenantSlug,
            listId: null as string | null,
            name: [e.first_name, e.last_name].filter(Boolean).join(" ") || e.value.split("@")[0],
            title: e.position ?? "—",
            email: e.value,
            domain,
            source: "hunter",
            createdAt: new Date().toISOString(),
          }));
          for (const p of prospects) mem.prospects.push(p);
          sendJson(res, 200, { ok: true, demo: false, prospects });
          return;
        } catch {
          /* fallthrough demo */
        }
      }

      const seed = hashSeed(domain);
      const demo = [0, 1, 2, 3, 4].map((i) => ({
        id: growthNewId("pro"),
        tenantSlug: actor.tenantSlug,
        listId: null as string | null,
        name: `Contacto ${i + 1} (${domain.split(".")[0]})`,
        title: ["Marketing", "CEO", "Growth", "Comercial", "Ops"][i],
        email: `pessoa${i + 1}@${domain}`,
        domain,
        source: "demo",
        createdAt: new Date().toISOString(),
      }));
      for (const p of demo) mem.prospects.push(p);
      sendJson(res, 200, {
        ok: true,
        demo: true,
        message: "Configure HUNTER_API_KEY na Vercel para emails reais.",
        prospects: demo,
      });
      return;
    }

    case "createList": {
      const name = String(body?.name ?? "Lista").trim();
      const list = {
        id: growthNewId("list"),
        tenantSlug: actor.tenantSlug,
        name,
        createdAt: new Date().toISOString(),
      };
      mem.prospectLists.push(list);
      sendJson(res, 200, { ok: true, list });
      return;
    }

    case "lists": {
      const lists = mem.prospectLists.filter((l) => l.tenantSlug === actor.tenantSlug);
      const prospects = mem.prospects.filter((p) => p.tenantSlug === actor.tenantSlug).slice(-200);
      sendJson(res, 200, { ok: true, lists, prospects });
      return;
    }

    case "mapsPlaces": {
      const query = String(body?.query ?? "marketing digital").trim();
      const location = String(body?.location ?? "Sao Paulo").trim();
      const gKey = getGooglePlacesKey();
      if (gKey) {
        try {
          const find = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(`${query} ${location}`)}&key=${encodeURIComponent(gKey)}`;
          const r = await fetch(find);
          const data = (await r.json()) as {
            results?: Array<{ name?: string; formatted_address?: string; place_id?: string }>;
          };
          const results = (data.results ?? []).slice(0, 15).map((x) => ({
            name: x.name ?? "—",
            address: x.formatted_address ?? "—",
            phone: "Ver detalhes (Places Details API)",
            placeId: x.place_id,
          }));
          sendJson(res, 200, { ok: true, demo: false, results });
          return;
        } catch {
          /* demo */
        }
      }
      const seed = hashSeed(query + location);
      const results = [0, 1, 2, 3, 4].map((i) => ({
        name: `${query} — Empresa ${(seed % 90) + i}`,
        address: `Rua Exemplo ${100 + i}, ${location}`,
        phone: `+55 11 9${(seed + i) % 10000}4${(seed + i * 7) % 1000}`,
      }));
      sendJson(res, 200, {
        ok: true,
        demo: true,
        message: "Configure GOOGLE_PLACES_API_KEY para dados reais (Places API).",
        results,
      });
      return;
    }

    case "instagramFollowers": {
      const profile = String(body?.profile ?? "").replace(/^@/, "").trim();
      if (!profile) {
        sendJson(res, 400, { ok: false, error: "Perfil obrigatorio (@ ou handle)." });
        return;
      }
      const seed = hashSeed(profile);
      const followers = Array.from({ length: 12 }, (_, i) => ({
        handle: `@seguidor_${((seed + i) % 9999).toString(36)}`,
        name: `Utilizador ${i + 1}`,
      }));
      sendJson(res, 200, {
        ok: true,
        demo: true,
        message:
          "Lista simulada. Scraping Instagram requer Playwright em ambiente servidor e conformidade com termos Meta.",
        profile,
        followers,
      });
      return;
    }

    case "saveToLeads": {
      const name = String(body?.name ?? "").trim();
      const email = String(body?.email ?? "").trim();
      if (!name || !email) {
        sendJson(res, 400, { ok: false, error: "name e email obrigatorios." });
        return;
      }
      ingestLead(actor.tenantSlug, {
        source: "prospecting",
        name,
        email,
        meta: { from: "prospecting" },
      });
      sendJson(res, 200, { ok: true });
      return;
    }

    default:
      sendJson(res, 400, { ok: false, error: "Acao desconhecida." });
  }
}

export default withApiErrorBoundary(handler);
