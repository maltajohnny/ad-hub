import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Home,
  Building2,
  CreditCard,
  LayoutGrid,
  LineChart,
  ImageIcon,
  Repeat,
  FileBarChart,
  CalendarClock,
  Plug,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NAV = [
  { to: "/clientes/insight-hub", label: "Início", icon: Home, end: true },
  { to: "/clientes/insight-hub/marcas", label: "Marcas", icon: Building2 },
  { to: "/clientes/insight-hub/conexoes", label: "Conexões", icon: Plug },
  { to: "/clientes/insight-hub/overview", label: "Overview", icon: LineChart },
  { to: "/clientes/insight-hub/posts", label: "Posts", icon: ImageIcon },
  { to: "/clientes/insight-hub/comparativo", label: "Comparativo", icon: Repeat },
  { to: "/clientes/insight-hub/relatorios", label: "Relatórios", icon: FileBarChart },
  { to: "/clientes/insight-hub/agendamentos", label: "Agendamentos", icon: CalendarClock },
  { to: "/clientes/insight-hub/planos", label: "Planos & limites", icon: CreditCard },
] as const;

function navSelectValue(pathname: string): string {
  for (const item of NAV) {
    if (item.to === "/clientes/insight-hub") continue;
    if (pathname.startsWith(item.to)) return item.to;
  }
  return "/clientes/insight-hub";
}

export default function InsightHubLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const mobileVal = navSelectValue(pathname);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 lg:flex-row lg:gap-4 lg:items-start">
      <div className="shrink-0 space-y-2 lg:hidden">
        <Label className="text-xs text-muted-foreground">Insight Hub</Label>
        <Select value={mobileVal} onValueChange={(to) => navigate(to)}>
          <SelectTrigger className="w-full border-border/50 bg-card/40">
            <SelectValue placeholder="Início" />
          </SelectTrigger>
          <SelectContent className="z-[200]" position="popper">
            {NAV.map((item) => (
              <SelectItem key={item.to} value={item.to}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <nav
        aria-label="Insight Hub"
        className="hidden shrink-0 flex-col space-y-1 rounded-xl border border-border/50 bg-card/30 p-3 lg:flex lg:w-[210px] lg:min-w-[190px]"
      >
        <div className="mb-2 flex items-center gap-2 border-b border-border/40 pb-3">
          <LayoutGrid className="h-4 w-4 text-primary" aria-hidden />
          <span className="text-sm font-semibold leading-none">Insight Hub</span>
        </div>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            {item.label}
          </NavLink>
        ))}
        <p className="mt-4 px-1 text-[11px] leading-snug text-muted-foreground">
          Relatórios, dashboards e conexões por marca — evolução contínua do produto.
        </p>
      </nav>

      <div className="min-h-0 min-w-0 flex-1 space-y-6 pb-8">
        <Outlet />
      </div>
    </div>
  );
}
