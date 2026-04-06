import { useEffect, useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { isPlatformOperator } from "@/lib/saasTypes";
import PlatformDashboard from "@/pages/PlatformDashboard";
import { useKanban } from "@/contexts/KanbanContext";
import { clientsData, getClientDetail, type Client, type RoiTableRow } from "@/pages/Clientes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/components/FavoriteButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { TrendingUp, DollarSign, Eye, MousePointerClick, Target, ArrowUpRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { buildTrafficPerformanceReport } from "@/services/slackReportService";
import {
  analyzeCampaignPerformance,
  campaignAnalysisInputFromReport,
  isAiOptimizationConfigured,
  type CampaignOptimizationTile,
} from "@/services/aiOptimizationService";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

function parseRoiStr(roi: string): number {
  return parseFloat(roi.replace(/x/gi, "").replace(",", ".").trim()) || 0;
}

function formatImpressions(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(".", ",")}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString("pt-BR");
}

function formatClicks(n: number): string {
  return n.toLocaleString("pt-BR");
}

function brlCompact(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Escala a série demo de performance para valores de investimento próximos ao spend do cliente. */
function monthlyInvestFromDetail(c: Client, detail: ReturnType<typeof getClientDetail>) {
  const last = detail.performance[detail.performance.length - 1];
  const rawSum = last.meta + last.google + last.instagram;
  const targetMonthly = Math.max(1000, c.spendNumeric / 6);
  const scale = rawSum > 0 ? targetMonthly / rawSum : 120;
  return detail.performance.map((row) => ({
    month: row.month,
    meta: Math.max(0, Math.round(row.meta * scale)),
    google: Math.max(0, Math.round(row.google * scale)),
    instagram: Math.max(0, Math.round(row.instagram * scale)),
  }));
}

function kpiChanges(c: Client) {
  const k = c.id * 13;
  const inv = { t: `${c.leadsChangePct >= 0 ? "+" : ""}${c.leadsChangePct.toFixed(0)}%`, up: c.leadsChangePct >= 0 };
  const roiDelta = ((k % 8) / 10).toFixed(1);
  const roi = { t: `${k % 2 === 0 ? "+" : "-"}${roiDelta}x`, up: k % 2 === 0 };
  const imp = { t: `${c.convChangePct >= 0 ? "+" : ""}${c.convChangePct.toFixed(0)}%`, up: c.convChangePct >= 0 };
  const clk = { t: `${((k + 3) % 30) - 10 >= 0 ? "+" : ""}${((k + 3) % 30) - 10}%`, up: (k + 3) % 30 - 10 >= 0 };
  const conv = { t: `${c.convChangePct >= 0 ? "+" : ""}${c.convChangePct.toFixed(0)}%`, up: c.convChangePct >= 0 };
  const cpaPct = ((k * 5) % 21) - 10;
  const cpa = { t: `${cpaPct >= 0 ? "+" : ""}${cpaPct}%`, up: cpaPct <= 0 };
  return { inv, roi, imp, clk, conv, cpa };
}

const PLATFORM_COLORS = ["hsl(174, 72%, 52%)", "hsl(230, 60%, 60%)", "hsl(40, 90%, 55%)"];

function platformRoiChart(rows: RoiTableRow[]) {
  return rows.map((r, i) => ({
    name: r.channel,
    value: Math.round(r.roiMult * 10) / 10,
    color: PLATFORM_COLORS[i % PLATFORM_COLORS.length],
  }));
}

function aiRecommendationsForClient(c: Client, rows: RoiTableRow[]) {
  const sorted = [...rows].sort((a, b) => b.roiMult - a.roiMult);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const mid = sorted[1];
  const shortName = c.name.split(" ")[0];
  return [
    {
      platform: best.channel.replace(" Ads", ""),
      action: `Aumentar orçamento testado em ${best.channel.split(" ")[0]}`,
      reason: `ROI em ${best.channel} (${best.roiMult.toFixed(1)}×) lidera o mix — ${shortName} pode escalar com monitoramento de CPA.`,
      priority: "Alta" as const,
    },
    {
      platform: worst.channel.replace(" Ads", ""),
      action: `Rever criativos e segmentação em ${worst.channel.split(" ")[0]}`,
      reason: `CPA relativo mais alto em ${worst.channel}; alinhar mensagens ao que performa em ${best.channel.split(" ")[0]}.`,
      priority: "Média" as const,
    },
    {
      platform: mid.channel.replace(" Ads", ""),
      action: `Testar novos formatos em ${mid.channel.split(" ")[0]}`,
      reason: c.aiInsight.length > 60 ? `${c.aiInsight.slice(0, 140)}…` : c.aiInsight,
      priority: "Alta" as const,
    },
  ];
}

function tilesToDashboardRecs(tiles: CampaignOptimizationTile[]) {
  return tiles.map((t) => ({
    platform: t.platform.replace(/\sAds$/i, "").trim() || t.platform,
    action: t.action,
    reason: t.reason,
    priority: t.priority,
  }));
}

function buildView(c: Client | undefined) {
  if (!c) {
    return {
      kpis: [] as {
        label: string;
        value: string;
        change: string;
        up: boolean;
        icon: typeof DollarSign;
      }[],
      monthlyData: [] as { month: string; meta: number; google: number; instagram: number }[],
      platformROI: [] as { name: string; value: number; color: string }[],
      aiRecommendations: [] as {
        platform: string;
        action: string;
        reason: string;
        priority: "Alta" | "Média";
      }[],
    };
  }
  const detail = getClientDetail(c);
  const ch = kpiChanges(c);
  const kpis = [
    { label: "Investimento Total", value: c.spend, change: ch.inv.t, up: ch.inv.up, icon: DollarSign },
    { label: "ROI Médio", value: c.roi, change: ch.roi.t, up: ch.roi.up, icon: TrendingUp },
    { label: "Impressões", value: formatImpressions(c.impressions), change: ch.imp.t, up: ch.imp.up, icon: Eye },
    { label: "Cliques", value: formatClicks(c.clicks), change: ch.clk.t, up: ch.clk.up, icon: MousePointerClick },
    { label: "Conversões", value: String(c.conversions), change: ch.conv.t, up: ch.conv.up, icon: Target },
    { label: "CPA Médio", value: brlCompact(c.cpa), change: ch.cpa.t, up: ch.cpa.up, icon: ArrowUpRight },
  ];
  return {
    kpis,
    monthlyData: monthlyInvestFromDetail(c, detail),
    platformROI: platformRoiChart(detail.roiRows),
    aiRecommendations: aiRecommendationsForClient(c, detail.roiRows),
  };
}

const Dashboard = () => {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();
  const { user, canUserSeeClient } = useAuth();
  const { boardClientId, setBoardClientId } = useKanban();

  const visibleClients = useMemo(
    () => clientsData.filter((cl) => canUserSeeClient(cl.id)),
    [canUserSeeClient],
  );

  /** Melhor desempenho (ROI) primeiro na lista e como fallback de seleção. */
  const clientsByPerformance = useMemo(
    () => [...visibleClients].sort((a, b) => parseRoiStr(b.roi) - parseRoiStr(a.roi)),
    [visibleClients],
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (clientsByPerformance.length === 0) return;
    if (!clientsByPerformance.some((cl) => cl.id === boardClientId)) {
      setBoardClientId(clientsByPerformance[0].id);
    }
  }, [clientsByPerformance, boardClientId, setBoardClientId]);

  const currentClient = clientsByPerformance.find((cl) => cl.id === boardClientId) ?? clientsByPerformance[0];

  const view = useMemo(() => buildView(currentClient), [currentClient]);

  const [aiLiveRecs, setAiLiveRecs] = useState<ReturnType<typeof tilesToDashboardRecs> | null>(null);
  const [aiLiveLoading, setAiLiveLoading] = useState(false);

  useEffect(() => {
    setAiLiveRecs(null);
  }, [currentClient?.id]);

  const aiRecommendationsDisplay = useMemo(() => {
    if (aiLiveRecs && aiLiveRecs.length > 0) return aiLiveRecs;
    return view.aiRecommendations;
  }, [aiLiveRecs, view.aiRecommendations]);

  const refreshAiRecommendations = useCallback(async () => {
    if (!currentClient) return;
    if (!isAiOptimizationConfigured()) {
      toast.error("O serviço de IA não está disponível no momento.");
      return;
    }
    setAiLiveLoading(true);
    try {
      const report = buildTrafficPerformanceReport(currentClient);
      const input = campaignAnalysisInputFromReport(report);
      const out = await analyzeCampaignPerformance(input);
      setAiLiveRecs(tilesToDashboardRecs(out.tiles));
      toast.success("Recomendações geradas pela IA.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg.length > 100 ? `${msg.slice(0, 100)}…` : msg);
    } finally {
      setAiLiveLoading(false);
    }
  }, [currentClient]);

  const dashboardHeaderChrome = useMemo(
    () => (
      <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3 md:gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="text-lg sm:text-xl font-display font-bold shrink-0 text-foreground">Dashboard</h1>
          <span className="text-muted-foreground/80 hidden sm:inline" aria-hidden>
            —
          </span>
          {clientsByPerformance.length > 0 && currentClient ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex max-w-[min(100%,18rem)] items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1 text-sm font-semibold text-foreground transition-colors",
                    "hover:border-border hover:bg-muted/25",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  )}
                  aria-label={`Cliente: ${currentClient.name}. Clique para trocar.`}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/80" aria-hidden />
                  <span className="truncate">{currentClient.name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[12rem] p-1">
                {clientsByPerformance.map((cl) => (
                  <DropdownMenuItem
                    key={cl.id}
                    className={cn("cursor-pointer text-sm", cl.id === boardClientId && "bg-accent/80")}
                    onSelect={() => setBoardClientId(cl.id)}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="truncate">{cl.name}</span>
                      <span className="text-[10px] tabular-nums text-muted-foreground">{cl.roi}</span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="text-sm text-muted-foreground">Nenhum cliente disponível</span>
          )}
        </div>
        <div className="hidden min-h-[1.75rem] sm:block" aria-hidden />
      </div>
    ),
    [clientsByPerformance, currentClient, boardClientId, setBoardClientId],
  );

  const headerSlot =
    typeof document !== "undefined" ? document.getElementById("app-header-slot") : null;

  const isLight = mounted && resolvedTheme === "light";
  const chartGrid = isLight ? "hsl(220, 13%, 88%)" : "hsl(220, 14%, 18%)";
  const chartAxis = isLight ? "hsl(220, 9%, 42%)" : "hsl(215, 12%, 55%)";
  const tooltipStyle = {
    background: isLight ? "hsl(0, 0%, 100%)" : "hsl(220, 18%, 10%)",
    border: `1px solid ${isLight ? "hsl(220, 13%, 90%)" : "hsl(220, 14%, 18%)"}`,
    borderRadius: "8px",
    color: isLight ? "hsl(222, 47%, 11%)" : "hsl(210, 20%, 95%)",
  };

  const cid = currentClient?.id ?? 0;
  const gradPrefix = `dash-${cid}`;

  if (isPlatformOperator(user?.username)) {
    return <PlatformDashboard />;
  }

  return (
    <>
      {headerSlot ? createPortal(dashboardHeaderChrome, headerSlot) : null}
      <div className="space-y-6 animate-fade-in">
        <div className="space-y-1 pt-1">
          <p className="text-muted-foreground text-sm">
            Visão geral do tráfego pago — {currentClient ? currentClient.name : "—"} — Junho 2026
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {view.kpis.map((kpi) => {
            const slug = encodeURIComponent(kpi.label);
            return (
              <Card key={`${cid}:${kpi.label}`} className="glass-card p-4 hover:glow-primary transition-shadow relative">
                <div className="absolute top-2 right-2 z-10">
                  <FavoriteButton
                    id={`dashboard:${cid}:kpi:${slug}`}
                    kind="dashboard-kpi"
                    title={`KPI: ${kpi.label}`}
                    path="/dashboard"
                    subtitle={kpi.value}
                    size="sm"
                  />
                </div>
                <div className="flex items-center justify-between mb-2 pr-6">
                  <kpi.icon size={16} className="text-primary" />
                  <span className={`text-xs font-medium ${kpi.up ? "text-success" : "text-destructive"}`}>
                    {kpi.change}
                  </span>
                </div>
                <p className="text-lg font-display font-bold">{kpi.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
              </Card>
            );
          })}
        </div>

        {/* Charts row */}
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="glass-card p-5 lg:col-span-2 relative">
            <div className="absolute top-4 right-4 z-10">
              <FavoriteButton
                id={`dashboard:${cid}:chart:investimento-plataforma`}
                kind="dashboard-chart"
                title="Gráfico: Investimento por Plataforma"
                path="/dashboard"
                subtitle={currentClient?.name ?? "Dashboard"}
                size="sm"
              />
            </div>
            <h3 className="font-display font-semibold mb-4 pr-10">Investimento por Plataforma</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={view.monthlyData}>
                <defs>
                  <linearGradient id={`${gradPrefix}-metaGrad`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(174, 72%, 52%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(174, 72%, 52%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={`${gradPrefix}-googleGrad`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(230, 60%, 60%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(230, 60%, 60%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={`${gradPrefix}-igGrad`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(40, 90%, 55%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(40, 90%, 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                <XAxis dataKey="month" stroke={chartAxis} fontSize={12} />
                <YAxis stroke={chartAxis} fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="meta"
                  stroke="hsl(174, 72%, 52%)"
                  fill={`url(#${gradPrefix}-metaGrad)`}
                  strokeWidth={2}
                  name="Meta Ads"
                />
                <Area
                  type="monotone"
                  dataKey="google"
                  stroke="hsl(230, 60%, 60%)"
                  fill={`url(#${gradPrefix}-googleGrad)`}
                  strokeWidth={2}
                  name="Google Ads"
                />
                <Area
                  type="monotone"
                  dataKey="instagram"
                  stroke="hsl(40, 90%, 55%)"
                  fill={`url(#${gradPrefix}-igGrad)`}
                  strokeWidth={2}
                  name="Instagram"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card className="glass-card p-5 relative">
            <div className="absolute top-4 right-4 z-10">
              <FavoriteButton
                id={`dashboard:${cid}:chart:roi-plataforma`}
                kind="dashboard-chart"
                title="Gráfico: ROI por Plataforma"
                path="/dashboard"
                subtitle={currentClient?.name ?? "Dashboard"}
                size="sm"
              />
            </div>
            <h3 className="font-display font-semibold mb-4 pr-10">ROI por Plataforma</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={view.platformROI} layout="vertical">
                <XAxis type="number" stroke={chartAxis} fontSize={12} />
                <YAxis type="category" dataKey="name" stroke={chartAxis} fontSize={12} width={90} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} name="ROI">
                  {view.platformROI.map((entry, index) => (
                    <Cell key={`${cid}-${entry.name}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {view.platformROI.map((p) => (
                <div key={`${cid}-${p.name}`} className="flex items-center justify-between text-sm">
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full gradient-brand animate-pulse-glow shrink-0" />
              <h3 className="font-display font-semibold">Recomendações da IA</h3>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {aiLiveRecs ? "Gerado pela OpenAI" : "Regras demo (clique para IA)"}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-1.5 h-8"
                disabled={aiLiveLoading || !currentClient}
                onClick={() => void refreshAiRecommendations()}
              >
                {aiLiveLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Gerar com IA
              </Button>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {aiRecommendationsDisplay.map((rec, i) => (
              <div key={`${cid}-ai-${i}-${rec.platform}`} className="bg-secondary/50 rounded-lg p-4 space-y-2 relative">
                <div className="absolute top-2 right-2 z-10">
                  <FavoriteButton
                    id={`dashboard:${cid}:ai:${i}:${rec.platform}`}
                    kind="dashboard-ai"
                    title={`IA: ${rec.platform} — ${rec.action}`}
                    path="/dashboard"
                    subtitle={rec.priority}
                    size="sm"
                  />
                </div>
                <div className="flex items-center justify-between pr-7">
                  <span className="text-sm font-medium gradient-brand-text">{rec.platform}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${rec.priority === "Alta" ? "bg-primary/20 text-primary" : "bg-warning/20 text-warning"}`}
                  >
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
    </>
  );
};

export default Dashboard;
