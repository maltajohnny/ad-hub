import { describe, expect, it } from "vitest";
import { SchedulerService } from "@/social-analytics/services/SchedulerService";

describe("SchedulerService", () => {
  it("returns hourly for large profiles", () => {
    expect(SchedulerService.nextIntervalMs(100_000)).toBe(60 * 60 * 1000);
  });

  it("returns daily for small profiles", () => {
    expect(SchedulerService.nextIntervalMs(99_999)).toBe(24 * 60 * 60 * 1000);
  });
});

