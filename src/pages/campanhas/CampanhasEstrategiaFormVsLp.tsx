import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Scale } from "lucide-react";

const ROWS = [
  { metric: "Custo por lead (médio)", native: "R$ 42", lp: "R$ 58" },
  { metric: "Taxa de conversão", native: "4,2%", lp: "2,8%" },
  { metric: "Qualidade do lead (score)", native: "7,1 / 10", lp: "8,4 / 10" },
];

export default function CampanhasEstrategiaFormVsLp() {
  const [budget, setBudget] = useState([5000]);

  const simNative = Math.round((budget[0] / 42) * 10) / 10;
  const simLp = Math.round((budget[0] / 58) * 10) / 10;

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h2 className="text-lg font-semibold">Estratégia: formulário nativo vs landing page</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Compare custo, conversão e qualidade; simule volume de leads antes de decidir o funil.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4 border-emerald-500/25 bg-emerald-500/[0.04]">
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-emerald-600 hover:bg-emerald-600">Formulário nativo</Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Melhor quando: volume rápido, mobile-first, lead quente no contexto do anúncio. Menos fricção.
          </p>
          <ul className="text-xs space-y-1 text-foreground/90">
            <li>• Integração direta Meta Lead Ads / Instant Form</li>
            <li>• Menor CPL em muitos nichos B2C</li>
            <li>• Qualidade variável — use perguntas qualificadoras</li>
          </ul>
        </Card>
        <Card className="p-4 border-sky-500/25 bg-sky-500/[0.05]">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="border-sky-500/50 text-sky-700 dark:text-sky-300">
              Landing page
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Melhor quando: precisa educar, prova social longa, SEO ou remarketing com página própria.
          </p>
          <ul className="text-xs space-y-1 text-foreground/90">
            <li>• Controle total de mensagem e tracking</li>
            <li>• CPL maior, mas leads muitas vezes mais qualificados</li>
            <li>• Ideal para infoprodutos e B2B</li>
          </ul>
        </Card>
      </div>

      <Card className="p-4 border-border/60 overflow-x-auto">
        <div className="flex items-center gap-2 mb-3">
          <Scale className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Comparação visual (dados demo)</h3>
        </div>
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="border-b border-border/50 text-left text-muted-foreground text-xs">
              <th className="pb-2 pr-4">Métrica</th>
              <th className="pb-2 pr-4">Formulário nativo</th>
              <th className="pb-2">Landing page</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.metric} className="border-b border-border/30">
                <td className="py-2.5 pr-4">{r.metric}</td>
                <td className="py-2.5 pr-4 font-medium text-emerald-600 dark:text-emerald-400">{r.native}</td>
                <td className="py-2.5 font-medium text-sky-600 dark:text-sky-400">{r.lp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-4 border-border/60 space-y-4">
        <Label className="text-sm">Simulação de resultados — orçamento mensal (R$)</Label>
        <div className="px-1">
          <Slider value={budget} onValueChange={setBudget} min={1000} max={50000} step={500} />
          <p className="text-xs text-muted-foreground mt-2">
            Orçamento: <strong className="text-foreground">{budget[0].toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-secondary/40 p-3">
            <p className="text-xs text-muted-foreground">Leads estimados (form. nativo)</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{simNative}</p>
          </div>
          <div className="rounded-lg bg-secondary/40 p-3">
            <p className="text-xs text-muted-foreground">Leads estimados (landing)</p>
            <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">{simLp}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Simulação usa CPL médio da tabela acima; em produção, conecte métricas reais da conta via API.
        </p>
      </Card>
    </div>
  );
}
