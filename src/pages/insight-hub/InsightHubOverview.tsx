import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchInsightHubOverview, type RangeLabel } from "@/lib/insightHubApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { InsightHubBrandSelector, RangePicker } from "@/pages/insight-hub/InsightHubBrandSelector";
import { RefreshCw } from "lucide-react";

type SeriesPoint = { date: string; metricKey: string; value: number };

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return Math.round(n).toString();
}

function formatBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

const KPI_CARDS: { key: string; title: string; description: string; format: (v: number) => string }[] = [
  { key: "page_impressions", title: "Impressões da página", description: "Total no período", format: formatNumber },
  { key: "page_impressions_unique", title: "Alcance da página", description: "Pessoas únicas alcançadas", format: formatNumber },
  { key: "page_post_engagements", title: "Engajamento", description: "Cliques, reações, comentários", format: formatNumber },
  { key: "page_fan_adds", title: "Novos fãs", description: "Crescimento da audiência", format: formatNumber },
  { key: "ads_spend", title: "Investimento (Ads)", description: "Gasto em campanhas Meta Ads", format: formatBRL },
  { key: "ads_clicks", title: "Cliques (Ads)", description: "Cliques pagos no período", format: formatNumber },
];

function pivotSeries(points: SeriesPoint[], keys: string[]): { date: string; [k: string]: string | number }[] {
  const map = new Map<string, Record<string, number>>();
  for (const p of points) {
    if (!keys.includes(p.metricKey)) continue;
    const cur = map.get(p.date) ?? {};
    cur[p.metricKey] = (cur[p.metricKey] ?? 0) + p.value;
    map.set(p.date, cur);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, values]) => {
      const row: { date: string; [k: string]: string | number } = { date };
      for (const k of keys) row[k] = values[k] ?? 0;
      return row;
    });
}

export default function InsightHubOverview() {
  const [brandId, setBrandId] = useState<string | null>(null);
  const [range, setRange] = useState<RangeLabel>("30d");

  const q = useQuery({
    queryKey: ["insight-hub", "overview", brandId, range],
    queryFn: () => fetchInsightHubOverview(brandId as string, range),
    enabled: !!brandId,
  });

  const orgChart = useMemo(
    () => (q.data ? pivotSeries(q.data.series as SeriesPoint[], ["page_impressions", "page_post_engagements"]) : []),
    [q.data],
  );
  const adsChart = useMemo(
    () => (q.data ? pivotSeries(q.data.series as SeriesPoint[], ["ads_spend", "ads_clicks"]) : []),
    [q.data],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Overview</h1>
          <p className="text-sm text-muted-foreground">KPIs consolidados das conexões da marca selecionada.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <InsightHubBrandSelector value={brandId} onChange={setBrandId} />
          <RangePicker value={range} onChange={setRange} />
        </div>
      </header>

      {!brandId ? null : q.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" /> A agregar métricas…
        </div>
      ) : q.isError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base">Não foi possível carregar overview</CardTitle>
            <CardDescription>{(q.error as Error)?.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          {q.data?.connectedProviders.length ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Conectado:</span>
              {q.data.connectedProviders.map((p) => (
                <Badge key={p} variant="secondary" className="text-[11px]">
                  {p}
                </Badge>
              ))}
            </div>
          ) : (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="text-base">Sem conexões ativas para esta marca</CardTitle>
                <CardDescription>
                  Vá a <strong>Conexões</strong> para ligar Facebook, Instagram ou Meta Ads — sem isso o scheduler não recebe dados.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {KPI_CARDS.map((kpi) => {
              const v = q.data?.totals?.[kpi.key] ?? 0;
              return (
                <Card key={kpi.key}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
                    <CardDescription className="text-[11px]">{kpi.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold tabular-nums">{kpi.format(Number(v) || 0)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Impressões e Engajamento</CardTitle>
                <CardDescription>Página · diário</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    page_impressions: { label: "Impressões", color: "hsl(var(--primary))" },
                    page_post_engagements: { label: "Engajamento", color: "hsl(var(--ring))" },
                  }}
                  className="h-72"
                >
                  <AreaChart data={orgChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(d) => (d as string).slice(5)} />
                    <YAxis tickFormatter={(v) => formatNumber(Number(v))} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Area type="monotone" dataKey="page_impressions" stroke="var(--color-page_impressions)" fill="var(--color-page_impressions)" fillOpacity={0.15} />
                    <Area type="monotone" dataKey="page_post_engagements" stroke="var(--color-page_post_engagements)" fill="var(--color-page_post_engagements)" fillOpacity={0.15} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Spend vs Cliques (Ads)</CardTitle>
                <CardDescription>Meta Ads · diário</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    ads_spend: { label: "Spend", color: "hsl(var(--primary))" },
                    ads_clicks: { label: "Cliques", color: "hsl(var(--ring))" },
                  }}
                  className="h-72"
                >
                  <LineChart data={adsChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(d) => (d as string).slice(5)} />
                    <YAxis yAxisId="left" tickFormatter={(v) => formatBRL(Number(v))} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => formatNumber(Number(v))} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="ads_spend" stroke="var(--color-ads_spend)" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="ads_clicks" stroke="var(--color-ads_clicks)" strokeWidth={2} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
