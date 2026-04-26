export type SocialAnalyticsPlatform = "instagram" | "youtube" | "tiktok";

export type SocialAnalyticsProfile = {
  id: string;
  tenantId: string;
  platform: SocialAnalyticsPlatform;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

export type SocialAnalyticsSnapshot = {
  id: string;
  profileId: string;
  followers: number;
  following: number;
  posts: number;
  likes: number;
  views: number;
  collectedAt: string;
};

export type SocialAnalyticsMetrics = {
  id: string;
  profileId: string;
  dailyGrowth: number;
  weeklyGrowth: number;
  monthlyGrowth: number;
  engagementRate: number;
  updatedAt: string;
};

export type ResolvedProfileInput = {
  platform: SocialAnalyticsPlatform;
  username: string;
};

