import { useMemo, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useTheme } from "next-themes";
import { clientsData, type Client } from "@/data/clientsCatalog";
export type { Client } from "@/data/clientsCatalog";
export { clientsData };
import { FavoriteButton } from "@/components/FavoriteButton";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { ClientesRegisterModal } from "@/components/ClientesRegisterModal";
import {
  authorizeClientPlatformViaApp,
  appendAudit,
  getOrgMediaState,
  MEDIA_PLATFORMS,
  setSelectedAdAccountsForPlatform,
  updateClientApiPerformanceMetrics,
  type MediaClient,
  type MediaPlatformId,
} from "@/lib/mediaManagementStore";
import { decodeOAuthState } from "@/lib/platformLoginUrls";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  Search,
  TrendingUp,
  DollarSign,
  BarChart3,
  Sparkles,
  HelpCircle,
  Users,
  Target,
  MousePointerClick,
  Eye,
  Brain,
  Send,
  CheckCircle2,
  ArrowRight,
  Plug,
  Database,
  LineChart as LineChartIconLucide,
  BrainCircuit,
  SlidersHorizontal,
  ArrowUpDown,
  CircleCheck,
  Settings,
  Loader2,
  ChevronDown,
  ListChecks,
  XCircle,
  UserPlus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { buildTrafficPerformanceReport, sendManualReport } from "@/services/slackReportService";
import {
  analyzeCampaignPerformance,
  analyzeCampaignWithInstruction,
  campaignAnalysisInputFromReport,
  IA_UNAVAILABLE_HINT,
  isAiOptimizationConfigured,
  type CampaignOptimizationResult,
} from "@/services/aiOptimizationService";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ClientSettingsModal } from "@/components/ClientSettingsModal";
import { MediaOrgCadastroSection } from "@/components/media/MediaOrgCadastroSection";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { getClientDetail, type AiDecision } from "@/lib/clientDemoDetail";
import { refreshPersistedClientMetrics } from "@/services/adPlatformApi";

export type { ClientDetail, RoiTableRow, AiDecision } from "@/lib/clientDemoDetail";
export { getClientDetail } from "@/lib/clientDemoDetail";

type SortKey = "cpa_desc" | "cpa_asc" | "name_asc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "cpa_desc", label: "CPA mais alto primeiro" },
  { value: "cpa_asc", label: "CPA mais baixo primeiro" },
  { value: "name_asc", label: "Nome (A–Z)" },
];

const CH_META = "#3B82F6";
const CH_GOOGLE = "#10B981";
const CH_INSTA = "#DB2777";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

function findLinkedMediaForDemo(demo: Client, mediaClients: MediaClient[]): MediaClient | undefined {
  return mediaClients.find((m) => m.name === demo.name && m.email === demo.email);
}

function syntheticClientFromMedia(mc: MediaClient): Client {
  const m = mc.performanceMetrics;
  const spend = m?.totalSpend ?? 0;
  const labels = (mc.platformIds ?? []).map(
    (pid) => MEDIA_PLATFORMS.find((p) => p.id === pid)?.label ?? pid,
  );
  return {
    id: -1,
    name: mc.name,
    segment: mc.registrationSource === "clientes" ? "Cadastro OAuth" : "Gestão de mídias",
    email: mc.email,
    cnpj: "—",
    spend: brl(spend),
    spendNumeric: spend,
    roi: m && Number.isFinite(m.roi) ? `${Math.max(0, m.roi).toFixed(1)}x` : "—",
    status: "Ativo",
    platforms: labels.length ? labels : ["—"],
    budgetLabel: "—",
    leads: 0,
    conversions: 0,
    leadsChangePct: 0,
    convChangePct: 0,
    impressions: 0,
    clicks: 0,
    cpa: m?.cpa ?? 0,
    cpc: 0,
    cpm: 0,
    ctr: 0,
    aiInsight: "Cliente ligado via módulo de cadastro / gestão de mídias. Métricas agregadas das campanhas sincronizadas.",
  };
}

const CONNECTION_DOT_PLATFORMS: { id: MediaPlatformId; label: string }[] = [
  { id: "meta-ads", label: "Facebook / Meta" },
  { id: "instagram-ads", label: "Instagram" },
  { id: "tiktok-ads", label: "TikTok" },
  { id: "google-ads", label: "Google Ads" },
];

function platformConnectionDot(
  linked: MediaClient | undefined,
  platformId: MediaPlatformId,
): { ok: boolean; label: string } {
  const pids = linked?.platformIds;
  if (!pids?.includes(platformId)) {
    return { ok: false, label: "Plataforma não associada a este cliente" };
  }
  const conns = linked?.platformConnections ?? {};
  const st = conns[platformId]?.status ?? "not-connected";
  const ok = st === "connected" || st === "syncing";
  return {
    ok,
    label: ok ? "Ligado" : st === "expired" ? "Sessão expirada" : st === "error" ? "Erro" : "Desligado",
  };
}

/** Instrução em modo supervisionado aguardando aprovação (por cliente). */
export type SupervisedPendingItem = {
  id: string;
  instruction: string;
  result: CampaignOptimizationResult;
  createdAt: string;
};

function formatDecisionAtNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Valor monetário a mostrar na seta (ex.: montante realocado), a partir do texto da IA. */
function pickTransferAmountLabel(text: string): string {
  const normalized = text.replace(/\u00a0/g, " ");
  const matches = [...normalized.matchAll(/R\$\s*[\d]{1,3}(?:\.\d{3})*(?:,\d{2})?/gi)].map((m) => m[0].replace(/\s+/g, " "));
  if (matches.length === 0) return "—";
  const restantes = matches.find((m) => {
    const i = normalized.toLowerCase().indexOf(m.toLowerCase());
    const ctx = normalized.slice(Math.max(0, i - 30), i + m.length + 30).toLowerCase();
    return /restant|realoc|transfer|movid|elevando/i.test(ctx);
  });
  if (restantes) return restantes;
  if (matches.length >= 2) return matches[1];
  return matches[0];
}

function inferDecisionFromTo(instruction: string, result: CampaignOptimizationResult): { from: string; to: string } {
  const blob = `${instruction} ${result.recommendations.join(" ")} ${result.analysis}`.toLowerCase();
  if (blob.includes("instagram") && (blob.includes("google") || blob.includes("search"))) {
    return { from: "Instagram Ads", to: "Google Ads" };
  }
  if (blob.includes("meta") && blob.includes("google") && !blob.includes("instagram")) {
    return { from: "Meta Ads", to: "Google Ads" };
  }
  const hi = result.tiles.find((t) => t.priority === "Alta");
  const other = result.tiles.find((t) => t.platform !== hi?.platform);
  return {
    from: other?.platform ?? hi?.platform ?? "—",
    to: hi?.platform ?? other?.platform ?? "—",
  };
}

/** Constrói o cartão de decisão alinhado à resposta da IA (destaque + histórico). */
function aiDecisionFromInstructionResponse(
  instruction: string,
  result: CampaignOptimizationResult,
  instructionMode: "autonomous" | "supervised" = "autonomous",
): AiDecision {
  const { from, to } = inferDecisionFromTo(instruction, result);
  const primaryRec = result.recommendations[0]?.trim() ?? "";
  const title =
    instruction.trim().length > 0 && instruction.trim().length <= 120
      ? instruction.trim()
      : primaryRec.length > 0
        ? primaryRec.length > 110
          ? `${primaryRec.slice(0, 107)}…`
          : primaryRec
        : "Decisão sugerida pela IA";

  const reasonSource = primaryRec || result.analysis;
  const reason =
    reasonSource.length > 360 ? `${reasonSource.slice(0, 357)}…` : reasonSource;

  const amountLabel = pickTransferAmountLabel(
    `${primaryRec} ${result.recommendations.slice(1).join(" ")} ${result.analysis}`,
  );

  return {
    at: formatDecisionAtNow(),
    title,
    from,
    to,
    amountLabel,
    reason,
    fromInstruction: true,
    instructionMode,
  };
}

const PROCESS_STEPS = [
  { n: "01", title: "Conexão com APIs", desc: "Contas de anúncios vinculadas com permissões de leitura.", icon: Plug, active: true, border: "border-[#10B981]/50", iconBg: "text-[#10B981]", badge: "Conectado" as string | null },
  { n: "02", title: "Coleta de Dados", desc: "Métricas sincronizadas por canal e campanha.", icon: Database, active: true, border: "border-[#3B82F6]/50", iconBg: "text-[#3B82F6]", badge: null },
  { n: "03", title: "Análise & Dashboards", desc: "Painéis consolidados para o gestor e para a IA.", icon: LineChartIconLucide, active: true, border: "border-[#3B82F6]/50", iconBg: "text-[#3B82F6]", badge: null },
  { n: "04", title: "IA — Otimização", desc: "Modelo analisa padrões e sugere redistribuições.", icon: BrainCircuit, active: true, border: "border-[#3B82F6]/50", iconBg: "text-[#3B82F6]", badge: null },
  { n: "05", title: "Intervenção do Gestor", desc: "Aprovação ou ajuste manual antes de executar mudanças críticas.", icon: SlidersHorizontal, active: false, border: "border-border", iconBg: "text-muted-foreground", badge: null },
  { n: "06", title: "Execução & Monitoramento", desc: "Alterações aplicadas e acompanhamento contínuo.", icon: CircleCheck, active: false, border: "border-border", iconBg: "text-muted-foreground", badge: null },
];

function MetricHint({ label, hint }: { label: string; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`Sobre ${label}`}
        >
          <span>{label}</span>
          <HelpCircle className="h-3.5 w-3.5 opacity-70" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}

function ClientExpandedPanel({
  client,
  onOpenSettings,
  supervisedPendingApprovals,
  onSupervisedPendingChange,
  embeddedInModal = false,
  showSettingsButton = true,
}: {
  client: Client;
  onOpenSettings: () => void;
  supervisedPendingApprovals: SupervisedPendingItem[];
  onSupervisedPendingChange: (
    updater: SupervisedPendingItem[] | ((prev: SupervisedPendingItem[]) => SupervisedPendingItem[]),
  ) => void;
  /** Quando true, omite cabeçalho duplicado (título vem do Dialog) e usa wrapper sem Card. */
  embeddedInModal?: boolean;
  showSettingsButton?: boolean;
}) {
  const detail = useMemo(() => getClientDetail(client), [client.id]);
  const [aiMode, setAiMode] = useState<"autonomous" | "supervised">("autonomous");
  const [instruction, setInstruction] = useState("");
  const [sendingSlack, setSendingSlack] = useState(false);
  const [optLoading, setOptLoading] = useState(false);
  const [optError, setOptError] = useState<string | null>(null);
  const [optResult, setOptResult] = useState<CampaignOptimizationResult | null>(null);
  const [panelAiLoading, setPanelAiLoading] = useState(false);
  const [panelAiError, setPanelAiError] = useState<string | null>(null);
  /** Só modo autônomo: última resposta abaixo do campo de instrução. */
  const [panelAiResult, setPanelAiResult] = useState<CampaignOptimizationResult | null>(null);
  /** Decisões derivadas das respostas reais da IA (instrução); aparecem no destaque e no histórico acima dos mocks. */
  const [instructionDecisions, setInstructionDecisions] = useState<AiDecision[]>([]);
  /** Qual item da lista de pendentes está expandido (análise + aprovar). */
  const [expandedPendingId, setExpandedPendingId] = useState<string | null>(null);
  const [pendingListOpen, setPendingListOpen] = useState(true);

  const handleApprovePendingItem = (id: string) => {
    const item = supervisedPendingApprovals.find((p) => p.id === id);
    if (!item) return;
    onSupervisedPendingChange((prev) => prev.filter((p) => p.id !== id));
    setInstructionDecisions((prev) => [
      aiDecisionFromInstructionResponse(item.instruction, item.result, "supervised"),
      ...prev,
    ]);
    if (expandedPendingId === id) setExpandedPendingId(null);
    toast.success("Decisão aprovada e registada no histórico.");
  };

  const handleRejectPendingItem = (id: string) => {
    onSupervisedPendingChange((prev) => prev.filter((p) => p.id !== id));
    if (expandedPendingId === id) setExpandedPendingId(null);
    toast.message("Decisão rejeitada — não foi registada no histórico.");
  };

  const handleInstructionSubmit = async () => {
    if (!isAiOptimizationConfigured()) {
      toast.error(IA_UNAVAILABLE_HINT);
      return;
    }
    if (aiMode === "supervised" && !instruction.trim()) {
      toast.error("Escreva uma instrução para a IA (modo supervisionado).");
      return;
    }
    setPanelAiLoading(true);
    setPanelAiError(null);
    try {
      const report = buildTrafficPerformanceReport(client);
      const input = campaignAnalysisInputFromReport(report);
      const result = await analyzeCampaignWithInstruction(input, {
        instruction: aiMode === "autonomous" ? "" : instruction,
        mode: aiMode,
      });
      if (aiMode === "autonomous") {
        setPanelAiResult(result);
        onSupervisedPendingChange([]);
        setInstructionDecisions((prev) => [
          aiDecisionFromInstructionResponse("", result, "autonomous"),
          ...prev,
        ]);
        toast.success("Decisão autônoma registada no histórico.");
      } else {
        setPanelAiResult(null);
        const newItem: SupervisedPendingItem = {
          id: crypto.randomUUID(),
          instruction: instruction.trim(),
          result,
          createdAt: formatDecisionAtNow(),
        };
        onSupervisedPendingChange((prev) => [newItem, ...prev]);
        setExpandedPendingId(newItem.id);
        setPendingListOpen(true);
        setInstruction("");
        toast.success("Análise pendente — abra «Aprovações pendentes» e aprove quando estiver pronto.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setPanelAiError(msg);
      toast.error(msg.length > 120 ? `${msg.slice(0, 120)}…` : msg);
    } finally {
      setPanelAiLoading(false);
    }
  };

  const handleGenerateOptimization = async () => {
    if (!isAiOptimizationConfigured()) {
      toast.error(IA_UNAVAILABLE_HINT);
      return;
    }
    setOptLoading(true);
    setOptError(null);
    try {
      const report = buildTrafficPerformanceReport(client);
      const input = campaignAnalysisInputFromReport(report);
      const result = await analyzeCampaignPerformance(input);
      setOptResult(result);
      toast.success("Análise de otimização gerada.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setOptError(msg);
      toast.error(msg.length > 120 ? `${msg.slice(0, 120)}…` : msg);
    } finally {
      setOptLoading(false);
    }
  };

  const handleSendSlackReport = async () => {
    setSendingSlack(true);
    try {
      const r = await sendManualReport(client.id);
      if (r.ok) toast.success("Relatório enviado para o Slack.");
      else toast.error(r.error || "Não foi possível enviar o relatório.");
    } finally {
      setSendingSlack(false);
    }
  };

  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setInstructionDecisions([]);
    setPanelAiResult(null);
    setPanelAiError(null);
    setInstruction("");
    setExpandedPendingId(null);
  }, [client.id]);

  const isLight = mounted && resolvedTheme === "light";
  const chartGrid = isLight ? "hsl(220, 13%, 88%)" : "hsl(220, 14%, 18%)";
  const chartAxis = isLight ? "hsl(220, 9%, 42%)" : "hsl(215, 12%, 55%)";
  const tooltipStyle = {
    background: isLight ? "hsl(0, 0%, 100%)" : "hsl(220, 18%, 10%)",
    border: `1px solid ${isLight ? "hsl(220, 13%, 90%)" : "hsl(220, 14%, 18%)"}`,
    borderRadius: "8px",
    color: isLight ? "hsl(222, 47%, 11%)" : "hsl(210, 20%, 95%)",
  };

  const pieCurrent = [
    { name: "Meta Ads", value: detail.budgetCurrent.meta, color: CH_META },
    { name: "Google Ads", value: detail.budgetCurrent.google, color: CH_GOOGLE },
    { name: "Instagram", value: detail.budgetCurrent.instagram, color: CH_INSTA },
  ];
  const pieRec = [
    { name: "Meta Ads", value: detail.budgetRecommended.meta, color: CH_META },
    { name: "Google Ads", value: detail.budgetRecommended.google, color: CH_GOOGLE },
    { name: "Instagram", value: detail.budgetRecommended.instagram, color: CH_INSTA },
  ];

  const decisionsDisplay = useMemo(
    () => [...instructionDecisions, ...detail.decisions],
    [instructionDecisions, detail.decisions],
  );
  const latest = decisionsDisplay[0];

  const Shell = embeddedInModal ? "div" : Card;

  return (
    <Shell
      className={cn(
        embeddedInModal
          ? "space-y-6 animate-fade-in"
          : "glass-card p-5 sm:p-6 border-primary/20 animate-fade-in space-y-6",
      )}
    >
      {/* Cabeçalho cliente */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        {!embeddedInModal && (
          <div>
            <h2 className="text-xl sm:text-2xl font-display font-bold">{client.name}</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {client.segment} · Budget: {client.budgetLabel}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {client.email} · CNPJ {client.cnpj}
            </p>
          </div>
        )}
        <div
          className={cn(
            "flex items-center gap-2 shrink-0 flex-wrap justify-end",
            embeddedInModal ? "w-full justify-start sm:justify-end" : "mt-2 sm:mt-0",
          )}
        >
          {showSettingsButton ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-border/60"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSettings();
              }}
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 shrink-0 bg-[#4A154B] hover:bg-[#4A154B]/90 text-white border-0"
            disabled={sendingSlack}
            onClick={(e) => {
              e.stopPropagation();
              void handleSendSlackReport();
            }}
          >
            {sendingSlack ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Enviar relatório agora
          </Button>
          <FavoriteButton
            id={`client:${client.id}`}
            kind="client"
            title={client.name}
            path={`/clientes?expand=${client.id}`}
            subtitle={client.segment}
          />
          <Badge variant="outline" className="border-primary/40 text-primary w-fit">
            <Sparkles className="h-3 w-3 mr-1" />
            Visão detalhada · IA
          </Badge>
        </div>
      </div>

      {/* KPIs topo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg bg-secondary/40 border border-border/50 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Investimento</span>
            <DollarSign size={14} className="text-primary opacity-80" />
          </div>
          <p className="text-lg font-display font-bold tabular-nums">{client.spend}</p>
          <span className="text-[10px] text-muted-foreground">período atual</span>
        </div>
        <div className="rounded-lg bg-secondary/40 border border-border/50 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Leads</span>
            <Users size={14} className="text-accent opacity-80" />
          </div>
          <p className="text-lg font-display font-bold tabular-nums">{client.leads.toLocaleString("pt-BR")}</p>
          <span
            className={cn(
              "text-[10px] font-medium",
              client.leadsChangePct >= 0 ? "text-success" : "text-destructive",
            )}
          >
            {client.leadsChangePct >= 0 ? "↗" : "↘"} {Math.abs(client.leadsChangePct)}%
          </span>
        </div>
        <div className="rounded-lg bg-secondary/40 border border-border/50 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Conversões</span>
            <Target size={14} className="text-primary opacity-80" />
          </div>
          <p className="text-lg font-display font-bold tabular-nums">{client.conversions.toLocaleString("pt-BR")}</p>
          <span
            className={cn(
              "text-[10px] font-medium",
              client.convChangePct >= 0 ? "text-success" : "text-destructive",
            )}
          >
            {client.convChangePct >= 0 ? "↗" : "↘"} {Math.abs(client.convChangePct)}%
          </span>
        </div>
        <div className="rounded-lg bg-secondary/40 border border-border/50 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">ROI</span>
            <TrendingUp size={14} className="text-success opacity-80" />
          </div>
          <p className="text-lg font-display font-bold">{client.roi}</p>
          <span className="text-[10px] text-muted-foreground">médio</span>
        </div>
      </div>

      {/* Painel de Controle da IA (print 1) */}
      <div className="rounded-xl border border-border/60 bg-card/40 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg gradient-brand shadow-md">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-display font-semibold">Painel de Controle da IA</h3>
              <p className="text-xs text-muted-foreground">
                {aiMode === "autonomous"
                  ? "Modo autônomo: decisões com base nos dados e no contexto configurado"
                  : "Modo supervisionado: instruções sujeitas à sua aprovação"}
              </p>
            </div>
          </div>
          <div className="flex rounded-lg border border-border/60 bg-secondary/30 p-1 gap-1">
            <button
              type="button"
              onClick={() => {
                onSupervisedPendingChange([]);
                setPanelAiResult(null);
                setExpandedPendingId(null);
                setInstruction("");
                setAiMode("autonomous");
              }}
              className={cn(
                "flex-1 sm:flex-none rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                aiMode === "autonomous" ? "bg-success/20 text-success shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Autônoma
            </button>
            <button
              type="button"
              onClick={() => setAiMode("supervised")}
              className={cn(
                "flex-1 sm:flex-none rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                aiMode === "supervised" ? "bg-primary/20 text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Supervisionada
            </button>
          </div>
        </div>

        <div
          className={cn(
            "rounded-lg border px-3 py-2.5 text-xs mb-4 leading-relaxed",
            aiMode === "autonomous" ? "border-success/40 bg-success/5 text-muted-foreground" : "border-primary/40 bg-primary/5 text-muted-foreground",
          )}
        >
          {aiMode === "autonomous" ? (
            <>
              <strong className="text-foreground">Modo autônomo:</strong> a IA analisa os dados e o que foi configurado para o
              cliente; não é necessário escrever instruções. A decisão é aplicada e registada de imediato no histórico.
            </>
          ) : (
            <>
              <strong className="text-foreground">Modo supervisionado:</strong> a IA mostra a análise e os próximos passos;
              só depois de você <strong className="text-foreground">aprovar</strong> a proposta é que ela entra no histórico.
            </>
          )}
        </div>

        {aiMode === "supervised" ? (
          <>
            <label className="text-xs text-muted-foreground block mb-1.5">Instrução para a IA</label>
            <div className="flex gap-2">
              <Input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Ex.: priorizar Google Search nesta semana e limitar Instagram a R$ 3k..."
                className="flex-1 bg-secondary/50 border-border/50 h-10"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleInstructionSubmit();
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                className="h-10 w-10 shrink-0 bg-[#3B82F6] hover:bg-[#2563EB] text-white"
                aria-label="Enviar instrução à IA"
                disabled={panelAiLoading}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleInstructionSubmit();
                }}
              >
                {panelAiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-xs text-muted-foreground flex-1 leading-relaxed">
              Sem campo de instrução: execute a análise para a IA decidir com base no contexto e nos dados atuais.
            </p>
            <Button
              type="button"
              className="shrink-0 gap-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white"
              disabled={panelAiLoading}
              aria-label="Executar análise autônoma"
              onClick={(e) => {
                e.stopPropagation();
                void handleInstructionSubmit();
              }}
            >
              {panelAiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Executar análise autônoma
            </Button>
          </div>
        )}

        {panelAiError && (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription className="text-sm">{panelAiError}</AlertDescription>
          </Alert>
        )}

        {supervisedPendingApprovals.length > 0 && (
          <Collapsible open={pendingListOpen} onOpenChange={setPendingListOpen} className="mt-4">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-amber-500/15 transition-colors">
              <span className="flex items-center gap-2">
                Aprovações pendentes
                <Badge
                  variant="secondary"
                  className="h-5 min-w-[1.25rem] justify-center rounded-full bg-amber-500/25 text-amber-900 dark:text-amber-100 tabular-nums px-1.5"
                >
                  {supervisedPendingApprovals.length}
                </Badge>
              </span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", pendingListOpen && "rotate-180")}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {supervisedPendingApprovals.map((item) => {
                const open = expandedPendingId === item.id;
                return (
                  <div key={item.id} className="rounded-lg border border-border/60 bg-secondary/25 overflow-hidden">
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-secondary/40 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedPendingId(open ? null : item.id);
                      }}
                    >
                      <span className="flex-1 min-w-0">
                        <span className="line-clamp-2 text-foreground font-medium">{item.instruction || "(sem texto)"}</span>
                        <span className="block text-[10px] text-muted-foreground mt-0.5 tabular-nums">{item.createdAt}</span>
                      </span>
                      <ChevronDown className={cn("h-4 w-4 shrink-0 mt-0.5 text-muted-foreground transition-transform", open && "rotate-180")} />
                    </button>
                    {open && (
                      <div className="border-t border-border/50 bg-background/40 px-3 py-3 space-y-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Análise da IA (aguardando aprovação)
                        </p>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{item.result.analysis}</p>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-2">Próximos passos</p>
                          <ul className="list-disc pl-4 space-y-1 text-sm text-foreground">
                            {item.result.recommendations.map((line, i) => (
                              <li key={i} className="leading-snug">
                                {line}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-2">Prioridades por canal</p>
                          <div className="grid sm:grid-cols-3 gap-2">
                            {item.result.tiles.map((t, i) => (
                              <div key={i} className="rounded-md border border-border/60 bg-secondary/20 p-2.5 text-xs space-y-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-medium text-primary truncate">{t.platform}</span>
                                  <span
                                    className={cn(
                                      "shrink-0 text-[10px] px-1.5 py-0.5 rounded-full",
                                      t.priority === "Alta" ? "bg-primary/20 text-primary" : "bg-warning/15 text-warning",
                                    )}
                                  >
                                    {t.priority}
                                  </span>
                                </div>
                                <p className="font-medium text-foreground leading-snug">{t.action}</p>
                                <p className="text-muted-foreground leading-snug line-clamp-3">{t.reason}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap gap-2 pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full sm:w-auto gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRejectPendingItem(item.id);
                            }}
                          >
                            <XCircle className="h-4 w-4" />
                            Rejeitar
                          </Button>
                          <Button
                            type="button"
                            className="w-full sm:w-auto gap-2 bg-success hover:bg-success/90 text-success-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApprovePendingItem(item.id);
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Aprovar decisão
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        )}

        {aiMode === "autonomous" && panelAiResult && (
          <div className="mt-4 rounded-lg border border-primary/20 bg-background/50 p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Última análise autônoma</p>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{panelAiResult.analysis}</p>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Recomendações</p>
              <ul className="list-disc pl-4 space-y-1 text-sm text-foreground">
                {panelAiResult.recommendations.map((line, i) => (
                  <li key={i} className="leading-snug">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Prioridades por canal</p>
              <div className="grid sm:grid-cols-3 gap-2">
                {panelAiResult.tiles.map((t, i) => (
                  <div key={i} className="rounded-md border border-border/60 bg-secondary/20 p-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium text-primary truncate">{t.platform}</span>
                      <span
                        className={cn(
                          "shrink-0 text-[10px] px-1.5 py-0.5 rounded-full",
                          t.priority === "Alta" ? "bg-primary/20 text-primary" : "bg-warning/15 text-warning",
                        )}
                      >
                        {t.priority}
                      </span>
                    </div>
                    <p className="font-medium text-foreground leading-snug">{t.action}</p>
                    <p className="text-muted-foreground leading-snug line-clamp-3">{t.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Destaque última decisão (estilo alerta dos prints) */}
      <div className="rounded-xl border-l-4 border-l-[#3B82F6] border border-border/60 bg-secondary/20 p-4">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {latest.fromInstruction ? (
            <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">
              {latest.instructionMode === "supervised" ? "Instrução · aprovada" : "Autônoma · contexto"}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] border-[#3B82F6]/50 text-[#3B82F6]">
              Automática
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] border-success/50 text-success gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Executada
          </Badge>
          <span className="text-[10px] text-muted-foreground ml-auto">{latest.at}</span>
        </div>
        <p className="text-sm font-semibold text-foreground">{latest.title}</p>
        <p className="text-sm mt-1">
          <span className="text-[#DB2777] font-medium">{latest.from}</span>
          <ArrowRight className="inline h-3.5 w-3.5 mx-1 text-muted-foreground align-middle" />
          <span className="text-[#10B981] font-medium">{latest.to}</span>
          {latest.amountLabel !== "—" && (
            <span className="text-foreground font-semibold ml-2">{latest.amountLabel}</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{latest.reason}</p>
      </div>

      {/* Histórico de Decisões da IA */}
      <div>
        <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Histórico de Decisões da IA
        </h3>
        <div className="space-y-3">
          {decisionsDisplay.map((d, i) => (
            <div
              key={`${d.fromInstruction ? "i" : "m"}-${d.at}-${i}-${d.title.slice(0, 24)}`}
              className="rounded-lg border border-border/50 bg-secondary/20 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <div className="flex flex-wrap gap-2">
                  {d.fromInstruction ? (
                    <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">
                      {d.instructionMode === "supervised" ? "Instrução · aprovada" : "Autônoma · contexto"}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      Automática
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] border-success/40 text-success gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Executada
                  </Badge>
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums">{d.at}</span>
              </div>
              <p className="text-sm font-semibold">{d.title}</p>
              <p className="text-sm mt-1">
                <span className="text-[#DB2777]">{d.from}</span>
                <ArrowRight className="inline h-3.5 w-3.5 mx-1 text-muted-foreground align-middle" />
                <span className="text-[#10B981]">{d.to}</span>
                {d.amountLabel !== "—" && <span className="font-semibold ml-2">{d.amountLabel}</span>}
              </p>
              <p className="text-xs text-muted-foreground mt-2">{d.reason}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Desempenho por Canal */}
      <div className="rounded-xl border border-border/60 bg-card/30 p-4 sm:p-5">
        <h3 className="font-display font-semibold mb-1">Desempenho por Canal</h3>
        <p className="text-xs text-muted-foreground mb-4">Receita / resultado agregado — últimos 6 meses (simulado)</p>
        <div className="h-[260px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={detail.performance} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="month" stroke={chartAxis} fontSize={11} />
              <YAxis stroke={chartAxis} fontSize={11} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line type="monotone" dataKey="meta" name="Meta Ads" stroke={CH_META} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="google" name="Google Ads" stroke={CH_GOOGLE} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="instagram" name="Instagram" stroke={CH_INSTA} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Redistribuição de Orçamento */}
      <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
        <div className="rounded-xl border border-border/60 bg-card/30 p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2 text-center">Distribuição atual</p>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieCurrent}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {pieCurrent.map((e, i) => (
                    <Cell key={i} fill={e.color} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <ArrowRight className="h-6 w-6 text-[#3B82F6] hidden md:block shrink-0" />
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-medium text-primary mb-2 text-center">Recomendado pela IA</p>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieRec}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {pieRec.map((e, i) => (
                    <Cell key={`r-${i}`} fill={e.color} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Relatório Mensal de ROI */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50 bg-secondary/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-display font-semibold">Relatório Mensal de ROI</h3>
            <p className="text-xs text-muted-foreground">Junho 2026 — inputs e outputs por canal (simulado)</p>
          </div>
          <Button
            type="button"
            size="sm"
            className="shrink-0 gap-2 bg-[#4A154B] hover:bg-[#4A154B]/90 text-white border-0"
            disabled={sendingSlack}
            onClick={(e) => {
              e.stopPropagation();
              void handleSendSlackReport();
            }}
          >
            {sendingSlack ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Enviar relatório agora
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Canal</th>
                <th className="px-4 py-2 font-medium tabular-nums">Investido</th>
                <th className="px-4 py-2 font-medium tabular-nums">Leads</th>
                <th className="px-4 py-2 font-medium tabular-nums">Conversões</th>
                <th className="px-4 py-2 font-medium tabular-nums">Receita</th>
                <th className="px-4 py-2 font-medium tabular-nums">CPL</th>
                <th className="px-4 py-2 font-medium tabular-nums">ROI</th>
              </tr>
            </thead>
            <tbody>
              {detail.roiRows.map((row) => (
                <tr key={row.channel} className="border-b border-border/30 hover:bg-secondary/10">
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            row.channel === "Meta Ads" ? CH_META : row.channel === "Google Ads" ? CH_GOOGLE : CH_INSTA,
                        }}
                      />
                      {row.channel}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{brl(row.invested)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{row.leads}</td>
                  <td className="px-4 py-2.5 tabular-nums">{row.conversions}</td>
                  <td className="px-4 py-2.5 tabular-nums text-success font-medium">{brl(row.revenue)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{brl(row.cpl)}</td>
                  <td className="px-4 py-2.5 tabular-nums text-primary font-semibold">{row.roiMult.toFixed(1)}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fluxo do Processo */}
      <div>
        <h3 className="font-display font-semibold mb-3">Fluxo do Processo</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PROCESS_STEPS.map((step) => (
            <div
              key={step.n}
              className={cn(
                "rounded-lg border p-3 relative",
                step.border,
                step.active ? "bg-card/50" : "bg-secondary/20 opacity-90",
              )}
            >
              {step.badge && (
                <Badge className="absolute top-2 right-2 text-[9px] h-5 bg-success/20 text-success border-0">{step.badge}</Badge>
              )}
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-mono text-muted-foreground">{step.n}</span>
                <step.icon className={cn("h-4 w-4 shrink-0 mt-0.5", step.iconBg)} />
              </div>
              <p className="text-sm font-semibold mt-2 pr-12">{step.title}</p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <Separator className="bg-border/60" />

      {/* Métricas funil CPA / CPC / CPM / CTR */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Funil: impressão → clique → conversão · CPM / CTR / CPC / CPA
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="rounded-lg border border-border/60 bg-card/50 p-3">
            <MetricHint
              label="CPA"
              hint="Custo por aquisição: gasto ÷ conversões. Quanto menor, melhor."
            />
            <p className="text-base font-display font-bold text-destructive/95 mt-1 tabular-nums">{brl(client.cpa)}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-card/50 p-3">
            <MetricHint label="CPC" hint="Custo por clique: gasto ÷ cliques." />
            <p className="text-base font-display font-bold text-foreground mt-1 tabular-nums">{brl(client.cpc)}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-card/50 p-3">
            <MetricHint label="CPM" hint="(Gasto ÷ impressões) × 1000." />
            <p className="text-base font-display font-bold text-foreground mt-1 tabular-nums">{brl(client.cpm)}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-card/50 p-3">
            <MetricHint label="CTR" hint="(Cliques ÷ impressões) × 100." />
            <p className="text-base font-display font-bold text-primary mt-1 tabular-nums">{client.ctr.toFixed(2)}%</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-2 text-[11px] text-muted-foreground mb-4">
          <div className="flex items-center gap-2 rounded-md bg-secondary/30 px-2 py-1.5">
            <Eye size={12} className="shrink-0 text-[#3B82F6]" />
            Impressões:{" "}
            <strong className="text-foreground">{client.impressions.toLocaleString("pt-BR")}</strong>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-secondary/30 px-2 py-1.5">
            <MousePointerClick size={12} className="shrink-0 text-[#10B981]" />
            Cliques: <strong className="text-foreground">{client.clicks.toLocaleString("pt-BR")}</strong>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-secondary/30 px-2 py-1.5">
            <Target size={12} className="shrink-0 text-[#DB2777]" />
            Base CPA: <strong className="text-foreground">{client.conversions} conv.</strong>
          </div>
        </div>
      </div>

      {/* Insight gestor + análise OpenAI */}
      <div className="rounded-lg border border-success/25 bg-success/5 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-semibold font-display">Insight da IA (gestor valida)</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="shrink-0 gap-2 border border-border/60"
            disabled={optLoading}
            onClick={(e) => {
              e.stopPropagation();
              void handleGenerateOptimization();
            }}
          >
            {optLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
            Gerar análise IA
          </Button>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{client.aiInsight}</p>

        {optError && (
          <Alert variant="destructive">
            <AlertDescription className="text-sm">{optError}</AlertDescription>
          </Alert>
        )}

        {optResult && (
          <div className="rounded-md border border-primary/25 bg-background/60 dark:bg-background/30 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Análise</p>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{optResult.analysis}</p>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Recomendações</p>
              <ul className="list-disc pl-4 space-y-1.5 text-sm text-foreground">
                {optResult.recommendations.map((line, i) => (
                  <li key={i} className="leading-snug">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Resumo por canal</p>
              <div className="grid sm:grid-cols-3 gap-2">
                {optResult.tiles.map((t, i) => (
                  <div key={i} className="rounded-md border border-border/50 bg-secondary/15 p-2 text-[11px] space-y-1">
                    <span className="font-medium text-primary">{t.platform}</span>
                    <p className="text-foreground leading-snug">{t.action}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/40">
          Análise assistida por IA — valide sempre nas plataformas antes de alterar orçamentos ou campanhas.
        </p>
      </div>
    </Shell>
  );
}

const Clientes = () => {
  const { user, canUserSeeClient } = useAuth();
  const { tenant } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterName, setFilterName] = useState("");
  const [filterEmail, setFilterEmail] = useState("");
  const [filterCnpj, setFilterCnpj] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("cpa_desc");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedMediaId, setExpandedMediaId] = useState<string | null>(null);
  const [settingsClientId, setSettingsClientId] = useState<number | null>(null);
  /** Pendentes por chave `demo-{id}` ou `media-{uuid}`. */
  const [pendingByDetailKey, setPendingByDetailKey] = useState<Record<string, SupervisedPendingItem[]>>({});
  /** Busca única no mobile (nome, e-mail ou CNPJ). */
  const [filterQuick, setFilterQuick] = useState("");
  /** Filtros avançados no mobile: estado local (evita saltos de largura do Collapsible Radix). */
  const [filtersAdvancedMobileOpen, setFiltersAdvancedMobileOpen] = useState(false);
  const [sortMobileOpen, setSortMobileOpen] = useState(false);
  const [isLg, setIsLg] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );
  const [mediaTick, setMediaTick] = useState(0);
  const [metricsRefreshingId, setMetricsRefreshingId] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [accountPickerContext, setAccountPickerContext] = useState<{
    mediaClientId: string;
    platformId: MediaPlatformId;
    aliasName: string;
  } | null>(null);
  const [accountPickerSelectedIds, setAccountPickerSelectedIds] = useState<string[]>([]);

  const orgId = user?.organizationId ?? tenant?.id ?? null;

  const orgMediaState = useMemo(() => (orgId ? getOrgMediaState(orgId) : null), [orgId, mediaTick]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsLg(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  /** OAuth redirect de volta a /clientes — troca de código (em produção no servidor) e escolha de conta. */
  useEffect(() => {
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");
    const err = searchParams.get("error");
    const errDesc = searchParams.get("error_description");

    const clearParams = () => {
      const next = new URLSearchParams(searchParams);
      next.delete("code");
      next.delete("state");
      next.delete("error");
      next.delete("error_description");
      next.delete("error_reason");
      setSearchParams(next, { replace: true });
    };

    if (err) {
      toast.error(errDesc ?? err ?? "Autorização cancelada ou falhou.");
      clearParams();
      return;
    }

    if (!code || !stateParam || !orgId) return;

    const decoded = decodeOAuthState(stateParam);
    if (!decoded || decoded.orgId !== orgId || !decoded.mediaClientId) {
      clearParams();
      return;
    }

    authorizeClientPlatformViaApp(orgId, decoded.mediaClientId, decoded.platformId, {
      deferAccountSelection: true,
    });
    appendAudit(
      orgId,
      user?.username ?? "—",
      "Clientes — OAuth concluído",
      `${decoded.platformId} · cliente ${decoded.mediaClientId}`,
    );

    const st = getOrgMediaState(orgId);
    const mc = st.mediaClients.find((c) => c.id === decoded.mediaClientId);
    const accounts = mc?.managedAdAccountsByPlatform?.[decoded.platformId] ?? [];

    setMediaTick((t) => t + 1);
    clearParams();

    if (accounts.length > 1) {
      setAccountPickerContext({
        mediaClientId: decoded.mediaClientId,
        platformId: decoded.platformId,
        aliasName: mc?.name ?? "Cliente",
      });
      setAccountPickerSelectedIds([accounts[0]!.externalId]);
      setAccountPickerOpen(true);
    } else {
      toast.success(
        "Cliente ligado à plataforma. Em produção o backend troca o código por tokens e mantém a sessão.",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callback OAuth na query
  }, [searchParams, orgId, setSearchParams, user?.username]);

  const filtered = useMemo(() => {
    const n = (s: string) => s.replace(/\D/g, "");
    const list = clientsData.filter((c) => {
      if (!isLg && filterQuick.trim()) {
        const q = filterQuick.trim().toLowerCase();
        const qd = n(filterQuick);
        const byName = c.name.toLowerCase().includes(q);
        const byEmail = c.email.toLowerCase().includes(q);
        const byCnpj = qd.length > 0 && n(c.cnpj).includes(qd);
        return byName || byEmail || byCnpj;
      }
      const qName = filterName.trim().toLowerCase();
      const qEmail = filterEmail.trim().toLowerCase();
      const qCnpj = n(filterCnpj);
      if (qName && !c.name.toLowerCase().includes(qName)) return false;
      if (qEmail && !c.email.toLowerCase().includes(qEmail)) return false;
      if (qCnpj && !n(c.cnpj).includes(qCnpj)) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "cpa_desc":
          return b.cpa - a.cpa;
        case "cpa_asc":
          return a.cpa - b.cpa;
        case "name_asc":
          return a.name.localeCompare(b.name, "pt-BR");
        default:
          return 0;
      }
    });
  }, [isLg, filterQuick, filterName, filterEmail, filterCnpj, sortBy]);

  const filteredCadastroClients = useMemo(() => {
    if (!orgMediaState) return [];
    let list = orgMediaState.mediaClients.filter((c) => c.registrationSource === "clientes");
    if (!isLg && filterQuick.trim()) {
      const q = filterQuick.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
    } else {
      const qName = filterName.trim().toLowerCase();
      const qEmail = filterEmail.trim().toLowerCase();
      if (qName) list = list.filter((c) => c.name.toLowerCase().includes(qName));
      if (qEmail) list = list.filter((c) => c.email.toLowerCase().includes(qEmail));
    }
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "name_asc":
          return a.name.localeCompare(b.name, "pt-BR");
        default:
          return a.name.localeCompare(b.name, "pt-BR");
      }
    });
  }, [orgMediaState, isLg, filterQuick, filterName, filterEmail, sortBy]);

  const visibleClients = useMemo(() => {
    if (user?.role === "admin") return filtered;
    return filtered.filter((c) => canUserSeeClient(c.id));
  }, [filtered, user?.role, canUserSeeClient]);

  /** Sincroniza `?expand=` / `?expandMedia=` com o estado. Tem de usar `visibleClients`, não só `canUserSeeClient`:
   * administradores e operadores da plataforma veem a grelha demo mas `canUserSeeClient` pode ser sempre false. */
  useEffect(() => {
    const exM = searchParams.get("expandMedia");
    if (exM) {
      setExpandedMediaId(exM);
      setExpandedId(null);
      return;
    }
    setExpandedMediaId(null);
    const ex = searchParams.get("expand");
    if (!ex) {
      setExpandedId(null);
      return;
    }
    const id = parseInt(ex, 10);
    if (Number.isNaN(id)) return;
    if (!visibleClients.some((c) => c.id === id)) {
      setExpandedId(null);
      setSearchParams((p) => {
        p.delete("expand");
        return p;
      });
      return;
    }
    setExpandedId(id);
  }, [searchParams, visibleClients, setSearchParams]);

  useEffect(() => {
    if (expandedId !== null && !visibleClients.some((c) => c.id === expandedId)) {
      setExpandedId(null);
      setSearchParams((p) => {
        p.delete("expand");
        return p;
      });
    }
  }, [visibleClients, expandedId, setSearchParams]);

  useEffect(() => {
    if (
      expandedMediaId !== null &&
      orgMediaState &&
      !orgMediaState.mediaClients.some((c) => c.id === expandedMediaId)
    ) {
      setExpandedMediaId(null);
      setSearchParams((p) => {
        p.delete("expandMedia");
        return p;
      });
    }
  }, [orgMediaState, expandedMediaId, setSearchParams]);

  // Usa a lista já filtrada/visível para abrir modal; evita bloquear operadores da plataforma
  // que podem ver o card mas `canUserSeeClient()` retorna false para a carteira Norter.
  const selectedDemo =
    expandedId !== null
      ? visibleClients.find((c) => c.id === expandedId)
      : undefined;
  const selectedMediaClient =
    expandedMediaId && orgMediaState
      ? orgMediaState.mediaClients.find((c) => c.id === expandedMediaId)
      : undefined;
  const selectedPanelClient =
    selectedDemo ?? (selectedMediaClient ? syntheticClientFromMedia(selectedMediaClient) : undefined);

  const detailKey = selectedMediaClient
    ? `media-${selectedMediaClient.id}`
    : selectedDemo
      ? `demo-${selectedDemo.id}`
      : "";

  const toggleCard = (id: number) => {
    setExpandedId((prev) => {
      const next = prev === id ? null : id;
      setSearchParams((p) => {
        if (next === null) {
          p.delete("expand");
        } else {
          p.set("expand", String(next));
          p.delete("expandMedia");
        }
        return p;
      });
      if (next !== null) setExpandedMediaId(null);
      return next;
    });
  };

  const toggleMediaCard = (mediaId: string) => {
    setExpandedMediaId((prev) => {
      const next = prev === mediaId ? null : mediaId;
      setSearchParams((p) => {
        if (next === null) {
          p.delete("expandMedia");
        } else {
          p.set("expandMedia", next);
          p.delete("expand");
        }
        return p;
      });
      if (next !== null) setExpandedId(null);
      return next;
    });
  };

  const closeClientDetail = useCallback(() => {
    setExpandedId(null);
    setExpandedMediaId(null);
    setSearchParams((p) => {
      p.delete("expand");
      p.delete("expandMedia");
      return p;
    });
  }, [setSearchParams]);

  const handleRefreshCadastroMetricsFromServer = useCallback(
    async (e: React.MouseEvent, mc: MediaClient) => {
      e.preventDefault();
      e.stopPropagation();
      if (!orgId) return;
      setMetricsRefreshingId(mc.id);
      try {
        const m = await refreshPersistedClientMetrics(orgId, mc.id);
        updateClientApiPerformanceMetrics(orgId, mc.id, {
          totalSpend: m.total_spend,
          roi: m.roi,
          cpa: m.cpa,
          currency: m.currency,
          syncedAt: m.synced_at,
        });
        setMediaTick((t) => t + 1);
        appendAudit(orgId, user?.username ?? "—", "Clientes — métricas (servidor)", mc.name);
        toast.success("Métricas atualizadas a partir da API / base de dados.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const low = msg.toLowerCase();
        if (low.includes("não configurada") || low.includes("503") || low.includes("mysql")) {
          toast.message("Configure MYSQL_DSN na API e execute a migração SQL para persistir tokens.");
        } else if (low.includes("nenhum token") || low.includes("404") || low.includes("não persistido")) {
          toast.message("Sem tokens na base para este cliente. Faça OAuth com MySQL ativo.");
        } else {
          toast.error(msg.length > 160 ? `${msg.slice(0, 157)}…` : msg);
        }
      } finally {
        setMetricsRefreshingId(null);
      }
    },
    [orgId, user?.username],
  );

  const adminCadastroView = user?.role === "admin" && orgId && searchParams.get("v") === "cadastro";

  return (
    <div className="min-w-0 w-full max-w-full space-y-5 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-display font-bold">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {user?.role === "admin"
              ? `${visibleClients.length + filteredCadastroClients.length} cliente(s) visíveis (${clientsData.length} demo + cadastros OAuth)`
              : `${visibleClients.length + filteredCadastroClients.length} cliente(s) atribuído(s) / cadastrados`}
            {sortBy === "cpa_desc" && user?.role === "admin" && " · CPA mais alto primeiro (lista demo)"}
          </p>
        </div>
        {orgId ? (
          <Button
            type="button"
            className="shrink-0 gap-2 w-full sm:w-auto"
            onClick={() => setRegisterOpen(true)}
          >
            <UserPlus className="h-4 w-4" />
            Cadastrar cliente
          </Button>
        ) : null}
      </div>

      {user?.role === "admin" && orgId ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={!adminCadastroView ? "default" : "outline"}
            onClick={() => {
              setSearchParams(
                (p) => {
                  p.delete("v");
                  return p;
                },
                { replace: true },
              );
            }}
          >
            Lista de clientes
          </Button>
          <Button
            type="button"
            size="sm"
            variant={adminCadastroView ? "default" : "outline"}
            onClick={() => {
              setSearchParams(
                (p) => {
                  p.set("v", "cadastro");
                  return p;
                },
                { replace: true },
              );
            }}
          >
            Cadastrar e organização
          </Button>
        </div>
      ) : null}

      {!adminCadastroView ? (
        <>
      <Card className="glass-card min-w-0 w-full max-w-full overflow-x-hidden border-border/60 p-2.5 sm:p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Filtros</p>

        <div className="min-w-0 space-y-4 lg:hidden">
          <div className="relative min-w-0">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="f-quick"
              placeholder="Buscar por nome, e-mail ou CNPJ…"
              value={filterQuick}
              onChange={(e) => setFilterQuick(e.target.value)}
              className="h-11 min-w-0 w-full max-w-full border-border/50 bg-secondary/50 pl-10 text-base"
              autoComplete="off"
            />
          </div>
          <div className="min-w-0 w-full max-w-full">
            <Button
              type="button"
              variant="outline"
              aria-expanded={sortMobileOpen}
              aria-haspopup="listbox"
              aria-label={`Ordenação: ${SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? ""}`}
              onClick={() => setSortMobileOpen((o) => !o)}
              className="h-11 min-w-0 w-full max-w-full justify-between gap-2 border-border/60 bg-secondary/30 font-normal focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:ring-offset-0"
            >
              <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                <ArrowUpDown className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                <span className="truncate text-left">
                  <span className="text-muted-foreground">Ordenação · </span>
                  {SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Ordenar por"}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 opacity-70 transition-transform duration-200",
                  sortMobileOpen && "rotate-180",
                )}
                aria-hidden
              />
            </Button>
            <div
              className={cn(
                "grid w-full min-w-0 max-w-full transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                sortMobileOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <ul className="min-w-0 list-none space-y-1.5 pt-2" role="listbox" aria-label="Opções de ordenação">
                  {SORT_OPTIONS.map((opt) => (
                    <li key={opt.value} role="none">
                      <button
                        type="button"
                        role="option"
                        aria-selected={sortBy === opt.value}
                        onClick={() => {
                          setSortBy(opt.value);
                          setSortMobileOpen(false);
                        }}
                        className={cn(
                          "flex w-full min-w-0 items-center justify-between gap-2 rounded-md border px-3 py-2.5 text-left text-sm transition-colors",
                          sortBy === opt.value
                            ? "border-primary/40 bg-primary/10 font-medium text-foreground"
                            : "border-border/50 bg-secondary/25 font-normal hover:bg-secondary/45",
                        )}
                      >
                        <span className="min-w-0">{opt.label}</span>
                        {sortBy === opt.value ? (
                          <CircleCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div className="min-w-0 w-full max-w-full">
            <Button
              type="button"
              variant="outline"
              aria-expanded={filtersAdvancedMobileOpen}
              onClick={() => setFiltersAdvancedMobileOpen((o) => !o)}
              className="h-11 min-w-0 w-full max-w-full justify-between gap-2 border-border/60 bg-secondary/30 font-normal focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:ring-offset-0"
            >
              <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                <SlidersHorizontal className="h-4 w-4 shrink-0 opacity-80" />
                <span className="truncate text-left">Filtros avançados</span>
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 opacity-70 transition-transform duration-200",
                  filtersAdvancedMobileOpen && "rotate-180",
                )}
                aria-hidden
              />
            </Button>
            <div
              className={cn(
                "grid w-full min-w-0 max-w-full transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                filtersAdvancedMobileOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="min-w-0 max-w-full space-y-4 pt-4">
                  <div className="min-w-0 space-y-1.5">
                    <label htmlFor="f-name-m" className="text-xs text-muted-foreground">
                      Nome do cliente
                    </label>
                    <Input
                      id="f-name-m"
                      placeholder="Buscar por nome…"
                      value={filterName}
                      onChange={(e) => setFilterName(e.target.value)}
                      className="h-11 min-w-0 w-full max-w-full bg-secondary/50 border-border/50"
                    />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <label htmlFor="f-email-m" className="text-xs text-muted-foreground">
                      E-mail
                    </label>
                    <Input
                      id="f-email-m"
                      type="email"
                      placeholder="contato@empresa.com"
                      value={filterEmail}
                      onChange={(e) => setFilterEmail(e.target.value)}
                      className="h-11 min-w-0 w-full max-w-full bg-secondary/50 border-border/50"
                    />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <label htmlFor="f-cnpj-m" className="text-xs text-muted-foreground">
                      CNPJ
                    </label>
                    <Input
                      id="f-cnpj-m"
                      placeholder="00.000.000/0000-00"
                      value={filterCnpj}
                      onChange={(e) => setFilterCnpj(e.target.value)}
                      className="h-11 min-w-0 w-full max-w-full bg-secondary/50 border-border/50"
                    />
                  </div>
                  <p className="break-words text-[11px] leading-relaxed text-muted-foreground">
                    Com a busca rápida preenchida, ela tem prioridade. Esvazie-a para usar estes campos em conjunto.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden gap-3 lg:grid lg:grid-cols-4 lg:items-end">
          <div className="space-y-1.5 lg:col-span-1">
            <label htmlFor="f-name" className="text-xs text-muted-foreground">
              Nome do cliente
            </label>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="f-name"
                placeholder="Buscar por nome..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                className="h-10 border-border/50 bg-secondary/50 pl-8"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="f-email" className="text-xs text-muted-foreground">
              E-mail
            </label>
            <Input
              id="f-email"
              type="email"
              placeholder="contato@empresa.com"
              value={filterEmail}
              onChange={(e) => setFilterEmail(e.target.value)}
              className="h-10 border-border/50 bg-secondary/50"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="f-cnpj" className="text-xs text-muted-foreground">
              CNPJ
            </label>
            <Input
              id="f-cnpj"
              placeholder="00.000.000/0000-00"
              value={filterCnpj}
              onChange={(e) => setFilterCnpj(e.target.value)}
              className="h-10 border-border/50 bg-secondary/50"
            />
          </div>
          <div className="space-y-1.5">
            <span className="block text-xs text-muted-foreground">Ordenação</span>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger className="h-10 border-border/50 bg-secondary/50">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cpa_desc">CPA mais alto primeiro</SelectItem>
                <SelectItem value="cpa_asc">CPA mais baixo primeiro</SelectItem>
                <SelectItem value="name_asc">Nome (A–Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {user?.role !== "admin" && visibleClients.length === 0 && filteredCadastroClients.length === 0 && (
        <Card className="glass-card p-6 text-center text-muted-foreground text-sm">
          Nenhum cliente atribuído à sua conta. Peça a um administrador para vincular clientes ao seu usuário em{" "}
          <span className="text-foreground font-medium">Usuários</span>.
        </Card>
      )}

      <div className="grid min-w-0 w-full max-w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-4 xl:grid-cols-4">
        {visibleClients.map((client) => {
          const open = expandedId === client.id;
          const pendingApprovalCount = pendingByDetailKey[`demo-${client.id}`]?.length ?? 0;
          const linked = orgMediaState ? findLinkedMediaForDemo(client, orgMediaState.mediaClients) : undefined;
          return (
            <Card
              key={`demo-${client.id}`}
              role="button"
              tabIndex={0}
              onClick={() => toggleCard(client.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleCard(client.id);
                }
              }}
              className={cn(
                "relative glass-card min-w-0 max-w-full p-3 hover:glow-primary transition-all cursor-pointer group text-left sm:p-5",
                open && "ring-2 ring-primary/50 glow-primary",
              )}
            >
              <div className="absolute top-3 right-3 z-10">
                <FavoriteButton
                  id={`client:${client.id}`}
                  kind="client"
                  title={client.name}
                  path={`/clientes?expand=${client.id}`}
                  subtitle={client.segment}
                  size="sm"
                />
              </div>
              <div className="flex items-start justify-between mb-3 pr-8 gap-2">
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-sm group-hover:gradient-brand-text transition-colors">
                    {client.name}
                  </h3>
                  <span className="text-xs text-muted-foreground">{client.segment}</span>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                    client.status === "Ativo" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                  }`}
                >
                  {client.status}
                </span>
              </div>

              <div className="flex items-center gap-1.5 mb-2" title="Ligação OAuth por plataforma (Gestão de Mídias)">
                {CONNECTION_DOT_PLATFORMS.map(({ id: pid, label: plab }) => {
                  const { ok, label } = platformConnectionDot(linked, pid);
                  return (
                    <Tooltip key={pid}>
                      <TooltipTrigger asChild>
                        <span
                          className={cn(
                            "h-2.5 w-2.5 rounded-full shrink-0 border border-background/80",
                            ok ? "bg-success" : "bg-destructive",
                          )}
                          aria-label={`${plab}: ${label}`}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs max-w-[220px]">
                        <span className="font-medium">{plab}</span> — {label}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign size={14} className="text-primary shrink-0" />
                  <span className="text-muted-foreground">Investimento:</span>
                  <span className="font-medium ml-auto tabular-nums">{client.spend}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp size={14} className="text-success shrink-0" />
                  <span className="text-muted-foreground">ROI:</span>
                  <span className="font-medium ml-auto">{client.roi}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm pt-0.5">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Target size={14} className="text-destructive/90 shrink-0" />
                    CPA:
                  </span>
                  <span className="font-semibold text-destructive/90 tabular-nums">{brl(client.cpa)}</span>
                </div>
                {pendingApprovalCount > 0 && (
                  <div className="flex items-center justify-between gap-2 text-sm pt-0.5">
                    <span className="text-muted-foreground flex items-center gap-1.5 min-w-0">
                      <ListChecks size={14} className="text-amber-500 shrink-0" />
                      <span className="truncate">Aprovações pendentes:</span>
                    </span>
                    <span
                      className="shrink-0 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-amber-950 shadow-sm tabular-nums"
                      title={`${pendingApprovalCount} aprovação(ões) a rever no painel expandido`}
                    >
                      {pendingApprovalCount}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <BarChart3 size={14} className="text-accent shrink-0" />
                  <span className="text-muted-foreground">Plataformas:</span>
                </div>
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {client.platforms.map((p) => (
                  <span
                    key={p}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                  >
                    {p}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-3 pt-2 border-t border-border/40">
                {isLg
                  ? open
                    ? "Clique para fechar o modal"
                    : "Clique para abrir modal completo (IA, gráficos, ROI)"
                  : open
                    ? "Toque novamente para fechar"
                    : "Toque para abrir o modal de detalhes"}
              </p>
            </Card>
          );
        })}

        {filteredCadastroClients.map((mc) => {
          const open = expandedMediaId === mc.id;
          const pendingApprovalCount = pendingByDetailKey[`media-${mc.id}`]?.length ?? 0;
          const spendVal = mc.performanceMetrics?.totalSpend ?? 0;
          const roiVal =
            mc.performanceMetrics && Number.isFinite(mc.performanceMetrics.roi)
              ? `${Math.max(0, mc.performanceMetrics.roi).toFixed(1)}x`
              : "—";
          return (
            <Card
              key={mc.id}
              role="button"
              tabIndex={0}
              onClick={() => toggleMediaCard(mc.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleMediaCard(mc.id);
                }
              }}
              className={cn(
                "relative glass-card min-w-0 max-w-full p-3 hover:glow-primary transition-all cursor-pointer group text-left sm:p-5 ring-1 ring-primary/15",
                open && "ring-2 ring-primary/50 glow-primary",
              )}
            >
              <div className="absolute top-3 right-3 z-10">
                <FavoriteButton
                  id={`client-media:${mc.id}`}
                  kind="client"
                  title={mc.name}
                  path={`/clientes?expandMedia=${mc.id}`}
                  subtitle="Cadastro OAuth"
                  size="sm"
                />
              </div>
              <div className="flex items-start justify-between mb-3 pr-8 gap-2">
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-sm group-hover:gradient-brand-text transition-colors">
                    {mc.name}
                  </h3>
                  <span className="text-xs text-muted-foreground">Alias · OAuth</span>
                </div>
                <Badge variant="outline" className="text-[9px] shrink-0 border-primary/40">
                  Cadastro
                </Badge>
              </div>

              <div className="flex items-center gap-1.5 mb-2">
                {CONNECTION_DOT_PLATFORMS.map(({ id: pid, label: plab }) => {
                  const { ok, label } = platformConnectionDot(mc, pid);
                  return (
                    <Tooltip key={pid}>
                      <TooltipTrigger asChild>
                        <span
                          className={cn(
                            "h-2.5 w-2.5 rounded-full shrink-0 border border-background/80",
                            ok ? "bg-success" : "bg-destructive",
                          )}
                          aria-label={`${plab}: ${label}`}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs max-w-[220px]">
                        <span className="font-medium">{plab}</span> — {label}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign size={14} className="text-primary shrink-0" />
                  <span className="text-muted-foreground">Investimento (sync):</span>
                  <span className="font-medium ml-auto tabular-nums">{brl(spendVal)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp size={14} className="text-success shrink-0" />
                  <span className="text-muted-foreground">ROI (est.):</span>
                  <span className="font-medium ml-auto">{roiVal}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm pt-0.5">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Target size={14} className="text-destructive/90 shrink-0" />
                    CPA (est.):
                  </span>
                  <span className="font-semibold text-destructive/90 tabular-nums">
                    {brl(mc.performanceMetrics?.cpa ?? 0)}
                  </span>
                </div>
                {orgId &&
                  mc.platformIds.some(
                    (pid) =>
                      mc.platformConnections[pid]?.status === "connected" ||
                      mc.platformConnections[pid]?.status === "syncing",
                  ) && (
                    <div className="pt-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 w-full gap-2 text-xs border border-border/60"
                        disabled={metricsRefreshingId === mc.id}
                        onClick={(e) => void handleRefreshCadastroMetricsFromServer(e, mc)}
                      >
                        {metricsRefreshingId === mc.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                        )}
                        Atualizar métricas (servidor)
                      </Button>
                    </div>
                  )}
                {pendingApprovalCount > 0 && (
                  <div className="flex items-center justify-between gap-2 text-sm pt-0.5">
                    <span className="text-muted-foreground flex items-center gap-1.5 min-w-0">
                      <ListChecks size={14} className="text-amber-500 shrink-0" />
                      <span className="truncate">Aprovações pendentes:</span>
                    </span>
                    <span className="shrink-0 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-amber-950 shadow-sm tabular-nums">
                      {pendingApprovalCount}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {mc.platformIds.map((pid) => (
                  <span
                    key={pid}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                  >
                    {MEDIA_PLATFORMS.find((p) => p.id === pid)?.label ?? pid}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-3 pt-2 border-t border-border/40">
                Cadastrado neste módulo · ligue contas em Gestão de Mídias ou aqui (OAuth)
              </p>
            </Card>
          );
        })}
      </div>
        </>
      ) : (
        <MediaOrgCadastroSection />
      )}

      <Dialog
        open={Boolean(selectedPanelClient)}
        onOpenChange={(open) => {
          if (!open) closeClientDetail();
        }}
      >
        <DialogContent
          key={`${selectedDemo?.id ?? ""}-${selectedMediaClient?.id ?? ""}`}
          disableInnerScroll
          className="flex max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.25rem)] max-w-[min(96vw,72rem)] flex-col gap-0 overflow-hidden border-border/60 p-0 sm:max-h-[calc(100dvh-2rem)] lg:max-h-[min(calc(100dvh-2rem),56rem)]"
        >
          {selectedPanelClient && (
            <>
              <DialogHeader className="shrink-0 space-y-1.5 border-b border-border/60 px-4 py-3 pr-14 text-left">
                <DialogTitle className="font-display text-lg leading-snug sm:text-xl">
                  {selectedPanelClient.name}
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="text-left text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    <p>
                      {selectedPanelClient.segment} · Budget: {selectedPanelClient.budgetLabel}
                    </p>
                    <p className="mt-0.5">
                      {selectedPanelClient.email} · CNPJ {selectedPanelClient.cnpj}
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4">
                <ClientExpandedPanel
                  key={detailKey}
                  client={selectedPanelClient}
                  embeddedInModal
                  showSettingsButton={Boolean(selectedDemo)}
                  onOpenSettings={() => {
                    if (selectedDemo) setSettingsClientId(selectedDemo.id);
                  }}
                  supervisedPendingApprovals={detailKey ? pendingByDetailKey[detailKey] ?? [] : []}
                  onSupervisedPendingChange={(updater) => {
                    if (!detailKey) return;
                    setPendingByDetailKey((m) => {
                      const prev = m[detailKey] ?? [];
                      const next = typeof updater === "function" ? updater(prev) : updater;
                      if (next.length === 0) {
                        const { [detailKey]: _, ...rest } = m;
                        return rest;
                      }
                      return { ...m, [detailKey]: next };
                    });
                  }}
                />
              </div>
              <DialogFooter className="shrink-0 border-t border-border/60 px-4 py-3 sm:justify-center">
                <Button type="button" variant="secondary" className="w-full sm:w-auto min-w-[8rem]" onClick={closeClientDetail}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={accountPickerOpen}
        onOpenChange={(o) => {
          if (!o) {
            setAccountPickerOpen(false);
            setAccountPickerContext(null);
          }
        }}
      >
        <DialogContent className="max-w-md border-border/60">
          <DialogHeader>
            <DialogTitle className="font-display">Qual conta associar ao alias?</DialogTitle>
            <DialogDescription className="text-left text-sm">
              O mesmo login pode gerir várias contas de anúncios. Selecione a(s) que correspondem a{" "}
              <strong>{accountPickerContext?.aliasName}</strong> nesta plataforma.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {accountPickerContext &&
              orgId &&
              (getOrgMediaState(orgId).mediaClients.find((c) => c.id === accountPickerContext.mediaClientId)?.managedAdAccountsByPlatform?.[
                accountPickerContext.platformId
              ] ?? []
              ).map((acc) => (
                <label
                  key={acc.externalId}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/40"
                >
                  <Checkbox
                    checked={accountPickerSelectedIds.includes(acc.externalId)}
                    onCheckedChange={(c) => {
                      const on = c === true;
                      setAccountPickerSelectedIds((prev) => {
                        if (on) return [...new Set([...prev, acc.externalId])];
                        return prev.filter((x) => x !== acc.externalId);
                      });
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{acc.name}</span>
                    <span className="block text-[11px] text-muted-foreground font-mono truncate">{acc.externalId}</span>
                  </span>
                </label>
              ))}
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setAccountPickerOpen(false);
                setAccountPickerContext(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!orgId || !accountPickerContext || accountPickerSelectedIds.length === 0}
              onClick={() => {
                if (!orgId || !accountPickerContext) return;
                setSelectedAdAccountsForPlatform(
                  orgId,
                  accountPickerContext.mediaClientId,
                  accountPickerContext.platformId,
                  accountPickerSelectedIds,
                );
                setMediaTick((t) => t + 1);
                setAccountPickerOpen(false);
                setAccountPickerContext(null);
                toast.success("Conta(s) associadas ao alias.");
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {orgId && user ? (
        <ClientesRegisterModal
          open={registerOpen}
          onOpenChange={setRegisterOpen}
          orgId={orgId}
          actorUsername={user.username}
          onLinked={() => setMediaTick((t) => t + 1)}
        />
      ) : null}

      <ClientSettingsModal
        clientId={settingsClientId}
        open={settingsClientId !== null}
        onClose={() => setSettingsClientId(null)}
      />
    </div>
  );
};

export default Clientes;
