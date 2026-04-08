import adHubLogo from "@/assets/ad-hub-logo.png";

/** Marca AD-HUB na sidebar autenticada (não usar na landing). */
export function OrbixSidebarBrand() {
  return (
    <div className="flex min-w-0 w-full items-center gap-2.5 text-left">
      <img
        src={adHubLogo}
        alt="AD-HUB"
        width={80}
        height={80}
        className="h-10 w-10 shrink-0 object-contain"
        decoding="async"
      />
      <div className="flex min-w-0 flex-col justify-center gap-0.5 border-l border-sidebar-border/45 pl-2.5">
        <span className="font-display text-[15px] font-bold leading-none tracking-[0.1em] text-sidebar-foreground sm:text-[16px]">
          AD-Hub
        </span>
        <span className="max-w-[11rem] font-display text-[7px] uppercase leading-snug tracking-[0.18em] sm:text-[8px] sm:tracking-[0.2em]">
          <span className="bg-gradient-to-r from-violet-300/95 via-sky-300/95 to-cyan-400/95 bg-clip-text text-transparent">
            Move faster
          </span>
          <span className="mx-0.5 text-sidebar-foreground/35">·</span>
          <span className="bg-gradient-to-r from-sky-300/95 to-cyan-400/95 bg-clip-text text-transparent">
            Grow smarter
          </span>
        </span>
      </div>
    </div>
  );
}
