import { BUILTIN_NORTER_ID } from "@/lib/tenantsStore";

/**
 * Carteira de demonstração: todos os clientes listados em Clientes pertencem à organização Norter.
 * Só membros da Norter (e regras em `canUserSeeClient`) acedem a estes registos; a AD-Hub gere a plataforma, não esta carteira.
 */
const NORTER_DEMO_CLIENT_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 8]);

export function getClientOrganizationScope(clientId: number): string | undefined {
  if (NORTER_DEMO_CLIENT_IDS.has(clientId)) return BUILTIN_NORTER_ID;
  return undefined;
}
