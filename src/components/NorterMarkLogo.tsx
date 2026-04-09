import { cn } from "@/lib/utils";
import norterBrand from "@/assets/norter-brand-norterx.png";

export function NorterMarkLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[min(22rem,min(88vw,calc(100vw-env(safe-area-inset-left)-env(safe-area-inset-right))))]",
        className,
      )}
    >
      <div className="flex justify-center px-[max(0.25rem,env(safe-area-inset-left,0px))] pr-[max(0.25rem,env(safe-area-inset-right,0px))]">
        <img
          src={norterBrand}
          alt="Norter"
          width={640}
          height={400}
          className="h-auto w-full max-h-[min(32vh,300px)] object-contain object-center drop-shadow-[0_6px_24px_rgba(0,0,0,0.2)] sm:max-h-[min(30vh,280px)] md:max-h-[min(28vh,320px)] lg:max-h-[min(26vh,340px)]"
          loading="eager"
          decoding="async"
        />
      </div>
      <div className="mt-1 flex flex-col items-center text-center px-1 sm:mt-1.5">
        <span className="font-display text-[10px] uppercase leading-tight sm:text-[11px] tracking-[0.28em] text-muted-foreground/90">
          Aceleradora
        </span>
      </div>
    </div>
  );
}
