import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import { isStrongPassword } from "@/lib/passwordPolicy";
import { isPlatformOperator, type AppModule } from "@/lib/saasTypes";
import { isValidLoginUsername, normalizeLoginKey, sanitizeLoginInput } from "@/lib/loginUsername";
import { migrateStoredUsernameInLocalStorage } from "@/lib/migrateStoredUsername";

export interface User {
  role: "admin" | "user";
  username: string;
  name: string;
  email: string;
  phone: string;
  document: string;
  /** Foto de perfil (data URL). `null` ou ausente = avatar padrão */
  avatarDataUrl?: string | null;
  /** Pode abrir Settings do Board (colunas). Admins sempre podem. */
  canManageBoard?: boolean;
  /** Pode excluir cards no Board. Admins sempre podem. */
  canDeleteBoardCards?: boolean;
  /** Conta criada por admin: obriga troca de senha no primeiro acesso. */
  mustChangePassword?: boolean;
  /** Módulos do menu visíveis (só perfil user). `undefined` = todos. */
  allowedModules?: AppModule[] | null;
  /** Conta desativada por admin — não pode iniciar sessão até ser reativada. */
  disabled?: boolean;
  /**
   * Id da organização (tenant) a que esta conta pertence quando criada por um admin de organização.
   * Ausente = conta ao nível da plataforma (visível só a operadores como owner/qtrafficadmin).
   */
  organizationId?: string;
  /**
   * Criado por admin de organização — não aparece na lista de utilizadores dos operadores da plataforma.
   * Contas geridas pelo owner (vínculo manual) mantêm este campo ausente/falso.
   */
  hideFromPlatformList?: boolean;
}

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
    },
  },
  qtrafficadmin: {
    password: "Qtr@ffic#26",
    user: {
      role: "admin",
      username: "qtrafficadmin",
      name: "Operador QTRAFFIC",
      email: "ops@qtraffic.com",
      phone: "(11) 90000-0000",
      document: "000.000.000-01",
      mustChangePassword: false,
    },
  },
  diego: {
    password: "N0rt3rD!ego",
    user: {
      role: "admin",
      username: "diego",
      name: "Diego — Norter",
      email: "diego@norter.com",
      phone: "(11) 97777-0000",
      document: "222.222.222-22",
      mustChangePassword: false,
    },
  },
};

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
    if (!parsed.qtrafficadmin?.user) {
      parsed.qtrafficadmin = defaultRegistry.qtrafficadmin;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    if (!parsed.diego?.user) {
      parsed.diego = defaultRegistry.diego;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return { ...defaultRegistry };
  }
}

function persistRegistry(next: Record<string, RegistryEntry>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => { user: User | null; accountDisabled?: boolean };
  logout: () => void;
  updateProfile: (data: Partial<Omit<User, "username">>) => void;
  /** Nome exibido, contactos e login (exceto o owner `admin`, cujo login não pode mudar). */
  saveAccountProfile: (fields: {
    name: string;
    email: string;
    phone: string;
    document: string;
  }, loginRaw: string) => { ok: boolean; error?: string; loginChanged?: boolean };
  changePassword: (currentPassword: string, newPassword: string) => boolean;
  /** Primeiro acesso: valida senha atual e define nova senha (remove `mustChangePassword`). */
  completeFirstPasswordChange: (currentPassword: string, newPassword: string) => { ok: boolean; error?: string };
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
  }) => { ok: boolean; error?: string };
  setUserAllowedModules: (
    username: string,
    modules: AppModule[] | null,
    scopeTenantId: string | null,
  ) => { ok: boolean; error?: string };
  deleteUser: (username: string, scopeTenantId: string | null) => { ok: boolean; error?: string };
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
  ) => { ok: boolean; error?: string };
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
    (username: string, password: string): { user: User | null; accountDisabled?: boolean } => {
      const key = username.trim().toLowerCase();
      const entry = registry[key];
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
    [registry],
  );

  const logout = () => setUser(null);

  const updateProfile = useCallback(
    (data: Partial<Omit<User, "username">>) => {
      if (!user) return;
      const nextUser = { ...user, ...data } as User;
      setUser(nextUser);
      setRegistry((reg) => {
        const entry = reg[user.username];
        if (!entry) return reg;
        const nextReg = {
          ...reg,
          [user.username]: { ...entry, user: { ...entry.user, ...data } },
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
    (currentPassword: string, newPassword: string) => {
      if (!user) return false;
      const entry = registry[user.username];
      if (!entry || entry.password !== currentPassword) return false;
      if (!isStrongPassword(newPassword)) return false;
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
    [user, registry, syncRegistry],
  );

  const completeFirstPasswordChange = useCallback(
    (currentPassword: string, newPassword: string): { ok: boolean; error?: string } => {
      if (!user) return { ok: false, error: "Sessão inválida." };
      if (!user.mustChangePassword) return { ok: false, error: "Não é necessário alterar a senha agora." };
      const entry = registry[user.username];
      if (!entry || entry.password !== currentPassword) {
        return { ok: false, error: "Senha atual incorreta." };
      }
      if (!isStrongPassword(newPassword)) {
        return {
          ok: false,
          error: "A nova senha deve ter no mínimo 6 caracteres, com maiúscula, minúscula e caractere especial.",
        };
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
    [user, registry, syncRegistry],
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
    (input: {
      username: string;
      password: string;
      name: string;
      email: string;
      role: "admin" | "user";
      canManageBoard?: boolean;
      canDeleteBoardCards?: boolean;
      allowedModules?: AppModule[] | null;
      scopeTenantId: string | null;
    }): { ok: boolean; error?: string } => {
      if (!user || user.role !== "admin") return { ok: false, error: "Sem permissão." };
      let orgId: string | undefined;
      if (isPlatformOperator(user.username)) {
        orgId = undefined;
      } else {
        if (!input.scopeTenantId) {
          return {
            ok: false,
            error: "Selecione uma organização (contexto) para criar utilizadores nesta conta.",
          };
        }
        orgId = input.scopeTenantId;
      }
      const u = normalizeLoginKey(sanitizeLoginInput(input.username));
      if (!isValidLoginUsername(sanitizeLoginInput(input.username))) {
        return { ok: false, error: "Login inválido: sem espaços nem vírgulas, até 80 caracteres." };
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
        ...(orgId ? { organizationId: orgId, hideFromPlatformList: true as const } : {}),
        ...(input.role === "user"
          ? {
              mustChangePassword: true as const,
              canManageBoard: input.canManageBoard === true,
              canDeleteBoardCards: input.canDeleteBoardCards === true,
              ...(allowedMod ? { allowedModules: allowedMod } : {}),
            }
          : { mustChangePassword: false as const }),
      };
      const nextReg = {
        ...registry,
        [u]: { password: input.password, user: newUser },
      };
      syncRegistry(nextReg);
      return { ok: true };
    },
    [user, registry, syncRegistry],
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
    (
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
    ): { ok: boolean; error?: string } => {
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
        if (patch.organizationId === null || patch.organizationId === "") {
          delete nextUser.organizationId;
        } else {
          nextUser.organizationId = patch.organizationId;
        }
        nextUser.hideFromPlatformList = false;
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
    [user, registry, syncRegistry],
  );

  const deleteUser = useCallback(
    (username: string, scopeTenantId: string | null): { ok: boolean; error?: string } => {
      if (!user || user.role !== "admin") return { ok: false, error: "Sem permissão." };
      const key = normalizeLoginKey(username);
      if (key === OWNER_USERNAME) return { ok: false, error: "A conta Administrador (owner) não pode ser excluída." };
      const entry = registry[key];
      if (!entry) return { ok: false, error: "Usuário não encontrado." };
      if (!actorCanManageTargetUser(user, entry.user, scopeTenantId)) {
        return { ok: false, error: "Sem permissão para excluir este utilizador." };
      }
      const rest = { ...registry };
      delete rest[key];
      syncRegistry(rest);
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
    [user, registry, syncRegistry],
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
      if (user.role === "admin") return true;
      return clientAssignments[clientId] === user.username;
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
