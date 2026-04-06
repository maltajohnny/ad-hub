import { isPlatformOperator } from "@/lib/saasTypes";
import { getTenantById } from "@/lib/tenantsStore";

/** Time principal Qtraffic: operadores da plataforma ou conta explicitamente vinculada à organização built-in `qtraffic`. */
export function isQtrafficTeamMember(
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
