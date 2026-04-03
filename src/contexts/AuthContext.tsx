import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";

export interface User {
  role: "admin" | "user";
  username: string;
  name: string;
  email: string;
  phone: string;
  document: string;
  /** Foto de perfil (data URL). `null` ou ausente = avatar padrão */
  avatarDataUrl?: string | null;
}

/** Conta proprietária — não pode ser excluída */
export const OWNER_USERNAME = "admin";

const STORAGE_KEY = "norter_user_registry";

type RegistryEntry = { password: string; user: User };

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
  /** Somente admins */
  listUsers: () => User[];
  createUser: (input: {
    username: string;
    password: string;
    name: string;
    email: string;
    role: "admin" | "user";
  }) => { ok: boolean; error?: string };
  deleteUser: (username: string) => { ok: boolean; error?: string };
  isOwner: (username: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [registry, setRegistry] = useState<Record<string, RegistryEntry>>(() => loadRegistry());
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

  const login = useCallback(
    (username: string, password: string) => {
      const key = username.trim();
      const entry = registry[key];
      if (entry && entry.password === password) {
        setUser(entry.user);
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
      if (!newPassword || newPassword.length < 4) return false;
      const nextReg = {
        ...registry,
        [user.username]: { ...entry, password: newPassword },
      };
      syncRegistry(nextReg);
      return true;
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
    }): { ok: boolean; error?: string } => {
      if (!user || user.role !== "admin") return { ok: false, error: "Sem permissão." };
      const u = input.username.trim().toLowerCase();
      if (!u || !/^[a-z0-9._-]+$/i.test(u)) return { ok: false, error: "Usuário inválido (use letras, números, . _ -)." };
      if (registry[u]) return { ok: false, error: "Este login já existe." };
      if (!input.password || input.password.length < 4) return { ok: false, error: "Senha muito curta (mín. 4 caracteres)." };
      const newUser: User = {
        username: u,
        name: input.name.trim() || u,
        email: input.email.trim(),
        phone: "",
        document: "",
        role: input.role,
        avatarDataUrl: null,
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

  const deleteUser = useCallback(
    (username: string): { ok: boolean; error?: string } => {
      if (!user || user.role !== "admin") return { ok: false, error: "Sem permissão." };
      const key = username.trim();
      if (key === OWNER_USERNAME) return { ok: false, error: "A conta Administrador (owner) não pode ser excluída." };
      if (!registry[key]) return { ok: false, error: "Usuário não encontrado." };
      const rest = { ...registry };
      delete rest[key];
      syncRegistry(rest);
      if (user.username === key) {
        setUser(null);
      }
      return { ok: true };
    },
    [user, registry, syncRegistry],
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
        listUsers,
        createUser,
        deleteUser,
        isOwner,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
