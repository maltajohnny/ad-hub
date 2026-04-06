import { BUILTIN_NORTER_ID } from "@/lib/tenantsStore";

/**
 * Clientes sem vínculo = carteira global visível apenas ao time Qtraffic (operadores + conta com org qtraffic).
 * Clientes com organizationId = visíveis também aos admins dessa organização.
 */
const CLIENT_ORG_BY_ID: Record<number, string | undefined> = {
  7: BUILTIN_NORTER_ID,
  8: BUILTIN_NORTER_ID,
};

export function getClientOrganizationScope(clientId: number): string | undefined {
  return CLIENT_ORG_BY_ID[clientId];
}
