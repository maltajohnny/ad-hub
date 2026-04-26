import { growthNewId } from "./growthMemoryStore";

export type SapProfile = {
  id: string;
  tenantSlug: string;
  platform: "instagram" | "youtube" | "tiktok";
  username: string;
  createdAt: string;
};

export type SapSnapshot = {
  id: string;
  profileId: string;
  tenantSlug: string;
  followers: number;
  following: number;
  posts: number;
  views: number;
  likes: number;
  collectedAt: string;
};

export type SapMetrics = {
  id: string;
  profileId: string;
  tenantSlug: string;
  dailyGrowth: number;
  weeklyGrowth: number;
  monthlyGrowth: number;
  engagementRate: number;
  updatedAt: string;
};

type SapState = {
  profiles: SapProfile[];
  snapshots: SapSnapshot[];
  metrics: SapMetrics[];
};

type G = typeof globalThis & { __socialAnalyticsStore?: SapState };

export function getSocialAnalyticsState(): SapState {
  const g = globalThis as G;
  if (!g.__socialAnalyticsStore) {
    g.__socialAnalyticsStore = { profiles: [], snapshots: [], metrics: [] };
  }
  return g.__socialAnalyticsStore;
}

function metricFor(profileId: string, tenantSlug: string, snaps: SapSnapshot[]): SapMetrics {
  const ordered = [...snaps].sort((a, b) => Date.parse(a.collectedAt) - Date.parse(b.collectedAt));
  const cur = ordered[ordered.length - 1];
  if (!cur) {
    return {
      id: growthNewId("metric"),
      profileId,
      tenantSlug,
      dailyGrowth: 0,
      weeklyGrowth: 0,
      monthlyGrowth: 0,
      engagementRate: 0,
      updatedAt: new Date().toISOString(),
    };
  }
  const first = ordered[0]!;
  const dailyGrowth = cur.followers - (ordered[Math.max(0, ordered.length - 2)]?.followers ?? cur.followers);
  const weeklyGrowth = cur.followers - first.followers;
  const monthlyGrowth = weeklyGrowth;
  const engagementRate = cur.followers > 0 ? (cur.likes / cur.followers) * 100 : 0;
  return {
    id: growthNewId("metric"),
    profileId,
    tenantSlug,
    dailyGrowth,
    weeklyGrowth,
    monthlyGrowth,
    engagementRate: Math.round(engagementRate * 100) / 100,
    updatedAt: new Date().toISOString(),
  };
}

export function upsertProfile(tenantSlug: string, platform: SapProfile["platform"], username: string): SapProfile {
  const s = getSocialAnalyticsState();
  const found = s.profiles.find((p) => p.tenantSlug === tenantSlug && p.platform === platform && p.username === username);
  if (found) return found;
  const profile: SapProfile = { id: growthNewId("sap"), tenantSlug, platform, username, createdAt: new Date().toISOString() };
  s.profiles.push(profile);
  return profile;
}

export function addSnapshot(input: Omit<SapSnapshot, "id" | "collectedAt">): SapSnapshot {
  const s = getSocialAnalyticsState();
  const snap: SapSnapshot = { id: growthNewId("snap"), collectedAt: new Date().toISOString(), ...input };
  s.snapshots.push(snap);
  const profileSnaps = s.snapshots.filter((x) => x.profileId === input.profileId && x.tenantSlug === input.tenantSlug);
  const m = metricFor(input.profileId, input.tenantSlug, profileSnaps);
  s.metrics = s.metrics.filter((x) => x.profileId !== input.profileId || x.tenantSlug !== input.tenantSlug).concat(m);
  return snap;
}

