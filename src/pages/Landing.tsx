import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  LineChart,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import adHubLogo from "@/assets/ad-hub-logo.png";
import landingHeroAi from "@/assets/landing-hero-ai.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#050814] text-foreground">
      <header className="border-b border-white/[0.06] bg-[#050814]/85 backdrop-blur-xl sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-3 min-w-0 group">
            <img
              src={adHubLogo}
              alt="AD-Hub"
              className="h-[55px] w-[55px] object-contain object-left shrink-0 transition-opacity group-hover:opacity-95"
            />
            <span className="hidden sm:flex flex-col border-l border-white/10 pl-3">
              <span className="font-display text-sm font-bold tracking-tight text-white leading-tight">AD-Hub</span>
              <span className="text-[10px] tracking-[0.22em] uppercase text-cyan-400/90">Move faster · Grow smarter</span>
            </span>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" asChild>
              <Link to="/login">Entrar</Link>
            </Button>
            <Button size="sm" className="gradient-brand text-primary-foreground shadow-lg shadow-primary/20" asChild>
              <Link to="/login">Começar</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-0 h-[520px] w-[520px] rounded-full bg-violet-600/20 blur-[120px]" />
          <div className="absolute right-0 bottom-0 h-[400px] w-[400px] rounded-full bg-cyan-500/10 blur-[100px]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.25),transparent)]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20 xl:max-w-7xl 2xl:max-w-[90rem]">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.2fr)] lg:gap-14 xl:gap-16">
            <div className="max-w-xl lg:max-w-none">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/5 px-3 py-1.5 text-xs font-medium text-cyan-300/95 shadow-sm shadow-cyan-500/10">
                <Sparkles className="h-3.5 w-3.5" />
                IA + tráfego pago numa única plataforma
              </p>
              <h1 className="font-display text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-[3.15rem]">
                AD-Hub —{" "}
                <span className="bg-gradient-to-r from-cyan-300 via-white to-violet-200 bg-clip-text text-transparent">
                  Move faster. Grow smarter.
                </span>
              </h1>
              <p className="mt-6 text-lg text-slate-400 leading-relaxed">
                Centralize campanhas, métricas e decisões com inteligência artificial. A plataforma AD-Hub automatiza análises de
                tráfego pago e entrega insights precisos de <strong className="text-slate-200 font-semibold">CPA</strong>,{" "}
                <strong className="text-slate-200 font-semibold">conversões</strong>,{" "}
                <strong className="text-slate-200 font-semibold">CPM</strong>,{" "}
                <strong className="text-slate-200 font-semibold">ROI</strong> e o que mais importa para o seu negócio —
                com agilidade de gestor e menos planilhas.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="gradient-brand text-primary-foreground gap-2 shadow-lg shadow-primary/25 h-12 px-7"
                  asChild
                >
                  <Link to="/login">
                    Aceder à plataforma
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="relative flex flex-col justify-center">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-violet-500/20 via-transparent to-cyan-500/15 blur-2xl" />
              <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 shadow-2xl shadow-black/50 ring-1 ring-white/5 aspect-[4/3] sm:aspect-[16/11] lg:aspect-[16/10]">
                <img
                  src={landingHeroAi}
                  alt="Gestora de tráfego com assistente de IA a analisar métricas de CPA, ROI e leads"
                  className="h-full w-full object-cover object-[center_24%]"
                  loading="eager"
                  sizes="(min-width: 1024px) min(58vw, 720px), 100vw"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050814] via-transparent to-transparent opacity-90 sm:opacity-70" />
                <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-auto">
                  <div className="rounded-xl border border-white/10 bg-black/50 px-4 py-3 backdrop-blur-md max-w-sm">
                    <p className="text-[11px] font-medium uppercase tracking-widest text-cyan-400/95">Inteligência operacional</p>
                    <p className="mt-1 text-sm text-slate-200 leading-snug">
                      Decisões mais rápidas, dados centralizados e IA ao lado do gestor — do insight à execução.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">O que a IA faz por si</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground leading-relaxed">
          Modelos de leitura de performance cruzam canais e sugerem prioridades — com transparência nos números (CPA,
          conversões, CPM, ROI e outros KPIs), para o gestor validar e executar mais rápido.
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
              title: "Controle humano",
              desc: "A IA propõe; o gestor mantém a palavra final quando a estratégia exige.",
            },
          ].map((f) => (
            <Card key={f.title} className="border-white/[0.08] bg-white/[0.03] backdrop-blur-sm">
              <CardHeader className="space-y-1">
                <f.icon className="h-8 w-8 text-cyan-400/90" />
                <CardTitle className="text-base text-white">{f.title}</CardTitle>
                <CardDescription className="text-sm leading-relaxed text-slate-400">{f.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Card className="border-cyan-500/20 bg-gradient-to-br from-violet-500/15 via-[#0a0f24] to-[#050814] overflow-hidden relative">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(34,211,238,0.12),transparent_55%)]" />
          <CardContent className="relative flex flex-col gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display text-xl font-semibold text-white">Pronto para ganhar tempo?</h3>
              <p className="mt-1 text-sm text-slate-400 max-w-lg leading-relaxed">
                A tecnologia centraliza o trabalho, reduz retrabalho e permite decisões mais rápidas e assertivas — mantendo o
                gestor no centro da estratégia.
              </p>
            </div>
            <Button size="lg" className="gradient-brand shrink-0 text-primary-foreground shadow-lg" asChild>
              <Link to="/login">Entrar na AD-Hub</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t border-white/[0.06] py-10 text-center text-xs text-slate-500">
        <p>
          © {new Date().getFullYear()} AD-Hub — Move faster. Grow smarter. Plataforma de gestão de tráfego pago e
          inteligência operacional.
        </p>
      </footer>
    </div>
  );
}
