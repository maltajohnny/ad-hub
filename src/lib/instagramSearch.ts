export type InstagramSearchUser = {
  username: string;
  full_name: string;
  profile_pic_url: string | null;
};

export async function fetchInstagramSearchSuggestions(query: string): Promise<InstagramSearchUser[]> {
  const q = query.trim().replace(/^@+/, "");
  if (q.length < 1) return [];
  const res = await fetch(`/api/social/ig-search.php?q=${encodeURIComponent(q)}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data: unknown = await res.json().catch(() => null);
  if (!data || typeof data !== "object" || !Array.isArray((data as { users?: unknown }).users)) {
    return [];
  }
  const users = (data as { users: unknown[] }).users;
  const out: InstagramSearchUser[] = [];
  for (const row of users) {
    if (!row || typeof row !== "object") continue;
    const u = row as Record<string, unknown>;
    const username = typeof u.username === "string" ? u.username : "";
    if (!username) continue;
    out.push({
      username,
      full_name: typeof u.full_name === "string" ? u.full_name : "",
      profile_pic_url: typeof u.profile_pic_url === "string" ? u.profile_pic_url : null,
    });
  }
  return out;
}
