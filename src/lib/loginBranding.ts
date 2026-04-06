import { getTenantBySlug, type TenantRecord } from "@/lib/tenantsStore";
import { normalizeLoginKey, sanitizeLoginInput } from "@/lib/loginUsername";

export type LoginBrandResolved = {
  key: string;
  name: string;
  tagline?: string;
  /** Data URL ou path; null = usar componente SVG Qtraffic no ecrã de login */
  logo: string | null;
  alt: string;
};

const QTRAFFIC_DEFAULT: LoginBrandResolved = {
  key: "qtraffic",
  name: "QTRAFFIC",
  logo: null,
  alt: "QTRAFFIC",
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
 * Emails (`@`) não são analisados. Sem `.` ou org desconhecida → null (marca Qtraffic).
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
 * Login principal: Qtraffic por defeito; se o utilizador indica org conhecida após `.`, mostra essa marca.
 */
export function resolveBrandingForMainLogin(username: string): LoginBrandResolved {
  const slug = extractOrgSlugFromUsername(username);
  if (!slug) {
    return QTRAFFIC_DEFAULT;
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
  return QTRAFFIC_DEFAULT;
}

export function getQtrafficDefaultBranding(): LoginBrandResolved {
  return QTRAFFIC_DEFAULT;
}

/**
 * Autenticação: com `utilizador.org` conhecido usa só a parte antes do último ponto; com `.org` usa só o slug; caso contrário o login completo.
 */
export function normalizeUsernameForLoginAttempt(raw: string): string {
  const t = raw.trim();
  if (t.includes("@")) {
    return normalizeLoginKey(sanitizeLoginInput(t));
  }
  const slug = extractOrgSlugFromUsername(t);
  if (!slug) {
    return normalizeLoginKey(sanitizeLoginInput(t));
  }
  const dot = t.lastIndexOf(".");
  const loginPart = t.slice(0, dot);
  if (!loginPart) {
    return slug;
  }
  return normalizeLoginKey(sanitizeLoginInput(loginPart));
}

export function resolveLoginScreenBrand(input: {
  tenantSlug?: string;
  tenantRecord?: TenantRecord;
  invalidTenant: boolean;
  username: string;
}): LoginBrandResolved {
  if (input.invalidTenant) {
    return getQtrafficDefaultBranding();
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
