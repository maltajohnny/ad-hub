import { loadIntelliSearchHistory } from "@/lib/intellisearchHistory";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function IntelliSearchEvolutionPage() {
  const rows = loadIntelliSearchHistory();
  const chronological = [...rows].reverse();
  const chartData = chronological.map((r, i) => ({
    i: i + 1,
    label: r.name || r.query.slice(0, 24),
    pontos: r.score,
    t: new Date(r.at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Evolução da análise</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Pontuações das análises guardadas localmente (ordem cronológica). Cada ponto corresponde a uma execução
          IntelliSearch.
        </p>
      </div>

      <Card className="border-border/60 max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">Pontuação ao longo do tempo</CardTitle>
          <CardDescription>Mínimo 2 registos para uma linha significativa</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length < 2 ? (
            <p className="text-sm text-muted-foreground">
              Faça pelo menos duas análises (ex.: Análise completa) para ver a evolução.
            </p>
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="t" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} width={36} tick={{ fontSize: 11 }} />
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="rounded-md border border-border bg-background/95 px-2 py-1.5 text-xs shadow-md">
                          <div className="font-medium">{String(payload[0].payload.label)}</div>
                          <div>Pontuação: {String(payload[0].value)}</div>
                        </div>
                      ) : null
                    }
                  />
                  <Line type="monotone" dataKey="pontos" stroke="hsl(var(--primary))" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
