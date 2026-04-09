import type { SocialPulsePlatform } from "@/lib/socialPulseStore";

/** Rótulos de plataforma para UI (sem métricas simuladas — ver `@/social-pulse/services/instagram.service`). */
export function platformLabel(p: SocialPulsePlatform): string {
  switch (p) {
    case "youtube":
      return "YouTube";
    case "instagram":
      return "Instagram";
    case "twitter":
      return "X (Twitter)";
    case "tiktok":
      return "TikTok";
    default:
      return p;
  }
}
