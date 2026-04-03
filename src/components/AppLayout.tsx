import { ReactNode, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, UserCircle, LogOut, ChevronLeft, ChevronRight, TrendingUp,
  Settings, BarChart3
} from "lucide-react";
import norterLogo from "@/assets/norterlogo.png";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Users, label: "Clientes", path: "/clientes" },
  { icon: BarChart3, label: "Campanhas", path: "/campanhas" },
  { icon: TrendingUp, label: "IA & ROI", path: "/ia-roi" },
  { icon: UserCircle, label: "Perfil", path: "/perfil" },
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
];

const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
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

        <nav className="flex-1 p-3 space-y-1">
          {menuItems.map((item) => {
            const active = location.pathname === item.path;
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
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Logado como <span className="text-foreground font-medium">{user?.name}</span>
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

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
};

export default AppLayout;
