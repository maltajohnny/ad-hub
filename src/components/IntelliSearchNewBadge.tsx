import { cn } from "@/lib/utils";

/**
 * Etiqueta «NEW» estilo pincel / sticker, com gradiente da marca (ciano → primário → violeta).
 */
export function IntelliSearchNewBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center select-none",
        "-rotate-[3deg] skew-x-[-8deg] scale-100",
        className,
      )}
      aria-label="Novo"
    >
      <span
        className={cn(
          "absolute inset-0 rounded-[3px_14px_5px_12px]",
          "bg-gradient-to-br from-cyan-400 via-[hsl(var(--primary))] to-violet-500",
          "shadow-[0_2px_10px_rgba(34,211,238,0.35),0_1px_0_rgba(255,255,255,0.2)_inset]",
        )}
        aria-hidden
      />
      <span
        className="absolute -inset-[1px] rounded-[3px_14px_5px_12px] bg-gradient-to-t from-black/15 to-white/20 opacity-90"
        aria-hidden
      />
      <span className="relative px-2 py-0.5 font-display text-[9px] font-black uppercase tracking-[0.2em] text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)] sm:text-[10px]">
        NEW
      </span>
    </span>
  );
}
