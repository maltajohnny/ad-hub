import { describe, expect, it } from "vitest";
import { UserResolverService } from "@/social-analytics/services/UserResolverService";

describe("UserResolverService", () => {
  it("resolve instagram handle with @", () => {
    const r = UserResolverService.resolve("@cristiano");
    expect(r).toEqual({ platform: "instagram", username: "cristiano" });
  });

  it("resolve tiktok url", () => {
    const r = UserResolverService.resolve("https://www.tiktok.com/@ad_hub");
    expect(r).toEqual({ platform: "tiktok", username: "ad_hub" });
  });

  it("resolve youtube url", () => {
    const r = UserResolverService.resolve("youtube.com/@MrBeast");
    expect(r).toEqual({ platform: "youtube", username: "mrbeast" });
  });
});

