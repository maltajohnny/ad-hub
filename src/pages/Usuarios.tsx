import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth, OWNER_USERNAME, type User } from "@/contexts/AuthContext";
import { Switch } from "@/components/ui/switch";
import { clientsData } from "@/pages/Clientes";
import { UsersRound, Trash2, Shield, User, Building2, Eye, EyeOff, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ModuleCheckboxLabel } from "@/components/ModuleCheckboxLabel";
import { APP_MODULES, type AppModule } from "@/lib/saasTypes";
import { Checkbox } from "@/components/ui/checkbox";
import { UserAvatarDisplay } from "@/components/UserAvatarDisplay";
import {
  isStrongPassword,
  PASSWORD_FIELD_INLINE_ALERT_CLASS,
  PASSWORD_INPUT_ERROR_GLOW_CLASS,
  STRONG_PASSWORD_HINT,
} from "@/lib/passwordPolicy";
import { sanitizeLoginInput } from "@/lib/loginUsername";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const Usuarios = () => {
  const {
    user,
    listUsers,
    createUser,
    deleteUser,
    isOwner,
    clientAssignments,
    assignClientToUser,
    setBoardSettingsPermission,
    setBoardDeleteCardsPermission,
    setUserAllowedModules,
    updateUserByAdmin,
  } = useAuth();
  const rows = listUsers();
  const usersOnly = rows.filter((u) => u.role === "user");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isAdminRole, setIsAdminRole] = useState(false);
  const [grantBoardSettings, setGrantBoardSettings] = useState(false);
  const [grantDeleteBoardCards, setGrantDeleteBoardCards] = useState(false);
  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [initialPasswordError, setInitialPasswordError] = useState(false);
  const [modCreate, setModCreate] = useState<Record<AppModule, boolean>>(
    () => Object.fromEntries(APP_MODULES.map((m) => [m, true])) as Record<AppModule, boolean>,
  );
  const [modEdit, setModEdit] = useState<Record<AppModule, boolean>>(
    () => Object.fromEntries(APP_MODULES.map((m) => [m, true])) as Record<AppModule, boolean>,
  );

  /** Utilizador (perfil padrão) para o qual se editam Negar/Permitir por cliente */
  const [permUser, setPermUser] = useState("");

  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDocument, setEditDocument] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "user">("user");
  const [editNewPassword, setEditNewPassword] = useState("");
  const [showEditPw, setShowEditPw] = useState(false);

  const openEdit = (u: User) => {
    setEditTarget(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPhone(u.phone ?? "");
    setEditDocument(u.document ?? "");
    setEditRole(u.role);
    setEditNewPassword("");
    setShowEditPw(false);
  };

  const saveEdit = () => {
    if (!editTarget) return;
    if (editNewPassword.trim() && !isStrongPassword(editNewPassword.trim())) {
      toast.error("A nova senha deve cumprir a política de senha forte.");
      return;
    }
    const res = updateUserByAdmin(editTarget.username, {
      name: editName,
      email: editEmail,
      phone: editPhone,
      document: editDocument,
      role: isOwner(editTarget.username) ? undefined : editRole,
      newPassword: editNewPassword.trim() ? editNewPassword.trim() : undefined,
    });
    if (!res.ok) {
      toast.error(res.error ?? "Não foi possível guardar.");
      return;
    }
    toast.success("Conta atualizada.");
    setEditTarget(null);
  };

  useEffect(() => {
    if (usersOnly.length === 0) {
      setPermUser("");
      return;
    }
    if (!permUser || !usersOnly.some((u) => u.username === permUser)) {
      setPermUser(usersOnly[0].username);
    }
  }, [usersOnly, permUser]);

  useEffect(() => {
    const u = usersOnly.find((x) => x.username === permUser);
    if (!u) return;
    if (!u.allowedModules?.length) {
      setModEdit(Object.fromEntries(APP_MODULES.map((m) => [m, true])) as Record<AppModule, boolean>);
    } else {
      setModEdit(
        Object.fromEntries(APP_MODULES.map((m) => [m, u.allowedModules!.includes(m)])) as Record<AppModule, boolean>,
      );
    }
  }, [permUser, usersOnly]);

  const handleInitialPasswordBlur = () => {
    const p = password.trim();
    if (p.length === 0) {
      setInitialPasswordError(false);
      return;
    }
    if (!isStrongPassword(p)) {
      setInitialPasswordError(true);
    } else {
      setInitialPasswordError(false);
    }
  };

  const handleCreate = () => {
    if (!isStrongPassword(password)) {
      setInitialPasswordError(true);
      return;
    }
    const mods = APP_MODULES.filter((m) => modCreate[m]);
    const res = createUser({
      username,
      password,
      name,
      email,
      role: isAdminRole ? "admin" : "user",
      canManageBoard: isAdminRole ? undefined : grantBoardSettings,
      canDeleteBoardCards: isAdminRole ? undefined : grantDeleteBoardCards,
      allowedModules:
        !isAdminRole && mods.length < APP_MODULES.length ? mods : undefined,
    });
    if (!res.ok) {
      toast.error(res.error || "Não foi possível criar o usuário.");
      return;
    }
    toast.success(
      isAdminRole ? "Administrador criado." : "Usuário criado. No primeiro acesso será pedida uma nova senha.",
    );
    setUsername("");
    setPassword("");
    setInitialPasswordError(false);
    setName("");
    setEmail("");
    setIsAdminRole(false);
    setGrantBoardSettings(false);
    setGrantDeleteBoardCards(false);
    setModCreate(Object.fromEntries(APP_MODULES.map((m) => [m, true])) as Record<AppModule, boolean>);
  };

  const handleDelete = (uname: string) => {
    const res = deleteUser(uname);
    if (!res.ok) {
      toast.error(res.error || "Não foi possível excluir.");
      return;
    }
    toast.success("Usuário removido.");
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-display font-bold">Usuários</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Crie logins com perfil de administrador ou usuário. Para perfil padrão, defina quais módulos do menu ficam visíveis.
        </p>
      </div>

      <Card className="glass-card p-5 border-border/60">
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
          <UsersRound size={18} className="text-primary" />
          Novo usuário
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Login</label>
            <Input
              value={username}
              onChange={(e) => setUsername(sanitizeLoginInput(e.target.value))}
              placeholder="ex.: maria.silva ou time@empresa"
              className="bg-secondary/50 border-border/50 h-10 font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Senha inicial</label>
            <div className="relative">
              <Input
                type={showInitialPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  const v = e.target.value;
                  setPassword(v);
                  if (v.trim() === "" || isStrongPassword(v)) setInitialPasswordError(false);
                }}
                onBlur={handleInitialPasswordBlur}
                className={cn(
                  "relative z-10 border-border/50 h-10 pr-10",
                  initialPasswordError ? "bg-secondary" : "bg-secondary/50",
                  initialPasswordError && PASSWORD_INPUT_ERROR_GLOW_CLASS,
                )}
                autoComplete="new-password"
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute right-3 top-1/2 z-20 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowInitialPassword((s) => !s)}
                aria-label={showInitialPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showInitialPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {initialPasswordError && (
              <p role="alert" className={PASSWORD_FIELD_INLINE_ALERT_CLASS}>
                {STRONG_PASSWORD_HINT}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Nome exibido</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary/50 border-border/50 h-10" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">E-mail</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-secondary/50 border-border/50 h-10"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 mt-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isAdminRole}
            onChange={(e) => {
              setIsAdminRole(e.target.checked);
              if (e.target.checked) {
                setGrantBoardSettings(false);
                setGrantDeleteBoardCards(false);
              }
            }}
            className="rounded border-border"
          />
          <span className="text-sm text-muted-foreground">Conceder perfil de administrador</span>
        </label>
        {!isAdminRole && (
          <>
            <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={grantBoardSettings}
                onChange={(e) => setGrantBoardSettings(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm text-muted-foreground">Permitir configurar Board Kanban (colunas e settings)</span>
            </label>
            <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={grantDeleteBoardCards}
                onChange={(e) => setGrantDeleteBoardCards(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm text-muted-foreground">Permitir excluir cards no Board</span>
            </label>
            <div className="mt-4 rounded-lg border border-border/50 p-3 space-y-2">
              <p className="text-xs font-medium text-foreground">Módulos visíveis no menu</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {APP_MODULES.map((m) => (
                  <label key={m} className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox
                      className="mt-0.5"
                      checked={modCreate[m]}
                      onCheckedChange={(c) => setModCreate((prev) => ({ ...prev, [m]: c === true }))}
                    />
                    <ModuleCheckboxLabel appModule={m} />
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
        <Button type="button" className="mt-4 gradient-brand text-primary-foreground" onClick={handleCreate}>
          Criar usuário
        </Button>
      </Card>

      {usersOnly.length > 0 && (
        <Card className="glass-card p-5 border-border/60">
          <h3 className="font-display font-semibold mb-2">Módulos do menu (utilizador existente)</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Selecione o utilizador e ajuste os módulos. Todos ativos = mesmo comportamento que antes (acesso completo).
          </p>
          <div className="mb-4 max-w-md space-y-1.5">
            <label className="text-xs text-muted-foreground">Utilizador</label>
            <Select value={permUser} onValueChange={setPermUser}>
              <SelectTrigger className="h-10 bg-secondary/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {usersOnly.map((u) => (
                  <SelectItem key={u.username} value={u.username}>
                    {u.name} (@{u.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid sm:grid-cols-2 gap-2 rounded-lg border border-border/50 p-3 mb-3">
            {APP_MODULES.map((m) => (
              <label key={m} className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  className="mt-0.5"
                  checked={modEdit[m]}
                  onCheckedChange={(c) => setModEdit((prev) => ({ ...prev, [m]: c === true }))}
                />
                <ModuleCheckboxLabel appModule={m} />
              </label>
            ))}
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const mods = APP_MODULES.filter((m) => modEdit[m]);
              const res = setUserAllowedModules(
                permUser,
                mods.length === APP_MODULES.length ? null : mods,
              );
              if (!res.ok) toast.error(res.error ?? "Erro");
              else toast.success("Módulos atualizados.");
            }}
          >
            Guardar módulos
          </Button>
        </Card>
      )}

      <Card className="glass-card p-5 border-border/60">
        <h3 className="font-display font-semibold mb-2 flex items-center gap-2">
          <Building2 size={18} className="text-primary" />
          Clientes por usuário
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Escolha o <strong className="text-foreground">utilizador (perfil padrão)</strong>. Para cada cliente, defina{" "}
          <strong className="text-foreground">Negar</strong> (sem acesso, predefinido) ou <strong className="text-foreground">Permitir</strong>{" "}
          (esse utilizador vê o cliente). Administradores continuam a ver todos os clientes.
        </p>

        {usersOnly.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Crie um utilizador com perfil padrão para gerir permissões por cliente.</p>
        ) : (
          <>
            <div className="mb-4 max-w-md space-y-1.5">
              <label className="text-xs text-muted-foreground">Utilizador</label>
              <Select value={permUser} onValueChange={setPermUser}>
                <SelectTrigger className="h-10 bg-secondary/50 border-border/50">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {usersOnly.map((u) => (
                    <SelectItem key={u.username} value={u.username}>
                      {u.name} (@{u.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border/50">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/30 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Cliente</th>
                    <th className="px-3 py-2 font-medium min-w-[180px]">Acesso</th>
                  </tr>
                </thead>
                <tbody>
                  {clientsData.map((c) => {
                    const assigned = clientAssignments[c.id] ?? null;
                    const mode = assigned === permUser ? "permitir" : "negar";
                    return (
                      <tr key={c.id} className="border-b border-border/30 hover:bg-secondary/10">
                        <td className="px-3 py-2.5">
                          <span className="font-medium">{c.name}</span>
                          <span className="block text-[10px] text-muted-foreground">{c.segment}</span>
                        </td>
                        <td className="px-3 py-2">
                          <Select
                            value={mode}
                            onValueChange={(v) => {
                              if (v === "permitir") {
                                const res = assignClientToUser(c.id, permUser);
                                if (!res.ok) toast.error(res.error || "Não foi possível atualizar.");
                                else toast.success("Permissão atualizada.");
                              } else {
                                if (assigned === permUser) {
                                  const res = assignClientToUser(c.id, null);
                                  if (!res.ok) toast.error(res.error || "Não foi possível atualizar.");
                                  else toast.success("Permissão atualizada.");
                                }
                              }
                            }}
                          >
                            <SelectTrigger className="h-9 bg-secondary/50 border-border/50">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="negar">Negar</SelectItem>
                              <SelectItem value="permitir">Permitir</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Card className="glass-card p-0 overflow-hidden border-border/60">
        <div className="px-5 py-3 border-b border-border/50 bg-secondary/20">
          <h3 className="font-display font-semibold text-sm">Contas cadastradas</h3>
        </div>
        <ul className="divide-y divide-border/40">
          {rows.map((u) => {
            const owner = isOwner(u.username);
            const isSelf = u.username === user?.username;
            return (
              <li key={u.username} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3 hover:bg-secondary/10">
                <UserAvatarDisplay user={u} className="h-10 w-10 shrink-0 border border-border/40" iconSize={22} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{u.name}</span>
                    <span className="text-xs text-muted-foreground">@{u.username}</span>
                    {u.role === "admin" ? (
                      <Badge variant="outline" className="text-[10px] gap-1 border-primary/40 text-primary">
                        <Shield className="h-3 w-3" />
                        Admin
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <User className="h-3 w-3" />
                        Usuário
                      </Badge>
                    )}
                    {owner && (
                      <Badge variant="outline" className="text-[10px] border-success/40 text-success">
                        Owner
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  {u.role === "user" && (
                    <div className="flex flex-col gap-2 mt-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`board-${u.username}`}
                          checked={u.canManageBoard === true}
                          onCheckedChange={(checked) => {
                            const res = setBoardSettingsPermission(u.username, checked);
                            if (!res.ok) toast.error(res.error || "Não foi possível atualizar.");
                            else toast.success(checked ? "Permissão de Board concedida." : "Permissão de Board revogada.");
                          }}
                        />
                        <label htmlFor={`board-${u.username}`} className="text-xs text-muted-foreground cursor-pointer">
                          Configurar Board (colunas)
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`board-del-${u.username}`}
                          checked={u.canDeleteBoardCards === true}
                          onCheckedChange={(checked) => {
                            const res = setBoardDeleteCardsPermission(u.username, checked);
                            if (!res.ok) toast.error(res.error || "Não foi possível atualizar.");
                            else
                              toast.success(
                                checked ? "Permissão para excluir cards concedida." : "Permissão para excluir cards revogada.",
                              );
                          }}
                        />
                        <label htmlFor={`board-del-${u.username}`} className="text-xs text-muted-foreground cursor-pointer">
                          Excluir cards no Board
                        </label>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    title="Editar dados da conta"
                    onClick={() => openEdit(u)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={owner}
                    title={owner ? "A conta Administrador (owner) não pode ser excluída" : undefined}
                    className={cn(
                      "text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0",
                      owner && "opacity-40",
                    )}
                    onClick={() => {
                      if (owner) return;
                      if (isSelf && !window.confirm("Excluir sua própria conta? Você será desconectado.")) return;
                      if (!isSelf && !window.confirm(`Excluir o usuário @${u.username}?`)) return;
                      handleDelete(u.username);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Dialog open={editTarget !== null} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar conta {editTarget ? `@${editTarget.username}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nome</Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">E-mail</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-phone">Telefone</Label>
                <Input id="edit-phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-doc">Documento</Label>
                <Input
                  id="edit-doc"
                  value={editDocument}
                  onChange={(e) => setEditDocument(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
            {editTarget && !isOwner(editTarget.username) ? (
              <div className="space-y-1.5">
                <Label>Perfil</Label>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as "admin" | "user")}>
                  <SelectTrigger className="h-10 bg-secondary/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="edit-pw">Nova senha (opcional)</Label>
              <div className="relative">
                <Input
                  id="edit-pw"
                  type={showEditPw ? "text" : "password"}
                  value={editNewPassword}
                  onChange={(e) => setEditNewPassword(e.target.value)}
                  placeholder="Deixe vazio para manter"
                  className="h-10 pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowEditPw((s) => !s)}
                >
                  {showEditPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">{STRONG_PASSWORD_HINT}</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
              Cancelar
            </Button>
            <Button type="button" className="gradient-brand text-primary-foreground" onClick={() => void saveEdit()}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-xs text-muted-foreground">
        O login <strong className="text-foreground">{OWNER_USERNAME}</strong> é a conta proprietária e não pode ser removida.
      </p>
    </div>
  );
};

export default Usuarios;
