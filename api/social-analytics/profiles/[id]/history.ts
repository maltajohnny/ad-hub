import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApiErrorBoundary } from "../../../../lib/withApiErrorBoundary";
import { sendJson } from "../../../../lib/sendJson";
import { getGrowthActor } from "../../../../lib/growthRequest";
import { getSocialAnalyticsState } from "../../../../lib/socialAnalyticsMemoryStore";

async function handler(req: VercelRequest, res: VercelResponse) {
  const actor = getGrowthActor(req);
  if (!actor) return sendJson(res, 401, { ok: false, error: "tenant/user missing headers" });
  if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  const id = String(req.query.id ?? "");
  const st = getSocialAnalyticsState();
  const history = st.snapshots
    .filter((s) => s.profileId === id && s.tenantSlug === actor.tenantSlug)
    .sort((a, b) => Date.parse(a.collectedAt) - Date.parse(b.collectedAt));
  return sendJson(res, 200, { ok: true, history });
}

export default withApiErrorBoundary(handler);

