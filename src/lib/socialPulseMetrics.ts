import type { MonitoredAccount, SocialPulsePlatform } from "@/lib/socialPulseStore";

/** Série diária (últimos `days`) — valores estáveis por conta + leve “ruído” por tempo para simular atualização. */
export function buildFollowerSeries(
  account: MonitoredAccount,
  days: number,
  liveTick: number,
): { day: string; followers: number; views: number; engagementPct: number }[] {
  const seed = hashString(account.id + account.platform);
  const base = 8000 + (seed % 120000);
  const out: { day: string; followers: number; views: number; engagementPct: number }[] = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    const t = now - i * 86400000;
    const day = new Date(t).toISOString().slice(0, 10);
    const growth = (seed % 7) + i * ((seed % 3) + 1);
    const wobble = Math.round(30 * Math.sin((liveTick + i + seed) * 0.15));
    const followers = Math.max(100, Math.round(base + growth * 12 + wobble));
    const views = Math.round(followers * (3.2 + (seed % 5) * 0.4) + i * 900);
    const engagementPct = Number(
      (2.1 + (seed % 17) * 0.15 + Math.sin((liveTick + seed) * 0.08) * 0.3).toFixed(2),
    );
    out.push({ day, followers, views, engagementPct });
  }
  return out;
}

export function estimateMonthlyEarningsUsd(account: MonitoredAccount, liveTick: number): number {
  const seed = hashString(account.id);
  const series = buildFollowerSeries(account, 14, liveTick);
  const last = series[series.length - 1];
  const rate = platformRateMultiplier(account.platform);
  const raw = (last.followers / 1000) * rate * (last.engagementPct / 3.5);
  return Math.round(raw * 100) / 100;
}

function platformRateMultiplier(p: SocialPulsePlatform): number {
  switch (p) {
    case "youtube":
      return 4.2;
    case "instagram":
      return 3.1;
    case "tiktok":
      return 2.6;
    case "twitter":
      return 2.2;
    default:
      return 2.5;
  }
}

export function projectFollowers30d(account: MonitoredAccount, liveTick: number): { low: number; mid: number; high: number } {
  const series = buildFollowerSeries(account, 30, liveTick);
  const cur = series[series.length - 1]?.followers ?? 0;
  const prev = series[0]?.followers ?? cur;
  const daily = (cur - prev) / 29;
  const mid = Math.round(cur + daily * 30);
  const band = Math.max(120, Math.round(cur * 0.02));
  return { low: mid - band, mid, high: mid + band };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function platformLabel(p: SocialPulsePlatform): string {
  switch (p) {
    case "youtube":
      return "YouTube";
    case "instagram":
      return "Instagram";
    case "twitter":
      return "X (Twitter)";
    case "tiktok":
      return "TikTok";
    default:
      return p;
  }
}
