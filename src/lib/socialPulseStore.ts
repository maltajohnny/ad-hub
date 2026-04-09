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

function tryParseUrl(s: string): URL | null {
  try {
    return new URL(s.startsWith("http") ? s : `https://${s}`);
  } catch {
    return null;
  }
}

function firstPathSegment(pathname: string): string {
  return pathname.replace(/\/+$/, "").split("/").filter(Boolean)[0] ?? "";
}

function stripAt(s: string): string {
  return s.replace(/^@+/, "").trim();
}

/**
 * Converte @handle, handle só ou URL completo num URL canónico do perfil para a plataforma escolhida.
 */
export function normalizeProfileUrl(input: string, platform: SocialPulsePlatform): string | null {
  const t = input.trim();
  if (!t) return null;

  if (platform === "instagram") {
    const u = tryParseUrl(t);
    if (u && /(^|\.)instagram\.com$/i.test(u.hostname)) {
      const seg = stripAt(firstPathSegment(u.pathname));
      if (!seg || /^(p|reel|reels|stories|explore|accounts)$/i.test(seg)) return null;
      if (!/^[a-zA-Z0-9._]{1,30}$/.test(seg)) return null;
      return `https://www.instagram.com/${seg}/`;
    }
    const h = stripAt(t).replace(/\//g, "");
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(h)) return null;
    return `https://www.instagram.com/${h}/`;
  }

  if (platform === "twitter") {
    const u = tryParseUrl(t);
    if (u && /(^|\.)(x\.com|twitter\.com)$/i.test(u.hostname)) {
      const seg = stripAt(firstPathSegment(u.pathname));
      if (!/^[a-zA-Z0-9_]{1,15}$/.test(seg)) return null;
      return `https://x.com/${seg}`;
    }
    const h = stripAt(t);
    if (!/^[a-zA-Z0-9_]{1,15}$/.test(h)) return null;
    return `https://x.com/${h}`;
  }

  if (platform === "tiktok") {
    const u = tryParseUrl(t);
    if (u && /(^|\.)tiktok\.com$/i.test(u.hostname)) {
      const m = u.pathname.match(/@([a-zA-Z0-9._]{2,24})/);
      const seg = m?.[1] ?? stripAt(firstPathSegment(u.pathname));
      if (!seg || !/^[a-zA-Z0-9._]{2,24}$/.test(seg)) return null;
      return `https://www.tiktok.com/@${seg}`;
    }
    const h = stripAt(t);
    if (!/^[a-zA-Z0-9._]{2,24}$/.test(h)) return null;
    return `https://www.tiktok.com/@${h}`;
  }

  if (platform === "youtube") {
    const u = tryParseUrl(t);
    if (u && (u.hostname.replace(/^www\./, "").endsWith("youtube.com") || u.hostname === "youtu.be")) {
      if (u.hostname === "youtu.be") {
        return null;
      }
      const path = u.pathname;
      const mAt = path.match(/\/@([^/?#]+)/);
      if (mAt?.[1]) return `https://www.youtube.com/@${mAt[1]}`;
      const mCh = path.match(/\/channel\/([^/?#]+)/);
      if (mCh?.[1]) return `https://www.youtube.com/channel/${mCh[1]}`;
      const mC = path.match(/\/c\/([^/?#]+)/);
      if (mC?.[1]) return `https://www.youtube.com/c/${mC[1]}`;
      const mUser = path.match(/\/user\/([^/?#]+)/);
      if (mUser?.[1]) return `https://www.youtube.com/user/${mUser[1]}`;
      return null;
    }
    const h = stripAt(t);
    if (h.length < 3 || !/^[\w-]{3,30}$/.test(h)) return null;
    return `https://www.youtube.com/@${h}`;
  }

  return null;
}

/** Verifica se o texto é um perfil válido para a rede escolhida (URL ou @handle). */
export function urlMatchesPlatform(input: string, platform: SocialPulsePlatform): boolean {
  return normalizeProfileUrl(input, platform) !== null;
}

/** Texto do campo Perfil: com a plataforma já escolhida, o exemplo é só o utilizador (URL completo continua aceite). */
export const PROFILE_URL_PLACEHOLDERS: Record<SocialPulsePlatform, string> = {
  youtube: "MrBeast",
  instagram: "brunocosta",
  twitter: "usuario",
  tiktok: "usuario",
};

/** Sugere nome amigável a partir do caminho do perfil (ex.: último segmento do Instagram). */
export function suggestLabelFromProfileUrl(input: string, platform: SocialPulsePlatform): string {
  const canonical = normalizeProfileUrl(input, platform);
  const raw = canonical ?? input.trim();
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
  const url = normalizeProfileUrl(input.profileUrl, input.platform);
  if (!url) {
    return { ok: false, error: "Indique um perfil válido para a plataforma escolhida (utilizador ou URL)." };
  }
  let data = load();
  const dup = data.accounts.some((a) => {
    if (a.organizationId !== input.organizationId) return false;
    const other = normalizeProfileUrl(a.profileUrl, a.platform) ?? a.profileUrl.trim();
    return other === url;
  });
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
