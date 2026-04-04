import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import { isStrongPassword } from "@/lib/passwordPolicy";

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
  /** Conta criada por admin: obriga troca de senha no primeiro acesso. */
  mustChangePassword?: boolean;
}

/** Quem pode gerir colunas e settings do Kanban (admin ou permissão explícita). */
export function canManageKanbanBoard(u: User | null | undefined): boolean {
  if (!u) return false;
  if (u.role === "admin") return true;
  return u.canManageBoard === true;
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
  login: (username: string, password: string) => boolean;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
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
  }) => { ok: boolean; error?: string };
  deleteUser: (username: string) => { ok: boolean; error?: string };
  /** Somente admin: concede/revoga permissão de Settings do Board (usuários não-admin). */
  setBoardSettingsPermission: (username: string, allowed: boolean) => { ok: boolean; error?: string };
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
    (username: string, password: string) => {
      const key = username.trim().toLowerCase();
      const entry = registry[key];
      if (entry && entry.password === password) {
        setUser({ ...entry.user });
        return true;
      }
      return false;
    },
    [registry],
  );

  const logout = () => setUser(null);

  const updateProfile = useCallback(
    (data: Partial<User>) => {
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

  const createUser = useCallback(
    (input: {
      username: string;
      password: string;
      name: string;
      email: string;
      role: "admin" | "user";
      canManageBoard?: boolean;
    }): { ok: boolean; error?: string } => {
      if (!user || user.role !== "admin") return { ok: false, error: "Sem permissão." };
      const u = input.username.trim().toLowerCase();
      if (!u || !/^[a-z0-9._-]+$/i.test(u)) return { ok: false, error: "Usuário inválido (use letras, números, . _ -)." };
      if (registry[u]) return { ok: false, error: "Este login já existe." };
      if (!isStrongPassword(input.password)) {
        return {
          ok: false,
          error: "Senha inicial inválida: mínimo 6 caracteres, com maiúscula, minúscula e caractere especial.",
        };
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
          ? { mustChangePassword: true as const, canManageBoard: input.canManageBoard === true }
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
      const key = username.trim();
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

  const deleteUser = useCallback(
    (username: string): { ok: boolean; error?: string } => {
      if (!user || user.role !== "admin") return { ok: false, error: "Sem permissão." };
      const key = username.trim();
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
        changePassword,
        completeFirstPasswordChange,
        listUsers,
        createUser,
        deleteUser,
        setBoardSettingsPermission,
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
