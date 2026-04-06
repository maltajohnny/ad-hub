import qtrafficMark from "@/assets/qtraffic-mark-only.png";

/**
 * Marca Qtraffic: PNG oficial com fundo removido (só o ícone Q).
 * Abaixo: QTRAFFIC + Move faster · Grow smarter.
 */
export function QtrafficMarkLogo({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="mx-auto flex w-[min(92vw,260px)] justify-center">
        <img
          src={qtrafficMark}
          alt="QTRAFFIC"
          width={549}
          height={455}
          className="h-auto w-full max-h-[200px] object-contain drop-shadow-[0_12px_40px_rgba(34,211,238,0.18)] sm:max-h-[220px]"
          loading="eager"
          decoding="async"
        />
      </div>
      <div className="mt-5 flex flex-col items-center text-center px-1">
        <span className="font-display text-xl font-bold tracking-[0.14em] text-white sm:text-2xl">QTRAFFIC</span>
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
