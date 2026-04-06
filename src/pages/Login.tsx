import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { getTenantBySlug } from "@/lib/tenantsStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, LogIn } from "lucide-react";
import norterLogo from "@/assets/norterlogo.png";

const Login = () => {
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();
  const { login } = useAuth();
  const { setActiveSlug } = useTenant();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  const tenantRecord = tenantSlug ? getTenantBySlug(tenantSlug) : undefined;
  const invalidTenant = Boolean(tenantSlug && !tenantRecord);

  useEffect(() => {
    if (!tenantSlug) {
      setActiveSlug(null);
      return;
    }
    const t = getTenantBySlug(tenantSlug);
    if (t) setActiveSlug(t.slug);
    else setActiveSlug(null);
  }, [tenantSlug, setActiveSlug]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (invalidTenant) {
      setError("Organização não encontrada.");
      return;
    }
    if (!login(username, password)) {
      setError("Credenciais inválidas");
      return;
    }
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full gradient-brand opacity-5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full gradient-brand opacity-5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm px-6 animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          {tenantRecord?.logoDataUrl ? (
            <img
              src={tenantRecord.logoDataUrl}
              alt={tenantRecord.displayName}
              className="h-24 w-auto max-w-[220px] object-contain mb-2"
            />
          ) : (
            <img src={norterLogo} alt="Norter" className="w-40 h-40 object-contain" />
          )}
          <span className="text-foreground/80 font-display text-sm font-semibold tracking-wide">
            {tenantRecord?.displayName ?? "Norter"}
          </span>
          {!tenantSlug && (
            <span className="text-foreground/20 font-display text-[10px] tracking-[0.3em] uppercase -mt-1">
              Aceleradora
            </span>
          )}
        </div>

        {invalidTenant && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Esta organização não existe ou foi removida.{" "}
            <Link to="/login" className="underline font-medium">
              Login principal
            </Link>
          </div>
        )}

        <form id="login-form" onSubmit={handleSubmit} className="glass-card rounded-xl p-8 space-y-5">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Usuário</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Digite seu usuário"
              autoComplete="username"
              className="bg-secondary/50 border-border/50 focus:border-primary"
              disabled={invalidTenant}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                (document.getElementById("login-form") as HTMLFormElement | null)?.requestSubmit();
              }}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Senha</label>
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                autoComplete="current-password"
                className="bg-secondary/50 border-border/50 focus:border-primary pr-10"
                disabled={invalidTenant}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  (document.getElementById("login-form") as HTMLFormElement | null)?.requestSubmit();
                }}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <p className="text-destructive text-sm text-center">{error}</p>}

          <Button
            type="submit"
            className="w-full gradient-brand text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
            disabled={invalidTenant}
          >
            <LogIn size={16} className="mr-2" />
            Entrar
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/landing" className="text-primary hover:underline">
            Conheça a plataforma
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
