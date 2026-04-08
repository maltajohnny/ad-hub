import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { isPlatformOperator } from "@/lib/saasTypes";
import {
  CLIENT_ONBOARDING_BY_PLATFORM,
  addMediaClient,
  appendAudit,
  authorizeClientPlatformViaApp,
  getOrgMediaState,
  setPlatformIntegrationConnected,
  hasApiAccessForClient,
  integrationReady,
  MEDIA_PLATFORMS,
  setMediaClientApiAccess,
  setManagerPermissions,
  setSelectedAdAccountsForPlatform,
  syncAllClientsPerformanceMetrics,
  upsertManager,
  type MediaClient,
  type MediaConnectionStatus,
  type MediaManager,
  type MediaPlatformId,
  type OrgMediaState,
  type PlatformCapability,
} from "@/lib/mediaManagementStore";
import {
  buildFacebookOAuthUrl,
  buildGoogleAdsOAuthUrl,
  buildTikTokOAuthUrl,
  decodeOAuthState,
  encodeOAuthState,
  getConfiguredRedirectUri,
} from "@/lib/platformLoginUrls";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  Building2,
  ChevronDown,
  ClipboardList,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  Percent,
  Target,
  Link2,
} from "lucide-react";

function currency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function normalize(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

function defaultCaps(platformId: MediaPlatformId): PlatformCapability {
  return {
    platformId,
    canManageCampaigns: true,
    canManageAdSets: true,
    canManageAds: true,
    canCreateCampaigns: true,
    canEditCreatives: true,
    canViewMetrics: true,
  };
}

function findManagerRecord(state: OrgMediaState, username: string | undefined, email: string | undefined): MediaManager | null {
  if (!username && !email) return null;
  const byLogin = state.managers.find((m) => m.username && normalize(m.username) === normalize(username));
  if (byLogin) return byLogin;
  return state.managers.find((m) => normalize(m.email) === normalize(email)) ?? null;
}

function managerSeesClient(m: MediaManager, clientId: string): boolean {
  return m.permissions.some((p) => p.mediaClientId === clientId && p.platforms.length > 0);
}

const GestaoMidias = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, listUsers } = useAuth();
  const { tenant, brandingName, brandingLogoSrc } = useTenant();
  const [state, setState] = useState<OrgMediaState | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState<string>("");
  const [newManagerUsername, setNewManagerUsername] = useState<string>("");
  const [managerClientId, setManagerClientId] = useState<string | null>(null);
  const [adminMainTab, setAdminMainTab] = useState("visao");
  const [dialogCliente, setDialogCliente] = useState(false);
  const [dialogGestor, setDialogGestor] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState("");
  const [novoClienteEmail, setNovoClienteEmail] = useState("");
  const [novoClientePlats, setNovoClientePlats] = useState<Record<MediaPlatformId, boolean>>({
    "meta-ads": true,
    "instagram-ads": false,
    "google-ads": false,
    "tiktok-ads": false,
  });
  const [novoGestorNome, setNovoGestorNome] = useState("");
  const [novoGestorEmail, setNovoGestorEmail] = useState("");
  const [novoGestorPhone, setNovoGestorPhone] = useState("");

  const connectionBadgeLabel = (status: MediaConnectionStatus): string => {
    if (status === "connected") return "Autorizado";
    if (status === "syncing") return "A processar";
    if (status === "expired") return "A renovar";
    if (status === "error") return "Erro";
    return "Pendente";
  };

  const orgId = user?.organizationId ?? tenant?.id ?? null;
  const isOrgAdmin = user?.role === "admin";

  useEffect(() => {
    if (!orgId) return;
    setState(getOrgMediaState(orgId));
  }, [orgId]);

  /** Após redirect OAuth (Facebook / TikTok / Google): código na query — em produção o backend troca o token. */
  useEffect(() => {
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");
    const err = searchParams.get("error");
    const errDesc = searchParams.get("error_description");

    const clearParams = () => {
      const next = new URLSearchParams(searchParams);
      next.delete("code");
      next.delete("state");
      next.delete("error");
      next.delete("error_description");
      next.delete("error_reason");
      setSearchParams(next, { replace: true });
    };

    if (err) {
      toast.error(errDesc ?? err ?? "Autorização cancelada ou falhou.");
      clearParams();
      return;
    }

    if (!code || !stateParam || !orgId) return;

    const decoded = decodeOAuthState(stateParam);
    if (!decoded || decoded.orgId !== orgId) {
      clearParams();
      return;
    }

    if (decoded.mediaClientId) {
      setState(authorizeClientPlatformViaApp(orgId, decoded.mediaClientId, decoded.platformId));
      setState(
        appendAudit(
          orgId,
          user?.username ?? "—",
          "Login plataforma concluído",
          `${decoded.platformId} · cliente ${decoded.mediaClientId}`,
        ),
      );
    } else {
      setState(setPlatformIntegrationConnected(orgId, decoded.platformId, true));
      setState(appendAudit(orgId, user?.username ?? "—", "Login plataforma (visão org)", decoded.platformId));
    }
    toast.success(
      "Autorização recebida. Em produção, o servidor troca o código por token e mantém a sessão com a conta do cliente.",
    );
    setState(getOrgMediaState(orgId));
    clearParams();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callback OAuth na query
  }, [searchParams, orgId, setSearchParams, user?.username]);

  useEffect(() => {
    if (!isOrgAdmin || !state?.managers.length) return;
    if (!selectedManagerId || !state.managers.some((m) => m.id === selectedManagerId)) {
      setSelectedManagerId(state.managers[0].id);
    }
  }, [isOrgAdmin, state?.managers, selectedManagerId]);

  const orgUsers = useMemo(() => {
    if (!orgId) return [];
    return listUsers().filter((u) => u.organizationId === orgId && !isPlatformOperator(u.username));
  }, [listUsers, orgId]);

  const tenantDomain = useMemo(() => {
    if (!tenant) return "app.chatgpt";
    return `${tenant.slug}.chatgpt`;
  }, [tenant]);

  const managerByUsername = useMemo(() => {
    const map = new Map<string, MediaManager>();
    for (const m of state?.managers ?? []) {
      if (m.username) map.set(normalize(m.username), m);
    }
    return map;
  }, [state?.managers]);

  const currentManager = useMemo(() => {
    if (!state || !user) return null;
    if (isOrgAdmin) return selectedManagerId ? state.managers.find((m) => m.id === selectedManagerId) ?? null : null;
    return findManagerRecord(state, user.username, user.email);
  }, [isOrgAdmin, selectedManagerId, state, user]);

  const canSeeAll = isOrgAdmin;

  const allowedPairs = useMemo(() => {
    if (canSeeAll || !currentManager) return null;
    const out = new Set<string>();
    for (const p of currentManager.permissions) {
      for (const plat of p.platforms) {
        out.add(`${p.mediaClientId}:${plat.platformId}`);
      }
    }
    return out;
  }, [canSeeAll, currentManager]);

  const visibleCampaigns = useMemo(() => {
    if (!state) return [];
    if (canSeeAll || !allowedPairs) return state.campaigns;
    return state.campaigns.filter((c) => allowedPairs.has(`${c.mediaClientId}:${c.platformId}`));
  }, [allowedPairs, canSeeAll, state]);

  const visibleCreatives = useMemo(() => {
    if (!state) return [];
    if (canSeeAll || !allowedPairs) return state.creatives;
    return state.creatives.filter((c) => allowedPairs.has(`${c.mediaClientId}:${c.platformId}`));
  }, [allowedPairs, canSeeAll, state]);

  const kpis = useMemo(() => {
    if (!state) return { gasto: 0, ativas: 0, clientes: 0, gestores: 0 };
    const gasto = visibleCampaigns.reduce((s, c) => s + c.spend, 0);
    const ativas = visibleCampaigns.filter((c) => c.status === "Ativa").length;
    return {
      gasto,
      ativas,
      clientes: state.mediaClients.length,
      gestores: state.managers.length,
    };
  }, [state, visibleCampaigns]);

  const managerClients = useMemo(() => {
    if (!state || !currentManager) return [];
    return state.mediaClients.filter((c) => managerSeesClient(currentManager, c.id));
  }, [currentManager, state]);

  useEffect(() => {
    if (managerClients.length && !managerClientId) {
      setManagerClientId(managerClients[0].id);
    }
    if (managerClients.length && managerClientId && !managerClients.some((c) => c.id === managerClientId)) {
      setManagerClientId(managerClients[0].id);
    }
  }, [managerClientId, managerClients]);

  if (!user) return null;

  if (!orgId || !tenant) {
    return (
      <Card className="p-6">
        <h1 className="text-2xl font-display font-bold">Gestão de Mídias</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este módulo requer vínculo com uma organização (tenant) para carregar branding, domínio e permissões.
        </p>
      </Card>
    );
  }

  if (isPlatformOperator(user.username)) {
    return (
      <Card className="p-6">
        <h1 className="text-2xl font-display font-bold">Gestão de Mídias</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Operadores da plataforma não acessam este módulo. O acesso é exclusivo para equipes da organização cliente.
        </p>
      </Card>
    );
  }

  if (!isOrgAdmin && !currentManager) {
    return (
      <Card className="p-6">
        <h1 className="text-2xl font-display font-bold">Gestão de Mídias</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Seu utilizador ainda não foi cadastrado como gestor. Peça ao administrador da organização para o convite e as
          permissões de clientes e plataformas.
        </p>
      </Card>
    );
  }

  const activeAdminManager = isOrgAdmin && selectedManagerId ? state?.managers.find((m) => m.id === selectedManagerId) : null;

  const toggleManagerPlatform = (
    managerId: string,
    mediaClientId: string,
    platformId: MediaPlatformId,
    checked: boolean,
  ) => {
    if (!state || !isOrgAdmin) return;
    const manager = state.managers.find((m) => m.id === managerId);
    if (!manager) return;
    let permissions = [...manager.permissions];
    const idx = permissions.findIndex((p) => p.mediaClientId === mediaClientId);
    if (checked) {
      if (idx < 0) {
        permissions.push({ mediaClientId, platforms: [defaultCaps(platformId)] });
      } else {
        const p = permissions[idx];
        if (p.platforms.some((x) => x.platformId === platformId)) return;
        permissions[idx] = { ...p, platforms: [...p.platforms, defaultCaps(platformId)] };
      }
    } else {
      if (idx < 0) return;
      const p = permissions[idx];
      const nextPlats = p.platforms.filter((x) => x.platformId !== platformId);
      permissions = [...permissions.filter((x) => x.mediaClientId !== mediaClientId), ...(nextPlats.length ? [{ mediaClientId, platforms: nextPlats }] : [])];
    }
    setManagerPermissions(orgId, managerId, permissions);
    setState(
      appendAudit(
        orgId,
        user.username,
        "Permissões de gestor",
        `Atualizado acesso · cliente ${mediaClientId} · ${platformId}`,
      ),
    );
  };

  const toggleCapability = (
    managerId: string,
    mediaClientId: string,
    platformId: MediaPlatformId,
    key: keyof Pick<
      PlatformCapability,
      "canManageCampaigns" | "canManageAdSets" | "canManageAds" | "canCreateCampaigns" | "canEditCreatives" | "canViewMetrics"
    >,
    value: boolean,
  ) => {
    if (!state || !isOrgAdmin) return;
    const manager = state.managers.find((m) => m.id === managerId);
    if (!manager) return;
    const permissions = manager.permissions.map((p) => {
      if (p.mediaClientId !== mediaClientId) return p;
      return {
        ...p,
        platforms: p.platforms.map((pl) =>
          pl.platformId === platformId ? { ...pl, [key]: value } : pl,
        ),
      };
    });
    const next = setManagerPermissions(orgId, managerId, permissions);
    setState(next);
  };

  const handleAddManager = () => {
    if (!isOrgAdmin || !state) return;
    if (!newManagerUsername) {
      toast.error("Selecione um utilizador da organização.");
      return;
    }
    const selected = orgUsers.find((u) => normalize(u.username) === normalize(newManagerUsername));
    if (!selected) {
      toast.error("Utilizador da organização não encontrado.");
      return;
    }
    const existing = managerByUsername.get(normalize(selected.username));
    upsertManager(orgId, {
      id: existing?.id ?? crypto.randomUUID(),
      username: selected.username,
      name: selected.name,
      email: selected.email,
      phone: undefined,
      active: true,
      permissions: existing?.permissions ?? [],
      invitedAt: new Date().toISOString(),
    });
    const final = appendAudit(orgId, user.username, "Gestor vinculado", `Conta SaaS @${selected.username}`);
    setState(final);
    setSelectedManagerId(
      final.managers.find((m) => normalize(m.username) === normalize(selected.username))?.id ?? "",
    );
    setNewManagerUsername("");
    toast.success("Gestor cadastrado. Defina clientes e plataformas na matriz abaixo.");
  };

  const handleInviteGestor = () => {
    if (!isOrgAdmin || !novoGestorNome.trim() || !novoGestorEmail.trim()) {
      toast.error("Preencha nome e e-mail do gestor.");
      return;
    }
    upsertManager(orgId, {
      id: crypto.randomUUID(),
      username: null,
      name: novoGestorNome.trim(),
      email: novoGestorEmail.trim(),
      phone: novoGestorPhone.trim() || undefined,
      active: true,
      permissions: [],
      invitedAt: new Date().toISOString(),
    });
    setState(appendAudit(orgId, user.username, "Convite de gestor", `E-mail ${novoGestorEmail.trim()}`));
    setDialogGestor(false);
    setNovoGestorNome("");
    setNovoGestorEmail("");
    setNovoGestorPhone("");
    toast.success("Notificação simulada: o gestor receberá instruções de acesso à plataforma.");
  };

  const handleNovoCliente = () => {
    if (!novoClienteNome.trim() || !novoClienteEmail.trim()) {
      toast.error("Nome e e-mail do cliente são obrigatórios.");
      return;
    }
    const platformIds = (Object.keys(novoClientePlats) as MediaPlatformId[]).filter((k) => novoClientePlats[k]);
    if (platformIds.length === 0) {
      toast.error("Selecione pelo menos uma plataforma.");
      return;
    }
    addMediaClient(orgId, {
      name: novoClienteNome.trim(),
      email: novoClienteEmail.trim(),
      platformIds,
    });
    setState(appendAudit(orgId, user.username, "Cliente cadastrado", novoClienteNome.trim()));
    setDialogCliente(false);
    setNovoClienteNome("");
    setNovoClienteEmail("");
    setNovoClientePlats({
      "meta-ads": true,
      "instagram-ads": false,
      "google-ads": false,
      "tiktok-ads": false,
    });
    toast.success("Cliente registado. O convite e o assistente de autorização seguem o fluxo AD-Hub (simulado).");
  };

  const managerOptions = orgUsers
    .filter((u) => !managerByUsername.has(normalize(u.username)))
    .map((u) => ({ value: u.username, label: `${u.name} (${u.username})` }));

  /** Simula o cliente a concluir o fluxo guiado na AD-Hub (sem login direto nas redes). */
  /** Simula cliente já autorizado (apenas desenvolvimento / sem app Meta configurado). */
  const simulateClientAuthorizedPlatform = (client: MediaClient, platformId: MediaPlatformId) => {
    setState(authorizeClientPlatformViaApp(orgId, client.id, platformId));
    setState(appendAudit(orgId, user.username, "Cliente autorizou conta (simulação)", `${platformId} · ${client.name}`));
    toast.success("Autorização registada (teste local).");
  };

  /** Abre o ecrã oficial de login/autorização da rede (Meta = Facebook OAuth; TikTok; Google). */
  const startPlatformLogin = (platformId: MediaPlatformId, client: MediaClient | undefined) => {
    const redirectUri = getConfiguredRedirectUri();
    const state = encodeOAuthState({
      orgId,
      mediaClientId: client?.id ?? null,
      platformId,
    });

    const auditLabel = client ? client.name : "sem cliente selecionado";

    if (platformId === "meta-ads" || platformId === "instagram-ads") {
      const url = buildFacebookOAuthUrl({
        redirectUri,
        state,
        scope:
          platformId === "instagram-ads"
            ? "ads_read,ads_management,business_management,instagram_basic,instagram_manage_insights,pages_read_engagement"
            : undefined,
      });
      if (url) {
        setState(appendAudit(orgId, user.username, "Redirecionar login Meta", `${platformId} · ${auditLabel}`));
        window.location.href = url;
        return;
      }
      window.open("https://www.facebook.com/login/", "_blank", "noopener,noreferrer");
      toast.message(
        "Configure VITE_META_APP_ID e o mesmo redirect URI na consola Meta. Aberto facebook.com/login para teste manual.",
      );
      return;
    }

    if (platformId === "tiktok-ads") {
      const url = buildTikTokOAuthUrl({ redirectUri, state });
      if (url) {
        setState(appendAudit(orgId, user.username, "Redirecionar login TikTok", auditLabel));
        window.location.href = url;
        return;
      }
      window.open("https://www.tiktok.com/", "_blank", "noopener,noreferrer");
      toast.message("Configure VITE_TIKTOK_APP_ID e redirect URI na TikTok Ads.");
      return;
    }

    if (platformId === "google-ads") {
      const url = buildGoogleAdsOAuthUrl({ redirectUri, state });
      if (url) {
        setState(appendAudit(orgId, user.username, "Redirecionar login Google Ads", auditLabel));
        window.location.href = url;
        return;
      }
      window.open("https://accounts.google.com/signin", "_blank", "noopener,noreferrer");
      toast.message("Configure VITE_GOOGLE_OAUTH_CLIENT_ID (Google Cloud) e redirect URI.");
    }
  };

  const selectedClient = state?.mediaClients.find((c) => c.id === managerClientId);

  const platformsForManagerOnClient = (client: MediaClient): MediaPlatformId[] => {
    if (isOrgAdmin) return client.platformIds;
    if (!currentManager) return [];
    const perm = currentManager.permissions.find((p) => p.mediaClientId === client.id);
    if (!perm) return [];
    return perm.platforms.map((p) => p.platformId).filter((pid) => client.platformIds.includes(pid));
  };

  const renderPlatformPanel = (platformId: MediaPlatformId, client: MediaClient | undefined) => {
    const platform = MEDIA_PLATFORMS.find((p) => p.id === platformId);
    const connection = client?.platformConnections?.[platformId];
    const connStatus = connection?.status ?? "not-connected";
    const managerPermission = !isOrgAdmin && currentManager && client
      ? currentManager.permissions.find((p) => p.mediaClientId === client.id)
      : null;
    const capability = managerPermission?.platforms.find((p) => p.platformId === platformId);
    const apiOk = client ? hasApiAccessForClient(client, platformId) : false;
    const intOk = state ? integrationReady(state, platformId) : false;
    const canUse = apiOk && intOk;
    const list = visibleCampaigns.filter((c) => c.platformId === platformId && (!client || c.mediaClientId === client.id));

    const loginTitle =
      platformId === "meta-ads" || platformId === "instagram-ads"
        ? "Facebook / Meta"
        : platformId === "tiktok-ads"
          ? "TikTok"
          : "Google";

    return (
      <div className="space-y-4">
        <Card className="p-4 border-sky-500/35 bg-sky-500/[0.07]">
          <p className="text-sm font-semibold text-foreground">Passo 1 · Login na plataforma ({loginTitle})</p>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            Abre o <strong className="text-foreground">ecrã oficial de login</strong> desta rede. Inicie sessão com o{" "}
            <strong className="text-foreground">e-mail que o cliente convidou</strong> para a conta de anúncios (por exemplo no Business
            Manager da Meta). Depois do redirect, esta área mostra o dashboard e as campanhas desse cliente.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" className="gap-2" onClick={() => startPlatformLogin(platformId, client)}>
              Abrir login {platform?.label ?? ""}
            </Button>
            {client && isOrgAdmin ? (
              <Button type="button" variant="outline" size="sm" onClick={() => simulateClientAuthorizedPlatform(client, platformId)}>
                Simular já autorizado (dev)
              </Button>
            ) : null}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 leading-snug">
            Em produção: registe na consola da rede o mesmo redirect URI que em VITE_PLATFORM_OAUTH_REDIRECT_URI (ou o URL de /gestao-midias)
            e o App ID (VITE_META_APP_ID, etc.).
          </p>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={canUse ? "default" : "secondary"}>
            {canUse ? "Sessão / API ativa para este cliente" : "Complete o login acima (ou simule em dev)"}
          </Badge>
          {client ? (
            <Badge variant="outline">
              Conta: {connectionBadgeLabel(connStatus)}
            </Badge>
          ) : null}
          {!apiOk && client && isOrgAdmin ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setMediaClientApiAccess(orgId, client.id, platformId, true);
                setState(
                  appendAudit(orgId, user.username, "Permissão base (simulação)", `Cliente ${client.name} · ${platform?.label ?? ""}`),
                );
                toast.message("Permissão base registada (teste).");
              }}
            >
              Só permissão base (teste)
            </Button>
          ) : null}
        </div>
        {!canUse ? (
          <p className="text-sm text-muted-foreground">
            O administrador da organização define quem acede a este módulo; o cliente define que e-mail pode gerir as contas na rede. Até o
            login estar concluído, os dados abaixo podem estar vazios ou de demonstração.
          </p>
        ) : null}
        {!isOrgAdmin && canUse ? (
          <Card className="p-3 border-border/60 bg-secondary/15">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Permissões deste gestor</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant={capability?.canManageCampaigns ? "default" : "secondary"}>
                {capability?.canManageCampaigns ? "Gerir campanhas" : "Sem gerir campanhas"}
              </Badge>
              <Badge variant={capability?.canManageAdSets ? "default" : "secondary"}>
                {capability?.canManageAdSets ? "Gerir conjuntos" : "Sem gerir conjuntos"}
              </Badge>
              <Badge variant={capability?.canManageAds ? "default" : "secondary"}>
                {capability?.canManageAds ? "Gerir anúncios" : "Sem gerir anúncios"}
              </Badge>
              <Badge variant={capability?.canEditCreatives ? "default" : "secondary"}>
                {capability?.canEditCreatives ? "Editar criativos" : "Sem criativos"}
              </Badge>
              <Badge variant={capability?.canViewMetrics ? "default" : "secondary"}>
                {capability?.canViewMetrics ? "Ver métricas" : "Sem métricas"}
              </Badge>
            </div>
          </Card>
        ) : null}
        {canUse ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!isOrgAdmin && capability?.canManageCampaigns !== true}
              onClick={() => {
                if (!client) return;
                setState(
                  appendAudit(
                    orgId,
                    user.username,
                    "Campanha criada",
                    `${platform?.label ?? platformId} · ${client.name} · criação via SaaS`,
                  ),
                );
                toast.success("Campanha criada na AD-Hub (em produção: enviada à rede via API).");
              }}
            >
              Criar campanha
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!isOrgAdmin && capability?.canManageAdSets !== true}
              onClick={() => {
                if (!client) return;
                setState(
                  appendAudit(
                    orgId,
                    user.username,
                    "Conjunto criado",
                    `${platform?.label ?? platformId} · ${client.name} · criação via SaaS`,
                  ),
                );
                toast.success("Conjunto criado (em produção: sincronizado via API).");
              }}
            >
              Criar conjunto
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!isOrgAdmin && capability?.canManageAds !== true}
              onClick={() => {
                if (!client) return;
                setState(
                  appendAudit(
                    orgId,
                    user.username,
                    "Anúncio criado",
                    `${platform?.label ?? platformId} · ${client.name} · criação via SaaS`,
                  ),
                );
                toast.success("Anúncio criado (em produção: sincronizado via API).");
              }}
            >
              Criar anúncio
            </Button>
          </div>
        ) : null}
        <div className="space-y-3">
          {list.map((camp) => (
            <Collapsible key={camp.id} defaultOpen={false}>
              <Card className="border-border/60">
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-4 text-left hover:bg-secondary/30">
                  <div>
                    <p className="font-medium">{camp.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {camp.objective} · {currency(camp.budget)} · {camp.startDate} → {camp.endDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline">{camp.status}</Badge>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Separator />
                  <div className="p-4 space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Conjuntos de anúncios</p>
                    {camp.adSets.map((set) => (
                      <Card key={set.id} className="bg-secondary/20 p-3">
                        <div className="flex flex-wrap justify-between gap-2">
                          <span className="font-medium text-sm">{set.name}</span>
                          <Badge variant="secondary">{set.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Orçamento {currency(set.budget)} · {set.audience}
                        </p>
                        <div className="mt-2 space-y-1.5">
                          <p className="text-[11px] font-medium text-muted-foreground">Anúncios</p>
                          <ul className="text-sm space-y-1">
                            {set.ads.map((ad) => (
                              <li key={ad.id} className="flex flex-wrap justify-between gap-2 border-b border-border/40 pb-1 last:border-0">
                                <span>{ad.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {ad.creativeType} · {ad.status}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </Card>
                    ))}
                    <p className="text-[11px] text-muted-foreground">
                      Métricas e alterações refletem a conta real através da integração API (dados de demonstração neste ambiente).
                    </p>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma campanha nesta plataforma para o filtro atual.</p>
          ) : null}
        </div>
      </div>
    );
  };

  const renderManagerExperience = () => {
    if (!state || !currentManager || !user) return null;
    return (
      <div className="space-y-6">
        <Card className="p-5 border-primary/25 bg-primary/[0.03]">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            A sua organização e o cliente
          </h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            O administrador da organização recebe convite por e-mail e gere utilizadores e módulos. Em cada separador (Meta Ads, TikTok,
            etc.) use o <strong className="text-foreground">login oficial dessa rede</strong> com o <strong className="text-foreground">e-mail que o cliente convidou</strong> na conta de anúncios — assim acede ao dashboard completo desse cliente, com as ações a sincronizar via API.
          </p>
        </Card>
        <Card className="p-4 border-primary/20">
          <h2 className="text-lg font-semibold">Os seus clientes</h2>
          <p className="text-sm text-muted-foreground mt-1">Selecione um cliente para carregar o painel e as abas das redes autorizadas.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {managerClients.map((c) => (
              <Button
                key={c.id}
                type="button"
                variant={managerClientId === c.id ? "default" : "outline"}
                onClick={() => setManagerClientId(c.id)}
              >
                {c.name}
              </Button>
            ))}
          </div>
        </Card>
        {selectedClient ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Campanhas ativas (visíveis)</p>
                <p className="text-2xl font-bold">
                  {visibleCampaigns.filter((x) => x.mediaClientId === selectedClient.id && x.status === "Ativa").length}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Gasto (período)</p>
                <p className="text-2xl font-bold">
                  {currency(visibleCampaigns.filter((x) => x.mediaClientId === selectedClient.id).reduce((s, x) => s + x.spend, 0))}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Criativos</p>
                <p className="text-2xl font-bold">
                  {visibleCreatives.filter((x) => x.mediaClientId === selectedClient.id).length}
                </p>
              </Card>
            </div>
            {platformsForManagerOnClient(selectedClient).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma plataforma atribuída para este cliente. Peça ao administrador para ajustar permissões.
              </p>
            ) : (
              <Tabs
                defaultValue={platformsForManagerOnClient(selectedClient)[0] ?? "meta-ads"}
                className="w-full"
              >
                <TabsList className="flex flex-wrap h-auto gap-1">
                  {platformsForManagerOnClient(selectedClient).map((pid) => {
                    const p = MEDIA_PLATFORMS.find((x) => x.id === pid);
                    return (
                      <TabsTrigger key={pid} value={pid} className="gap-1">
                        <Megaphone className="h-3.5 w-3.5" />
                        {p?.label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
                {platformsForManagerOnClient(selectedClient).map((pid) => (
                  <TabsContent key={pid} value={pid} className="mt-4">
                    {renderPlatformPanel(pid, selectedClient)}
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum cliente atribuído.</p>
        )}
      </div>
    );
  };

  const renderAdminExperience = () => {
    if (!state || !user) return null;
    return (
      <>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            onClick={() => {
              if (!orgId) return;
              setState(syncAllClientsPerformanceMetrics(orgId));
              setState(appendAudit(orgId, user.username, "Sincronização KPIs", "Métricas recalculadas (simulação API)"));
              toast.success("KPIs atualizados a partir das campanhas sincronizadas.");
            }}
          >
            <BarChart3 className="h-4 w-4" />
            Sincronizar KPIs
          </Button>
          <Button type="button" className="gap-2" onClick={() => setDialogCliente(true)}>
            <Building2 className="h-4 w-4" />
            Cadastrar cliente
          </Button>
          <Button type="button" variant="secondary" className="gap-2" onClick={() => setDialogGestor(true)}>
            <Users className="h-4 w-4" />
            Convidar gestor
          </Button>
        </div>

        <Card className="p-5 border-border/60">
          <p className="text-xs text-muted-foreground mb-2">
            Tráfego pago centralizado: OAuth Meta / Google / TikTok, contas gerenciadas e permissões por cliente — ver contratos em{" "}
            <code className="text-[10px]">src/lib/mediaApiContract.ts</code> e schema em{" "}
            <code className="text-[10px]">src/lib/mediaManagementSchema.ts</code>.
          </p>
          <h3 className="font-semibold text-sm mb-2">Papéis nesta organização</h3>
          <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1.5 leading-relaxed">
            <li>
              <strong className="text-foreground font-medium">Administrador:</strong> convite por e-mail; define utilizadores e quais módulos
              cada um pode usar (ex.: Gestão de Mídias).
            </li>
            <li>
              <strong className="text-foreground font-medium">Cliente (marca):</strong> convida o e-mail do teu administrador ou gestor nas
              contas de anúncios (ex.: Meta Business). Esse é o e-mail a usar no login Facebook/TikTok/Google ao abrir cada rede aqui.
            </li>
            <li>
              <strong className="text-foreground font-medium">Utilizadores:</strong> permissões por módulo definidas pelo admin; dentro de
              Gestão de Mídias, o acesso por cliente e rede segue a matriz de permissões abaixo.
            </li>
          </ol>
        </Card>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Gasto total (visível)</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{currency(kpis.gasto)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Campanhas ativas</p>
            <p className="mt-1 text-2xl font-bold">{kpis.ativas}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Clientes no módulo</p>
            <p className="mt-1 text-2xl font-bold">{kpis.clientes}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Gestores</p>
            <p className="mt-1 text-2xl font-bold">{kpis.gestores}</p>
          </Card>
        </div>

        <Tabs value={adminMainTab} onValueChange={setAdminMainTab} className="w-full">
          <ScrollArea className="w-full">
            <TabsList className="inline-flex h-auto min-h-10 w-max max-w-full flex-wrap gap-1">
              <TabsTrigger value="visao" className="gap-1">
                <BarChart3 className="h-3.5 w-3.5" />
                Visão geral
              </TabsTrigger>
              {MEDIA_PLATFORMS.map((p) => (
                <TabsTrigger key={p.id} value={`p-${p.id}`} className="gap-1">
                  {p.label}
                </TabsTrigger>
              ))}
              <TabsTrigger value="clientes" className="gap-1">
                <Building2 className="h-3.5 w-3.5" />
                Clientes
              </TabsTrigger>
              <TabsTrigger value="gestores" className="gap-1">
                <Users className="h-3.5 w-3.5" />
                Gestores
              </TabsTrigger>
              <TabsTrigger value="auditoria" className="gap-1">
                <ClipboardList className="h-3.5 w-3.5" />
                Auditoria
              </TabsTrigger>
            </TabsList>
          </ScrollArea>

          <TabsContent value="visao" className="mt-4 space-y-4">
            <Card className="p-5">
              <h3 className="font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Integrações por plataforma
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {state.integrations.map((integration) => {
                  const platform = MEDIA_PLATFORMS.find((p) => p.id === integration.platformId);
                  return (
                    <Badge key={integration.platformId} variant="outline" className={integration.connected ? "border-emerald-500/40" : ""}>
                      {platform?.label}: {integration.connected ? "API ativa" : "Pendente"}
                    </Badge>
                  );
                })}
              </div>
            </Card>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="font-semibold mb-2">Campanhas recentes</h3>
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {visibleCampaigns.slice(0, 8).map((c) => {
                    const cl = state.mediaClients.find((x) => x.id === c.mediaClientId);
                    const pl = MEDIA_PLATFORMS.find((x) => x.id === c.platformId);
                    return (
                      <div key={c.id} className="rounded-md border border-border/50 p-2 text-sm">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground block">
                          {cl?.name} · {pl?.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
              <Card className="p-5">
                <h3 className="font-semibold mb-2">Criativos</h3>
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {visibleCreatives.slice(0, 8).map((cr) => {
                    const cl = state.mediaClients.find((x) => x.id === cr.mediaClientId);
                    return (
                      <div key={cr.id} className="rounded-md border border-border/50 p-2 text-sm">
                        <span className="font-medium">{cr.title}</span>
                        <span className="text-xs text-muted-foreground block">{cl?.name}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </TabsContent>

          {MEDIA_PLATFORMS.map((p) => (
            <TabsContent key={p.id} value={`p-${p.id}`} className="mt-4">
              {renderPlatformPanel(p.id, undefined)}
            </TabsContent>
          ))}

          <TabsContent value="clientes" className="mt-4 space-y-4">
            {state.mediaClients.map((c) => (
              <Card key={c.id} className="p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold">{c.name}</h3>
                    <p className="text-sm text-muted-foreground">{c.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.platformIds.map((pid) => (
                        <Badge key={pid} variant="secondary">
                          {MEDIA_PLATFORMS.find((x) => x.id === pid)?.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                {c.performanceMetrics ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-border/50 bg-secondary/20 px-3 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                        <Wallet className="h-3 w-3" />
                        Investimento (sync)
                      </p>
                      <p className="text-lg font-bold tabular-nums">{currency(c.performanceMetrics.totalSpend)}</p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-secondary/20 px-3 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                        <Percent className="h-3 w-3" />
                        ROI
                      </p>
                      <p className="text-lg font-bold tabular-nums">{(c.performanceMetrics.roi * 100).toFixed(1)}%</p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-secondary/20 px-3 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        CPA
                      </p>
                      <p className="text-lg font-bold tabular-nums">{currency(c.performanceMetrics.cpa)}</p>
                    </div>
                  </div>
                ) : null}
                {isOrgAdmin
                  ? c.platformIds
                      .filter((pid) => (c.managedAdAccountsByPlatform?.[pid] ?? []).length > 0)
                      .map((pid) => {
                      const accounts = c.managedAdAccountsByPlatform?.[pid] ?? [];
                      const selected = new Set(c.selectedAdAccountIdsByPlatform?.[pid] ?? []);
                      return (
                        <div key={`${c.id}-${pid}-acct`} className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
                          <p className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                            <Link2 className="h-3.5 w-3.5" />
                            Contas gerenciadas · {MEDIA_PLATFORMS.find((x) => x.id === pid)?.label}
                          </p>
                          <p className="text-[11px] text-muted-foreground mb-2">
                            Mesmo e-mail com acesso a várias contas: escolha quais aplicam a este cliente.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {accounts.map((a) => (
                              <label
                                key={a.externalId}
                                className="flex items-center gap-2 rounded-md border border-border/50 bg-background/80 px-2 py-1.5 text-xs cursor-pointer"
                              >
                                <Checkbox
                                  checked={selected.has(a.externalId)}
                                  onCheckedChange={(checked) => {
                                    if (!orgId) return;
                                    const next = new Set(selected);
                                    if (checked === true) next.add(a.externalId);
                                    else next.delete(a.externalId);
                                    setState(
                                      setSelectedAdAccountsForPlatform(orgId, c.id, pid, [...next]),
                                    );
                                    setState(
                                      appendAudit(
                                        orgId,
                                        user.username,
                                        "Contas associadas ao cliente",
                                        `${c.name} · ${pid} · ${[...next].join(", ")}`,
                                      ),
                                    );
                                  }}
                                />
                                <span className="truncate max-w-[200px]">{a.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                      })
                  : null}
                <Separator className="my-4" />
                <p className="text-xs font-medium text-muted-foreground mb-2">O que combinar com o cliente</p>
                <div className="space-y-4">
                  {c.platformIds.map((pid) => {
                    const lines = CLIENT_ONBOARDING_BY_PLATFORM[pid] ?? [];
                    const label = MEDIA_PLATFORMS.find((x) => x.id === pid)?.label ?? pid;
                    return (
                      <div key={pid}>
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{label}</p>
                          <Badge variant="outline">
                            Estado: {connectionBadgeLabel(c.platformConnections?.[pid]?.status ?? "not-connected")}
                          </Badge>
                          {isOrgAdmin && (c.platformConnections?.[pid]?.status ?? "not-connected") !== "connected" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                simulateClientAuthorizedPlatform(c, pid);
                              }}
                            >
                              Simular já autorizado (dev)
                            </Button>
                          ) : null}
                        </div>
                        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                          {lines.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="gestores" className="mt-4 space-y-4">
            <Card className="p-5">
              <h3 className="font-semibold mb-2">Vincular utilizador da org como gestor</h3>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label>Utilizador</Label>
                  <Select value={newManagerUsername} onValueChange={setNewManagerUsername}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {managerOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" onClick={handleAddManager}>
                  Adicionar
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {state.managers.map((m) => (
                  <Button
                    key={m.id}
                    type="button"
                    variant={selectedManagerId === m.id ? "default" : "outline"}
                    onClick={() => setSelectedManagerId(m.id)}
                  >
                    {m.name}
                    {!m.username ? <span className="ml-1 text-[10px] opacity-80">(convite)</span> : null}
                  </Button>
                ))}
              </div>
            </Card>

            {activeAdminManager ? (
              <Card className="p-5 overflow-x-auto">
                <h3 className="font-semibold mb-4">
                  Matriz: {activeAdminManager.name}
                  <span className="text-muted-foreground font-normal text-sm ml-2">Clientes × plataformas × permissões</span>
                </h3>
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="border-b border-border/60 text-left">
                      <th className="py-2 pr-2">Cliente</th>
                      {MEDIA_PLATFORMS.map((p) => (
                        <th key={p.id} className="py-2 px-1">
                          {p.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {state.mediaClients.map((cl) => {
                      const perm = activeAdminManager.permissions.find((p) => p.mediaClientId === cl.id);
                      return (
                        <tr key={cl.id} className="border-b border-border/40 align-top">
                          <td className="py-3 pr-2 font-medium">{cl.name}</td>
                          {MEDIA_PLATFORMS.map((plat) => {
                            const hasPlat = perm?.platforms.some((x) => x.platformId === plat.id);
                            const cap = perm?.platforms.find((x) => x.platformId === plat.id);
                            const disabled = !cl.platformIds.includes(plat.id);
                            return (
                              <td key={plat.id} className="py-2 px-1">
                                {disabled ? (
                                  <span className="text-xs text-muted-foreground">—</span>
                                ) : (
                                  <div className="space-y-2 rounded-md border border-border/50 p-2 bg-secondary/10">
                                    <div className="flex items-center gap-2">
                                      <Checkbox
                                        id={`m-${activeAdminManager.id}-${cl.id}-${plat.id}`}
                                        checked={!!hasPlat}
                                        onCheckedChange={(c) =>
                                          toggleManagerPlatform(activeAdminManager.id, cl.id, plat.id, c === true)
                                        }
                                      />
                                      <Label htmlFor={`m-${activeAdminManager.id}-${cl.id}-${plat.id}`} className="text-xs">
                                        Acesso
                                      </Label>
                                    </div>
                                    {cap ? (
                                      <div className="space-y-1 pl-1">
                                        <label className="flex items-center gap-2 text-[11px]">
                                          <Switch
                                            checked={cap.canManageCampaigns}
                                            onCheckedChange={(v) =>
                                              toggleCapability(activeAdminManager.id, cl.id, plat.id, "canManageCampaigns", v)
                                            }
                                          />
                                          Gerir campanhas
                                        </label>
                                        <label className="flex items-center gap-2 text-[11px]">
                                          <Switch
                                            checked={cap.canManageAdSets}
                                            onCheckedChange={(v) =>
                                              toggleCapability(activeAdminManager.id, cl.id, plat.id, "canManageAdSets", v)
                                            }
                                          />
                                          Conjuntos
                                        </label>
                                        <label className="flex items-center gap-2 text-[11px]">
                                          <Switch
                                            checked={cap.canManageAds}
                                            onCheckedChange={(v) =>
                                              toggleCapability(activeAdminManager.id, cl.id, plat.id, "canManageAds", v)
                                            }
                                          />
                                          Anúncios
                                        </label>
                                        <label className="flex items-center gap-2 text-[11px]">
                                          <Switch
                                            checked={cap.canCreateCampaigns}
                                            onCheckedChange={(v) =>
                                              toggleCapability(activeAdminManager.id, cl.id, plat.id, "canCreateCampaigns", v)
                                            }
                                          />
                                          Campanhas
                                        </label>
                                        <label className="flex items-center gap-2 text-[11px]">
                                          <Switch
                                            checked={cap.canEditCreatives}
                                            onCheckedChange={(v) =>
                                              toggleCapability(activeAdminManager.id, cl.id, plat.id, "canEditCreatives", v)
                                            }
                                          />
                                          Criativos
                                        </label>
                                        <label className="flex items-center gap-2 text-[11px]">
                                          <Switch
                                            checked={cap.canViewMetrics}
                                            onCheckedChange={(v) =>
                                              toggleCapability(activeAdminManager.id, cl.id, plat.id, "canViewMetrics", v)
                                            }
                                          />
                                          Métricas
                                        </label>
                                      </div>
                                    ) : null}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            ) : (
              <p className="text-sm text-muted-foreground">Selecione um gestor acima para editar permissões.</p>
            )}
          </TabsContent>

          <TabsContent value="auditoria" className="mt-4">
            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-border/50 bg-secondary/20 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                <span className="font-medium text-sm">Registo de ações</span>
              </div>
              <ScrollArea className="h-[320px]">
                <ul className="divide-y divide-border/40">
                  {(state.auditLog ?? []).length === 0 ? (
                    <li className="p-4 text-sm text-muted-foreground">Ainda não há eventos.</li>
                  ) : (
                    state.auditLog.map((e) => (
                      <li key={e.id} className="px-4 py-3 text-sm">
                        <div className="flex flex-wrap justify-between gap-2">
                          <span className="font-medium">{e.action}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">{new Date(e.at).toLocaleString("pt-BR")}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{e.detail}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">Por: {e.actor}</p>
                      </li>
                    ))
                  )}
                </ul>
              </ScrollArea>
            </Card>
          </TabsContent>
        </Tabs>
      </>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border-primary/25">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            {brandingLogoSrc ? (
              <img src={brandingLogoSrc} alt={brandingName} className="h-12 w-auto max-w-[180px] object-contain" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-primary/15 flex items-center justify-center font-bold text-primary">
                {brandingName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-display font-bold">Gestão de Mídias</h1>
              <p className="text-sm text-muted-foreground">
                {isOrgAdmin ? "Configuração da organização e convites" : "Operação centralizada por cliente"} ·{" "}
                <span className="font-medium text-foreground">{brandingName}</span> · {tenantDomain}
              </p>
              <p className="text-xs text-muted-foreground mt-2 max-w-2xl leading-relaxed">
                Por organização: administrador e equipa com módulos atribuídos. Em cada rede, o login oficial (ex.: Facebook) usa o e-mail
                convidado pelo cliente; o dashboard e as operações sincronizam via API.
              </p>
            </div>
          </div>
          <Badge variant="outline">{tenant.slug}</Badge>
        </div>
      </Card>

      {isOrgAdmin ? renderAdminExperience() : renderManagerExperience()}

      <Dialog open={dialogCliente} onOpenChange={setDialogCliente}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cadastrar cliente</DialogTitle>
            <DialogDescription>
              Nome, e-mail e redes em que opera. O cliente deve convidar o teu e-mail nas contas de anúncios; depois, nas abas Meta/TikTok/Google,
              usas o login oficial dessa rede com esse mesmo e-mail.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label>Nome do cliente</Label>
              <Input value={novoClienteNome} onChange={(e) => setNovoClienteNome(e.target.value)} placeholder="Empresa XYZ" />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail de contato</Label>
              <Input
                type="email"
                value={novoClienteEmail}
                onChange={(e) => setNovoClienteEmail(e.target.value)}
                placeholder="contato@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Plataformas utilizadas</Label>
              {MEDIA_PLATFORMS.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={novoClientePlats[p.id]}
                    onCheckedChange={(c) => setNovoClientePlats((prev) => ({ ...prev, [p.id]: c === true }))}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogCliente(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleNovoCliente}>
              Guardar cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogGestor} onOpenChange={setDialogGestor}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar gestor</DialogTitle>
            <DialogDescription>
              Nome, e-mail e telefone. O gestor receberá o convite na AD-Hub (simulado) e, após aceitar, poderá aceder ao dashboard dos clientes
              que lhe atribuir na aba Gestores — sempre dentro desta plataforma.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={novoGestorNome} onChange={(e) => setNovoGestorNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={novoGestorEmail} onChange={(e) => setNovoGestorEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone (opcional)</Label>
              <Input value={novoGestorPhone} onChange={(e) => setNovoGestorPhone(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogGestor(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleInviteGestor}>
              Enviar notificação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GestaoMidias;
