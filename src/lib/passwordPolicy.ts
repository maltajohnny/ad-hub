/** Regra: mínimo 6 caracteres, ao menos uma maiúscula, uma minúscula e um caractere especial. */

export function isStrongPassword(password: string): boolean {
  if (password.length < 6) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

export const STRONG_PASSWORD_HINT =
  "Mínimo 6 caracteres, com letra maiúscula, minúscula e caractere especial (ex.: ! @ # $).";

export const CONFIRM_PASSWORD_MISMATCH_HINT = "A confirmação da nova senha não confere.";

/**
 * Brilho laranja colado ao contorno (box-shadow). Sem `filter: blur()` num div — isso “vaza” muito para fora.
 * Combinar com fundo opaco no input (`bg-secondary`) para não misturar com o vidro.
 */
export const PASSWORD_INPUT_ERROR_GLOW_CLASS =
  "shadow-[0_0_0_1px_rgba(234,88,12,0.55),0_0_3px_0px_rgba(249,115,22,0.18)] dark:shadow-[0_0_0_1px_rgba(251,146,60,0.65),0_0_3px_0px_rgba(251,146,60,0.2)]";

/** Aviso persistente abaixo do campo até a senha ficar válida (ou confirmação coincidir). */
export const PASSWORD_FIELD_INLINE_ALERT_CLASS =
  "text-xs leading-snug text-orange-800 dark:text-orange-200 bg-orange-500/12 border border-orange-500/35 rounded-md px-2 py-1.5";
