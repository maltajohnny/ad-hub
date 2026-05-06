/**
 * Autenticação AD-Hub contra a API Go (/api/ad-hub/auth/*) quando MySQL + ADHUB_JWT_SECRET estão ativos.
 */
import type { User } from "@/types/user";
import type { OrgBillingInfo } from "@/lib/saasTypes";

const TOKEN_KEY = "adhub_jwt";

export const SERVER_MANAGED_PASSWORD = "\u0000server\u0000";

/**
 * Em dev, URLs relativas (proxy Vite → Go). Em produção, `VITE_ADHUB_API_URL` se a API for noutro host.
 * Se o build incluir por engano `http://localhost:3041` e o utilizador abrir o site público, ignoramos —
 * assim o browser usa o mesmo origin (`/api/ad-hub/...`) em vez de falhar em silêncio.
 */
export function adHubPublicApiBase(): string {
  if (import.meta.env.DEV) return "";
  const raw = (import.meta.env.VITE_ADHUB_API_URL ?? "").trim().replace(/\/$/, "");
  if (!raw) return "";
  if (typeof window !== "undefined") {
    try {
      const u = new URL(raw);
      const apiLocal = u.hostname === "localhost" || u.hostname === "127.0.0.1";
      const pageLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      if (apiLocal && !pageLocal) return "";
    } catch {
      /* ignore bad env */
    }
  }
  return raw;
}

export function adHubApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${adHubPublicApiBase()}${p}`;
}

/** URL absoluta do ping (para mensagens de erro e diagnóstico). */
export function adHubAuthPingAbsoluteUrl(): string {
  const rel = adHubApiUrl("/api/ad-hub/auth/ping");
  if (/^https?:\/\//i.test(rel)) return rel;
  if (typeof window !== "undefined") {
    try {
      return new URL(rel, window.location.origin).href;
    } catch {
      return rel;
    }
  }
  return rel;
}

function adHubPingFetchIsCrossOrigin(fetchUrl: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const resolved = new URL(fetchUrl, window.location.href);
    return resolved.origin !== window.location.origin;
  } catch {
    return false;
  }
}

export function getAdHubToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdHubToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Resposta de GET /api/ad-hub/auth/ping (campos extra são opcionais). */
export type AdHubAuthPingResult = {
  ok: boolean;
  db: boolean;
  jwt_ready: boolean;
  hint?: string;
  mysql_dsn_set?: boolean;
  database?: string;
};

/** Falha antes de obter JSON do ping (rede, CORS, HTTP ≠ 2xx, HTML em vez de JSON). */
export type AdHubAuthPingTransportError = {
  transportError: true;
  url: string;
  kind: "network" | "http" | "not_json";
  httpStatus?: number;
  bodyPreview?: string;
  hint?: string;
};

export async function adHubAuthPing(): Promise<AdHubAuthPingResult | AdHubAuthPingTransportError> {
  const displayUrl = adHubAuthPingAbsoluteUrl();
  const fetchPath = adHubApiUrl("/api/ad-hub/auth/ping");
  const crossOrigin = adHubPingFetchIsCrossOrigin(fetchPath);

  let res: Response;
  try {
    res = await fetch(fetchPath, {
      cache: "no-store",
      credentials: crossOrigin ? "omit" : "same-origin",
      mode: "cors",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      transportError: true,
      url: displayUrl,
      kind: "network",
      hint: msg,
    };
  }

  const text = await res.text();
  if (!res.ok) {
    return {
      transportError: true,
      url: displayUrl,
      kind: "http",
      httpStatus: res.status,
      bodyPreview: text.trim().slice(0, 240),
    };
  }

  const trimmed = text.trim();
  if (trimmed.startsWith("<") || (trimmed.length > 0 && !trimmed.startsWith("{"))) {
    return {
      transportError: true,
      url: displayUrl,
      kind: "not_json",
      bodyPreview: trimmed.slice(0, 240),
      hint: "Resposta parece HTML (index da SPA ou 404) — confirme no servidor o proxy de /api/ad-hub para o processo Go.",
    };
  }

  try {
    return JSON.parse(text) as AdHubAuthPingResult;
  } catch {
    return {
      transportError: true,
      url: displayUrl,
      kind: "not_json",
      bodyPreview: trimmed.slice(0, 240),
    };
  }
}

/** Resposta válida do ping com MySQL ligado e JWT configurado no servidor. */
export function isServerAuthLive(
  ping: AdHubAuthPingResult | AdHubAuthPingTransportError | null | undefined,
): boolean {
  if (!ping || ("transportError" in ping && ping.transportError)) return false;
  return Boolean(ping.db && ping.jwt_ready);
}

export function useServerAuth(ping: AdHubAuthPingResult | AdHubAuthPingTransportError | null): boolean {
  return isServerAuthLive(ping);
}

/** `usernameOrEmail` — login normalizado ou e-mail (o servidor aceita ambos). */
export type AdHubRegisterInput = {
  email: string;
  password: string;
  name: string;
  username: string;
  organizationName: string;
  organizationSlug: string;
};

/** Registo público: cria organização + primeiro utilizador (admin). */
export async function adHubRegister(
  input: AdHubRegisterInput,
): Promise<
  | { ok: true; token: string; user: User; organization: { id: string; slug: string; displayName: string } }
  | { ok: false; error: string }
> {
  const res = await fetch(adHubApiUrl("/api/ad-hub/auth/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  let data: { token?: string; user?: User; organization?: { id: string; slug: string; displayName: string }; error?: string };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return { ok: false, error: "Resposta inválida do servidor." };
  }
  if (!res.ok) {
    return { ok: false, error: typeof data.error === "string" ? data.error : `HTTP ${res.status}` };
  }
  if (!data.token || !data.user || !data.organization) {
    return { ok: false, error: "Resposta incompleta do servidor." };
  }
  return {
    ok: true,
    token: data.token,
    user: data.user,
    organization: data.organization,
  };
}

export async function adHubBillingAsaasCheckout(
  token: string,
  payload: Record<string, unknown>,
): Promise<
  | { ok: true; paymentId: string; status?: string; invoiceUrl?: string }
  | { ok: false; error: string }
> {
  const res = await fetch(adHubApiUrl("/api/ad-hub/billing/asaas-checkout"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  let data: { ok?: boolean; paymentId?: string; status?: string; invoiceUrl?: string; error?: string };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return { ok: false, error: "Resposta inválida do servidor." };
  }
  if (!res.ok) {
    return { ok: false, error: typeof data.error === "string" ? data.error : `HTTP ${res.status}` };
  }
  if (data.ok && typeof data.paymentId === "string") {
    return {
      ok: true,
      paymentId: data.paymentId,
      status: data.status,
      invoiceUrl: data.invoiceUrl,
    };
  }
  return { ok: false, error: "Resposta inesperada do servidor." };
}

export async function adHubLogin(
  usernameOrEmail: string,
  password: string,
): Promise<{ token: string; user: User } | null> {
  const res = await fetch(adHubApiUrl("/api/ad-hub/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username: usernameOrEmail, password }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { token: string; user: User };
  if (!data.token || !data.user) return null;
  return data;
}

export async function adHubForgotPassword(email: string): Promise<{ ok: boolean; message?: string; error?: string }> {
  const res = await fetch(adHubApiUrl("/api/ad-hub/auth/forgot-password"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: email.trim() }),
    cache: "no-store",
  });
  try {
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? `HTTP ${res.status}` };
    return { ok: true, message: data.message };
  } catch {
    return { ok: false, error: "Resposta inválida do servidor." };
  }
}

export async function adHubResetPassword(token: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(adHubApiUrl("/api/ad-hub/auth/reset-password"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ token: token.trim(), newPassword }),
    cache: "no-store",
  });
  try {
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? `HTTP ${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, error: "Resposta inválida do servidor." };
  }
}

export async function adHubChangePassword(
  username: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const res = await fetch(adHubApiUrl("/api/ad-hub/auth/password"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username, currentPassword, newPassword }),
    cache: "no-store",
  });
  return res.ok;
}

export type RegistryEntriesPayload = Record<string, { user: User }>;

export async function adHubFetchRegistry(token: string): Promise<RegistryEntriesPayload | null> {
  const res = await fetch(adHubApiUrl("/api/ad-hub/auth/registry"), {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { entries: RegistryEntriesPayload };
  return data.entries ?? null;
}

/** Plano e estado de faturação da organização (JWT). */
export async function adHubFetchOrgSubscription(token: string): Promise<OrgBillingInfo | null> {
  const res = await fetch(adHubApiUrl("/api/ad-hub/auth/organization/subscription"), {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  try {
    const data = (await res.json()) as Partial<OrgBillingInfo>;
    return {
      planSlug: data.planSlug ?? null,
      subscriptionStatus: typeof data.subscriptionStatus === "string" ? data.subscriptionStatus : "none",
      gestorTeamSeats: typeof data.gestorTeamSeats === "number" ? data.gestorTeamSeats : 0,
    };
  } catch {
    return null;
  }
}

async function adHubErrorMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    if (typeof j.error === "string" && j.error.trim() !== "") return j.error;
  } catch {
    /* ignore */
  }
  if (res.status === 503) return "Servidor indisponível (MySQL ou API Go).";
  if (res.status === 401) return "Sessão expirada — inicie sessão novamente.";
  if (res.status === 403) return "Sem permissão para esta operação.";
  if (res.status === 409) return "Este login já existe na base de dados.";
  return `Pedido falhou (HTTP ${res.status}).`;
}

export async function adHubCreateUser(
  token: string,
  username: string,
  password: string,
  user: User,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(adHubApiUrl("/api/ad-hub/auth/users"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ username, password, user }),
    cache: "no-store",
  });
  if (res.ok) return { ok: true };
  return { ok: false, error: await adHubErrorMessage(res) };
}

export async function adHubDeleteUser(token: string, login: string): Promise<boolean> {
  const enc = encodeURIComponent(login);
  const res = await fetch(adHubApiUrl(`/api/ad-hub/auth/users/${enc}`), {
    method: "DELETE",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return res.ok;
}

export async function adHubPatchUser(
  token: string,
  login: string,
  patch: { user?: Partial<User>; newPassword?: string },
): Promise<boolean> {
  const enc = encodeURIComponent(login);
  const res = await fetch(adHubApiUrl(`/api/ad-hub/auth/users/${enc}`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  return res.ok;
}
