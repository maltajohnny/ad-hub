/** Módulos navegáveis — admin vê todos; utilizadores filtram por `allowedModules`. */
export const APP_MODULES = [
  "dashboard",
  "board",
  "clientes",
  "clientes-favoritos",
  "campanhas",
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
  "ia-roi": "IA & ROI",
  usuarios: "Usuários",
  configuracoes: "Configurações",
};

/** Slugs reservados — não podem ser usados por organizações cliente. */
export const RESERVED_TENANT_SLUGS = new Set([
  "norter",
  "admin",
  "www",
  "api",
  "app",
  "landing",
  "login",
  "t",
]);

/** Intersecção org + utilizador; admin vê tudo. */
export function effectiveModulesForUser(
  user: { role: string; allowedModules?: AppModule[] | null } | null,
  tenantEnabled: AppModule[] | undefined,
): AppModule[] | "all" {
  if (!user) return [];
  if (user.role === "admin") return "all";
  const all = [...APP_MODULES];
  const orgSet = tenantEnabled?.length ? new Set(tenantEnabled) : null;
  const userSet = user.allowedModules?.length ? new Set(user.allowedModules) : null;
  if (!orgSet && !userSet) return "all";
  return all.filter((m) => (orgSet ? orgSet.has(m) : true) && (userSet ? userSet.has(m) : true));
}

export function pathToModule(pathname: string): AppModule | null {
  if (pathname === "/" || pathname === "") return "dashboard";
  if (pathname === "/board") return "board";
  if (pathname === "/clientes") return "clientes";
  if (pathname === "/clientes/favoritos") return "clientes-favoritos";
  if (pathname === "/campanhas") return "campanhas";
  if (pathname === "/ia-roi") return "ia-roi";
  if (pathname === "/usuarios") return "usuarios";
  if (pathname.startsWith("/configuracoes")) return "configuracoes";
  return null;
}

export function moduleToDefaultPath(m: AppModule): string {
  switch (m) {
    case "dashboard":
      return "/";
    case "board":
      return "/board";
    case "clientes":
      return "/clientes";
    case "clientes-favoritos":
      return "/clientes/favoritos";
    case "campanhas":
      return "/campanhas";
    case "ia-roi":
      return "/ia-roi";
    case "usuarios":
      return "/usuarios";
    case "configuracoes":
      return "/configuracoes";
    default:
      return "/";
  }
}

export function firstAllowedPath(mods: AppModule[]): string {
  for (const m of APP_MODULES) {
    if (mods.includes(m)) return moduleToDefaultPath(m);
  }
  return "/";
}
