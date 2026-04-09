/**
 * Instagram Graph API (Meta) — contas Business/Creator ligadas às páginas do utilizador do token.
 * @see https://developers.facebook.com/docs/instagram-api
 */

const LOG_PREFIX = "[SocialPulse:graph_api]";

export type InstagramGraphSuccess = {
  ok: true;
  data: {
    igUserId: string;
    username: string;
    followers: number;
    following: number | null;
    posts: number;
  };
  source: "graph_api";
};

export type InstagramGraphFailure = {
  ok: false;
  data: null;
  error: string;
  source: "graph_api";
};

export type InstagramGraphResult = InstagramGraphSuccess | InstagramGraphFailure;

type MeAccountsResponse = {
  data?: Array<{
    instagram_business_account?: {
      id: string;
      username?: string;
      followers_count?: number;
      follows_count?: number;
      media_count?: number;
    };
  }>;
  error?: { message?: string; code?: number; error_subcode?: number };
};

function normalizeUser(u: string): string {
  return u.trim().replace(/^@/, "").toLowerCase();
}

export async function fetchInstagramViaGraphApi(
  username: string,
  accessToken: string,
  apiVersion = "v21.0",
): Promise<InstagramGraphResult> {
  const norm = normalizeUser(username);
  if (!norm) {
    return { ok: false, data: null, error: "INVALID_USERNAME", source: "graph_api" };
  }
  if (!accessToken.trim()) {
    return { ok: false, data: null, error: "NO_ACCESS_TOKEN", source: "graph_api" };
  }

  const fields =
    "instagram_business_account{id,username,followers_count,follows_count,media_count}";
  const url = new URL(`https://graph.facebook.com/${apiVersion}/me/accounts`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", accessToken.trim());

  let res: Response;
  try {
    res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(LOG_PREFIX, "network_error", msg);
    return { ok: false, data: null, error: "GRAPH_NETWORK_ERROR", source: "graph_api" };
  }

  const json = (await res.json()) as MeAccountsResponse;
  if (json.error) {
    const m = json.error.message ?? "GRAPH_ERROR";
    console.warn(LOG_PREFIX, "api_error", json.error);
    if (/business/i.test(m) || /permission/i.test(m) || json.error.code === 10) {
      return { ok: false, data: null, error: "ACCOUNT_NOT_BUSINESS", source: "graph_api" };
    }
    return { ok: false, data: null, error: "GRAPH_ERROR", source: "graph_api" };
  }

  const pages = json.data ?? [];
  for (const page of pages) {
    const ig = page.instagram_business_account;
    if (!ig?.id) continue;
    const un = (ig.username ?? "").trim().toLowerCase();
    if (un !== norm) continue;

    const followers = typeof ig.followers_count === "number" ? ig.followers_count : null;
    const posts = typeof ig.media_count === "number" ? ig.media_count : null;
    const following = typeof ig.follows_count === "number" ? ig.follows_count : null;

    if (followers === null || posts === null) {
      return {
        ok: false,
        data: null,
        error: "ACCOUNT_NOT_BUSINESS",
        source: "graph_api",
      };
    }

    return {
      ok: true,
      data: {
        igUserId: ig.id,
        username: ig.username ?? username,
        followers,
        following,
        posts,
      },
      source: "graph_api",
    };
  }

  return {
    ok: false,
    data: null,
    error: "ACCOUNT_NOT_BUSINESS",
    source: "graph_api",
  };
}
