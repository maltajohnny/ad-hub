import type { AppModule } from "@/lib/saasTypes";

export type OrgPlanSlug = "gestor" | "organizacao" | "scale" | "none";

export const PLAN_BASE_MONTHLY: Record<OrgPlanSlug, number> = {
  none: 0,
  gestor: 169.9,
  organizacao: 297,
  scale: 497,
};

export const INCLUDED_SEATS_BY_PLAN: Record<OrgPlanSlug, number> = {
  none: 0,
  gestor: 5,
  organizacao: 5,
  scale: 15,
};

export const EXTRA_SEAT_MONTHLY = 39.9;

export const MODULE_ADDON_MONTHLY: Partial<Record<AppModule, number>> = {
  "insight-hub": 149.9,
  "intelli-search": 89.9,
  "social-pulse": 69.9,
  "ia-roi": 59.9,
  campanhas: 29.9,
  "gestao-midias": 29.9,
};

export function normalizePlanSlug(v: string | null | undefined): OrgPlanSlug {
  if (v === "gestor" || v === "organizacao" || v === "scale") return v;
  return "none";
}

export function calcModuleAddonMonthly(mods: AppModule[]): { total: number; billable: AppModule[] } {
  const billable = mods.filter((m) => typeof MODULE_ADDON_MONTHLY[m] === "number");
  const total = billable.reduce((s, m) => s + (MODULE_ADDON_MONTHLY[m] ?? 0), 0);
  return { total, billable };
}

export function calcSeatOverageMonthly(plan: OrgPlanSlug, members: number): { extraSeats: number; total: number } {
  const included = INCLUDED_SEATS_BY_PLAN[plan];
  const extraSeats = Math.max(0, members - included);
  return { extraSeats, total: extraSeats * EXTRA_SEAT_MONTHLY };
}

export function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}
