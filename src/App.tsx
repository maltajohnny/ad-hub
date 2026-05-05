import { ReactNode, useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, Outlet } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { UserThemeProvider } from "@/components/UserThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { KanbanProvider } from "@/contexts/KanbanContext";
import AppLayout from "@/components/AppLayout";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Board from "@/pages/Board";
import Clientes from "@/pages/Clientes";
import ClientesFavoritos from "@/pages/ClientesFavoritos";
import InsightHubLayout from "@/pages/insight-hub/InsightHubLayout";
import InsightHubHome from "@/pages/insight-hub/InsightHubHome";
import InsightHubMarcas from "@/pages/insight-hub/InsightHubMarcas";
import InsightHubPlanos from "@/pages/insight-hub/InsightHubPlanos";
import InsightHubConexoes from "@/pages/insight-hub/InsightHubConexoes";
import InsightHubOverview from "@/pages/insight-hub/InsightHubOverview";
import InsightHubPosts from "@/pages/insight-hub/InsightHubPosts";
import InsightHubComparativo from "@/pages/insight-hub/InsightHubComparativo";
import InsightHubRelatorios from "@/pages/insight-hub/InsightHubRelatorios";
import InsightHubAgendamentos from "@/pages/insight-hub/InsightHubAgendamentos";
import Campanhas from "@/pages/Campanhas";
import GestaoMidias from "@/pages/GestaoMidias";
import IaRoi from "@/pages/IaRoi";
import MeuPlano from "@/pages/MeuPlano";
import Configuracoes from "@/pages/Configuracoes";
import Usuarios from "@/pages/Usuarios";
import NotFound from "./pages/NotFound";
import OAuthPopupCallback from "@/pages/OAuthPopupCallback";
import Landing from "@/pages/Landing";
import Planos from "@/pages/Planos";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import DataDeletion from "@/pages/DataDeletion";
import Organizacoes from "@/pages/Organizacoes";
import IntelliSearchLayout from "@/pages/IntelliSearch";
import IntelliSearchCompleteAnalysis from "@/pages/intelli-search/IntelliSearchCompleteAnalysis";
import {
  IntelliSearchManualPage,
  IntelliSearchPreAnalysisPage,
  IntelliSearchReviewsPage,
  IntelliSearchPostsPage,
  IntelliSearchCategoriesPage,
  IntelliSearchProfileInsightsPage,
  IntelliSearchKeywordsPage,
  IntelliSearchLeadFinderPage,
  IntelliSearchManagerReviewsPage,
  IntelliSearchManagerQAPage,
  IntelliSearchManagerPostsPage,
} from "@/pages/intelli-search/serpPages";
import IntelliSearchRankingPage from "@/pages/intelli-search/IntelliSearchRankingPage";
import IntelliSearchHistoryPage from "@/pages/intelli-search/IntelliSearchHistoryPage";
import IntelliSearchEvolutionPage from "@/pages/intelli-search/IntelliSearchEvolutionPage";
import IntelliSearchPerformanceReport from "@/pages/intelli-search/IntelliSearchPerformanceReport";
import { TenantProvider, useTenant } from "@/contexts/TenantContext";
import { DocumentBrandingSync } from "@/components/DocumentBrandingSync";
import SocialPulse from "@/pages/SocialPulse";
import { userCanAccessSocialPulse } from "@/lib/socialPulseAccess";
import { defaultPathAfterLogin, effectiveModulesForUser, isPlatformOperator, type AppModule } from "@/lib/saasTypes";
import { getTenantById } from "@/lib/tenantsStore";
import { isOrbixTeamMember } from "@/lib/orbixAccess";

const queryClient = new QueryClient();

/** Admin + módulo na matriz efetiva (ex.: plano Gestor sem lugares de equipa não vê Usuários). */
const AdminModuleRoute = ({ module, children }: { module: AppModule; children: ReactNode }) => {
  const { user, orgBilling } = useAuth();
  const { tenant } = useTenant();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin")
    return <Navigate to={defaultPathAfterLogin(user, tenant?.enabledModules, orgBilling)} replace />;
  const eff = effectiveModulesForUser(user, tenant?.enabledModules, orgBilling);
  if (eff !== "all" && !eff.includes(module)) {
    return <Navigate to={defaultPathAfterLogin(user, tenant?.enabledModules, orgBilling)} replace />;
  }
  return <>{children}</>;
};

/** Módulo Social Pulse — respeita `enabledModules` da org e permissões por utilizador. */
const SocialPulseRoute = ({ children }: { children: ReactNode }) => {
  const { user, orgBilling } = useAuth();
  const { tenant } = useTenant();
  if (!user) return <Navigate to="/login" replace />;
  if (!userCanAccessSocialPulse(user, tenant?.enabledModules, orgBilling)) {
    return <Navigate to={defaultPathAfterLogin(user, tenant?.enabledModules, orgBilling)} replace />;
  }
  return <>{children}</>;
};

/** Organizações: operadores da plataforma ou conta da org AD-Hub (equipa principal). */
const OrbixTeamAdminRoute = ({ children }: { children: ReactNode }) => {
  const { user, orgBilling } = useAuth();
  const { tenant } = useTenant();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin")
    return <Navigate to={defaultPathAfterLogin(user, tenant?.enabledModules, orgBilling)} replace />;
  if (!isOrbixTeamMember(user))
    return <Navigate to={defaultPathAfterLogin(user, tenant?.enabledModules, orgBilling)} replace />;
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
  const { user, orgBilling } = useAuth();
  const { tenant } = useTenant();
  if (user) return <Navigate to={defaultPathAfterLogin(user, tenant?.enabledModules, orgBilling)} replace />;
  return <Navigate to="/" replace state={{ openLogin: true }} />;
};

const ForgotPasswordRoute = () => {
  const { user, orgBilling } = useAuth();
  const { tenant } = useTenant();
  if (user) return <Navigate to={defaultPathAfterLogin(user, tenant?.enabledModules, orgBilling)} replace />;
  return <ForgotPassword />;
};

const ResetPasswordRoute = () => {
  const { user, orgBilling } = useAuth();
  const { tenant } = useTenant();
  if (user) return <Navigate to={defaultPathAfterLogin(user, tenant?.enabledModules, orgBilling)} replace />;
  return <ResetPassword />;
};

/** Página inicial pública; utilizadores autenticados vão direto ao painel. */
const LandingRoute = () => {
  const { user, orgBilling } = useAuth();
  const { tenant } = useTenant();
  if (user) return <Navigate to={defaultPathAfterLogin(user, tenant?.enabledModules, orgBilling)} replace />;
  return <Landing />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <UserThemeProvider>
          <FavoritesProvider>
            <KanbanProvider>
              <BrowserRouter>
                <TenantProvider>
                  <DocumentBrandingSync />
                  <Routes>
                    <Route path="/" element={<LandingRoute />} />
                    <Route path="/landing" element={<Navigate to="/" replace />} />
                    <Route path="/login" element={<LoginRoute />} />
                    <Route path="/t/:tenantSlug/login" element={<LoginRoute />} />
                    <Route path="/forgot-password" element={<ForgotPasswordRoute />} />
                    <Route path="/reset-password" element={<ResetPasswordRoute />} />
                    <Route path="/oauth/popup-callback" element={<OAuthPopupCallback />} />
                    <Route path="/planos" element={<Planos />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/data-deletion" element={<DataDeletion />} />
                    <Route path="/politica-de-privacidade" element={<Navigate to="/privacy-policy" replace />} />

                    <Route element={<ProtectedLayout />}>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/board" element={<Board />} />
                      <Route path="/clientes/insight-hub" element={<InsightHubLayout />}>
                        <Route index element={<InsightHubHome />} />
                        <Route path="marcas" element={<InsightHubMarcas />} />
                        <Route path="conexoes" element={<InsightHubConexoes />} />
                        <Route path="overview" element={<InsightHubOverview />} />
                        <Route path="posts" element={<InsightHubPosts />} />
                        <Route path="comparativo" element={<InsightHubComparativo />} />
                        <Route path="relatorios" element={<InsightHubRelatorios />} />
                        <Route path="agendamentos" element={<InsightHubAgendamentos />} />
                        <Route path="planos" element={<InsightHubPlanos />} />
                      </Route>
                      <Route path="/clientes/favoritos" element={<ClientesFavoritos />} />
                      <Route path="/clientes" element={<Clientes />} />
                      <Route path="/campanhas" element={<Campanhas />} />
                      <Route path="/gestao-midias" element={<GestaoMidias />} />
                      <Route path="/intelli-search" element={<IntelliSearchLayout />}>
                        <Route index element={<Navigate to="health/complete" replace />} />
                        <Route path="health/complete" element={<IntelliSearchCompleteAnalysis />} />
                        <Route path="health/manual" element={<IntelliSearchManualPage />} />
                        <Route path="extension" element={<Navigate to="/intelli-search/pre-analysis" replace />} />
                        <Route path="pre-analysis" element={<IntelliSearchPreAnalysisPage />} />
                        <Route path="reviews-analysis" element={<IntelliSearchReviewsPage />} />
                        <Route path="posts-analysis" element={<IntelliSearchPostsPage />} />
                        <Route path="categories-analysis" element={<IntelliSearchCategoriesPage />} />
                        <Route path="ranking/analysis" element={<IntelliSearchRankingPage />} />
                        <Route path="ranking/history" element={<IntelliSearchHistoryPage />} />
                        <Route path="prospecting/lead-finder" element={<IntelliSearchLeadFinderPage />} />
                        <Route path="metrics/profile-insights" element={<IntelliSearchProfileInsightsPage />} />
                        <Route path="metrics/keywords" element={<IntelliSearchKeywordsPage />} />
                        <Route path="metrics/evolution" element={<IntelliSearchEvolutionPage />} />
                        <Route path="manager/reviews" element={<IntelliSearchManagerReviewsPage />} />
                        <Route path="manager/qa" element={<IntelliSearchManagerQAPage />} />
                        <Route path="manager/posts" element={<IntelliSearchManagerPostsPage />} />
                        <Route path="tools/performance-report" element={<IntelliSearchPerformanceReport />} />
                      </Route>
                      <Route path="/saude-google" element={<Navigate to="/intelli-search/health/complete" replace />} />
                      <Route path="/ia-roi" element={<IaRoi />} />
                      <Route
                        path="/social-pulse"
                        element={
                          <SocialPulseRoute>
                            <SocialPulse />
                          </SocialPulseRoute>
                        }
                      />
                      <Route path="/configuracoes" element={<Configuracoes />} />
                      <Route
                        path="/meu-plano"
                        element={
                          <AdminModuleRoute module="meu-plano">
                            <MeuPlano />
                          </AdminModuleRoute>
                        }
                      />
                      <Route
                        path="/usuarios"
                        element={
                          <AdminModuleRoute module="usuarios">
                            <Usuarios />
                          </AdminModuleRoute>
                        }
                      />
                      <Route
                        path="/usuarios/modulos"
                        element={
                          <AdminModuleRoute module="usuarios">
                            <Usuarios />
                          </AdminModuleRoute>
                        }
                      />
                      <Route
                        path="/organizacoes"
                        element={
                          <OrbixTeamAdminRoute>
                            <Organizacoes />
                          </OrbixTeamAdminRoute>
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
        </UserThemeProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
