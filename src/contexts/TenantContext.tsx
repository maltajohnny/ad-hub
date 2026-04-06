import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getTenantBySlug, type TenantRecord } from "@/lib/tenantsStore";

const SESSION_KEY = "norter_active_tenant_slug";

type TenantContextValue = {
  /** Slug da org ativa na sessão (`null` = identidade Norter / plataforma). */
  activeSlug: string | null;
  tenant: TenantRecord | null;
  setActiveSlug: (slug: string | null) => void;
  /** Logo para sidebar/login: custom ou Norter por defeito. */
  brandingLogoSrc: string | null;
  brandingName: string;
  accentHex: string | undefined;
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [activeSlug, setActiveSlugState] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  });

  const setActiveSlug = useCallback((slug: string | null) => {
    setActiveSlugState(slug);
    try {
      if (slug) sessionStorage.setItem(SESSION_KEY, slug);
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const tenant = useMemo(() => (activeSlug ? getTenantBySlug(activeSlug) ?? null : null), [activeSlug]);

  const value = useMemo((): TenantContextValue => {
    const brandingLogoSrc = tenant?.logoDataUrl ?? null;
    const brandingName = tenant?.displayName ?? "Norter";
    const accentHex = tenant?.accentHex;
    return {
      activeSlug,
      tenant,
      setActiveSlug,
      brandingLogoSrc,
      brandingName,
      accentHex,
    };
  }, [activeSlug, tenant, setActiveSlug]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
