import { getAdHubToken } from "@/lib/adhubAuthApi";

export type PlatformModulesConfig = {
  metaAppId: string;
  metaAppSecret: string;
  tiktokAppId: string;
  tiktokClientKey: string;
  tiktokAppSecret: string;
  googleOauthClientId: string;
  googleOauthClientSecret: string;
  instagramGraphApiToken: string;
  serpApiKey: string;
  dataForSeoLogin: string;
  dataForSeoPassword: string;
  metaAdsLibraryToken: string;
  hunterApiKey: string;
  googlePlacesApiKey: string;
  sendgridApiKey: string;
  twilioAuthToken: string;
  twilioAccountSid: string;
  whatsappMetaAccessToken: string;
};

const STORAGE_KEY = "adhub_platform_modules_config_v1";
const API_ENDPOINT = "/api/ad-hub/auth/platform/modules-config";

const EMPTY: PlatformModulesConfig = {
  metaAppId: "",
  metaAppSecret: "",
  tiktokAppId: "",
  tiktokClientKey: "",
  tiktokAppSecret: "",
  googleOauthClientId: "",
  googleOauthClientSecret: "",
  instagramGraphApiToken: "",
  serpApiKey: "",
  dataForSeoLogin: "",
  dataForSeoPassword: "",
  metaAdsLibraryToken: "",
  hunterApiKey: "",
  googlePlacesApiKey: "",
  sendgridApiKey: "",
  twilioAuthToken: "",
  twilioAccountSid: "",
  whatsappMetaAccessToken: "",
};

export function getPlatformModulesConfig(): PlatformModulesConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<PlatformModulesConfig>;
    return { ...EMPTY, ...parsed };
  } catch {
    return { ...EMPTY };
  }
}

export function setPlatformModulesConfig(next: PlatformModulesConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearPlatformModulesConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export async function loadPlatformModulesConfig(): Promise<PlatformModulesConfig> {
  const token = getAdHubToken();
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(API_ENDPOINT, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    if (!res.ok) return getPlatformModulesConfig();
    const data = (await res.json()) as Partial<PlatformModulesConfig>;
    const merged = { ...EMPTY, ...data };
    setPlatformModulesConfig(merged);
    return merged;
  } catch {
    return getPlatformModulesConfig();
  }
}

export async function savePlatformModulesConfig(next: PlatformModulesConfig): Promise<{ ok: boolean; error?: string }> {
  setPlatformModulesConfig(next);
  const token = getAdHubToken();
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(API_ENDPOINT, {
      method: "PUT",
      headers,
      body: JSON.stringify(next),
      cache: "no-store",
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const j = (await res.json()) as { error?: string };
        if (j?.error) msg = j.error;
      } catch {
        // ignore
      }
      if (!token && (res.status === 401 || res.status === 403)) {
        msg = "Sessão sem token JWT. Faça logout e login novamente para salvar no banco.";
      }
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Falha de rede ao guardar no servidor." };
  }
}

