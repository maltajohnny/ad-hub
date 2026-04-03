import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatarDisplay } from "@/components/UserAvatarDisplay";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Star, LogOut, ChevronDown } from "lucide-react";

export const UserMenuDropdown = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-secondary/80 transition-colors max-w-[min(100%,220px)]"
          aria-label="Menu da conta"
        >
          <UserAvatarDisplay user={user} className="h-8 w-8 border border-border/50" iconSize={18} />
          <span className="truncate font-medium hidden sm:inline">{user.name}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground hidden sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => navigate("/configuracoes?tab=conta")}>
          <User className="mr-2 h-4 w-4" />
          Perfil
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/clientes/favoritos")}>
          <Star className="mr-2 h-4 w-4" />
          Favoritos
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout()} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
