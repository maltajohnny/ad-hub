/**
 * Histórico mínimo para gráficos — apenas leituras reais já obtidas (sem interpolação).
 */

const KEY = "norter_social_pulse_snapshots_v1";
const MAX_POINTS = 30;

export type SnapshotPoint = {
  at: string;
  followers: number;
  source: "graph_api" | "scraper";
};

type Store = Record<string, SnapshotPoint[]>;

function sanitizeSnapshotPoint(value: unknown): SnapshotPoint | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<SnapshotPoint>;
  if (typeof v.at !== "string") return null;
  if (!Number.isFinite(v.followers) || (v.followers ?? 0) < 0) return null;
  if (v.source !== "graph_api" && v.source !== "scraper") return null;
  return {
    at: v.at,
    followers: Number(v.followers),
    source: v.source,
  };
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return {};
    const clean: Store = {};
    for (const [accountId, points] of Object.entries(p as Record<string, unknown>)) {
      if (!Array.isArray(points)) continue;
      const normalized = points.map(sanitizeSnapshotPoint).filter((x): x is SnapshotPoint => x !== null);
      if (normalized.length) {
        clean[accountId] = normalized.slice(-MAX_POINTS);
      }
    }
    return clean;
  } catch {
    return {};
  }
}

function persist(data: Store) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function appendFollowerSnapshot(
  accountId: string,
  followers: number,
  source: "graph_api" | "scraper",
): void {
  if (!Number.isFinite(followers) || followers < 0) return;
  const data = load();
  const prev = data[accountId] ?? [];
  const last = prev[prev.length - 1];
  const now = new Date().toISOString();
  if (last && last.followers === followers && last.source === source) {
    const sameDay = last.at.slice(0, 10) === now.slice(0, 10);
    if (sameDay) return;
  }
  const next = [...prev, { at: now, followers, source }].slice(-MAX_POINTS);
  data[accountId] = next;
  persist(data);
}

export function getFollowerSnapshots(accountId: string): SnapshotPoint[] {
  const value = load()[accountId];
  return Array.isArray(value) ? value : [];
}

export function getLastFollowersFromSnapshots(accountId: string): number | null {
  const arr = getFollowerSnapshots(accountId);
  const last = arr[arr.length - 1];
  return last ? last.followers : null;
}

export function clearFollowerSnapshots(accountId: string): void {
  if (!accountId) return;
  const data = load();
  if (!(accountId in data)) return;
  delete data[accountId];
  persist(data);
}
