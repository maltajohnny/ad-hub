import type { MediaPlatformId } from "@/lib/mediaManagementStore";

const FB_API_VERSION = "v21.0";

/** App Meta registada no `.env` do front (`VITE_META_APP_ID`). */
export function isMetaOAuthConfigured(): boolean {
  return Boolean(import.meta.env.VITE_META_APP_ID?.trim());
}

/** App TikTok registada no `.env` do front (`VITE_TIKTOK_APP_ID`). */
export function isTikTokOAuthConfigured(): boolean {
  return Boolean(import.meta.env.VITE_TIKTOK_APP_ID?.trim());
}

/** Estado opaco para o redirect OAuth (em produção, assinar no servidor). */
export function encodeOAuthState(payload: { orgId: string; mediaClientId: string | null; platformId: MediaPlatformId }): string {
  return btoa(
    JSON.stringify({
      orgId: payload.orgId,
      mediaClientId: payload.mediaClientId ?? "",
      platformId: payload.platformId,
    }),
  );
}

export function decodeOAuthState(state: string): { orgId: string; mediaClientId: string | null; platformId: MediaPlatformId } | null {
  try {
    const raw = JSON.parse(atob(state)) as {
      orgId?: string;
      mediaClientId?: string;
      platformId?: MediaPlatformId;
    };
    if (!raw.orgId || !raw.platformId) return null;
    return {
      orgId: raw.orgId,
      mediaClientId: raw.mediaClientId && raw.mediaClientId.length > 0 ? raw.mediaClientId : null,
      platformId: raw.platformId,
    };
  } catch {
    return null;
  }
}

/**
 * Diálogo oficial da Meta (é aqui que aparece o login Facebook / permissões da conta de anúncios).
 * Registe o mesmo `redirect_uri` na consola Meta Developers.
 */
export function buildFacebookOAuthUrl(input: { redirectUri: string; state: string; scope?: string }): string | null {
  const appId = import.meta.env.VITE_META_APP_ID?.trim();
  if (!appId) return null;
  const u = new URL(`https://www.facebook.com/${FB_API_VERSION}/dialog/oauth`);
  u.searchParams.set("client_id", appId);
  u.searchParams.set("redirect_uri", input.redirectUri);
  u.searchParams.set("state", input.state);
  u.searchParams.set("response_type", "code");
  const scope =
    input.scope ??
    "ads_read,ads_management,business_management,pages_read_engagement,instagram_basic,instagram_manage_insights";
  u.searchParams.set("scope", scope);
  return u.toString();
}

/** TikTok Marketing API — ecrã de autorização oficial. */
export function buildTikTokOAuthUrl(input: { redirectUri: string; state: string }): string | null {
  const appId = import.meta.env.VITE_TIKTOK_APP_ID?.trim();
  if (!appId) return null;
  const u = new URL("https://ads.tiktok.com/marketing_api/auth");
  u.searchParams.set("app_id", appId);
  u.searchParams.set("redirect_uri", input.redirectUri);
  u.searchParams.set("state", input.state);
  return u.toString();
}

/** Google — OAuth para Google Ads (consola Google Cloud + Google Ads API). */
export function buildGoogleAdsOAuthUrl(input: { redirectUri: string; state: string }): string | null {
  const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim();
  if (!clientId) return null;
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", input.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("scope", "https://www.googleapis.com/auth/adwords");
  u.searchParams.set("state", input.state);
  return u.toString();
}

export function getConfiguredRedirectUri(): string {
  const explicit = import.meta.env.VITE_PLATFORM_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  if (typeof window !== "undefined") {
    return `${window.location.origin}/gestao-midias`;
  }
  return "";
}

/** Redirect OAuth ao voltar para a lista de Clientes (registe o mesmo URI na consola de cada rede). */
export function getClientesOAuthRedirectUri(): string {
  const explicit = import.meta.env.VITE_CLIENTES_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  if (typeof window !== "undefined") {
    return `${window.location.origin}/clientes`;
  }
  return "";
}

/**
 * Redirect OAuth para fluxo em popup (a janela principal da plataforma não navega).
 * Registe este URI exato na Meta e na TikTok (ex.: https://seu-dominio/oauth/popup-callback).
 */
export function getOAuthPopupRedirectUri(): string {
  const explicit = import.meta.env.VITE_OAUTH_POPUP_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  if (typeof window !== "undefined") {
    return `${window.location.origin}/oauth/popup-callback`;
  }
  return "";
}
