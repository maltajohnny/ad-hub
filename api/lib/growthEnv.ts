/** Variáveis opcionais para integrações Growth Hub (Vercel env). */

export function getSerpApiKeyGrowth(): string | undefined {
  const v = typeof process !== "undefined" ? process.env?.SERPAPI_KEY : undefined;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

export function getDataForSeoLogin(): string | undefined {
  const v = typeof process !== "undefined" ? process.env?.DATAFORSEO_LOGIN : undefined;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

export function getDataForSeoPassword(): string | undefined {
  const v = typeof process !== "undefined" ? process.env?.DATAFORSEO_PASSWORD : undefined;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

export function getHunterApiKey(): string | undefined {
  const v = typeof process !== "undefined" ? process.env?.HUNTER_API_KEY : undefined;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

export function getGooglePlacesKey(): string | undefined {
  const v = typeof process !== "undefined" ? process.env?.GOOGLE_PLACES_API_KEY : undefined;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

export function getMetaAdsAccessToken(): string | undefined {
  const v = typeof process !== "undefined" ? process.env?.META_ADS_LIBRARY_TOKEN : undefined;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}
