import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";
import { Moon, Sun } from "lucide-react";

/** Toggle global: ativado = tema claro */
export const ThemeToggle = () => {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-9 w-[5.5rem] shrink-0" aria-hidden />;
  }

  const isLight = resolvedTheme === "light";

  return (
    <div className="flex items-center gap-2 sm:gap-2.5 shrink-0" title={isLight ? "Tema claro" : "Tema escuro"}>
      <Moon className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
      <Switch
        checked={isLight}
        onCheckedChange={(on) => setTheme(on ? "light" : "dark")}
        aria-label={isLight ? "Mudar para tema escuro" : "Mudar para tema claro"}
      />
      <Sun className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
    </div>
  );
};
