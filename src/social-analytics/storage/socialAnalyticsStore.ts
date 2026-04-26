import type {
  SocialAnalyticsMetrics,
  SocialAnalyticsProfile,
  SocialAnalyticsSnapshot,
} from "@/social-analytics/types";
import { MetricsProcessorService } from "@/social-analytics/services/MetricsProcessorService";

type State = {
  profiles: SocialAnalyticsProfile[];
  snapshots: SocialAnalyticsSnapshot[];
  metrics: SocialAnalyticsMetrics[];
};

const KEY = "adhub_social_analytics_v1";

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { profiles: [], snapshots: [], metrics: [] };
    const p = JSON.parse(raw) as Partial<State>;
    return {
      profiles: Array.isArray(p.profiles) ? p.profiles : [],
      snapshots: Array.isArray(p.snapshots) ? p.snapshots : [],
      metrics: Array.isArray(p.metrics) ? p.metrics : [],
    };
  } catch {
    return { profiles: [], snapshots: [], metrics: [] };
  }
}

function save(s: State) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export const socialAnalyticsStore = {
  listProfiles(tenantId: string): SocialAnalyticsProfile[] {
    return load().profiles.filter((p) => p.tenantId === tenantId);
  },
  createProfile(profile: SocialAnalyticsProfile) {
    const s = load();
    if (!s.profiles.some((p) => p.tenantId === profile.tenantId && p.platform === profile.platform && p.username === profile.username)) {
      s.profiles.push(profile);
      save(s);
    }
  },
  addSnapshot(snapshot: SocialAnalyticsSnapshot) {
    const s = load();
    s.snapshots.push(snapshot);
    const snaps = s.snapshots.filter((x) => x.profileId === snapshot.profileId);
    const metric = MetricsProcessorService.process(snapshot.profileId, snaps);
    s.metrics = s.metrics.filter((m) => m.profileId !== snapshot.profileId).concat(metric);
    save(s);
  },
  history(profileId: string): SocialAnalyticsSnapshot[] {
    return load()
      .snapshots
      .filter((s) => s.profileId === profileId)
      .sort((a, b) => Date.parse(a.collectedAt) - Date.parse(b.collectedAt));
  },
  metrics(profileId: string): SocialAnalyticsMetrics | null {
    return load().metrics.find((m) => m.profileId === profileId) ?? null;
  },
  rankGlobal(): Array<{ profile: SocialAnalyticsProfile; followers: number; weeklyGrowth: number }> {
    const s = load();
    return s.profiles
      .map((p) => {
        const snaps = s.snapshots.filter((x) => x.profileId === p.id);
        const last = snaps.sort((a, b) => Date.parse(b.collectedAt) - Date.parse(a.collectedAt))[0];
        const metric = s.metrics.find((m) => m.profileId === p.id);
        return { profile: p, followers: last?.followers ?? 0, weeklyGrowth: metric?.weeklyGrowth ?? 0 };
      })
      .sort((a, b) => (b.followers - a.followers) || (b.weeklyGrowth - a.weeklyGrowth));
  },
  rankByTenant(tenantId: string) {
    return this.rankGlobal().filter((x) => x.profile.tenantId === tenantId);
  },
};

