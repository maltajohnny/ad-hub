import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import {
  calcModuleAddonMonthly,
  calcSeatOverageMonthly,
  formatBRL,
  normalizePlanSlug,
  PLAN_BASE_MONTHLY,
} from "@/lib/moduleBilling";
import { APP_MODULE_LABELS, isPlatformOperator, type AppModule } from "@/lib/saasTypes";
import { AlertTriangle, CheckCircle2, CreditCard, ExternalLink, ReceiptText, TrendingUp } from "lucide-react";
import { fetchAdHubInvoices, type BillingInvoiceRow } from "@/lib/insightHubApi";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const activeLike = new Set(["active", "pending"]);
const overdueLike = new Set(["past_due", "overdue", "expired"]);

export default function MeuPlano() {
  const { user, orgBilling, listUsers } = useAuth();
  const { tenant } = useTenant();

  const isOrgOwner = Boolean(user?.role === "admin" && !isPlatformOperator(user?.username));

  const modules = useMemo(() => {
    const fromTenant = tenant?.enabledModules?.length ? tenant.enabledModules : [];
    return fromTenant.filter((m) => m !== "meu-plano") as AppModule[];
  }, [tenant?.enabledModules]);

  const memberCount = useMemo(() => {
    if (!user?.organizationId) return 1;
    const rows = listUsers().filter((u) => u.organizationId === user.organizationId && u.disabled !== true);
    return Math.max(1, rows.length);
  }, [listUsers, user?.organizationId]);

  const plan = normalizePlanSlug(orgBilling?.planSlug);
  const planBase = PLAN_BASE_MONTHLY[plan];
  const moduleExtras = calcModuleAddonMonthly(modules);
  const seatOver = calcSeatOverageMonthly(plan, memberCount);
  const monthlyEstimate = planBase + moduleExtras.total + seatOver.total;

  const hasSubscription = activeLike.has(orgBilling?.subscriptionStatus ?? "");
  const hasOverdue = overdueLike.has(orgBilling?.subscriptionStatus ?? "");

  const invoicesQ = useQuery({
    queryKey: ["adhub", "billing", "invoices"],
    queryFn: fetchAdHubInvoices,
    enabled: Boolean(user?.organizationId),
  });

  const realInvoicePending = useMemo(() => {
    if (!invoicesQ.data) return { count: 0, total: 0 };
    const list = invoicesQ.data.invoices.filter((i) => ["pending", "overdue"].includes(i.status));
    return {
      count: list.length,
      total: list.reduce((acc, i) => acc + (i.amountCents || 0), 0) / 100,
    };
  }, [invoicesQ.data]);

  const pendingItems = useMemo(() => {
    const items: { title: string; amount: number; severity: "warn" | "danger" }[] = [];
    if (!hasSubscription) {
      items.push({
        title: "Assinatura da organização não está ativa",
        amount: monthlyEstimate,
        severity: hasOverdue ? "danger" : "warn",
      });
    }
    if (realInvoicePending.count > 0) {
      items.push({
        title: `${realInvoicePending.count} fatura(s) em aberto no Asaas`,
        amount: realInvoicePending.total,
        severity: "danger",
      });
    }
    if (seatOver.extraSeats > 0) {
      items.push({
        title: `Excedente de equipa (${seatOver.extraSeats} lugar${seatOver.extraSeats > 1 ? "es" : ""})`,
        amount: seatOver.total,
        severity: "warn",
      });
    }
    return items;
  }, [
    hasSubscription,
    hasOverdue,
    monthlyEstimate,
    seatOver.extraSeats,
    seatOver.total,
    realInvoicePending.count,
    realInvoicePending.total,
  ]);

  if (!user || !isOrgOwner) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Meu Plano</CardTitle>
          <CardDescription>Apenas o owner/admin da organização pode gerir faturação e upgrades.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <ReceiptText className="h-6 w-6 text-primary" />
          Meu Plano
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gere módulos, pendências, faturação mensal e upgrade da sua organização.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Plano atual</CardDescription>
            <CardTitle className="text-lg uppercase">{plan === "none" ? "Sem plano" : plan}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={hasOverdue ? "destructive" : "secondary"}>
              {orgBilling?.subscriptionStatus ?? "none"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Previsão mensal</CardDescription>
            <CardTitle className="text-lg">{formatBRL(monthlyEstimate)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Base {formatBRL(planBase)} + módulos {formatBRL(moduleExtras.total)} + equipa {formatBRL(seatOver.total)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Membros ativos</CardDescription>
            <CardTitle className="text-lg">{memberCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Excedente do plano: {seatOver.extraSeats} lugar{seatOver.extraSeats > 1 ? "es" : ""}.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Faturas e pendências
          </CardTitle>
          <CardDescription>
            Quando houver módulos liberados fora do pacote ou assinatura em atraso, as pendências aparecem aqui.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingItems.length === 0 ? (
            <p className="text-sm text-emerald-600">Sem pendências no momento.</p>
          ) : (
            pendingItems.map((p) => (
              <div
                key={p.title}
                className="rounded-lg border border-border/60 bg-secondary/15 px-3 py-2 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className={`h-4 w-4 ${p.severity === "danger" ? "text-destructive" : "text-amber-500"}`} />
                    {p.title}
                  </p>
                  <p className="text-xs text-muted-foreground">Regularize para manter todos os módulos ativos.</p>
                </div>
                <span className="text-sm font-semibold tabular-nums">{formatBRL(p.amount)}</span>
              </div>
            ))
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild className="gap-2">
              <Link to="/planos">Pagar / Regularizar agora</Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/planos">
                <TrendingUp className="h-4 w-4" />
                Fazer upgrade de plano
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-primary" />
            Histórico de faturas
          </CardTitle>
          <CardDescription>
            Sincronizadas em tempo real com o Asaas — clique no link para abrir o boleto/fatura.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {invoicesQ.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">A carregar faturas…</p>
          ) : invoicesQ.isError ? (
            <p className="p-4 text-sm text-destructive">{(invoicesQ.error as Error).message}</p>
          ) : !invoicesQ.data?.invoices.length ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma fatura registada ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoicesQ.data.invoices.map((inv: BillingInvoiceRow) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-sm">{inv.description || "Plano"}</TableCell>
                    <TableCell className="text-xs uppercase">
                      <span
                        className={`inline-flex items-center gap-1 ${
                          inv.status === "paid"
                            ? "text-emerald-600"
                            : inv.status === "overdue"
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {inv.status === "paid" ? <CheckCircle2 className="h-3 w-3" /> : null}
                        {inv.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL((inv.amountCents || 0) / 100)}</TableCell>
                    <TableCell className="text-right">
                      {inv.invoiceUrl ? (
                        <a
                          href={inv.invoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                        >
                          Abrir <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Módulos ativos na organização</CardTitle>
          <CardDescription>Geridos pelo Owner da plataforma em Organizações.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {modules.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem módulos específicos configurados (modo “todos”).</p>
          ) : (
            modules.map((m) => (
              <Badge key={m} variant="secondary" className="gap-1">
                {APP_MODULE_LABELS[m]}
                {moduleExtras.billable.includes(m) ? ` · ${formatBRL(calcModuleAddonMonthly([m]).total)}` : ""}
              </Badge>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
