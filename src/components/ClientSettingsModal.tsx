import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { clientsData } from "@/data/clientsCatalog";
import {
  loadClientIntegration,
  resolveSlackReportPreferences,
  saveClientIntegration,
  type ClientIntegrationSettings,
} from "@/lib/clientIntegrationSettings";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slack, Clock, Link2, PauseCircle, PlayCircle, ShoppingBag, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS: { v: number; label: string }[] = [
  { v: 0, label: "Dom" },
  { v: 1, label: "Seg" },
  { v: 2, label: "Ter" },
  { v: 3, label: "Qua" },
  { v: 4, label: "Qui" },
  { v: 5, label: "Sex" },
  { v: 6, label: "Sáb" },
];

type Props = {
  clientId: number | null;
  open: boolean;
  onClose: () => void;
};

export function ClientSettingsModal({ clientId, open, onClose }: Props) {
  const client = clientId != null ? clientsData.find((c) => c.id === clientId) : undefined;
  const [form, setForm] = useState<ClientIntegrationSettings | null>(null);
  const [baselineJson, setBaselineJson] = useState<string | null>(null);

  useEffect(() => {
    if (clientId == null || !open) {
      setForm(null);
      setBaselineJson(null);
      return;
    }
    const loaded = loadClientIntegration(clientId);
    const resolved = { ...loaded, slackReportPrefs: resolveSlackReportPreferences(loaded) };
    setForm(resolved);
    setBaselineJson(JSON.stringify(resolved));
  }, [clientId, open]);

  const isDirty = useMemo(() => {
    if (form == null || baselineJson == null) return false;
    return JSON.stringify(form) !== baselineJson;
  }, [form, baselineJson]);

  if (!open || clientId == null || !client) return null;

  if (!form) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-md">
          <p className="text-sm text-muted-foreground py-6 text-center">A carregar definições…</p>
        </DialogContent>
      </Dialog>
    );
  }

  const update = (patch: Partial<ClientIntegrationSettings>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const prefs = resolveSlackReportPreferences(form);
  const setChannel = (patch: Partial<typeof prefs.channels>) =>
    update({ slackReportPrefs: { ...prefs, channels: { ...prefs.channels, ...patch } } });
  const setFunnel = (patch: Partial<typeof prefs.funnel>) =>
    update({ slackReportPrefs: { ...prefs, funnel: { ...prefs.funnel, ...patch } } });
  const setSections = (patch: Partial<typeof prefs.sections>) =>
    update({ slackReportPrefs: { ...prefs, sections: { ...prefs.sections, ...patch } } });

  const toggleDay = (v: number) => {
    const set = new Set(form.scheduleWeekdays);
    if (set.has(v)) set.delete(v);
    else set.add(v);
    update({ scheduleWeekdays: [...set].sort((a, b) => a - b) });
  };

  const handleSave = () => {
    if (clientId == null || form == null) return;
    const prev = loadClientIntegration(clientId);
    const scheduleChanged =
      prev.scheduleTime !== form.scheduleTime ||
      JSON.stringify([...prev.scheduleWeekdays].sort()) !== JSON.stringify([...form.scheduleWeekdays].sort());
    const reEnabled = !prev.scheduleEnabled && form.scheduleEnabled;
    saveClientIntegration(clientId, {
      ...form,
      ...(scheduleChanged || reEnabled ? { lastScheduleDay: undefined } : {}),
    });
    const saved = loadClientIntegration(clientId);
    const resolved = { ...saved, slackReportPrefs: resolveSlackReportPreferences(saved) };
    setBaselineJson(JSON.stringify(resolved));
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[min(90vh,720px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Slack className="h-5 w-5 text-[#E01E5A]" />
            Settings — {client.name}
          </DialogTitle>
          <DialogDescription>
            Webhook do Slack, campos do relatório enviado ao cliente, contactos e agendamento automático (ou use{" "}
            <code className="text-[11px]">SLACK_WEBHOOK_URL</code> / <code className="text-[11px]">VITE_SLACK_WEBHOOK_URL</code>{" "}
            no ambiente como fallback).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="slack-url" className="flex items-center gap-2 text-xs">
              <Link2 className="h-3.5 w-3.5" />
              Webhook do Slack (Incoming Webhook)
            </Label>
            <Input
              id="slack-url"
              value={form.slackWebhookUrl}
              onChange={(e) => update({ slackWebhookUrl: e.target.value })}
              placeholder="https://hooks.slack.com/services/..."
              className="bg-secondary/50 border-border/50 font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Crie em Slack → Apps → Incoming Webhooks. Fallback global no <code className="text-primary/90">.env</code>:{" "}
              <code className="text-primary/90">SLACK_WEBHOOK_URL</code> ou <code className="text-primary/90">VITE_SLACK_WEBHOOK_URL</code>
              .
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-email" className="text-xs">
              E-mail de contacto (referência)
            </Label>
            <Input
              id="contact-email"
              type="email"
              value={form.contactEmail}
              onChange={(e) => update({ contactEmail: e.target.value })}
              placeholder={client.email}
              className="bg-secondary/50 border-border/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas" className="text-xs">
              Notas internas
            </Label>
            <Textarea
              id="notas"
              value={form.notas}
              onChange={(e) => update({ notas: e.target.value })}
              placeholder="Ex.: canal #performance, responsável pelo Slack..."
              rows={3}
              className="bg-secondary/50 border-border/50 resize-none text-sm"
            />
          </div>

          <div className="rounded-lg border border-border/60 bg-secondary/20 p-4 space-y-3">
            <p className="text-xs font-medium text-foreground">Relatório Slack — campos enviados ao cliente</p>
            <Tabs defaultValue="ecommerce" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-auto gap-1">
                <TabsTrigger value="ecommerce" className="gap-1.5 text-xs py-2">
                  <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
                  E-commerce
                </TabsTrigger>
                <TabsTrigger value="leads" className="gap-1.5 text-xs py-2">
                  <Target className="h-3.5 w-3.5 shrink-0" />
                  Campanhas de leads
                </TabsTrigger>
              </TabsList>
              <TabsContent value="ecommerce" className="space-y-3 pt-3">
                <p className="text-[11px] text-muted-foreground">
                  Métricas típicas de loja / conversão: investimento, receita, conversões e ROI.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={prefs.channels.showInvested}
                      onCheckedChange={(v) => setChannel({ showInvested: v === true })}
                    />
                    <span className="text-sm">Investimento</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={prefs.channels.showRevenue}
                      onCheckedChange={(v) => setChannel({ showRevenue: v === true })}
                    />
                    <span className="text-sm">Receita</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={prefs.channels.showConversions}
                      onCheckedChange={(v) => setChannel({ showConversions: v === true })}
                    />
                    <span className="text-sm">Conversões</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={prefs.channels.showRoi}
                      onCheckedChange={(v) => setChannel({ showRoi: v === true })}
                    />
                    <span className="text-sm">ROI</span>
                  </label>
                </div>
                <p className="text-[11px] font-medium text-foreground/90 pt-1">Gráficos no Slack</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={prefs.sections.showPerformanceChart}
                      onCheckedChange={(v) => setSections({ showPerformanceChart: v === true })}
                    />
                    <span className="text-sm">Desempenho por canal (linha)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={prefs.sections.showBudgetDonuts}
                      onCheckedChange={(v) => setSections({ showBudgetDonuts: v === true })}
                    />
                    <span className="text-sm">Distribuição de orçamento (roscas)</span>
                  </label>
                </div>
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <Checkbox
                    checked={prefs.sections.showAiInsight}
                    onCheckedChange={(v) => setSections({ showAiInsight: v === true })}
                  />
                  <span className="text-sm">Insight da IA</span>
                </label>
              </TabsContent>
              <TabsContent value="leads" className="space-y-3 pt-3">
                <p className="text-[11px] text-muted-foreground">
                  Lead gen e mensagens: volume, CPL, custo por mensagem e custo por clique (funil).
                </p>
                <p className="text-[11px] font-medium text-foreground/90">Por canal (Meta, Google, Instagram)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={prefs.channels.showLeads}
                      onCheckedChange={(v) => setChannel({ showLeads: v === true })}
                    />
                    <span className="text-sm">Leads / mensagens</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={prefs.channels.showCpl}
                      onCheckedChange={(v) => setChannel({ showCpl: v === true })}
                    />
                    <span className="text-sm">CPL</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={prefs.channels.showCostPerMessage}
                      onCheckedChange={(v) => setChannel({ showCostPerMessage: v === true })}
                    />
                    <span className="text-sm">Custo por mensagem</span>
                  </label>
                </div>
                <p className="text-[11px] font-medium text-foreground/90 pt-1">Funil agregado</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={prefs.funnel.showImpressions}
                      onCheckedChange={(v) => setFunnel({ showImpressions: v === true })}
                    />
                    <span className="text-sm">Impressões</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={prefs.funnel.showClicks}
                      onCheckedChange={(v) => setFunnel({ showClicks: v === true })}
                    />
                    <span className="text-sm">Cliques</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={prefs.funnel.showCtr}
                      onCheckedChange={(v) => setFunnel({ showCtr: v === true })}
                    />
                    <span className="text-sm">CTR</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={prefs.funnel.showCpc}
                      onCheckedChange={(v) => setFunnel({ showCpc: v === true })}
                    />
                    <span className="text-sm">Custo por clique (CPC)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={prefs.funnel.showCpm}
                      onCheckedChange={(v) => setFunnel({ showCpm: v === true })}
                    />
                    <span className="text-sm">CPM</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={prefs.funnel.showCpa}
                      onCheckedChange={(v) => setFunnel({ showCpa: v === true })}
                    />
                    <span className="text-sm">CPA</span>
                  </label>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="rounded-lg border border-border/60 bg-secondary/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Agendar envio automático</span>
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={form.scheduleEnabled ? "default" : "outline"}
                  className={form.scheduleEnabled ? "gradient-brand text-primary-foreground gap-1.5" : "gap-1.5"}
                  onClick={() => {
                    const ws =
                      form.scheduleWeekdays.length === 0 ? ([1, 2, 3, 4, 5] as number[]) : form.scheduleWeekdays;
                    update({ scheduleEnabled: true, scheduleWeekdays: ws });
                  }}
                >
                  <PlayCircle className="h-4 w-4" />
                  Ativo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={!form.scheduleEnabled ? "secondary" : "outline"}
                  className="gap-1.5"
                  onClick={() => update({ scheduleEnabled: false })}
                >
                  <PauseCircle className="h-4 w-4" />
                  Pausar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {form.scheduleEnabled ? (
                  <>
                    <span className="text-foreground/90 font-medium">Envio ativo:</span> dias da semana + horário (repete
                    cada semana). A app tem de estar aberta no navegador — não há servidor a disparar sozinho.
                  </>
                ) : (
                  <>
                    <span className="text-foreground/90 font-medium">Envio em pausa:</span> nenhum relatório automático
                    será enviado até voltares a <span className="font-medium">Ativo</span>.
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map(({ v, label }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => toggleDay(v)}
                  className={cn(
                    "text-[11px] px-2 py-1 rounded-md border transition-colors",
                    form.scheduleWeekdays.includes(v)
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary/50",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 max-w-[200px]">
              <Label htmlFor="sched-time" className="text-xs shrink-0">
                Horário
              </Label>
              <Input
                id="sched-time"
                type="time"
                value={form.scheduleTime}
                onChange={(e) => update({ scheduleTime: e.target.value })}
                className="bg-background border-border/50 h-9"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Seleciona pelo menos um dia da semana. O envio tenta na janela de ~15 minutos após o horário (evita falhar
              se o separador esteve em segundo plano). Alterar dias/horário ou voltar a <span className="font-medium">Ativo</span>{" "}
              limpa o bloqueio do dia — útil para testar outra vez no mesmo dia. Máximo 1 envio por cliente por dia.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="gradient-brand text-primary-foreground"
            disabled={!isDirty}
            onClick={handleSave}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
