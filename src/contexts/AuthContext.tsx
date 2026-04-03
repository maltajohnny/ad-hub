import { createContext, useContext, useState, ReactNode, useEffect } from "react";

interface User {
  role: "admin" | "user";
  username: string;
  name: string;
  email: string;
  phone: string;
  document: string;
}

const USERS: Record<string, { password: string; user: User }> = {
  admin: {
    password: "p4p43lgu4$",
    user: { role: "admin", username: "admin", name: "Administrador", email: "admin@norter.com", phone: "(11) 99999-0000", document: "000.000.000-00" },
  },
  norter: {
    password: "N0rt3r@26",
    user: { role: "user", username: "norter", name: "Norter User", email: "contato@norter.com", phone: "(11) 98888-0000", document: "111.111.111-11" },
  },
};

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = sessionStorage.getItem("norter_user");
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (user) sessionStorage.setItem("norter_user", JSON.stringify(user));
    else sessionStorage.removeItem("norter_user");
  }, [user]);

  const login = (username: string, password: string) => {
    const entry = USERS[username];
    if (entry && entry.password === password) {
      setUser(entry.user);
      return true;
    }
    return false;
  };

  const logout = () => setUser(null);

  const updateProfile = (data: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...data } : null));
  };

  return <AuthContext.Provider value={{ user, login, logout, updateProfile }}>{children}</AuthContext.Provider>;
};
