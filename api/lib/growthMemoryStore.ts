/**
 * Armazenamento em memória (isolado warm) para demos e desenvolvimento.
 * Produção: substituir por Postgres com tenant_id.
 */
import { randomBytes } from "node:crypto";

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type DayAvailability = {
  weekday: Weekday;
  enabled: boolean;
  start: string;
  end: string;
};

export type SchedulingProfile = {
  tenantSlug: string;
  userKey: string;
  slotMinutes: number;
  availability: DayAvailability[];
  publicToken: string;
  googleCalendarConnected: boolean;
  displayName: string;
};

export type BookingRecord = {
  id: string;
  tenantSlug: string;
  ownerUserKey: string;
  start: string;
  end: string;
  guestName: string;
  guestEmail: string;
  createdAt: string;
};

export type AutomationTrigger = "lead_created" | "form_submitted" | "campaign_created";
export type AutomationAction = "webhook" | "email" | "google_sheets" | "crm";

export type AutomationRecord = {
  id: string;
  tenantSlug: string;
  userKey: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  action: AutomationAction;
  config: Record<string, unknown>;
  createdAt: string;
};

export type AutomationLogRecord = {
  id: string;
  automationId: string;
  tenantSlug: string;
  ok: boolean;
  message: string;
  payload?: Record<string, unknown>;
  createdAt: string;
};

export type ProspectRecord = {
  id: string;
  tenantSlug: string;
  listId: string | null;
  name: string;
  title: string;
  email: string;
  domain?: string;
  source: string;
  createdAt: string;
};

export type ProspectListRecord = {
  id: string;
  tenantSlug: string;
  name: string;
  createdAt: string;
};

export type LeadRecord = {
  id: string;
  tenantSlug: string;
  source:
    | "organic"
    | "paid"
    | "prospecting"
    | "scheduling"
    | "form"
    | "campaign"
    | "automation"
    | "other";
  name: string;
  email: string;
  meta?: Record<string, unknown>;
  createdAt: string;
};

export type GrowthHubMemory = {
  schedulingProfiles: Map<string, SchedulingProfile>;
  publicTokenToOwner: Map<string, { tenantSlug: string; userKey: string }>;
  bookings: BookingRecord[];
  automations: AutomationRecord[];
  automationLogs: AutomationLogRecord[];
  prospectLists: ProspectListRecord[];
  prospects: ProspectRecord[];
  leads: LeadRecord[];
};

type GlobalWithGrowth = typeof globalThis & { __adHubGrowthMemory?: GrowthHubMemory };

export function growthNewId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

export function growthProfileKey(tenantSlug: string, userKey: string): string {
  return `${tenantSlug}::${userKey}`;
}

export function getGrowthMemory(): GrowthHubMemory {
  const g = globalThis as GlobalWithGrowth;
  if (!g.__adHubGrowthMemory) {
    g.__adHubGrowthMemory = {
      schedulingProfiles: new Map(),
      publicTokenToOwner: new Map(),
      bookings: [],
      automations: [],
      automationLogs: [],
      prospectLists: [],
      prospects: [],
      leads: [],
    };
  }
  return g.__adHubGrowthMemory;
}

export function defaultAvailability(): DayAvailability[] {
  return [1, 2, 3, 4, 5].map((d) => ({
    weekday: d as Weekday,
    enabled: true,
    start: "09:00",
    end: "18:00",
  }));
}

export function ensureSchedulingProfile(
  tenantSlug: string,
  userKey: string,
  displayName: string,
): SchedulingProfile {
  const mem = getGrowthMemory();
  const k = growthProfileKey(tenantSlug, userKey);
  let p = mem.schedulingProfiles.get(k);
  if (!p) {
    const token = growthNewId("pub");
    p = {
      tenantSlug,
      userKey,
      slotMinutes: 30,
      availability: defaultAvailability(),
      publicToken: token,
      googleCalendarConnected: false,
      displayName: displayName || userKey,
    };
    mem.schedulingProfiles.set(k, p);
    mem.publicTokenToOwner.set(token, { tenantSlug, userKey });
  }
  return p;
}

export function rotatePublicToken(tenantSlug: string, userKey: string): SchedulingProfile {
  const mem = getGrowthMemory();
  const k = growthProfileKey(tenantSlug, userKey);
  const prev = mem.schedulingProfiles.get(k) ?? ensureSchedulingProfile(tenantSlug, userKey, userKey);
  mem.publicTokenToOwner.delete(prev.publicToken);
  const token = growthNewId("pub");
  const next: SchedulingProfile = { ...prev, publicToken: token };
  mem.schedulingProfiles.set(k, next);
  mem.publicTokenToOwner.set(token, { tenantSlug, userKey });
  return next;
}

export function ingestLead(
  tenantSlug: string,
  input: Omit<LeadRecord, "id" | "tenantSlug" | "createdAt">,
): LeadRecord {
  const mem = getGrowthMemory();
  const row: LeadRecord = {
    id: growthNewId("lead"),
    tenantSlug,
    ...input,
    createdAt: new Date().toISOString(),
  };
  mem.leads.push(row);
  return row;
}
