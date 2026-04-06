import { useMemo } from "react";
import { cn } from "@/lib/utils";

export type HoursRow = { label: string; hours: string; order: number };

/** Chave do dia normalizada (minúsculas, sem acentos, underscore). */
function normalizeDayKey(key: string): string {
  return key
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

const DAY_LABELS: Record<string, string> = {
  segunda_feira: "Segunda-feira",
  terca_feira: "Terça-feira",
  quarta_feira: "Quarta-feira",
  quinta_feira: "Quinta-feira",
  sexta_feira: "Sexta-feira",
  sabado: "Sábado",
  domingo: "Domingo",
};

function prettyDayLabel(key: string): string {
  const n = normalizeDayKey(key);
  if (DAY_LABELS[n]) return DAY_LABELS[n];
  return key
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function dayOrder(key: string): number {
  const n = normalizeDayKey(key);
  if (n.includes("segunda")) return 0;
  if (n.includes("terca") && n.includes("feira")) return 1;
  if (n.includes("quarta")) return 2;
  if (n.includes("quinta")) return 3;
  if (n.includes("sexta")) return 4;
  if (n.includes("sabado")) return 5;
  if (n.includes("domingo")) return 6;
  return 50;
}

/**
 * Extrai linhas { label, hours } a partir de hours_summary (texto, JSON array ou objeto).
 */
export function parseBusinessHoursRows(raw: string | undefined | null): HoursRow[] | null {
  if (raw == null || String(raw).trim() === "") return null;
  const t = String(raw).trim();
  if (!t.startsWith("[") && !t.startsWith("{")) {
    return null;
  }
  try {
    const data = JSON.parse(t) as unknown;
    const acc: HoursRow[] = [];

    const pushPair = (dayKey: string, value: unknown) => {
      if (value == null) return;
      const hours = typeof value === "string" ? value : String(value);
      acc.push({
        label: prettyDayLabel(dayKey),
        hours,
        order: dayOrder(dayKey),
      });
    };

    if (Array.isArray(data)) {
      for (const item of data) {
        if (item != null && typeof item === "object" && !Array.isArray(item)) {
          for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
            pushPair(k, v);
          }
        }
      }
    } else if (data != null && typeof data === "object" && !Array.isArray(data)) {
      for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
        pushPair(k, v);
      }
    }

    if (acc.length === 0) return null;
    acc.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "pt-BR"));
    return acc;
  } catch {
    return null;
  }
}

type Props = {
  value: string;
  className?: string;
};

/**
 * Horário de funcionamento: formata JSON da SerpAPI como lista; texto simples mantém-se.
 */
export function BusinessHoursDisplay({ value, className }: Props) {
  const rows = useMemo(() => parseBusinessHoursRows(value), [value]);

  if (!value.trim()) {
    return <span className={className}>—</span>;
  }

  if (!rows || rows.length === 0) {
    return <span className={cn("break-words text-sm text-muted-foreground", className)}>{value}</span>;
  }

  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Horário de funcionamento</p>
      <ul className="space-y-1.5 border-l border-border/60 pl-2.5">
        {rows.map((r, i) => (
          <li
            key={`${r.label}-${i}`}
            className="grid grid-cols-1 min-[280px]:grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-sm leading-snug"
          >
            <span className="text-muted-foreground">{r.label}</span>
            <span className="tabular-nums text-foreground/95 min-[280px]:text-right">{r.hours}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
