import adHubLogo from "@/assets/ad-hub-logo.png";

/** Marca AD-Hub no ecrã de login (logo + wordmark). */
export function OrbixMarkLogo({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="mx-auto flex w-[55px] justify-center">
        <img
          src={adHubLogo}
          alt="AD-Hub"
          width={55}
          height={55}
          className="h-[55px] w-[55px] object-contain drop-shadow-[0_12px_40px_rgba(138,63,252,0.2)]"
          loading="eager"
          decoding="async"
        />
      </div>
      <div className="mt-5 flex flex-col items-center text-center px-1">
        <span className="font-display text-xl font-bold tracking-[0.14em] text-white sm:text-2xl">AD-Hub</span>
        <span className="mt-2 max-w-[300px] font-display text-[10px] uppercase leading-relaxed sm:text-[11px] tracking-[0.22em]">
          <span className="bg-gradient-to-r from-violet-300 via-sky-300 to-cyan-400 bg-clip-text text-transparent">
            Move faster
          </span>
          <span className="mx-1.5 text-slate-500">·</span>
          <span className="bg-gradient-to-r from-sky-300 to-cyan-400 bg-clip-text text-transparent">
            Grow smarter
          </span>
        </span>
      </div>
    </div>
  );
}
