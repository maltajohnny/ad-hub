import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CreditCard, ArrowLeft, Loader2 } from "lucide-react";
import { postAsaasCheckout, type PlanCheckoutPlanId } from "@/services/asaasCheckoutService";

type PlanCheckoutModalProps = {
  open: boolean;
  onClose: () => void;
  planTitle: string;
  planId: PlanCheckoutPlanId;
  /** Valor a cobrar em BRL (número, ex.: 169.9) */
  amountBrl: number;
  /** "mensal" | "anual (total com 30% de desconto)" */
  periodDescription: string;
  totalFormatted: string;
  yearly: boolean;
  gestorTeamSeats?: number;
  addonPlatformCount?: number;
  growthExtraUsers?: number;
};

const inputCompact =
  "h-9 min-h-9 border-white/12 bg-slate-900/50 px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500";

/**
 * Checkout de plano com cobrança via Asaas (POST /api/asaas-payment).
 */
export function PlanCheckoutModal({
  open,
  onClose,
  planTitle,
  planId,
  amountBrl,
  periodDescription,
  totalFormatted,
  yearly,
  gestorTeamSeats = 0,
  addonPlatformCount = 0,
  growthExtraUsers = 0,
}: PlanCheckoutModalProps) {
  const titleId = useId();
  const [installment, setInstallment] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [holderName, setHolderName] = useState("");
  const [email, setEmail] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [holderNameCard, setHolderNameCard] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      const r = await postAsaasCheckout({
        planTitle,
        planId,
        amountBrl,
        yearly,
        installmentCount: Math.min(21, Math.max(1, Number.parseInt(installment, 10) || 1)),
        holderNameCard: holderNameCard.trim(),
        cardNumber: cardNumber.trim(),
        expiry: expiry.trim(),
        cvv: cvv.trim(),
        holderName: holderName.trim(),
        email: email.trim(),
        cpfCnpj: cpfCnpj.trim(),
        postalCode: postalCode.trim(),
        addressNumber: addressNumber.trim(),
        phone: phone.trim(),
        gestorTeamSeats: planId === "gestor" ? Math.min(3, Math.max(0, gestorTeamSeats)) : undefined,
        addonPlatformCount: planId === "gestor" ? Math.max(0, addonPlatformCount) : undefined,
        growthExtraUsers: planId === "organizacao" ? Math.max(0, growthExtraUsers) : undefined,
      });
      if (!r.ok) {
        toast.error("Pagamento não concluído", { description: r.error });
        return;
      }
      toast.success("Pagamento registado", {
        description: r.invoiceUrl
          ? "Abrimos o comprovativo da Asaas num novo separador."
          : `Cobrança ${r.paymentId}${r.status ? ` — ${r.status}` : ""}`,
      });
      if (r.invoiceUrl) {
        window.open(r.invoiceUrl, "_blank", "noopener,noreferrer");
      }
      onClose();
    } catch (e) {
      toast.error("Erro de rede", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="pointer-events-auto fixed inset-0 isolate z-[35] flex flex-col items-center justify-start overflow-y-auto overscroll-contain bg-black/65 p-2 py-4 backdrop-blur-md sm:justify-center sm:p-4 sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="relative z-[36] w-full max-w-[min(100%,22rem)] sm:max-w-md"
        role="document"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="plan-card-gradient-ring w-full shadow-2xl">
          <div className="plan-card-gradient-inner flex flex-col p-4 sm:p-5">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
              <div className="min-w-0">
                <h2 id={titleId} className="font-display text-base font-bold leading-tight text-white sm:text-lg">
                  Checkout
                </h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 gap-0.5 px-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
                onClick={onClose}
                disabled={submitting}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar
              </Button>
            </div>

            <div className="mt-3 flex shrink-0 flex-wrap items-end justify-between gap-x-2 gap-y-1 rounded-md border border-white/10 bg-black/25 px-2.5 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium leading-snug text-white">{planTitle}</p>
                <p className="line-clamp-2 text-[10px] leading-tight text-slate-400">{periodDescription}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums leading-none text-cyan-300/95 sm:text-base">
                  {totalFormatted}
                </p>
                {yearly ? (
                  <p className="mt-0.5 text-[9px] leading-none text-emerald-400/85">−30% no anual</p>
                ) : null}
              </div>
            </div>

            <div className="mt-3 space-y-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Titular da cobrança</p>
              <div className="grid gap-2 sm:grid-cols-2 sm:gap-x-2 sm:gap-y-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="ch-name" className="text-[10px] text-slate-400">
                    Nome completo
                  </Label>
                  <Input
                    id="ch-name"
                    autoComplete="name"
                    placeholder="Como no documento"
                    className={inputCompact}
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="ch-email" className="text-[10px] text-slate-400">
                    E-mail
                  </Label>
                  <Input
                    id="ch-email"
                    type="email"
                    autoComplete="email"
                    placeholder="nome@email.com"
                    className={inputCompact}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="ch-doc" className="text-[10px] text-slate-400">
                    CPF ou CNPJ
                  </Label>
                  <Input
                    id="ch-doc"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Somente números"
                    className={inputCompact}
                    value={cpfCnpj}
                    onChange={(e) => setCpfCnpj(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ch-cep" className="text-[10px] text-slate-400">
                    CEP
                  </Label>
                  <Input
                    id="ch-cep"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    placeholder="00000-000"
                    className={inputCompact}
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ch-num" className="text-[10px] text-slate-400">
                    Nº do endereço
                  </Label>
                  <Input
                    id="ch-num"
                    autoComplete="street-address"
                    placeholder="Ex.: 100"
                    className={inputCompact}
                    value={addressNumber}
                    onChange={(e) => setAddressNumber(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="ch-phone" className="text-[10px] text-slate-400">
                    Telefone (DDD + número)
                  </Label>
                  <Input
                    id="ch-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="11999999999"
                    className={inputCompact}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-2.5">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
                <CreditCard className="h-3.5 w-3.5 shrink-0 text-cyan-400/80" />
                Cartão de crédito
              </p>
              <div className="grid gap-2 sm:grid-cols-2 sm:gap-x-2 sm:gap-y-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="cc-name" className="text-[10px] text-slate-400">
                    Nome no cartão
                  </Label>
                  <Input
                    id="cc-name"
                    name="cc-name"
                    autoComplete="cc-name"
                    placeholder="Como no cartão"
                    className={inputCompact}
                    value={holderNameCard}
                    onChange={(e) => setHolderNameCard(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="cc-number" className="text-[10px] text-slate-400">
                    Número
                  </Label>
                  <Input
                    id="cc-number"
                    name="cc-number"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="0000 0000 0000 0000"
                    className={inputCompact}
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cc-exp" className="text-[10px] text-slate-400">
                    Validade
                  </Label>
                  <Input
                    id="cc-exp"
                    name="cc-exp"
                    autoComplete="cc-exp"
                    placeholder="MM/AA"
                    className={inputCompact}
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cc-cvc" className="text-[10px] text-slate-400">
                    CVV
                  </Label>
                  <Input
                    id="cc-cvc"
                    name="cc-cvc"
                    autoComplete="cc-csc"
                    placeholder="•••"
                    className={inputCompact}
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[10px] text-slate-400">Parcelamento</Label>
                  <Select value={installment} onValueChange={setInstallment} disabled={submitting}>
                    <SelectTrigger className={`${inputCompact} h-9`}>
                      <SelectValue placeholder="À vista ou parcelado" />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-[#0c1228] text-slate-200">
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={String(n)} className="text-xs">
                          {n === 1 ? "À vista" : `${n}x sem juros`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="mt-3 shrink-0 flex flex-col gap-1.5 border-t border-white/[0.06] pt-3">
              <Button
                type="button"
                variant="gradientCta"
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold"
                disabled={submitting}
                onClick={() => void onSubmit()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A processar…
                  </>
                ) : (
                  "Confirmar pagamento"
                )}
              </Button>
              <p className="text-center text-[9px] leading-tight text-slate-500">
                Pagamento processado pela Asaas. O pedido sai do seu servidor com HTTPS; não guarde dados de cartão no
                browser.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
