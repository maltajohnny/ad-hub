import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link2, Webhook, Save, KeyRound, Camera, Trash2, Building2, LogOut, Home } from "lucide-react";
import { useAuth, OWNER_USERNAME } from "@/contexts/AuthContext";
import { isPlatformOperator } from "@/lib/saasTypes";
import { BUILTIN_QTRAFFIC_ID } from "@/lib/tenantsStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isValidLoginUsername, sanitizeLoginInput } from "@/lib/loginUsername";
import { isPlausibleEmail } from "@/lib/utils";
import { isStrongPassword, STRONG_PASSWORD_HINT } from "@/lib/passwordPolicy";
import { toast } from "sonner";
import { UserAvatarDisplay } from "@/components/UserAvatarDisplay";

const MAX_AVATAR_BYTES = 1.5 * 1024 * 1024;

type Integration = { name: string; connected: boolean; desc: string };

const initialIntegrations: Integration[] = [
  { name: "Meta Ads", connected: true, desc: "Facebook & Instagram Ads Manager" },
  { name: "Google Ads", connected: true, desc: "Search, Display & YouTube Ads" },
  { name: "Instagram", connected: false, desc: "Instagram Business API" },
];

const Configuracoes = () => {
  const { user, updateProfile, saveAccountProfile, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "conta" ? "conta" : "integracoes";

  const [integrations, setIntegrations] = useState<Integration[]>(initialIntegrations);

  const [name, setName] = useState(user?.name || "");
  const [loginField, setLoginField] = useState(user?.username || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [doc, setDoc] = useState(user?.document || "");
  const [email, setEmail] = useState(user?.email || "");

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [orgVinculo, setOrgVinculo] = useState<"none" | "qtraffic">("none");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setLoginField(user.username);
    setPhone(user.phone);
    setDoc(user.document);
    setEmail(user.email);
    setOrgVinculo(user.organizationId === BUILTIN_QTRAFFIC_ID ? "qtraffic" : "none");
  }, [user]);

  const setConnected = (name: string, connected: boolean) => {
    setIntegrations((prev) => prev.map((i) => (i.name === name ? { ...i, connected } : i)));
  };

  const handleSaveProfile = () => {
    const res = saveAccountProfile(
      { name, email, phone, document: doc },
      loginField,
    );
    if (!res.ok) {
      toast.error(res.error ?? "Não foi possível salvar.");
      return;
    }
    toast.success(res.loginChanged ? "Perfil e login atualizados. Recarregando…" : "Perfil atualizado.");
    if (res.loginChanged) {
      window.setTimeout(() => window.location.reload(), 400);
    }
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem (JPG, PNG, WebP…).");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Imagem muito grande. Tamanho máximo: 1,5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as string;
      updateProfile({ avatarDataUrl: data });
      toast.success("Foto de perfil atualizada.");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    updateProfile({ avatarDataUrl: null });
    toast.success("Foto removida. Avatar padrão exibido.");
  };

  const handleSaveOrgVinculo = () => {
    if (!user || !isPlatformOperator(user.username)) return;
    if (orgVinculo === "qtraffic") {
      updateProfile({ organizationId: BUILTIN_QTRAFFIC_ID });
    } else {
      updateProfile({ organizationId: undefined });
    }
    toast.success("Vínculo com a organização atualizado.");
  };

  const profileCanSave = useMemo(() => {
    if (!user) return false;
    if (!name.trim() || !isPlausibleEmail(email)) return false;
    const loginSan = sanitizeLoginInput(loginField).trim();
    if (!isValidLoginUsername(loginSan)) return false;
    return true;
  }, [user, name, email, loginField]);

  const passwordCanSubmit = useMemo(() => {
    if (!currentPw.trim() || !newPw.trim() || !confirmPw.trim()) return false;
    if (newPw !== confirmPw) return false;
    return isStrongPassword(newPw);
  }, [currentPw, newPw, confirmPw]);

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) {
      toast.error("A nova senha e a confirmação não coincidem.");
      return;
    }
    if (!isStrongPassword(newPw)) {
      toast.error(STRONG_PASSWORD_HINT);
      return;
    }
    const ok = await changePassword(currentPw, newPw);
    if (!ok) {
      toast.error("Senha atual incorreta ou dados inválidos.");
      return;
    }
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    toast.success("Senha alterada com sucesso.");
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-display font-bold">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Integrações, perfil e segurança</p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setSearchParams(v === "conta" ? { tab: "conta" } : {});
        }}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-secondary/50">
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          <TabsTrigger value="conta">Minha conta</TabsTrigger>
        </TabsList>

        <TabsContent value="integracoes" className="mt-6">
          <Card className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Webhook size={18} className="text-primary" />
              <h3 className="font-display font-semibold">Integrações de Plataformas</h3>
            </div>
            <div className="space-y-3">
              {integrations.map((int) => (
                <div key={int.name} className="flex items-center justify-between bg-secondary/30 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Link2 size={16} className={int.connected ? "text-primary" : "text-muted-foreground"} />
                    <div>
                      <p className="text-sm font-medium">{int.name}</p>
                      <p className="text-xs text-muted-foreground">{int.desc}</p>
                    </div>
                  </div>
                  <Switch
                    checked={int.connected}
                    onCheckedChange={(checked) => setConnected(int.name, checked)}
                    aria-label={`Ativar integração ${int.name}`}
                  />
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="conta" className="mt-6 space-y-6">
          <Card className="glass-card p-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFile}
              aria-hidden
            />
            <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-6 pb-6 border-b border-border/50">
              <UserAvatarDisplay user={user} className="h-24 w-24 border border-border/50" iconSize={48} />
              <div className="flex-1 space-y-3">
                <div>
                  <h2 className="font-display font-semibold text-lg">{user?.name}</h2>
                  <span className="text-sm text-muted-foreground">
                    {user?.role === "admin" ? "Administrador" : "Usuário"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4 mr-1.5" />
                    Nova foto
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!user?.avatarDataUrl}
                    onClick={handleRemoveAvatar}
                    className="text-muted-foreground"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Remover foto
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  JPG, PNG ou WebP · até 1,5 MB. Sem foto, usa-se o avatar padrão.
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Nome (exibido)</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary/50 border-border/50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Login</label>
                <Input
                  value={loginField}
                  onChange={(e) => setLoginField(sanitizeLoginInput(e.target.value))}
                  disabled={user?.username === OWNER_USERNAME}
                  autoComplete="username"
                  className="bg-secondary/50 border-border/50 font-mono text-sm"
                  placeholder="ex.: maria.silva ou time@empresa"
                />
                {user?.username === OWNER_USERNAME ? (
                  <p className="text-[11px] text-muted-foreground">
                    O login do administrador principal não pode ser alterado.
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Sem espaços nem vírgulas. Pode usar letras, números, ponto, @ e outros símbolos. No próximo acesso, use
                    este login.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">E-mail</label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-secondary/50 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Telefone</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-secondary/50 border-border/50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">RG / CPF</label>
                <Input value={doc} onChange={(e) => setDoc(e.target.value)} className="bg-secondary/50 border-border/50" />
              </div>
            </div>

            <Button
              onClick={handleSaveProfile}
              disabled={!profileCanSave}
              className="mt-6 gradient-brand text-primary-foreground font-semibold hover:opacity-90"
            >
              <Save size={16} className="mr-2" />
              Salvar dados
            </Button>
          </Card>

          {user && isPlatformOperator(user.username) ? (
            <Card className="glass-card p-6">
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={18} className="text-primary" />
                <h3 className="font-display font-semibold">Organização (equipa AD-HUB)</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                  Associe a sua conta à organização principal AD-HUB para fazer parte do mesmo contexto de módulos e permissões
                da equipa. Pode remover o vínculo a qualquer momento.
              </p>
              <div className="space-y-3 max-w-md">
                <label className="text-sm text-muted-foreground">Vínculo</label>
                <Select
                  value={orgVinculo}
                  onValueChange={(v) => setOrgVinculo(v as "none" | "qtraffic")}
                >
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue placeholder="Escolher" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem vínculo (só operador da plataforma)</SelectItem>
                    <SelectItem value="qtraffic">AD-HUB — equipa principal</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" variant="secondary" size="sm" onClick={handleSaveOrgVinculo}>
                  Salvar vínculo
                </Button>
              </div>
            </Card>
          ) : null}

          <Card className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound size={18} className="text-primary" />
              <h3 className="font-display font-semibold">Alterar senha</h3>
            </div>
            <div className="space-y-4 max-w-md">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Senha atual</label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="bg-secondary/50 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Nova senha</label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="bg-secondary/50 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Confirmar nova senha</label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className="bg-secondary/50 border-border/50"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!passwordCanSubmit}
                  onClick={handleChangePassword}
                >
                  Atualizar senha
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    logout();
                    navigate("/login", { replace: true });
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </Button>
                <Button type="button" variant="ghost" size="sm" className="sm:ml-0" asChild>
                  <Link to="/dashboard" className="gap-2">
                    <Home className="h-4 w-4" />
                    Início
                  </Link>
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Configuracoes;
