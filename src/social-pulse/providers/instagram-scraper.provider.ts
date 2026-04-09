/**
 * Leitura de contagens públicas a partir do HTML do perfil (sem SDKs pagos).
 * No browser, o pedido direto a instagram.com falha por CORS — use `fetchProfileHtml` (ex.: proxy same-origin).
 */

const LOG_PREFIX = "[SocialPulse:scraper]";

export type InstagramScraperSuccess = {
  ok: true;
  data: { followers: number; following: number | null; posts: number | null };
  source: "scraper";
};

export type InstagramScraperFailure = {
  ok: false;
  data: null;
  error: string;
  source: "scraper";
};

export type InstagramScraperResult = InstagramScraperSuccess | InstagramScraperFailure;

/** Extrai contagens de blocos JSON embutidos (formato muda com o tempo; múltiplos padrões). */
export function parseInstagramProfileHtml(html: string): {
  followers: number | null;
  following: number | null;
  posts: number | null;
} {
  let followers: number | null = null;
  let following: number | null = null;
  let posts: number | null = null;

  const pick = (re: RegExp, s: string): number | null => {
    const m = s.match(re);
    if (!m?.[1]) return null;
    const n = parseInt(m[1].replace(/,/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  };

  followers = pick(/"edge_followed_by":\s*\{\s*"count":\s*(\d+)/, html) ?? followers;
  following = pick(/"edge_follow":\s*\{\s*"count":\s*(\d+)/, html) ?? following;
  posts = pick(/"edge_owner_to_timeline_media":\s*\{\s*"count":\s*(\d+)/, html) ?? posts;

  const og = html.match(/property="og:description"\s+content="([^"]+)"/i);
  if (og?.[1]) {
    const desc = og[1];
    const f1 = desc.match(/([\d,.]+)\s*Followers/i);
    const f2 = desc.match(/([\d,.]+)\s*Following/i);
    const f3 = desc.match(/([\d,.]+)\s*Posts/i);
    if (followers === null && f1?.[1]) followers = parseInt(f1[1].replace(/,/g, ""), 10) || null;
    if (following === null && f2?.[1]) following = parseInt(f2[1].replace(/,/g, ""), 10) || null;
    if (posts === null && f3?.[1]) posts = parseInt(f3[1].replace(/,/g, ""), 10) || null;
  }

  return { followers, following, posts };
}

export async function fetchInstagramViaScraper(
  username: string,
  fetchProfileHtml: (handle: string) => Promise<string | null>,
): Promise<InstagramScraperResult> {
  const handle = username.trim().replace(/^@/, "");
  if (!handle) {
    return { ok: false, data: null, error: "INVALID_USERNAME", source: "scraper" };
  }

  let html: string | null;
  try {
    html = await fetchProfileHtml(handle);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(LOG_PREFIX, "fetch_failed", msg);
    return { ok: false, data: null, error: "SCRAPER_FETCH_FAILED", source: "scraper" };
  }

  if (html === null || html.trim() === "") {
    console.warn(LOG_PREFIX, "empty_html", { handle });
    return { ok: false, data: null, error: "SCRAPER_NO_HTML", source: "scraper" };
  }

  const parsed = parseInstagramProfileHtml(html);
  if (parsed.followers === null) {
    console.warn(LOG_PREFIX, "no_followers_in_html", { handle, htmlLength: html.length });
    return { ok: false, data: null, error: "SCRAPER_PARSE_FAILED", source: "scraper" };
  }

  return {
    ok: true,
    data: {
      followers: parsed.followers,
      following: parsed.following,
      posts: parsed.posts,
    },
    source: "scraper",
  };
}
