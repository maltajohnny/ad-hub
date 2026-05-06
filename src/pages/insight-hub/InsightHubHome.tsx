import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchInsightHubBootstrap, type InsightHubBootstrap } from "@/lib/insightHubApi";
import { useAuth } from "@/contexts/AuthContext";
import {
  adHubAuthPing,
  isServerAuthLive,
  type AdHubAuthPingResult,
  type AdHubAuthPingTransportError,
} from "@/lib/adhubAuthApi";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, FileBarChart, LayoutPanelLeft, CalendarClock, Rocket, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { InsightHubPlansModal } from "@/pages/insight-hub/InsightHubPlansModal";

function isActive(b: InsightHubBootstrap): b is Extract<InsightHubBootstrap, { active: true }> {
  return b.active === true;
}

function pingInsightHint(p: AdHubAuthPingResult | null): string {
  if (!p) {
    return "Não houve resposta de /api/ad-hub/auth/ping. Use http://localhost:8080 com npm run dev:with-api, ou confirme que o domínio encaminha /api/ad-hub para a API Go.";
  }
  const bits: string[] = [];
  if (!p.jwt_ready) {
    bits.push("Defina ADHUB_JWT_SECRET no .env na raiz do projeto (mesmo ficheiro que o env-cmd usa ao arrancar a API) e reinicie.");
  }
  if (!p.db) {
    if (p.mysql_dsn_set) {
      bits.push("MYSQL_DSN está definido mas a ligação MySQL falhou — verifique user, senha (URL-encode), host e porta no DSN.");
    } else {
      bits.push("Defina MYSQL_DSN no .env para a API ligar à base (Insight Hub grava dados por organização). Sem BD o ping marca db=false.");
    }
  }
  if (p.hint) bits.push(p.hint);
  return bits.join(" ");
}

export default function InsightHubHome() {
  const { user } = useAuth();
  const [plansOpen, setPlansOpen] = useState(false);
  const [ping, setPing] = useState<AdHubAuthPingResult | AdHubAuthPingTransportError | null>(null);
  const [pingReady, setPingReady] = useState(false);
  useEffect(() => {
    let cancel = false;
    adHubAuthPing().then((p) => {
      if (!cancel) {
        setPing(p);
        setPingReady(true);
      }
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

  if (!pingReady) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
        A verificar ligação à API…
      </div>
    );
  }

  if (!serverLive && ping && "transportError" in ping) {
    const err = ping;
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
          <p className="font-medium text-foreground">O browser não obteve JSON válido do ping</p>
          <p className="mt-2 text-muted-foreground">
            O pedido da página usa este URL:{" "}
            <code className="break-all rounded bg-muted px-1 text-[11px] text-foreground">{err.url}</code>
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1 text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Tipo:</span>{" "}
              {err.kind === "network" && "rede / CORS / bloqueio"}
              {err.kind === "http" && `HTTP ${err.httpStatus ?? "?"} (resposta não OK)`}
              {err.kind === "not_json" && "corpo não é JSON (muitas vezes HTML da SPA ou 404)"}
            </li>
            {err.httpStatus != null ? (
              <li>
                Código HTTP: <span className="font-mono">{err.httpStatus}</span>
              </li>
            ) : null}
            {err.hint ? (
              <li className="break-words">
                Detalhe: <span className="font-mono text-[11px]">{err.hint}</span>
              </li>
            ) : null}
          </ul>
          {err.bodyPreview ? (
            <pre className="mt-3 max-h-28 overflow-auto rounded-md border border-border/60 bg-muted/40 p-2 text-[10px] leading-snug text-muted-foreground">
              {err.bodyPreview}
            </pre>
          ) : null}
          <p className="mt-4 text-muted-foreground">
            No terminal, <code className="text-xs">curl {err.url}</code> pode funcionar se correr no servidor; no browser o mesmo path tem de
            devolver JSON ou configurar <code className="text-xs">ADHUB_ALLOWED_ORIGINS</code> no Go com o origin exato da página (sem misturar{" "}
            <code className="text-xs">www</code> com apex). Se o build tiver <code className="text-xs">VITE_ADHUB_API_URL</code> para outro
            host, esse host tem de permitir CORS; com API no mesmo domínio, deixe <code className="text-xs">VITE_ADHUB_API_URL</code> vazio no
            build.
          </p>
        </div>
      </div>
    );
  }

  if (!serverLive) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-sm">
          <p className="font-medium text-foreground">Insight Hub precisa da API Go com MySQL e JWT</p>
          <p className="mt-2 text-muted-foreground">
            O ecrã só carrega quando o ping confirma <code className="rounded bg-muted px-1 text-xs">db: true</code> e{" "}
            <code className="rounded bg-muted px-1 text-xs">jwt_ready: true</code>. Local:{" "}
            <code className="text-xs">npm run dev:with-api</code> + <code className="text-xs">.env</code> na raiz.{" "}
            <strong className="text-foreground">Servidor (HostGator):</strong> o mesmo par no ficheiro{" "}
            <code className="text-xs">~/apps/minha-api/.env</code> ao lado do binário <code className="text-xs">api</code>; reinicie o processo
            após guardar.
          </p>
          <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">MySQL (ping.db)</dt>
              <dd className="font-mono font-medium">{ping?.db === true ? "true ✓" : `false (${String(ping?.db)})`}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">JWT (ping.jwt_ready)</dt>
              <dd className="font-mono font-medium">{ping?.jwt_ready === true ? "true ✓" : `false (${String(ping?.jwt_ready)})`}</dd>
            </div>
            {ping?.database ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Base ligada</dt>
                <dd className="font-mono text-[11px]">{ping.database}</dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-4 text-muted-foreground">{pingInsightHint(ping)}</p>
        </div>
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
    const raw = (q.error as Error)?.message ?? "Erro desconhecido";
    const tokenHint =
      raw === "Token em falta"
        ? "Falta o JWT da sessão (Authorization Bearer). O Insight Hub chama a API Go com o token que recebe após iniciar sessão com uma conta existente na base MySQL. Termine sessão, inicie sessão de novo com o mesmo utilizador/palavra-passe da API, e volte aqui."
        : raw;
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-base">Não foi possível sincronizar</CardTitle>
          <CardDescription>{tokenHint}</CardDescription>
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
        <InsightHubPlansModal open={plansOpen} onOpenChange={setPlansOpen} />
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
            <Button className="gap-2" onClick={() => setPlansOpen(true)}>
              Ver planos Insight Hub
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
      <InsightHubPlansModal open={plansOpen} onOpenChange={setPlansOpen} />
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
            <Button asChild variant="outline" size="sm">
              <Link to="/clientes/insight-hub/conexoes">Conectar Meta</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/clientes/insight-hub/overview" className={cn("gap-1")}>
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Ver Overview
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/clientes/insight-hub/relatorios">Criar relatório</Link>
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
            <button
              type="button"
              onClick={() => setPlansOpen(true)}
              className="text-primary underline-offset-4 hover:underline"
            >
              Comparar planos
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
