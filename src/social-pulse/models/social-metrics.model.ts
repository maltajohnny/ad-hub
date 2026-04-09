/** Origem rastreável dos dados apresentados no Social Pulse. */
export type SocialMetricsSource = "graph_api" | "scraper" | "none";

/**
 * Métricas normalizadas — apenas valores confirmados pela fonte.
 * Campos sem dado real ficam `null` (nunca inventados).
 */
export type SocialMetricsPayload = {
  username: string;
  followers: number | null;
  following: number | null;
  posts: number | null;
  /** Insights com janela temporal exigem permissões extra na Graph API; normalmente null. */
  engagementRate: number | null;
  source: SocialMetricsSource;
  error?: string;
  lastUpdated: string;
};

export type SocialMetricsResult = SocialMetricsPayload;
