import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ExternalLink,
  MapPin,
  Phone,
  Globe,
  Clock,
  XCircle,
  Loader2,
  Search,
  AlertCircle,
} from "lucide-react";
import { IntelliSearchNewBadge } from "@/components/IntelliSearchNewBadge";
import { fetchBusinessAnalysis, type BusinessAnalysis } from "@/lib/intellisearchApi";
import { appendIntelliSearchHistory } from "@/lib/intellisearchHistory";
import { BusinessHoursDisplay } from "@/lib/businessHoursDisplay";

const TIER_COLORS = {
  weak: "hsl(0 72% 52%)",
  reasonable: "hsl(45 90% 48%)",
  good: "hsl(174 72% 42%)",
};

function statusIcon(status: "good" | "reasonable" | "weak") {
  if (status === "good") return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />;
  if (status === "reasonable") return <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />;
  return <XCircle className="h-4 w-4 shrink-0 text-red-500" aria-hidden />;
}

export type SerpFlowPreset =
  | "complete"
  | "manual"
  | "pre"
  | "reviews"
  | "posts"
  | "categories"
  | "profile"
  | "keywords"
  | "lead-finder"
  | "qa";

type PresetConfig = {
  title: ReactNode;
  subtitle: string;
  searchTitle: string;
  searchDescription: string;
  showBadge?: boolean;
  inputId: string;
  /** layout da área de resultados */
  layout: "dashboard" | "compact" | "reviews-filter" | "posts-focus" | "categories-focus" | "metrics-strip";
};

const PRESETS: Record<SerpFlowPreset, PresetConfig> = {
  complete: {
    title: (
      <span className="flex flex-wrap items-center justify-between gap-3 gap-y-2">
        Análise de saúde — Análise completa
        <IntelliSearchNewBadge className="scale-95 sm:scale-100 shrink-0" />
      </span>
    ),
    subtitle: "Dados reais devolvidos pela SerpAPI (Google Maps), sem preenchimento fictício no servidor.",
    searchTitle: "Pesquisar negócio",
    searchDescription: "Nome da empresa, marca ou endereço para localizar o perfil público no Google.",
    showBadge: false,
    inputId: "intelli-q-complete",
    layout: "dashboard",
  },
  manual: {
    title: "Análise manual",
    subtitle:
      "Os mesmos dados SerpAPI da análise completa, apresentados para auditoria campo a campo (checklist). Ideal para validar cada item antes de agir.",
    searchTitle: "Localizar perfil para auditoria",
    searchDescription: "Pesquise o negócio; depois percorra o checklist como lista de verificação manual.",
    inputId: "intelli-q-manual",
    layout: "dashboard",
  },
  pre: {
    title: "Pré-análise",
    subtitle: "Resumo rápido: pontuação e prioridades antes de abrir a análise completa.",
    searchTitle: "Pesquisa rápida",
    searchDescription: "Um termo para obter pontuação e destaques imediatos.",
    inputId: "intelli-q-pre",
    layout: "compact",
  },
  reviews: {
    title: "Análise de avaliações",
    subtitle: "Foco em nota média, volume de reviews e itens da auditoria relacionados a avaliações (SerpAPI / Maps).",
    searchTitle: "Negócio a analisar",
    searchDescription: "O mesmo motor da análise completa; a vista filtra o que importa para reviews.",
    inputId: "intelli-q-reviews",
    layout: "reviews-filter",
  },
  posts: {
    title: "Análise de postagens",
    subtitle: "Descrição e sinais textuais do perfil público. Posts dinâmicos do GBP podem exigir API Google adicional.",
    searchTitle: "Perfil para análise de conteúdo",
    searchDescription: "Pesquise o negócio para ver descrição e dados estruturados devolvidos pela SerpAPI.",
    inputId: "intelli-q-posts",
    layout: "posts-focus",
  },
  categories: {
    title: "Análise de categorias",
    subtitle: "Categoria principal e contexto do negócio a partir dos resultados Maps.",
    searchTitle: "Negócio",
    searchDescription: "Pesquise para destacar a categoria registada na resposta.",
    inputId: "intelli-q-cat",
    layout: "categories-focus",
  },
  profile: {
    title: "Insights do perfil",
    subtitle: "Métricas resumidas: pontuação, nota, reviews e categoria.",
    searchTitle: "Pesquisar",
    searchDescription: "Localize o estabelecimento para ver o painel de indicadores.",
    inputId: "intelli-q-profile",
    layout: "metrics-strip",
  },
  keywords: {
    title: "Palavras-chave",
    subtitle: "Categoria e descrição pública como proxy de termos associados ao perfil (dados SerpAPI).",
    searchTitle: "Pesquisar negócio",
    searchDescription: "Use o termo com que o cliente pode ser encontrado no Google.",
    inputId: "intelli-q-kw",
    layout: "metrics-strip",
  },
  "lead-finder": {
    title: "Buscar leads",
    subtitle: "Mesma pesquisa Maps da análise completa — identifique negócios por local e termo.",
    searchTitle: "Prospecção",
    searchDescription: "Ex.: tipo de negócio + cidade para obter o primeiro resultado relevante e dados de contacto.",
    inputId: "intelli-q-lead",
    layout: "dashboard",
  },
  qa: {
    title: "Perguntas e respostas",
    subtitle:
      "Para editar Q&A no Google Business Profile é necessária a API oficial Google; aqui usa-se o mesmo contexto SerpAPI (dados públicos do estabelecimento) para apoiar a gestão.",
    searchTitle: "Negócio",
    searchDescription: "Pesquise o estabelecimento para ver dados de perfil e checklist enquanto a integração GBP não está ligada.",
    inputId: "intelli-q-qa",
    layout: "dashboard",
  },
};

export function IntelliSearchSerpFlow({ preset }: { preset: SerpFlowPreset }) {
  const cfg = PRESETS[preset];
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<BusinessAnalysis | null>(null);

  const scorePct = analysis ? Math.min(100, Math.max(0, analysis.score)) : 0;
  const stackedScore = useMemo(
    () => [{ label: "score", pontos: scorePct, resto: 100 - scorePct }],
    [scorePct],
  );

  const barData = useMemo(() => {
    if (!analysis) return [];
    const t = analysis.tier_counts;
    return [
      { name: "Fraco", value: t.weak, fill: TIER_COLORS.weak },
      { name: "Razoável", value: t.reasonable, fill: TIER_COLORS.reasonable },
      { name: "Bom", value: t.good, fill: TIER_COLORS.good },
    ];
  }, [analysis]);

  const checklistFiltered = useMemo(() => {
    if (!analysis) return [];
    if (cfg.layout === "reviews-filter") {
      return analysis.checklist.filter(
        (c) =>
          c.category.toLowerCase().includes("avalia") ||
          c.label.toLowerCase().includes("avalia") ||
          c.label.toLowerCase().includes("review"),
      );
    }
    return analysis.checklist;
  }, [analysis, cfg.layout]);

  const runSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const data = await fetchBusinessAnalysis(query.trim());
      setAnalysis(data);
      appendIntelliSearchHistory({
        query: data.query,
        score: data.score,
        at: new Date().toISOString(),
        name: data.business.name || undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao obter dados.");
    } finally {
      setLoading(false);
    }
  };

  const b = analysis?.business;
  const heroImage = b?.photo_urls?.[0] ?? b?.thumbnail;

  const showDashboard =
    cfg.layout === "dashboard" ||
    cfg.layout === "reviews-filter" ||
    cfg.layout === "posts-focus" ||
    cfg.layout === "categories-focus";

  const checklistToRender =
    cfg.layout === "reviews-filter" ? (checklistFiltered.length ? checklistFiltered : analysis?.checklist ?? []) : analysis?.checklist ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{cfg.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl leading-relaxed">{cfg.subtitle}</p>
        </div>

        <Card className="border-border/60 max-w-3xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{cfg.searchTitle}</CardTitle>
            <CardDescription>{cfg.searchDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5 min-w-0">
              <label className="text-xs text-muted-foreground" htmlFor={cfg.inputId}>
                Termo de pesquisa
              </label>
              <Input
                id={cfg.inputId}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Ex.: "Norter Digital Americana"'
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
              onClick={() => void runSearch()}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Analisar perfil
            </Button>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="font-medium">Não foi possível carregar dados</p>
            <p className="mt-1 text-destructive/90 leading-relaxed">{error}</p>
          </div>
        </div>
      ) : null}

      {analysis && b && cfg.layout === "compact" ? (
        <div className="max-w-xl space-y-6">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Pontuação rápida</CardTitle>
              <CardDescription>«{analysis.query}»</CardDescription>
            </CardHeader>
            <CardContent className="flex items-end gap-4">
              <span className="font-display text-6xl font-bold tabular-nums">{analysis.score}</span>
              <span className="text-muted-foreground pb-2">/ 100</span>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Prioridades</CardTitle>
              <CardDescription>Três primeiros itens do checklist</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {analysis.checklist.slice(0, 3).map((c) => (
                <div key={c.id} className="flex gap-2 text-sm">
                  <span className="mt-0.5">{statusIcon(c.status)}</span>
                  <div>
                    <span className="font-medium text-foreground">{c.label}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.detail}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/intelli-search/health/complete">Abrir análise completa</Link>
          </Button>
        </div>
      ) : null}

      {analysis && b && cfg.layout === "metrics-strip" ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/60 p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pontuação</p>
              <p className="font-display text-3xl font-bold tabular-nums mt-1">{analysis.score}</p>
            </Card>
            <Card className="border-border/60 p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Nota média</p>
              <p className="font-display text-3xl font-bold tabular-nums mt-1">{b.rating > 0 ? b.rating.toFixed(1) : "—"}</p>
            </Card>
            <Card className="border-border/60 p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Avaliações</p>
              <p className="font-display text-3xl font-bold tabular-nums mt-1">{b.reviews_count}</p>
            </Card>
            <Card className="border-border/60 p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Categoria</p>
              <p className="text-sm font-medium leading-snug mt-1 line-clamp-3">{b.category || "—"}</p>
            </Card>
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl">
            {preset === "keywords" ? (
              <>
                <strong>Descrição pública:</strong> {b.description || "Sem descrição na resposta."}
              </>
            ) : (
              <>Resumo derivado da mesma resposta SerpAPI utilizada na análise completa.</>
            )}
          </p>
        </div>
      ) : null}

      {analysis && b && cfg.layout === "posts-focus" ? (
        <Card className="border-primary/30 bg-primary/5 max-w-3xl">
          <CardHeader>
            <CardTitle className="text-base">Descrição e texto do perfil</CardTitle>
            <CardDescription>Conteúdo devolvido pela SerpAPI para o estabelecimento</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{b.description || "Sem descrição no payload."}</p>
          </CardContent>
        </Card>
      ) : null}

      {analysis && b && cfg.layout === "categories-focus" ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Categoria principal</span>
          <Badge variant="secondary" className="text-base px-4 py-2 font-normal">
            {b.category || "—"}
          </Badge>
        </div>
      ) : null}

      {analysis && b && showDashboard && cfg.layout !== "compact" && cfg.layout !== "metrics-strip" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          <div className="space-y-6 min-w-0">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="overflow-hidden border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Pontuação geral</CardTitle>
                  <CardDescription>Índice 0–100 calculado no servidor a partir de sinais reais do perfil</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-end gap-4">
                    <span className="font-display text-5xl font-bold tabular-nums text-foreground leading-none">
                      {analysis.score}
                    </span>
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
                  <CardDescription>Itens da auditoria por faixa (derivados dos dados recebidos)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-red-500/25 bg-red-500/5 px-2 py-3">
                      <div className="text-2xl font-bold tabular-nums text-red-500">{analysis.tier_counts.weak}</div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">Fraco</div>
                    </div>
                    <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-2 py-3">
                      <div className="text-2xl font-bold tabular-nums text-amber-500">{analysis.tier_counts.reasonable}</div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">Razoável</div>
                    </div>
                    <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-2 py-3">
                      <div className="text-2xl font-bold tabular-nums text-emerald-500">{analysis.tier_counts.good}</div>
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
                <CardTitle className="text-base">
                  {cfg.layout === "reviews-filter" ? "Checklist — foco em avaliações" : "Checklist da auditoria"}
                </CardTitle>
                <CardDescription>Resultado para «{analysis.query}» (fonte: {analysis.source})</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border/60">
                  {checklistToRender.map((c) => (
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
              <div className="aspect-[16/10] w-full bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center overflow-hidden">
                {heroImage ? (
                  <img
                    src={heroImage}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground px-4 text-center">Sem imagem na resposta da API</span>
                )}
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-base leading-snug">{b.name || "—"}</CardTitle>
                <CardDescription>{b.category || "—"}</CardDescription>
                <div className="flex items-center gap-2 pt-2 text-sm">
                  {b.rating > 0 ? (
                    <>
                      <span className="text-amber-500 font-semibold">★ {b.rating.toFixed(1)}</span>
                      <span className="text-muted-foreground">({b.reviews_count} avaliações)</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground text-xs">Nota ou contagem indisponível na resposta</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8 text-xs" asChild>
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(b.name || analysis.query)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver na pesquisa
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                  {b.google_maps_url ? (
                    <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8 text-xs" asChild>
                      <a href={b.google_maps_url} target="_blank" rel="noreferrer">
                        Ver no Maps
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  ) : null}
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{b.address || "—"}</span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <Clock className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                    <BusinessHoursDisplay value={b.hours_summary || ""} className="flex-1 min-w-0" />
                  </li>
                  <li className="flex gap-2">
                    <Globe className="h-4 w-4 shrink-0 mt-0.5" />
                    {b.website ? (
                      <a href={b.website} className="text-primary hover:underline break-all" target="_blank" rel="noreferrer">
                        {b.website}
                      </a>
                    ) : (
                      <span>—</span>
                    )}
                  </li>
                  <li className="flex gap-2">
                    <Phone className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{b.phone || "—"}</span>
                  </li>
                </ul>
                <p className={cn("text-xs text-muted-foreground leading-relaxed border-t border-border/60 pt-3")}>
                  {b.description || "Sem descrição no payload devolvido pela API."}
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      ) : null}

      {!loading && !error && !analysis ? (
        <p className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border/60 rounded-xl">
          Introduza um termo e clique em <span className="text-foreground font-medium">Analisar perfil</span> para pedir
          dados ao SerpAPI.
        </p>
      ) : null}
    </div>
  );
}
