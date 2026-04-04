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
import { useAuth, OWNER_USERNAME } from "@/contexts/AuthContext";
import { Switch } from "@/components/ui/switch";
import { clientsData } from "@/pages/Clientes";
import { UsersRound, Trash2, Shield, User, Building2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { UserAvatarDisplay } from "@/components/UserAvatarDisplay";
import {
  isStrongPassword,
  PASSWORD_FIELD_INLINE_ALERT_CLASS,
  PASSWORD_INPUT_ERROR_GLOW_CLASS,
  STRONG_PASSWORD_HINT,
} from "@/lib/passwordPolicy";

const Usuarios = () => {
  const { user, listUsers, createUser, deleteUser, isOwner, clientAssignments, assignClientToUser, setBoardSettingsPermission } =
    useAuth();
  const rows = listUsers();
  const usersOnly = rows.filter((u) => u.role === "user");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isAdminRole, setIsAdminRole] = useState(false);
  const [grantBoardSettings, setGrantBoardSettings] = useState(false);
  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [initialPasswordError, setInitialPasswordError] = useState(false);

  /** Utilizador (perfil padrão) para o qual se editam Negar/Permitir por cliente */
  const [permUser, setPermUser] = useState("");

  useEffect(() => {
    if (usersOnly.length === 0) {
      setPermUser("");
      return;
    }
    if (!permUser || !usersOnly.some((u) => u.username === permUser)) {
      setPermUser(usersOnly[0].username);
    }
  }, [usersOnly, permUser]);

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
    const res = createUser({
      username,
      password,
      name,
      email,
      role: isAdminRole ? "admin" : "user",
      canManageBoard: isAdminRole ? undefined : grantBoardSettings,
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
          Crie logins com perfil de administrador ou usuário. Usuários sem privilégio de admin terão acesso limitado (definido
          em breve).
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
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex.: maria.silva"
              className="bg-secondary/50 border-border/50 h-10"
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
              if (e.target.checked) setGrantBoardSettings(false);
            }}
            className="rounded border-border"
          />
          <span className="text-sm text-muted-foreground">Conceder perfil de administrador</span>
        </label>
        {!isAdminRole && (
          <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={grantBoardSettings}
              onChange={(e) => setGrantBoardSettings(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm text-muted-foreground">Permitir configurar Board Kanban (colunas e settings)</span>
          </label>
        )}
        <Button type="button" className="mt-4 gradient-brand text-primary-foreground" onClick={handleCreate}>
          Criar usuário
        </Button>
      </Card>

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
                    <div className="flex items-center gap-2 mt-2">
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
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={owner}
                  title={owner ? "A conta Administrador (owner) não pode ser excluída" : undefined}
                  className={cn("text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0", owner && "opacity-40")}
                  onClick={() => {
                    if (owner) return;
                    if (isSelf && !window.confirm("Excluir sua própria conta? Você será desconectado.")) return;
                    if (!isSelf && !window.confirm(`Excluir o usuário @${u.username}?`)) return;
                    handleDelete(u.username);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      </Card>

      <p className="text-xs text-muted-foreground">
        O login <strong className="text-foreground">{OWNER_USERNAME}</strong> é a conta proprietária e não pode ser removida.
      </p>
    </div>
  );
};

export default Usuarios;
