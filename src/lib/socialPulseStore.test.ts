import { beforeEach, describe, expect, it } from "vitest";
import {
  addMonitoredAccount,
  getVisibleAccountIdsForUser,
  listAccountsForOrg,
  removeMonitoredAccount,
  setUserVisibleAccounts,
} from "@/lib/socialPulseStore";

describe("socialPulseStore", () => {
  const orgId = "org-test-1";
  const actor = "admin.test";
  const memoryStorage = new Map<string, string>();

  beforeEach(() => {
    memoryStorage.clear();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => memoryStorage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          memoryStorage.set(key, value);
        },
        removeItem: (key: string) => {
          memoryStorage.delete(key);
        },
      },
    });
  });

  it("add and remove monitored account without breaking visibility", () => {
    const added = addMonitoredAccount({
      organizationId: orgId,
      profileUrl: "@conta_teste",
      platform: "instagram",
      label: "Conta Teste",
      actorUsername: actor,
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    const accounts = listAccountsForOrg(orgId);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]!.label).toBe("Conta Teste");

    setUserVisibleAccounts({
      organizationId: orgId,
      targetUsername: "gestor1",
      accountIds: [added.account.id],
      actorUsername: actor,
    });

    const visibleBefore = getVisibleAccountIdsForUser(orgId, "gestor1", false);
    expect(visibleBefore).toEqual([added.account.id]);

    const removed = removeMonitoredAccount({
      organizationId: orgId,
      accountId: added.account.id,
      actorUsername: actor,
    });
    expect(removed.ok).toBe(true);
    expect(listAccountsForOrg(orgId)).toHaveLength(0);

    const visibleAfter = getVisibleAccountIdsForUser(orgId, "gestor1", false);
    expect(visibleAfter).toEqual([]);
  });
});

