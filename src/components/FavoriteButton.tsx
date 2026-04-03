import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/contexts/FavoritesContext";

type Props = {
  id: string;
  kind: string;
  title: string;
  path: string;
  subtitle?: string;
  className?: string;
  size?: "sm" | "md";
};

/** Botão para favoritar/desfavoritar (não propaga clique no card pai) */
export function FavoriteButton({ id, kind, title, path, subtitle, className, size = "md" }: Props) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const on = isFavorite(id);
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite({ id, kind, title, path, subtitle });
      }}
      onKeyDown={(e) => e.stopPropagation()}
      className={cn(
        "rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-warning transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        on && "text-warning",
        className,
      )}
      aria-label={on ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      aria-pressed={on}
    >
      <Star className={cn(iconClass, on && "fill-warning text-warning")} />
    </button>
  );
}
