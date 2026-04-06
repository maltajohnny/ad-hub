import { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, Outlet } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { KanbanProvider } from "@/contexts/KanbanContext";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Board from "@/pages/Board";
import Clientes from "@/pages/Clientes";
import ClientesFavoritos from "@/pages/ClientesFavoritos";
import Campanhas from "@/pages/Campanhas";
import IaRoi from "@/pages/IaRoi";
import Configuracoes from "@/pages/Configuracoes";
import Usuarios from "@/pages/Usuarios";
import NotFound from "./pages/NotFound";
import Landing from "@/pages/Landing";
import Organizacoes from "@/pages/Organizacoes";
import IntelliSearch from "@/pages/IntelliSearch";
import { TenantProvider, useTenant } from "@/contexts/TenantContext";
import { defaultPathAfterLogin } from "@/lib/saasTypes";

const queryClient = new QueryClient();

const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin")
    return <Navigate to={defaultPathAfterLogin(user, tenant?.enabledModules)} replace />;
  return <>{children}</>;
};

/** Layout único para área autenticada — evita `<Routes>` aninhados sob `/*` (ecrã em branco no RR v6). */
const ProtectedLayout = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
};

const LoginRoute = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  if (user) return <Navigate to={defaultPathAfterLogin(user, tenant?.enabledModules)} replace />;
  return <Login />;
};

/** Página inicial pública; utilizadores autenticados vão direto ao painel. */
const LandingRoute = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  if (user) return <Navigate to={defaultPathAfterLogin(user, tenant?.enabledModules)} replace />;
  return <Landing />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="norter-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <FavoritesProvider>
            <KanbanProvider>
              <BrowserRouter>
                <TenantProvider>
                  <Routes>
                    <Route path="/" element={<LandingRoute />} />
                    <Route path="/landing" element={<Navigate to="/" replace />} />
                    <Route path="/login" element={<LoginRoute />} />
                    <Route path="/t/:tenantSlug/login" element={<LoginRoute />} />

                    <Route element={<ProtectedLayout />}>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/board" element={<Board />} />
                      <Route path="/clientes/favoritos" element={<ClientesFavoritos />} />
                      <Route path="/clientes" element={<Clientes />} />
                      <Route path="/campanhas" element={<Campanhas />} />
                      <Route path="/intelli-search" element={<IntelliSearch />} />
                      <Route path="/saude-google" element={<Navigate to="/intelli-search" replace />} />
                      <Route path="/ia-roi" element={<IaRoi />} />
                      <Route path="/configuracoes" element={<Configuracoes />} />
                      <Route
                        path="/usuarios"
                        element={
                          <AdminRoute>
                            <Usuarios />
                          </AdminRoute>
                        }
                      />
                      <Route
                        path="/organizacoes"
                        element={
                          <AdminRoute>
                            <Organizacoes />
                          </AdminRoute>
                        }
                      />
                      <Route path="/perfil" element={<Navigate to="/configuracoes?tab=conta" replace />} />
                      <Route path="*" element={<NotFound />} />
                    </Route>
                  </Routes>
                </TenantProvider>
              </BrowserRouter>
            </KanbanProvider>
          </FavoritesProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
