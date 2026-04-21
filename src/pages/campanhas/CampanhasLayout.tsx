import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { List, MapPin, Sparkles, Scale, FileEdit, Library } from "lucide-react";

const SUB_LINKS: { to: string; label: string; end?: boolean; icon: typeof List }[] = [
  { to: "/campanhas", label: "Visão geral", end: true, icon: List },
  { to: "/campanhas/segmentacao-geografica", label: "Segmentação geográfica", icon: MapPin },
  { to: "/campanhas/nova-campanha", label: "Nova campanha (IA)", icon: Sparkles },
  { to: "/campanhas/estrategia", label: "Estratégia", icon: Scale },
  { to: "/campanhas/leads", label: "Leads / formulários", icon: FileEdit },
  { to: "/campanhas/biblioteca-anuncios", label: "Biblioteca de anúncios", icon: Library },
];

export default function CampanhasLayout() {
  return (
    <div className="space-y-5 animate-fade-in min-w-0">
      <div>
        <h1 className="text-2xl font-display font-bold">Campanhas</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Hub centralizado de tráfego pago — crie, segmente e otimize sem sair da plataforma.
        </p>
      </div>

      <Card className="border-border/60 p-2 sm:p-3">
        <ScrollArea className="w-full whitespace-nowrap">
          <nav className="flex gap-1.5 min-w-0 pb-1" aria-label="Submenu Campanhas">
            {SUB_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition-colors shrink-0",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )
                }
              >
                <item.icon className="h-3.5 w-3.5 shrink-0 opacity-90" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <ScrollBar orientation="horizontal" className="h-1.5" />
        </ScrollArea>
      </Card>

      <Outlet />
    </div>
  );
}
