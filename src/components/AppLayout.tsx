import { ReactNode, useEffect, useState } from "react";
import { AppHeaderSlotContext } from "@/contexts/AppHeaderSlotContext";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardHeaderChrome } from "@/components/DashboardHeaderChrome";
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
  Search,
  Clapperboard,
  Activity,
  Menu,
  FlaskConical,
  Calendar,
  Zap,
  UserSearch,
  Contact,
} from "lucide-react";
import { cn } from "@/lib/utils";
import norterSymbol from "@/assets/norter-symbol.png";
import adHubMark from "@/assets/ad-hub-logo.png";
/** Tema escuro UI: arte “white” (texto claro). Tema claro UI: arte “black”. Ambas 220×65. */
import norterLogoDashboardDark from "@/assets/norter-logo-dashboard-dark.png";
import norterLogoDashboardLight from "@/assets/norter-logo-dashboard-light.png";
import { UserAvatarDisplay } from "@/components/UserAvatarDisplay";
import { UserMenuDropdown } from "@/components/UserMenuDropdown";
import { FirstAccessPasswordModal } from "@/components/FirstAccessPasswordModal";
import { SlackReportScheduler } from "@/components/SlackReportScheduler";
import {
  APP_MODULE_LABELS,
  effectiveModulesForUser,
  firstAllowedPath,
  isPlatformOperator,
  pathToModule,
  type AppModule,
} from "@/lib/saasTypes";
import { isOrbixTeamMember } from "@/lib/orbixAccess";
import { IntelliSearchNewBadge } from "@/components/IntelliSearchNewBadge";
import { OrbixSidebarBrand } from "@/components/OrbixSidebarBrand";

type MenuItem = {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  adminOnly?: boolean;
  module: AppModule;
};

function AppMainHeaderRouteTitle({ pathname }: { pathname: string }) {
  const mod = pathToModule(pathname);
  const label = mod ? APP_MODULE_LABELS[mod] : "AD-Hub";
  return (
    <h1 className="min-w-0 truncate font-display text-lg font-bold text-foreground sm:text-xl">{label}</h1>
  );
}

function AppLayoutMain({
  children,
  className,
  onOpenMobileNav,
  tightMainPaddingMobile,
}: {
  children: ReactNode;
  className?: string;
  /** Em viewports abaixo de `lg` abre o menu lateral em gaveta. */
  onOpenMobileNav?: () => void;
  /** Clientes e Dashboard: menos margem horizontal no telemóvel (cards mais largos). */
  tightMainPaddingMobile?: boolean;
}) {
  const location = useLocation();
  const isBoard = location.pathname === "/board";
  const isIntelliSearch = location.pathname.startsWith("/intelli-search");
  const isSocialPulse = location.pathname.startsWith("/social-pulse");

  const { user } = useAuth();
  const platformOp = isPlatformOperator(user?.username);

  const [headerSlotEl, setHeaderSlotEl] = useState<HTMLDivElement | null>(null);

  return (
    <AppHeaderSlotContext.Provider value={headerSlotEl}>
      <main className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", className)}>
        {/* Mobile: barra compacta; desktop: alinhada à faixa da logo da sidebar (~85px) */}
        <div className="box-border flex min-h-[48px] w-full min-w-0 shrink-0 items-center gap-2 border-b border-border/40 bg-background px-2.5 py-1.5 max-lg:gap-5 sm:min-h-[52px] sm:px-3 lg:min-h-[85px] lg:gap-3 lg:px-6 lg:py-2.5">
          {onOpenMobileNav ? (
            <button
              type="button"
              onClick={onOpenMobileNav}
              className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-[5px] border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground active:scale-95 lg:hidden"
              aria-label="Abrir menu de navegação"
            >
              <Menu size={13} strokeWidth={2.5} className="shrink-0" />
            </button>
          ) : null}
          {/* Board: vazio + portal. Demais rotas: mesmo topo que o Dashboard (cliente global) — ver PRD. Operador plataforma: só título da rota. */}
          <div
            id="app-header-slot"
            ref={setHeaderSlotEl}
            className="flex min-w-0 flex-1 items-center min-h-[2.75rem]"
            aria-hidden={false}
          >
            {isBoard ? null : platformOp ? (
              <AppMainHeaderRouteTitle pathname={location.pathname} />
            ) : (
              <DashboardHeaderChrome />
            )}
          </div>
          <div className="flex shrink-0 items-center">
            <UserMenuDropdown avatarOnly />
          </div>
        </div>
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom,0px)] [scrollbar-gutter:stable] touch-pan-y [-webkit-overflow-scrolling:touch]",
            isBoard ? "overflow-hidden" : "overflow-y-auto overflow-x-hidden overscroll-y-contain",
          )}
        >
          <div
            className={cn(
              isBoard
                ? "flex-1 flex flex-col min-h-0 w-full max-w-none px-4 lg:px-6 pb-4 pt-3"
                : cn(
                    "max-w-7xl mx-auto w-full min-w-0 flex-1",
                    isIntelliSearch || isSocialPulse
                      ? "py-6 pr-6 pl-3 sm:pl-4 lg:py-8 lg:pr-8 lg:pl-5"
                      : tightMainPaddingMobile
                        ? "max-lg:py-6 max-lg:pl-[calc(25px+max(0.5rem,env(safe-area-inset-left,0px)))] max-lg:pr-[calc(25px+max(0.5rem,env(safe-area-inset-right,0px)))] lg:p-8"
                        : "p-6 lg:p-8",
                  ),
            )}
          >
            {children}
          </div>
        </div>
      </main>
    </AppHeaderSlotContext.Provider>
  );
}

const menuAfterClientes: MenuItem[] = [
  { icon: BarChart3, label: "Campanhas", path: "/campanhas", module: "campanhas" },
  { icon: Clapperboard, label: "Gestão de Mídias", path: "/gestao-midias", module: "gestao-midias" },
  {
    icon: Search,
    label: "IntelliSearch",
    path: "/intelli-search/health/complete",
    module: "intelli-search",
  },
  { icon: TrendingUp, label: "IA & ROI", path: "/ia-roi", module: "ia-roi" },
  { icon: Activity, label: "Social Pulse", path: "/social-pulse", module: "social-pulse" },
  { icon: FlaskConical, label: "Experimentação", path: "/experimentacao", module: "experimentacao" },
  { icon: Calendar, label: "Agendamento", path: "/scheduling", module: "scheduling" },
  { icon: Zap, label: "Automação", path: "/automation", module: "automation" },
  { icon: UserSearch, label: "Prospecção", path: "/prospecting", module: "prospecting" },
  { icon: Contact, label: "Centro de leads", path: "/leads", module: "leads" },
  { icon: UsersRound, label: "Usuários", path: "/usuarios", adminOnly: true, module: "usuarios" },
  { icon: Settings, label: "Configurações", path: "/configuracoes", module: "configuracoes" },
];

const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, logout, orgBilling } = useAuth();
  const { tenant, brandingLogoSrc, brandingName, setActiveSlug } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dashSubOpen, setDashSubOpen] = useState(false);
  const [clientesSubOpen, setClientesSubOpen] = useState(false);
  const [isLg, setIsLg] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  /** Em desktop a sidebar pode recolher; em mobile a gaveta mostra sempre rótulos completos. */
  const compact = isLg && collapsed;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      setIsLg(mq.matches);
      if (mq.matches) setMobileNavOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen || isLg) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen, isLg]);

  useEffect(() => {
    if (!mobileNavOpen || isLg) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen, isLg]);
  const isLight = mounted && resolvedTheme === "light";

  const isAdmin = user?.role === "admin";
  /** Equipa AD-Hub / operadores: marca AD-Hub na sidebar; org Norter (ou sem org) usa wordmark Norter. */
  const sidebarOrbix =
    !brandingLogoSrc && (isOrbixTeamMember(user) || tenant?.slug === "qtraffic");
  const sidebarNorterWordmark =
    !brandingLogoSrc && !sidebarOrbix && (!tenant || tenant.slug === "norter");
  const eff = effectiveModulesForUser(user, tenant?.enabledModules, orgBilling);
  const canSee = (m: AppModule) => eff === "all" || eff.includes(m);
  const homePath = eff === "all" ? "/dashboard" : firstAllowedPath(eff);

  const visibleRest = menuAfterClientes.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (eff !== "all" && !eff.includes(item.module)) return false;
    return true;
  });

  const path = location.pathname;

  useEffect(() => {
    setMobileNavOpen(false);
  }, [path]);

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
  const dashboardActive = path === "/dashboard";
  const boardActive = path === "/board";

  useEffect(() => {
    if (path === "/dashboard" || path === "/board") setDashSubOpen(true);
  }, [path]);

  useEffect(() => {
    if (path === "/clientes" || path === "/clientes/favoritos") setClientesSubOpen(true);
  }, [path]);

  return (
    <div
      className={cn(
        "flex w-full max-w-full overflow-x-hidden bg-background",
        /* Altura à viewport em todos os tamanhos: com aside fixed no mobile o flex não limitava a altura e o
           overflow-y-auto do painel principal não gerava scroll (scroll preso / toque sem efeito). */
        "min-h-0 h-[100dvh] max-h-[100dvh] overflow-hidden",
      )}
    >
      {user?.mustChangePassword ? <FirstAccessPasswordModal /> : null}
      {user && !user.mustChangePassword ? <SlackReportScheduler /> : null}
      {/* Overlay mobile: fecha a gaveta com fade; em lg+ não renderiza */}
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[90] animate-in fade-in-0 duration-200 bg-black/[0.06] lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      {/* Mobile: gaveta fixa; desktop: coluna lateral fixa (scroll só no painel principal) */}
      <aside
        className={cn(
          "flex h-[100dvh] max-h-[100dvh] shrink-0 flex-col border-r border-border/40 pt-[env(safe-area-inset-top,0px)]",
          /* Mobile: vidro — vê-se o dashboard por baixo; desktop: sólido */
          "max-lg:border-white/10 max-lg:bg-sidebar/35 max-lg:shadow-[0_0_40px_rgba(0,0,0,0.12)] max-lg:backdrop-blur-xl max-lg:backdrop-saturate-150",
          "lg:bg-sidebar lg:backdrop-blur-none lg:shadow-none",
          "transition-[width,transform] duration-300 ease-out",
          "max-lg:fixed max-lg:left-0 max-lg:z-[100] max-lg:w-[min(17.5rem,calc(100vw-1rem))] max-lg:pl-[env(safe-area-inset-left,0px)]",
          mobileNavOpen ? "max-lg:translate-x-0" : "max-lg:pointer-events-none max-lg:-translate-x-full",
          "lg:relative lg:z-10 lg:translate-x-0 lg:pointer-events-auto lg:h-full lg:min-h-0 lg:shrink-0",
          isLg ? (collapsed ? "w-20" : "w-64") : "w-64",
        )}
      >
        {/* Mesmo padding horizontal que o <nav> (p-3) para alinhar logo com os itens abaixo */}
        <div
          className={cn(
            "box-border flex min-h-[85px] shrink-0 border-b border-border/40 px-3 py-2.5",
            "items-center",
            compact ? "justify-center" : "justify-start",
          )}
        >
          {mounted && !compact ? (
            <button
              type="button"
              onClick={() => navigate(homePath)}
              className="flex w-full min-w-0 flex-1 cursor-pointer items-center justify-start rounded-md text-left transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
              aria-label="Ir para o início"
            >
              {brandingLogoSrc ? (
                <img
                  src={brandingLogoSrc}
                  alt={brandingName}
                  width={220}
                  height={65}
                  className="h-[65px] w-[220px] max-w-full shrink-0 object-contain object-left"
                  decoding="async"
                />
              ) : sidebarOrbix ? (
                <OrbixSidebarBrand />
              ) : sidebarNorterWordmark ? (
                <img
                  src={isLight ? norterLogoDashboardLight : norterLogoDashboardDark}
                  alt="Norter — Aceleradora"
                  width={220}
                  height={65}
                  className="h-[65px] w-[220px] max-w-full shrink-0 object-contain object-left"
                  decoding="async"
                />
              ) : (
                <div className="flex min-w-0 flex-col items-start gap-0.5 py-0.5">
                  <img
                    src={norterSymbol}
                    alt=""
                    width={44}
                    height={44}
                    className="h-10 w-10 shrink-0 object-contain"
                  />
                  <span className="truncate text-left text-xs font-semibold leading-tight text-sidebar-foreground">
                    {brandingName}
                  </span>
                </div>
              )}
            </button>
          ) : mounted && compact ? (
            <button
              type="button"
              onClick={() => navigate(homePath)}
              className="flex h-12 w-12 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
              aria-label="Ir para o início"
            >
              {brandingLogoSrc ? (
                <img
                  src={brandingLogoSrc}
                  alt=""
                  className="h-11 w-11 rounded-md object-contain"
                />
              ) : sidebarOrbix ? (
                <img
                  src={adHubMark}
                  alt="AD-HUB"
                  className="h-11 w-11 object-contain object-center"
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

        <nav className="min-h-0 flex-1 overflow-y-auto p-3 space-y-1">
          {showDashSection ? (
          <div className="space-y-0.5">
            <div className="w-full rounded-lg">
              <button
                type="button"
                aria-expanded={compact ? undefined : dashSubOpen}
                aria-controls="sidebar-dash-sub"
                onClick={(e) => {
                  const t = e.target as HTMLElement;
                  if (t.closest("[data-submenu-toggle]")) {
                    setDashSubOpen((o) => !o);
                  } else {
                    navigate(homePath);
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
                {!compact && (
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
            {dashSubOpen && !compact && canSee("board") && (
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
                aria-expanded={compact ? undefined : clientesSubOpen}
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
                {!compact && (
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
            {clientesSubOpen && !compact && canSee("clientes-favoritos") && (
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

          {isAdmin && isOrbixTeamMember(user) && (
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
              {!compact && <span>Organizações</span>}
            </button>
          )}

          {visibleRest.map((item) => {
            const active =
              path === item.path || path.startsWith(`${item.path}/`);
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
                <item.icon
                  size={18}
                  className={cn(
                    "flex-shrink-0",
                    item.module === "intelli-search" && "text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.35)]",
                  )}
                />
                {!compact &&
                  (item.module === "intelli-search" ? (
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2 overflow-hidden">
                      <span className="min-w-0 truncate font-medium">IntelliSearch</span>
                      <IntelliSearchNewBadge className="shrink-0 scale-[0.92]" />
                    </span>
                  ) : (
                    <span className="truncate">{item.label}</span>
                  ))}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto shrink-0 space-y-2 border-t border-border/40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
          {!compact && (
            <div className="flex flex-col items-center gap-2 px-2 py-2 text-center">
              <UserAvatarDisplay user={user} className="h-11 w-11 shrink-0" iconSize={22} />
              <div className="min-w-0 w-full">
                <span className="text-foreground font-medium block truncate text-sm leading-tight">{user?.name}</span>
                <span className="mt-1 block text-xs font-medium text-primary/90">
                  {user?.role === "admin" ? "Administrador" : "Gestor"}
                </span>
              </div>
            </div>
          )}
          {compact && user && (
            <div className="flex flex-col items-center pb-1">
              <span
                className="inline-flex"
                title={`${user.name} — ${user.role === "admin" ? "Administrador" : "Gestor"}`}
              >
                <UserAvatarDisplay user={user} className="h-9 w-9" iconSize={20} />
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut size={18} className="flex-shrink-0" />
            {!compact && <span>Sair</span>}
          </button>
          {isLg ? (
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="flex w-full items-center justify-center py-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          ) : null}
          {!isLg && mobileNavOpen ? (
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border/50 bg-sidebar-accent/30 py-3 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent lg:hidden"
              aria-label="Fechar menu"
            >
              <ChevronLeft className="h-5 w-5 shrink-0" strokeWidth={2} />
              <span>Voltar</span>
            </button>
          ) : null}
        </div>
      </aside>

      <AppLayoutMain
        className="isolate min-h-0 min-w-0 flex-1"
        onOpenMobileNav={() => setMobileNavOpen(true)}
        tightMainPaddingMobile={path.startsWith("/clientes") || path === "/dashboard"}
      >
        {children}
      </AppLayoutMain>
    </div>
  );
};

export default AppLayout;
