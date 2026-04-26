import type { ResolvedProfileInput, SocialAnalyticsSnapshot } from "@/social-analytics/types";
import { ProfileDiscoveryService } from "@/social-analytics/services/ProfileDiscoveryService";

export const DataCollectorService = {
  async collect(
    profileId: string,
    resolved: ResolvedProfileInput,
    opts?: { instagramGraphToken?: string },
  ): Promise<SocialAnalyticsSnapshot> {
    const data = await ProfileDiscoveryService.discover(resolved, opts);
    return {
      id: crypto.randomUUID(),
      profileId,
      followers: data.followers,
      following: data.following,
      posts: data.posts,
      likes: data.likes,
      views: data.views,
      collectedAt: new Date().toISOString(),
    };
  },
};

