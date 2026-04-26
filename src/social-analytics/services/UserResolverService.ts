import type { ResolvedProfileInput, SocialAnalyticsPlatform } from "@/social-analytics/types";

function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").replace(/^https?:\/\//, "").replace(/^www\./, "");
}

function platformFromHost(host: string): SocialAnalyticsPlatform | null {
  const h = host.toLowerCase();
  if (h.includes("instagram.com")) return "instagram";
  if (h.includes("youtube.com") || h.includes("youtu.be")) return "youtube";
  if (h.includes("tiktok.com")) return "tiktok";
  return null;
}

export const UserResolverService = {
  resolve(input: string): ResolvedProfileInput | null {
    const normalized = normalizeHandle(input);
    if (!normalized) return null;

    if (!normalized.includes("/")) {
      return { platform: "instagram", username: normalized.toLowerCase() };
    }

    try {
      const u = new URL(`https://${normalized}`);
      const platform = platformFromHost(u.host);
      if (!platform) return null;
      const firstSeg = u.pathname.split("/").filter(Boolean)[0] ?? "";
      const username = firstSeg.replace(/^@/, "").trim().toLowerCase();
      if (!username) return null;
      return { platform, username };
    } catch {
      return null;
    }
  },
};

