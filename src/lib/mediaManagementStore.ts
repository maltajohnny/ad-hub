import { clientsData } from "@/data/clientsCatalog";

const STORAGE_V1 = "norter_media_management_v1";
const STORAGE_V2 = "norter_media_management_v2";

export const MEDIA_PLATFORMS = [
  { id: "meta-ads", label: "Meta Ads" },
  { id: "instagram-ads", label: "Instagram Ads" },
  { id: "google-ads", label: "Google Ads" },
  { id: "tiktok-ads", label: "TikTok Ads" },
] as const;

export type MediaPlatformId = (typeof MEDIA_PLATFORMS)[number]["id"];

/** Permissões dentro da plataforma (gestor não é owner). */
export type PlatformCapability = {
  platformId: MediaPlatformId;
  canManageCampaigns: boolean;
  canManageAdSets: boolean;
  canManageAds: boolean;
  canCreateCampaigns: boolean;
  canEditCreatives: boolean;
  canViewMetrics: boolean;
};

export type ManagerPermission = {
  /** ID do cliente cadastrado no módulo (não confundir com demo `clientsData`). */
  mediaClientId: string;
  platforms: PlatformCapability[];
};

export type MediaManager = {
  id: string;
  /** Conta SaaS vinculada, quando existir. */
  username: string | null;
  name: string;
  email: string;
  phone?: string;
  active: boolean;
  permissions: ManagerPermission[];
  invitedAt?: string;
};

export type MediaAd = {
  id: string;
  name: string;
  creativeType: "Imagem" | "Video" | "Carrossel" | "Texto";
  status: "Ativo" | "Pausado" | "Em revisao";
  cta?: string;
};

export type MediaAdSet = {
  id: string;
  name: string;
  budget: number;
  audience: string;
  status: "Ativa" | "Pausada";
  ads: MediaAd[];
};

export type MediaCampaign = {
  id: string;
  mediaClientId: string;
  platformId: MediaPlatformId;
  name: string;
  objective: string;
  budget: number;
  startDate: string;
  endDate: string;
  status: "Ativa" | "Pausada";
  spend: number;
  clicks: number;
  conversions: number;
  adSets: MediaAdSet[];
};

export type MediaCreative = {
  id: string;
  mediaClientId: string;
  platformId: MediaPlatformId;
  title: string;
  type: "Imagem" | "Video" | "Carrossel";
  status: "Aprovado" | "Em revisao";
};

export type MediaIntegration = {
  platformId: MediaPlatformId;
  connected: boolean;
  provider: string;
  updatedAt: string;
};

export type MediaConnectionStatus = "not-connected" | "connected" | "expired" | "error" | "syncing";

export type MediaClientPlatformConnection = {
  platformId: MediaPlatformId;
  status: MediaConnectionStatus;
  provider: "oauth-official";
  externalAccountLabel?: string;
  externalAccountId?: string;
  connectedAt?: string;
  updatedAt: string;
  lastSyncAt?: string;
  lastError?: string;
};

/** Conta de anúncio detetada após OAuth (ex.: várias contas no mesmo e-mail). */
export type ManagedAdAccountRef = {
  externalId: string;
  name: string;
};

/** KPIs agregados sincronizados das APIs das redes (simulado no browser; em produção vem do backend). */
export type ClientPerformanceMetrics = {
  totalSpend: number;
  roi: number;
  cpa: number;
  currency: string;
  syncedAt: string;
};

export type MediaClient = {
  id: string;
  name: string;
  email: string;
  /** Cadastro feito pelo módulo Clientes (OAuth / alias). */
  registrationSource?: "clientes";
  platformIds: MediaPlatformId[];
  platformConnections: Partial<Record<MediaPlatformId, MediaClientPlatformConnection>>;
  /** Permissões concedidas pelo cliente (API / Business Manager). */
  apiAccessByPlatform: Partial<Record<MediaPlatformId, boolean>>;
  /** Contas geridas detetadas por plataforma após OAuth. */
  managedAdAccountsByPlatform?: Partial<Record<MediaPlatformId, ManagedAdAccountRef[]>>;
  /** Contas externas escolhidas para este cliente (IDs em managedAdAccountsByPlatform). */
  selectedAdAccountIdsByPlatform?: Partial<Record<MediaPlatformId, string[]>>;
  /** Última sincronização de investimento, ROI e CPA. */
  performanceMetrics?: ClientPerformanceMetrics;
  /** `api` = valores vindos da Graph / TikTok API (não recalcular a partir de campanhas locais). */
  performanceMetricsSource?: "campaigns" | "api";
  createdAt: string;
};

export type MediaAuditEntry = {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
};

export type OrgMediaState = {
  orgId: string;
  mediaClients: MediaClient[];
  managers: MediaManager[];
  campaigns: MediaCampaign[];
  creatives: MediaCreative[];
  integrations: MediaIntegration[];
  auditLog: MediaAuditEntry[];
  updatedAt: string;
};

/**
 * Orientações para o cliente no fluxo guiado pela plataforma (sem depender de o cliente dominar
 * Business Manager ou consolas nativas — a autorização é feita no convite / assistente Norter).
 */
export const CLIENT_ONBOARDING_BY_PLATFORM: Record<MediaPlatformId, string[]> = {
  "meta-ads": [
    "O cliente convida o e-mail do teu administrador ou gestor no Business Manager / conta de anúncios.",
    "No módulo Gestão de Mídias, ao abrir Meta Ads, usa esse mesmo e-mail no login Facebook — a sessão liga-te à conta do cliente.",
  ],
  "instagram-ads": [
    "Mesma identidade Meta: o e-mail convidado pelo cliente é o que deves usar no fluxo de login ao abrir Instagram Ads.",
  ],
  "google-ads": [
    "O cliente concede acesso na conta Google Ads ao e-mail indicado; esse e-mail usas no login Google ao abrir esta aba.",
  ],
  "tiktok-ads": [
    "Convite do cliente na TikTok Ads Manager para o teu e-mail; no login TikTok deste módulo usas esse acesso.",
  ],
};

function nowIso(): string {
  return new Date().toISOString();
}

function readMap(): Record<string, OrgMediaState> {
  try {
    const v2 = localStorage.getItem(STORAGE_V2);
    if (v2) {
      const parsed = JSON.parse(v2) as Record<string, OrgMediaState>;
      return parsed && typeof parsed === "object" ? parsed : {};
    }
    const v1 = localStorage.getItem(STORAGE_V1);
    if (v1) {
      const migrated = migrateV1JsonToV2(v1);
      localStorage.setItem(STORAGE_V2, JSON.stringify(migrated));
      return migrated;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function writeMap(map: Record<string, OrgMediaState>) {
  localStorage.setItem(STORAGE_V2, JSON.stringify(map));
}

type LegacyV1 = {
  orgId: string;
  managers: {
    id: string;
    username: string;
    name: string;
    email: string;
    active: boolean;
    permissions: { clientId: number; platformIds: MediaPlatformId[] }[];
  }[];
  campaigns: {
    id: string;
    clientId: number;
    platformId: MediaPlatformId;
    name: string;
    status: "Ativa" | "Pausada";
    spend: number;
    clicks: number;
    conversions: number;
  }[];
  creatives: {
    id: string;
    clientId: number;
    platformId: MediaPlatformId;
    title: string;
    type: "Imagem" | "Video" | "Carrossel";
    status: "Aprovado" | "Em revisao";
  }[];
  integrations: MediaIntegration[];
  updatedAt: string;
};

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

function defaultPlatformConnection(platformId: MediaPlatformId): MediaClientPlatformConnection {
  return {
    platformId,
    status: "not-connected",
    provider: "oauth-official",
    updatedAt: nowIso(),
  };
}

function seededConnection(platformId: MediaPlatformId, connected: boolean): MediaClientPlatformConnection {
  if (!connected) return defaultPlatformConnection(platformId);
  return {
    platformId,
    status: "connected",
    provider: "oauth-official",
    externalAccountLabel: "Conta principal",
    externalAccountId: crypto.randomUUID().slice(0, 8),
    connectedAt: nowIso(),
    updatedAt: nowIso(),
    lastSyncAt: nowIso(),
  };
}

function migrateV1JsonToV2(raw: string): Record<string, OrgMediaState> {
  let parsed: Record<string, LegacyV1>;
  try {
    parsed = JSON.parse(raw) as Record<string, LegacyV1>;
  } catch {
    return {};
  }
  const out: Record<string, OrgMediaState> = {};
  for (const [orgId, leg] of Object.entries(parsed)) {
    if (!leg || typeof leg !== "object") continue;
    const idMap = new Map<number, string>();
    const mediaClients: MediaClient[] = [];
    const seen = new Set<number>();
    const legacyIds = new Set<number>();
    for (const c of leg.campaigns ?? []) legacyIds.add(c.clientId);
    for (const m of leg.managers ?? []) {
      for (const p of m.permissions ?? []) legacyIds.add(p.clientId);
    }
    for (const cid of legacyIds) {
      if (!seen.has(cid)) {
        seen.add(cid);
        const id = crypto.randomUUID();
        idMap.set(cid, id);
        const demo = clientsData.find((d) => d.id === cid);
        mediaClients.push({
          id,
          name: demo?.name ?? `Cliente ${cid}`,
          email: demo?.email ?? "contato@cliente.com",
          platformIds: ["meta-ads", "instagram-ads", "google-ads"],
          platformConnections: {
            "meta-ads": seededConnection("meta-ads", true),
            "instagram-ads": seededConnection("instagram-ads", true),
            "google-ads": seededConnection("google-ads", true),
            "tiktok-ads": seededConnection("tiktok-ads", false),
          },
          apiAccessByPlatform: { "meta-ads": true, "instagram-ads": true, "google-ads": true, "tiktok-ads": false },
          createdAt: nowIso(),
        });
      }
    }
    const campaigns: MediaCampaign[] = (leg.campaigns ?? []).map((c) => {
      const mcId = idMap.get(c.clientId) ?? mediaClients[0]?.id ?? crypto.randomUUID();
      return {
        id: c.id,
        mediaClientId: mcId,
        platformId: c.platformId,
        name: c.name,
        objective: "Conversões",
        budget: 5000,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        status: c.status,
        spend: c.spend,
        clicks: c.clicks,
        conversions: c.conversions,
        adSets: seedAdSetsForCampaign(c.name),
      };
    });
    const creatives: MediaCreative[] = (leg.creatives ?? []).map((cr) => ({
      ...cr,
      mediaClientId: idMap.get(cr.clientId) ?? mediaClients[0]?.id ?? "",
    }));
    const managers: MediaManager[] = (leg.managers ?? []).map((m) => ({
      ...m,
      username: m.username,
      phone: undefined,
      permissions: (m.permissions ?? [])
        .map((p) => {
          const mcId = idMap.get(p.clientId) ?? mediaClients[0]?.id;
          if (!mcId) return null;
          return {
            mediaClientId: mcId,
            platforms: (p.platformIds ?? []).map((pid) => defaultCaps(pid)),
          };
        })
        .filter((x): x is ManagerPermission => x !== null),
    }));
    out[orgId] = {
      orgId,
      mediaClients,
      managers,
      campaigns,
      creatives,
      integrations: leg.integrations ?? seedIntegrations(),
      auditLog: [],
      updatedAt: nowIso(),
    };
  }
  return out;
}

function seedAdSetsForCampaign(campaignName: string): MediaAdSet[] {
  return [
    {
      id: crypto.randomUUID(),
      name: `Conjunto · ${campaignName.slice(0, 24)} A`,
      budget: 1200,
      audience: "Interesses + remarketing",
      status: "Ativa",
      ads: [
        {
          id: crypto.randomUUID(),
          name: "Anúncio estático A",
          creativeType: "Imagem",
          status: "Ativo",
          cta: "Saiba mais",
        },
        {
          id: crypto.randomUUID(),
          name: "Anúncio vídeo B",
          creativeType: "Video",
          status: "Ativo",
          cta: "Comprar",
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: `Conjunto · Lookalike`,
      budget: 800,
      audience: "Lookalike 1% compradores",
      status: "Pausada",
      ads: [
        {
          id: crypto.randomUUID(),
          name: "Carrossel produtos",
          creativeType: "Carrossel",
          status: "Em revisao",
          cta: "Ver loja",
        },
      ],
    },
  ];
}

function seedMediaClients(): MediaClient[] {
  return clientsData.slice(0, 5).map((c) => ({
    id: crypto.randomUUID(),
    name: c.name,
    email: c.email,
    platformIds: ["meta-ads", "instagram-ads", "google-ads"] as MediaPlatformId[],
    platformConnections: {
      "meta-ads": seededConnection("meta-ads", true),
      "instagram-ads": seededConnection("instagram-ads", true),
      "google-ads": seededConnection("google-ads", true),
      "tiktok-ads": seededConnection("tiktok-ads", false),
    },
    apiAccessByPlatform: {
      "meta-ads": true,
      "instagram-ads": true,
      "google-ads": true,
      "tiktok-ads": false,
    },
    createdAt: nowIso(),
  }));
}

function seedCampaigns(mediaClients: MediaClient[]): MediaCampaign[] {
  const platforms: MediaPlatformId[] = ["meta-ads", "instagram-ads", "google-ads"];
  return mediaClients.flatMap((client, idx) =>
    platforms.map((platformId, pi) => ({
      id: `${client.id}-${platformId}-cmp`,
      mediaClientId: client.id,
      platformId,
      name: `${client.name} · Campanha ${pi + 1}`,
      objective: pi === 0 ? "Conversões" : pi === 1 ? "Tráfego" : "Alcance",
      budget: 4000 + idx * 200 + pi * 300,
      startDate: "2026-03-01",
      endDate: "2026-06-30",
      status: idx % 4 === 0 && pi === 0 ? ("Pausada" as const) : ("Ativa" as const),
      spend: 2000 + idx * 300 + pi * 450,
      clicks: 1200 + idx * 120 + pi * 80,
      conversions: 80 + idx * 12 + pi * 10,
      adSets: seedAdSetsForCampaign(`${client.name} ${pi + 1}`),
    })),
  );
}

function seedCreatives(mediaClients: MediaClient[]): MediaCreative[] {
  const types: MediaCreative["type"][] = ["Imagem", "Video", "Carrossel"];
  return mediaClients.flatMap((client, idx) =>
    (["meta-ads", "instagram-ads", "google-ads"] as MediaPlatformId[]).map((platformId, pi) => ({
      id: `${client.id}-${platformId}-crt`,
      mediaClientId: client.id,
      platformId,
      title: `${client.name} · Criativo ${types[(idx + pi) % types.length]}`,
      type: types[(idx + pi) % types.length],
      status: idx % 3 === 0 ? ("Em revisao" as const) : ("Aprovado" as const),
    })),
  );
}

function seedIntegrations(): MediaIntegration[] {
  return MEDIA_PLATFORMS.map((platform, i) => ({
    platformId: platform.id,
    connected: i < 3,
    provider: "API oficial",
    updatedAt: nowIso(),
  }));
}

function seedOrgState(orgId: string): OrgMediaState {
  const mediaClients = seedMediaClients();
  return {
    orgId,
    mediaClients,
    managers: [],
    campaigns: seedCampaigns(mediaClients),
    creatives: seedCreatives(mediaClients),
    integrations: seedIntegrations(),
    auditLog: [],
    updatedAt: nowIso(),
  };
}

export function computeMetricsFromCampaigns(state: OrgMediaState, clientId: string): ClientPerformanceMetrics {
  const camps = state.campaigns.filter((c) => c.mediaClientId === clientId);
  const totalSpend = camps.reduce((s, c) => s + c.spend, 0);
  const conversions = camps.reduce((s, c) => s + c.conversions, 0);
  const cpa = conversions > 0 ? totalSpend / conversions : 0;
  const revenue = conversions * 135;
  const roi = totalSpend > 0 ? (revenue - totalSpend) / totalSpend : 0;
  return {
    totalSpend,
    roi,
    cpa,
    currency: "BRL",
    syncedAt: nowIso(),
  };
}

export function getOrgMediaState(orgId: string): OrgMediaState {
  const map = readMap();
  const existing = map[orgId];
  if (existing && existing.mediaClients?.length) {
    return {
      ...existing,
      mediaClients: existing.mediaClients.map((c) => ({
        ...c,
        performanceMetrics:
          c.performanceMetricsSource === "api" && c.performanceMetrics
            ? c.performanceMetrics
            : (c.performanceMetrics ?? computeMetricsFromCampaigns(existing, c.id)),
        managedAdAccountsByPlatform: c.managedAdAccountsByPlatform ?? {},
        selectedAdAccountIdsByPlatform: c.selectedAdAccountIdsByPlatform ?? {},
      })),
    };
  }
  const seeded = seedOrgState(orgId);
  map[orgId] = seeded;
  writeMap(map);
  return seeded;
}

export function saveOrgMediaState(state: OrgMediaState): void {
  const map = readMap();
  map[state.orgId] = { ...state, updatedAt: nowIso() };
  writeMap(map);
}

/** Recalcula investimento, ROI e CPA a partir das campanhas sincronizadas (substituível por resposta da API). */
export function syncClientPerformanceMetrics(orgId: string, mediaClientId: string): OrgMediaState {
  const state = getOrgMediaState(orgId);
  const client = state.mediaClients.find((x) => x.id === mediaClientId);
  if (client?.performanceMetricsSource === "api") {
    return state;
  }
  const metrics = computeMetricsFromCampaigns(state, mediaClientId);
  const mediaClients = state.mediaClients.map((c) =>
    c.id === mediaClientId ? { ...c, performanceMetrics: metrics } : c,
  );
  const next = { ...state, mediaClients, updatedAt: nowIso() };
  saveOrgMediaState(next);
  return next;
}

export function syncAllClientsPerformanceMetrics(orgId: string): OrgMediaState {
  let state = getOrgMediaState(orgId);
  for (const c of state.mediaClients) {
    state = syncClientPerformanceMetrics(orgId, c.id);
  }
  return state;
}

export function appendAudit(orgId: string, actor: string, action: string, detail: string): OrgMediaState {
  const state = getOrgMediaState(orgId);
  const entry: MediaAuditEntry = {
    id: crypto.randomUUID(),
    at: nowIso(),
    actor,
    action,
    detail,
  };
  const auditLog = [entry, ...(state.auditLog ?? [])].slice(0, 200);
  const next = { ...state, auditLog };
  saveOrgMediaState(next);
  return next;
}

export function addMediaClient(
  orgId: string,
  input: Pick<MediaClient, "name" | "email" | "platformIds">,
  options?: { registrationSource?: MediaClient["registrationSource"] },
): OrgMediaState {
  const state = getOrgMediaState(orgId);
  const apiAccessByPlatform: Partial<Record<MediaPlatformId, boolean>> = {};
  const platformConnections: Partial<Record<MediaPlatformId, MediaClientPlatformConnection>> = {};
  for (const p of input.platformIds) {
    apiAccessByPlatform[p] = false;
    platformConnections[p] = defaultPlatformConnection(p);
  }
  const client: MediaClient = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    email: input.email.trim(),
    registrationSource: options?.registrationSource,
    platformIds: input.platformIds,
    platformConnections,
    apiAccessByPlatform,
    managedAdAccountsByPlatform: {},
    selectedAdAccountIdsByPlatform: {},
    createdAt: nowIso(),
  };
  const next = { ...state, mediaClients: [...state.mediaClients, client] };
  saveOrgMediaState(next);
  return syncClientPerformanceMetrics(orgId, client.id);
}

/** Remove cliente de mídia e referências em campanhas/criativos (ex.: cancelar cadastro OAuth em curso). */
export function removeMediaClient(orgId: string, mediaClientId: string): OrgMediaState {
  const state = getOrgMediaState(orgId);
  const mediaClients = state.mediaClients.filter((c) => c.id !== mediaClientId);
  const campaigns = state.campaigns.filter((c) => c.mediaClientId !== mediaClientId);
  const creatives = state.creatives.filter((c) => c.mediaClientId !== mediaClientId);
  const next = { ...state, mediaClients, campaigns, creatives, updatedAt: nowIso() };
  saveOrgMediaState(next);
  return next;
}

export function setMediaClientApiAccess(
  orgId: string,
  mediaClientId: string,
  platformId: MediaPlatformId,
  granted: boolean,
): OrgMediaState {
  const state = getOrgMediaState(orgId);
  const mediaClients = state.mediaClients.map((c) =>
    c.id === mediaClientId
      ? { ...c, apiAccessByPlatform: { ...c.apiAccessByPlatform, [platformId]: granted } }
      : c,
  );
  const next = { ...state, mediaClients };
  saveOrgMediaState(next);
  return next;
}

export function setMediaClientConnectionStatus(
  orgId: string,
  mediaClientId: string,
  platformId: MediaPlatformId,
  status: MediaConnectionStatus,
  patch?: Partial<MediaClientPlatformConnection>,
): OrgMediaState {
  const state = getOrgMediaState(orgId);
  const mediaClients = state.mediaClients.map((c) => {
    if (c.id !== mediaClientId) return c;
    const current = c.platformConnections[platformId] ?? defaultPlatformConnection(platformId);
    const nextConn: MediaClientPlatformConnection = {
      ...current,
      ...patch,
      platformId,
      status,
      updatedAt: nowIso(),
    };
    return {
      ...c,
      platformConnections: { ...c.platformConnections, [platformId]: nextConn },
      apiAccessByPlatform: { ...c.apiAccessByPlatform, [platformId]: status === "connected" },
    };
  });
  const next = { ...state, mediaClients };
  saveOrgMediaState(next);
  return next;
}

/**
 * Simula o cliente a concluir a autorização (convite + OAuth). Em produção, o backend troca o código e persiste tokens.
 * Após sucesso, lista contas gerenciadas detetadas e atualiza KPIs.
 */
export function authorizeClientPlatformViaApp(
  orgId: string,
  mediaClientId: string,
  platformId: MediaPlatformId,
  options?: { deferAccountSelection?: boolean },
): OrgMediaState {
  setMediaClientConnectionStatus(orgId, mediaClientId, platformId, "syncing");
  const labelByPlatform: Record<MediaPlatformId, string> = {
    "meta-ads": "Conta Meta (via AD-Hub)",
    "instagram-ads": "Instagram (via AD-Hub)",
    "google-ads": "Google Ads (via AD-Hub)",
    "tiktok-ads": "TikTok Ads (via AD-Hub)",
  };
  setMediaClientConnectionStatus(orgId, mediaClientId, platformId, "connected", {
    provider: "oauth-official",
    externalAccountLabel: labelByPlatform[platformId],
    externalAccountId: crypto.randomUUID().slice(0, 10),
    connectedAt: nowIso(),
    lastSyncAt: nowIso(),
    lastError: undefined,
  });
  setPlatformIntegrationConnected(orgId, platformId, true);
  mergeManagedAdAccountsAfterOAuth(orgId, mediaClientId, platformId, {
    selectAllNew: !options?.deferAccountSelection,
  });
  return syncClientPerformanceMetrics(orgId, mediaClientId);
}

function mergeManagedAdAccountsAfterOAuth(
  orgId: string,
  mediaClientId: string,
  platformId: MediaPlatformId,
  opts?: { selectAllNew?: boolean },
): OrgMediaState {
  const state = getOrgMediaState(orgId);
  const client = state.mediaClients.find((c) => c.id === mediaClientId);
  if (!client) return state;
  const discovered: ManagedAdAccountRef[] = [
    { externalId: `act_${mediaClientId.replace(/-/g, "").slice(0, 12)}`, name: `${client.name} · conta principal` },
    { externalId: `act_${mediaClientId.replace(/-/g, "").slice(0, 12)}_2`, name: "Conta gerenciada (mesmo e-mail)" },
  ];
  const prev = client.managedAdAccountsByPlatform?.[platformId] ?? [];
  const merged: ManagedAdAccountRef[] = [...prev];
  for (const d of discovered) {
    if (!merged.some((m) => m.externalId === d.externalId)) merged.push(d);
  }
  const existingSel = client.selectedAdAccountIdsByPlatform?.[platformId];
  const selectAll = opts?.selectAllNew !== false;
  const nextSelected = selectAll
    ? existingSel?.length
      ? existingSel
      : discovered.map((d) => d.externalId)
    : existingSel?.length
      ? existingSel
      : [];
  const mediaClients = state.mediaClients.map((c) => {
    if (c.id !== mediaClientId) return c;
    return {
      ...c,
      managedAdAccountsByPlatform: { ...c.managedAdAccountsByPlatform, [platformId]: merged },
      selectedAdAccountIdsByPlatform: { ...c.selectedAdAccountIdsByPlatform, [platformId]: nextSelected },
    };
  });
  const next = { ...state, mediaClients, updatedAt: nowIso() };
  saveOrgMediaState(next);
  return next;
}

/** Gestor escolhe quais contas de anúncio externas aplicam a este cliente (permissões granulares). */
export function setSelectedAdAccountsForPlatform(
  orgId: string,
  mediaClientId: string,
  platformId: MediaPlatformId,
  externalIds: string[],
): OrgMediaState {
  const state = getOrgMediaState(orgId);
  const allowed = new Set(
    state.mediaClients.find((c) => c.id === mediaClientId)?.managedAdAccountsByPlatform?.[platformId]?.map((a) => a.externalId) ?? [],
  );
  const filtered = externalIds.filter((id) => allowed.has(id));
  const mediaClients = state.mediaClients.map((c) => {
    if (c.id !== mediaClientId) return c;
    return {
      ...c,
      selectedAdAccountIdsByPlatform: { ...c.selectedAdAccountIdsByPlatform, [platformId]: filtered },
    };
  });
  const next = { ...state, mediaClients, updatedAt: nowIso() };
  saveOrgMediaState(next);
  return syncClientPerformanceMetrics(orgId, mediaClientId);
}

/**
 * Ligação real pós-OAuth: contas descobertas na API, seleção do gestor e KPIs agregados (Graph / TikTok via backend).
 */
/** Atualiza só KPIs no cliente (ex.: botão «Atualizar métricas» com dados do servidor). */
export function updateClientApiPerformanceMetrics(
  orgId: string,
  mediaClientId: string,
  metrics: ClientPerformanceMetrics,
): OrgMediaState {
  const state = getOrgMediaState(orgId);
  const mediaClients = state.mediaClients.map((c) =>
    c.id === mediaClientId
      ? { ...c, performanceMetrics: metrics, performanceMetricsSource: "api" as const }
      : c,
  );
  const next = { ...state, mediaClients, updatedAt: nowIso() };
  saveOrgMediaState(next);
  return next;
}

export function applyExternalPlatformLink(
  orgId: string,
  mediaClientId: string,
  platformId: MediaPlatformId,
  input: {
    accounts: ManagedAdAccountRef[];
    selectedExternalIds: string[];
    metrics: ClientPerformanceMetrics;
    connectionLabel?: string;
  },
): OrgMediaState {
  const state = getOrgMediaState(orgId);
  const labelByPlatform: Record<MediaPlatformId, string> = {
    "meta-ads": "Meta Ads (API)",
    "instagram-ads": "Instagram Ads (API)",
    "google-ads": "Google Ads (API)",
    "tiktok-ads": "TikTok Ads (API)",
  };
  const primaryId = input.selectedExternalIds[0];
  const mediaClients = state.mediaClients.map((c) => {
    if (c.id !== mediaClientId) return c;
    const prevConn = c.platformConnections[platformId] ?? defaultPlatformConnection(platformId);
    return {
      ...c,
      managedAdAccountsByPlatform: { ...c.managedAdAccountsByPlatform, [platformId]: input.accounts },
      selectedAdAccountIdsByPlatform: { ...c.selectedAdAccountIdsByPlatform, [platformId]: input.selectedExternalIds },
      platformConnections: {
        ...c.platformConnections,
        [platformId]: {
          ...prevConn,
          platformId,
          status: "connected" as MediaConnectionStatus,
          provider: "oauth-official",
          externalAccountLabel: input.connectionLabel ?? labelByPlatform[platformId],
          externalAccountId: primaryId,
          connectedAt: prevConn.connectedAt ?? nowIso(),
          lastSyncAt: nowIso(),
          updatedAt: nowIso(),
          lastError: undefined,
        },
      },
      apiAccessByPlatform: { ...c.apiAccessByPlatform, [platformId]: true },
      performanceMetrics: input.metrics,
      performanceMetricsSource: "api" as const,
    };
  });
  const next = { ...state, mediaClients, updatedAt: nowIso() };
  saveOrgMediaState(next);
  setPlatformIntegrationConnected(orgId, platformId, true);
  return getOrgMediaState(orgId);
}

export function upsertManager(orgId: string, manager: MediaManager): OrgMediaState {
  const state = getOrgMediaState(orgId);
  const i = state.managers.findIndex((m) => m.id === manager.id);
  const managers = [...state.managers];
  if (i >= 0) managers[i] = manager;
  else managers.push(manager);
  const next = { ...state, managers, updatedAt: nowIso() };
  saveOrgMediaState(next);
  return next;
}

export function setManagerPermissions(orgId: string, managerId: string, permissions: ManagerPermission[]): OrgMediaState {
  const state = getOrgMediaState(orgId);
  const managers = state.managers.map((m) => (m.id === managerId ? { ...m, permissions } : m));
  const next = { ...state, managers, updatedAt: nowIso() };
  saveOrgMediaState(next);
  return next;
}

/** Verifica se o cliente concedeu permissão de API para a plataforma (para UI centralizada). */
export function hasApiAccessForClient(
  client: MediaClient | undefined,
  platformId: MediaPlatformId,
): boolean {
  if (!client) return false;
  return client.apiAccessByPlatform[platformId] === true;
}

export function integrationReady(state: OrgMediaState, platformId: MediaPlatformId): boolean {
  return state.integrations.some((i) => i.platformId === platformId && i.connected);
}

/** Canal API da organização ativo para uma rede (ex.: após o cliente autorizar no portal). */
export function setPlatformIntegrationConnected(orgId: string, platformId: MediaPlatformId, connected: boolean): OrgMediaState {
  const state = getOrgMediaState(orgId);
  const integrations = state.integrations.map((i) =>
    i.platformId === platformId ? { ...i, connected, updatedAt: nowIso() } : i,
  );
  const next = { ...state, integrations, updatedAt: nowIso() };
  saveOrgMediaState(next);
  return next;
}

