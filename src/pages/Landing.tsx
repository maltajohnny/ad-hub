import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  Globe,
  LineChart,
  Search,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

async function fetchGoogleRank(keyword: string, domain: string) {
  try {
    const r = await fetch("/api/google-rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, domain }),
    });
    return await r.json();
  } catch {
    return {
      ok: true,
      demo: true,
      message: "API indisponível localmente — em produção use a rota /api/google-rank na Vercel.",
      samplePosition: 12,
      position: null,
    };
  }
}

export default function Landing() {
  const [kw, setKw] = useState("");
  const [dom, setDom] = useState("");
  const [rankLoading, setRankLoading] = useState(false);
  const [rankResult, setRankResult] = useState<Record<string, unknown> | null>(null);

  const runRank = async () => {
    if (!kw.trim() || !dom.trim()) return;
    setRankLoading(true);
    setRankResult(null);
    try {
      const j = await fetchGoogleRank(kw.trim(), dom.trim());
      setRankResult(j);
    } finally {
      setRankLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <span className="font-display text-lg font-bold tracking-tight">Norter</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Entrar</Link>
            </Button>
            <Button size="sm" className="gradient-brand text-primary-foreground" asChild>
              <Link to="/login">Começar</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-border/40">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/4 top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-10 right-1/4 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-3xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Tráfego pago, dados e IA no mesmo lugar
            </p>
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Centralize campanhas, métricas e decisões — com{" "}
              <span className="text-primary">agilidade de gestor</span>.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
              A Norter reúne dados de mídia, automatiza análises com IA e reduz o tempo entre insight e ação. Menos planilhas,
              mais clareza em CPA, conversões, CPM, ROI e indicadores que importam para o seu negócio.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="gradient-brand text-primary-foreground gap-2" asChild>
                <Link to="/login">
                  Aceder à plataforma
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#ranking">Verificar posição no Google</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">O que a IA faz por si</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Modelos de leitura de performance cruzam canais e sugerem prioridades — com transparência nos números (CPA, conversões,
          CPM, ROI e outros KPIs), para o gestor validar e executar mais rápido.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Brain,
              title: "Análises automatizadas",
              desc: "Leitura contínua de desempenho e geração de insights acionáveis, sem depender de exportações manuais.",
            },
            {
              icon: LineChart,
              title: "KPIs alinhados ao negócio",
              desc: "CPA, conversões, CPM, ROI e métricas de funil num painel único, pronto para decisão.",
            },
            {
              icon: Zap,
              title: "Menos tempo operacional",
              desc: "Centralização de dados e fluxos de trabalho: reduz ruído e acelera testes e otimizações.",
            },
            {
              icon: Target,
              title: "Foco no que converte",
              desc: "Priorização por canal e campanha com base em dados reais e contexto do cliente.",
            },
            {
              icon: BarChart3,
              title: "Visão de gestor",
              desc: "Do board ao detalhe do cliente: hierarquia clara para equipas de mídia e stakeholders.",
            },
            {
              icon: CheckCircle2,
              title: "Controlo humano",
              desc: "Modos autónomo e supervisionado: a IA propõe; o gestor mantém a palavra final quando a estratégia exige.",
            },
          ].map((f) => (
            <Card key={f.title} className="border-border/60 bg-card/40">
              <CardHeader className="space-y-1">
                <f.icon className="h-8 w-8 text-primary" />
                <CardTitle className="text-base">{f.title}</CardTitle>
                <CardDescription className="text-sm leading-relaxed">{f.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section id="ranking" className="border-t border-border/40 bg-muted/15 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold sm:text-3xl flex items-center gap-2">
                <Globe className="h-7 w-7 text-primary" />
                Posicionamento no Google
              </h2>
              <p className="mt-2 max-w-xl text-muted-foreground text-sm">
                Indique a palavra-chave e o domínio (ou marca) a verificar. Em produção, a consulta usa a API SerpAPI
                (configure <code className="text-xs">SERPAPI_KEY</code> na Vercel). Sem chave, mostramos um resultado de
                demonstração.
              </p>
            </div>
          </div>
          <Card className="max-w-xl border-border/60 bg-card/60">
            <CardHeader>
              <CardTitle className="text-lg">Verificar ranking</CardTitle>
              <CardDescription>Palavra-chave de pesquisa e domínio a encontrar nos resultados orgânicos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Palavra-chave</label>
                  <Input
                    value={kw}
                    onChange={(e) => setKw(e.target.value)}
                    placeholder="Ex.: agência de marketing digital"
                    className="bg-secondary/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Domínio</label>
                  <Input
                    value={dom}
                    onChange={(e) => setDom(e.target.value)}
                    placeholder="exemplo.com.br"
                    className="bg-secondary/40"
                  />
                </div>
              </div>
              <Button type="button" className="gap-2" onClick={() => void runRank()} disabled={rankLoading}>
                {rankLoading ? (
                  "A consultar…"
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Consultar posição
                  </>
                )}
              </Button>
              {rankResult && (
                <div
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-sm",
                    rankResult.ok ? "border-primary/30 bg-primary/5" : "border-destructive/40 bg-destructive/10",
                  )}
                >
                  {rankResult.demo ? (
                    <p>
                      <strong className="text-foreground">Demonstração:</strong>{" "}
                      {(rankResult.samplePosition as number) ? (
                        <>posição simulada ~{String(rankResult.samplePosition)} nos resultados.</>
                      ) : (
                        <>sem dados em tempo real.</>
                      )}{" "}
                      {String(rankResult.message ?? "")}
                    </p>
                  ) : rankResult.position ? (
                    <p>
                      Domínio <strong>{String(rankResult.domain)}</strong> encontrado na posição{" "}
                      <strong className="text-primary">{String(rankResult.position)}</strong> para «{String(rankResult.keyword)}».
                    </p>
                  ) : (
                    <p>
                      Não encontrámos o domínio nas primeiras entradas analisadas para «{String(rankResult.keyword)}».
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-background to-background">
          <CardContent className="flex flex-col gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display text-xl font-semibold">Pronto para ganhar tempo?</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-lg">
                A tecnologia centraliza o trabalho, reduz retrabalho e permite decisões mais rápidas e assertivas — mantendo o
                gestor no centro da estratégia.
              </p>
            </div>
            <Button size="lg" className="gradient-brand shrink-0 text-primary-foreground" asChild>
              <Link to="/login">Entrar na Norter</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t border-border/50 py-8 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Norter — Plataforma de gestão de tráfego pago e inteligência operacional.</p>
      </footer>
    </div>
  );
}
