import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApiErrorBoundary } from "../../../lib/withApiErrorBoundary";
import { sendJson } from "../../../lib/sendJson";
import { getGrowthActor, parseJsonBody } from "../../../lib/growthRequest";
import { addSnapshot, getSocialAnalyticsState, upsertProfile } from "../../../lib/socialAnalyticsMemoryStore";

function seed(platform: string, username: string) {
  const k = `${platform}:${username}`;
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (Math.imul(31, h) + k.charCodeAt(i)) | 0;
  const r = Math.abs(h) % 10000;
  return {
    followers: 1000 + r * 20,
    following: 50 + (r % 2000),
    posts: 10 + (r % 2000),
    likes: 2000 + r * 50,
    views: 20000 + r * 300,
  };
}

async function handler(req: VercelRequest, res: VercelResponse) {
  const actor = getGrowthActor(req);
  if (!actor) return sendJson(res, 401, { ok: false, error: "tenant/user missing headers" });
  const st = getSocialAnalyticsState();

  if (req.method === "GET") {
    const profiles = st.profiles.filter((p) => p.tenantSlug === actor.tenantSlug);
    return sendJson(res, 200, { ok: true, profiles });
  }
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Method not allowed" });

  const body = parseJsonBody(req) as Record<string, unknown>;
  const platform = String(body.platform ?? "instagram") as "instagram" | "youtube" | "tiktok";
  const username = String(body.username ?? "").trim().replace(/^@/, "").toLowerCase();
  if (!username) return sendJson(res, 400, { ok: false, error: "username required" });

  const profile = upsertProfile(actor.tenantSlug, platform, username);
  const sample = seed(platform, username);
  const snapshot = addSnapshot({ profileId: profile.id, tenantSlug: actor.tenantSlug, ...sample });
  return sendJson(res, 200, { ok: true, profile, snapshot });
}

export default withApiErrorBoundary(handler);

