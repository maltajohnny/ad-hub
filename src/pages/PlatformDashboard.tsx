import { useMemo } from "react";
import { useTheme } from "next-themes";
import { Card } from "@/components/ui/card";
import { Building2, Sparkles, TrendingUp, UsersRound } from "lucide-react";
import { listTenants } from "@/lib/tenantsStore";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/** Indicadores agregados da plataforma (assinantes / organizações), sem dados de clientes finais. */
const TREND_DEMO = [
  { month: "Jan", valorAgregado: 42 },
  { month: "Fev", valorAgregado: 58 },
  { month: "Mar", valorAgregado: 71 },
  { month: "Abr", valorAgregado: 84 },
  { month: "Mai", valorAgregado: 96 },
  { month: "Jun", valorAgregado: 112 },
];

export default function PlatformDashboard() {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === "light";
  const chartGrid = isLight ? "hsl(220, 13%, 88%)" : "hsl(220, 14%, 18%)";
  const chartAxis = isLight ? "hsl(220, 9%, 42%)" : "hsl(215, 12%, 55%)";
  const tooltipStyle = {
    background: isLight ? "hsl(0, 0%, 100%)" : "hsl(220, 18%, 10%)",
    border: `1px solid ${isLight ? "hsl(220, 13%, 90%)" : "hsl(220, 14%, 18%)"}`,
    borderRadius: "8px",
    color: isLight ? "hsl(222, 47%, 11%)" : "hsl(210, 20%, 95%)",
  };

  const orgCount = useMemo(() => listTenants().length, []);

  const kpis = [
    {
      label: "Organizações na plataforma",
      value: String(orgCount),
      hint: "Contas que assinam e utilizam a QTRAFFIC",
      icon: Building2,
    },
    {
      label: "Índice demo de impacto (agregado)",
      value: "112",
      hint: "Escala interna — valor entregue às orgs (demo)",
      icon: TrendingUp,
    },
    {
      label: "Utilizadores ativos (estimativa demo)",
      value: String(Math.max(12, orgCount * 4)),
      hint: "Não inclui clientes finais dos seus clientes",
      icon: UsersRound,
    },
    {
      label: "Automação & IA",
      value: "Ativo",
      hint: "Serviços de plataforma disponíveis",
      icon: Sparkles,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1 pt-1">
        <h1 className="text-xl font-display font-bold">Dashboard da plataforma</h1>
        <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed">
          Visão para a equipa QTRAFFIC: organizações que assinam a plataforma e impacto agregado. Aqui não entram métricas de
          campanhas dos clientes das suas organizações — isso continua nos módulos operacionais por organização.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2 text-primary">
              <k.icon size={18} />
            </div>
            <p className="text-2xl font-display font-bold tabular-nums">{k.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{k.label}</p>
            <p className="text-[10px] text-muted-foreground/80 mt-2 leading-snug">{k.hint}</p>
          </Card>
        ))}
      </div>

      <Card className="glass-card p-5">
        <h3 className="font-display font-semibold mb-1">Evolução (demo) — impacto agregado nas organizações</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Série ilustrativa; em produção liga a métricas reais de utilização e valor por tenant.
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={TREND_DEMO}>
            <defs>
              <linearGradient id="plat-val" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(174, 72%, 52%)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="hsl(174, 72%, 52%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
            <XAxis dataKey="month" stroke={chartAxis} fontSize={12} />
            <YAxis stroke={chartAxis} fontSize={12} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area
              type="monotone"
              dataKey="valorAgregado"
              name="Índice de impacto (demo)"
              stroke="hsl(174, 72%, 52%)"
              fill="url(#plat-val)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
