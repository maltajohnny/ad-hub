import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { isPlatformOperator } from "@/lib/saasTypes";
import {
  CLIENT_ONBOARDING_BY_PLATFORM,
  appendAudit,
  authorizeClientPlatformViaApp,
  findManagerRecord,
  getOrgMediaState,
  setPlatformIntegrationConnected,
  hasApiAccessForClient,
  integrationReady,
  MEDIA_PLATFORMS,
  setMediaClientApiAccess,
  setManagerPermissions,
  setSelectedAdAccountsForPlatform,
  syncAllClientsPerformanceMetrics,
  managerSeesClient,
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
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
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
  Bot,
  Loader2,
  WandSparkles,
  CheckCheck,
  Save,
} from "lucide-react";
import {
  askCopyCopyrightGuidance,
  isAiOptimizationConfigured,
  type CopyChatMessage,
  type CopyCopyrightGuidanceResult,
} from "@/services/aiOptimizationService";

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

type GestaoMidiasSubmenu = "operacao" | "copy";

type CopyObjective = "awareness" | "consideration" | "conversion";
type CopyPlatform = "meta-ads" | "google-ads" | "tiktok-ads";
type CopyAiAction = "generate" | "analyze" | "improve" | "rewrite";

type CopyAiRunItem = {
  id: string;
  action: CopyAiAction;
  response: CopyCopyrightGuidanceResult;
  runAt: string;
};

const GestaoMidias = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, listUsers } = useAuth();
  const { tenant, brandingName, brandingLogoSrc } = useTenant();
  const [state, setState] = useState<OrgMediaState | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState<string>("");
  const [newManagerUsername, setNewManagerUsername] = useState<string>("");
  const [adminMainTab, setAdminMainTab] = useState("visao");
  const [copyObjective, setCopyObjective] = useState<CopyObjective>("awareness");
  const [copyAudience, setCopyAudience] = useState("");
  const [copyPainDesire, setCopyPainDesire] = useState("");
  const [copyOffer, setCopyOffer] = useState("");
  const [copyPlatform, setCopyPlatform] = useState<CopyPlatform>("meta-ads");
  const [copyExtraInstruction, setCopyExtraInstruction] = useState("");
  const [copyDraft, setCopyDraft] = useState("");
  const [copyPrimaryText, setCopyPrimaryText] = useState("");
  const [copyHeadline, setCopyHeadline] = useState("");
  const [copyDescription, setCopyDescription] = useState("");
  const [copyGoogleHeadlines, setCopyGoogleHeadlines] = useState("");
  const [copyGoogleDescriptions, setCopyGoogleDescriptions] = useState("");
  const [copyTiktokHook, setCopyTiktokHook] = useState("");
  const [copyTiktokScript, setCopyTiktokScript] = useState("");
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copyLastResult, setCopyLastResult] = useState<CopyCopyrightGuidanceResult | null>(null);
  const [copyRuns, setCopyRuns] = useState<CopyAiRunItem[]>([]);

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

  const mc = searchParams.get("mc");
  const rawSubmenu = searchParams.get("sub");
  const activeSubmenu: GestaoMidiasSubmenu = rawSubmenu === "copy" || rawSubmenu === "copyright" ? "copy" : "operacao";
  const selectableClients = useMemo(() => {
    if (!state) return [];
    if (isOrgAdmin) return state.mediaClients;
    return managerClients;
  }, [state, isOrgAdmin, managerClients]);

  const selectedClient = useMemo(() => {
    if (!selectableClients.length) return undefined;
    const hit = mc && selectableClients.find((c) => c.id === mc);
    return hit ?? selectableClients[0];
  }, [selectableClients, mc]);

  useEffect(() => {
    if (!selectedClient) return;
    if (mc !== selectedClient.id) {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("mc", selectedClient.id);
          return n;
        },
        { replace: true },
      );
    }
  }, [selectedClient, mc, setSearchParams]);

  useEffect(() => {
    setCopyError(null);
  }, [activeSubmenu]);

  const setSubmenu = (next: GestaoMidiasSubmenu) => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (next === "operacao") n.delete("sub");
        else n.set("sub", next);
        return n;
      },
      { replace: true },
    );
  };

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
                variant={selectedClient?.id === c.id ? "default" : "outline"}
                onClick={() =>
                  setSearchParams(
                    (prev) => {
                      const n = new URLSearchParams(prev);
                      n.set("mc", c.id);
                      return n;
                    },
                    { replace: true },
                  )
                }
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
                    <div className="rounded-xl border border-border/50 bg-background/40 p-1">
                      {renderPlatformPanel(pid, selectedClient)}
                    </div>
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
        </div>

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
              <div className="rounded-xl border border-border/50 bg-background/40 p-1">
                {renderPlatformPanel(p.id, selectedClient)}
              </div>
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

  const copyAiHistory: CopyChatMessage[] = copyRuns.flatMap((item) => [
    {
      role: "manager",
      content: `Ação: ${item.action} | Resultado anterior solicitado pelo gestor.`,
    },
    {
      role: "assistant",
      content: item.response.answer,
    },
  ]);

  const copyStepsDone = (() => {
    let done = 1; // objetivo sempre selecionado
    if (copyAudience.trim()) done += 1;
    if (copyPainDesire.trim()) done += 1;
    if (copyOffer.trim()) done += 1;
    if (copyPlatform) done += 1;
    return done;
  })();

  const stepProgress = Math.round((copyStepsDone / 5) * 100);

  const actionLabel = (action: CopyAiAction): string => {
    if (action === "generate") return "Gerar texto com IA";
    if (action === "analyze") return "Analisar texto";
    if (action === "improve") return "Melhorar texto";
    return "Reescrever para mais conversão";
  };

  const objectiveLabel = (objective: CopyObjective): string => {
    if (objective === "awareness") return "Reconhecimento (Topo de funil)";
    if (objective === "consideration") return "Consideração (Meio de funil)";
    return "Conversão (Fundo de funil)";
  };

  const platformLabel = (platform: CopyPlatform): string => {
    if (platform === "meta-ads") return "Meta Ads";
    if (platform === "google-ads") return "Google Ads";
    return "TikTok Ads";
  };

  const buildPlatformCopyContext = (): string => {
    if (copyPlatform === "meta-ads") {
      return `Meta Ads | Texto principal: ${copyPrimaryText || "não informado"} | Título: ${copyHeadline || "não informado"} | Descrição: ${copyDescription || "não informado"}`;
    }
    if (copyPlatform === "google-ads") {
      return `Google Ads | Títulos: ${copyGoogleHeadlines || "não informado"} | Descrições: ${copyGoogleDescriptions || "não informado"}`;
    }
    return `TikTok Ads | Gancho: ${copyTiktokHook || "não informado"} | Copy em estilo roteiro: ${copyTiktokScript || "não informado"}`;
  };

  const applyGeneratedCopyToPlatform = (copyText: string) => {
    if (copyPlatform === "meta-ads") {
      if (!copyPrimaryText.trim()) setCopyPrimaryText(copyText);
      if (!copyHeadline.trim()) setCopyHeadline("Título sugerido pela IA");
    } else if (copyPlatform === "google-ads") {
      if (!copyGoogleHeadlines.trim()) setCopyGoogleHeadlines("Título 1\nTítulo 2\nTítulo 3");
      if (!copyGoogleDescriptions.trim()) setCopyGoogleDescriptions(copyText);
    } else {
      if (!copyTiktokHook.trim()) setCopyTiktokHook("Gancho sugerido pela IA");
      if (!copyTiktokScript.trim()) setCopyTiktokScript(copyText);
    }
  };

  const runCopyAiAction = async (action: CopyAiAction) => {
    if (!isAiOptimizationConfigured()) {
      toast.error("O serviço de IA não está disponível no momento.");
      return;
    }
    if (!copyAudience.trim() || !copyPainDesire.trim() || !copyOffer.trim()) {
      toast.error("Preencha objetivo, público, dor/desejo e oferta antes de usar a IA.");
      return;
    }

    const actionPrompt: Record<CopyAiAction, string> = {
      generate:
        "Com base nos campos do construtor, gere um copy inicial com título, texto principal e CTA, adaptado ao estágio do funil e à plataforma selecionada.",
      analyze:
        "Analise o texto atual e avalie estrutura, clareza e potencial de conversão. Não reescreva completo, foque em diagnóstico objetivo.",
      improve:
        "Melhore o texto atual mantendo a proposta principal, refinando persuasão, clareza e chamada para ação.",
      rewrite:
        "Reescreva o texto para maximizar conversão, com gancho mais forte, oferta mais clara e CTA mais direto.",
    };

    const contextBits = [
      `Tenant: ${tenant.slug}`,
      selectedClient ? `Cliente selecionado: ${selectedClient.name}` : "Cliente selecionado: não definido",
      `Perfil: ${isOrgAdmin ? "Administrador" : "Gestor"}`,
      `Objetivo: ${objectiveLabel(copyObjective)}`,
      `Público-alvo: ${copyAudience}`,
      `Dor/Desejo: ${copyPainDesire}`,
      `Oferta: ${copyOffer}`,
      `Plataforma: ${platformLabel(copyPlatform)}`,
      `Campos por plataforma: ${buildPlatformCopyContext()}`,
      copyExtraInstruction.trim() ? `Instrução adicional: ${copyExtraInstruction.trim()}` : "",
    ].filter(Boolean);

    const currentCopy =
      copyDraft.trim() ||
      copyPrimaryText.trim() ||
      copyGoogleDescriptions.trim() ||
      copyTiktokScript.trim() ||
      undefined;

    setCopyLoading(true);
    setCopyError(null);
    try {
      const response = await askCopyCopyrightGuidance({
        question: actionPrompt[action],
        currentCopy,
        context: contextBits.join(" | "),
        history: copyAiHistory,
      });

      const suggestedCopy = response.improvedCopyExample?.trim() || response.answer.trim();
      if (suggestedCopy) {
        setCopyDraft(suggestedCopy);
        applyGeneratedCopyToPlatform(suggestedCopy);
      }

      setCopyLastResult(response);
      setCopyRuns((prev) => [
        { id: crypto.randomUUID(), action, response, runAt: new Date().toISOString() },
        ...prev,
      ]);
      toast.success(`${actionLabel(action)} concluído.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setCopyError(msg);
      toast.error(msg.length > 120 ? `${msg.slice(0, 120)}…` : msg);
    } finally {
      setCopyLoading(false);
    }
  };

  const renderCopyExperience = () => (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <Card className="p-4 border-border/60 h-fit lg:sticky lg:top-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Navegação</p>
        <p className="mt-2 text-sm font-medium">Gestão de Mídias -&gt; Copy</p>
        <Separator className="my-3" />
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Construção guiada</p>
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <p>1. Objetivo</p>
          <p>2. Público-alvo</p>
          <p>3. Dor / Desejo</p>
          <p>4. Oferta</p>
          <p>5. Plataforma</p>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium">{stepProgress}%</span>
          </div>
          <Progress value={stepProgress} />
        </div>
      </Card>

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Criação de Copy</h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Copy é o texto estratégico que conduz atenção, desperta desejo e leva à ação. Aqui você cria, valida e melhora
            seus anúncios com apoio da IA.
          </p>
        </div>
        <Card className="p-4 border-primary/20 bg-primary/[0.03]">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Fluxo guiado para criar anúncios de alta conversão com sugestões práticas da IA em cada etapa.
          </p>
        </Card>

        <Card className="p-5 border-border/60 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Passo 1: Objetivo</Label>
              <Select value={copyObjective} onValueChange={(v) => setCopyObjective(v as CopyObjective)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="awareness">Reconhecimento (Topo de funil)</SelectItem>
                  <SelectItem value="consideration">Consideração (Meio de funil)</SelectItem>
                  <SelectItem value="conversion">Conversão (Fundo de funil)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="copy-audience">Passo 2: Público-alvo</Label>
              <Input
                id="copy-audience"
                value={copyAudience}
                onChange={(e) => setCopyAudience(e.target.value)}
                placeholder="Descreva a persona que você deseja atingir"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="copy-pain">Passo 3: Dor / Desejo</Label>
              <Input
                id="copy-pain"
                value={copyPainDesire}
                onChange={(e) => setCopyPainDesire(e.target.value)}
                placeholder="Qual principal problema ou desejo desse público?"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="copy-offer">Passo 4: Oferta</Label>
              <Input
                id="copy-offer"
                value={copyOffer}
                onChange={(e) => setCopyOffer(e.target.value)}
                placeholder="O que você está oferecendo e qual seu diferencial?"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Passo 5: Plataforma</Label>
            <Tabs value={copyPlatform} onValueChange={(v) => setCopyPlatform(v as CopyPlatform)}>
              <TabsList className="flex flex-wrap h-auto gap-1">
                <TabsTrigger value="meta-ads">Meta Ads</TabsTrigger>
                <TabsTrigger value="google-ads">Google Ads</TabsTrigger>
                <TabsTrigger value="tiktok-ads">TikTok Ads</TabsTrigger>
              </TabsList>
              <TabsContent value="meta-ads" className="mt-3 space-y-2">
                <Label htmlFor="meta-primary">Texto principal</Label>
                <Textarea id="meta-primary" value={copyPrimaryText} onChange={(e) => setCopyPrimaryText(e.target.value)} />
                <Label htmlFor="meta-headline">Título</Label>
                <Input id="meta-headline" value={copyHeadline} onChange={(e) => setCopyHeadline(e.target.value)} />
                <Label htmlFor="meta-desc">Descrição</Label>
                <Input id="meta-desc" value={copyDescription} onChange={(e) => setCopyDescription(e.target.value)} />
              </TabsContent>
              <TabsContent value="google-ads" className="mt-3 space-y-2">
                <Label htmlFor="google-headlines">Títulos (múltiplos)</Label>
                <Textarea
                  id="google-headlines"
                  value={copyGoogleHeadlines}
                  onChange={(e) => setCopyGoogleHeadlines(e.target.value)}
                  placeholder="Um título por linha"
                />
                <Label htmlFor="google-descriptions">Descrições</Label>
                <Textarea
                  id="google-descriptions"
                  value={copyGoogleDescriptions}
                  onChange={(e) => setCopyGoogleDescriptions(e.target.value)}
                  placeholder="Uma descrição por linha"
                />
              </TabsContent>
              <TabsContent value="tiktok-ads" className="mt-3 space-y-2">
                <Label htmlFor="tiktok-hook">Gancho</Label>
                <Input id="tiktok-hook" value={copyTiktokHook} onChange={(e) => setCopyTiktokHook(e.target.value)} />
                <Label htmlFor="tiktok-script">Copy em estilo roteiro</Label>
                <Textarea id="tiktok-script" value={copyTiktokScript} onChange={(e) => setCopyTiktokScript(e.target.value)} />
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="copy-extra">Contexto adicional para IA (opcional)</Label>
            <Input
              id="copy-extra"
              value={copyExtraInstruction}
              onChange={(e) => setCopyExtraInstruction(e.target.value)}
            placeholder="Ex: manter tom premium e evitar promessas agressivas"
            />
          </div>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <Card className="p-5 border-border/60 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assistente de Copy com IA</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={copyLoading} onClick={() => void runCopyAiAction("generate")} className="gap-2">
                  {copyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                  Gerar copy com IA
                </Button>
                <Button type="button" variant="outline" disabled={copyLoading} onClick={() => void runCopyAiAction("analyze")}>
                  Analisar copy
                </Button>
                <Button type="button" variant="outline" disabled={copyLoading} onClick={() => void runCopyAiAction("improve")}>
                  Melhorar copy
                </Button>
                <Button type="button" variant="outline" disabled={copyLoading} onClick={() => void runCopyAiAction("rewrite")}>
                  Reescrever para mais conversão
                </Button>
              </div>
              {copyError ? (
                <Alert variant="destructive">
                  <AlertDescription>{copyError}</AlertDescription>
                </Alert>
              ) : null}
            </Card>

            <Card className="p-5 border-border/60 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Editor de copy</p>
              <Textarea
                value={copyDraft}
                onChange={(e) => setCopyDraft(e.target.value)}
                className="min-h-40"
                placeholder="A IA gera o copy aqui. Edite manualmente e rode novas ações."
              />
              {copyLastResult?.suggestedAdjustments?.length ? (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Sugestões inline para ajuste</p>
                  <div className="flex flex-wrap gap-1.5">
                    {copyLastResult.suggestedAdjustments.map((s, i) => (
                      <Badge key={i} variant="secondary">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>

            <Card className="p-5 border-border/60">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Ações finais</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => toast.success("Texto aplicado ao anúncio atual.")}>
                  Usar neste anúncio
                </Button>
                <Button type="button" variant="outline" onClick={() => toast.success("Texto enviado para o fluxo de campanha.")}>
                  Enviar para campanha
                </Button>
                <Button type="button" variant="outline" className="gap-2" onClick={() => toast.success("Versão do texto salva.")}>
                  <Save className="h-4 w-4" />
                  Salvar versão
                </Button>
              </div>
            </Card>
          </div>

          <Card className="p-4 border-border/60 h-fit xl:sticky xl:top-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Bot className="h-4 w-4 text-primary" />
              Insight de performance
            </p>
            {copyLastResult ? (
              <div className="mt-3 space-y-3">
                <Badge
                  variant={
                    copyLastResult.suggestedAdjustments.length >= 3
                      ? "secondary"
                      : copyLastResult.suggestedAdjustments.length >= 1
                        ? "outline"
                        : "default"
                  }
                >
                  {copyLastResult.suggestedAdjustments.length >= 3
                    ? "Este copy está médio"
                    : copyLastResult.suggestedAdjustments.length >= 1
                      ? "Este copy está bom"
                      : "Este copy está forte"}
                </Badge>
                <p className="text-sm leading-relaxed">{copyLastResult.structureAssessment}</p>
                <p className="text-sm leading-relaxed">{copyLastResult.conversionAssessment}</p>
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                  <p className="text-xs font-semibold text-primary mb-1">Direção recomendada</p>
                  <p className="text-sm leading-relaxed">{copyLastResult.suggestedDecision}</p>
                </div>
                {copyLastResult.suggestedAdjustments.length > 0 ? (
                  <ul className="list-disc pl-4 text-sm space-y-1">
                    {copyLastResult.suggestedAdjustments.map((line, idx) => (
                      <li key={idx}>{line}</li>
                    ))}
                  </ul>
                ) : null}
                {copyLastResult.strengths.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">Pontos fortes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {copyLastResult.strengths.map((line, idx) => (
                        <Badge key={idx} variant="secondary" className="gap-1">
                          <CheckCheck className="h-3 w-3" />
                          {line}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Preencha os passos e execute uma acao da IA para ver diagnostico de persuasao, clareza e potencial de
                conversao.
              </p>
            )}
            {copyRuns.length > 0 ? (
              <div className="mt-4 pt-3 border-t border-border/50">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Histórico rápido</p>
                <div className="space-y-1.5">
                  {copyRuns.slice(0, 4).map((run) => (
                    <div key={run.id} className="rounded-md border border-border/50 bg-secondary/20 px-2.5 py-2">
                      <p className="text-xs font-medium">{actionLabel(run.action)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(run.runAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="p-6 border-primary/25">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4 min-w-0">
            {selectedClient ? (
              <div className="h-12 w-12 shrink-0 rounded-lg bg-teal-500/15 flex items-center justify-center font-bold text-teal-600 dark:text-teal-300 text-lg border border-teal-500/25">
                {selectedClient.name.slice(0, 1).toUpperCase()}
              </div>
            ) : brandingLogoSrc ? (
              <img src={brandingLogoSrc} alt={brandingName} className="h-12 w-auto max-w-[180px] object-contain" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-primary/15 flex items-center justify-center font-bold text-primary">
                {brandingName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-display font-bold">Gestão de Mídias</h1>
              {selectedClient ? (
                <>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium text-foreground">{selectedClient.name}</span>
                    <span className="text-muted-foreground"> · {selectedClient.email}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedClient.platformIds.map((pid) => (
                      <Badge key={pid} variant="secondary">
                        {MEDIA_PLATFORMS.find((x) => x.id === pid)?.label ?? pid}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 max-w-2xl leading-relaxed">
                    Campanhas, conjuntos e anúncios para este cliente estão nas abas por rede. A área de cada separador corresponde à perspetiva
                    da plataforma (login oficial + iframe ou API).
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium text-foreground">{brandingName}</span> · {tenantDomain}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 max-w-2xl leading-relaxed">
                    Cadastre clientes e convide gestores em <strong className="text-foreground">Clientes → Cadastrar e organização</strong>.
                    Depois, volte aqui para autorizar redes e operar por cliente.
                  </p>
                </>
              )}
            </div>
          </div>
          <Badge variant="outline" className="shrink-0">
            {tenant.slug}
          </Badge>
        </div>
      </Card>

      <Card className="p-2 border-border/60">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={activeSubmenu === "operacao" ? "default" : "outline"}
            onClick={() => setSubmenu("operacao")}
          >
            Operação de Mídias
          </Button>
          <Button
            type="button"
            variant={activeSubmenu === "copy" ? "default" : "outline"}
            onClick={() => setSubmenu("copy")}
          >
            Copy
          </Button>
        </div>
      </Card>

      {activeSubmenu === "operacao"
        ? isOrgAdmin
          ? renderAdminExperience()
          : renderManagerExperience()
        : renderCopyExperience()}
    </div>
  );
};

export default GestaoMidias;
