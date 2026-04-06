import { APP_MODULE_LABELS, type AppModule } from "@/lib/saasTypes";
import { Wand2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { IntelliSearchNewBadge } from "@/components/IntelliSearchNewBadge";

/** Rótulo ao lado do checkbox de módulos — IntelliSearch com varinha, estrelinhas e badge NEW. */
export function ModuleCheckboxLabel({ appModule, className }: { appModule: AppModule; className?: string }) {
  if (appModule !== "intelli-search") {
    return <span className={className}>{APP_MODULE_LABELS[appModule]}</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-2 min-w-0 flex-wrap", className)}>
      <span
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary shadow-[0_0_14px_hsl(var(--primary)/0.3)] ring-1 ring-primary/35"
        title="IntelliSearch"
      >
        <Wand2 className="h-3.5 w-3.5" aria-hidden />
      </span>
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-cyan-400/90" aria-hidden />
      <span className="font-medium text-foreground">{APP_MODULE_LABELS[appModule]}</span>
      <IntelliSearchNewBadge className="shrink-0" />
    </span>
  );
}
