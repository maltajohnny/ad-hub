import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchInsightHubAggregate, type RangeLabel } from "@/lib/insightHubApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";
import { RangePicker } from "@/pages/insight-hub/InsightHubBrandSelector";
import { RefreshCw } from "lucide-react";

const KEYS = ["page_impressions", "page_post_engagements", "ads_spend", "ads_clicks", "ads_reach"];

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return Math.round(n).toString();
}

function fmtBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

export default function InsightHubComparativo() {
  const [range, setRange] = useState<RangeLabel>("30d");
  const q = useQuery({
    queryKey: ["insight-hub", "aggregate", range, KEYS.join(",")],
    queryFn: () => fetchInsightHubAggregate(range, KEYS),
  });

  const chartData = useMemo(() => {
    if (!q.data) return [];
    return q.data.rows.map((r) => ({
      name: r.name,
      page_impressions: r.totals.page_impressions ?? 0,
      page_post_engagements: r.totals.page_post_engagements ?? 0,
      ads_spend: r.totals.ads_spend ?? 0,
    }));
  }, [q.data]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Comparativo</h1>
          <p className="text-sm text-muted-foreground">KPIs entre marcas da organização (multi-tenant isolado).</p>
        </div>
        <RangePicker value={range} onChange={setRange} />
      </header>

      {q.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" /> A consolidar comparativo…
        </div>
      ) : q.isError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base">Erro ao consolidar marcas</CardTitle>
            <CardDescription>{(q.error as Error)?.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : !q.data?.rows.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sem marcas com dados</CardTitle>
            <CardDescription>Crie marcas e ligue redes para popular o comparativo.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Engajamento e Impressões</CardTitle>
              <CardDescription>Soma do período por marca</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  page_impressions: { label: "Impressões", color: "hsl(var(--primary))" },
                  page_post_engagements: { label: "Engajamento", color: "hsl(var(--ring))" },
                  ads_spend: { label: "Spend (R$)", color: "hsl(var(--muted-foreground))" },
                }}
                className="h-80"
              >
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => fmt(Number(v))} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="page_impressions" fill="var(--color-page_impressions)" />
                  <Bar dataKey="page_post_engagements" fill="var(--color-page_post_engagements)" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tabela detalhada</CardTitle>
              <CardDescription>Comparação direta entre marcas.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Marca</TableHead>
                    <TableHead className="text-right">Impressões</TableHead>
                    <TableHead className="text-right">Engajamento</TableHead>
                    <TableHead className="text-right">Alcance Ads</TableHead>
                    <TableHead className="text-right">Cliques Ads</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.data.rows.map((r) => (
                    <TableRow key={r.brandId}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.totals.page_impressions ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.totals.page_post_engagements ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.totals.ads_reach ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.totals.ads_clicks ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtBRL(r.totals.ads_spend ?? 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
