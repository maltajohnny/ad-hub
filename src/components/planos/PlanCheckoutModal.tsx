import { useEffect, useId } from "react";
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
import { CreditCard, ArrowLeft } from "lucide-react";

type PlanCheckoutModalProps = {
  open: boolean;
  onClose: () => void;
  planTitle: string;
  /** "mensal" | "anual (total com 30% de desconto)" */
  periodDescription: string;
  totalFormatted: string;
  yearly: boolean;
};

/**
 * Passo de pagamento após escolher plano — UI alinhada ao glass/plan-card da página.
 * Integração com gateway (Stripe, Pagar.me, Mercado Pago, etc.): substituir campos e chamar API no submit.
 */
export function PlanCheckoutModal({
  open,
  onClose,
  planTitle,
  periodDescription,
  totalFormatted,
  yearly,
}: PlanCheckoutModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 isolate z-[35] flex flex-col items-center justify-center bg-black/65 p-4 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="relative z-[36] w-full max-w-md"
        role="document"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="plan-card-gradient-ring w-full shadow-2xl">
          <div className="plan-card-gradient-inner max-h-[min(90dvh,640px)] overflow-y-auto overscroll-contain p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400/90">Checkout</p>
                <h2 id={titleId} className="font-display text-lg font-bold text-white sm:text-xl">
                  Pagamento
                </h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 gap-1 text-slate-300 hover:bg-white/10 hover:text-white"
                onClick={onClose}
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
            </div>

            <div className="mt-4 rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm">
              <p className="font-medium text-white">{planTitle}</p>
              <p className="mt-0.5 text-xs text-slate-400">{periodDescription}</p>
              <p className="mt-2 text-base font-semibold tabular-nums text-cyan-300/95">{totalFormatted}</p>
              {yearly ? (
                <p className="mt-1 text-[11px] text-emerald-400/90">Inclui 30% de desconto na faturação anual.</p>
              ) : null}
            </div>

            <div className="mt-5 space-y-3">
              <p className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <CreditCard className="h-4 w-4 text-cyan-400/80" />
                Cartão de crédito
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="cc-name" className="text-xs text-slate-400">
                  Nome no cartão
                </Label>
                <Input
                  id="cc-name"
                  name="cc-name"
                  autoComplete="cc-name"
                  placeholder="Como impresso no cartão"
                  className="border-white/12 bg-slate-900/50 text-slate-200 placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cc-number" className="text-xs text-slate-400">
                  Número do cartão
                </Label>
                <Input
                  id="cc-number"
                  name="cc-number"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="0000 0000 0000 0000"
                  className="border-white/12 bg-slate-900/50 text-slate-200 placeholder:text-slate-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cc-exp" className="text-xs text-slate-400">
                    Validade
                  </Label>
                  <Input
                    id="cc-exp"
                    name="cc-exp"
                    autoComplete="cc-exp"
                    placeholder="MM/AA"
                    className="border-white/12 bg-slate-900/50 text-slate-200 placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cc-cvc" className="text-xs text-slate-400">
                    CVV
                  </Label>
                  <Input
                    id="cc-cvc"
                    name="cc-cvc"
                    autoComplete="cc-csc"
                    placeholder="•••"
                    className="border-white/12 bg-slate-900/50 text-slate-200 placeholder:text-slate-500"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Parcelamento</Label>
                <Select defaultValue="1">
                  <SelectTrigger className="border-white/12 bg-slate-900/50 text-slate-200">
                    <SelectValue placeholder="À vista ou parcelado" />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-[#0c1228] text-slate-200">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n === 1 ? "À vista" : `${n}x sem juros`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <Button
                type="button"
                variant="gradientCta"
                className="w-full rounded-full font-semibold"
                onClick={() => {
                  toast.info("Integração de pagamento", {
                    description:
                      "Ligue o gateway (Stripe, Pagar.me, Mercado Pago, etc.) no backend e envie o token do cartão de forma segura (PCI). Posso indicar os passos quando escolher o provedor.",
                  });
                }}
              >
                Confirmar pagamento
              </Button>
              <p className="text-center text-[10px] leading-snug text-slate-500">
                Os dados do cartão não são guardados neste passo até existir um provedor de pagamento configurado no servidor.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
