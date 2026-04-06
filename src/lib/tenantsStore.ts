import type { AppModule } from "@/lib/saasTypes";
import { RESERVED_TENANT_SLUGS } from "@/lib/saasTypes";

const STORAGE_KEY = "norter_saas_tenants";

export type TenantRecord = {
  id: string;
  slug: string;
  displayName: string;
  /** Data URL da logo (ou null = só nome no login). */
  logoDataUrl: string | null;
  /** Cor de destaque opcional (hex). */
  accentHex?: string;
  /** Módulos ativos nesta org (menu); vazio = todos. */
  enabledModules: AppModule[];
  createdAt: string;
};

function loadRaw(): TenantRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TenantRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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
  accentHex?: string;
  enabledModules: AppModule[];
}): { ok: true; tenant: TenantRecord } | { ok: false; error: string } {
  const v = validateTenantSlug(input.slug);
  if (!v.ok) return v;
  const slug = input.slug.trim().toLowerCase();
  const list = loadRaw();
  if (list.some((t) => t.slug === slug)) return { ok: false, error: "Já existe uma organização com este slug." };
  const tenant: TenantRecord = {
    id: crypto.randomUUID(),
    slug,
    displayName: input.displayName.trim() || slug,
    logoDataUrl: input.logoDataUrl,
    accentHex: input.accentHex?.trim() || undefined,
    enabledModules: [...input.enabledModules],
    createdAt: new Date().toISOString(),
  };
  list.push(tenant);
  persist(list);
  return { ok: true, tenant };
}

export function updateTenant(
  id: string,
  patch: Partial<Pick<TenantRecord, "displayName" | "logoDataUrl" | "accentHex" | "enabledModules">>,
): { ok: boolean; error?: string } {
  const list = loadRaw();
  const i = list.findIndex((t) => t.id === id);
  if (i < 0) return { ok: false, error: "Organização não encontrada." };
  list[i] = {
    ...list[i],
    ...patch,
    enabledModules: patch.enabledModules ? [...patch.enabledModules] : list[i].enabledModules,
  };
  persist(list);
  return { ok: true };
}

export function deleteTenant(id: string): void {
  persist(loadRaw().filter((t) => t.id !== id));
}

/** URL pública de login da organização (path-based; DNS apontaria para o mesmo host). */
export function tenantLoginPath(slug: string): string {
  return `/t/${encodeURIComponent(slug)}/login`;
}
