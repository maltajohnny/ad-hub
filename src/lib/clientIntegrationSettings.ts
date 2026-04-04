/**
 * Configurações por cliente: webhook Slack, agendamento de relatórios, etc.
 * Persistido em localStorage (demo / sem backend).
 */

const STORAGE_KEY = "norter_client_integrations_v1";

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
};

const defaultSettings = (): ClientIntegrationSettings => ({
  slackWebhookUrl: "",
  contactEmail: "",
  notas: "",
  scheduleEnabled: false,
  scheduleWeekdays: [1, 3, 5],
  scheduleTime: "14:00",
});

/** Webhooks padrão por id de cliente (Incoming Webhooks do Slack). */
export const DEFAULT_SLACK_WEBHOOK_BY_CLIENT_ID: Record<number, string> = {
  1: "https://hooks.slack.com/services/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",
  2: "https://hooks.slack.com/services/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",
  3: "https://hooks.slack.com/services/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",
  4: "https://hooks.slack.com/services/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",
  5: "https://hooks.slack.com/services/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",
  6: "https://hooks.slack.com/services/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",
  7: "https://hooks.slack.com/services/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",
  8: "https://hooks.slack.com/services/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",
};

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
