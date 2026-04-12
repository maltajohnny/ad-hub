import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Check, Sparkles } from "lucide-react";
import adHubLogo from "@/assets/ad-hub-logo.png";

const HIGHLIGHT = "#EAD9A0";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export default function Planos() {
  const [yearly, setYearly] = useState(false);
  const [starterInstagram, setStarterInstagram] = useState(false);
  const [growthExtraUsers, setGrowthExtraUsers] = useState("0");

  const starterPrice = useMemo(() => {
    const base = yearly ? 169.9 * 10 : 169.9;
    const withIg = yearly ? 229.9 * 10 : 229.9;
    return starterInstagram ? withIg : base;
  }, [starterInstagram, yearly]);

  const growthPrice = useMemo(() => {
    const extra = Number(growthExtraUsers) || 0;
    const base = yearly ? 297 * 10 : 297;
    return base + extra * (yearly ? 40 * 10 : 40);
  }, [growthExtraUsers, yearly]);

  const scalePrice = useMemo(() => (yearly ? 497 * 10 : 497), [yearly]);

  const discountNote = yearly ? " ~2 meses incluídos no anual" : null;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-b from-slate-50 via-white to-slate-100 text-foreground">
      <header className="border-b border-slate-200/80 bg-white/70 backdrop-blur-md sticky top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={adHubLogo} alt="AD-HUB" className="h-10 w-10 object-contain" width={40} height={40} />
            <span className="font-display text-sm font-bold tracking-wide text-slate-900">AD-HUB</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link to="/login">Entrar</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="text-center max-w-2xl mx-auto">
          <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-amber-600/80" />
            Planos pensados para equipas de mídia
          </p>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Escolha o ritmo da sua operação
          </h1>
          <p className="mt-3 text-slate-600 leading-relaxed">
            Preços transparentes, add-ons quando fizer sentido e destaque no plano com melhor custo-benefício.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setYearly(false)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                !yearly ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setYearly(true)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                yearly ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              Anual
            </button>
            {yearly ? (
              <span className="text-xs text-emerald-700 font-medium">Economize com faturação anual</span>
            ) : null}
          </div>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3 lg:items-stretch">
          {/* Starter / Gestor */}
          <div
            className={cn(
              "flex flex-col rounded-2xl border p-6 shadow-sm backdrop-blur-sm transition hover:shadow-md",
              "border-slate-200/90 bg-white/65",
            )}
            style={{ boxShadow: `0 0 0 1px rgba(15,23,42,0.06)` }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Gestor</p>
            <h2 className="mt-2 font-display text-lg font-bold text-slate-900">Assinatura para gestor</h2>
            <p className="text-sm text-slate-600 mt-1">1 conta · até 3 clientes na base</p>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums text-slate-900">{fmt(starterPrice)}</span>
              <span className="text-slate-500 text-sm">/{yearly ? "ano" : "mês"}</span>
            </div>
            {discountNote ? <p className="text-[11px] text-slate-500 mt-1">{discountNote}</p> : null}

            <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
              {[
                "Até 3 clientes",
                "3 plataformas por cliente (Meta Ads, Google Ads, TikTok Ads)",
                "Dashboard + Kanban",
                "Integrações base",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            <div
              className="mt-6 rounded-xl border border-dashed px-3 py-3 space-y-3"
              style={{ borderColor: `${HIGHLIGHT}99`, background: `${HIGHLIGHT}22` }}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  id="ig-addon"
                  checked={starterInstagram}
                  onCheckedChange={(c) => setStarterInstagram(c === true)}
                />
                <Label htmlFor="ig-addon" className="text-sm leading-snug cursor-pointer font-normal">
                  Incluir <strong className="font-semibold">Instagram Ads</strong> (add-on) — total{" "}
                  <span className="tabular-nums font-medium">{fmt(yearly ? 229.9 * 10 : 229.9)}</span>/{yearly ? "ano" : "mês"}
                </Label>
              </div>
            </div>

            <div className="mt-auto pt-8">
              <Button type="button" className="w-full rounded-full" variant="outline" asChild>
                <Link to="/login">Começar agora</Link>
              </Button>
            </div>
          </div>

          {/* Growth — popular */}
          <div
            className={cn(
              "relative flex flex-col rounded-2xl border p-6 shadow-md backdrop-blur-sm",
              "border-amber-200/90 bg-white/75 ring-2 ring-[#EAD9A0] ring-offset-2 ring-offset-slate-50",
            )}
          >
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 text-white hover:bg-slate-900">
              Mais popular
            </Badge>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Organização</p>
            <h2 className="mt-2 font-display text-lg font-bold text-slate-900">3 a 5 gestores</h2>
            <p className="text-sm text-slate-600 mt-1">Escala para equipa e mais visibilidade de ROI</p>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums text-slate-900">{fmt(growthPrice)}</span>
              <span className="text-slate-500 text-sm">/{yearly ? "ano" : "mês"}</span>
            </div>
            <p className="text-[11px] text-emerald-800 mt-1 font-medium">Add-ons com 20% de desconto vs. avulso</p>

            <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
              {[
                "Até 10 clientes",
                "3 plataformas incluídas (seleção em lista)",
                "Dashboard + Kanban + ROI + Social Pulse",
                "Relatórios consolidados",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-1.5">
              <Label className="text-xs text-slate-600">Utilizadores extra</Label>
              <Select value={growthExtraUsers} onValueChange={setGrowthExtraUsers}>
                <SelectTrigger className="bg-white/90">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sem extras</SelectItem>
                  <SelectItem value="1">+1 utilizador (+R$ 40/mês)</SelectItem>
                  <SelectItem value="2">+2 utilizadores (+R$ 80/mês)</SelectItem>
                  <SelectItem value="3">+3 utilizadores (+R$ 120/mês)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="mt-auto pt-8">
              <Button type="button" className="w-full rounded-full" asChild>
                <Link to="/login">Começar agora</Link>
              </Button>
            </div>
          </div>

          {/* Scale */}
          <div
            className={cn(
              "flex flex-col rounded-2xl border p-6 shadow-sm backdrop-blur-sm",
              "border-slate-300/90 bg-gradient-to-b from-white/90 to-slate-50/90",
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Scale</p>
            <h2 className="mt-2 font-display text-lg font-bold text-slate-900">Até 10 gestores</h2>
            <p className="text-sm text-slate-600 mt-1">Âncora premium — operações complexas e multi-workspace</p>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums text-slate-900">{fmt(scalePrice)}</span>
              <span className="text-slate-500 text-sm">/{yearly ? "ano" : "mês"}</span>
            </div>

            <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
              {[
                "50+ clientes ou ilimitado (conforme contrato)",
                "Todas as plataformas incluídas",
                "IA insights e relatórios avançados",
                "Automações e multi-workspace",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto pt-8">
              <Button type="button" className="w-full rounded-full" variant="secondary" asChild>
                <Link to="/login">Falar com vendas</Link>
              </Button>
            </div>
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-slate-500 max-w-xl mx-auto leading-relaxed">
          Valores ilustrativos para conversão; contratos B2B podem incluir condições específicas. O plano <strong>Gestor</strong> reflete a
          assinatura com 3 plataformas por cliente e opção de Instagram Ads no valor indicado.
        </p>
      </main>
    </div>
  );
}
