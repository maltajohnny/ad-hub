/** Login: sem espaços nem vírgulas; letras, números, ponto, @ e outros caracteres permitidos. */

const MAX_LOGIN_LEN = 80;

export function sanitizeLoginInput(raw: string): string {
  return raw.replace(/[\s,]/g, "");
}

export function isValidLoginUsername(raw: string): boolean {
  const s = sanitizeLoginInput(raw).trim();
  if (s.length < 1 || s.length > MAX_LOGIN_LEN) return false;
  return !/[\s,]/.test(s);
}

export function normalizeLoginKey(raw: string): string {
  return sanitizeLoginInput(raw).trim().toLowerCase();
}
