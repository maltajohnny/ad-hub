/**
 * Autenticação AD-Hub contra a API Go (/api/ad-hub/auth/*) quando MySQL + ADHUB_JWT_SECRET estão ativos.
 */
import type { User } from "@/types/user";

const TOKEN_KEY = "adhub_jwt";

export const SERVER_MANAGED_PASSWORD = "\u0000server\u0000";

function base(): string {
  return "";
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

export async function adHubAuthPing(): Promise<{ ok: boolean; db: boolean; jwt_ready: boolean } | null> {
  try {
    const res = await fetch(`${base()}/api/ad-hub/auth/ping`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as { ok: boolean; db: boolean; jwt_ready: boolean };
  } catch {
    return null;
  }
}

/** Resposta válida do ping com MySQL ligado e JWT configurado no servidor. */
export function isServerAuthLive(ping: { db: boolean; jwt_ready: boolean } | null | undefined): boolean {
  return Boolean(ping?.db && ping?.jwt_ready);
}

export function useServerAuth(ping: { db: boolean; jwt_ready: boolean } | null): boolean {
  return isServerAuthLive(ping);
}

/** `usernameOrEmail` — login normalizado ou e-mail (o servidor aceita ambos). */
export async function adHubLogin(
  usernameOrEmail: string,
  password: string,
): Promise<{ token: string; user: User } | null> {
  const res = await fetch(`${base()}/api/ad-hub/auth/login`, {
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
  const res = await fetch(`${base()}/api/ad-hub/auth/forgot-password`, {
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
  const res = await fetch(`${base()}/api/ad-hub/auth/reset-password`, {
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
  const res = await fetch(`${base()}/api/ad-hub/auth/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username, currentPassword, newPassword }),
    cache: "no-store",
  });
  return res.ok;
}

export type RegistryEntriesPayload = Record<string, { user: User }>;

export async function adHubFetchRegistry(token: string): Promise<RegistryEntriesPayload | null> {
  const res = await fetch(`${base()}/api/ad-hub/auth/registry`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { entries: RegistryEntriesPayload };
  return data.entries ?? null;
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
  const res = await fetch(`${base()}/api/ad-hub/auth/users`, {
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
  const res = await fetch(`${base()}/api/ad-hub/auth/users/${enc}`, {
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
  const res = await fetch(`${base()}/api/ad-hub/auth/users/${enc}`, {
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
