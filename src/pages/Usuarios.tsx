import { useState } from "react";
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
import { clientsData } from "@/pages/Clientes";
import { UsersRound, Trash2, Shield, User, Building2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { UserAvatarDisplay } from "@/components/UserAvatarDisplay";

const Usuarios = () => {
  const { user, listUsers, createUser, deleteUser, isOwner, clientAssignments, assignClientToUser } = useAuth();
  const rows = listUsers();
  const usersOnly = rows.filter((u) => u.role === "user");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isAdminRole, setIsAdminRole] = useState(false);

  const handleCreate = () => {
    const res = createUser({
      username,
      password,
      name,
      email,
      role: isAdminRole ? "admin" : "user",
    });
    if (!res.ok) {
      toast.error(res.error || "Não foi possível criar o usuário.");
      return;
    }
    toast.success("Usuário criado.");
    setUsername("");
    setPassword("");
    setName("");
    setEmail("");
    setIsAdminRole(false);
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
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-secondary/50 border-border/50 h-10"
            />
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
            onChange={(e) => setIsAdminRole(e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-sm text-muted-foreground">Conceder perfil de administrador</span>
        </label>
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
          Cada cliente pode ser atribuído a <strong className="text-foreground">apenas um</strong> usuário com perfil padrão.
          Administradores continuam vendo todos os clientes.
        </p>
        <div className="overflow-x-auto rounded-lg border border-border/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium min-w-[200px]">Atribuído a</th>
              </tr>
            </thead>
            <tbody>
              {clientsData.map((c) => {
                const assigned = clientAssignments[c.id] ?? "";
                return (
                  <tr key={c.id} className="border-b border-border/30 hover:bg-secondary/10">
                    <td className="px-3 py-2.5">
                      <span className="font-medium">{c.name}</span>
                      <span className="block text-[10px] text-muted-foreground">{c.segment}</span>
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={assigned || "none"}
                        onValueChange={(v) => {
                          const res = assignClientToUser(c.id, v === "none" ? null : v);
                          if (!res.ok) toast.error(res.error || "Não foi possível atualizar.");
                          else toast.success("Atribuição atualizada.");
                        }}
                      >
                        <SelectTrigger className="h-9 bg-secondary/50 border-border/50">
                          <SelectValue placeholder="Nenhum" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {usersOnly.map((u) => (
                            <SelectItem key={u.username} value={u.username}>
                              {u.name} (@{u.username})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
