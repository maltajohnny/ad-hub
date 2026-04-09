import adHubLogo from "@/assets/ad-hub-logo.png";

/** Marca AD-HUB na sidebar autenticada — altura do mark alinhada à wordmark Norter (65px). */
export function OrbixSidebarBrand() {
  return (
    <div className="flex min-w-0 w-full items-center gap-3 text-left">
      <img
        src={adHubLogo}
        alt="AD-HUB"
        width={65}
        height={65}
        className="h-[65px] w-[65px] shrink-0 object-contain"
        decoding="async"
      />
      <div className="flex min-w-0 flex-col justify-center gap-0.5 border-l border-sidebar-border/45 pl-3">
        <span className="font-display text-[15px] font-bold leading-none tracking-[0.12em] text-sidebar-foreground sm:text-[16px]">
          AD-HUB
        </span>
        <span className="max-w-[11rem] font-display text-[7px] uppercase leading-snug tracking-[0.18em] sm:text-[8px] sm:tracking-[0.2em]">
          <span className="bg-gradient-to-r from-violet-300/95 via-sky-300/95 to-cyan-400/95 bg-clip-text text-transparent">
            MOVE FASTER
          </span>
          <span className="mx-0.5 text-sidebar-foreground/35">·</span>
          <span className="bg-gradient-to-r from-sky-300/95 to-cyan-400/95 bg-clip-text text-transparent">
            GROW SMARTER
          </span>
        </span>
      </div>
    </div>
  );
}
