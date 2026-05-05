import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchInsightHubBootstrap, type InsightHubBootstrap } from "@/lib/insightHubApi";
import { useAuth } from "@/contexts/AuthContext";
import { adHubAuthPing, isServerAuthLive } from "@/lib/adhubAuthApi";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, FileBarChart, LayoutPanelLeft, CalendarClock, Rocket, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

function isActive(b: InsightHubBootstrap): b is Extract<InsightHubBootstrap, { active: true }> {
  return b.active === true;
}

export default function InsightHubHome() {
  const { user } = useAuth();
  const [ping, setPing] = useState<{ db: boolean; jwt_ready: boolean } | null>(null);
  useEffect(() => {
    let cancel = false;
    adHubAuthPing().then((p) => {
      if (!cancel) setPing(p);
    });
    return () => {
      cancel = true;
    };
  }, []);
  const serverLive = isServerAuthLive(ping);

  const q = useQuery({
    queryKey: ["insight-hub", "bootstrap"],
    queryFn: fetchInsightHubBootstrap,
    enabled: Boolean(user && serverLive),
    retry: 1,
  });

  if (!serverLive) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/40 p-6 text-sm text-muted-foreground">
        Ligue a API Go com MySQL e JWT para carregar o Insight Hub (
        <code className="text-xs">npm run dev:with-api</code>).
      </div>
    );
  }

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
        A carregar Insight Hub…
      </div>
    );
  }

  if (q.isError) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-base">Não foi possível sincronizar</CardTitle>
          <CardDescription>{(q.error as Error)?.message ?? "Erro desconhecido"}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" size="sm" onClick={() => q.refetch()}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const data = q.data;
  if (!data) return null;

  if (!isActive(data)) {
    return (
      <div className="space-y-6">
        <header>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Clientes</p>
          <h1 className="font-display text-2xl font-bold">Insight Hub</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Analytics e relatórios white-label por marca — inspirado na flexibilidade da mLabs e Reportei. Contrate o módulo
            para criar o espaço isolado da sua organização na base de dados.
          </p>
        </header>
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <Rocket className="h-5 w-5" aria-hidden />
              <CardTitle className="text-lg">Módulo não ativo para esta organização</CardTitle>
            </div>
            <CardDescription className="text-foreground/80">
              Quando a subscrição estiver ativa, criamos automaticamente o workspace e os limites do plano em MySQL (isolados por{" "}
              <code className="rounded bg-muted px-1 text-xs">organization_id</code>). Peça a ativação na equipa AD-Hub ou
              escolha um plano abaixo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild className="gap-2">
              <Link to="/clientes/insight-hub/planos">Ver planos Insight Hub</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/planos">Planos AD-Hub</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { limits, usage, tier, workspace } = data;
  const brandCap = limits.maxBrands < 0 ? null : limits.maxBrands;
  const brandPct =
    brandCap != null && brandCap > 0
      ? Math.min(100, Math.round((usage.brands / brandCap) * 100))
      : 0;
  const dashCap = limits.maxDashboards < 0 ? null : limits.maxDashboards;
  const dashPct =
    dashCap != null && dashCap > 0 ? Math.min(100, Math.round(((usage.dashboards ?? 0) / dashCap) * 100)) : 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Insight Hub</p>
        <h1 className="font-display text-2xl font-bold">Início</h1>
        <p className="text-sm text-muted-foreground">
          Plano <span className="font-medium text-foreground">{tier}</span>
          {workspace?.agencyName ? (
            <>
              {" "}
              · {workspace.agencyName}
            </>
          ) : null}
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="border-border/60 md:col-span-2 xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Rocket className="h-4 w-4 text-primary" aria-hidden />
              Começando
            </CardTitle>
            <CardDescription>Conecte redes às marcas e gere o primeiro relatório.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild variant="secondary" size="sm">
              <Link to="/clientes/insight-hub/marcas">Gerir marcas</Link>
            </Button>
            <Button size="sm" variant="outline" disabled className={cn("gap-1")}>
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Novo relatório (breve)
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileBarChart className="h-4 w-4 text-primary" aria-hidden />
              Relatórios
            </CardTitle>
            <CardDescription>Layouts e widgets personalizáveis — em construção.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Em breve: editor drag-and-drop e templates.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutPanelLeft className="h-4 w-4 text-primary" aria-hidden />
              Dashboards
            </CardTitle>
            <CardDescription>
              {limits.maxDashboards < 0 ? "Ilimitados no seu plano." : `Até ${limits.maxDashboards} painéis.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Sincronização com dados das conexões por marca.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-primary" aria-hidden />
              Agendamentos
            </CardTitle>
            <CardDescription>
              {limits.maxScheduledReports < 0
                ? "Agendamentos ilimitados."
                : `Até ${limits.maxScheduledReports} envios programados.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Fila de envio por e-mail — roadmap.</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meu plano</CardTitle>
          <CardDescription>Uso face aos limites contratados.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Marcas</span>
              <span className="font-medium tabular-nums">
                {usage.brands}
                {brandCap != null ? ` / ${brandCap}` : " · ilimitado"}
              </span>
            </div>
            {brandCap != null && brandCap > 0 ? <Progress value={brandPct} className="h-2" /> : null}
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Dashboards</span>
              <span className="font-medium tabular-nums">
                {usage.dashboards ?? 0}
                {dashCap != null ? ` / ${dashCap}` : " · ilimitado"}
              </span>
            </div>
            {dashCap != null && dashCap > 0 ? <Progress value={dashPct} className="h-2" /> : null}
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className={limits.aiAnalysis ? "text-foreground font-medium" : ""}>
              IA {limits.aiAnalysis ? "incluída" : "não incluída"}
            </span>
            <span>·</span>
            <span className={limits.clientPortal ? "text-foreground font-medium" : ""}>
              Portal cliente {limits.clientPortal ? "sim" : "não"}
            </span>
            <span>·</span>
            <Link to="/clientes/insight-hub/planos" className="text-primary underline-offset-4 hover:underline">
              Comparar planos
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
