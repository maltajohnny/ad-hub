import { normalizeLoginKey } from "@/lib/loginUsername";

export type SocialPulsePlatform = "youtube" | "instagram" | "twitter" | "tiktok";

export type MonitoredAccount = {
  id: string;
  organizationId: string;
  platform: SocialPulsePlatform;
  profileUrl: string;
  label: string;
  createdAt: string;
  createdByUsername: string;
};

export type SocialPulseAuditAction =
  | "account_added"
  | "account_removed"
  | "assignments_updated";

export type SocialPulseAuditEntry = {
  id: string;
  organizationId: string;
  at: string;
  actorUsername: string;
  action: SocialPulseAuditAction;
  detail: string;
};

const STORAGE_KEY = "norter_social_pulse_v1";

type Stored = {
  accounts: MonitoredAccount[];
  /** orgId → userKey → ids de contas visíveis (gestores; admins ignoram) */
  visibility: Record<string, Record<string, string[]>>;
  audit: SocialPulseAuditEntry[];
};

function load(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { accounts: [], visibility: {}, audit: [] };
    const p = JSON.parse(raw) as Stored;
    return {
      accounts: Array.isArray(p.accounts) ? p.accounts : [],
      visibility: p.visibility && typeof p.visibility === "object" ? p.visibility : {},
      audit: Array.isArray(p.audit) ? p.audit : [],
    };
  } catch {
    return { accounts: [], visibility: {}, audit: [] };
  }
}

function persist(data: Stored) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function appendAudit(
  data: Stored,
  orgId: string,
  actorUsername: string,
  action: SocialPulseAuditAction,
  detail: string,
): Stored {
  const entry: SocialPulseAuditEntry = {
    id: crypto.randomUUID(),
    organizationId: orgId,
    at: new Date().toISOString(),
    actorUsername,
    action,
    detail,
  };
  const audit = [entry, ...data.audit].slice(0, 500);
  return { ...data, audit };
}

export function detectPlatformFromUrl(url: string): SocialPulsePlatform | null {
  const u = url.trim().toLowerCase();
  if (/(youtube\.com|youtu\.be)/.test(u)) return "youtube";
  if (/instagram\.com/.test(u)) return "instagram";
  if (/(twitter\.com|x\.com)/.test(u)) return "twitter";
  if (/tiktok\.com/.test(u)) return "tiktok";
  return null;
}

/** Verifica se o URL parece ser da rede escolhida (antes de guardar). */
export function urlMatchesPlatform(url: string, platform: SocialPulsePlatform): boolean {
  const u = url.trim().toLowerCase();
  if (!u) return false;
  switch (platform) {
    case "youtube":
      return /(youtube\.com|youtu\.be)/.test(u);
    case "instagram":
      return /instagram\.com/.test(u);
    case "twitter":
      return /(twitter\.com|x\.com)/.test(u);
    case "tiktok":
      return /tiktok\.com/.test(u);
    default:
      return false;
  }
}

export const PROFILE_URL_PLACEHOLDERS: Record<SocialPulsePlatform, string> = {
  youtube: "https://www.youtube.com/@canal",
  instagram: "https://www.instagram.com/utilizador/",
  twitter: "https://x.com/utilizador",
  tiktok: "https://www.tiktok.com/@utilizador",
};

/** Sugere nome amigável a partir do caminho do perfil (ex.: último segmento do Instagram). */
export function suggestLabelFromProfileUrl(url: string, platform: SocialPulsePlatform): string {
  const raw = url.trim();
  if (!raw) return "";
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const parts = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    if (platform === "youtube") {
      const at = parts.find((p) => p.startsWith("@"));
      if (at) return at;
      const idx = parts.indexOf("channel");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1].slice(0, 24);
    }
    const last = parts[parts.length - 1];
    if (!last) return "";
    if (["p", "reel", "reels", "stories", "explore"].includes(last)) return "";
    return last.replace(/^@/, "").slice(0, 80);
  } catch {
    return "";
  }
}

export function listAccountsForOrg(organizationId: string): MonitoredAccount[] {
  return load().accounts.filter((a) => a.organizationId === organizationId);
}

export function getVisibleAccountIdsForUser(
  organizationId: string,
  username: string,
  isOrgAdmin: boolean,
): string[] {
  const all = listAccountsForOrg(organizationId).map((a) => a.id);
  if (isOrgAdmin) return all;
  const key = normalizeLoginKey(username);
  const data = load();
  const ids = data.visibility[organizationId]?.[key];
  if (!ids?.length) return [];
  const set = new Set(all);
  return ids.filter((id) => set.has(id));
}

export function getAssignmentsMap(organizationId: string): Record<string, string[]> {
  const data = load();
  return { ...(data.visibility[organizationId] ?? {}) };
}

export function addMonitoredAccount(input: {
  organizationId: string;
  profileUrl: string;
  platform: SocialPulsePlatform;
  label: string;
  actorUsername: string;
}): { ok: true; account: MonitoredAccount } | { ok: false; error: string } {
  const url = input.profileUrl.trim();
  if (!url) return { ok: false, error: "Indique o link do perfil." };
  let data = load();
  const dup = data.accounts.some(
    (a) => a.organizationId === input.organizationId && a.profileUrl.trim() === url,
  );
  if (dup) return { ok: false, error: "Este perfil já está na lista." };
  const account: MonitoredAccount = {
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    platform: input.platform,
    profileUrl: url,
    label: input.label.trim() || url,
    createdAt: new Date().toISOString(),
    createdByUsername: input.actorUsername,
  };
  data = { ...data, accounts: [...data.accounts, account] };
  data = appendAudit(data, input.organizationId, input.actorUsername, "account_added", `Conta: ${account.label} (${account.platform})`);
  persist(data);
  return { ok: true, account };
}

export function removeMonitoredAccount(input: {
  organizationId: string;
  accountId: string;
  actorUsername: string;
}): { ok: boolean } {
  let data = load();
  const acc = data.accounts.find((a) => a.id === input.accountId && a.organizationId === input.organizationId);
  if (!acc) return { ok: false };
  data = {
    ...data,
    accounts: data.accounts.filter((a) => a.id !== input.accountId),
    visibility: Object.fromEntries(
      Object.entries(data.visibility).map(([orgId, map]) => {
        if (orgId !== input.organizationId) return [orgId, map];
        const next: Record<string, string[]> = {};
        for (const [uk, ids] of Object.entries(map)) {
          next[uk] = ids.filter((id) => id !== input.accountId);
        }
        return [orgId, next];
      }),
    ),
  };
  data = appendAudit(data, input.organizationId, input.actorUsername, "account_removed", `Removida: ${acc.label}`);
  persist(data);
  return { ok: true };
}

export function setUserVisibleAccounts(input: {
  organizationId: string;
  targetUsername: string;
  accountIds: string[];
  actorUsername: string;
}): void {
  const key = normalizeLoginKey(input.targetUsername);
  let data = load();
  const org = input.organizationId;
  const allowed = new Set(listAccountsForOrg(org).map((a) => a.id));
  const filtered = [...new Set(input.accountIds)].filter((id) => allowed.has(id));
  const vis = { ...(data.visibility[org] ?? {}) };
  vis[key] = filtered;
  data = { ...data, visibility: { ...data.visibility, [org]: vis } };
  data = appendAudit(
    data,
    org,
    input.actorUsername,
    "assignments_updated",
    `Permissões de contas atualizadas para ${input.targetUsername} (${filtered.length} conta(s)).`,
  );
  persist(data);
}

export function listAuditForOrg(organizationId: string, limit = 100): SocialPulseAuditEntry[] {
  return load()
    .audit.filter((e) => e.organizationId === organizationId)
    .slice(0, limit);
}
