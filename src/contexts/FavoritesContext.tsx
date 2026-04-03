import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

export type FavoriteItem = {
  id: string;
  kind: string;
  title: string;
  path: string;
  subtitle?: string;
  addedAt: number;
};

type FavoritesContextType = {
  favorites: FavoriteItem[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (entry: Omit<FavoriteItem, "addedAt">) => void;
  removeFavorite: (id: string) => void;
};

const FavoritesContext = createContext<FavoritesContextType | null>(null);

function storageKey(username: string) {
  return `norter_favorites_${username}`;
}

function load(username: string): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(storageKey(username));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FavoriteItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const FavoritesProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    if (!user) {
      setFavorites([]);
      return;
    }
    setFavorites(load(user.username));
  }, [user?.username]);

  const isFavorite = useCallback(
    (id: string) => favorites.some((f) => f.id === id),
    [favorites],
  );

  const toggleFavorite = useCallback(
    (entry: Omit<FavoriteItem, "addedAt">) => {
      if (!user) return;
      setFavorites((prev) => {
        const exists = prev.some((f) => f.id === entry.id);
        const next = exists
          ? prev.filter((f) => f.id !== entry.id)
          : [...prev, { ...entry, addedAt: Date.now() }].sort((a, b) => b.addedAt - a.addedAt);
        localStorage.setItem(storageKey(user.username), JSON.stringify(next));
        return next;
      });
    },
    [user],
  );

  const removeFavorite = useCallback(
    (id: string) => {
      if (!user) return;
      setFavorites((prev) => {
        const next = prev.filter((f) => f.id !== id);
        localStorage.setItem(storageKey(user.username), JSON.stringify(next));
        return next;
      });
    },
    [user],
  );

  const value = useMemo(
    () => ({ favorites, isFavorite, toggleFavorite, removeFavorite }),
    [favorites, isFavorite, toggleFavorite, removeFavorite],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
};

export const useFavorites = () => {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
};
