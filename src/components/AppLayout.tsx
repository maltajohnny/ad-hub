import { ReactNode, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Settings,
  BarChart3,
  UsersRound,
  Star,
  Columns3,
  Layers2,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import norterSymbol from "@/assets/norter-symbol.png";
/** Tema escuro UI: arte “white” (texto claro). Tema claro UI: arte “black”. Ambas 220×65. */
import norterLogoDashboardDark from "@/assets/norter-logo-dashboard-dark.png";
import norterLogoDashboardLight from "@/assets/norter-logo-dashboard-light.png";
import { UserAvatarDisplay } from "@/components/UserAvatarDisplay";
import { UserMenuDropdown } from "@/components/UserMenuDropdown";
import { FirstAccessPasswordModal } from "@/components/FirstAccessPasswordModal";
import { SlackReportScheduler } from "@/components/SlackReportScheduler";
import {
  effectiveModulesForUser,
  firstAllowedPath,
  pathToModule,
  type AppModule,
} from "@/lib/saasTypes";

type MenuItem = {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  adminOnly?: boolean;
  module: AppModule;
};

function AppLayoutMain({ children, className }: { children: ReactNode; className?: string }) {
  const location = useLocation();
  const isBoard = location.pathname === "/board";
  const isDashboardHome = location.pathname === "/";

  return (
    <main className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", className)}>
      {/* Altura alinhada à faixa da logo (65px + padding) na sidebar */}
      <div className="box-border flex min-h-[85px] w-full min-w-0 shrink-0 items-center gap-3 border-b border-border/40 bg-background px-4 py-2.5 lg:px-6">
        {/* Portal: Board (título + cliente + filtros) ou Dashboard (título + cliente). `flex-1` mantém o avatar à direita mesmo vazio. */}
        <div
          id="app-header-slot"
          className={cn(
            "flex min-w-0 flex-1 items-center",
            isBoard || isDashboardHome ? "min-h-[2.75rem]" : "min-h-0",
          )}
          aria-hidden={!(isBoard || isDashboardHome)}
        />
        <div className="flex shrink-0 items-center">
          <UserMenuDropdown avatarOnly />
        </div>
      </div>
      <div
        className={cn(
          "flex-1 flex flex-col min-h-0",
          isBoard ? "overflow-hidden" : "overflow-auto",
        )}
      >
        <div
          className={cn(
            isBoard
              ? "flex-1 flex flex-col min-h-0 w-full max-w-none px-4 lg:px-6 pb-4 pt-3"
              : "p-6 lg:p-8 max-w-7xl mx-auto flex-1",
          )}
        >
          {children}
        </div>
      </div>
    </main>
  );
}

const menuAfterClientes: MenuItem[] = [
  { icon: BarChart3, label: "Campanhas", path: "/campanhas", module: "campanhas" },
  { icon: TrendingUp, label: "IA & ROI", path: "/ia-roi", module: "ia-roi" },
  { icon: UsersRound, label: "Usuários", path: "/usuarios", adminOnly: true, module: "usuarios" },
  { icon: Settings, label: "Configurações", path: "/configuracoes", module: "configuracoes" },
];

const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, logout } = useAuth();
  const { tenant, brandingLogoSrc, brandingName, setActiveSlug } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dashSubOpen, setDashSubOpen] = useState(false);
  const [clientesSubOpen, setClientesSubOpen] = useState(false);

  useEffect(() => setMounted(true), []);
  const isLight = mounted && resolvedTheme === "light";

  const isAdmin = user?.role === "admin";
  const eff = effectiveModulesForUser(user, tenant?.enabledModules);
  const canSee = (m: AppModule) => eff === "all" || eff.includes(m);

  const visibleRest = menuAfterClientes.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (eff !== "all" && !eff.includes(item.module)) return false;
    return true;
  });

  const path = location.pathname;

  const showDashSection = canSee("dashboard") || canSee("board");
  const showClientesSection = canSee("clientes") || canSee("clientes-favoritos");

  useEffect(() => {
    if (!user || eff === "all") return;
    const mod = pathToModule(path);
    if (!mod) return;
    if (!eff.includes(mod)) {
      navigate(firstAllowedPath(eff), { replace: true });
    }
  }, [user, path, eff, navigate]);

  const handleLogout = () => {
    setActiveSlug(null);
    logout();
  };
  const clientesListActive = path === "/clientes";
  const favoritosActive = path === "/clientes/favoritos";
  const dashboardActive = path === "/";
  const boardActive = path === "/board";

  useEffect(() => {
    if (path === "/" || path === "/board") setDashSubOpen(true);
  }, [path]);

  useEffect(() => {
    if (path === "/clientes" || path === "/clientes/favoritos") setClientesSubOpen(true);
  }, [path]);

  return (
    <div className="flex min-h-screen bg-background">
      {user?.mustChangePassword ? <FirstAccessPasswordModal /> : null}
      {user && !user.mustChangePassword ? <SlackReportScheduler /> : null}
      {/* `isolate` + borda única evita “degrau” visual na junção com o main; `z-10` mantém a linha vertical contínua */}
      <aside
        className={cn(
          "relative z-10 flex shrink-0 flex-col bg-sidebar transition-[width] duration-300",
          "border-r border-border/40",
          collapsed ? "w-20" : "w-64",
        )}
      >
        {/* Mesmo padding horizontal que o <nav> (p-3) para alinhar logo com os itens abaixo */}
        <div
          className={cn(
            "box-border flex min-h-[85px] shrink-0 border-b border-border/40 px-3 py-2.5",
            collapsed ? "justify-center" : "items-center",
          )}
        >
          {mounted && !collapsed ? (
            <button
              type="button"
              onClick={() => navigate(canSee("dashboard") ? "/" : "/board")}
              className="flex w-full min-w-0 flex-1 cursor-pointer items-center justify-start rounded-md text-left transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
              aria-label="Ir para o início"
            >
              {tenant && brandingLogoSrc ? (
                <img
                  src={brandingLogoSrc}
                  alt={brandingName}
                  width={220}
                  height={65}
                  className="h-[65px] w-[220px] max-w-full shrink-0 object-contain object-left"
                  decoding="async"
                />
              ) : tenant && !brandingLogoSrc ? (
                <div className="flex min-w-0 flex-col items-start gap-0.5 py-1">
                  <img
                    src={norterSymbol}
                    alt=""
                    width={44}
                    height={44}
                    className="h-11 w-11 shrink-0 object-contain"
                  />
                  <span className="truncate text-left text-xs font-semibold leading-tight text-sidebar-foreground">
                    {brandingName}
                  </span>
                </div>
              ) : (
                <img
                  src={isLight ? norterLogoDashboardLight : norterLogoDashboardDark}
                  alt="Norter — Aceleradora"
                  width={220}
                  height={65}
                  className="h-[65px] w-[220px] max-w-full shrink-0 object-contain object-left"
                  decoding="async"
                />
              )}
            </button>
          ) : mounted && collapsed ? (
            <button
              type="button"
              onClick={() => navigate(canSee("dashboard") ? "/" : "/board")}
              className="flex h-12 w-12 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
              aria-label="Ir para o início"
            >
              {tenant && brandingLogoSrc ? (
                <img
                  src={brandingLogoSrc}
                  alt=""
                  className="h-11 w-11 rounded-md object-contain"
                />
              ) : (
                <img
                  src={norterSymbol}
                  alt="Norter"
                  className={cn(
                    "h-11 w-11 object-contain object-center",
                    isLight &&
                      "rounded-md ring-1 ring-border/70 ring-inset bg-background/80 p-0.5 shadow-[0_0_0_1px_rgba(0,0,0,0.04)]",
                  )}
                />
              )}
            </button>
          ) : (
            <div className="h-12 w-full animate-pulse rounded-lg bg-sidebar-accent/40" aria-hidden />
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {showDashSection ? (
          <div className="space-y-0.5">
            <div className="w-full rounded-lg">
              <button
                type="button"
                aria-expanded={collapsed ? undefined : dashSubOpen}
                aria-controls="sidebar-dash-sub"
                onClick={(e) => {
                  const t = e.target as HTMLElement;
                  if (t.closest("[data-submenu-toggle]")) {
                    setDashSubOpen((o) => !o);
                  } else {
                    navigate(canSee("dashboard") ? "/" : "/board");
                    setDashSubOpen(true);
                  }
                }}
                className={cn(
                  "flex w-full min-w-0 items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left",
                  dashboardActive
                    ? "gradient-brand text-primary-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent",
                )}
              >
                <LayoutDashboard size={18} className="flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1 truncate">Dashboard</span>
                    <span
                      data-submenu-toggle
                      className={cn(
                        "inline-flex shrink-0 rounded p-0.5 -m-0.5 transition-colors",
                        dashboardActive ? "hover:bg-primary-foreground/15" : "hover:bg-sidebar-accent/80",
                      )}
                      title={dashSubOpen ? "Recolher submenu" : "Expandir submenu"}
                    >
                      <Layers2
                        className={cn(
                          "h-3.5 w-3.5 opacity-90",
                          dashboardActive ? "text-primary-foreground/85" : "text-muted-foreground",
                        )}
                        aria-hidden
                      />
                    </span>
                  </>
                )}
              </button>
            </div>
            {dashSubOpen && !collapsed && canSee("board") && (
              <button
                id="sidebar-dash-sub"
                type="button"
                onClick={() => navigate("/board")}
                className={cn(
                  "w-full flex items-center gap-3 pl-8 pr-3 py-2 rounded-lg text-xs transition-all",
                  boardActive
                    ? "bg-sidebar-accent text-foreground font-medium"
                    : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                )}
              >
                <Columns3 size={15} className="flex-shrink-0 opacity-90" />
                <span>Board</span>
              </button>
            )}
          </div>
          ) : null}

          {showClientesSection ? (
          <div className="space-y-0.5">
            <div className="w-full rounded-lg">
              <button
                type="button"
                aria-expanded={collapsed ? undefined : clientesSubOpen}
                aria-controls="sidebar-clientes-sub"
                onClick={(e) => {
                  const t = e.target as HTMLElement;
                  if (t.closest("[data-submenu-toggle]")) {
                    setClientesSubOpen((o) => !o);
                  } else {
                    navigate(canSee("clientes") ? "/clientes" : "/clientes/favoritos");
                    setClientesSubOpen(true);
                  }
                }}
                className={cn(
                  "flex w-full min-w-0 items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left",
                  clientesListActive
                    ? "gradient-brand text-primary-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent",
                )}
              >
                <Users size={18} className="flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1 truncate">Clientes</span>
                    <span
                      data-submenu-toggle
                      className={cn(
                        "inline-flex shrink-0 rounded p-0.5 -m-0.5 transition-colors",
                        clientesListActive ? "hover:bg-primary-foreground/15" : "hover:bg-sidebar-accent/80",
                      )}
                      title={clientesSubOpen ? "Recolher submenu" : "Expandir submenu"}
                    >
                      <Layers2
                        className={cn(
                          "h-3.5 w-3.5 opacity-90",
                          clientesListActive ? "text-primary-foreground/85" : "text-muted-foreground",
                        )}
                        aria-hidden
                      />
                    </span>
                  </>
                )}
              </button>
            </div>
            {clientesSubOpen && !collapsed && canSee("clientes-favoritos") && (
              <button
                id="sidebar-clientes-sub"
                type="button"
                onClick={() => navigate("/clientes/favoritos")}
                className={cn(
                  "w-full flex items-center gap-3 pl-8 pr-3 py-2 rounded-lg text-xs transition-all",
                  favoritosActive
                    ? "bg-sidebar-accent text-foreground font-medium"
                    : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                )}
              >
                <Star size={15} className="flex-shrink-0 opacity-90" />
                <span>Favoritos</span>
              </button>
            )}
          </div>
          ) : null}

          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate("/organizacoes")}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left",
                path === "/organizacoes"
                  ? "gradient-brand text-primary-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent",
              )}
            >
              <Building2 size={18} className="flex-shrink-0" />
              {!collapsed && <span>Organizações</span>}
            </button>
          )}

          {visibleRest.map((item) => {
            const active =
              item.path === "/"
                ? path === "/"
                : path === item.path || path.startsWith(`${item.path}/`);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active
                    ? "gradient-brand text-primary-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <item.icon size={18} className="flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-border/40 p-3">
          {!collapsed && (
            <div className="px-3 py-2 flex items-start gap-3">
              <UserAvatarDisplay user={user} className="h-9 w-9" iconSize={20} />
              <div className="text-xs text-muted-foreground min-w-0 flex-1">
                Logado como <span className="text-foreground font-medium block truncate">{user?.name}</span>
                {user?.role === "admin" ? (
                  <span className="block text-[10px] text-primary/90 mt-0.5">Administrador</span>
                ) : (
                  <span className="block text-[10px] text-muted-foreground/90 mt-1 leading-snug">
                    Perfil padrão — permissões detalhadas em breve.
                  </span>
                )}
              </div>
            </div>
          )}
          {collapsed && user && (
            <div className="flex justify-center pb-1">
              <UserAvatarDisplay user={user} className="h-9 w-9" iconSize={20} />
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut size={18} className="flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center py-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </aside>

      <AppLayoutMain className="isolate min-w-0 flex-1">{children}</AppLayoutMain>
    </div>
  );
};

export default AppLayout;
