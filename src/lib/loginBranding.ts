import { getTenantBySlug, type TenantRecord } from "@/lib/tenantsStore";
import { normalizeLoginKey, sanitizeLoginInput } from "@/lib/loginUsername";

export type LoginBrandResolved = {
  key: string;
  name: string;
  tagline?: string;
  /** Data URL ou path; null = usar componente AD-Hub no ecrã de login */
  logo: string | null;
  alt: string;
};

const ORBIX_DEFAULT: LoginBrandResolved = {
  key: "orbix",
  name: "AD-Hub",
  logo: null,
  alt: "AD-Hub",
};

const NORTER_BUILTIN: LoginBrandResolved = {
  key: "norter",
  name: "Norter",
  tagline: "Aceleradora",
  /** Logo no componente <NorterMarkLogo /> (PNG NORTER + X). */
  logo: null,
  alt: "Norter",
};

function isKnownOrgSlug(slug: string): boolean {
  if (slug === "norter") return true;
  return Boolean(getTenantBySlug(slug));
}

/**
 * Extrai o slug da organização após o último `.` só se for uma org conhecida (Norter embutida ou tenant registado).
 * Emails (`@`) não são analisados. Sem `.` ou org desconhecida → null (marca AD-Hub).
 */
export function extractOrgSlugFromUsername(username: string): string | null {
  const t = username.trim();
  if (!t || t.includes("@")) return null;
  const dot = t.lastIndexOf(".");
  if (dot < 0) return null;
  const candidate = t.slice(dot + 1).toLowerCase();
  if (!/^[a-z0-9-]+$/.test(candidate)) return null;
  if (!isKnownOrgSlug(candidate)) return null;
  return candidate;
}

/**
 * Login principal: AD-Hub por defeito; se o utilizador indica org conhecida após `.`, mostra essa marca.
 */
export function resolveBrandingForMainLogin(username: string): LoginBrandResolved {
  const slug = extractOrgSlugFromUsername(username);
  if (!slug) {
    return ORBIX_DEFAULT;
  }
  const tenant = getTenantBySlug(slug);
  if (tenant) {
    return {
      key: `tenant-${tenant.slug}`,
      name: tenant.displayName,
      tagline: undefined,
      logo: tenant.logoDataUrl,
      alt: tenant.displayName,
    };
  }
  if (slug === "norter") {
    return NORTER_BUILTIN;
  }
  return ORBIX_DEFAULT;
}

export function getOrbixDefaultBranding(): LoginBrandResolved {
  return ORBIX_DEFAULT;
}

/** @deprecated Use `getOrbixDefaultBranding`. */
export function getQtrafficDefaultBranding(): LoginBrandResolved {
  return ORBIX_DEFAULT;
}

/**
 * Chave de autenticação no registo: o login completo (ex.: `diego.norter`), ou e-mail normalizado.
 * O sufixo `.slugdaorg` faz parte do utilizador e não é removido.
 */
export function normalizeUsernameForLoginAttempt(raw: string): string {
  const t = raw.trim();
  if (t.includes("@")) {
    return normalizeLoginKey(sanitizeLoginInput(t));
  }
  return normalizeLoginKey(sanitizeLoginInput(t));
}

export function resolveLoginScreenBrand(input: {
  tenantSlug?: string;
  tenantRecord?: TenantRecord;
  invalidTenant: boolean;
  username: string;
}): LoginBrandResolved {
  if (input.invalidTenant) {
    return getOrbixDefaultBranding();
  }
  if (input.tenantSlug && input.tenantRecord) {
    return {
      key: `route-${input.tenantRecord.slug}`,
      name: input.tenantRecord.displayName,
      tagline: undefined,
      logo: input.tenantRecord.logoDataUrl,
      alt: input.tenantRecord.displayName,
    };
  }
  return resolveBrandingForMainLogin(input.username);
}
