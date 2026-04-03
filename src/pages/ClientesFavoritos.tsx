import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/contexts/FavoritesContext";
import { Star, Trash2, ExternalLink } from "lucide-react";

const ClientesFavoritos = () => {
  const { favorites, removeFavorite } = useFavorites();

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Clientes</p>
        <h1 className="text-2xl font-display font-bold">Favoritos</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Atalhos salvos por você. Use a estrela nos cards e telas para adicionar itens aqui.
        </p>
      </div>

      {favorites.length === 0 ? (
        <Card className="glass-card p-8 text-center text-muted-foreground text-sm">
          <Star className="h-10 w-10 mx-auto mb-3 opacity-40" />
          Nenhum favorito ainda. Clique na estrela no canto dos cards em Clientes, Dashboard e outras telas.
        </Card>
      ) : (
        <ul className="space-y-2">
          {favorites.map((f) => (
            <li key={f.id}>
              <Card className="glass-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-warning shrink-0 fill-warning" />
                    <span className="font-medium truncate">{f.title}</span>
                  </div>
                  {f.subtitle && <p className="text-xs text-muted-foreground mt-1 truncate">{f.subtitle}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1 font-mono truncate">{f.path}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="secondary" size="sm" asChild>
                    <Link to={f.path}>
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      Abrir
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeFavorite(f.id)}
                    aria-label="Remover dos favoritos"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ClientesFavoritos;
