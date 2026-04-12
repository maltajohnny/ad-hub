import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ArrowLeft, Check, ChevronDown, Lock, Sparkles } from "lucide-react";
import { LoginScreenBody } from "@/components/auth/LoginScreenBody";
import adHubLogo from "@/assets/ad-hub-logo.png";
import landingHeroAi from "@/assets/landing-hero-ai.png";
import { PlanCheckoutModal } from "@/components/planos/PlanCheckoutModal";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const HIGHLIGHT = "#EAD9A0";

/** Desconto aplicado ao total de 12× o valor mensal na modalidade anual. */
const YEARLY_DISCOUNT = 0.3;

function yearlyTotalFromMonthly(monthly: number): number {
  return monthly * 12 * (1 - YEARLY_DISCOUNT);
}

/** Três redes incluídas no pacote base (sempre ativas). */
const INCLUDED_PLATFORMS: { id: string; label: string }[] = [
  { id: "meta", label: "Meta Ads" },
  { id: "instagram", label: "Instagram Ads" },
  { id: "whatsapp", label: "WhatsApp Ads" },
];

/** Redes adicionais — checkboxes começam desmarcados; cada uma incrementa o valor. */
const OPTIONAL_ADDONS: { id: string; label: string }[] = [
  { id: "tiktok", label: "TikTok Ads" },
  { id: "google", label: "Google Ads" },
  { id: "pinterest", label: "Pinterest Ads" },
  { id: "linkedin", label: "LinkedIn Ads" },
  { id: "microsoft", label: "Microsoft Advertising" },
  { id: "snapchat", label: "Snapchat Ads" },
  { id: "reddit", label: "Reddit Ads" },
  { id: "x", label: "X (Twitter) Ads" },
];

const BASE_MONTHLY = 169.9;
/** Valor por rede adicional / mês (além de Meta, Instagram e WhatsApp no pacote base). */
const ADDON_PER_PLATFORM_MONTHLY = 35;
/** Lugares de equipa no plano Gestor (1–3 pessoas) — desbloqueia módulo Usuários. */
const ADDON_TEAM_MONTHLY = 59.9;

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

/** Rótulo curto para chips (cabe numa linha no card). */
function shortPlatformLabel(id: string): string {
  const m: Record<string, string> = {
    meta: "Meta",
    instagram: "Instagram",
    whatsapp: "WhatsApp",
  };
  return m[id] ?? id;
}

function makeEmptyAddonState(): Record<string, boolean> {
  return Object.fromEntries(OPTIONAL_ADDONS.map((a) => [a.id, false])) as Record<string, boolean>;
}

function IncludedBaseBlock() {
  return (
    <div className="mt-2 rounded-md border border-white/[0.08] bg-black/20 px-2 py-1.5">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Incluídas no preço base</p>
      <div className="mt-1 flex flex-wrap gap-1" title="Meta, Instagram e WhatsApp incluídos">
        {INCLUDED_PLATFORMS.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-0.5 rounded border border-emerald-500/35 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-100/95"
          >
            <Lock className="h-2.5 w-2.5 shrink-0 text-emerald-400/90" aria-hidden />
            {shortPlatformLabel(p.id)}
          </span>
        ))}
      </div>
    </div>
  );
}

type AdditionalNetworksBlockProps = {
  addonOn: Record<string, boolean>;
  addonCount: number;
  onToggle: (id: string, checked: boolean) => void;
};

function AdditionalNetworksBlock({ addonOn, addonCount, onToggle }: AdditionalNetworksBlockProps) {
  return (
    <div
      className="mt-2 rounded-md border border-dashed px-2 py-1.5 sm:py-2"
      style={{ borderColor: `${HIGHLIGHT}55`, background: `${HIGHLIGHT}12` }}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Redes adicionais</p>
      <p className="text-[9px] text-slate-500">
        +{fmt(ADDON_PER_PLATFORM_MONTHLY)}/rede/mês · {addonCount} extra
      </p>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-7 min-h-7 w-full justify-between gap-1 border-white/15 bg-black/35 px-2 py-0.5 text-left text-[11px] font-normal text-slate-200 hover:bg-white/5 hover:text-white sm:h-8 sm:min-h-8 sm:text-xs"
          >
            <span className="min-w-0 flex-1 truncate">
              {addonCount > 0
                ? `${addonCount} rede${addonCount === 1 ? "" : "s"} extra · abrir para editar`
                : "Abrir lista e escolher redes"}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-[min(calc(100vw-2rem),22rem)] border-white/10 bg-[#0c1228] p-3 text-slate-200 shadow-xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
            Marque as redes que pretende além de Meta, Instagram e WhatsApp. Cada rede soma{" "}
            <span className="tabular-nums text-slate-300">{fmt(ADDON_PER_PLATFORM_MONTHLY)}</span>/mês.
          </p>
          <div className="grid max-h-[min(50vh,280px)] gap-2 overflow-y-auto overscroll-contain pr-0.5 sm:grid-cols-2">
            {OPTIONAL_ADDONS.map((a) => (
              <label
                key={a.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.08] bg-black/35 px-2 py-2 text-sm text-slate-300 hover:bg-white/[0.06]"
              >
                <Checkbox
                  checked={addonOn[a.id]}
                  onCheckedChange={(c) => onToggle(a.id, c === true)}
                  className="border-white/20"
                />
                <span>{a.label}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

type PlanId = "gestor" | "organizacao" | "scale";

const PLAN_CHECKOUT_LABEL: Record<PlanId, string> = {
  gestor: "Gestor — Assinatura para gestor",
  organizacao: "Organização — 3 a 5 gestores",
  scale: "Scale — Até 15 gestores",
};

const PLAN_REGISTER_BANNER: Record<PlanId, string> = {
  gestor:
    "Plano Gestor: ao criar a organização, voltamos a Planos para pagar com o valor e extras que escolheu aqui.",
  organizacao:
    "Plano Organização: registe a equipa; em seguida conclua o pagamento na mesma página Planos.",
  scale: "Plano Scale: após o registo, finalize a subscrição aqui em Planos.",
};

const PLAN_SURFACE: Record<PlanId, string> = {
  gestor: "bg-white/[0.03]",
  organizacao: "bg-white/[0.04]",
  scale: "bg-gradient-to-b from-white/[0.05] to-transparent",
};

function PlanCardShell({
  planId,
  selected,
  onSelect,
  children,
}: {
  planId: PlanId;
  selected: boolean;
  onSelect: (id: PlanId) => void;
  children: ReactNode;
}) {
  const surface = PLAN_SURFACE[planId];
  return (
    <div
      role="presentation"
      className="h-full outline-none"
      onClick={() => onSelect(planId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(planId);
        }
      }}
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
    >
      {selected ? (
        <div className="plan-card-gradient-ring h-full min-h-full">
          <div className="plan-card-gradient-inner relative flex min-h-full cursor-pointer flex-col p-3 sm:p-3.5">{children}</div>
        </div>
      ) : (
        <div
          className={cn(
            "relative flex min-h-full cursor-pointer flex-col rounded-2xl border border-white/[0.08] p-3 sm:p-3.5 backdrop-blur-sm transition-all hover:border-white/15",
            surface,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default function Planos() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, serverAuth } = useAuth();
  /** Plano com realce (borda dourada); por defeito o primeiro cartão vem ativo. */
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("gestor");
  const [yearly, setYearly] = useState(false);
  const [addonGestor, setAddonGestor] = useState(makeEmptyAddonState);
  const [addonOrganizacao, setAddonOrganizacao] = useState(makeEmptyAddonState);
  const [addonScale, setAddonScale] = useState(makeEmptyAddonState);
  const [growthExtraUsers, setGrowthExtraUsers] = useState("0");
  /** 0–3 lugares de equipa no plano Gestor (+módulo Usuários). */
  const [gestorTeamSeats, setGestorTeamSeats] = useState("0");
  const [showCheckout, setShowCheckout] = useState(false);
  /** Visitante: painel de registo/login por cima dos cartões (mesma área glass). */
  const [showRegisterPanel, setShowRegisterPanel] = useState(false);

  const requestCheckout = (plan: PlanId) => {
    setSelectedPlan(plan);
    if (!user) {
      if (!serverAuth) {
        toast.warning("Registo indisponível", {
          description: "Configure MySQL e a API Go (MYSQL_DSN) para criar conta e subscrever online.",
        });
        return;
      }
      setShowRegisterPanel(true);
      return;
    }
    if (!serverAuth) {
      toast.warning("Subscrição indisponível", {
        description: "Configure MySQL e a API Go (MYSQL_DSN) para pagamentos online.",
      });
      return;
    }
    if (user.role !== "admin") {
      toast.error("Apenas o administrador da organização pode subscrever um plano.");
      return;
    }
    if (!user.organizationId) {
      toast.error("A sua conta precisa de uma organização.");
      return;
    }
    setShowCheckout(true);
  };

  const gestorAddonCount = useMemo(
    () => OPTIONAL_ADDONS.filter((a) => addonGestor[a.id]).length,
    [addonGestor],
  );
  const orgAddonCount = useMemo(
    () => OPTIONAL_ADDONS.filter((a) => addonOrganizacao[a.id]).length,
    [addonOrganizacao],
  );
  const scaleAddonCount = useMemo(
    () => OPTIONAL_ADDONS.filter((a) => addonScale[a.id]).length,
    [addonScale],
  );

  const teamSeatCount = Number(gestorTeamSeats) || 0;

  const starterPrice = useMemo(() => {
    const monthly =
      BASE_MONTHLY +
      gestorAddonCount * ADDON_PER_PLATFORM_MONTHLY +
      teamSeatCount * ADDON_TEAM_MONTHLY;
    return yearly ? yearlyTotalFromMonthly(monthly) : monthly;
  }, [gestorAddonCount, yearly, teamSeatCount]);

  const growthPrice = useMemo(() => {
    const extra = Number(growthExtraUsers) || 0;
    const monthly =
      297 + orgAddonCount * ADDON_PER_PLATFORM_MONTHLY + extra * 40;
    return yearly ? yearlyTotalFromMonthly(monthly) : monthly;
  }, [growthExtraUsers, yearly, orgAddonCount]);

  const scalePrice = useMemo(() => {
    const monthly = 497 + scaleAddonCount * ADDON_PER_PLATFORM_MONTHLY;
    return yearly ? yearlyTotalFromMonthly(monthly) : monthly;
  }, [yearly, scaleAddonCount]);

  const checkoutAddonPlatformCount = useMemo(() => {
    switch (selectedPlan) {
      case "gestor":
        return gestorAddonCount;
      case "organizacao":
        return orgAddonCount;
      case "scale":
        return scaleAddonCount;
      default:
        return gestorAddonCount;
    }
  }, [selectedPlan, gestorAddonCount, orgAddonCount, scaleAddonCount]);

  const checkoutAmount = useMemo(() => {
    switch (selectedPlan) {
      case "gestor":
        return starterPrice;
      case "organizacao":
        return growthPrice;
      case "scale":
        return scalePrice;
      default:
        return starterPrice;
    }
  }, [selectedPlan, starterPrice, growthPrice, scalePrice]);

  const toggleAddonGestor = (id: string, checked: boolean) => {
    setAddonGestor((prev) => ({ ...prev, [id]: checked }));
  };
  const toggleAddonOrganizacao = (id: string, checked: boolean) => {
    setAddonOrganizacao((prev) => ({ ...prev, [id]: checked }));
  };
  const toggleAddonScale = (id: string, checked: boolean) => {
    setAddonScale((prev) => ({ ...prev, [id]: checked }));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showCheckout) {
        setShowCheckout(false);
        return;
      }
      if (showRegisterPanel) {
        setShowRegisterPanel(false);
        return;
      }
      navigate("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, showCheckout, showRegisterPanel]);

  /** Após login/registo com redirect para cá, abre o checkout do plano. */
  useEffect(() => {
    const s = location.state as { openCheckout?: boolean } | null | undefined;
    if (!s?.openCheckout || !user) return;
    navigate("/planos", { replace: true, state: {} });
    if (!serverAuth) {
      toast.warning("Subscrição indisponível", {
        description: "Configure MySQL e a API Go (MYSQL_DSN) para pagamentos online.",
      });
      return;
    }
    if (user.role !== "admin") {
      toast.error("Apenas o administrador da organização pode subscrever um plano.");
      return;
    }
    if (!user.organizationId) {
      toast.error("A sua conta precisa de uma organização.");
      return;
    }
    setShowCheckout(true);
  }, [location.state, user, serverAuth, navigate]);

  return (
    <div className="dark flex min-h-[100dvh] flex-col overflow-x-hidden bg-[#050814] text-slate-200 pb-[env(safe-area-inset-bottom,0px)]">
      <header className="sticky top-0 z-20 shrink-0 border-b border-white/[0.06] bg-[#050814]/85 backdrop-blur-xl safe-area-t">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:px-6 sm:py-2.5">
          <Link to="/" className="flex items-center gap-2 group">
            <img src={adHubLogo} alt="AD-HUB" className="h-8 w-8 object-contain sm:h-9 sm:w-9" width={36} height={36} />
            <span className="font-display text-xs font-bold tracking-wide text-white sm:text-sm">AD-HUB</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:bg-white/10 hover:text-white"
              asChild
            >
              <Link to="/" state={{ openLogin: true }}>
                Entrar
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Mesma atmosfera da landing (PRD): imagem + vinheta + orbes — conteúdo em glass por cima */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <img
          src={landingHeroAi}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[center_24%] opacity-[0.38]"
          aria-hidden
        />
        <div className="absolute inset-0 bg-[#050814]/55" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.22),transparent)]" />
        <div className="absolute -left-20 top-0 h-[420px] w-[420px] rounded-full bg-violet-600/20 blur-[100px]" />
        <div className="absolute right-0 bottom-0 h-[320px] w-[320px] rounded-full bg-cyan-500/12 blur-[90px]" />
      </div>

      {/* Clicar fora do painel em glass (área escurecida) → landing — mesmo padrão dos modais na home */}
      <button
        type="button"
        className="fixed inset-0 z-[8] cursor-default border-0 bg-transparent p-0"
        aria-label="Voltar ao início"
        onClick={() => {
          if (showRegisterPanel) return;
          navigate("/");
        }}
      />

      <main className="pointer-events-none relative z-10 mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-3 py-2 safe-area-x sm:px-5 lg:py-3">
        <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col animate-in fade-in duration-300">
          <div className="glass-card pointer-events-auto relative flex min-h-0 min-h-[min(88vh,42rem)] flex-1 flex-col overflow-hidden rounded-xl border border-white/10 p-3 shadow-2xl ring-1 ring-white/[0.06] sm:rounded-2xl sm:p-4 lg:min-h-0">
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden transition duration-500 ease-out",
            showRegisterPanel && "-translate-y-[6%] scale-[0.97] opacity-[0.2]",
          )}
        >
        <div className="mx-auto max-w-2xl shrink-0 text-center">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/25 bg-cyan-500/5 px-2 py-0.5 text-[10px] font-medium text-cyan-300/95 sm:text-[11px]">
            <Sparkles className="h-3 w-3 shrink-0" />
            Planos pensados para equipas de mídia
          </p>
          <h1 className="mt-1.5 font-display text-xl font-bold leading-tight tracking-tight text-white sm:text-2xl lg:text-[1.65rem]">
            Escolha o ritmo da sua operação
          </h1>
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-400 sm:text-xs">
            Preços transparentes: três redes base por cliente e redes extra à escolha.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 sm:mt-2.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setYearly(false)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:px-4 sm:py-2 sm:text-sm",
                !yearly ? "bg-white/10 text-white ring-1 ring-white/15" : "text-slate-400 hover:bg-white/5 hover:text-white",
              )}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setYearly(true)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:px-4 sm:py-2 sm:text-sm",
                yearly ? "bg-white/10 text-white ring-1 ring-cyan-500/30" : "text-slate-400 hover:bg-white/5 hover:text-white",
              )}
            >
              Anual
            </button>
            {yearly ? (
              <span className="text-xs text-emerald-400/90 font-medium">30% de desconto na faturação anual</span>
            ) : null}
          </div>
        </div>

        <div className="mt-2 min-h-0 flex-1 grid gap-3 lg:mt-3 lg:grid-cols-3 lg:items-stretch lg:gap-3">
          {/* Gestor */}
          <PlanCardShell planId="gestor" selected={selectedPlan === "gestor"} onSelect={setSelectedPlan}>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Gestor</p>
            <h2 className="mt-0.5 font-display text-sm font-bold leading-tight text-white sm:text-base">Assinatura para gestor</h2>
            <p className="mt-0.5 text-[11px] leading-tight text-slate-400">1 conta · até 3 clientes</p>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl font-bold tabular-nums text-white sm:text-2xl">{fmt(starterPrice)}</span>
              <span className="text-[11px] text-slate-500">/{yearly ? "ano" : "mês"}</span>
            </div>
            {yearly ? (
              <p className="mt-0.5 text-[9px] text-emerald-400/85">Total anual com 30% de desconto (vs. 12× mensal)</p>
            ) : null}

            <ul className="mt-2 space-y-0.5 text-[11px] leading-tight text-slate-300 sm:text-xs">
              <li className="flex gap-1">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                Até 3 clientes
              </li>
              <li className="flex gap-1">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                Dashboard + Kanban
              </li>
            </ul>

            <IncludedBaseBlock />
            <AdditionalNetworksBlock
              addonOn={addonGestor}
              addonCount={gestorAddonCount}
              onToggle={toggleAddonGestor}
            />

            <div
              className="mt-2 rounded-md border border-dashed px-2 py-1.5 sm:py-2"
              style={{ borderColor: `${HIGHLIGHT}44`, background: `${HIGHLIGHT}08` }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Pessoas na equipa</p>
              <p className="text-[9px] text-slate-500">
                +{fmt(ADDON_TEAM_MONTHLY)}/pessoa/mês · desbloqueia o módulo Usuários · {teamSeatCount} extra
              </p>
              <Select value={gestorTeamSeats} onValueChange={setGestorTeamSeats}>
                <SelectTrigger className="mt-1 h-7 min-h-7 border-white/10 bg-slate-900/50 py-0 text-[11px] text-slate-200 sm:h-8 sm:min-h-8 sm:text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#0c1228] text-slate-200">
                  <SelectItem value="0">Só a conta gestor (sem lugares extra)</SelectItem>
                  <SelectItem value="1">+1 pessoa (+{fmt(ADDON_TEAM_MONTHLY)}/mês)</SelectItem>
                  <SelectItem value="2">+2 pessoas (+{fmt(ADDON_TEAM_MONTHLY * 2)}/mês)</SelectItem>
                  <SelectItem value="3">+3 pessoas (+{fmt(ADDON_TEAM_MONTHLY * 3)}/mês)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="mt-auto pt-2" onClick={(e) => e.stopPropagation()}>
              <Button
                type="button"
                className="h-8 w-full rounded-full text-xs font-semibold sm:h-9 sm:text-sm"
                variant="gradientCta"
                onClick={() => requestCheckout("gestor")}
              >
                Selecionar plano
              </Button>
            </div>
          </PlanCardShell>

          {/* Growth */}
          <PlanCardShell planId="organizacao" selected={selectedPlan === "organizacao"} onSelect={setSelectedPlan}>
            <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 border border-white/10 bg-slate-900 px-1.5 py-0 text-[9px] text-white hover:bg-slate-900 sm:text-[10px]">
              Mais popular
            </Badge>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Organização</p>
            <h2 className="mt-0.5 font-display text-sm font-bold leading-tight text-white sm:text-base">3 a 5 gestores</h2>
            <p className="mt-0.5 text-[11px] leading-tight text-slate-400">Equipa e visibilidade de ROI</p>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl font-bold tabular-nums text-white sm:text-2xl">{fmt(growthPrice)}</span>
              <span className="text-[11px] text-slate-500">/{yearly ? "ano" : "mês"}</span>
            </div>
            {yearly ? (
              <p className="mt-0.5 text-[9px] text-emerald-400/85">Total anual com 30% de desconto (vs. 12× mensal)</p>
            ) : (
              <p className="mt-0.5 text-[9px] font-medium text-emerald-400/90">Add-ons −20% vs. avulso</p>
            )}

            <ul className="mt-2 space-y-0.5 text-[11px] leading-tight text-slate-300 sm:text-xs">
              {[
                "Até 10 clientes",
                "Dashboard, Kanban, ROI, Social Pulse",
                "Relatórios consolidados",
              ].map((t) => (
                <li key={t} className="flex gap-1">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            <IncludedBaseBlock />
            <AdditionalNetworksBlock
              addonOn={addonOrganizacao}
              addonCount={orgAddonCount}
              onToggle={toggleAddonOrganizacao}
            />

            <div
              className="mt-2 rounded-md border border-dashed px-2 py-1.5 sm:py-2"
              style={{ borderColor: `${HIGHLIGHT}44`, background: `${HIGHLIGHT}08` }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Utilizadores extra</p>
              <p className="text-[9px] text-slate-500">+R$ 40,00/utilizador/mês · além da equipa incluída no plano</p>
              <Select value={growthExtraUsers} onValueChange={setGrowthExtraUsers}>
                <SelectTrigger className="mt-1 h-7 min-h-7 border-white/10 bg-slate-900/50 py-0 text-[11px] text-slate-200 sm:h-8 sm:min-h-8 sm:text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#0c1228] text-slate-200">
                  <SelectItem value="0">Sem extras</SelectItem>
                  <SelectItem value="1">+1 utilizador (+R$ 40/mês)</SelectItem>
                  <SelectItem value="2">+2 utilizadores (+R$ 80/mês)</SelectItem>
                  <SelectItem value="3">+3 utilizadores (+R$ 120/mês)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="mt-auto pt-2" onClick={(e) => e.stopPropagation()}>
              <Button
                type="button"
                className="h-8 w-full rounded-full text-xs font-semibold sm:h-9 sm:text-sm"
                variant="gradientCta"
                onClick={() => requestCheckout("organizacao")}
              >
                Selecionar plano
              </Button>
            </div>
          </PlanCardShell>

          {/* Scale */}
          <PlanCardShell planId="scale" selected={selectedPlan === "scale"} onSelect={setSelectedPlan}>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Scale</p>
            <h2 className="mt-0.5 font-display text-sm font-bold leading-tight text-white sm:text-base">Até 15 gestores</h2>
            <p className="mt-0.5 text-[11px] leading-tight text-slate-400">Premium · multi-workspace</p>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl font-bold tabular-nums text-white sm:text-2xl">{fmt(scalePrice)}</span>
              <span className="text-[11px] text-slate-500">/{yearly ? "ano" : "mês"}</span>
            </div>
            {yearly ? (
              <p className="mt-0.5 text-[9px] text-emerald-400/85">Total anual com 30% de desconto (vs. 12× mensal)</p>
            ) : null}

            <ul className="mt-2 space-y-0.5 text-[11px] leading-tight text-slate-300 sm:text-xs">
              {[
                "50+ clientes ou ilimitado",
                "Todas as plataformas",
                "IA e relatórios avançados",
                "Automações e multi-workspace",
              ].map((t) => (
                <li key={t} className="flex gap-1">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            <IncludedBaseBlock />
            <AdditionalNetworksBlock
              addonOn={addonScale}
              addonCount={scaleAddonCount}
              onToggle={toggleAddonScale}
            />

            <div className="mt-auto pt-2" onClick={(e) => e.stopPropagation()}>
              <Button
                type="button"
                className="h-8 w-full rounded-full text-xs font-semibold sm:h-9 sm:text-sm"
                variant="gradientCta"
                onClick={() => requestCheckout("scale")}
              >
                Selecionar plano
              </Button>
            </div>
          </PlanCardShell>
        </div>

        <p className="mx-auto mt-2 max-w-xl shrink-0 px-1 text-center text-[9px] leading-tight text-slate-500 sm:text-[10px]">
          Todos os planos incluem Meta, Instagram e WhatsApp no preço base. Redes adicionais: +{" "}
          <span className="tabular-nums">{fmt(ADDON_PER_PLATFORM_MONTHLY)}</span>/mês por rede. Plano Organização: até +3
          utilizadores extra (+R$ 40/mês cada). Anual: 30% sobre o total de 12 meses.
        </p>
        </div>

        <div
          className={cn(
            "absolute inset-0 z-[20] flex flex-col rounded-[inherit] border border-white/[0.07] bg-[#060a14]/[0.97] p-3 shadow-inner backdrop-blur-md transition duration-500 ease-out sm:p-4",
            showRegisterPanel
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-full opacity-0",
          )}
          aria-hidden={!showRegisterPanel}
        >
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-white/[0.08] pb-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 gap-1 px-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
              onClick={() => setShowRegisterPanel(false)}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Planos
            </Button>
            <div className="min-w-0 text-right">
              <p className="text-[9px] font-medium uppercase tracking-wide text-slate-500">Plano escolhido</p>
              <p className="truncate text-xs font-semibold text-white">{PLAN_CHECKOUT_LABEL[selectedPlan]}</p>
              <p className="text-[11px] tabular-nums text-cyan-300/90">
                {fmt(checkoutAmount)} <span className="text-slate-500">/ {yearly ? "ano" : "mês"}</span>
              </p>
            </div>
          </div>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
            <LoginScreenBody
              variant="embedded"
              formId="planos-auth"
              initialAuthMode="register"
              registerContextBanner={PLAN_REGISTER_BANNER[selectedPlan]}
              redirectAfterSuccess={{ to: "/planos", state: { openCheckout: true } }}
            />
          </div>
        </div>
        </div>
        </div>
      </main>

      <PlanCheckoutModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        planTitle={PLAN_CHECKOUT_LABEL[selectedPlan]}
        planId={selectedPlan}
        amountBrl={checkoutAmount}
        periodDescription={
          yearly
            ? "Faturação anual — 30% de desconto sobre o total de 12× o valor mensal"
            : "Cobrança mensal"
        }
        totalFormatted={fmt(checkoutAmount)}
        yearly={yearly}
        gestorTeamSeats={teamSeatCount}
        addonPlatformCount={checkoutAddonPlatformCount}
        growthExtraUsers={Number(growthExtraUsers) || 0}
      />
    </div>
  );
}
