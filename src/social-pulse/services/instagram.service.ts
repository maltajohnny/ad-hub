import type { SocialMetricsPayload, SocialMetricsResult } from "@/social-pulse/models/social-metrics.model";
import { fetchInstagramViaGraphApi } from "@/social-pulse/providers/instagram-graph.provider";
import { fetchInstagramViaScraper } from "@/social-pulse/providers/instagram-scraper.provider";
import { validateSocialMetrics } from "@/social-pulse/validators/metrics.validator";
import { appendFollowerSnapshot, getLastFollowersFromSnapshots } from "@/social-pulse/storage/metrics-snapshots";

const LOG_PREFIX = "[SocialPulse:instagram.service]";

export type GetInstagramMetricsOptions = {
  /** Token de utilizador Meta com acesso a `me/accounts` + conta Instagram Business ligada. */
  graphAccessToken?: string;
  /** Versão da Graph API (ex. v21.0). */
  graphApiVersion?: string;
  /**
   * Obtém HTML do perfil público. No browser, use proxy same-origin (ex. VITE_SOCIAL_PULSE_IG_PROXY_URL).
   * Se omitido, é usado o fetch por defeito (só funciona com proxy configurado).
   */
  fetchProfileHtml?: (username: string) => Promise<string | null>;
  /** Se true, grava leitura em localStorage para gráfico histórico (só dados reais). */
  accountIdForSnapshot?: string;
};

function resolveIgProxyTemplate(): string {
  const env = (import.meta.env.VITE_SOCIAL_PULSE_IG_PROXY_URL ?? "").trim();
  if (env) return env;
  if (import.meta.env.PROD && typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h === "ad-hub.digital" || h === "www.ad-hub.digital") {
      return "/api/social/ig-profile.php?user=";
    }
  }
  return "";
}

function buildIgProxyUrl(template: string, handle: string): string {
  const t = template.trim();
  if (t.includes("{user}")) {
    return t.replaceAll("{user}", encodeURIComponent(handle));
  }
  if (t.endsWith("=")) {
    return `${t}${encodeURIComponent(handle)}`;
  }
  const base = t.replace(/\/$/, "");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}user=${encodeURIComponent(handle)}`;
}

function defaultFetchProfileHtml(): (username: string) => Promise<string | null> {
  return async (handle: string) => {
    const template = resolveIgProxyTemplate();
    if (!template) {
      console.info(
        LOG_PREFIX,
        "scraper_skip: defina VITE_SOCIAL_PULSE_IG_PROXY_URL ou faça deploy de public/api/social/ig-profile.php (em ad-hub.digital usa-se /api/social/ig-profile.php?user= automaticamente)",
      );
      return null;
    }
    const url = buildIgProxyUrl(template, handle);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  };
}

function emptyPayload(username: string, error: string, source: SocialMetricsPayload["source"]): SocialMetricsPayload {
  const lastUpdated = new Date().toISOString();
  return {
    username: username.trim().replace(/^@/, "") || username,
    followers: null,
    following: null,
    posts: null,
    engagementRate: null,
    source,
    error,
    lastUpdated,
  };
}

/**
 * Orquestra: Graph API → scraper (HTML) → validação.
 * Sem dados reais devolve null nos campos + `error` e `source: "none"`.
 */
export async function getInstagramMetrics(
  username: string,
  options: GetInstagramMetricsOptions = {},
): Promise<SocialMetricsResult> {
  const t0 = performance.now();
  const norm = username.trim().replace(/^@/, "");
  const token = (options.graphAccessToken ?? "").trim();

  let graphError: string | undefined;

  if (!norm) {
    const p = emptyPayload(username, "INVALID_USERNAME", "none");
    console.info(LOG_PREFIX, "done_ms", Math.round(performance.now() - t0), "provider", "none", "error", p.error);
    return p;
  }

  let base: SocialMetricsPayload = {
    username: norm,
    followers: null,
    following: null,
    posts: null,
    engagementRate: null,
    source: "none",
    lastUpdated: new Date().toISOString(),
  };

  if (token) {
    const g = await fetchInstagramViaGraphApi(norm, token, options.graphApiVersion);
    const dt = Math.round(performance.now() - t0);
    if (g.ok) {
      console.info(LOG_PREFIX, "provider", "graph_api", "ms", dt, "username", norm);
      base = {
        username: g.data.username,
        followers: g.data.followers,
        following: g.data.following,
        posts: g.data.posts,
        engagementRate: null,
        source: "graph_api",
        lastUpdated: new Date().toISOString(),
      };
    } else {
      graphError = g.error;
      console.warn(LOG_PREFIX, "graph_failed", g.error, "ms", dt);
    }
  } else {
    graphError = "NO_ACCESS_TOKEN";
    console.info(LOG_PREFIX, "graph_skip", "NO_ACCESS_TOKEN");
  }

  if (base.source === "none" || base.followers === null) {
    const fetchHtml = options.fetchProfileHtml ?? defaultFetchProfileHtml();
    const s = await fetchInstagramViaScraper(norm, fetchHtml);
    const dt = Math.round(performance.now() - t0);
    if (s.ok) {
      console.info(LOG_PREFIX, "provider", "scraper", "fallback_used", true, "ms", dt, "username", norm);
      base = {
        username: norm,
        followers: s.data.followers,
        following: s.data.following,
        posts: s.data.posts,
        engagementRate: s.data.engagementRate,
        source: "scraper",
        lastUpdated: new Date().toISOString(),
      };
    } else {
      console.warn(LOG_PREFIX, "scraper_failed", s.error, "fallback_used", true, "ms", dt);
      base = {
        ...base,
        username: norm,
        source: "none",
        error: [graphError, s.error].filter(Boolean).join(" | ") || "NO_REAL_DATA",
        lastUpdated: new Date().toISOString(),
      };
    }
  } else {
    console.info(LOG_PREFIX, "fallback_used", false, "total_ms", Math.round(performance.now() - t0));
  }

  const prev =
    options.accountIdForSnapshot != null
      ? getLastFollowersFromSnapshots(options.accountIdForSnapshot)
      : undefined;
  const { payload: validated } = validateSocialMetrics(base, prev);

  if (
    options.accountIdForSnapshot &&
    validated.followers !== null &&
    (validated.source === "graph_api" || validated.source === "scraper")
  ) {
    appendFollowerSnapshot(options.accountIdForSnapshot, validated.followers, validated.source);
  }

  console.info(
    LOG_PREFIX,
    "final",
    "source",
    validated.source,
    "followers",
    validated.followers,
    "total_ms",
    Math.round(performance.now() - t0),
  );

  return validated;
}
