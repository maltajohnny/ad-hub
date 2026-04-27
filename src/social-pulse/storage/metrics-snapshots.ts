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

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Store;
    return p && typeof p === "object" ? p : {};
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
  return load()[accountId] ?? [];
}

export function getLastFollowersFromSnapshots(accountId: string): number | null {
  const arr = getFollowerSnapshots(accountId);
  const last = arr[arr.length - 1];
  return last ? last.followers : null;
}
