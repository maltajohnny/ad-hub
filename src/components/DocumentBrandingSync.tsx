import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import {
  applyDocumentBranding,
  resolveTenantForAppBranding,
} from "@/lib/documentBranding";

/**
 * Mantém `document.title` e favicon alinhados à organização (fora do ecrã de login).
 * No login, {@link Login} aplica pré-visualização pelo utilizador (ex.: `user.norter`).
 */
export function DocumentBrandingSync() {
  const location = useLocation();
  const { user } = useAuth();
  const { activeSlug } = useTenant();

  const onLoginScreen =
    location.pathname === "/login" || /^\/t\/[^/]+\/login$/.test(location.pathname);

  useEffect(() => {
    if (onLoginScreen) return;
    const tenant = resolveTenantForAppBranding({
      userOrganizationId: user?.organizationId,
      activeSlug,
    });
    applyDocumentBranding(tenant);
  }, [onLoginScreen, user?.organizationId, activeSlug]);

  return null;
}
