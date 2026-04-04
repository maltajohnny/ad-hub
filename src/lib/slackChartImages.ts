/**
 * Gráficos QuickChart (Chart.js 4) para o Slack.
 * Fundo em cinza-ardósia (#1e293b) para contrastar com o preto do Slack e com temas escuros.
 * Cores de canal iguais ao painel: Meta #3B82F6 · Google #10B981 · Instagram #DB2777
 */

export type PerformanceMonthRow = { month: string; meta: number; google: number; instagram: number };

export type BudgetSplit = { meta: number; google: number; instagram: number };

const CH_META = "#3B82F6";
const CH_GOOGLE = "#10B981";
const CH_INSTA = "#DB2777";

/** “Cartão” visível no Slack (evita fundir com #000 / tema escuro). */
const CARD_BG = "#1e293b";
/** Bordas entre fatias da rosca — antes usava-se o mesmo fundo e sumia tudo. */
const SLICE_EDGE = "#475569";
const TEXT = "#f8fafc";
const TEXT_MUTED = "#cbd5e1";
/** Título “Recomendado pela IA” (referência: borda/teal no cartão). */
const TITLE_IA = "#2dd4bf";
const GRID = "rgba(226,232,240,0.18)";

const SLACK_IMAGE_URL_MAX = 1950;

function buildQuickChartUrl(chartConfig: Record<string, unknown>, dims: { w: number; h: number }, dpr: 1 | 2): string {
  const json = JSON.stringify(chartConfig);
  const c = encodeURIComponent(json);
  const bkg = encodeURIComponent(CARD_BG);
  const url = `https://quickchart.io/chart?version=4&devicePixelRatio=${dpr}&format=png&bkg=${bkg}&w=${dims.w}&h=${dims.h}&c=${c}`;
  if (url.length <= SLACK_IMAGE_URL_MAX) return url;
  const urlDpr1 = `https://quickchart.io/chart?version=4&devicePixelRatio=1&format=png&bkg=${bkg}&w=${dims.w}&h=${dims.h}&c=${c}`;
  if (urlDpr1.length <= SLACK_IMAGE_URL_MAX) return urlDpr1;
  return buildQuickChartUrlCompact(chartConfig, dims);
}

/** Duas roscas lado a lado com a mesma altura do gráfico de linhas; soma ~900px de largura (relay Jimp junta as duas QuickChart). */
export const SLACK_BUDGET_MERGE_DONUT_DIMS = { w: 439, h: 380 } as const;

function buildQuickChartUrlCompact(chartConfig: Record<string, unknown>, dims: { w: number; h: number }): string {
  const copy = JSON.parse(JSON.stringify(chartConfig)) as Record<string, unknown>;
  const opts = copy.options as Record<string, unknown> | undefined;
  const plug = opts?.plugins as Record<string, unknown> | undefined;
  if (plug?.title) (plug.title as Record<string, unknown>).text = "Desempenho";
  const json = JSON.stringify(copy);
  const c = encodeURIComponent(json);
  const bkg = encodeURIComponent(CARD_BG);
  return `https://quickchart.io/chart?version=4&devicePixelRatio=1&format=png&bkg=${bkg}&w=${Math.min(dims.w, 720)}&h=${Math.min(dims.h, 320)}&c=${c}`;
}

function yAxisMax(series: PerformanceMonthRow[]): number {
  const vals = series.flatMap((s) => [s.meta, s.google, s.instagram]);
  const maxVal = Math.max(...vals, 1);
  if (maxVal <= 100) return 100;
  return Math.ceil(maxVal / 25) * 25;
}

export function buildDesempenhoLineChartUrl(series: PerformanceMonthRow[]): string {
  const labels = series.map((s) => s.month);
  const yMax = yAxisMax(series);
  const step = yMax <= 100 ? 25 : Math.max(10, Math.round(yMax / 5 / 10) * 10);

  const config = {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Meta",
          data: series.map((s) => s.meta),
          borderColor: CH_META,
          backgroundColor: "rgba(59,130,246,0.22)",
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 0,
        },
        {
          label: "Google",
          data: series.map((s) => s.google),
          borderColor: CH_GOOGLE,
          backgroundColor: "rgba(16,185,129,0.18)",
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 0,
        },
        {
          label: "Instagram",
          data: series.map((s) => s.instagram),
          borderColor: CH_INSTA,
          backgroundColor: "rgba(219,39,119,0.18)",
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 0,
        },
      ],
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: "Desempenho por Canal",
          color: TEXT,
          font: { size: 14, weight: "600" },
        },
        legend: {
          position: "bottom",
          labels: { color: TEXT_MUTED, usePointStyle: true, pointStyle: "circle", padding: 8 },
        },
      },
      scales: {
        x: { ticks: { color: TEXT_MUTED }, grid: { display: false } },
        y: {
          min: 0,
          max: yMax,
          ticks: { color: TEXT_MUTED, stepSize: step },
          grid: { color: GRID, borderDash: [5, 5], drawBorder: false },
          border: { display: false },
        },
      },
    },
  };

  return buildQuickChartUrl(config, { w: 900, h: 380 }, 2);
}

export type OrcamentoVariant = "atual" | "ia";

export function buildOrcamentoDoughnutUrl(
  title: string,
  pct: BudgetSplit,
  variant: OrcamentoVariant = "atual",
  dims: { w: number; h: number } = { w: 340, h: 380 },
): string {
  const titleColor = variant === "ia" ? TITLE_IA : TEXT_MUTED;

  const config = {
    type: "doughnut",
    data: {
      labels: [`Meta Ads ${pct.meta}%`, `Google Ads ${pct.google}%`, `Instagram ${pct.instagram}%`],
      datasets: [
        {
          data: [pct.meta, pct.google, pct.instagram],
          backgroundColor: [CH_META, CH_GOOGLE, CH_INSTA],
          borderWidth: 2,
          borderColor: [SLICE_EDGE, SLICE_EDGE, SLICE_EDGE],
        },
      ],
    },
    options: {
      /** Mesmo fundo global que o gráfico de linhas (`bkg` na URL = CARD_BG). */
      layout: { padding: { top: 8, bottom: 6, left: 2, right: 2 } },
      cutout: "48%",
      plugins: {
        title: {
          display: true,
          text: title,
          color: titleColor,
          font: { size: variant === "ia" ? 15 : 14, weight: "600" },
          padding: { bottom: 8 },
        },
        legend: {
          position: "bottom",
          labels: {
            color: TEXT_MUTED,
            usePointStyle: true,
            pointStyle: "rect",
            padding: 6,
            boxWidth: 10,
            font: { size: 11 },
          },
        },
      },
    },
  };

  return buildQuickChartUrl(config, dims, 2);
}
