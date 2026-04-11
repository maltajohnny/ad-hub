import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LoginScreenBody } from "@/components/auth/LoginScreenBody";
import { cn } from "@/lib/utils";
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

/** Altura do viewport do hero/login (duas secções empilhadas = 2× esta altura scrollável). */
const HERO_LOGIN_VIEWPORT_H =
  "h-[min(34rem,88dvh)] max-h-[44rem] min-h-[22rem] sm:h-[min(36rem,85dvh)] lg:h-[min(38rem,80dvh)]";

export default function Landing() {
  const [showLoginInHero, setShowLoginInHero] = useState(false);
  const heroLoginScrollRef = useRef<HTMLDivElement>(null);

  const scrollHeroLoginTo = (which: "hero" | "login") => {
    const el = heroLoginScrollRef.current;
    if (!el) return;
    const y = which === "login" ? el.clientHeight : 0;
    el.scrollTo({ top: y, behavior: "smooth" });
  };

  const openLoginInHero = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setShowLoginInHero(true);
  };

  useLayoutEffect(() => {
    if (!showLoginInHero) return;
    const id = requestAnimationFrame(() => scrollHeroLoginTo("login"));
    return () => cancelAnimationFrame(id);
  }, [showLoginInHero]);

  const closeLoginHero = () => {
    scrollHeroLoginTo("hero");
    window.setTimeout(() => setShowLoginInHero(false), 560);
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#050814] text-foreground overflow-x-hidden pb-[env(safe-area-inset-bottom,0px)]">
      <header className="border-b border-white/[0.06] bg-[#050814]/85 backdrop-blur-xl sticky top-0 z-50 safe-area-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 safe-area-x py-3 sm:flex-nowrap sm:gap-4">
          <Link
            to="/"
            onClick={(e) => {
              if (showLoginInHero) {
                e.preventDefault();
                closeLoginHero();
              }
            }}
            className="flex min-w-0 max-w-[calc(100%-8rem)] items-center gap-2.5 group sm:max-w-none sm:gap-3"
          >
            <img
              src={adHubLogo}
              alt="AD-HUB"
              width={65}
              height={65}
              className="h-12 w-12 shrink-0 object-contain object-left transition-opacity group-hover:opacity-95 sm:h-[65px] sm:w-[65px]"
            />
            <span className="hidden min-w-0 sm:flex sm:flex-col sm:border-l sm:border-white/10 sm:pl-3">
              <span className="font-display text-sm font-bold tracking-[0.08em] text-white leading-tight">AD-HUB</span>
              <span className="text-[10px] tracking-[0.22em] uppercase text-cyan-400/90">
                MOVE FASTER · GROW SMARTER
              </span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col sm:hidden">
              <span className="font-display text-xs font-bold tracking-[0.08em] text-white leading-tight">AD-HUB</span>
              <span className="text-[9px] tracking-[0.18em] uppercase text-cyan-400/90">MOVE FASTER · GROW SMARTER</span>
            </span>
          </Link>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {showLoginInHero ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 px-3 text-slate-300 hover:bg-white/10 hover:text-white sm:min-h-9"
                onClick={closeLoginHero}
              >
                Voltar
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11 min-w-[2.75rem] px-3 text-slate-300 hover:bg-white/10 hover:text-white sm:min-h-9"
                  onClick={openLoginInHero}
                >
                  Entrar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="min-h-11 min-w-[2.75rem] gradient-brand px-4 text-primary-foreground shadow-lg shadow-primary/20 sm:min-h-9"
                  onClick={openLoginInHero}
                >
                  Começar
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-0 h-[520px] w-[520px] rounded-full bg-violet-600/20 blur-[120px]" />
          <div className="absolute right-0 bottom-0 h-[400px] w-[400px] rounded-full bg-cyan-500/10 blur-[100px]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.25),transparent)]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-[max(1rem,env(safe-area-inset-left,0px))] pb-12 pt-8 pr-[max(1rem,env(safe-area-inset-right,0px))] sm:px-6 sm:pb-14 sm:pt-10 lg:pb-20 xl:max-w-7xl 2xl:max-w-[90rem]">
          {/*
            Scroll vertical no próprio bloco: ao abrir login, faz scroll para baixo (hero “sobe” como num scroll interno).
          */}
          <div
            ref={heroLoginScrollRef}
            className={cn(
              HERO_LOGIN_VIEWPORT_H,
              "relative mx-auto w-full overflow-y-auto overflow-x-hidden scroll-smooth overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden motion-reduce:scroll-auto",
            )}
          >
              {/* Secção 1: hero */}
              <div className={cn(HERO_LOGIN_VIEWPORT_H, "flex min-h-full flex-col justify-center py-4 sm:py-5")}>
                <div className="grid items-center gap-8 sm:gap-10 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.2fr)] lg:gap-14 xl:gap-16">
                  <div className="max-w-xl min-w-0 lg:max-w-none">
                    <p className="mb-3 inline-flex max-w-full items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/5 px-3 py-1.5 text-xs font-medium text-cyan-300/95 shadow-sm shadow-cyan-500/10 sm:mb-4">
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      IA + tráfego pago numa única plataforma
                    </p>
                    <h1 className="font-display text-[1.65rem] font-bold leading-[1.12] tracking-tight text-white min-[400px]:text-3xl sm:text-4xl md:text-5xl lg:text-[3.15rem] lg:leading-[1.1]">
                      AD-HUB —{" "}
                      <span className="bg-gradient-to-r from-cyan-300 via-white to-violet-200 bg-clip-text text-transparent">
                        Move faster. Grow smarter.
                      </span>
                    </h1>
                    <p className="mt-4 text-base text-slate-400 leading-relaxed sm:mt-6 sm:text-lg">
                      Centralize campanhas, métricas e decisões com inteligência artificial. A plataforma AD-HUB automatiza
                      análises de tráfego pago e entrega insights precisos de{" "}
                      <strong className="text-slate-200 font-semibold">CPA</strong>,{" "}
                      <strong className="text-slate-200 font-semibold">conversões</strong>,{" "}
                      <strong className="text-slate-200 font-semibold">CPM</strong>,{" "}
                      <strong className="text-slate-200 font-semibold">ROI</strong> e o que mais importa para o seu negócio —
                      com agilidade de gestor e menos planilhas.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">
                      <Button
                        type="button"
                        size="lg"
                        className="min-h-12 w-full gap-2 gradient-brand px-7 text-primary-foreground shadow-lg shadow-primary/25 sm:w-auto"
                        onClick={openLoginInHero}
                      >
                        Aceder à plataforma
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="relative flex min-h-0 flex-col justify-center">
                    <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-violet-500/20 via-transparent to-cyan-500/15 blur-2xl sm:-inset-4" />
                    <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 shadow-2xl shadow-black/50 ring-1 ring-white/5 aspect-[4/3] sm:aspect-[16/11] lg:aspect-[16/10]">
                      <img
                        src={landingHeroAi}
                        alt="Gestora de tráfego com assistente de IA a analisar métricas de CPA, ROI e leads"
                        className="h-full w-full object-cover object-[center_24%]"
                        loading="eager"
                        sizes="(min-width: 1024px) min(58vw, 720px), 100vw"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050814] via-transparent to-transparent opacity-90 sm:opacity-70" />
                      <div className="absolute bottom-3 left-3 right-3 sm:bottom-6 sm:left-6 sm:right-auto">
                        <div className="rounded-xl border border-white/10 bg-black/50 px-4 py-3 backdrop-blur-md max-w-sm">
                          <p className="text-[11px] font-medium uppercase tracking-widest text-cyan-400/95">
                            Inteligência operacional
                          </p>
                          <p className="mt-1 text-sm text-slate-200 leading-snug">
                            Decisões mais rápidas, dados centralizados e IA ao lado do gestor — do insight à execução.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Secção 2: login (revelada ao fazer scroll para baixo no container) */}
              <div
                className={cn(
                  HERO_LOGIN_VIEWPORT_H,
                  "flex min-h-full items-center justify-center px-2 py-4 sm:px-4",
                  !showLoginInHero && "pointer-events-none select-none",
                )}
                aria-hidden={!showLoginInHero}
              >
                <LoginScreenBody variant="landing" formId="login-form-landing" />
              </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl safe-area-x py-16">
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

      <section className="mx-auto max-w-6xl safe-area-x py-16">
        <Card className="border-cyan-500/20 bg-gradient-to-br from-violet-500/15 via-[#0a0f24] to-[#050814] overflow-hidden relative">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(34,211,238,0.12),transparent_55%)]" />
          <CardContent className="relative flex flex-col gap-4 p-6 sm:p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display text-xl font-semibold text-white">Pronto para ganhar tempo?</h3>
              <p className="mt-1 text-sm text-slate-400 max-w-lg leading-relaxed">
                A tecnologia centraliza o trabalho, reduz retrabalho e permite decisões mais rápidas e assertivas — mantendo o
                gestor no centro da estratégia.
              </p>
            </div>
            <Button
              type="button"
              size="lg"
              className="min-h-12 w-full shrink-0 gradient-brand text-primary-foreground shadow-lg sm:w-auto"
              onClick={openLoginInHero}
            >
              Entrar na AD-HUB
            </Button>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t border-white/[0.06] safe-area-x safe-area-b py-10 text-center text-xs text-slate-500">
        <p className="max-w-prose mx-auto px-1">
          © {new Date().getFullYear()} AD-HUB — Move faster. Grow smarter. Plataforma de gestão de tráfego pago e
          inteligência operacional.
        </p>
      </footer>
    </div>
  );
}
