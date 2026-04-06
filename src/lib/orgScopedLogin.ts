import { normalizeLoginKey, sanitizeLoginInput } from "@/lib/loginUsername";

/** Constrói o login canónico `localpart.slugdaorg` (minúsculas). */
export function buildOrgScopedLogin(localPartRaw: string, orgSlug: string): string | null {
  const slug = orgSlug.trim().toLowerCase();
  let raw = sanitizeLoginInput(localPartRaw).trim().toLowerCase();
  if (!raw || !slug) return null;
  if (raw.includes(".")) {
    raw = raw.slice(0, raw.lastIndexOf("."));
  }
  if (!raw || /[\s,]/.test(raw)) return null;
  return `${raw}.${slug}`;
}

/** Interpreta `maria.zeus` → { localPart: maria, orgSlug: zeus }; login sem sufixo org → null. */
export function parseOrgScopedLogin(username: string): { localPart: string; orgSlug: string } | null {
  const t = normalizeLoginKey(sanitizeLoginInput(username));
  const dot = t.lastIndexOf(".");
  if (dot <= 0) return null;
  const localPart = t.slice(0, dot);
  const orgSlug = t.slice(dot + 1);
  if (!localPart || !orgSlug) return null;
  return { localPart, orgSlug };
}

/** Troca o sufixo de organização (ex.: `a.norter` → `a.zeus`). Legacy sem ponto: `diego` + zeus → `diego.zeus`. */
export function migrateOrgScopedLoginToNewSlug(username: string, newOrgSlug: string): string | null {
  const ns = newOrgSlug.trim().toLowerCase();
  const p = parseOrgScopedLogin(username);
  if (p) {
    return `${p.localPart}.${ns}`;
  }
  return buildOrgScopedLogin(username, ns);
}
