import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ExternalLink,
  MapPin,
  Phone,
  Globe,
  Clock,
  XCircle,
  Store,
  Loader2,
  Search,
  Wand2,
  Sparkles,
} from "lucide-react";
import { IntelliSearchNewBadge } from "@/components/IntelliSearchNewBadge";

type CheckStatus = "good" | "reasonable" | "weak";

type CheckItem = {
  id: string;
  category: string;
  label: string;
  status: CheckStatus;
  detail: string;
};

const MOCK_CHECKS: CheckItem[] = [
  { id: "1", category: "Avaliações", label: "Média de avaliações", status: "good", detail: "4,6 — acima da média do setor local." },
  { id: "2", category: "Avaliações", label: "Avaliações sem resposta", status: "weak", detail: "Existem avaliações recentes por responder." },
  { id: "3", category: "Mídia", label: "Fotos do negócio", status: "good", detail: "Quantidade adequada e atualizada." },
  { id: "4", category: "Mídia", label: "Vídeos", status: "weak", detail: "Nenhum vídeo publicado no perfil." },
  { id: "5", category: "Perfil", label: "Data de fundação", status: "good", detail: "Informação preenchida." },
  { id: "6", category: "Perfil", label: "Categoria principal", status: "good", detail: "Alinhada ao negócio." },
  { id: "7", category: "Perfil", label: "Descrição", status: "reasonable", detail: "Pode ser expandida com palavras-chave locais." },
  { id: "8", category: "Horário", label: "Horário especial / feriados", status: "reasonable", detail: "Atualizar para próximas datas." },
];

const SCORE = 91;

const TIER_COUNTS = { weak: 2, reasonable: 0, good: 22 };

const TIER_COLORS = {
  weak: "hsl(0 72% 52%)",
  reasonable: "hsl(45 90% 48%)",
  good: "hsl(174 72% 42%)",
};

const barData = [
  { name: "Fraco", value: TIER_COUNTS.weak, fill: TIER_COLORS.weak },
  { name: "Razoável", value: TIER_COUNTS.reasonable, fill: TIER_COLORS.reasonable },
  { name: "Bom", value: TIER_COUNTS.good, fill: TIER_COLORS.good },
];

function statusIcon(status: CheckStatus) {
  if (status === "good") return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />;
  if (status === "reasonable") return <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />;
  return <XCircle className="h-4 w-4 shrink-0 text-red-500" aria-hidden />;
}

function buildProfileFromQuery(q: string) {
  const trimmed = q.trim() || "Negócio local";
  return {
    name: trimmed,
    category: "Categoria estimada (demo)",
    rating: 4.6,
    reviews: 76,
    address: "Endereço público do Maps (demo)",
    hours: "Seg–Sex 9h–18h · Sáb 9h–13h",
    site: "https://exemplo.com.br",
    phone: "(19) 3400-0000",
    description:
      "Descrição pública do perfil no Google (demonstração). Em produção, os dados vêm da API / Places conforme o negócio encontrado.",
  };
}

export default function IntelliSearch() {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const profile = useMemo(() => buildProfileFromQuery(activeQuery), [activeQuery]);

  const scorePct = Math.min(100, Math.max(0, SCORE));
  const stackedScore = useMemo(
    () => [{ label: "score", pontos: scorePct, resto: 100 - scorePct }],
    [scorePct],
  );

  const runSearch = () => {
    if (!query.trim()) return;
    setLoading(true);
    setShowResults(false);
    window.setTimeout(() => {
      setActiveQuery(query.trim());
      setShowResults(true);
      setLoading(false);
    }, 650);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl flex flex-wrap items-center gap-x-2 gap-y-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25">
                <Wand2 className="h-5 w-5" aria-hidden />
              </span>
              <Sparkles className="h-6 w-6 shrink-0 text-cyan-400/90" aria-hidden />
              <span>IntelliSearch</span>
              <IntelliSearchNewBadge className="scale-95 sm:scale-100" />
            </h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Pesquise qualquer negócio local (não precisa estar cadastrado na plataforma). Análise de saúde do perfil no
              Google no estilo de ferramentas como o{" "}
              <a
                href="https://www.gbpcheck.com/"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                GBP Check
              </a>{" "}
              — dados abaixo são demonstração até integrarmos a API.
            </p>
          </div>
        </div>

        <Card className="border-border/60 max-w-3xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pesquisar negócio</CardTitle>
            <CardDescription>Nome da empresa, marca ou endereço para localizar o perfil público no Google.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5 min-w-0">
              <label className="text-xs text-muted-foreground" htmlFor="intelli-q">
                Termo de pesquisa
              </label>
              <Input
                id="intelli-q"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Ex.: "Rozinelli Móveis Americana"'
                className="h-11"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void runSearch();
                  }
                }}
              />
            </div>
            <Button
              type="button"
              className="gap-2 shrink-0 sm:h-11"
              disabled={loading || !query.trim()}
              onClick={() => runSearch()}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Analisar perfil
            </Button>
          </CardContent>
        </Card>
      </div>

      {showResults ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          <div className="space-y-6 min-w-0">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="overflow-hidden border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Pontuação geral</CardTitle>
                  <CardDescription>Índice 0–100 (completude e sinais de desempenho do perfil)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-end gap-4">
                    <span className="font-display text-5xl font-bold tabular-nums text-foreground leading-none">{SCORE}</span>
                    <span className="text-sm text-muted-foreground pb-1">/ 100</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary/80 via-primary to-emerald-400/90 transition-all"
                      style={{ width: `${scorePct}%` }}
                    />
                  </div>
                  <div className="h-[100px] w-full -mx-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={stackedScore}
                        layout="vertical"
                        margin={{ top: 8, right: 12, left: 12, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="label" width={0} hide />
                        <Tooltip
                          cursor={{ fill: "hsl(var(--muted) / 0.25)" }}
                          content={({ active, payload }) =>
                            active && payload?.length ? (
                              <div className="rounded-md border border-border bg-background/95 px-2 py-1 text-xs shadow-md space-y-0.5">
                                <div>Pontuação: {scorePct} / 100</div>
                                {payload.map((p) => (
                                  <div key={String(p.dataKey)}>
                                    {String(p.dataKey)}: {String(p.value)}
                                  </div>
                                ))}
                              </div>
                            ) : null
                          }
                        />
                        <Bar dataKey="pontos" stackId="s" fill="hsl(174 72% 48%)" radius={[0, 0, 0, 0]} maxBarSize={32} />
                        <Bar
                          dataKey="resto"
                          stackId="s"
                          fill="hsl(var(--muted))"
                          radius={[0, 6, 6, 0]}
                          maxBarSize={32}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Pontuação detalhada</CardTitle>
                  <CardDescription>Itens da auditoria por faixa</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-red-500/25 bg-red-500/5 px-2 py-3">
                      <div className="text-2xl font-bold tabular-nums text-red-500">{TIER_COUNTS.weak}</div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">Fraco</div>
                    </div>
                    <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-2 py-3">
                      <div className="text-2xl font-bold tabular-nums text-amber-500">{TIER_COUNTS.reasonable}</div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">Razoável</div>
                    </div>
                    <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-2 py-3">
                      <div className="text-2xl font-bold tabular-nums text-emerald-500">{TIER_COUNTS.good}</div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">Bom</div>
                    </div>
                  </div>
                  <div className="h-[160px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis allowDecimals={false} width={32} tick={{ fontSize: 11 }} />
                        <Tooltip
                          cursor={{ fill: "hsl(var(--muted) / 0.35)" }}
                          content={({ active, payload }) =>
                            active && payload?.length ? (
                              <div className="rounded-md border border-border bg-background/95 px-2 py-1 text-xs shadow-md">
                                <span className="font-medium">{String(payload[0].payload.name)}</span>:{" "}
                                {String(payload[0].value)}
                              </div>
                            ) : null
                          }
                        />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                          {barData.map((e) => (
                            <Cell key={e.name} fill={e.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Checklist da auditoria</CardTitle>
                <CardDescription>Resultado para «{activeQuery}» (demonstração)</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border/60">
                  {MOCK_CHECKS.map((c) => (
                    <li key={c.id} className="flex gap-3 px-4 py-3 sm:px-6">
                      <span className="mt-0.5">{statusIcon(c.status)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-xs font-medium text-muted-foreground">{c.category}</span>
                          <span className="text-sm font-medium text-foreground">{c.label}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{c.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <aside className="min-w-0 space-y-4">
            <Card className="overflow-hidden border-border/60">
              <div className="aspect-[16/10] w-full bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center">
                <Store className="h-16 w-16 text-muted-foreground/40" aria-hidden />
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-base leading-snug">{profile.name}</CardTitle>
                <CardDescription>{profile.category}</CardDescription>
                <div className="flex items-center gap-2 pt-2 text-sm">
                  <span className="text-amber-500 font-semibold">★ {profile.rating}</span>
                  <span className="text-muted-foreground">({profile.reviews} avaliações)</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8 text-xs" asChild>
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(activeQuery)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver na pesquisa
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8 text-xs" asChild>
                    <a href="https://maps.google.com" target="_blank" rel="noreferrer">
                      Ver no Maps
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{profile.address}</span>
                  </li>
                  <li className="flex gap-2">
                    <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{profile.hours}</span>
                  </li>
                  <li className="flex gap-2">
                    <Globe className="h-4 w-4 shrink-0 mt-0.5" />
                    <a href={profile.site} className="text-primary hover:underline break-all">
                      {profile.site}
                    </a>
                  </li>
                  <li className="flex gap-2">
                    <Phone className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{profile.phone}</span>
                  </li>
                </ul>
                <p className={cn("text-xs text-muted-foreground leading-relaxed border-t border-border/60 pt-3")}>
                  {profile.description}
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border/60 rounded-xl">
          Introduza um termo e clique em <strong className="text-foreground">Analisar perfil</strong> para ver a análise
          (demo).
        </p>
      )}
    </div>
  );
}
