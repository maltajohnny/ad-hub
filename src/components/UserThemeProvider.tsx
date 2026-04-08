import { ThemeProvider } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeLoginKey } from "@/lib/loginUsername";

/**
 * Cada sessão guarda o tema no localStorage com chave própria, para não misturar
 * preferências entre contas (ex.: admin em claro vs utilizador em escuro).
 */
export function UserThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const storageKey = user ? `norter-theme-${normalizeLoginKey(user.username)}` : "norter-theme-session";

  return (
    <ThemeProvider
      key={storageKey}
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey={storageKey}
    >
      {children}
    </ThemeProvider>
  );
}
