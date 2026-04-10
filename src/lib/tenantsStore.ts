import type { AppModule } from "@/lib/saasTypes";
import { RESERVED_TENANT_SLUGS } from "@/lib/saasTypes";

const STORAGE_KEY = "norter_saas_tenants";

export const BUILTIN_NORTER_ID = "00000000-0000-4000-8000-000000000001";
export const BUILTIN_QTRAFFIC_ID = "00000000-0000-4000-8000-000000000002";

export type TenantRecord = {
  id: string;
  slug: string;
  displayName: string;
  /** Data URL da logo (ou null = só nome no login). */
  logoDataUrl: string | null;
  /** Título da aba do navegador (ex.: "AD-HUB — Move faster · Grow smarter"). */
  browserTabTitle?: string;
  /** Favicon (data URL). Se ausente, usa a logo ou ícone por defeito da org. */
  faviconDataUrl?: string | null;
  /** Cor de destaque opcional (hex). */
  accentHex?: string;
  /** Módulos ativos nesta org (menu); vazio = todos. */
  enabledModules: AppModule[];
  createdAt: string;
};

/** Migra módulos antigos (ex.: saude-google → intelli-search). */
function migrateTenantModules(mods: AppModule[]): AppModule[] {
  const mapped = (mods as unknown as string[]).map((m) =>
    m === "saude-google" ? "intelli-search" : m,
  ) as AppModule[];
  return [...new Set(mapped)];
}

function withTenantDefaults(t: TenantRecord): TenantRecord {
  const isBuiltInAdHub =
    t.id === BUILTIN_QTRAFFIC_ID || t.slug === "qtraffic" || t.slug === "adhub";
  if (isBuiltInAdHub) {
    const dn = t.displayName.trim();
    const dnLower = dn.toLowerCase();
    /** Nomes antigos da org principal (Orbix → Qtraffic → AD-HUB); dados em localStorage podem ainda dizer "Qtraffic". */
    const legacyName =
      dnLower === "orbix" ||
      dnLower === "ad-hub" ||
      dnLower === "qtraffic" ||
      dn === "AD-HUB";
    const rawTitle = t.browserTabTitle;
    const title =
      rawTitle?.startsWith("AD-Hub —")
        ? `AD-HUB —${rawTitle.slice("AD-Hub —".length)}`
        : rawTitle?.startsWith("AD-HUB —")
          ? rawTitle
          : rawTitle;
    return {
      ...t,
      slug: "adhub",
      displayName: legacyName ? "AD-HUB" : t.displayName,
      browserTabTitle: title ?? "AD-HUB — Move faster · Grow smarter",
    };
  }
  if (t.slug === "norter") {
    return {
      ...t,
      browserTabTitle: t.browserTabTitle ?? "Norter — Aceleradora",
    };
  }
  return {
    ...t,
    browserTabTitle: t.browserTabTitle?.trim() || undefined,
  };
}

function ensureBuiltInTenants(list: TenantRecord[]): { list: TenantRecord[]; changed: boolean } {
  let changed = false;
  const migrated = list.map((t) => {
    const nextMods = migrateTenantModules(t.enabledModules);
    const merged = withTenantDefaults({ ...t, enabledModules: nextMods });
    const modsDirty =
      nextMods.length !== t.enabledModules.length || nextMods.some((m, i) => m !== t.enabledModules[i]);
    const titleDirty = merged.browserTabTitle !== t.browserTabTitle;
    const nameDirty = merged.displayName !== t.displayName;
    if (modsDirty || titleDirty || nameDirty) changed = true;
    return merged;
  });

  let out = migrated;
  if (!out.some((t) => t.slug === "norter")) {
    out = [
      ...out,
      withTenantDefaults({
        id: BUILTIN_NORTER_ID,
        slug: "norter",
        displayName: "Norter",
        logoDataUrl: null,
        enabledModules: [],
        createdAt: new Date().toISOString(),
      }),
    ];
    changed = true;
  }
  if (!out.some((t) => t.slug === "adhub")) {
    out = [
      ...out,
      withTenantDefaults({
        id: BUILTIN_QTRAFFIC_ID,
        slug: "adhub",
        displayName: "AD-HUB",
        logoDataUrl: null,
        enabledModules: [],
        createdAt: new Date().toISOString(),
      }),
    ];
    changed = true;
  }
  return { list: out, changed };
}

function loadRaw(): TenantRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let list: TenantRecord[] = [];
    if (raw) {
      const parsed = JSON.parse(raw) as TenantRecord[];
      list = Array.isArray(parsed) ? parsed : [];
    }
    const { list: fixed, changed } = ensureBuiltInTenants(list);
    if (changed) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fixed));
    }
    return fixed;
  } catch {
    const { list: fixed } = ensureBuiltInTenants([]);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fixed));
    } catch {
      /* ignore */
    }
    return fixed;
  }
}

function persist(list: TenantRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function listTenants(): TenantRecord[] {
  return loadRaw().sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR"));
}

export function getTenantBySlug(slug: string): TenantRecord | undefined {
  const s = slug.trim().toLowerCase();
  return loadRaw().find((t) => t.slug === s);
}

export function getTenantById(id: string): TenantRecord | undefined {
  if (!id?.trim()) return undefined;
  return loadRaw().find((t) => t.id === id);
}

export function validateTenantSlug(slug: string): { ok: true } | { ok: false; error: string } {
  const s = slug.trim().toLowerCase();
  if (s.length < 2) return { ok: false, error: "Use pelo menos 2 caracteres no slug." };
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(s)) {
    return { ok: false, error: "Slug inválido (minúsculas, números e hífen)." };
  }
  if (RESERVED_TENANT_SLUGS.has(s)) return { ok: false, error: "Este identificador é reservado." };
  return { ok: true };
}

export function createTenant(input: {
  slug: string;
  displayName: string;
  logoDataUrl: string | null;
  browserTabTitle?: string;
  faviconDataUrl?: string | null;
  accentHex?: string;
  enabledModules: AppModule[];
}): { ok: true; tenant: TenantRecord } | { ok: false; error: string } {
  const v = validateTenantSlug(input.slug);
  if (!v.ok) return v;
  const slug = input.slug.trim().toLowerCase();
  const list = loadRaw();
  if (list.some((t) => t.slug === slug)) return { ok: false, error: "Já existe uma organização com este slug." };
  const tenant: TenantRecord = withTenantDefaults({
    id: crypto.randomUUID(),
    slug,
    displayName: input.displayName.trim() || slug,
    logoDataUrl: input.logoDataUrl,
    browserTabTitle: input.browserTabTitle?.trim() || undefined,
    faviconDataUrl: input.faviconDataUrl ?? null,
    accentHex: input.accentHex?.trim() || undefined,
    enabledModules: migrateTenantModules([...input.enabledModules]),
    createdAt: new Date().toISOString(),
  });
  list.push(tenant);
  persist(list);
  return { ok: true, tenant };
}

export function updateTenant(
  id: string,
  patch: Partial<
    Pick<TenantRecord, "displayName" | "logoDataUrl" | "accentHex" | "enabledModules" | "browserTabTitle" | "faviconDataUrl">
  >,
): { ok: boolean; error?: string } {
  const list = loadRaw();
  const i = list.findIndex((t) => t.id === id);
  if (i < 0) return { ok: false, error: "Organização não encontrada." };
  const enabled =
    patch.enabledModules !== undefined
      ? migrateTenantModules([...patch.enabledModules])
      : list[i].enabledModules;
  list[i] = {
    ...list[i],
    ...patch,
    enabledModules: enabled,
  };
  persist(list);
  return { ok: true };
}

export function deleteTenant(id: string): void {
  if (id === BUILTIN_NORTER_ID || id === BUILTIN_QTRAFFIC_ID) return;
  persist(loadRaw().filter((t) => t.id !== id));
}

/** URL pública de login da organização (path-based; DNS apontaria para o mesmo host). */
export function tenantLoginPath(slug: string): string {
  return `/t/${encodeURIComponent(slug)}/login`;
}
