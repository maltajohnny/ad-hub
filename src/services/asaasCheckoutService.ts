import { adHubBillingAsaasCheckout, getAdHubToken } from "@/lib/adhubAuthApi";

export type PlanCheckoutPlanId = "gestor" | "organizacao" | "scale";

export type AsaasCheckoutPayload = {
  planTitle: string;
  planId: PlanCheckoutPlanId;
  amountBrl: number;
  yearly: boolean;
  installmentCount: number;
  holderNameCard: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
  holderName: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  phone: string;
  /** Plano Gestor: lugares de equipa (0–3) × R$ 59,90. */
  gestorTeamSeats?: number;
  /** Plano Gestor: número de redes pagas além das 3 base. */
  addonPlatformCount?: number;
  /** Plano Organização: utilizadores extra (0–3). */
  growthExtraUsers?: number;
};

export type AsaasCheckoutResponse =
  | { ok: true; paymentId: string; status?: string; invoiceUrl?: string }
  | { ok: false; error: string };

/** Cobrança Asaas via API Go (`/api/ad-hub/billing/asaas-checkout`) com JWT do utilizador. */
export async function postAsaasCheckout(payload: AsaasCheckoutPayload): Promise<AsaasCheckoutResponse> {
  const tok = getAdHubToken();
  if (!tok) {
    return { ok: false, error: "Sessão expirada — inicie sessão novamente." };
  }
  return adHubBillingAsaasCheckout(tok, { ...payload } as unknown as Record<string, unknown>);
}
