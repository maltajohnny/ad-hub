/**
 * Análise de performance de marketing via Google Gemini.
 * Modelo: `GEMINI_MODEL` no `.env`, ou `gemini-2.5-flash`.
 * Chave: `GEMINI_API_KEY`. `POST` para
 * `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=<chave>`.
 */
import type { ChannelMetrics, FunnelMetrics, TrafficPerformanceReport } from "@/services/slackReportService";

export type CampaignAnalysisInput = {
  clientName: string;
  googleAds: ChannelMetrics;
  metaAds: ChannelMetrics;
  instagramAds: ChannelMetrics;
  funil: FunnelMetrics;
  budgetCurrent?: { meta: number; google: number; instagram: number };
  budgetRecommended?: { meta: number; google: number; instagram: number };
};

/** Métricas agregadas enviadas ao Gemini (investimento, leads, conversões, receita, CPA, CPC, CPM, CTR, ROI). */
export type CampaignPerformanceMetrics = {
  investimento: number;
  leads: number;
  conversoes: number;
  receita: number;
  cpa: number;
  cpc: number;
  cpm: number;
  ctr: number;
  roi: number;
};

/** Modo do painel de controlo da IA (Clientes). */
export type AiControlMode = "autonomous" | "supervised";

/** Três cartões para o Dashboard / UI (derivados das recomendações se a API não devolver tiles). */
export type CampaignOptimizationTile = {
  platform: string;
  action: string;
  reason: string;
  priority: "Alta" | "Média";
};

/** Resposta principal da análise; `tiles` preenche-se na UI a partir das recomendações. */
export type CampaignOptimizationResult = {
  analysis: string;
  recommendations: string[];
  tiles: CampaignOptimizationTile[];
};

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash" as const;

/** Path sem query (modelo fallback); em runtime: `?key=` + `GEMINI_API_KEY`. */
export const GEMINI_GENERATE_CONTENT_PATH = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent`;

function geminiApiKey(): string | undefined {
  const v = import.meta.env.GEMINI_API_KEY;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function geminiModelId(): string {
  const m = import.meta.env.GEMINI_MODEL;
  return typeof m === "string" && m.trim() ? m.trim() : DEFAULT_GEMINI_MODEL;
}

/** `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=...` */
function geminiGenerateUrl(apiKey: string): string {
  const id = geminiModelId();
  const path = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(id)}:generateContent`;
  return `${path}?key=${encodeURIComponent(apiKey)}`;
}

export function isAiOptimizationConfigured(): boolean {
  return Boolean(geminiApiKey());
}

export function campaignAnalysisInputFromReport(r: TrafficPerformanceReport): CampaignAnalysisInput {
  return {
    clientName: r.clientName,
    googleAds: r.googleAds,
    metaAds: r.metaAds,
    instagramAds: r.instagramAds,
    funil: r.funil,
    budgetCurrent: r.budgetCurrent,
    budgetRecommended: r.budgetRecommended,
  };
}

/** Agrega canais + funil nos campos pedidos para o prompt Gemini. */
export function campaignMetricsFromInput(data: CampaignAnalysisInput): CampaignPerformanceMetrics {
  const ch = [data.googleAds, data.metaAds, data.instagramAds];
  const investimento = ch.reduce((s, c) => s + c.investido, 0);
  const leads = ch.reduce((s, c) => s + c.leads, 0);
  const conversoes = ch.reduce((s, c) => s + c.conversoes, 0);
  const receita = ch.reduce((s, c) => s + c.receita, 0);
  const roi =
    investimento > 0
      ? ch.reduce((s, c) => s + c.roi * c.investido, 0) / investimento
      : ch.reduce((s, c) => s + c.roi, 0) / Math.max(ch.length, 1);
  const f = data.funil;
  return {
    investimento,
    leads,
    conversoes,
    receita,
    cpa: f.cpa,
    cpc: f.cpc,
    cpm: f.cpm,
    ctr: f.ctr,
    roi,
  };
}

const SYSTEM_PROMPT = `És um especialista em performance marketing (Google Ads, Meta, Instagram).
Recebes métricas de campanha. Responde APENAS com um objeto JSON válido (sem markdown, sem texto fora do JSON):
{
  "analysis": "texto em português (pt-BR) com análise da performance",
  "recommendations": ["recomendação 1", "recomendação 2", ...]
}
Regras: analysis deve sintetizar desempenho face a investimento, leads, conversões, receita, CPA/CPC/CPM/CTR e ROI.
recommendations: lista acionável com pelo menos 2 itens. Valores monetários em BRL quando aplicável.`;

function buildUserPrompt(data: CampaignAnalysisInput): string {
  const metrics = campaignMetricsFromInput(data);
  return `Analisa a performance de marketing com base nestes dados.

Cliente: ${data.clientName}

Métricas agregadas (investimento, leads, conversoes, receita, cpa, cpc, cpm, ctr, roi):
${JSON.stringify(metrics, null, 2)}

Contexto por canal e orçamentos:
${JSON.stringify(
  {
    googleAds: data.googleAds,
    metaAds: data.metaAds,
    instagramAds: data.instagramAds,
    budgetCurrent: data.budgetCurrent,
    budgetRecommended: data.budgetRecommended,
  },
  null,
  2,
)}`;
}

function inferPlatformFromText(s: string): string {
  const t = s.toLowerCase();
  if (t.includes("google")) return "Google Ads";
  if (t.includes("meta") || t.includes("facebook")) return "Meta Ads";
  if (t.includes("instagram")) return "Instagram";
  return "Geral";
}

function buildTilesFallback(analysis: string, recommendations: string[]): CampaignOptimizationTile[] {
  const pri: ("Alta" | "Média")[] = ["Alta", "Média", "Média"];
  const recs = [...recommendations];
  while (recs.length < 3) {
    recs.push("Rever criativos e segmentação nos canais com pior eficiência relativa.");
  }
  return [0, 1, 2].map((i) => ({
    platform: inferPlatformFromText(recs[i]),
    action: recs[i],
    reason: i === 0 ? analysis.slice(0, 220) : `Complemento: ${recs[i].slice(0, 160)}`,
    priority: pri[i],
  }));
}

function parseAssistantJson(content: string): CampaignOptimizationResult {
  const trimmed = content.trim();
  const tryParse = (s: string) => {
    const parsed = JSON.parse(s) as unknown;
    return normalizeResult(parsed);
  };
  try {
    return tryParse(trimmed);
  } catch {
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (m) return tryParse(m[0]);
    throw new Error("A resposta da IA não é JSON válido.");
  }
}

function normalizeResult(raw: unknown): CampaignOptimizationResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("Formato inválido: objeto esperado.");
  }
  const o = raw as Record<string, unknown>;
  const analysis = typeof o.analysis === "string" ? o.analysis.trim() : "";
  const recRaw = o.recommendations;
  const recommendations = Array.isArray(recRaw)
    ? recRaw.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((s) => s.trim())
    : [];
  if (!analysis) {
    throw new Error("Campo analysis vazio ou inválido na resposta.");
  }
  if (recommendations.length === 0) {
    throw new Error("Campo recommendations vazio ou inválido na resposta.");
  }

  let tiles: CampaignOptimizationTile[] = [];
  const tilesRaw = o.tiles;
  if (Array.isArray(tilesRaw)) {
    for (const item of tilesRaw.slice(0, 3)) {
      if (!item || typeof item !== "object") continue;
      const t = item as Record<string, unknown>;
      const action = typeof t.action === "string" ? t.action.trim() : "";
      if (!action) continue;
      const platform = typeof t.platform === "string" && t.platform.trim() ? t.platform.trim() : inferPlatformFromText(action);
      const reason = typeof t.reason === "string" && t.reason.trim() ? t.reason.trim() : analysis.slice(0, 180);
      const pr = t.priority === "Alta" || t.priority === "Média" ? t.priority : "Média";
      tiles.push({ platform, action, reason, priority: pr });
    }
  }
  if (tiles.length !== 3) {
    tiles = buildTilesFallback(analysis, recommendations);
  }

  return { analysis, recommendations, tiles };
}

function formatGeminiHttpError(status: number, rawText: string): string {
  let message: string | undefined;
  try {
    const parsed = JSON.parse(rawText) as { error?: { message?: string; status?: string; code?: number } };
    message = parsed.error?.message;
  } catch {
    /* ignorar */
  }

  if (status === 400 || status === 401 || status === 403) {
    return "Chave da API Google Gemini inválida ou sem permissão. Verifique GEMINI_API_KEY.";
  }
  if (status === 404) {
    return `Modelo Gemini não encontrado. Predefinição: ${DEFAULT_GEMINI_MODEL}. Defina GEMINI_MODEL no .env ou execute \`npm run gemini:list-models\` para ver ids disponíveis.`;
  }
  if (status === 429) {
    return "Limite de pedidos ou cota da Google AI atingida. Tente mais tarde ou veja quotas em https://aistudio.google.com/";
  }
  if (status === 503 || status === 502) {
    return "Serviço Gemini temporariamente indisponível. Tente mais tarde.";
  }

  const snippet = (message ?? rawText).replace(/\s+/g, " ").trim().slice(0, 180);
  return snippet ? `Erro ao contactar a IA (${status}): ${snippet}` : `Erro ao contactar a IA (HTTP ${status}).`;
}

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
};

function extractGeminiText(parsed: GeminiGenerateResponse): string {
  if (parsed.promptFeedback?.blockReason) {
    throw new Error("A resposta foi bloqueada pelas políticas de segurança. Reformule o pedido.");
  }
  const parts = parsed.candidates?.[0]?.content?.parts;
  if (!parts?.length) {
    throw new Error("Resposta da IA vazia ou bloqueada. Tente novamente.");
  }
  const text = parts.map((p) => p.text ?? "").join("\n").trim();
  if (!text) {
    throw new Error("Resposta da IA sem texto.");
  }
  return text;
}

/** Chama a API Gemini (`?key=GEMINI_API_KEY`) e devolve análise + recomendações (+ tiles). */
async function callGeminiGenerate(userContent: string): Promise<CampaignOptimizationResult> {
  const apiKey = geminiApiKey();
  if (!apiKey) {
    throw new Error("O serviço de IA não está disponível no momento.");
  }

  const url = geminiGenerateUrl(apiKey);
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userContent }] }],
    generationConfig: {
      temperature: 0.35,
      responseMimeType: "application/json",
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(formatGeminiHttpError(res.status, rawText));
  }

  let parsed: GeminiGenerateResponse;
  try {
    parsed = JSON.parse(rawText) as GeminiGenerateResponse;
  } catch {
    throw new Error("Resposta Gemini inválida (não é JSON).");
  }

  const content = extractGeminiText(parsed);
  return parseAssistantJson(content);
}

/**
 * Analisa performance de campanhas com base em métricas agregadas e contexto por canal.
 * Utiliza `GEMINI_API_KEY` na query `?key=` e `GEMINI_MODEL` (fallback: `gemini-2.5-flash`).
 */
export async function analyzeCampaignPerformance(data: CampaignAnalysisInput): Promise<CampaignOptimizationResult> {
  return callGeminiGenerate(buildUserPrompt(data));
}

/**
 * Painel de Controlo da IA: envia instrução do gestor + modo (autônomo vs supervisionado).
 */
export async function analyzeCampaignWithInstruction(
  data: CampaignAnalysisInput,
  options: { instruction: string; mode: AiControlMode },
): Promise<CampaignOptimizationResult> {
  const instr = options.instruction.trim();
  const modeBlock =
    options.mode === "autonomous"
      ? "Modo autônomo: assume que podes propor execução imediata de otimizações dentro de boas práticas (redistribuição, pausas), sempre com racional explícito."
      : "Modo supervisionado: propõe apenas alterações; o gestor aprova antes de qualquer mudança real em campanhas.";

  const extra =
    instr.length > 0
      ? `

--- Instrução prioritária do gestor ---
${instr}

--- Contexto operacional ---
${modeBlock}
`
      : `

--- Contexto operacional ---
${modeBlock}
(O gestor não escreveu instrução extra; baseia-te só nos dados.)
`;

  return callGeminiGenerate(`${buildUserPrompt(data)}${extra}`);
}

/** Alias de `GEMINI_GENERATE_CONTENT_PATH` (path sem `?key=`). */
export const GEMINI_GENERATE_CONTENT_URL = GEMINI_GENERATE_CONTENT_PATH;
