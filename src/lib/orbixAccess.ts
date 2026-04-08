import { isPlatformOperator } from "@/lib/saasTypes";
import { getTenantById } from "@/lib/tenantsStore";

/** Equipa AD-Hub: operadores da plataforma ou conta vinculada à org built-in (slug `qtraffic`, legado). */
export function isOrbixTeamMember(
  user: { username: string; organizationId?: string } | null | undefined,
): boolean {
  if (!user) return false;
  if (isPlatformOperator(user.username)) return true;
  if (user.organizationId) {
    const t = getTenantById(user.organizationId);
    if (t?.slug === "qtraffic") return true;
  }
  return false;
}

/** @deprecated Preferir `isOrbixTeamMember`. */
export const isQtrafficTeamMember = isOrbixTeamMember;
