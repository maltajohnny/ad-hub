/**
 * Configurações por cliente: webhook Slack, agendamento de relatórios, etc.
 * Persistido em localStorage (demo / sem backend).
 */

const STORAGE_KEY = "norter_client_integrations_v1";

/** Métricas por canal (Meta / Google / Instagram) no relatório Slack. */
export type SlackReportChannelFields = {
  showInvested: boolean;
  showLeads: boolean;
  showConversions: boolean;
  showRevenue: boolean;
  showCpl: boolean;
  showRoi: boolean;
  /** Mesmo valor numérico que CPL; rótulo para campanhas de mensagens */
  showCostPerMessage: boolean;
};

/** Funil agregado (impressões, CPC, etc.) no relatório Slack. */
export type SlackReportFunnelFields = {
  showImpressions: boolean;
  showClicks: boolean;
  showCtr: boolean;
  showCpc: boolean;
  showCpm: boolean;
  showCpa: boolean;
};

export type SlackReportSections = {
  showPerformanceChart: boolean;
  showBudgetDonuts: boolean;
  showAiInsight: boolean;
};

export type SlackReportPreferences = {
  channels: SlackReportChannelFields;
  funnel: SlackReportFunnelFields;
  sections: SlackReportSections;
};

export const DEFAULT_SLACK_REPORT_PREFS: SlackReportPreferences = {
  channels: {
    showInvested: true,
    showLeads: true,
    showConversions: true,
    showRevenue: true,
    showCpl: true,
    showRoi: true,
    showCostPerMessage: true,
  },
  funnel: {
    showImpressions: true,
    showClicks: true,
    showCtr: true,
    showCpc: true,
    showCpm: true,
    showCpa: true,
  },
  sections: {
    showPerformanceChart: true,
    showBudgetDonuts: true,
    showAiInsight: true,
  },
};

function deepMergeReportPrefs(partial?: Partial<SlackReportPreferences>): SlackReportPreferences {
  const base = DEFAULT_SLACK_REPORT_PREFS;
  if (!partial) return { ...base, channels: { ...base.channels }, funnel: { ...base.funnel }, sections: { ...base.sections } };
  return {
    channels: { ...base.channels, ...partial.channels },
    funnel: { ...base.funnel, ...partial.funnel },
    sections: { ...base.sections, ...partial.sections },
  };
}

/** Preferências efectivas para montar o payload Slack (defaults + guardado). */
export function resolveSlackReportPreferences(settings: ClientIntegrationSettings): SlackReportPreferences {
  return deepMergeReportPrefs(settings.slackReportPrefs);
}

export type ClientIntegrationSettings = {
  slackWebhookUrl: string;
  /** E-mail de contacto do gestor (opcional, para referência interna) */
  contactEmail: string;
  notas: string;
  scheduleEnabled: boolean;
  /** 0 = domingo … 6 = sábado (Date.getDay()) */
  scheduleWeekdays: number[];
  /** "HH:mm" formato 24h */
  scheduleTime: string;
  /** YYYY-MM-DD do último envio automático (evita duplicar no mesmo dia) */
  lastScheduleDay?: string;
  /** Campos incluídos no relatório Slack (parcial; falta usa default). */
  slackReportPrefs?: Partial<SlackReportPreferences>;
};

const defaultSettings = (): ClientIntegrationSettings => ({
  slackWebhookUrl: "",
  contactEmail: "",
  notas: "",
  scheduleEnabled: false,
  scheduleWeekdays: [1, 3, 5],
  scheduleTime: "14:00",
});

/**
 * Webhooks opcionais por id de cliente (Incoming Webhooks).
 * Não coloque URLs reais aqui — o GitHub bloqueia push (secret scanning).
 * Use `SLACK_WEBHOOK_URL` no `.env` / GitHub Secret ou as definições do cliente na app.
 */
export const DEFAULT_SLACK_WEBHOOK_BY_CLIENT_ID: Record<number, string> = {};

type Store = Record<string, ClientIntegrationSettings>;

function loadAll(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

function saveAll(data: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadClientIntegration(clientId: number): ClientIntegrationSettings {
  const all = loadAll();
  const key = String(clientId);
  const base = defaultSettings();
  const stored = all[key];
  if (!stored) {
    const merged = { ...base };
    if (DEFAULT_SLACK_WEBHOOK_BY_CLIENT_ID[clientId]) {
      merged.slackWebhookUrl = DEFAULT_SLACK_WEBHOOK_BY_CLIENT_ID[clientId];
    }
    return merged;
  }
  return { ...base, ...stored };
}

export function saveClientIntegration(clientId: number, patch: Partial<ClientIntegrationSettings>) {
  const all = loadAll();
  const key = String(clientId);
  const prev = { ...defaultSettings(), ...all[key] };
  all[key] = { ...prev, ...patch };
  saveAll(all);
}

export function markScheduleSentForDay(clientId: number, dayKey: string) {
  const all = loadAll();
  const key = String(clientId);
  const prev = { ...defaultSettings(), ...all[key] };
  all[key] = { ...prev, lastScheduleDay: dayKey };
  saveAll(all);
}
