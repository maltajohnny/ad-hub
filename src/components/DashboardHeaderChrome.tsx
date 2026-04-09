import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useKanban } from "@/contexts/KanbanContext";
import { clientsData } from "@/pages/Clientes";
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

/** Barra superior global (todas as rotas exceto Board): Dashboard + cliente selecionado (Kanban), alinhado ao PRD. */
export function DashboardHeaderChrome() {
  const { canUserSeeClient } = useAuth();
  const { boardClientId, setBoardClientId } = useKanban();

  const visibleClients = useMemo(
    () => clientsData.filter((cl) => canUserSeeClient(cl.id)),
    [canUserSeeClient],
  );

  const clientsByPerformance = useMemo(
    () => [...visibleClients].sort((a, b) => parseRoiStr(b.roi) - parseRoiStr(a.roi)),
    [visibleClients],
  );

  const currentClient = clientsByPerformance.find((cl) => cl.id === boardClientId) ?? clientsByPerformance[0];

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3 md:gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h1 className="text-lg sm:text-xl font-display font-bold shrink-0 text-foreground">Dashboard</h1>
        <span className="text-muted-foreground/80 hidden sm:inline" aria-hidden={true}>
          —
        </span>
        {clientsByPerformance.length > 0 && currentClient ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex max-w-[min(100%,18rem)] items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1 text-sm font-semibold text-foreground transition-colors",
                  "hover:border-border hover:bg-muted/25",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
                aria-label={`Cliente: ${currentClient.name}. Clique para trocar.`}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/80" aria-hidden={true} />
                <span className="truncate">{currentClient.name}</span>
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
