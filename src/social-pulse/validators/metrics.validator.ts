import type { SocialMetricsPayload } from "@/social-pulse/models/social-metrics.model";

const LOG_PREFIX = "[SocialPulse:validator]";

export type ValidationOutcome = {
  payload: SocialMetricsPayload;
  warnings: string[];
};

/**
 * Regras: sem valores negativos; aviso se salto extremo vs. histórico (última leitura guardada).
 */
export function validateSocialMetrics(
  input: SocialMetricsPayload,
  previousFollowers: number | null | undefined,
): ValidationOutcome {
  const warnings: string[] = [];
  let { followers, following, posts } = input;

  if (followers !== null && followers < 0) {
    console.warn(LOG_PREFIX, "followers < 0 → anulado", { username: input.username });
    followers = null;
    warnings.push("followers_invalid_negative");
  }
  if (following !== null && following < 0) {
    console.warn(LOG_PREFIX, "following < 0 → anulado", { username: input.username });
    following = null;
    warnings.push("following_invalid_negative");
  }
  if (posts !== null && posts < 0) {
    console.warn(LOG_PREFIX, "posts < 0 → anulado", { username: input.username });
    posts = null;
    warnings.push("posts_invalid_negative");
  }

  if (
    previousFollowers != null &&
    previousFollowers > 0 &&
    followers != null &&
    followers > previousFollowers * 5
  ) {
    console.warn(LOG_PREFIX, "followers subiu >5x vs. leitura anterior — verificar fonte", {
      username: input.username,
      previousFollowers,
      followers,
    });
    warnings.push("followers_spike_vs_history");
  }

  return {
    payload: {
      ...input,
      followers,
      following,
      posts,
    },
    warnings,
  };
}
