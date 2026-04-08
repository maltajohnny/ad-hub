import type { User } from "@/contexts/AuthContext";
import { effectiveModulesForUser, type AppModule } from "@/lib/saasTypes";

/** Utilizador com o módulo Social Pulse na interseção org + permissões de menu. */
export function userCanAccessSocialPulse(
  user: User | null | undefined,
  tenantEnabled: AppModule[] | undefined,
): boolean {
  if (!user) return false;
  const eff = effectiveModulesForUser(user, tenantEnabled);
  if (eff === "all") return true;
  return eff.includes("social-pulse");
}
