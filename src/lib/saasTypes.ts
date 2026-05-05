/** Módulos navegáveis — filtrados por org + utilizador; operadores da plataforma têm lista dedicada. */
export const APP_MODULES = [
  "dashboard",
  "board",
  "clientes",
  "clientes-favoritos",
  "insight-hub",
  "meu-plano",
  "campanhas",
  "gestao-midias",
  "intelli-search",
  "ia-roi",
  "social-pulse",
  "usuarios",
  "configuracoes",
] as const;

export type AppModule = (typeof APP_MODULES)[number];

export const APP_MODULE_LABELS: Record<AppModule, string> = {
  dashboard: "Dashboard",
  board: "Board",
  clientes: "Clientes",
  "clientes-favoritos": "Clientes · Favoritos",
  "insight-hub": "Insight Hub",
  "meu-plano": "Meu Plano",
  campanhas: "Campanhas",
  "gestao-midias": "Gestão de Mídias",
  "intelli-search": "IntelliSearch",
  "ia-roi": "IA & ROI",
  "social-pulse": "Social Pulse",
  usuarios: "Usuários",
  configuracoes: "Configurações",
};

/** Contas internas AD-Hub (não veem módulos de entrega para clientes). */
export const PLATFORM_OPERATOR_USERNAMES = new Set(["admin", "qtrafficadmin"]);

export function isPlatformOperator(username: string | undefined | null): boolean {
  if (!username) return false;
  return PLATFORM_OPERATOR_USERNAMES.has(username.trim().toLowerCase());
}

/** Módulos visíveis para admin / operador AD-Hub — serviços da plataforma (IntelliSearch é por organização). */
export const PLATFORM_OPERATOR_MODULES: AppModule[] = ["dashboard", "usuarios", "configuracoes"];

/** Slugs reservados — não podem ser usados por organizações cliente. */
export const RESERVED_TENANT_SLUGS = new Set([
  "norter",
  "qtraffic",
  "admin",
  "www",
  "api",
  "app",
  "landing",
  "login",
  "t",
]);

/** Estado de subscrição vindo da API Go (GET /api/ad-hub/auth/organization/subscription). */
export type OrgBillingInfo = {
  planSlug: string | null;
  subscriptionStatus: string;
  gestorTeamSeats: number;
};

/** Intersecção org + utilizador; admin de organização respeita módulos da org; operador de plataforma vê só serviços AD-Hub. */
export function effectiveModulesForUser(
  user: { role: string; username: string; allowedModules?: AppModule[] | null } | null,
  tenantEnabled: AppModule[] | undefined,
  /** `undefined` = ainda não carregado — não aplica gate do plano Gestor (modo local / loading). */
  orgBilling?: OrgBillingInfo | null,
): AppModule[] | "all" {
  if (!user) return [];
  if (isPlatformOperator(user.username)) {
    return [...PLATFORM_OPERATOR_MODULES];
  }

  const orgSet = tenantEnabled?.length ? new Set(tenantEnabled) : null;

  const applyGestorUsuariosGate = (mods: AppModule[]): AppModule[] => {
    const b = orgBilling;
    if (b == null) return mods;
    const active = b.subscriptionStatus === "active" || b.subscriptionStatus === "pending";
    if (active && b.planSlug === "gestor" && (b.gestorTeamSeats ?? 0) === 0) {
      return mods.filter((m) => m !== "usuarios");
    }
    return mods;
  };

  if (user.role === "admin") {
    if (!orgSet) {
      const gated = applyGestorUsuariosGate([...APP_MODULES]);
      return gated.length === APP_MODULES.length ? "all" : gated;
    }
    return applyGestorUsuariosGate(APP_MODULES.filter((m) => orgSet.has(m)));
  }

  const all = [...APP_MODULES];
  const userSet = user.allowedModules?.length ? new Set(user.allowedModules) : null;
  if (!orgSet && !userSet) {
    const gated = applyGestorUsuariosGate(all);
    return gated.length === APP_MODULES.length ? "all" : gated;
  }
  const merged = all.filter((m) => (orgSet ? orgSet.has(m) : true) && (userSet ? userSet.has(m) : true));
  return applyGestorUsuariosGate(merged);
}

/** Limite de contas na organização conforme plano pago (null = sem limite aplicado). */
export function maxOrgMembersForBilling(billing: OrgBillingInfo | null | undefined): number | null {
  if (billing == null) return null;
  const st = billing.subscriptionStatus;
  const active = st === "active" || st === "pending";
  if (!active) return null;
  switch (billing.planSlug) {
    case "gestor":
      return 1 + Math.min(3, Math.max(0, billing.gestorTeamSeats ?? 0));
    case "organizacao":
      return 5;
    case "scale":
      return 15;
    default:
      return null;
  }
}

export function pathToModule(pathname: string): AppModule | null {
  if (pathname === "/dashboard" || pathname === "/" || pathname === "") return "dashboard";
  if (pathname === "/board") return "board";
  if (pathname === "/clientes") return "clientes";
  if (pathname === "/clientes/favoritos") return "clientes-favoritos";
  if (pathname === "/clientes/insight-hub" || pathname.startsWith("/clientes/insight-hub/")) return "insight-hub";
  if (pathname === "/meu-plano" || pathname.startsWith("/meu-plano/")) return "meu-plano";
  if (pathname === "/campanhas") return "campanhas";
  if (pathname === "/gestao-midias") return "gestao-midias";
  if (pathname === "/intelli-search" || pathname.startsWith("/intelli-search/")) return "intelli-search";
  if (pathname === "/ia-roi") return "ia-roi";
  if (pathname === "/social-pulse" || pathname.startsWith("/social-pulse/")) return "social-pulse";
  if (pathname === "/usuarios") return "usuarios";
  if (pathname.startsWith("/configuracoes")) return "configuracoes";
  return null;
}

export function moduleToDefaultPath(m: AppModule): string {
  switch (m) {
    case "dashboard":
      return "/dashboard";
    case "board":
      return "/board";
    case "clientes":
      return "/clientes";
    case "clientes-favoritos":
      return "/clientes/favoritos";
    case "insight-hub":
      return "/clientes/insight-hub";
    case "meu-plano":
      return "/meu-plano";
    case "campanhas":
      return "/campanhas";
    case "gestao-midias":
      return "/gestao-midias";
    case "intelli-search":
      return "/intelli-search/health/complete";
    case "ia-roi":
      return "/ia-roi";
    case "social-pulse":
      return "/social-pulse";
    case "usuarios":
      return "/usuarios";
    case "configuracoes":
      return "/configuracoes";
    default:
      return "/dashboard";
  }
}

export function firstAllowedPath(mods: AppModule[]): string {
  for (const m of APP_MODULES) {
    if (mods.includes(m)) return moduleToDefaultPath(m);
  }
  return "/dashboard";
}

/** Rota inicial após login ou quando já autenticado (landing/login). */
export function defaultPathAfterLogin(
  user: { role: string; username: string; allowedModules?: AppModule[] | null },
  tenantEnabled: AppModule[] | undefined,
  orgBilling?: OrgBillingInfo | null,
): string {
  const eff = effectiveModulesForUser(user, tenantEnabled, orgBilling);
  if (eff === "all") return "/dashboard";
  return firstAllowedPath(eff);
}
