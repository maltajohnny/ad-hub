import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { getTenantById, getTenantBySlug } from "@/lib/tenantsStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Lock, User } from "lucide-react";
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
  const canSubmitLogin =
    !invalidTenant && username.trim().length > 0 && password.trim().length > 0;

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
                  decoding="async"
                  fetchPriority="high"
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
          noValidate
          onSubmit={handleSubmit}
          className="glass-card flex flex-col gap-4 rounded-2xl p-5 sm:p-6"
        >
          <div className="flex flex-col gap-2">
            <div className="relative">
              <User
                className="pointer-events-none absolute left-3.5 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="login-username"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Utilizador ou e-mail"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={invalidTenant}
                className="h-11 rounded-full border-border/50 bg-background/90 pl-10 shadow-sm focus-visible:ring-offset-0 md:text-sm"
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  (document.getElementById("login-form") as HTMLFormElement | null)?.requestSubmit();
                }}
              />
            </div>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3.5 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="login-password"
                name="password"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha"
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={invalidTenant}
                className="h-11 rounded-full border-border/50 bg-background/90 pl-10 pr-11 shadow-sm focus-visible:ring-offset-0 md:text-sm"
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  (document.getElementById("login-form") as HTMLFormElement | null)?.requestSubmit();
                }}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 z-[1] -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <p className="text-destructive text-center text-sm">{error}</p>}

          <Button
            type="submit"
            className="h-11 w-full rounded-full bg-foreground text-base font-semibold text-background shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            disabled={!canSubmitLogin}
          >
            Entrar
          </Button>

          <p className="text-center">
            <Link
              to="/forgot-password"
              className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
            >
              Esqueceu sua senha?
            </Link>
          </p>
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
