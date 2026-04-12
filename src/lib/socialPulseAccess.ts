import type { User } from "@/contexts/AuthContext";
import { effectiveModulesForUser, type AppModule, type OrgBillingInfo } from "@/lib/saasTypes";

/** Utilizador com o módulo Social Pulse na interseção org + permissões de menu. */
export function userCanAccessSocialPulse(
  user: User | null | undefined,
  tenantEnabled: AppModule[] | undefined,
  orgBilling?: OrgBillingInfo | null,
): boolean {
  if (!user) return false;
  const eff = effectiveModulesForUser(user, tenantEnabled, orgBilling);
  if (eff === "all") return true;
  return eff.includes("social-pulse");
}
