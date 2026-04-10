import type { Client } from "@/data/clientsCatalog";

export type AiDecision = {
  at: string;
  title: string;
  from: string;
  to: string;
  amountLabel: string;
  reason: string;
  /** Gerada ao enviar instrução no painel (vs. entradas simuladas em getClientDetail). */
  fromInstruction?: boolean;
  /** autônomo = aplicado ao enviar; supervisionado = após o gestor aprovar. */
  instructionMode?: "autonomous" | "supervised";
};

export type RoiTableRow = {
  channel: "Meta Ads" | "Google Ads" | "Instagram Ads";
  invested: number;
  leads: number;
  conversions: number;
  revenue: number;
  cpl: number;
  roiMult: number;
};

export type ClientDetail = {
  decisions: AiDecision[];
  performance: { month: string; meta: number; google: number; instagram: number }[];
  budgetCurrent: { meta: number; google: number; instagram: number };
  budgetRecommended: { meta: number; google: number; instagram: number };
  roiRows: RoiTableRow[];
};

export function getClientDetail(c: Client): ClientDetail {
  const k = c.id * 7;
  const performance = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"].map((month, i) => ({
    month,
    meta: 45 + (k % 20) + i * 8,
    google: 38 + (k % 15) + i * 7,
    instagram: 32 + (k % 18) + i * 6,
  }));

  const decisions: AiDecision[] = [
    {
      at: "2026-04-03 09:15",
      title: `Redistribuição de verba do Instagram para Google Ads`,
      from: "Instagram Ads",
      to: "Google Ads",
      amountLabel: "R$ 2.000",
      reason: `${c.name.split(" ")[0]}: Instagram Ads apresenta CPL 2× acima da média do mix. Google Search mantém CPA estável — realocação sugere melhor uso de verba.`,
    },
    {
      at: "2026-04-01 14:22",
      title: "Ajuste de lance em campanhas de conversão Meta",
      from: "Meta Ads",
      to: "Meta Ads",
      amountLabel: "—",
      reason: "CPA em leque de remarketing acima do alvo; redução de 8% no lance máximo até estabilizar frequência.",
    },
    {
      at: "2026-03-28 11:40",
      title: "Pausa temporária em criativo com CTR abaixo da média",
      from: "Meta Ads",
      to: "—",
      amountLabel: "—",
      reason: "CTR 40% abaixo do conjunto de anúncios vencedores; pausa evita gasto em impressões de baixa qualidade.",
    },
  ];

  const t = c.spendNumeric / 1000;
  const roiRows: RoiTableRow[] = [
    {
      channel: "Meta Ads",
      invested: Math.round(t * 420),
      leads: Math.round(c.leads * 0.42),
      conversions: Math.round(c.conversions * 0.45),
      revenue: Math.round(t * 1800),
      cpl: c.cpa * 0.92,
      roiMult: 3.2 + (k % 10) / 10,
    },
    {
      channel: "Google Ads",
      invested: Math.round(t * 380),
      leads: Math.round(c.leads * 0.35),
      conversions: Math.round(c.conversions * 0.38),
      revenue: Math.round(t * 1650),
      cpl: c.cpa * 0.88,
      roiMult: 3.6 + (k % 8) / 10,
    },
    {
      channel: "Instagram Ads",
      invested: Math.round(t * 200),
      leads: Math.round(c.leads * 0.23),
      conversions: Math.round(c.conversions * 0.17),
      revenue: Math.round(t * 890),
      cpl: c.cpa * 1.15,
      roiMult: 2.8 + (k % 12) / 10,
    },
  ];

  const budgetCurrent = {
    meta: 38 + (k % 8),
    google: 35 + (k % 10),
    instagram: 100 - (38 + (k % 8)) - (35 + (k % 10)),
  };
  const budgetRecommended = {
    meta: Math.min(45, budgetCurrent.meta + 4),
    google: Math.min(48, budgetCurrent.google + 6),
    instagram: 100,
  };
  budgetRecommended.instagram = 100 - budgetRecommended.meta - budgetRecommended.google;

  return { decisions, performance, budgetCurrent, budgetRecommended, roiRows };
}
