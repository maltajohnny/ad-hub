import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { getTenantById, getTenantBySlug } from "@/lib/tenantsStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, LogIn } from "lucide-react";
import qtrafficFallback from "@/assets/qtraffic-mark-only.png";
import {
  extractOrgSlugFromUsername,
  normalizeUsernameForLoginAttempt,
  resolveLoginScreenBrand,
} from "@/lib/loginBranding";
import { QtrafficMarkLogo } from "@/components/QtrafficMarkLogo";
import { NorterMarkLogo } from "@/components/NorterMarkLogo";
import { defaultPathAfterLogin } from "@/lib/saasTypes";

const Login = () => {
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();
  const { login } = useAuth();
  const { setActiveSlug, tenant } = useTenant();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const tenantRecord = tenantSlug ? getTenantBySlug(tenantSlug) : undefined;
  const invalidTenant = Boolean(tenantSlug && !tenantRecord);

  const brand = useMemo(
    () =>
      resolveLoginScreenBrand({
        tenantSlug,
        tenantRecord,
        invalidTenant,
        username,
      }),
    [tenantSlug, tenantRecord, invalidTenant, username],
  );

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
    const userKey = normalizeUsernameForLoginAttempt(username);
    const { user: logged, accountDisabled } = login(userKey, password);
    if (accountDisabled) {
      setError("Esta conta foi desativada. Peça a um administrador para reativá-la.");
      return;
    }
    if (!logged) {
      setError("Credenciais inválidas");
      return;
    }
    const orgSlug = extractOrgSlugFromUsername(username);
    if (orgSlug) {
      setActiveSlug(orgSlug);
    } else if (logged.organizationId) {
      const t = getTenantById(logged.organizationId);
      if (t) setActiveSlug(t.slug);
    }
    const tenantForModules = orgSlug
      ? getTenantBySlug(orgSlug)
      : logged.organizationId
        ? getTenantById(logged.organizationId)
        : tenant;
    navigate(defaultPathAfterLogin(logged, tenantForModules?.enabledModules), { replace: true });
  };

  const showLogoSrc = brand.logo ?? qtrafficFallback;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full gradient-brand opacity-5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full gradient-brand opacity-5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm px-6 animate-fade-in">
        <div
          key={brand.key}
          className="mb-8 animate-in fade-in zoom-in-95 duration-500 fill-mode-both"
        >
          {brand.key === "qtraffic" ? (
            <QtrafficMarkLogo />
          ) : brand.key === "norter" || brand.key === "tenant-norter" ? (
            <NorterMarkLogo />
          ) : (
            <div className="flex flex-col items-center text-center">
              <div className="mx-auto flex w-[min(92vw,260px)] justify-center">
                <img
                  src={showLogoSrc}
                  alt={brand.alt}
                  width={240}
                  height={120}
                  className="h-auto w-full max-h-[200px] object-contain mb-1 drop-shadow-lg sm:max-h-[220px]"
                />
              </div>
              <span className="text-foreground/90 font-display text-base font-semibold tracking-wide mt-4">
                {brand.name}
              </span>
              {brand.tagline ? (
                <span className="font-display text-[11px] sm:text-xs tracking-[0.18em] uppercase mt-1.5 text-muted-foreground/85">
                  {brand.tagline}
                </span>
              ) : tenantSlug && tenantRecord ? (
                <span className="text-foreground/35 font-display text-[10px] tracking-[0.25em] uppercase mt-1">
                  Organização
                </span>
              ) : null}
            </div>
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

        <form
          id="login-form"
          method="post"
          action="#"
          autoComplete="off"
          onSubmit={handleSubmit}
          className="glass-card rounded-xl p-8 space-y-5"
        >
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground" htmlFor="login-username">
              Usuário
            </label>
            <Input
              id="login-username"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Utilizador ou utilizador.organização"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
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
            <label className="text-sm text-muted-foreground" htmlFor="login-password">
              Senha
            </label>
            <div className="relative">
              <Input
                id="login-password"
                name="password"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                autoComplete="off"
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
          <Link to="/" className="text-primary hover:underline">
            Conheça a plataforma QTRAFFIC
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
