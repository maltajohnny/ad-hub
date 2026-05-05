import { Link } from "react-router-dom";
import { Check, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Row = { label: string; ok: boolean; hint?: string };

const PLANS: {
  id: string;
  name: string;
  blurb: string;
  price: string;
  period: string;
  highlight?: boolean;
  rows: Row[];
}[] = [
  {
    id: "essencial",
    name: "Essencial",
    blurb: "Relatórios profissionais sem painéis em tempo real.",
    price: "R$ 42",
    period: "/mês · faturação anual equivalente",
    rows: [
      { label: "Relatórios ilimitados", ok: true },
      { label: "Personalização de relatórios", ok: true },
      { label: "Dashboards", ok: false },
      { label: "Utilizadores convidados", ok: false },
      { label: "Relatórios agendados", ok: false },
      { label: "Análise IA", ok: false },
      { label: "Portal do cliente / white-label", ok: false },
    ],
  },
  {
    id: "crescimento",
    name: "Crescimento",
    blurb: "Para agências que precisam de painéis e rotinas.",
    price: "R$ 58",
    period: "/mês · faturação anual equivalente",
    rows: [
      { label: "Relatórios ilimitados", ok: true },
      { label: "Personalização de relatórios", ok: true },
      { label: "Até 5 dashboards", ok: true },
      { label: "3 utilizadores convidados", ok: true },
      { label: "5 relatórios agendados", ok: true },
      { label: "Análise IA", ok: false },
      { label: "Portal do cliente / white-label", ok: false },
    ],
  },
  {
    id: "premium",
    name: "Premium",
    blurb: "Escala total: IA, portal e integrações avançadas.",
    price: "R$ 74",
    period: "/mês · faturação anual equivalente",
    highlight: true,
    rows: [
      { label: "Relatórios ilimitados", ok: true },
      { label: "Personalização de relatórios", ok: true },
      { label: "Dashboards por marca (escala)", ok: true, hint: "conforme limite de marcas" },
      { label: "Convidados ilimitados", ok: true },
      { label: "Agendamentos ilimitados", ok: true },
      { label: "Análise IA", ok: true },
      { label: "Análise de concorrentes · grupos · portal", ok: true },
    ],
  },
];

export function InsightHubPlansModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[min(96vw,1120px)] p-0 border-border/60 bg-background"
        disableInnerScroll
      >
        <div className="max-h-[88vh] overflow-y-auto px-6 pb-6 pt-5">
          <DialogHeader className="mb-4 text-left">
            <DialogTitle>Planos Insight Hub</DialogTitle>
            <DialogDescription>
              Valores na mesma ordem de grandeza das referências de mercado, com identidade AD-Hub.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-3">
            {PLANS.map((p) => (
              <Card
                key={p.id}
                className={cn(
                  "relative flex flex-col border-border/60",
                  p.highlight && "border-primary/40 shadow-md shadow-primary/10",
                )}
              >
                {p.highlight ? (
                  <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                    Mais completo
                  </div>
                ) : null}
                <CardHeader>
                  <CardTitle className="text-lg">{p.name}</CardTitle>
                  <CardDescription>{p.blurb}</CardDescription>
                  <div className="pt-2">
                    <span className="text-3xl font-bold tracking-tight">{p.price}</span>
                    <span className="text-sm text-muted-foreground">{p.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-2">
                  {p.rows.map((r) => (
                    <div key={r.label} className="flex gap-2 text-sm">
                      {r.ok ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                      ) : (
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
                      )}
                      <span className={cn(!r.ok && "text-muted-foreground line-through decoration-muted-foreground/40")}>
                        {r.label}
                        {r.hint ? <span className="block text-[11px] font-normal text-muted-foreground">{r.hint}</span> : null}
                      </span>
                    </div>
                  ))}
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                  <Button asChild className="w-full gap-2" variant={p.highlight ? "default" : "outline"}>
                    <Link to="/planos" onClick={() => onOpenChange(false)}>
                      <Sparkles className="h-4 w-4" aria-hidden />
                      Contratar via AD-Hub
                    </Link>
                  </Button>
                  <p className="text-center text-[11px] text-muted-foreground">
                    Checkout Asaas / faturação em integração com a sua organização.
                  </p>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
