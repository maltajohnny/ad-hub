import { UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { User } from "@/contexts/AuthContext";

type Props = {
  user: User | null | undefined;
  className?: string;
  iconSize?: number;
};

/** Avatar customizado (data URL) ou padrão gradiente + ícone */
export function UserAvatarDisplay({ user, className, iconSize = 28 }: Props) {
  if (!user) return null;
  if (user.avatarDataUrl) {
    return (
      <img src={user.avatarDataUrl} alt="" className={cn("rounded-full object-cover", className)} />
    );
  }
  return (
    <div className={cn("rounded-full gradient-brand flex items-center justify-center shrink-0", className)}>
      <UserCircle size={iconSize} className="text-primary-foreground" />
    </div>
  );
}
