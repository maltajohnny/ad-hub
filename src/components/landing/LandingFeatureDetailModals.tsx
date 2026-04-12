import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Brain,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  LineChart,
  Megaphone,
  Target,
  Users,
  Zap,
} from "lucide-react";

export type LandingFeatureKey =
  | "Análises automatizadas"
  | "KPIs alinhados ao negócio"
  | "Menos tempo operacional"
  | "Foco no que converte"
  | "Visão de gestor"
  | "Controle humano";

const DETAIL: Record<
  LandingFeatureKey,
  { title: string; body: string[]; bullets?: string[] }
> = {
  "Análises automatizadas": {
    title: "Análises automatizadas",
    body: [
      "A IA lê continuamente o desempenho das campanhas e dos canais, destaca anomalias e tendências e traduz números em próximos passos.",
      "Menos exportações manuais: o gestor valida o contexto e executa com base em insights já estruturados.",
    ],
    bullets: ["Alertas de variação de CPA e conversões", "Síntese por canal e por objetivo", "Histórico para comparar períodos"],
  },
  "KPIs alinhados ao negócio": {
    title: "KPIs alinhados ao negócio",
    body: [
      "CPA, conversões, CPM, ROI e métricas de funil aparecem no mesmo painel, com a mesma moeda e o mesmo recorte temporal.",
      "Ideal para reuniões rápidas: uma única fonte da verdade antes de mexer em orçamento ou criativo.",
    ],
    bullets: ["Painel único por cliente e por canal", "Comparativos e benchmarks internos", "Exportação só quando precisar"],
  },
  "Menos tempo operacional": {
    title: "Menos tempo operacional",
    body: [
      "Dados e fluxos centralizados reduzem ruído entre ferramentas e pessoas. O gestor testa e otimiza com menos cliques e menos contexto perdido.",
      "Veja na demonstração ao lado como a navegação por módulo e por rede fica organizada numa única experiência.",
    ],
  },
  "Foco no que converte": {
    title: "Foco no que converte",
    body: [
      "Priorização por canal e campanha com base em dados reais e no contexto do cliente (segmento, sazonalidade, criativo).",
      "A IA sugere onde reforçar ou pausar; o gestor decide com base na estratégia e no risco.",
    ],
    bullets: ["Ranking de oportunidades", "Impacto estimado por mudança", "Menos dispersão entre abas e relatórios"],
  },
  "Visão de gestor": {
    title: "Visão de gestor",
    body: [
      "Do resumo executivo ao detalhe do cliente: hierarquia clara para equipas de mídia, clientes e stakeholders.",
      "Útil para alinhar expectativas: todos veem os mesmos números e o mesmo estado das integrações.",
    ],
    bullets: ["Visão consolidada e drill-down", "Auditoria de ações", "Branding por organização"],
  },
  "Controle humano": {
    title: "Controle humano",
    body: [
      "A IA propõe e automatiza o repetitivo; o gestor mantém a palavra final quando a estratégia, o risco ou o relacionamento com o cliente exigem.",
      "Transparência nos critérios: sabe o que foi sugerido automaticamente e o que foi decisão humana.",
    ],
  },
};

function ManagerPlatformDemo() {
  const [openGm, setOpenGm] = useState(false);
  const [activeMenu, setActiveMenu] = useState<"meta" | "google" | "tiktok" | null>(null);
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    setOpenGm(false);
    setActiveMenu(null);
    const a = window.setTimeout(() => setOpenGm(true), 500);
    const b = window.setTimeout(() => setActiveMenu("meta"), 1400);
    const c = window.setTimeout(() => setActiveMenu("google"), 3000);
    const d = window.setTimeout(() => setActiveMenu("tiktok"), 4600);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
      clearTimeout(c);
      clearTimeout(d);
    };
  }, [replay]);

  const iframeLabel =
    activeMenu === "meta"
      ? "Meta Ads — vista de campanhas (iframe / API)"
      : activeMenu === "google"
        ? "Google Ads — vista de campanhas (iframe / API)"
        : activeMenu === "tiktok"
          ? "TikTok Ads — vista de campanhas (iframe / API)"
          : "Selecione uma rede no menu";

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-xl border border-white/15 bg-black/35 px-2 py-2 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-white/[0.06] p-1">
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-slate-300",
              !activeMenu ? "bg-white/10 text-white" : "hover:bg-white/5",
            )}
          >
            <BarChart3 className="h-3.5 w-3.5 text-cyan-400/90" />
            Visão geral
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenGm((o) => !o)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium",
                openGm ? "bg-cyan-500/20 text-cyan-200" : "text-slate-300 hover:bg-white/5",
              )}
            >
              Gestão de Mídias
              <ChevronDown className={cn("h-3.5 w-3.5 transition", openGm && "rotate-180")} />
            </button>
            {openGm ? (
              <div className="absolute left-0 top-full z-10 mt-1 min-w-[11rem] rounded-lg border border-white/12 bg-[#0c1228] py-1 shadow-xl">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Redes</div>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] text-slate-200 hover:bg-white/5"
                  onClick={() => setActiveMenu("meta")}
                >
                  <Megaphone className="h-3.5 w-3.5" /> Meta Ads
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] text-slate-200 hover:bg-white/5"
                  onClick={() => setActiveMenu("google")}
                >
                  <Megaphone className="h-3.5 w-3.5" /> Google Ads
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] text-slate-200 hover:bg-white/5"
                  onClick={() => setActiveMenu("tiktok")}
                >
                  <Megaphone className="h-3.5 w-3.5" /> TikTok Ads
                </button>
              </div>
            ) : null}
          </div>
          <span className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] text-slate-500">
            <Building2 className="h-3.5 w-3.5" /> Clientes
          </span>
          <span className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] text-slate-500">
            <Users className="h-3.5 w-3.5" /> Gestores
          </span>
          <span className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] text-slate-500">
            <ClipboardList className="h-3.5 w-3.5" /> Auditoria
          </span>
        </div>
      </div>
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-cyan-500/20 bg-gradient-to-br from-slate-900/90 to-[#050814]">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
          <p className="text-[10px] font-medium uppercase tracking-widest text-cyan-400/90">Área da plataforma</p>
          <p className="mt-2 text-sm text-slate-200">{iframeLabel}</p>
          <p className="mt-2 max-w-sm text-[11px] leading-relaxed text-slate-500">
            Em produção, esta região carrega a interface nativa da rede (ou embed conforme políticas) para o cliente selecionado — mesmo login
            e mesma conta que autorizou na AD-HUB.
          </p>
        </div>
        {activeMenu ? (
          <div className="pointer-events-none absolute bottom-2 right-2 rounded border border-white/10 bg-black/50 px-2 py-1 text-[10px] text-cyan-300/90">
            {activeMenu === "meta" ? "Meta" : activeMenu === "google" ? "Google" : "TikTok"} · perspetiva gestor
          </div>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full text-xs text-slate-400 hover:text-white"
        onClick={() => setReplay((x) => x + 1)}
      >
        Repetir animação
      </Button>
    </div>
  );
}

type Props = {
  openKey: LandingFeatureKey | null;
  onClose: () => void;
};

export function LandingFeatureDetailModals({ openKey, onClose }: Props) {
  useEffect(() => {
    if (!openKey) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [openKey]);

  useEffect(() => {
    if (!openKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openKey, onClose]);

  if (!openKey || typeof document === "undefined") return null;

  const detail = DETAIL[openKey];
  const isDemo = openKey === "Menos tempo operacional";

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 isolate z-[10000] flex flex-col items-center justify-end bg-black/65 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="landing-feature-title"
      onClick={onClose}
    >
      <div
        className="relative z-[10001] w-full max-w-lg"
        role="document"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="plan-card-gradient-ring w-full shadow-2xl">
          <div className="plan-card-gradient-inner p-5 sm:p-6">
          <h2 id="landing-feature-title" className="font-display text-lg font-bold text-white">
            {detail.title}
          </h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-300">
            {detail.body.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
          </div>
          {detail.bullets && detail.bullets.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {detail.bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-400/90" />
                  {b}
                </li>
              ))}
            </ul>
          ) : null}
          {isDemo ? <ManagerPlatformDemo /> : null}
          <div className="mt-6 flex justify-end">
            <Button type="button" variant="secondary" className="rounded-full" onClick={onClose}>
              Fechar
            </Button>
          </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export const LANDING_FEATURE_ICONS = {
  "Análises automatizadas": Brain,
  "KPIs alinhados ao negócio": LineChart,
  "Menos tempo operacional": Zap,
  "Foco no que converte": Target,
  "Visão de gestor": BarChart3,
  "Controle humano": CheckCircle2,
} as const;
