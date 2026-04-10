import type { AppModule } from "@/lib/saasTypes";

/** Perfil utilizador AD-Hub (antes só em AuthContext). */
export interface User {
  role: "admin" | "user";
  username: string;
  name: string;
  email: string;
  phone: string;
  document: string;
  avatarDataUrl?: string | null;
  canManageBoard?: boolean;
  canDeleteBoardCards?: boolean;
  mustChangePassword?: boolean;
  allowedModules?: AppModule[] | null;
  disabled?: boolean;
  organizationId?: string;
  hideFromPlatformList?: boolean;
}
