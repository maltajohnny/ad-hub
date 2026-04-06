import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import { isStrongPassword } from "@/lib/passwordPolicy";
import type { AppModule } from "@/lib/saasTypes";
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
  login: (username: string, password: string) => User | null;
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
  }) => { ok: boolean; error?: string };
  setUserAllowedModules: (username: string, modules: AppModule[] | null) => { ok: boolean; error?: string };
  deleteUser: (username: string) => { ok: boolean; error?: string };
  /** Admin: editar dados de qualquer conta (exceto rebaixar o owner). */
  updateUserByAdmin: (
    username: string,
    patch: {
      name?: string;
      email?: string;
      phone?: string;
      document?: string;
      role?: "admin" | "user";
      newPassword?: string;
    },
  ) => { ok: boolean; error?: string };
  /** Somente admin: concede/revoga permissão de Settings do Board (usuários não-admin). */
  setBoardSettingsPermission: (username: string, allowed: boolean) => { ok: boolean; error?: string };
  /** Somente admin: concede/revoga permissão de excluir cards no Board (usuários não-admin). */
  setBoardDeleteCardsPermission: (username: string, allowed: boolean) => { ok: boolean; error?: string };
  isOwner: (username: string) => boolean;
  /** Mapa clientId → username (só perfil user). Admins ignoram para visualização. */
  clientAssignments: ClientAssignmentMap;
  assignClientToUser: (clientId: number, username: string | null) => { ok: boolean; error?: string };
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

  /** Mantém a sessão alinhada ao registo (ex.: `mustChangePassword` após refresh). */
  useEffect(() => {
    setUser((prev) => {
      if (!prev) return prev;
      const entry = registry[prev.username];
      if (!entry) return prev;
      return { ...entry.user };
    });
  }, [registry]);

  const login = useCallback(
    (username: string, password: string): User | null => {
      const key = username.trim().toLowerCase();
      const entry = registry[key];
      if (entry && entry.password === password) {
        const u = { ...entry.user };
        setUser(u);
        return u;
      }
      return null;
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
    (username: string, modules: AppModule[] | null): { ok: boolean; error?: string } => {
      if (!user || user.role !== "admin") return { ok: false, error: "Sem permissão." };
      const key = normalizeLoginKey(username);
      const entry = registry[key];
      if (!entry) return { ok: false, error: "Usuário não encontrado." };
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
    }): { ok: boolean; error?: string } => {
      if (!user || user.role !== "admin") return { ok: false, error: "Sem permissão." };
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
    (username: string, allowed: boolean): { ok: boolean; error?: string } => {
      if (!user || user.role !== "admin") return { ok: false, error: "Sem permissão." };
      const key = normalizeLoginKey(username);
      const entry = registry[key];
      if (!entry) return { ok: false, error: "Usuário não encontrado." };
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
    (username: string, allowed: boolean): { ok: boolean; error?: string } => {
      if (!user || user.role !== "admin") return { ok: false, error: "Sem permissão." };
      const key = username.trim();
      const entry = registry[key];
      if (!entry) return { ok: false, error: "Usuário não encontrado." };
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
        name?: string;
        email?: string;
        phone?: string;
        document?: string;
        role?: "admin" | "user";
        newPassword?: string;
      },
    ): { ok: boolean; error?: string } => {
      if (!user || user.role !== "admin") return { ok: false, error: "Sem permissão." };
      const key = normalizeLoginKey(username);
      const entry = registry[key];
      if (!entry) return { ok: false, error: "Usuário não encontrado." };
      if (key === OWNER_USERNAME && patch.role === "user") {
        return { ok: false, error: "A conta proprietária deve permanecer como administrador." };
      }

      let nextUser: User = { ...entry.user };
      if (patch.name !== undefined) nextUser.name = patch.name.trim() || nextUser.username;
      if (patch.email !== undefined) nextUser.email = patch.email.trim();
      if (patch.phone !== undefined) nextUser.phone = patch.phone.trim();
      if (patch.document !== undefined) nextUser.document = patch.document.trim();

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

      const nextReg = {
        ...registry,
        [key]: { ...entry, password: nextPassword, user: nextUser },
      };
      syncRegistry(nextReg);
      if (user.username === key) setUser(nextUser);
      return { ok: true };
    },
    [user, registry, syncRegistry],
  );

  const deleteUser = useCallback(
    (username: string): { ok: boolean; error?: string } => {
      if (!user || user.role !== "admin") return { ok: false, error: "Sem permissão." };
      const key = normalizeLoginKey(username);
      if (key === OWNER_USERNAME) return { ok: false, error: "A conta Administrador (owner) não pode ser excluída." };
      if (!registry[key]) return { ok: false, error: "Usuário não encontrado." };
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
    (clientId: number, username: string | null): { ok: boolean; error?: string } => {
      if (!user || user.role !== "admin") return { ok: false, error: "Sem permissão." };
      if (username !== null) {
        const target = registry[username];
        if (!target) return { ok: false, error: "Usuário não encontrado." };
        if (target.user.role !== "user") return { ok: false, error: "Atribua apenas a usuários com perfil padrão (não admin)." };
      }
      setClientAssignments((prev) => {
        const next = { ...prev };
        if (username === null) {
          delete next[clientId];
        } else {
          next[clientId] = username;
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
