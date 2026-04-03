import { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Clientes from "@/pages/Clientes";
import ClientesFavoritos from "@/pages/ClientesFavoritos";
import Campanhas from "@/pages/Campanhas";
import IaRoi from "@/pages/IaRoi";
import Configuracoes from "@/pages/Configuracoes";
import Usuarios from "@/pages/Usuarios";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
};

const ProtectedRoutes = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clientes/favoritos" element={<ClientesFavoritos />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/campanhas" element={<Campanhas />} />
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
        <Route path="/perfil" element={<Navigate to="/configuracoes?tab=conta" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
};

const LoginRoute = () => {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return <Login />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="norter-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <FavoritesProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginRoute />} />
                <Route path="/*" element={<ProtectedRoutes />} />
              </Routes>
            </BrowserRouter>
          </FavoritesProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
