import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Eye, MousePointerClick, Target, ArrowUpRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

const kpis = [
  { label: "Investimento Total", value: "R$ 45.230", change: "+12%", up: true, icon: DollarSign },
  { label: "ROI Médio", value: "3.8x", change: "+0.4x", up: true, icon: TrendingUp },
  { label: "Impressões", value: "2.4M", change: "-3%", up: false, icon: Eye },
  { label: "Cliques", value: "89.400", change: "+18%", up: true, icon: MousePointerClick },
  { label: "Conversões", value: "1.247", change: "+22%", up: true, icon: Target },
  { label: "CPA Médio", value: "R$ 36,26", change: "-8%", up: true, icon: ArrowUpRight },
];

const monthlyData = [
  { month: "Jan", meta: 12000, google: 8500, instagram: 6200 },
  { month: "Fev", meta: 14200, google: 9100, instagram: 7400 },
  { month: "Mar", meta: 13800, google: 10200, instagram: 8100 },
  { month: "Abr", meta: 16500, google: 11800, instagram: 9200 },
  { month: "Mai", meta: 15200, google: 12400, instagram: 10500 },
  { month: "Jun", meta: 18900, google: 14200, instagram: 12100 },
];

const platformROI = [
  { name: "Meta Ads", value: 4.2, color: "hsl(174, 72%, 52%)" },
  { name: "Google Ads", value: 3.6, color: "hsl(230, 60%, 60%)" },
  { name: "Instagram", value: 3.4, color: "hsl(40, 90%, 55%)" },
];

const aiRecommendations = [
  { platform: "Meta Ads", action: "Aumentar orçamento em 15%", reason: "ROI crescendo consistentemente nos últimos 3 meses", priority: "Alta" },
  { platform: "Google Ads", action: "Redistribuir para campanhas de Search", reason: "Campanhas de Display com CPA 40% acima da média", priority: "Média" },
  { platform: "Instagram", action: "Testar novos criativos em Reels", reason: "Engajamento em Reels 3x maior que Stories", priority: "Alta" },
];

const Dashboard = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral do tráfego pago — Junho 2026</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="glass-card p-4 hover:glow-primary transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <kpi.icon size={16} className="text-primary" />
              <span className={`text-xs font-medium ${kpi.up ? "text-success" : "text-destructive"}`}>
                {kpi.change}
              </span>
            </div>
            <p className="text-lg font-display font-bold">{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Area chart */}
        <Card className="glass-card p-5 lg:col-span-2">
          <h3 className="font-display font-semibold mb-4">Investimento por Plataforma</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="metaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(174, 72%, 52%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(174, 72%, 52%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="googleGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(230, 60%, 60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(230, 60%, 60%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="igGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(40, 90%, 55%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(40, 90%, 55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
              <XAxis dataKey="month" stroke="hsl(215, 12%, 55%)" fontSize={12} />
              <YAxis stroke="hsl(215, 12%, 55%)" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(220, 18%, 10%)", border: "1px solid hsl(220, 14%, 18%)", borderRadius: "8px", color: "hsl(210, 20%, 95%)" }} />
              <Area type="monotone" dataKey="meta" stroke="hsl(174, 72%, 52%)" fill="url(#metaGrad)" strokeWidth={2} name="Meta Ads" />
              <Area type="monotone" dataKey="google" stroke="hsl(230, 60%, 60%)" fill="url(#googleGrad)" strokeWidth={2} name="Google Ads" />
              <Area type="monotone" dataKey="instagram" stroke="hsl(40, 90%, 55%)" fill="url(#igGrad)" strokeWidth={2} name="Instagram" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* ROI by platform */}
        <Card className="glass-card p-5">
          <h3 className="font-display font-semibold mb-4">ROI por Plataforma</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={platformROI} layout="vertical">
              <XAxis type="number" stroke="hsl(215, 12%, 55%)" fontSize={12} />
              <YAxis type="category" dataKey="name" stroke="hsl(215, 12%, 55%)" fontSize={12} width={90} />
              <Tooltip contentStyle={{ background: "hsl(220, 18%, 10%)", border: "1px solid hsl(220, 14%, 18%)", borderRadius: "8px", color: "hsl(210, 20%, 95%)" }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} name="ROI">
                {platformROI.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {platformROI.map((p) => (
              <div key={p.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                  <span className="text-muted-foreground">{p.name}</span>
                </div>
                <span className="font-semibold">{p.value}x</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* AI Recommendations */}
      <Card className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full gradient-brand animate-pulse-glow" />
          <h3 className="font-display font-semibold">Recomendações da IA</h3>
          <span className="text-xs text-muted-foreground ml-auto">Atualizado agora</span>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {aiRecommendations.map((rec, i) => (
            <div key={i} className="bg-secondary/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium gradient-brand-text">{rec.platform}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${rec.priority === "Alta" ? "bg-primary/20 text-primary" : "bg-warning/20 text-warning"}`}>
                  {rec.priority}
                </span>
              </div>
              <p className="text-sm font-medium">{rec.action}</p>
              <p className="text-xs text-muted-foreground">{rec.reason}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
