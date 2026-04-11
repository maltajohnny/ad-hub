import { useEffect, useMemo, useState } from "react";
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
import { useTenant } from "@/contexts/TenantContext";
import { listTenants, getTenantById, BUILTIN_NORTER_ID } from "@/lib/tenantsStore";
import { Switch } from "@/components/ui/switch";
import { clientsData } from "@/pages/Clientes";
import { UsersRound, Trash2, Shield, User, Building2, Eye, EyeOff, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn, isPlausibleEmail } from "@/lib/utils";
import { ModuleCheckboxLabel } from "@/components/ModuleCheckboxLabel";
import { APP_MODULES, type AppModule, isPlatformOperator } from "@/lib/saasTypes";
import { Checkbox } from "@/components/ui/checkbox";
import { UserAvatarDisplay } from "@/components/UserAvatarDisplay";
import {
  isStrongPassword,
  PASSWORD_FIELD_INLINE_ALERT_CLASS,
  PASSWORD_INPUT_ERROR_GLOW_CLASS,
  STRONG_PASSWORD_HINT,
} from "@/lib/passwordPolicy";
import { isValidLoginUsername, normalizeLoginKey, sanitizeLoginInput } from "@/lib/loginUsername";
import { buildOrgScopedLogin } from "@/lib/orgScopedLogin";
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
  const { tenant } = useTenant();
  const scopeTenantId = tenant?.id ?? null;
  const platformOp = isPlatformOperator(user?.username);

  /** Carteira de clientes da app é da org Norter; operadores AD-Hub só gerem organizações/contas, não esta tabela. */
  const showNorterClientAssignments =
    user?.role === "admin" && !platformOp && user.organizationId === BUILTIN_NORTER_ID;

  const rows = useMemo(() => {
    const all = listUsers();
    if (!user || user.role !== "admin") return [];
    if (platformOp) {
      return all.filter((u) => !u.hideFromPlatformList);
    }
    if (!scopeTenantId) return [];
    return all.filter(
      (u) =>
        u.organizationId === scopeTenantId ||
        normalizeLoginKey(u.username) === normalizeLoginKey(user.username),
    );
  }, [listUsers, user, platformOp, scopeTenantId]);

  const usersOnly = useMemo(() => rows.filter((u) => u.role === "user"), [rows]);

  /** Operador da plataforma: escolher organização para listar apenas utilizadores dessa org nos módulos. */
  const [modulesOrgScopeId, setModulesOrgScopeId] = useState<string>(() => listTenants()[0]?.id ?? "");

  const usersOnlyForModules = useMemo(() => {
    if (!platformOp) return usersOnly;
    if (!modulesOrgScopeId) return [];
    return listUsers().filter(
      (u) =>
        u.role === "user" &&
        !u.hideFromPlatformList &&
        u.organizationId === modulesOrgScopeId,
    );
  }, [platformOp, modulesOrgScopeId, usersOnly, listUsers]);

  /** Lista usada no cartão «Módulos do menu»: por org para operador da plataforma; caso contrário igual a `usersOnly`. */
  const userListForModules = platformOp ? usersOnlyForModules : usersOnly;

  const [username, setUsername] = useState("");
  /** Só para operador da plataforma: organização obrigatória do novo utilizador. */
  const [createOrganizationId, setCreateOrganizationId] = useState<string>(() => listTenants()[0]?.id ?? "");
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
  const [editUsername, setEditUsername] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDocument, setEditDocument] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "user">("user");
  const [editDisabled, setEditDisabled] = useState(false);
  const [editNewPassword, setEditNewPassword] = useState("");
  const [showEditPw, setShowEditPw] = useState(false);
  /** `__none__` = sem organização (conta plataforma) */
  const [editOrganizationId, setEditOrganizationId] = useState<string>("__none__");
  const createOrgId = platformOp ? createOrganizationId || null : scopeTenantId;
  const createOrgSlug = createOrgId ? getTenantById(createOrgId)?.slug ?? null : null;

  const stripOrgSuffix = (login: string) => {
    const t = sanitizeLoginInput(login).trim().toLowerCase();
    const dot = t.lastIndexOf(".");
    if (dot <= 0) return t;
    return t.slice(0, dot);
  };

  const openEdit = (u: User) => {
    setEditTarget(u);
    setEditUsername(u.organizationId ? stripOrgSuffix(u.username) : u.username);
    setEditOrganizationId(u.organizationId ?? "__none__");
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPhone(u.phone ?? "");
    setEditDocument(u.document ?? "");
    setEditRole(u.role);
    setEditDisabled(!!u.disabled);
    setEditNewPassword("");
    setShowEditPw(false);
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    if (editNewPassword.trim() && !isStrongPassword(editNewPassword.trim())) {
      toast.error("A nova senha deve cumprir a política de senha forte.");
      return;
    }
    const rawLogin = sanitizeLoginInput(editUsername);
    const editOrgId = platformOp
      ? editOrganizationId !== "__none__"
        ? editOrganizationId
        : null
      : (editTarget.organizationId ?? scopeTenantId);
    const editOrgSlug = editOrgId ? getTenantById(editOrgId)?.slug ?? null : null;
    const nextLogin = editOrgSlug ? (buildOrgScopedLogin(rawLogin, editOrgSlug) ?? "") : rawLogin;
    const owner = isOwner(editTarget.username);
    if (!owner) {
      if (!isValidLoginUsername(rawLogin)) {
        toast.error("Login inválido: sem espaços nem vírgulas, até 80 caracteres.");
        return;
      }
      if (normalizeLoginKey(nextLogin) !== normalizeLoginKey(editTarget.username) && !nextLogin) {
        toast.error("Indique um login válido.");
        return;
      }
    }
    const loginChanged = !owner && normalizeLoginKey(nextLogin) !== normalizeLoginKey(editTarget.username);
    const res = await updateUserByAdmin(
      editTarget.username,
      {
        ...(loginChanged ? { newUsername: nextLogin } : {}),
        name: editName,
        email: editEmail,
        phone: editPhone,
        document: editDocument,
        role: owner ? undefined : editRole,
        newPassword: editNewPassword.trim() ? editNewPassword.trim() : undefined,
        ...(!owner ? { disabled: editDisabled } : {}),
        ...(platformOp && !owner
          ? {
              organizationId: editOrganizationId === "__none__" ? null : editOrganizationId,
            }
          : {}),
      },
      platformOp ? null : scopeTenantId,
    );
    if (!res.ok) {
      toast.error(res.error ?? "Não foi possível salvar.");
      return;
    }
    toast.success("Conta atualizada.");
    setEditTarget(null);
  };

  useEffect(() => {
    if (userListForModules.length === 0) {
      setPermUser("");
      return;
    }
    if (!permUser || !userListForModules.some((u) => u.username === permUser)) {
      setPermUser(userListForModules[0].username);
    }
  }, [userListForModules, permUser]);

  useEffect(() => {
    const u = userListForModules.find((x) => x.username === permUser);
    if (!u) return;
    if (!u.allowedModules?.length) {
      setModEdit(Object.fromEntries(APP_MODULES.map((m) => [m, true])) as Record<AppModule, boolean>);
    } else {
      setModEdit(
        Object.fromEntries(APP_MODULES.map((m) => [m, u.allowedModules!.includes(m)])) as Record<AppModule, boolean>,
      );
    }
  }, [permUser, userListForModules]);

  const createCanSubmit = useMemo(() => {
    const rawLogin = sanitizeLoginInput(username).trim();
    if (!rawLogin || !isValidLoginUsername(rawLogin)) return false;
    if (!name.trim()) return false;
    if (!email.trim() || !isPlausibleEmail(email)) return false;
    if (!isStrongPassword(password)) return false;
    if (platformOp) {
      if (!createOrganizationId) return false;
    } else if (!scopeTenantId) {
      return false;
    }
    return true;
  }, [
    username,
    name,
    email,
    password,
    platformOp,
    createOrganizationId,
    scopeTenantId,
  ]);

  const editCanSubmit = useMemo(() => {
    if (!editTarget) return false;
    if (!editName.trim() || !isPlausibleEmail(editEmail)) return false;
    const pw = editNewPassword.trim();
    if (pw && !isStrongPassword(pw)) return false;
    const owner = isOwner(editTarget.username);
    if (owner) return true;
    const rawLogin = sanitizeLoginInput(editUsername).trim();
    if (!isValidLoginUsername(rawLogin)) return false;
    const editOrgId = platformOp
      ? editOrganizationId !== "__none__"
        ? editOrganizationId
        : null
      : (editTarget.organizationId ?? scopeTenantId);
    const editOrgSlug = editOrgId ? getTenantById(editOrgId)?.slug ?? null : null;
    const nextLogin = editOrgSlug ? (buildOrgScopedLogin(rawLogin, editOrgSlug) ?? "") : rawLogin;
    if (normalizeLoginKey(nextLogin) !== normalizeLoginKey(editTarget.username) && !nextLogin) return false;
    return true;
  }, [
    editTarget,
    editName,
    editEmail,
    editNewPassword,
    editUsername,
    editOrganizationId,
    platformOp,
    scopeTenantId,
  ]);

  /** Só permitir gravar quando algo mudou em relação ao estado ao abrir o diálogo. */
  const editIsDirty = useMemo(() => {
    if (!editTarget) return false;
    if (editNewPassword.trim() !== "") return true;
    if (editName.trim() !== editTarget.name) return true;
    if (editEmail.trim() !== editTarget.email) return true;
    if ((editPhone ?? "").trim() !== (editTarget.phone ?? "").trim()) return true;
    if ((editDocument ?? "").trim() !== (editTarget.document ?? "").trim()) return true;
    if (isOwner(editTarget.username)) return false;
    if (editRole !== editTarget.role) return true;
    if (!!editDisabled !== !!editTarget.disabled) return true;
    const rawLogin = sanitizeLoginInput(editUsername).trim();
    const editOrgId = platformOp
      ? editOrganizationId !== "__none__"
        ? editOrganizationId
        : null
      : (editTarget.organizationId ?? scopeTenantId);
    const editOrgSlug = editOrgId ? getTenantById(editOrgId)?.slug ?? null : null;
    const nextLogin = editOrgSlug ? (buildOrgScopedLogin(rawLogin, editOrgSlug) ?? "") : rawLogin;
    if (normalizeLoginKey(nextLogin) !== normalizeLoginKey(editTarget.username)) return true;
    if (platformOp) {
      const prevOrg = editTarget.organizationId ?? null;
      const nextOrg = editOrganizationId === "__none__" ? null : editOrganizationId;
      if (nextOrg !== prevOrg) return true;
    }
    return false;
  }, [
    editTarget,
    editName,
    editEmail,
    editPhone,
    editDocument,
    editRole,
    editDisabled,
    editUsername,
    editOrganizationId,
    editNewPassword,
    platformOp,
    scopeTenantId,
  ]);

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

  const handleCreate = async () => {
    if (!username.trim()) {
      toast.error("Informe o nome de utilizador.");
      return;
    }
    if (!name.trim()) {
      toast.error("Informe o nome exibido do usuário.");
      return;
    }
    if (!password.trim()) {
      toast.error("Informe a senha inicial.");
      return;
    }
    if (!isStrongPassword(password)) {
      setInitialPasswordError(true);
      return;
    }
    if (!email.trim()) {
      toast.error("Informe o e-mail do usuário.");
      return;
    }
    if (platformOp && createOrganizationId === "__none__") {
      toast.error("Selecione a organização do novo utilizador.");
      return;
    }
    if (!platformOp && !scopeTenantId) {
      toast.error("Selecione uma organização no contexto da plataforma para criar utilizadores.");
      return;
    }
    const mods = APP_MODULES.filter((m) => modCreate[m]);
    const res = await createUser({
      username,
      password,
      name,
      email,
      role: isAdminRole ? "admin" : "user",
      canManageBoard: isAdminRole ? undefined : grantBoardSettings,
      canDeleteBoardCards: isAdminRole ? undefined : grantDeleteBoardCards,
      allowedModules:
        !isAdminRole && mods.length < APP_MODULES.length ? mods : undefined,
      scopeTenantId: platformOp ? createOrganizationId || null : scopeTenantId,
    });
    if (!res.ok) {
      toast.error(res.error || "Não foi possível criar o usuário.");
      return;
    }
    if (res.savedLocalOnly) {
      toast.warning("Utilizador guardado só neste navegador", {
        description:
          "O servidor de contas (MySQL + API) não está ativo para esta sessão, por isso nada foi gravado na base de dados. Confirme /api/ad-hub/auth/ping (db e jwt_ready), o processo Go e a tabela users (001_adhub_core.sql).",
        duration: 12_000,
      });
    } else {
      toast.success(
        isAdminRole ? "Administrador criado." : "Usuário criado. No primeiro acesso será pedida uma nova senha.",
      );
    }
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

  const handleDelete = async (uname: string) => {
    const res = await deleteUser(uname, platformOp ? null : scopeTenantId);
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
        {!platformOp && user?.role === "admin" && !scopeTenantId && (
          <p className="text-sm text-amber-700 dark:text-amber-400/90 mt-2">
            Escolha uma organização no contexto da aplicação (menu lateral / organização ativa) para gerir ou criar
            utilizadores desta organização.
          </p>
        )}
      </div>

      <Card className="glass-card p-5 border-border/60">
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
          <UsersRound size={18} className="text-primary" />
          Novo usuário
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {platformOp && (
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs text-muted-foreground">
                Organização do novo utilizador <span className="text-destructive">*</span>
              </label>
              <Select value={createOrganizationId} onValueChange={setCreateOrganizationId}>
                <SelectTrigger className="h-10 bg-secondary/50 border-border/50">
                  <SelectValue placeholder="Organização" />
                </SelectTrigger>
                <SelectContent>
                  {listTenants().map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">
              {platformOp ? "Nome de utilizador (sem sufixo)" : "Nome de utilizador"}{" "}
              <span className="text-destructive">*</span>
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(sanitizeLoginInput(e.target.value))}
              placeholder={
                createOrgSlug ? "ex.: diego" : "ex.: maria ou maria.empresa"
              }
              className="bg-secondary/50 border-border/50 h-10 font-mono text-sm"
            />
            {createOrgSlug && username.trim() ? (
              <p className="text-[11px] text-muted-foreground">
                Login de acesso automático:{" "}
                <span className="font-mono text-foreground">
                  {buildOrgScopedLogin(username, createOrgSlug) ?? "…"}
                </span>
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">
              Senha inicial <span className="text-destructive">*</span>
            </label>
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
            <label className="text-xs text-muted-foreground">
              Nome exibido <span className="text-destructive">*</span>
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary/50 border-border/50 h-10" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">
              E-mail <span className="text-destructive">*</span>
            </label>
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
        <Button
          type="button"
          className="mt-4 gradient-brand text-primary-foreground"
          disabled={!createCanSubmit}
          onClick={handleCreate}
        >
          Criar usuário
        </Button>
      </Card>

      {userListForModules.length > 0 && (
        <Card className="glass-card p-5 border-border/60">
          <h3 className="font-display font-semibold mb-2">Módulos do menu (utilizador existente)</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Selecione a organização (operador da plataforma), depois o utilizador e ajuste os módulos. Todos ativos = mesmo
            comportamento que antes (acesso completo). Cada organização só vê as suas contas.
          </p>
          {platformOp && (
            <div className="mb-4 max-w-md space-y-1.5">
              <Label className="text-xs text-muted-foreground">Organização</Label>
              <Select value={modulesOrgScopeId} onValueChange={setModulesOrgScopeId}>
                <SelectTrigger className="h-10 bg-secondary/50 border-border/50">
                  <SelectValue placeholder="Selecionar organização" />
                </SelectTrigger>
                <SelectContent>
                  {listTenants().map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="mb-4 max-w-md space-y-1.5">
            <label className="text-xs text-muted-foreground">Utilizador</label>
            <Select value={permUser} onValueChange={setPermUser}>
              <SelectTrigger className="h-10 bg-secondary/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {userListForModules.map((u) => (
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
                platformOp ? null : scopeTenantId,
              );
              if (!res.ok) toast.error(res.error ?? "Erro");
              else toast.success("Módulos atualizados.");
            }}
          >
            Salvar módulos
          </Button>
        </Card>
      )}

      {showNorterClientAssignments && (
        <Card className="glass-card p-5 border-border/60">
          <h3 className="font-display font-semibold mb-2 flex items-center gap-2">
            <Building2 size={18} className="text-primary" />
            Clientes por usuário
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Escolha o <strong className="text-foreground">utilizador (perfil padrão)</strong>. Para cada cliente, defina{" "}
            <strong className="text-foreground">Negar</strong> (sem acesso, predefinido) ou <strong className="text-foreground">Permitir</strong>{" "}
            (esse utilizador vê o cliente na sua conta Norter). Administradores da organização não usam esta tabela para o próprio acesso.
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
                                  const res = assignClientToUser(
                                    c.id,
                                    permUser,
                                    platformOp ? null : scopeTenantId,
                                  );
                                  if (!res.ok) toast.error(res.error || "Não foi possível atualizar.");
                                  else toast.success("Permissão atualizada.");
                                } else {
                                  if (assigned === permUser) {
                                    const res = assignClientToUser(
                                      c.id,
                                      null,
                                      platformOp ? null : scopeTenantId,
                                    );
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
      )}

      <Card className="glass-card p-0 overflow-hidden border-border/60">
        <div className="px-5 py-3 border-b border-border/50 bg-secondary/20">
          <h3 className="font-display font-semibold text-sm">Contas cadastradas</h3>
        </div>
        <ul className="divide-y divide-border/40">
          {rows.map((u) => {
            const owner = isOwner(u.username);
            const isSelf = u.username === user?.username;
            return (
              <li
                key={u.username}
                className="flex gap-4 px-5 py-4 hover:bg-secondary/10 items-stretch"
              >
                <div className="shrink-0 self-center">
                  <UserAvatarDisplay
                    user={u}
                    className="h-16 w-16 border border-border/40"
                    iconSize={36}
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="min-w-0 space-y-1">
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
                      {u.disabled && (
                        <Badge variant="outline" className="text-[10px] border-muted-foreground/50 text-muted-foreground">
                          Desativado
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    {u.organizationId ? (
                      <p className="text-[10px] text-muted-foreground/90">
                        Organização:{" "}
                        <span className="text-foreground/90">
                          {getTenantById(u.organizationId)?.displayName ?? u.organizationId}
                        </span>
                      </p>
                    ) : null}
                    {u.role === "user" && (
                      <div className="flex flex-col gap-2 pt-1">
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`board-${u.username}`}
                            checked={u.canManageBoard === true}
                            onCheckedChange={(checked) => {
                              const res = setBoardSettingsPermission(
                                u.username,
                                checked,
                                platformOp ? null : scopeTenantId,
                              );
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
                              const res = setBoardDeleteCardsPermission(
                                u.username,
                                checked,
                                platformOp ? null : scopeTenantId,
                              );
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
                  <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-1">
                    {!owner && (
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <Switch
                          id={`account-active-${u.username.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
                          checked={!u.disabled}
                          onCheckedChange={(active) => {
                            void (async () => {
                              const res = await updateUserByAdmin(
                                u.username,
                                { disabled: !active },
                                platformOp ? null : scopeTenantId,
                              );
                              if (!res.ok) toast.error(res.error ?? "Erro");
                              else toast.success(active ? "Conta reativada." : "Conta desativada.");
                            })();
                          }}
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">Ativa</span>
                      </label>
                    )}
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
            {editTarget && !isOwner(editTarget.username) ? (
              <div className="space-y-1.5">
                <Label htmlFor="edit-login">Login</Label>
                <Input
                  id="edit-login"
                  value={editUsername}
                  onChange={(e) => setEditUsername(sanitizeLoginInput(e.target.value))}
                  className="h-10 font-mono text-sm"
                  autoComplete="off"
                />
                {(() => {
                  const effectiveOrgId = platformOp
                    ? editOrganizationId !== "__none__"
                      ? editOrganizationId
                      : null
                    : (editTarget.organizationId ?? scopeTenantId);
                  const effectiveOrgSlug = effectiveOrgId ? getTenantById(effectiveOrgId)?.slug ?? null : null;
                  if (!effectiveOrgSlug || !editUsername.trim()) return null;
                  return (
                    <p className="text-[11px] text-muted-foreground">
                      Login final:{" "}
                      <span className="font-mono text-foreground">
                        {buildOrgScopedLogin(editUsername, effectiveOrgSlug) ?? "…"}
                      </span>
                    </p>
                  );
                })()}
              </div>
            ) : editTarget ? (
              <p className="text-xs text-muted-foreground rounded-md border border-border/50 bg-secondary/30 px-3 py-2">
                Login <span className="font-mono text-foreground">@{editTarget.username}</span> é fixo na conta
                proprietária.
              </p>
            ) : null}
            {editTarget && platformOp && !isOwner(editTarget.username) && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-org">Organização</Label>
                <Select value={editOrganizationId} onValueChange={setEditOrganizationId}>
                  <SelectTrigger id="edit-org" className="h-10 bg-secondary/50 border-border/50">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhuma (conta plataforma)</SelectItem>
                    {listTenants().map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Ao vincular a uma organização, o dashboard, módulos e branding seguem essa org ao iniciar sessão.
                </p>
              </div>
            )}
            {editTarget && !isOwner(editTarget.username) && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-secondary/20 px-3 py-2.5">
                <div className="min-w-0">
                  <Label htmlFor="edit-conta-ativa" className="text-sm cursor-pointer">
                    Conta ativa
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    Se desativada, não pode iniciar sessão até um administrador reativar.
                  </p>
                </div>
                <Switch
                  id="edit-conta-ativa"
                  checked={!editDisabled}
                  onCheckedChange={(c) => setEditDisabled(!c)}
                />
              </div>
            )}
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
            <Button
              type="button"
              className="gradient-brand text-primary-foreground"
              disabled={!editCanSubmit || !editIsDirty}
              onClick={() => void saveEdit()}
            >
              Salvar
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
