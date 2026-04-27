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

