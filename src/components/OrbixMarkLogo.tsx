import adHubLogo from "@/assets/ad-hub-logo.png";
import { cn } from "@/lib/utils";

/** Marca AD-HUB no ecrã de login — escala alinhada à Norter; responsivo (dvh) para iPhone / Android. */
export function OrbixMarkLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[min(22rem,min(88vw,calc(100vw-env(safe-area-inset-left)-env(safe-area-inset-right))))]",
        className,
      )}
    >
      <div className="flex justify-center px-[max(0.25rem,env(safe-area-inset-left,0px))] pr-[max(0.25rem,env(safe-area-inset-right,0px))]">
        <img
          src={adHubLogo}
          alt="AD-HUB"
          width={640}
          height={640}
          className="h-auto w-full max-h-[min(40dvh,320px)] object-contain object-center drop-shadow-[0_6px_24px_rgba(0,0,0,0.2)] sm:max-h-[min(32vh,300px)] md:max-h-[min(28vh,320px)] lg:max-h-[min(26vh,340px)]"
          loading="eager"
          decoding="async"
        />
      </div>
      <div className="mt-1 flex flex-col items-center text-center px-2 sm:mt-1.5">
        <span className="font-display text-lg font-bold tracking-[0.14em] text-white sm:text-xl">AD-HUB</span>
        <span className="mt-2 max-w-[min(20rem,90vw)] font-display text-[10px] uppercase leading-relaxed sm:text-[11px] tracking-[0.22em]">
          <span className="bg-gradient-to-r from-violet-300 via-sky-300 to-cyan-400 bg-clip-text text-transparent">
            MOVE FASTER
          </span>
          <span className="mx-1.5 text-slate-500">·</span>
          <span className="bg-gradient-to-r from-sky-300 to-cyan-400 bg-clip-text text-transparent">
            GROW SMARTER
          </span>
        </span>
      </div>
    </div>
  );
}
