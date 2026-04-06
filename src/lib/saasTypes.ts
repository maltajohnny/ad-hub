/** Módulos navegáveis — filtrados por org + utilizador; operadores da plataforma têm lista dedicada. */
export const APP_MODULES = [
  "dashboard",
  "board",
  "clientes",
  "clientes-favoritos",
  "campanhas",
  "intelli-search",
  "ia-roi",
  "usuarios",
  "configuracoes",
] as const;

export type AppModule = (typeof APP_MODULES)[number];

export const APP_MODULE_LABELS: Record<AppModule, string> = {
  dashboard: "Dashboard",
  board: "Board",
  clientes: "Clientes",
  "clientes-favoritos": "Clientes · Favoritos",
  campanhas: "Campanhas",
  "intelli-search": "IntelliSearch",
  "ia-roi": "IA & ROI",
  usuarios: "Usuários",
  configuracoes: "Configurações",
};

/** Contas internas Qtraffic (não veem módulos de entrega para clientes). */
export const PLATFORM_OPERATOR_USERNAMES = new Set(["admin", "qtrafficadmin"]);

export function isPlatformOperator(username: string | undefined | null): boolean {
  if (!username) return false;
  return PLATFORM_OPERATOR_USERNAMES.has(username.trim().toLowerCase());
}

/** Módulos visíveis para admin / qtrafficadmin — serviços da plataforma (IntelliSearch é por organização). */
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

/** Intersecção org + utilizador; admin de organização respeita módulos da org; operador de plataforma vê só serviços Qtraffic. */
export function effectiveModulesForUser(
  user: { role: string; username: string; allowedModules?: AppModule[] | null } | null,
  tenantEnabled: AppModule[] | undefined,
): AppModule[] | "all" {
  if (!user) return [];
  if (isPlatformOperator(user.username)) {
    return [...PLATFORM_OPERATOR_MODULES];
  }

  const orgSet = tenantEnabled?.length ? new Set(tenantEnabled) : null;

  if (user.role === "admin") {
    if (!orgSet) return "all";
    return APP_MODULES.filter((m) => orgSet.has(m));
  }

  const all = [...APP_MODULES];
  const userSet = user.allowedModules?.length ? new Set(user.allowedModules) : null;
  if (!orgSet && !userSet) return "all";
  return all.filter((m) => (orgSet ? orgSet.has(m) : true) && (userSet ? userSet.has(m) : true));
}

export function pathToModule(pathname: string): AppModule | null {
  if (pathname === "/dashboard" || pathname === "/" || pathname === "") return "dashboard";
  if (pathname === "/board") return "board";
  if (pathname === "/clientes") return "clientes";
  if (pathname === "/clientes/favoritos") return "clientes-favoritos";
  if (pathname === "/campanhas") return "campanhas";
  if (pathname === "/intelli-search" || pathname.startsWith("/intelli-search/")) return "intelli-search";
  if (pathname === "/ia-roi") return "ia-roi";
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
    case "campanhas":
      return "/campanhas";
    case "intelli-search":
      return "/intelli-search/health/complete";
    case "ia-roi":
      return "/ia-roi";
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
): string {
  const eff = effectiveModulesForUser(user, tenantEnabled);
  if (eff === "all") return "/dashboard";
  return firstAllowedPath(eff);
}
