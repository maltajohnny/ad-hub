import { describe, expect, it } from "vitest";
import { MetricsProcessorService } from "@/social-analytics/services/MetricsProcessorService";

describe("MetricsProcessorService", () => {
  it("calculate growth and engagement from snapshots", () => {
    const now = Date.now();
    const snapshots = [
      {
        id: "s1",
        profileId: "p1",
        followers: 1000,
        following: 100,
        posts: 30,
        likes: 2000,
        views: 10000,
        collectedAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "s2",
        profileId: "p1",
        followers: 1200,
        following: 105,
        posts: 32,
        likes: 2400,
        views: 12000,
        collectedAt: new Date(now).toISOString(),
      },
    ];

    const m = MetricsProcessorService.process("p1", snapshots);
    expect(m.dailyGrowth).toBe(200);
    expect(m.weeklyGrowth).toBe(200);
    expect(m.monthlyGrowth).toBe(200);
    expect(m.engagementRate).toBeCloseTo(200, 2);
  });
});

