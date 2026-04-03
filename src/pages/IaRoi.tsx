import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Zap, Brain, ArrowRight } from "lucide-react";

const flowSteps = [
  { step: 1, title: "Coleta de Dados", desc: "APIs do Meta, Google e Instagram enviam dados de campanhas", input: "Tokens de acesso das plataformas", output: "Impressões, cliques, conversões, gastos" },
  { step: 2, title: "Processamento", desc: "Normalização e cruzamento de métricas", input: "Dados brutos de cada plataforma", output: "Métricas unificadas por período" },
  { step: 3, title: "Análise de IA", desc: "Modelo analisa padrões de ROI e tendências", input: "Histórico de 6 meses + metas", output: "Score de eficiência por canal" },
  { step: 4, title: "Recomendação", desc: "Sugestão de realocação de budget", input: "Scores + orçamento total disponível", output: "% ideal por plataforma + ações" },
];

const budgetAllocation = [
  { name: "Meta Ads", current: 42, recommended: 48 },
  { name: "Google Ads", current: 35, recommended: 30 },
  { name: "Instagram", current: 23, recommended: 22 },
];

const IaRoi = () => (
  <div className="space-y-6 animate-fade-in">
    <div>
      <h1 className="text-2xl font-display font-bold">IA & Análise de ROI</h1>
      <p className="text-muted-foreground text-sm mt-1">Fluxo de tomada de decisão baseado em IA</p>
    </div>

    {/* Flow */}
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {flowSteps.map((s, i) => (
        <Card key={s.step} className="glass-card p-5 relative" style={{ animationDelay: `${i * 100}ms` }}>
          <div className="w-8 h-8 rounded-full gradient-brand flex items-center justify-center text-sm font-bold text-primary-foreground mb-3">
            {s.step}
          </div>
          <h3 className="font-display font-semibold text-sm mb-1">{s.title}</h3>
          <p className="text-xs text-muted-foreground mb-3">{s.desc}</p>
          <div className="space-y-2 text-xs">
            <div className="bg-secondary/50 rounded p-2">
              <span className="text-primary font-medium">Input:</span>
              <p className="text-muted-foreground mt-0.5">{s.input}</p>
            </div>
            <div className="bg-secondary/50 rounded p-2">
              <span className="text-success font-medium">Output:</span>
              <p className="text-muted-foreground mt-0.5">{s.output}</p>
            </div>
          </div>
          {i < flowSteps.length - 1 && (
            <ArrowRight size={16} className="absolute -right-2.5 top-1/2 text-primary hidden lg:block" />
          )}
        </Card>
      ))}
    </div>

    {/* Budget Allocation */}
    <Card className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Brain size={18} className="text-primary" />
        <h3 className="font-display font-semibold">Realocação de Orçamento Recomendada</h3>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={budgetAllocation}>
            <XAxis dataKey="name" stroke="hsl(215, 12%, 55%)" fontSize={12} />
            <YAxis stroke="hsl(215, 12%, 55%)" fontSize={12} unit="%" />
            <Tooltip contentStyle={{ background: "hsl(220, 18%, 10%)", border: "1px solid hsl(220, 14%, 18%)", borderRadius: "8px", color: "hsl(210, 20%, 95%)" }} />
            <Bar dataKey="current" name="Atual" fill="hsl(220, 14%, 25%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="recommended" name="Recomendado" fill="hsl(174, 72%, 52%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="space-y-4">
          {budgetAllocation.map((b) => (
            <div key={b.name} className="flex items-center justify-between bg-secondary/30 rounded-lg p-3">
              <span className="text-sm font-medium">{b.name}</span>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">{b.current}%</span>
                <ArrowRight size={14} className="text-primary" />
                <span className="font-semibold text-primary">{b.recommended}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  </div>
);

export default IaRoi;
