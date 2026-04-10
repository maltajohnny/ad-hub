import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import { isStrongPassword } from "@/lib/passwordPolicy";
import { isPlatformOperator, type AppModule } from "@/lib/saasTypes";
import { isValidLoginUsername, normalizeLoginKey, sanitizeLoginInput } from "@/lib/loginUsername";
import { migrateStoredUsernameInLocalStorage } from "@/lib/migrateStoredUsername";
import { BUILTIN_NORTER_ID, BUILTIN_QTRAFFIC_ID, getTenantById } from "@/lib/tenantsStore";
import { getClientOrganizationScope } from "@/lib/clientOrgScope";
import {
  buildOrgScopedLogin,
  migrateOrgScopedLoginToNewSlug,
  parseOrgScopedLogin,
} from "@/lib/orgScopedLogin";
import {
  SERVER_MANAGED_PASSWORD,
  adHubAuthPing,
  adHubChangePassword,
  adHubCreateUser,
  adHubDeleteUser,
  adHubFetchRegistry,
  adHubLogin,
  adHubPatchUser,
  getAdHubToken,
  setAdHubToken,
  useServerAuth,
} from "@/lib/adhubAuthApi";
import type { User } from "@/types/user";

export type { User } from "@/types/user";

/** Quem pode gerir colunas e settings do Kanban (admin ou permissão explícita). */
export function canManageKanbanBoard(u: User | null | undefined): boolean {
  if (!u) return false;
  if (u.role === "admin") return true;
  return u.canManageBoard === true;
}

/** Quem pode excluir cards do Kanban (admin ou permissão explícita). */
export function canDeleteKanbanCards(u: User | null | undefined): boolean {
  if (!u) return false;
  if (u.role === "admin") return true;
  return u.canDeleteBoardCards === true;
}

/** Conta proprietária — não pode ser excluída */
export const OWNER_USERNAME = "admin";

/** Operadores da plataforma gerem qualquer conta; admins de org só contas da sua org (e a própria conta). */
function actorCanManageTargetUser(
  actor: User | null,
  target: User,
  scopeTenantId: string | null,
): boolean {
  if (!actor || actor.role !== "admin") return false;
  if (isPlatformOperator(actor.username)) {
    return true;
  }
  if (!scopeTenantId) return false;
  if (normalizeLoginKey(target.username) === normalizeLoginKey(actor.username)) {
    return true;
  }
  return target.organizationId === scopeTenantId;
}

const STORAGE_KEY = "norter_user_registry";
const CLIENT_ASSIGNMENTS_KEY = "norter_client_assignments";

/** clientId → username do usuário com perfil normal que pode ver o cliente (um cliente = um único usuário) */
export type ClientAssignmentMap = Record<number, string | null>;

type RegistryEntry = { password: string; user: User };

/** Migra todos os utilizadores com `organizationId === oldOrgId` para `newOrgId` e ajusta logins `*.slugAntigo` → `*.slugNovo`. */
function cascadeOrgUsersMigrate(
  registry: Record<string, RegistryEntry>,
  oldOrgId: string,
  newOrgId: string,
):
  | { ok: true; nextReg: Record<string, RegistryEntry>; renames: { from: string; to: string }[] }
  | { ok: false; error: string } {
  const newT = getTenantById(newOrgId);
  if (!newT) return { ok: false, error: "Organização de destino inválida." };

  const migrations: { from: string; to: string; entry: RegistryEntry }[] = [];
  for (const [k, e] of Object.entries(registry)) {
    if (e.user.organizationId !== oldOrgId) continue;
    const nl = migrateOrgScopedLoginToNewSlug(e.user.username, newT.slug);
    if (!nl) return { ok: false, error: `Login inválido ao migrar @${k}.` };
    const to = normalizeLoginKey(nl);
    migrations.push({ from: k, to, entry: e });
  }

  const tos = migrations.map((m) => m.to);
  if (new Set(tos).size !== tos.length) {
    return { ok: false, error: "Conflito: logins duplicados na migração de organização." };
  }

  for (const m of migrations) {
    const ex = registry[m.to];
    if (ex) {
      const slotFreedByRename = migrations.some((x) => x.from === m.to);
      if (!slotFreedByRename) {
        return { ok: false, error: `O login ${m.to} já está em uso.` };
      }
    }
  }

  const nextReg: Record<string, RegistryEntry> = { ...registry };
  for (const m of migrations) {
    delete nextReg[m.from];
  }
  for (const m of migrations) {
    nextReg[m.to] = {
      password: m.entry.password,
      user: {
        ...m.entry.user,
        username: m.to,
        organizationId: newOrgId,
        hideFromPlatformList: false,
      },
    };
  }

  return {
    ok: true,
    nextReg,
    renames: migrations.map(({ from, to }) => ({ from, to })),
  };
}

function loadAssignments(): ClientAssignmentMap {
  try {
    const raw = localStorage.getItem(CLIENT_ASSIGNMENTS_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, string | null>;
    const out: ClientAssignmentMap = {};
    for (const [k, v] of Object.entries(o)) {
      const id = parseInt(k, 10);
      if (!Number.isNaN(id)) out[id] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function persistAssignments(map: ClientAssignmentMap) {
  const serial: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(map)) {
    serial[String(k)] = v;
  }
  localStorage.setItem(CLIENT_ASSIGNMENTS_KEY, JSON.stringify(serial));
}

const defaultRegistry: Record<string, RegistryEntry> = {
  [OWNER_USERNAME]: {
    password: "p4p4l3gu4$",
    user: {
      role: "admin",
      username: OWNER_USERNAME,
      name: "Administrador",
      email: "admin@norter.com",
      phone: "(11) 99999-0000",
      document: "000.000.000-00",
      mustChangePassword: false,
      organizationId: BUILTIN_QTRAFFIC_ID,
    },
  },
  norter: {
    password: "N0rt3r@26",
    user: {
      role: "user",
      username: "norter",
      name: "Norter User",
      email: "contato@norter.com",
      phone: "(11) 98888-0000",
      document: "111.111.111-11",
      mustChangePassword: false,
      organizationId: BUILTIN_NORTER_ID,
    },
  },
  qtrafficadmin: {
    password: "Qtr@ffic#26",
    user: {
      role: "admin",
      username: "qtrafficadmin",
      name: "Operador AD-Hub",
      email: "ops@orbix.com",
      phone: "(11) 90000-0000",
      document: "000.000.000-01",
      mustChangePassword: false,
      organizationId: BUILTIN_QTRAFFIC_ID,
    },
  },
  "diego.norter": {
    password: "N0rt3rD!ego",
    user: {
      role: "admin",
      username: "diego.norter",
      name: "Diego — Norter",
      email: "diego@norter.com",
      phone: "(11) 97777-0000",
      document: "222.222.222-22",
      mustChangePassword: false,
      organizationId: BUILTIN_NORTER_ID,
    },
  },
};

/** Garante vínculos esperados: owner e operador Qtraffic → org Qtraffic; utilizador demo `norter` → org Norter. */
function applyBuiltinOrgMigrations(parsed: Record<string, RegistryEntry>): Record<string, RegistryEntry> {
  let changed = false;
  const next: Record<string, RegistryEntry> = { ...parsed };

  const ensureOwnerQtraffic = () => {
    const entry = next[OWNER_USERNAME];
    if (!entry?.user) return;
    if (entry.user.organizationId === BUILTIN_QTRAFFIC_ID) return;
    next[OWNER_USERNAME] = {
      ...entry,
      user: { ...entry.user, organizationId: BUILTIN_QTRAFFIC_ID },
    };
    changed = true;
  };

  const ensureQtrafficAdminOrg = () => {
    const entry = next.qtrafficadmin;
    if (!entry?.user) return;
    if (entry.user.organizationId === BUILTIN_QTRAFFIC_ID) return;
    next.qtrafficadmin = {
      ...entry,
      user: { ...entry.user, organizationId: BUILTIN_QTRAFFIC_ID },
    };
    changed = true;
  };

  const ensureNorterUserOrg = () => {
    const entry = next.norter;
    if (!entry?.user) return;
    if (entry.user.organizationId === BUILTIN_NORTER_ID) return;
    next.norter = {
      ...entry,
      user: { ...entry.user, organizationId: BUILTIN_NORTER_ID },
    };
    changed = true;
  };

  ensureOwnerQtraffic();
  ensureQtrafficAdminOrg();
  ensureNorterUserOrg();

  if (changed) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }
  return parsed;
}

function loadRegistry(): Record<string, RegistryEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultRegistry));
      return { ...defaultRegistry };
    }
    const parsed = JSON.parse(raw) as Record<string, RegistryEntry>;
    if (!parsed[OWNER_USERNAME]?.user) {
      parsed[OWNER_USERNAME] = defaultRegistry[OWNER_USERNAME];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    // Contas demo (`norter`, `qtrafficadmin`, `diego.norter`) só existem no primeiro arranque (`!raw` acima).
    // Não as recriar aqui — senão voltam sempre que o admin as apaga.
    if (parsed.diego?.user && !parsed["diego.norter"]?.user) {
      const e = parsed.diego;
      parsed["diego.norter"] = {
        ...e,
        user: {
          ...e.user,
          username: "diego.norter",
          organizationId: e.user.organizationId ?? BUILTIN_NORTER_ID,
        },
      };
      delete parsed.diego;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    return applyBuiltinOrgMigrations(parsed);
  } catch {
    return { ...defaultRegistry };
  }
}

function persistRegistry(next: Record<string, RegistryEntry>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

interface AuthContextType {
  user: User | null;
  /** Com MySQL+JWT no servidor, valida na BD; caso contrário registo local. */
  login: (
    username: string,
    password: string,
  ) => Promise<{ user: User | null; accountDisabled?: boolean }>;
  logout: () => void;
  updateProfile: (data: Partial<Omit<User, "username">>) => void;
  /** Nome exibido, contactos e login (exceto o owner `admin`, cujo login não pode mudar). */
  saveAccountProfile: (fields: {
    name: string;
    email: string;
    phone: string;
    document: string;
  }, loginRaw: string) => { ok: boolean; error?: string; loginChanged?: boolean };
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  /** Primeiro acesso: valida senha atual e define nova senha (remove `mustChangePassword`). */
  completeFirstPasswordChange: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Somente admins */
  listUsers: () => User[];
  createUser: (input: {
    username: string;
    password: string;
    name: string;
    email: string;
    role: "admin" | "user";
    canManageBoard?: boolean;
    canDeleteBoardCards?: boolean;
    allowedModules?: AppModule[] | null;
    /** Para admin de organização: id do tenant. Operadores da plataforma passam `null`. */
    scopeTenantId: string | null;
  }) => Promise<{ ok: boolean; error?: string; savedLocalOnly?: boolean }>;
  setUserAllowedModules: (
    username: string,
    modules: AppModule[] | null,
    scopeTenantId: string | null,
  ) => { ok: boolean; error?: string };
  deleteUser: (username: string, scopeTenantId: string | null) => Promise<{ ok: boolean; error?: string }>;
  /** Admin: editar dados de qualquer conta (exceto rebaixar o owner). */
  updateUserByAdmin: (
    username: string,
    patch: {
      newUsername?: string;
      name?: string;
      email?: string;
      phone?: string;
      document?: string;
      role?: "admin" | "user";
      newPassword?: string;
      disabled?: boolean;
      /** Só operadores da plataforma; `null` remove o vínculo. */
      organizationId?: string | null;
    },
    scopeTenantId: string | null,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Somente admin: concede/revoga permissão de Settings do Board (usuários não-admin). */
  setBoardSettingsPermission: (username: string, allowed: boolean, scopeTenantId: string | null) => {
    ok: boolean;
    error?: string;
  };
  /** Somente admin: concede/revoga permissão de excluir cards no Board (usuários não-admin). */
  setBoardDeleteCardsPermission: (username: string, allowed: boolean, scopeTenantId: string | null) => {
    ok: boolean;
    error?: string;
  };
  isOwner: (username: string) => boolean;
  /** Mapa clientId → username (só perfil user). Admins ignoram para visualização. */
  clientAssignments: ClientAssignmentMap;
  assignClientToUser: (
    clientId: number,
    username: string | null,
    scopeTenantId: string | null,
  ) => { ok: boolean; error?: string };
  canUserSeeClient: (clientId: number) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [registry, setRegistry] = useState<Record<string, RegistryEntry>>(() => loadRegistry());
  const [clientAssignments, setClientAssignments] = useState<ClientAssignmentMap>(() => loadAssignments());
  const [user, setUser] = useState<User | null>(() => {
    const saved = sessionStorage.getItem("norter_user");
    return saved ? JSON.parse(saved) : null;
  });

  const syncRegistry = useCallback((next: Record<string, RegistryEntry>) => {
    setRegistry(next);
    persistRegistry(next);
  }, []);

  const [serverAuthPing, setServerAuthPing] = useState<{ db: boolean; jwt_ready: boolean } | null>(null);
  const serverAuth = useServerAuth(serverAuthPing);

  useEffect(() => {
    void adHubAuthPing().then((p) => setServerAuthPing(p ?? null));
  }, []);

  const refreshRegistryFromServer = useCallback(async () => {
    if (!serverAuth) return;
    const tok = getAdHubToken();
    if (!tok) return;
    const ent = await adHubFetchRegistry(tok);
    if (!ent) return;
    const next: Record<string, RegistryEntry> = {};
    for (const [k, v] of Object.entries(ent)) {
      next[k] = { password: SERVER_MANAGED_PASSWORD, user: v.user };
    }
    syncRegistry(next);
  }, [serverAuth, syncRegistry]);

  useEffect(() => {
    if (!serverAuth) return;
    const tok = getAdHubToken();
    if (!tok) return;
    void refreshRegistryFromServer();
  }, [serverAuth, refreshRegistryFromServer]);

  useEffect(() => {
    if (user) sessionStorage.setItem("norter_user", JSON.stringify(user));
    else sessionStorage.removeItem("norter_user");
  }, [user]);

  /** Mantém a sessão alinhada ao registo (ex.: `mustChangePassword` após refresh). Desliga se a conta for desativada. */
  useEffect(() => {
    setUser((prev) => {
      if (!prev) return prev;
      const key = normalizeLoginKey(prev.username);
      const entry = registry[key];
      if (!entry) return prev;
      if (entry.user.disabled === true) {
        return null;
      }
      return { ...entry.user };
    });
  }, [registry]);

  const login = useCallback(
    async (
      username: string,
      password: string,
    ): Promise<{ user: User | null; accountDisabled?: boolean }> => {
      const key = normalizeLoginKey(username);
      if (serverAuth) {
        const r = await adHubLogin(key, password);
        if (r) {
          setAdHubToken(r.token);
          const ent = await adHubFetchRegistry(r.token);
          if (ent) {
            const next: Record<string, RegistryEntry> = {};
            for (const [k, v] of Object.entries(ent)) {
              next[k] = { password: SERVER_MANAGED_PASSWORD, user: v.user };
            }
            syncRegistry(next);
          } else {
            setRegistry((prev) => {
              const next = { ...prev, [key]: { password: SERVER_MANAGED_PASSWORD, user: r.user } };
              persistRegistry(next);
              return next;
            });
          }
          setUser(r.user);
          return { user: r.user };
        }
        return { user: null };
      }
      const entry = registry[key];
      if (entry?.password === SERVER_MANAGED_PASSWORD) {
        return { user: null };
      }
      if (!entry || entry.password !== password) {
        return { user: null };
      }
      if (entry.user.disabled === true) {
        return { user: null, accountDisabled: true };
      }
      const u = { ...entry.user };
      setUser(u);
      return { user: u };
    },
    [registry, serverAuth, syncRegistry],
  );

  const logout = () => {
    setAdHubToken(null);
    setUser(null);
  };

  const updateProfile = useCallback(
    (data: Partial<Omit<User, "username">>) => {
      if (!user) return;
      let patch: Partial<Omit<User, "username">> = { ...data };
      if ("organizationId" in data) {
        if (!isPlatformOperator(user.username)) {
          const { organizationId: _removed, ...rest } = patch;
          patch = rest;
        } else {
          const oid = data.organizationId;
          if (!oid) {
            patch = { ...patch, organizationId: undefined };
          } else if (oid !== BUILTIN_QTRAFFIC_ID) {
            const { organizationId: _removed, ...rest } = patch;
            patch = rest;
          }
        }
      }
      const merged = { ...user, ...patch } as User;
      if ("organizationId" in data && isPlatformOperator(user.username) && !merged.organizationId) {
        delete merged.organizationId;
      }
      setUser(merged);
      setRegistry((reg) => {
        const entry = reg[user.username];
        if (!entry) return reg;
        const nextUser = { ...entry.user, ...patch } as User;
        if ("organizationId" in data && isPlatformOperator(user.username) && !nextUser.organizationId) {
          delete nextUser.organizationId;
        }
        const nextReg = {
          ...reg,
          [user.username]: { ...entry, user: nextUser },
        };
        persistRegistry(nextReg);
        return nextReg;
      });
    },
    [user],
  );

  const saveAccountProfile = useCallback(
    (
      fields: { name: string; email: string; phone: string; document: string },
      loginRaw: string,
    ): { ok: boolean; error?: string; loginChanged?: boolean } => {
      if (!user) return { ok: false, error: "Sessão inválida." };
      const sanitized = sanitizeLoginInput(loginRaw);
      if (!isValidLoginUsername(sanitized)) {
        return {
          ok: false,
          error: "Login inválido: sem espaços nem vírgulas, até 80 caracteres.",
        };
      }
      const normalized = normalizeLoginKey(sanitized);
      const currentKey = user.username.trim().toLowerCase();

      if (currentKey === OWNER_USERNAME.toLowerCase() && normalized !== currentKey) {
        return { ok: false, error: "O login do administrador principal não pode ser alterado." };
      }

      const mergeUser = (base: User): User => ({
        ...base,
        name: fields.name.trim(),
        email: fields.email.trim(),
        phone: fields.phone.trim(),
        document: fields.document.trim(),
        username: normalized,
      });

      if (normalized === currentKey) {
        const entry = registry[currentKey];
        if (!entry) return { ok: false, error: "Sessão inválida." };
        const nextUser = mergeUser(entry.user);
        const nextReg = { ...registry, [currentKey]: { ...entry, user: nextUser } };
        syncRegistry(nextReg);
        setUser(nextUser);
        return { ok: true, loginChanged: false };
      }

      if (registry[normalized]) {
        return { ok: false, error: "Este login já está em uso." };
      }

      const entry = registry[currentKey];
      if (!entry) return { ok: false, error: "Sessão inválida." };

      migrateStoredUsernameInLocalStorage(user.username, normalized);

      const nextReg = { ...registry };
      delete nextReg[currentKey];
      const nextUser = mergeUser({ ...entry.user, username: normalized });
      nextReg[normalized] = { ...entry, user: nextUser };

      setClientAssignments((prev) => {
        const next = { ...prev };
        for (const cidStr of Object.keys(next)) {
          const cid = parseInt(cidStr, 10);
          const v = next[cid];
          if (v != null && v.trim().toLowerCase() === currentKey) {
            next[cid] = normalized;
          }
        }
        persistAssignments(next);
        return next;
      });

      syncRegistry(nextReg);
      setUser(nextUser);
      return { ok: true, loginChanged: true };
    },
    [user, registry, syncRegistry],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<boolean> => {
      if (!user) return false;
      if (!isStrongPassword(newPassword)) return false;
      const key = normalizeLoginKey(user.username);
      if (serverAuth) {
        const ok = await adHubChangePassword(key, currentPassword, newPassword);
        if (!ok) return false;
        const entry = registry[key];
        if (entry) {
          syncRegistry({
            ...registry,
            [key]: {
              ...entry,
              password: SERVER_MANAGED_PASSWORD,
              user: { ...entry.user, mustChangePassword: false },
            },
          });
        }
        setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
        await refreshRegistryFromServer();
        return true;
      }
      const entry = registry[user.username];
      if (!entry || entry.password !== currentPassword) return false;
      const nextReg = {
        ...registry,
        [user.username]: {
          ...entry,
          password: newPassword,
          user: { ...entry.user, mustChangePassword: false },
        },
      };
      syncRegistry(nextReg);
      setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
      return true;
    },
    [user, registry, syncRegistry, serverAuth, refreshRegistryFromServer],
  );

  const completeFirstPasswordChange = useCallback(
    async (currentPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> => {
      if (!user) return { ok: false, error: "Sessão inválida." };
      if (!user.mustChangePassword) return { ok: false, error: "Não é necessário alterar a senha agora." };
      if (!isStrongPassword(newPassword)) {
        return {
          ok: false,
          error: "A nova senha deve ter no mínimo 6 caracteres, com maiúscula, minúscula e caractere especial.",
        };
      }
      const key = normalizeLoginKey(user.username);
      if (serverAuth) {
        const ok = await adHubChangePassword(key, currentPassword, newPassword);
        if (!ok) return { ok: false, error: "Senha atual incorreta." };
        setUser({ ...user, mustChangePassword: false });
        await refreshRegistryFromServer();
        return { ok: true };
      }
      const entry = registry[user.username];
      if (!entry || entry.password !== currentPassword) {
        return { ok: false, error: "Senha atual incorreta." };
      }
      const nextReg = {
        ...registry,
        [user.username]: {
          ...entry,
          password: newPassword,
          user: { ...entry.user, mustChangePassword: false },
        },
      };
      syncRegistry(nextReg);
      setUser({ ...user, mustChangePassword: false });
      return { ok: true };
    },
    [user, registry, syncRegistry, serverAuth, refreshRegistryFromServer],
  );

  const listUsers = useCallback((): User[] => {
    return Object.values(registry)
      .map((e) => e.user)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [registry]);

  const setUserAllowedModules = useCallback(
    (
      username: string,
      modules: AppModule[] | null,
      scopeTenantId: string | null,
    ): { ok: boolean; error?: string } => {
      if (!user || user.role !== "admin") return { ok: false, error: "Sem permissão." };
      const key = normalizeLoginKey(username);
      const entry = registry[key];
      if (!entry) return { ok: false, error: "Usuário não encontrado." };
      if (!actorCanManageTargetUser(user, entry.user, scopeTenantId)) {
        return { ok: false, error: "Sem permissão para alterar este utilizador." };
      }
      if (entry.user.role !== "user") return { ok: false, error: "Apenas para perfil padrão." };
      const nextUser: User = {
        ...entry.user,
        allowedModules: modules === null || modules.length === 0 ? undefined : modules,
      };
      const nextReg = { ...registry, [key]: { ...entry, user: nextUser } };
      syncRegistry(nextReg);
      if (user.username === key) setUser(nextUser);
      return { ok: true };
    },
    [user, registry, syncRegistry],
  );

  const createUser = useCallback(
    async (input: {
      username: string;
      password: string;
      name: string;
      email: string;
      role: "admin" | "user";
      canManageBoard?: boolean;
      canDeleteBoardCards?: boolean;
      allowedModules?: AppModule[] | null;
      scopeTenantId: string | null;
    }): Promise<{ ok: boolean; error?: string; savedLocalOnly?: boolean }> => {
      if (!user || user.role !== "admin") return { ok: false, error: "Sem permissão." };
      let orgId: string | undefined;
      if (isPlatformOperator(user.username)) {
        orgId = input.scopeTenantId ?? undefined;
      } else {
        if (!input.scopeTenantId) {
          return {
            ok: false,
            error: "Selecione uma organização (contexto) para criar utilizadores nesta conta.",
          };
        }
        orgId = input.scopeTenantId;
      }

      let u: string;
      const rawLogin = sanitizeLoginInput(input.username);
      if (orgId) {
        const tr = getTenantById(orgId);
        if (!tr) return { ok: false, error: "Organização inválida." };
        const built = buildOrgScopedLogin(rawLogin, tr.slug);
        if (!built) {
          return { ok: false, error: "Nome de login inválido (use só a parte antes do ponto, ex.: maria)." };
        }
        u = normalizeLoginKey(built);
      } else {
        u = normalizeLoginKey(rawLogin);
      }

      if (!isValidLoginUsername(rawLogin)) {
        return { ok: false, error: "Login inválido: sem espaços nem vírgulas, até 80 caracteres." };
      }
      if (orgId && !rawLogin.trim()) {
        return { ok: false, error: "Indique o nome de utilizador (será nome.organização)." };
      }
      if (registry[u]) return { ok: false, error: "Este login já existe." };
      if (!isStrongPassword(input.password)) {
        return {
          ok: false,
          error: "Senha inicial inválida: mínimo 6 caracteres, com maiúscula, minúscula e caractere especial.",
        };
      }
      let allowedMod: AppModule[] | undefined;
      if (input.role === "user") {
        if (input.allowedModules !== undefined && input.allowedModules !== null && input.allowedModules.length > 0) {
          allowedMod = input.allowedModules;
        }
      }
      const newUser: User = {
        username: u,
        name: input.name.trim() || u,
        email: input.email.trim(),
        phone: "",
        document: "",
        role: input.role,
        avatarDataUrl: null,
        ...(orgId
          ? {
              organizationId: orgId,
              ...(!isPlatformOperator(user.username) ? { hideFromPlatformList: true as const } : {}),
            }
          : {}),
        ...(input.role === "user"
          ? {
              mustChangePassword: true as const,
              canManageBoard: input.canManageBoard === true,
              canDeleteBoardCards: input.canDeleteBoardCards === true,
              ...(allowedMod ? { allowedModules: allowedMod } : {}),
            }
          : { mustChangePassword: false as const }),
      };
      if (serverAuth) {
        const tok = getAdHubToken();
        if (!tok) return { ok: false, error: "Sessão sem token — inicie sessão novamente." };
        const created = await adHubCreateUser(tok, u, input.password, newUser);
        if (!created.ok) return { ok: false, error: created.error ?? "Não foi possível criar utilizador no servidor." };
        await refreshRegistryFromServer();
        return { ok: true };
      }
      const nextReg = {
        ...registry,
        [u]: { password: input.password, user: newUser },
      };
      syncRegistry(nextReg);
      return { ok: true, savedLocalOnly: true };
    },
    [user, registry, syncRegistry, serverAuth, refreshRegistryFromServer],
  );

  const setBoardSettingsPermission = useCallback(
    (
      username: string,
      allowed: boolean,
      scopeTenantId: string | null,
    ): { ok: boolean; error?: string } => {
      if (!user || user.role !== "admin") return { ok: false, error: "Sem permissão." };
      const key = normalizeLoginKey(username);
      const entry = registry[key];
      if (!entry) return { ok: false, error: "Usuário não encontrado." };
      if (!actorCanManageTargetUser(user, entry.user, scopeTenantId)) {
        return { ok: false, error: "Sem permissão para alterar este utilizador." };
      }
      if (entry.user.role === "admin") return { ok: true };
      const nextReg = {
        ...registry,
        [key]: { ...entry, user: { ...entry.user, canManageBoard: allowed } },
      };
      syncRegistry(nextReg);
      if (user.username === key) {
        setUser((prev) => (prev && prev.username === key ? { ...prev, canManageBoard: allowed } : prev));
      }
      return { ok: true };
    },
    [user, registry, syncRegistry],
  );

  const setBoardDeleteCardsPermission = useCallback(
    (
      username: string,
      allowed: boolean,
      scopeTenantId: string | null,
    ): { ok: boolean; error?: string } => {
      if (!user || user.role !== "admin") return { ok: false, error: "Sem permissão." };
      const key = normalizeLoginKey(username);
      const entry = registry[key];
      if (!entry) return { ok: false, error: "Usuário não encontrado." };
      if (!actorCanManageTargetUser(user, entry.user, scopeTenantId)) {
        return { ok: false, error: "Sem permissão para alterar este utilizador." };
      }
      if (entry.user.role === "admin") return { ok: true };
      const nextReg = {
        ...registry,
        [key]: { ...entry, user: { ...entry.user, canDeleteBoardCards: allowed } },
      };
      syncRegistry(nextReg);
      if (user.username === key) {
        setUser((prev) => (prev && prev.username === key ? { ...prev, canDeleteBoardCards: allowed } : prev));
      }
      return { ok: true };
    },
    [user, registry, syncRegistry],
  );

  const updateUserByAdmin = useCallback(
    async (
      username: string,
      patch: {
        newUsername?: string;
        name?: string;
        email?: string;
        phone?: string;
        document?: string;
        role?: "admin" | "user";
        newPassword?: string;
        disabled?: boolean;
        organizationId?: string | null;
      },
      scopeTenantId: string | null,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!user || user.role !== "admin") return { ok: false, error: "Sem permissão." };
      const key = normalizeLoginKey(username);
      const entry = registry[key];
      if (!entry) return { ok: false, error: "Usuário não encontrado." };
      if (!actorCanManageTargetUser(user, entry.user, scopeTenantId)) {
        return { ok: false, error: "Sem permissão para alterar este utilizador." };
      }
      if (key === OWNER_USERNAME && patch.role === "user") {
        return { ok: false, error: "A conta proprietária deve permanecer como administrador." };
      }
      if (key === OWNER_USERNAME && patch.disabled === true) {
        return { ok: false, error: "A conta proprietária não pode ser desativada." };
      }

      const patchOrgEarly = patch.organizationId;
      if (
        patchOrgEarly !== undefined &&
        isPlatformOperator(user.username) &&
        key !== OWNER_USERNAME
      ) {
        const oldOid = entry.user.organizationId;
        const newOid =
          patchOrgEarly === null || patchOrgEarly === "" ? null : patchOrgEarly;
        if (newOid && !getTenantById(newOid)) {
          return { ok: false, error: "Organização inválida." };
        }
        if (oldOid && newOid && oldOid !== newOid) {
          const mig = cascadeOrgUsersMigrate(registry, oldOid, newOid);
          if (!mig.ok) return mig;
          const newKey = mig.renames.find((r) => r.from === key)?.to;
          if (!newKey) return { ok: false, error: "Migração: utilizador não encontrado." };
          const base = mig.nextReg[newKey];
          let mergedUser: User = { ...base.user };
          if (patch.name !== undefined) mergedUser.name = patch.name.trim() || mergedUser.username;
          if (patch.email !== undefined) mergedUser.email = patch.email.trim();
          if (patch.phone !== undefined) mergedUser.phone = patch.phone.trim();
          if (patch.document !== undefined) mergedUser.document = patch.document.trim();
          if (patch.disabled !== undefined) {
            mergedUser.disabled = patch.disabled ? true : undefined;
          }
          if (patch.role !== undefined) {
            mergedUser.role = patch.role;
            if (patch.role === "admin") {
              mergedUser.mustChangePassword = false;
              mergedUser.allowedModules = undefined;
              delete mergedUser.canManageBoard;
              delete mergedUser.canDeleteBoardCards;
            } else {
              mergedUser.canManageBoard = base.user.canManageBoard ?? false;
              mergedUser.canDeleteBoardCards = base.user.canDeleteBoardCards ?? false;
            }
          }
          let mergedPwd = base.password;
          if (patch.newPassword !== undefined && patch.newPassword.trim() !== "") {
            if (!isStrongPassword(patch.newPassword)) {
              return {
                ok: false,
                error: "Senha inválida: mínimo 6 caracteres, maiúscula, minúscula e caractere especial.",
              };
            }
            mergedPwd = patch.newPassword.trim();
          }
          mig.nextReg[newKey] = { ...base, password: mergedPwd, user: mergedUser };

          if (serverAuth && getAdHubToken()) {
            return {
              ok: false,
              error:
                "Migração em massa de organização não está disponível enquanto as contas estão na base de dados. Contacte um operador.",
            };
          }

          for (const { from, to } of mig.renames) {
            if (from !== to) migrateStoredUsernameInLocalStorage(from, to);
          }
          setClientAssignments((prev) => {
            const next = { ...prev };
            for (const cidStr of Object.keys(next)) {
              const cid = parseInt(cidStr, 10);
              const v = next[cid];
              if (v == null) continue;
              const vk = normalizeLoginKey(v);
              const hit = mig.renames.find((r) => r.from === vk);
              if (hit) next[cid] = hit.to;
            }
            persistAssignments(next);
            return next;
          });
          syncRegistry(mig.nextReg);
          setUser((prev) => {
            if (!prev) return prev;
            const hit = mig.renames.find((r) => r.from === normalizeLoginKey(prev.username));
            if (hit) return mig.nextReg[hit.to].user;
            return prev;
          });
          return { ok: true };
        }
      }

      let nextUser: User = { ...entry.user };
      let nextKey = key;

      if (patch.newUsername !== undefined) {
        const raw = sanitizeLoginInput(patch.newUsername);
        if (!isValidLoginUsername(raw)) {
          return { ok: false, error: "Login inválido: sem espaços nem vírgulas, até 80 caracteres." };
        }
        const normalized = normalizeLoginKey(raw);
        if (key === OWNER_USERNAME && normalized !== OWNER_USERNAME) {
          return { ok: false, error: "O login do administrador principal não pode ser alterado." };
        }
        if (normalized !== key && registry[normalized]) {
          return { ok: false, error: "Este login já está em uso." };
        }
        nextKey = normalized;
        nextUser = { ...nextUser, username: normalized };
      }

      if (patch.name !== undefined) nextUser.name = patch.name.trim() || nextUser.username;
      if (patch.email !== undefined) nextUser.email = patch.email.trim();
      if (patch.phone !== undefined) nextUser.phone = patch.phone.trim();
      if (patch.document !== undefined) nextUser.document = patch.document.trim();

      if (patch.disabled !== undefined) {
        nextUser.disabled = patch.disabled ? true : undefined;
      }

      if (patch.organizationId !== undefined) {
        if (!isPlatformOperator(user.username)) {
          return { ok: false, error: "Apenas operadores da plataforma podem alterar o vínculo de organização." };
        }
        if (key === OWNER_USERNAME) {
          return { ok: false, error: "A conta proprietária não pode ser vinculada a uma organização." };
        }
        const oldOid = entry.user.organizationId;
        const newOid =
          patch.organizationId === null || patch.organizationId === ""
            ? null
            : patch.organizationId;
        if (newOid && !getTenantById(newOid)) {
          return { ok: false, error: "Organização inválida." };
        }
        if (oldOid && newOid && oldOid !== newOid) {
          /* Migração em massa tratada acima (early return). */
        } else if (!newOid) {
          delete nextUser.organizationId;
          nextUser.hideFromPlatformList = false;
          const p = parseOrgScopedLogin(nextKey);
          if (p) {
            nextKey = p.localPart;
            nextUser.username = p.localPart;
          }
        } else if (!oldOid && newOid) {
          const tr = getTenantById(newOid);
          if (!tr) return { ok: false, error: "Organização inválida." };
          nextUser.organizationId = newOid;
          nextUser.hideFromPlatformList = false;
          const local = parseOrgScopedLogin(nextKey)?.localPart ?? nextKey;
          const built = buildOrgScopedLogin(local, tr.slug);
          if (!built) {
            return { ok: false, error: "Não foi possível gerar o login no formato nome.organização." };
          }
          const nk = normalizeLoginKey(built);
          if (nk !== nextKey) {
            if (registry[nk]) {
              return { ok: false, error: "Este login já está em uso." };
            }
            nextKey = nk;
            nextUser.username = nk;
          }
        } else if (oldOid === newOid) {
          /* sem alteração de organização */
        }
      }

      if (patch.role !== undefined) {
        nextUser.role = patch.role;
        if (patch.role === "admin") {
          nextUser.mustChangePassword = false;
          nextUser.allowedModules = undefined;
          delete nextUser.canManageBoard;
          delete nextUser.canDeleteBoardCards;
        } else {
          nextUser.canManageBoard = entry.user.canManageBoard ?? false;
          nextUser.canDeleteBoardCards = entry.user.canDeleteBoardCards ?? false;
        }
      }

      let nextPassword = entry.password;
      if (patch.newPassword !== undefined && patch.newPassword.trim() !== "") {
        if (!isStrongPassword(patch.newPassword)) {
          return {
            ok: false,
            error: "Senha inválida: mínimo 6 caracteres, maiúscula, minúscula e caractere especial.",
          };
        }
        nextPassword = patch.newPassword.trim();
      }

      if (serverAuth) {
        const tok = getAdHubToken();
        if (!tok) return { ok: false, error: "Sessão sem token." };
        if (nextKey !== key) {
          return {
            ok: false,
            error:
              "Alterar o login (nome de utilizador) com autenticação no servidor ainda não é suportado. Contacte um operador da plataforma.",
          };
        }
        const patchPayload: { user: Partial<User>; newPassword?: string } = { user: { ...nextUser } };
        if (patch.newPassword !== undefined && patch.newPassword.trim() !== "") {
          patchPayload.newPassword = patch.newPassword.trim();
        }
        const ok = await adHubPatchUser(tok, key, patchPayload);
        if (!ok) return { ok: false, error: "Não foi possível gravar as alterações no servidor." };
        await refreshRegistryFromServer();
        return { ok: true };
      }

      let nextReg: Record<string, RegistryEntry> = { ...registry };
      if (nextKey !== key) {
        delete nextReg[key];
        migrateStoredUsernameInLocalStorage(key, nextKey);
        setClientAssignments((prev) => {
          const next = { ...prev };
          for (const cidStr of Object.keys(next)) {
            const cid = parseInt(cidStr, 10);
            const v = next[cid];
            if (v != null && normalizeLoginKey(v) === key) {
              next[cid] = nextKey;
            }
          }
          persistAssignments(next);
          return next;
        });
      }
      nextReg[nextKey] = { ...entry, password: nextPassword, user: nextUser };
      syncRegistry(nextReg);
      setUser((prev) => {
        if (prev && normalizeLoginKey(prev.username) === key) {
          return nextUser;
        }
        return prev;
      });
      return { ok: true };
    },
    [user, registry, syncRegistry, serverAuth, refreshRegistryFromServer],
  );

  const deleteUser = useCallback(
    async (username: string, scopeTenantId: string | null): Promise<{ ok: boolean; error?: string }> => {
      if (!user || user.role !== "admin") return { ok: false, error: "Sem permissão." };
      const key = normalizeLoginKey(username);
      if (key === OWNER_USERNAME) return { ok: false, error: "A conta Administrador (owner) não pode ser excluída." };
      const entry = registry[key];
      if (!entry) return { ok: false, error: "Usuário não encontrado." };
      if (!actorCanManageTargetUser(user, entry.user, scopeTenantId)) {
        return { ok: false, error: "Sem permissão para excluir este utilizador." };
      }
      if (serverAuth) {
        const tok = getAdHubToken();
        if (!tok) return { ok: false, error: "Sessão sem token." };
        const ok = await adHubDeleteUser(tok, key);
        if (!ok) return { ok: false, error: "Não foi possível remover no servidor." };
        await refreshRegistryFromServer();
      } else {
        const rest = { ...registry };
        delete rest[key];
        syncRegistry(rest);
      }
      setClientAssignments((prev) => {
        const next = { ...prev };
        for (const cid of Object.keys(next)) {
          const id = parseInt(cid, 10);
          if (next[id] === key) delete next[id];
        }
        persistAssignments(next);
        return next;
      });
      if (user.username === key) {
        setUser(null);
      }
      return { ok: true };
    },
    [user, registry, syncRegistry, serverAuth, refreshRegistryFromServer],
  );

  const assignClientToUser = useCallback(
    (clientId: number, username: string | null, scopeTenantId: string | null): { ok: boolean; error?: string } => {
      if (!user || user.role !== "admin") return { ok: false, error: "Sem permissão." };
      if (username !== null) {
        const nk = normalizeLoginKey(username);
        const target = registry[nk];
        if (!target) return { ok: false, error: "Usuário não encontrado." };
        if (!actorCanManageTargetUser(user, target.user, scopeTenantId)) {
          return { ok: false, error: "Sem permissão para atribuir este utilizador." };
        }
        if (target.user.role !== "user") return { ok: false, error: "Atribua apenas a usuários com perfil padrão (não admin)." };
      }
      setClientAssignments((prev) => {
        const next = { ...prev };
        if (username === null) {
          delete next[clientId];
        } else {
          next[clientId] = normalizeLoginKey(username);
        }
        persistAssignments(next);
        return next;
      });
      return { ok: true };
    },
    [user, registry],
  );

  const canUserSeeClient = useCallback(
    (clientId: number) => {
      if (!user) return false;
      const scope = getClientOrganizationScope(clientId);

      if (user.role !== "admin") {
        if (scope === BUILTIN_NORTER_ID && user.organizationId !== BUILTIN_NORTER_ID) {
          return false;
        }
        return clientAssignments[clientId] === user.username;
      }

      /** Contas internas Qtraffic (admin, qtrafficadmin) não acedem à carteira Norter; gerem a plataforma. */
      if (isPlatformOperator(user.username)) {
        return false;
      }

      if (user.organizationId) {
        return scope === user.organizationId;
      }
      return false;
    },
    [user, clientAssignments],
  );

  const isOwner = useCallback((username: string) => username === OWNER_USERNAME, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        updateProfile,
        saveAccountProfile,
        changePassword,
        completeFirstPasswordChange,
        listUsers,
        createUser,
        setUserAllowedModules,
        updateUserByAdmin,
        deleteUser,
        setBoardSettingsPermission,
        setBoardDeleteCardsPermission,
        isOwner,
        clientAssignments,
        assignClientToUser,
        canUserSeeClient,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
