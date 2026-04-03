import { ReactNode, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
} from "lucide-react";
import norterLogo from "@/assets/norterlogo.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserAvatarDisplay } from "@/components/UserAvatarDisplay";
import { UserMenuDropdown } from "@/components/UserMenuDropdown";

type MenuItem = { icon: typeof LayoutDashboard; label: string; path: string; adminOnly?: boolean };

const menuAfterClientes: MenuItem[] = [
  { icon: BarChart3, label: "Campanhas", path: "/campanhas" },
  { icon: TrendingUp, label: "IA & ROI", path: "/ia-roi" },
  { icon: UsersRound, label: "Usuários", path: "/usuarios", adminOnly: true },
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
];

const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const isAdmin = user?.role === "admin";
  const visibleRest = menuAfterClientes.filter((item) => !item.adminOnly || isAdmin);

  const path = location.pathname;
  const clientesListActive = path === "/clientes";
  const favoritosActive = path === "/clientes/favoritos";

  return (
    <div className="min-h-screen flex bg-background">
      <aside
        className={`${collapsed ? "w-20" : "w-64"} transition-all duration-300 bg-sidebar border-r border-sidebar-border flex flex-col`}
      >
        <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
          <img src={norterLogo} alt="Norter" className="w-10 h-10 object-contain flex-shrink-0" />
          {!collapsed && (
            <div className="animate-fade-in">
              <h1 className="font-display font-bold text-foreground text-sm leading-tight">NORTER</h1>
              <span className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase">Aceleradora</span>
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <button
            onClick={() => navigate("/")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              path === "/"
                ? "gradient-brand text-primary-foreground font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          >
            <LayoutDashboard size={18} className="flex-shrink-0" />
            {!collapsed && <span>Dashboard</span>}
          </button>

          <button
            onClick={() => navigate("/clientes")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              clientesListActive
                ? "gradient-brand text-primary-foreground font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          >
            <Users size={18} className="flex-shrink-0" />
            {!collapsed && <span>Clientes</span>}
          </button>

          {!collapsed ? (
            <button
              onClick={() => navigate("/clientes/favoritos")}
              className={`w-full flex items-center gap-3 pl-8 pr-3 py-2 rounded-lg text-xs transition-all ${
                favoritosActive
                  ? "bg-sidebar-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
              }`}
            >
              <Star size={15} className="flex-shrink-0 opacity-90" />
              <span>Favoritos</span>
            </button>
          ) : (
            <button
              onClick={() => navigate("/clientes/favoritos")}
              title="Favoritos"
              className={`w-full flex items-center justify-center py-2 rounded-lg transition-all ${
                favoritosActive ? "bg-sidebar-accent text-primary" : "text-muted-foreground hover:bg-sidebar-accent"
              }`}
            >
              <Star size={18} />
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

        <div className="p-3 border-t border-sidebar-border space-y-2">
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
            onClick={logout}
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

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-6 lg:px-8 pt-6 pb-2 border-b border-border/40 bg-background/80 backdrop-blur-sm shrink-0">
          <UserMenuDropdown />
          <ThemeToggle />
        </div>
        <div className="flex-1 overflow-auto">
          <div className="p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
