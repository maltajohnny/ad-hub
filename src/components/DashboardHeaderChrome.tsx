import { useEffect, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isPlatformOperator } from "@/lib/saasTypes";
import { useTenant } from "@/contexts/TenantContext";
import { useKanban } from "@/contexts/KanbanContext";
import { clientsData } from "@/pages/Clientes";
import { findManagerRecord, getOrgMediaState, managerSeesClient } from "@/lib/mediaManagementStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function parseRoiStr(roi: string): number {
  return parseFloat(roi.replace(/x/gi, "").replace(",", ".").trim()) || 0;
}

/** Barra superior global (todas as rotas exceto Board): título contextual + cliente selecionado. */
export function DashboardHeaderChrome() {
  const { canUserSeeClient, user, orgBilling } = useAuth();
  const { tenant } = useTenant();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { boardClientId, setBoardClientId } = useKanban();

  const isGestaoMidias = location.pathname === "/gestao-midias";
  const orgId = user?.organizationId ?? tenant?.id ?? null;
  const mediaState = orgId ? getOrgMediaState(orgId) : null;
  const mediaClients = useMemo(() => {
    if (!mediaState || !user) return [];
    if (user.role === "admin") return mediaState.mediaClients;
    const mgr = findManagerRecord(mediaState, user.username, user.email);
    if (!mgr) return [];
    return mediaState.mediaClients.filter((c) => managerSeesClient(mgr, c.id));
  }, [mediaState, user]);

  const visibleClients = useMemo(
    () => clientsData.filter((cl) => canUserSeeClient(cl.id)),
    [canUserSeeClient],
  );

  const clientsByPerformance = useMemo(
    () => [...visibleClients].sort((a, b) => parseRoiStr(b.roi) - parseRoiStr(a.roi)),
    [visibleClients],
  );

  const currentDemoClient = clientsByPerformance.find((cl) => cl.id === boardClientId) ?? clientsByPerformance[0];

  const mc = searchParams.get("mc");
  const currentMediaClient = useMemo(() => {
    if (!mediaClients.length) return null;
    const byParam = mc && mediaClients.find((c) => c.id === mc);
    return byParam ?? mediaClients[0];
  }, [mc, mediaClients]);

  useEffect(() => {
    if (!isGestaoMidias || !mediaClients.length) return;
    if (!mc || !mediaClients.some((c) => c.id === mc)) {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("mc", mediaClients[0].id);
          return n;
        },
        { replace: true },
      );
    }
  }, [isGestaoMidias, mc, mediaClients, setSearchParams]);

  const headerTitle = isGestaoMidias ? "Gestão de Mídias" : "Dashboard";

  const planChip =
    user &&
    user.organizationId &&
    !isPlatformOperator(user.username) &&
    orgBilling != null &&
    (orgBilling.planSlug || orgBilling.subscriptionStatus !== "none")
      ? (() => {
          const name =
            orgBilling.planSlug === "gestor"
              ? "Gestor"
              : orgBilling.planSlug === "organizacao"
                ? "Organização"
                : orgBilling.planSlug === "scale"
                  ? "Scale"
                  : "Plano";
          const st =
            orgBilling.subscriptionStatus === "active"
              ? "Ativo"
              : orgBilling.subscriptionStatus === "pending"
                ? "Pendente"
                : orgBilling.subscriptionStatus;
          return `${name} · ${st}`;
        })()
      : null;

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3 md:gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h1 className="text-lg sm:text-xl font-display font-bold shrink-0 text-foreground">{headerTitle}</h1>
        {planChip ? (
          <span
            className="max-w-[min(100%,14rem)] truncate rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:text-[11px]"
            title={planChip}
          >
            {planChip}
          </span>
        ) : null}
        <span className="text-muted-foreground/80 hidden sm:inline" aria-hidden={true}>
          —
        </span>
        {isGestaoMidias ? (
          mediaClients.length > 0 && currentMediaClient ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex max-w-[min(100%,18rem)] items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1 text-sm font-semibold text-foreground transition-colors",
                    "hover:border-border hover:bg-muted/25",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  )}
                  aria-label={`Cliente de mídia: ${currentMediaClient.name}. Clique para trocar.`}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/80" aria-hidden={true} />
                  <span className="truncate">{currentMediaClient.name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[12rem] p-1">
                {mediaClients.map((cl) => (
                  <DropdownMenuItem
                    key={cl.id}
                    className={cn("cursor-pointer text-sm", cl.id === currentMediaClient.id && "bg-accent/80")}
                    onSelect={() => {
                      setSearchParams(
                        (prev) => {
                          const n = new URLSearchParams(prev);
                          n.set("mc", cl.id);
                          return n;
                        },
                        { replace: true },
                      );
                    }}
                  >
                    <span className="truncate">{cl.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="text-sm text-muted-foreground">Nenhum cliente no módulo</span>
          )
        ) : clientsByPerformance.length > 0 && currentDemoClient ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex max-w-[min(100%,18rem)] items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1 text-sm font-semibold text-foreground transition-colors",
                  "hover:border-border hover:bg-muted/25",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
                aria-label={`Cliente: ${currentDemoClient.name}. Clique para trocar.`}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/80" aria-hidden={true} />
                <span className="truncate">{currentDemoClient.name}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[12rem] p-1">
              {clientsByPerformance.map((cl) => (
                <DropdownMenuItem
                  key={cl.id}
                  className={cn("cursor-pointer text-sm", cl.id === boardClientId && "bg-accent/80")}
                  onSelect={() => setBoardClientId(cl.id)}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="truncate">{cl.name}</span>
                    <span className="text-[10px] tabular-nums text-muted-foreground">{cl.roi}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-sm text-muted-foreground">Nenhum cliente disponível</span>
        )}
      </div>
      <div className="hidden min-h-[1.75rem] sm:block" aria-hidden={true} />
    </div>
  );
}
