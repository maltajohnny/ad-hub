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

const inputCompact =
  "h-8 min-h-8 border-white/12 bg-slate-900/50 px-2.5 py-1 text-xs text-slate-200 placeholder:text-slate-500";

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
          <div className="plan-card-gradient-inner flex flex-col p-3 sm:p-4">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-cyan-400/90">Checkout</p>
                <h2 id={titleId} className="font-display text-base font-bold leading-tight text-white sm:text-lg">
                  Pagamento
                </h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 gap-0.5 px-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
                onClick={onClose}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar
              </Button>
            </div>

            {/* Resumo compacto: uma linha visual + preço à direita */}
            <div className="mt-2 flex shrink-0 flex-wrap items-end justify-between gap-x-2 gap-y-1 rounded-md border border-white/10 bg-black/25 px-2 py-1.5">
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

            <div className="mt-2 space-y-2">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
                <CreditCard className="h-3.5 w-3.5 shrink-0 text-cyan-400/80" />
                Cartão de crédito
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-x-2 sm:gap-y-1.5">
                <div className="space-y-0.5 sm:col-span-2">
                  <Label htmlFor="cc-name" className="text-[10px] text-slate-400">
                    Nome no cartão
                  </Label>
                  <Input
                    id="cc-name"
                    name="cc-name"
                    autoComplete="cc-name"
                    placeholder="Como no cartão"
                    className={inputCompact}
                  />
                </div>
                <div className="space-y-0.5 sm:col-span-2">
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
                  />
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor="cc-exp" className="text-[10px] text-slate-400">
                    Validade
                  </Label>
                  <Input
                    id="cc-exp"
                    name="cc-exp"
                    autoComplete="cc-exp"
                    placeholder="MM/AA"
                    className={inputCompact}
                  />
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor="cc-cvc" className="text-[10px] text-slate-400">
                    CVV
                  </Label>
                  <Input
                    id="cc-cvc"
                    name="cc-cvc"
                    autoComplete="cc-csc"
                    placeholder="•••"
                    className={inputCompact}
                  />
                </div>
                <div className="space-y-0.5 sm:col-span-2">
                  <Label className="text-[10px] text-slate-400">Parcelamento</Label>
                  <Select defaultValue="1">
                    <SelectTrigger className={`${inputCompact} h-8`}>
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

            <div className="mt-2 shrink-0 flex flex-col gap-1 border-t border-white/[0.06] pt-2">
              <Button
                type="button"
                variant="gradientCta"
                className="h-9 w-full rounded-full text-sm font-semibold"
                onClick={() => {
                  toast.info("Integração de pagamento", {
                    description:
                      "Ligue o gateway (Stripe, Pagar.me, Mercado Pago, etc.) no backend e envie o token do cartão de forma segura (PCI). Posso indicar os passos quando escolher o provedor.",
                  });
                }}
              >
                Confirmar pagamento
              </Button>
              <p className="text-center text-[9px] leading-tight text-slate-500">
                Dados do cartão só após configurar gateway no servidor.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
