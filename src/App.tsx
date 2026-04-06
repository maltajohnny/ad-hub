import { ReactNode, useEffect, useRef } from "react";
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
import IntelliSearchLayout from "@/pages/IntelliSearch";
import IntelliSearchCompleteAnalysis from "@/pages/intelli-search/IntelliSearchCompleteAnalysis";
import IntelliSearchPlaceholder from "@/pages/intelli-search/IntelliSearchPlaceholder";
import { TenantProvider, useTenant } from "@/contexts/TenantContext";
import { defaultPathAfterLogin, isPlatformOperator } from "@/lib/saasTypes";
import { getTenantById } from "@/lib/tenantsStore";
import { isQtrafficTeamMember } from "@/lib/qtrafficAccess";

const queryClient = new QueryClient();

const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin")
    return <Navigate to={defaultPathAfterLogin(user, tenant?.enabledModules)} replace />;
  return <>{children}</>;
};

/** Módulo Organizações: só operadores da plataforma ou conta vinculada à org Qtraffic (equipa principal). */
const QtrafficTeamAdminRoute = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin")
    return <Navigate to={defaultPathAfterLogin(user, tenant?.enabledModules)} replace />;
  if (!isQtrafficTeamMember(user))
    return <Navigate to={defaultPathAfterLogin(user, tenant?.enabledModules)} replace />;
  return <>{children}</>;
};

/** Alinha o contexto de organização (sidebar, módulos, branding) ao vínculo `user.organizationId`. */
const TenantOrganizationSync = () => {
  const { user } = useAuth();
  const { setActiveSlug } = useTenant();
  const prevOrgId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!user) {
      prevOrgId.current = undefined;
      return;
    }
    const cur = user.organizationId;
    if (cur) {
      const t = getTenantById(cur);
      if (t) setActiveSlug(t.slug);
    } else if (prevOrgId.current && !cur && !isPlatformOperator(user.username)) {
      setActiveSlug(null);
    }
    prevOrgId.current = cur;
  }, [user, setActiveSlug]);

  return null;
};

/** Layout único para área autenticada — evita `<Routes>` aninhados sob `/*` (ecrã em branco no RR v6). */
const ProtectedLayout = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <AppLayout>
      <TenantOrganizationSync />
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
                      <Route path="/intelli-search" element={<IntelliSearchLayout />}>
                        <Route index element={<Navigate to="health/complete" replace />} />
                        <Route path="health/complete" element={<IntelliSearchCompleteAnalysis />} />
                        <Route
                          path="health/manual"
                          element={
                            <IntelliSearchPlaceholder
                              title="Manual Analysis"
                              description="Auditoria manual de campos do perfil."
                            />
                          }
                        />
                        <Route path="extension" element={<Navigate to="/intelli-search/pre-analysis" replace />} />
                        <Route
                          path="pre-analysis"
                          element={<IntelliSearchPlaceholder title="Pre Analysis" description="Pré-análise antes da auditoria completa." />}
                        />
                        <Route
                          path="reviews-analysis"
                          element={<IntelliSearchPlaceholder title="Reviews Analysis" description="Avaliações e respostas." />}
                        />
                        <Route
                          path="posts-analysis"
                          element={<IntelliSearchPlaceholder title="Posts Analysis" description="Posts no perfil do Google." />}
                        />
                        <Route
                          path="categories-analysis"
                          element={<IntelliSearchPlaceholder title="Categories Analysis" description="Categorias do negócio." />}
                        />
                        <Route
                          path="ranking/analysis"
                          element={<IntelliSearchPlaceholder title="Ranking Analysis" description="Ranking local e mapa." />}
                        />
                        <Route
                          path="ranking/history"
                          element={<IntelliSearchPlaceholder title="Analysis History" description="Histórico de análises." />}
                        />
                        <Route
                          path="prospecting/lead-finder"
                          element={<IntelliSearchPlaceholder title="Lead Finder" description="Prospecção por local e palavra-chave." />}
                        />
                        <Route
                          path="metrics/profile-insights"
                          element={<IntelliSearchPlaceholder title="Profile Insights" description="Métricas do perfil." />}
                        />
                        <Route
                          path="metrics/keywords"
                          element={<IntelliSearchPlaceholder title="Keywords" description="Palavras-chave locais." />}
                        />
                        <Route
                          path="metrics/evolution"
                          element={<IntelliSearchPlaceholder title="Analysis Evolution" description="Evolução das auditorias." />}
                        />
                        <Route
                          path="manager/reviews"
                          element={<IntelliSearchPlaceholder title="Reviews Manager" description="Gestão de avaliações." />}
                        />
                        <Route
                          path="manager/qa"
                          element={<IntelliSearchPlaceholder title="Q&A Manager" description="Perguntas e respostas." />}
                        />
                        <Route
                          path="manager/posts"
                          element={<IntelliSearchPlaceholder title="Posts Manager" description="Gestão de posts." />}
                        />
                        <Route
                          path="tools/performance-report"
                          element={<IntelliSearchPlaceholder title="Performance Report" description="Relatório de desempenho." />}
                        />
                      </Route>
                      <Route path="/saude-google" element={<Navigate to="/intelli-search/health/complete" replace />} />
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
                          <QtrafficTeamAdminRoute>
                            <Organizacoes />
                          </QtrafficTeamAdminRoute>
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
