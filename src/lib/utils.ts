import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** E-mail com formato mínimo plausível (UX; validação definitiva fica no servidor). */
export function isPlausibleEmail(s: string): boolean {
  const t = s.trim();
  if (t.length < 5) return false;
  const at = t.indexOf("@");
  if (at <= 0 || at === t.length - 1) return false;
  const dot = t.lastIndexOf(".");
  return dot > at + 1 && dot < t.length - 1;
}
