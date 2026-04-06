import { APP_MODULE_LABELS, type AppModule } from "@/lib/saasTypes";
import { cn } from "@/lib/utils";
import { IntelliSearchNewBadge } from "@/components/IntelliSearchNewBadge";

/** Rótulo ao lado do checkbox de módulos — IntelliSearch com badge NEW. */
export function ModuleCheckboxLabel({ appModule, className }: { appModule: AppModule; className?: string }) {
  if (appModule !== "intelli-search") {
    return <span className={className}>{APP_MODULE_LABELS[appModule]}</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-2 min-w-0 flex-wrap", className)}>
      <span className="font-medium text-foreground">{APP_MODULE_LABELS[appModule]}</span>
      <IntelliSearchNewBadge className="shrink-0" />
    </span>
  );
}
