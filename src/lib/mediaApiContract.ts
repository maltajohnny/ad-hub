import type { MediaPlatformId } from "@/lib/mediaManagementStore";

/**
 * Contrato REST para backend (OAuth + sync). O front atual usa `localStorage` + redirects;
 * estas rotas são o alvo de implementação em Node/Go com credenciais no servidor.
 */
export const MEDIA_API_BASE = "/api/v1/media";

export const MediaOAuthRoutes = {
  /** GET — inicia OAuth Meta: devolve URL de autorização ou 302 */
  metaAuthorize: `${MEDIA_API_BASE}/oauth/meta/authorize`,
  /** POST — code + state → tokens armazenados por org/cliente */
  metaCallback: `${MEDIA_API_BASE}/oauth/meta/callback`,
  googleAuthorize: `${MEDIA_API_BASE}/oauth/google/authorize`,
  googleCallback: `${MEDIA_API_BASE}/oauth/google/callback`,
  tiktokAuthorize: `${MEDIA_API_BASE}/oauth/tiktok/authorize`,
  tiktokCallback: `${MEDIA_API_BASE}/oauth/tiktok/callback`,
} as const;

export const MediaSyncRoutes = {
  /** POST — body: { orgId, mediaClientId, platform } — puxa métricas e campanhas */
  syncClient: `${MEDIA_API_BASE}/sync/client`,
  /** GET — lista contas gerenciadas detetadas para o token atual (mesmo e-mail) */
  managedAccounts: `${MEDIA_API_BASE}/accounts/managed`,
  /** POST — associa external_account_ids ao media_client_id */
  bindAccounts: `${MEDIA_API_BASE}/accounts/bind`,
} as const;

export type OAuthCallbackBody = {
  code: string;
  state: string;
  orgId: string;
  mediaClientId: string | null;
  platformId: MediaPlatformId;
};

export type ManagedAccountsResponse = {
  accounts: { externalId: string; name: string; platformId: MediaPlatformId }[];
};

export type SyncClientResponse = {
  performance: {
    totalSpend: number;
    roi: number;
    cpa: number;
    currency: string;
    syncedAt: string;
  };
};
