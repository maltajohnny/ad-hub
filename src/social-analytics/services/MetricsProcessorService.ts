import type { SocialAnalyticsMetrics, SocialAnalyticsSnapshot } from "@/social-analytics/types";

function lastByDays(snaps: SocialAnalyticsSnapshot[], days: number): SocialAnalyticsSnapshot | null {
  if (snaps.length === 0) return null;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  for (let i = snaps.length - 1; i >= 0; i--) {
    const t = Date.parse(snaps[i]!.collectedAt);
    if (Number.isFinite(t) && t <= cutoff) return snaps[i]!;
  }
  return snaps[0]!;
}

export const MetricsProcessorService = {
  process(profileId: string, snapshots: SocialAnalyticsSnapshot[]): SocialAnalyticsMetrics {
    const ordered = [...snapshots].sort((a, b) => Date.parse(a.collectedAt) - Date.parse(b.collectedAt));
    const current = ordered[ordered.length - 1];
    if (!current) {
      return {
        id: crypto.randomUUID(),
        profileId,
        dailyGrowth: 0,
        weeklyGrowth: 0,
        monthlyGrowth: 0,
        engagementRate: 0,
        updatedAt: new Date().toISOString(),
      };
    }
    const d = lastByDays(ordered, 1);
    const w = lastByDays(ordered, 7);
    const m = lastByDays(ordered, 30);
    const dailyGrowth = d ? current.followers - d.followers : 0;
    const weeklyGrowth = w ? current.followers - w.followers : 0;
    const monthlyGrowth = m ? current.followers - m.followers : 0;
    const engagementRate = current.followers > 0 ? ((current.likes / current.followers) * 100) : 0;
    return {
      id: crypto.randomUUID(),
      profileId,
      dailyGrowth,
      weeklyGrowth,
      monthlyGrowth,
      engagementRate: Math.round(engagementRate * 100) / 100,
      updatedAt: new Date().toISOString(),
    };
  },
};

