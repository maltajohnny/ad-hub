import { clientsData, type Client } from "@/data/clientsCatalog";
import { getClientDetail } from "@/lib/clientDemoDetail";
import {
  loadClientIntegration,
  markScheduleSentForDay,
  type ClientIntegrationSettings,
} from "@/lib/clientIntegrationSettings";
import {
  buildDesempenhoLineChartUrl,
  buildOrcamentoDoughnutUrl,
  SLACK_BUDGET_MERGE_DONUT_DIMS,
  type BudgetSplit,
  type PerformanceMonthRow,
} from "@/lib/slackChartImages";

/** Fallback global: `SLACK_WEBHOOK_URL` ou `VITE_SLACK_WEBHOOK_URL` (ver `envPrefix` no Vite). */
function envWebhook(): string | undefined {
  const v = import.meta.env.SLACK_WEBHOOK_URL ?? import.meta.env.VITE_SLACK_WEBHOOK_URL;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export type ChannelMetrics = {
  investido: number;
  leads: number;
  conversoes: number;
  receita: number;
  cpl: number;
  roi: number;
};

export type FunnelMetrics = {
  impressoes: number;
  cliques: number;
  cpa: number;
  cpc: number;
  cpm: number;
  ctr: number;
};

export type TrafficPerformanceReport = {
  clientName: string;
  /** Texto legível em pt-BR (data + hora do envio). */
  sentAtLabel: string;
  metaAds: ChannelMetrics;
  googleAds: ChannelMetrics;
  instagramAds: ChannelMetrics;
  /** Mesmos pontos do gráfico “Desempenho por canal” no painel. */
  performanceSeries: PerformanceMonthRow[];
  budgetCurrent: BudgetSplit;
  budgetRecommended: BudgetSplit;
  funil: FunnelMetrics;
  insightIA: string;
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

function pickRow(c: Client, channel: "Meta Ads" | "Google Ads" | "Instagram Ads") {
  const d = getClientDetail(c);
  const row = d.roiRows.find((r) => r.channel === channel);
  if (!row) {
    return {
      investido: 0,
      leads: 0,
      conversoes: 0,
      receita: 0,
      cpl: 0,
      roi: 0,
    };
  }
  return {
    investido: row.invested,
    leads: row.leads,
    conversoes: row.conversions,
    receita: row.revenue,
    cpl: row.cpl,
    roi: row.roiMult,
  };
}

function formatSentAt(d: Date): string {
  return d.toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

/** Uma linha para o `text` de fallback (notificação / clientes sem preview rico). */
function compactChartSummary(r: TrafficPerformanceReport): string {
  const s = r.performanceSeries;
  if (s.length === 0) return "Gráficos: desempenho + orçamento (ver Slack).";
  const a = s[0];
  const b = s[s.length - 1];
  const cur = r.budgetCurrent;
  const rec = r.budgetRecommended;
  return [
    `Desempenho (${a.month}→${b.month}, simulado): Meta ${a.meta}→${b.meta}, Google ${a.google}→${b.google}, IG ${a.instagram}→${b.instagram}.`,
    `Orçamento % — atual Meta ${cur.meta}/Google ${cur.google}/IG ${cur.instagram} · IA Meta ${rec.meta}/Google ${rec.google}/IG ${rec.instagram}.`,
  ].join(" ");
}

/** Monta o relatório a partir dos dados já usados no dashboard / Clientes. */
export function buildTrafficPerformanceReport(client: Client): TrafficPerformanceReport {
  const d = getClientDetail(client);
  const now = new Date();
  return {
    clientName: client.name,
    sentAtLabel: formatSentAt(now),
    metaAds: pickRow(client, "Meta Ads"),
    googleAds: pickRow(client, "Google Ads"),
    instagramAds: pickRow(client, "Instagram Ads"),
    performanceSeries: d.performance,
    budgetCurrent: d.budgetCurrent,
    budgetRecommended: d.budgetRecommended,
    funil: {
      impressoes: client.impressions,
      cliques: client.clicks,
      cpa: client.cpa,
      cpc: client.cpc,
      cpm: client.cpm,
      ctr: client.ctr,
    },
    insightIA: client.aiInsight,
  };
}

/** Texto em markdown simples (fallback + cópia legível). */
export function formatReportMarkdown(r: TrafficPerformanceReport): string {
  const ch = (name: string, icon: string, m: ChannelMetrics) =>
    [
      `${icon} *${name}*`,
      `Investido: ${brl(m.investido)}`,
      `Leads: ${m.leads}`,
      `Conversões: ${m.conversoes}`,
      `Receita: ${brl(m.receita)}`,
      `CPL: ${brl(m.cpl)}`,
      `ROI: ${m.roi.toFixed(1)}`,
      "",
    ].join("\n");

  const f = r.funil;
  const cabecalhoCliente = `*${r.clientName}* · consolidado (Google, Meta, Instagram) · enviado em _${r.sentAtLabel}_`;
  return [
    "📊 *RELATÓRIO DE PERFORMANCE DE TRÁFEGO*",
    cabecalhoCliente,
    "",
    ch("Meta Ads", "📘", r.metaAds),
    ch("Google Ads", "🔍", r.googleAds),
    ch("Instagram Ads", "📸", r.instagramAds),
    "",
    "📈 *Gráficos (Slack):* desempenho por canal (linha) e distribuição de orçamento (roscas).",
    compactChartSummary(r),
    "",
    "📈 *FUNIL DE PERFORMANCE*",
    `Impressões: ${f.impressoes.toLocaleString("pt-BR")}`,
    `Cliques: ${f.cliques.toLocaleString("pt-BR")}`,
    `CTR: ${f.ctr.toFixed(2)}%`,
    `CPC: ${brl(f.cpc)}`,
    `CPM: ${brl(f.cpm)}`,
    `CPA: ${brl(f.cpa)}`,
    "",
    "🤖 *INSIGHT DA IA*",
    r.insightIA,
  ].join("\n");
}

type SlackBlock = Record<string, unknown>;

function fieldBlock(label: string, value: string): SlackBlock {
  return { type: "mrkdwn", text: `*${label}*\n${value}` };
}

export type BuildSlackBlocksOptions = {
  /**
   * true: um bloco `image` com a URL da rosca “atual” (o relay junta as duas QuickChart num PNG ~900px).
   * false: duas imagens QuickChart empilhadas (ex.: envio sem relay no servidor).
   */
  relayMerge?: boolean;
};

function budgetDoughnutUrls(r: TrafficPerformanceReport) {
  const d = SLACK_BUDGET_MERGE_DONUT_DIMS;
  return {
    left: buildOrcamentoDoughnutUrl("Distribuição atual", r.budgetCurrent, "atual", d),
    right: buildOrcamentoDoughnutUrl("Recomendado pela IA", r.budgetRecommended, "ia", d),
  };
}

/** Payload Slack Block Kit: colunas com ícones (campos aparecem em 2 colunas). */
export function buildSlackBlocks(r: TrafficPerformanceReport, options?: BuildSlackBlocksOptions): SlackBlock[] {
  const relayMerge = options?.relayMerge === true;
  const lineChartUrl =
    r.performanceSeries.length > 0 ? buildDesempenhoLineChartUrl(r.performanceSeries) : null;
  const { left: doughnutAtualUrl, right: doughnutIaUrl } = budgetDoughnutUrls(r);

  const channelSection = (title: string, emoji: string, m: ChannelMetrics): SlackBlock[] => [
    {
      type: "section",
      text: { type: "mrkdwn", text: `${emoji} *${title}*` },
    },
    {
      type: "section",
      fields: [
        fieldBlock("Investido", brl(m.investido)),
        fieldBlock("Leads", String(m.leads)),
        fieldBlock("Conversões", String(m.conversoes)),
        fieldBlock("Receita", brl(m.receita)),
        fieldBlock("CPL", brl(m.cpl)),
        fieldBlock("ROI", `${m.roi.toFixed(1)}×`),
      ],
    },
    { type: "divider" },
  ];

  const f = r.funil;
  return [
    {
      type: "header",
      text: { type: "plain_text", text: "📊 Relatório de performance de tráfego", emoji: true },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `*${r.clientName}* · consolidado (Google, Meta, Instagram) · enviado em _${r.sentAtLabel}_`,
        },
      ],
    },
    { type: "divider" },
    ...channelSection("Meta Ads", "📘", r.metaAds),
    ...channelSection("Google Ads", "🔍", r.googleAds),
    ...channelSection("Instagram Ads", "📸", r.instagramAds),
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "📈 *Desempenho por canal*\n_Receita / resultado agregado — últimos 6 meses (simulado)_",
      },
    },
    ...(lineChartUrl
      ? ([
          {
            type: "image",
            image_url: lineChartUrl,
            alt_text: "Gráfico de linhas escuro: Meta, Google e Instagram (6 meses)",
          },
        ] as SlackBlock[])
      : []),
    { type: "divider" },
    ...(relayMerge
      ? ([
          {
            type: "image",
            image_url: doughnutAtualUrl,
            alt_text:
              "Orçamento: duas roscas lado a lado (atual e recomendado pela IA) — Meta, Google, Instagram",
          },
        ] as SlackBlock[])
      : ([
          {
            type: "image",
            image_url: doughnutAtualUrl,
            alt_text: "Distribuição atual: Meta, Google e Instagram",
          },
          {
            type: "image",
            image_url: doughnutIaUrl,
            alt_text: "Recomendado pela IA: Meta, Google e Instagram",
          },
        ] as SlackBlock[])),
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "🍩 _Distribuição de orçamento — à esquerda: atual · à direita: recomendado pela IA_",
        },
      ],
    },
    { type: "divider" },
    {
      type: "section",
      text: { type: "mrkdwn", text: "📈 *FUNIL DE PERFORMANCE*" },
    },
    {
      type: "section",
      fields: [
        fieldBlock("Impressões", f.impressoes.toLocaleString("pt-BR")),
        fieldBlock("Cliques", f.cliques.toLocaleString("pt-BR")),
        fieldBlock("CTR", `${f.ctr.toFixed(2)}%`),
        fieldBlock("CPC", brl(f.cpc)),
        fieldBlock("CPM", brl(f.cpm)),
        fieldBlock("CPA", brl(f.cpa)),
      ],
    },
    { type: "divider" },
    {
      type: "section",
      text: { type: "mrkdwn", text: `🤖 *INSIGHT DA IA*\n${r.insightIA}` },
    },
  ];
}

export type SendReportResult = { ok: true } | { ok: false; error: string };

/** No browser o Slack bloqueia CORS; o envio passa pelo relay do Vite ou por `VITE_SLACK_RELAY_URL`. */
function slackRelayUrls(): string[] {
  const base = import.meta.env.VITE_SLACK_RELAY_URL?.trim().replace(/\/$/, "") ?? "";
  if (base) {
    return [`${base}/api/slack-webhook`];
  }
  if (import.meta.env.DEV) {
    return ["/api/slack-webhook"];
  }
  // Apache: ficheiro em dist/api/slack-webhook.php funciona sem depender do rewrite de /api/slack-webhook
  return ["/api/slack-webhook.php", "/api/slack-webhook"];
}

/**
 * Envia o relatório para o Slack (Incoming Webhook).
 * Usa `webhookUrl` se fornecido; senão `SLACK_WEBHOOK_URL` / `VITE_SLACK_WEBHOOK_URL`.
 */
export async function sendReportToSlack(
  reportData: TrafficPerformanceReport,
  webhookUrl?: string,
): Promise<SendReportResult> {
  const url = (webhookUrl?.trim() || envWebhook() || "").trim();
  if (!url) {
    return { ok: false, error: "Nenhum webhook configurado (defina nas definições do cliente ou VITE_SLACK_WEBHOOK_URL)." };
  }

  const text = formatReportMarkdown(reportData);
  const useBrowserRelay = typeof window !== "undefined";
  const blocks = buildSlackBlocks(reportData, { relayMerge: useBrowserRelay });
  const { left: budgetLeft, right: budgetRight } = budgetDoughnutUrls(reportData);
  const body: Record<string, unknown> = { text, blocks };
  if (useBrowserRelay) {
    body.budgetMerge = { left: budgetLeft, right: budgetRight };
  }

  try {
    if (useBrowserRelay) {
      const urls = slackRelayUrls();
      let res!: Response;
      let raw = "";
      for (let i = 0; i < urls.length; i++) {
        const relayUrl = urls[i];
        res = await fetch(relayUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ webhookUrl: url, ...body }),
        });
        raw = await res.text().catch(() => "");
        if (res.ok) break;
        if (res.status !== 404 || i === urls.length - 1) break;
      }
      if (!res.ok) {
        if (res.status === 404) {
          return {
            ok: false,
            error:
              "Relay Slack indisponível (404). Confirme que `dist/api/slack-webhook.php` está no servidor; em dev use `npm run dev`. Opcional: `VITE_SLACK_RELAY_URL` com a URL base do relay (ex.: Vercel).",
          };
        }
        try {
          const j = JSON.parse(raw) as { error?: string };
          if (j.error) return { ok: false, error: j.error };
        } catch {
          /* ignore */
        }
        return { ok: false, error: raw || `HTTP ${res.status}` };
      }
      let j: { ok?: boolean; slack?: string; error?: string };
      try {
        j = JSON.parse(raw) as typeof j;
      } catch {
        return {
          ok: false,
          error:
            "Relay Slack devolveu resposta inválida (não JSON). Em produção confirme que /api/slack-webhook chega a `slack-webhook.php` (não ao index.html da SPA).",
        };
      }
      if (typeof j.error === "string" && j.error.trim()) {
        return { ok: false, error: j.error.trim() };
      }
      if (j.ok === false) {
        return { ok: false, error: j.slack?.trim() || "Slack rejeitou o envio." };
      }
      if (j.ok !== true) {
        return {
          ok: false,
          error:
            "Resposta inesperada do relay Slack (esperado JSON com ok: true). Verifique `public/api/slack-webhook.php` e os logs PHP no servidor.",
        };
      }
      return { ok: true };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return { ok: false, error: errBody || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

function resolveWebhookForClient(clientId: number, settings?: ClientIntegrationSettings): string | undefined {
  const s = settings ?? loadClientIntegration(clientId);
  const u = s.slackWebhookUrl?.trim();
  if (u) return u;
  return envWebhook();
}

/** Envio manual pelo gestor (botão "Enviar relatório"). */
export async function sendManualReport(clientId: number): Promise<SendReportResult> {
  const client = clientsData.find((c) => c.id === clientId);
  if (!client) {
    return { ok: false, error: "Cliente não encontrado." };
  }
  const report = buildTrafficPerformanceReport(client);
  const url = resolveWebhookForClient(clientId);
  return sendReportToSlack(report, url);
}

/**
 * Agendamento por intervalo fixo (ex.: a cada N ms). Devolve função `cancel`.
 */
export function scheduleReport(options: { intervalMs: number; onTick: () => void | Promise<void> }): () => void {
  const id = window.setInterval(() => {
    void Promise.resolve(options.onTick());
  }, Math.max(30_000, options.intervalMs));
  return () => clearInterval(id);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function matchesTime(d: Date, hhmm: string): boolean {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return false;
  return d.getHours() === h && d.getMinutes() === m;
}

/** Verifica agendamentos guardados e envia quando dia/hora coincidem (máx. 1 envio por cliente por dia). */
export async function runScheduledReportChecks(): Promise<void> {
  const now = new Date();
  const day = now.getDay();
  const dayKey = todayKey(now);

  for (const c of clientsData) {
    const settings = loadClientIntegration(c.id);
    if (!settings.scheduleEnabled) continue;
    const url = resolveWebhookForClient(c.id, settings);
    if (!url) continue;
    if (settings.scheduleWeekdays.length === 0) continue;
    if (!settings.scheduleWeekdays.includes(day)) continue;
    if (!matchesTime(now, settings.scheduleTime)) continue;
    if (settings.lastScheduleDay === dayKey) continue;

    const r = await sendManualReport(c.id);
    if (r.ok) {
      markScheduleSentForDay(c.id, dayKey);
    }
  }
}
