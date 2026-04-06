import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";
import { clientsData, getClientDetail, type Client } from "@/pages/Clientes";

export default function IntelliSearchPerformanceReport() {
  const { canUserSeeClient } = useAuth();

  const visible = useMemo(() => clientsData.filter((c) => canUserSeeClient(c.id)), [canUserSeeClient]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Relatório de performance</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Consolida o contexto dos clientes que vê em <strong>Clientes</strong>: insight de IA simulado, decisões recentes e
          canais — o mesmo universo de dados usado nos cards e na otimização por IA.
        </p>
      </div>

      {visible.length === 0 ? (
        <Card className="border-border/60 max-w-xl">
          <CardContent className="py-6 text-sm text-muted-foreground">
            Nenhum cliente visível para a sua conta. Ajuste permissões em{" "}
            <Link to="/usuarios" className="text-primary font-medium hover:underline">
              Usuários
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((c) => (
            <ClientPerformanceCard key={c.id} client={c} />
          ))}
        </div>
      )}

      <Button variant="outline" asChild className="gap-2">
        <Link to="/clientes">
          Abrir Clientes
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

function ClientPerformanceCard({ client }: { client: Client }) {
  const detail = useMemo(() => getClientDetail(client), [client.id]);
  const lastDecision = detail.decisions[0];

  return (
    <Card className="border-border/60 flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{client.name}</CardTitle>
          <Badge variant={client.status === "Ativo" ? "default" : "secondary"}>{client.status}</Badge>
        </div>
        <CardDescription>{client.segment}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 flex-1 flex flex-col">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">ROI</span>
            <p className="font-semibold tabular-nums">{client.roi}</p>
          </div>
          <div>
            <span className="text-muted-foreground">CPA</span>
            <p className="font-semibold tabular-nums">
              {client.cpa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
          <div className="flex items-center gap-2 text-primary font-medium mb-1">
            <Sparkles className="h-4 w-4 shrink-0" />
            Insight (IA)
          </div>
          <p className="text-muted-foreground leading-relaxed text-xs">{client.aiInsight}</p>
        </div>

        {lastDecision ? (
          <div className="text-xs space-y-1 border-t border-border/50 pt-3 mt-auto">
            <p className="font-medium text-foreground">{lastDecision.title}</p>
            <p className="text-muted-foreground line-clamp-3">{lastDecision.reason}</p>
            <p className="text-[10px] text-muted-foreground/80">{lastDecision.at}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
