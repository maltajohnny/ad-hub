import adHubFaviconUrl from "@/assets/ad-hub-logo.png";
import norterFaviconUrl from "@/assets/norter-symbol.png";
import { getTenantById, getTenantBySlug, type TenantRecord } from "@/lib/tenantsStore";
import { extractOrgSlugFromUsername } from "@/lib/loginBranding";

/** Título da aba quando a experiência é a plataforma AD-Hub (landing, login sem org, operadores). */
export const PLATFORM_DEFAULT_DOCUMENT_TITLE = "AD-Hub — Move faster · Grow smarter";

let lastAppliedHref = "";

function setFaviconLink(href: string) {
  if (href === lastAppliedHref) return;
  lastAppliedHref = href;
  let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = href;
  link.type = href.startsWith("data:image/svg") ? "image/svg+xml" : "image/png";
}

/**
 * Atualiza `document.title` e favicon conforme a organização.
 * `tenant === null` → identidade AD-Hub (default da plataforma).
 */
export function applyDocumentBranding(tenant: TenantRecord | null): void {
  if (!tenant) {
    document.title = PLATFORM_DEFAULT_DOCUMENT_TITLE;
    setFaviconLink(adHubFaviconUrl);
    return;
  }
  const title = (tenant.browserTabTitle?.trim() || tenant.displayName).trim();
  document.title = title || PLATFORM_DEFAULT_DOCUMENT_TITLE;

  if (tenant.faviconDataUrl) {
    setFaviconLink(tenant.faviconDataUrl);
  } else if (tenant.logoDataUrl) {
    setFaviconLink(tenant.logoDataUrl);
  } else if (tenant.slug === "norter") {
    setFaviconLink(norterFaviconUrl);
  } else {
    setFaviconLink(adHubFaviconUrl);
  }
}

/** Área autenticada / fora do login: usa org do utilizador ou contexto ativo. */
export function resolveTenantForAppBranding(params: {
  userOrganizationId?: string | null;
  activeSlug: string | null;
}): TenantRecord | null {
  if (params.userOrganizationId) {
    const t = getTenantById(params.userOrganizationId);
    if (t) return t;
  }
  if (params.activeSlug) {
    return getTenantBySlug(params.activeSlug) ?? null;
  }
  return null;
}

/** Login: pré-visualização pelo campo utilizador ou rota `/t/:slug/login`. */
export function resolveTenantForLoginBranding(params: {
  pathname: string;
  tenantSlugFromRoute?: string;
  username: string;
}): TenantRecord | null {
  const m = params.pathname.match(/^\/t\/([^/]+)\/login$/);
  if (m) {
    const t = getTenantBySlug(m[1]);
    if (t) return t;
  }
  const slug = extractOrgSlugFromUsername(params.username);
  if (slug) {
    return getTenantBySlug(slug) ?? null;
  }
  if (params.tenantSlugFromRoute) {
    return getTenantBySlug(params.tenantSlugFromRoute) ?? null;
  }
  return null;
}
