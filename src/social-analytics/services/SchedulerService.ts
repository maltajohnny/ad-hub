export const SchedulerService = {
  nextIntervalMs(followers: number): number {
    // perfis grandes: 1h, pequenos: 24h
    return followers >= 100_000 ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  },
};

