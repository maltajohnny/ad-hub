const STORAGE_KEY = "norter_intellisearch_history_v1";
const MAX = 80;

export type IntelliSearchHistoryEntry = {
  query: string;
  score: number;
  at: string;
  name?: string;
};

export function loadIntelliSearchHistory(): IntelliSearchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is IntelliSearchHistoryEntry =>
        x != null &&
        typeof x === "object" &&
        typeof (x as IntelliSearchHistoryEntry).query === "string" &&
        typeof (x as IntelliSearchHistoryEntry).score === "number" &&
        typeof (x as IntelliSearchHistoryEntry).at === "string",
    );
  } catch {
    return [];
  }
}

export function appendIntelliSearchHistory(entry: IntelliSearchHistoryEntry): void {
  try {
    const prev = loadIntelliSearchHistory();
    const next = [entry, ...prev.filter((e) => e.query !== entry.query || e.at !== entry.at)].slice(0, MAX);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
