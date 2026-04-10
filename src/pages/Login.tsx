import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { getTenantById, getTenantBySlug } from "@/lib/tenantsStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, LogIn } from "lucide-react";
import adHubFallback from "@/assets/ad-hub-logo.png";
import {
  extractOrgSlugFromUsername,
  normalizeUsernameForLoginAttempt,
  resolveLoginScreenBrand,
} from "@/lib/loginBranding";
import { OrbixMarkLogo } from "@/components/OrbixMarkLogo";
import { NorterMarkLogo } from "@/components/NorterMarkLogo";
import { defaultPathAfterLogin } from "@/lib/saasTypes";
import { applyDocumentBranding, resolveTenantForLoginBranding } from "@/lib/documentBranding";

const Login = () => {
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();
  const location = useLocation();
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

  useEffect(() => {
    if (invalidTenant) {
      applyDocumentBranding(null);
      return;
    }
    const t = resolveTenantForLoginBranding({
      pathname: location.pathname,
      tenantSlugFromRoute: tenantSlug,
      username,
    });
    applyDocumentBranding(t);
  }, [invalidTenant, location.pathname, tenantSlug, username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (invalidTenant) {
      setError("Organização não encontrada.");
      return;
    }
    const userKey = normalizeUsernameForLoginAttempt(username);
    const { user: logged, accountDisabled } = await login(userKey, password.trim());
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

  const showLogoSrc = brand.logo ?? adHubFallback;

  return (
    <div className="relative flex min-h-screen min-h-[100dvh] w-full max-w-[100vw] flex-col items-center justify-center overflow-x-hidden overflow-y-auto bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 max-w-[80vw] rounded-full gradient-brand opacity-5 blur-3xl aspect-square" />
        <div className="absolute bottom-1/4 right-1/4 w-80 max-w-[70vw] rounded-full gradient-brand opacity-5 blur-3xl aspect-square" />
      </div>

      <div
        className="relative z-10 w-full max-w-sm animate-fade-in px-[max(1.25rem,env(safe-area-inset-left,0px))] py-8 pr-[max(1.25rem,env(safe-area-inset-right,0px))] pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]"
      >
        <div
          key={brand.key}
          className="mb-8 animate-in fade-in zoom-in-95 duration-500 fill-mode-both"
        >
          {brand.key === "orbix" ? (
            <OrbixMarkLogo />
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
          className="glass-card space-y-5 rounded-xl p-6 sm:p-8"
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
              autoComplete="username"
              autoCapitalize="none"
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
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
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
            className="min-h-12 w-full gradient-brand text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            disabled={invalidTenant}
          >
            <LogIn size={16} className="mr-2" />
            Entrar
          </Button>

        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="text-primary hover:underline">
            Conheça a plataforma AD-HUB
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
