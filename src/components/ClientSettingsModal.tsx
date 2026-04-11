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
  saveClientIntegration,
  type ClientIntegrationSettings,
} from "@/lib/clientIntegrationSettings";
import { Slack, Clock, Link2, PauseCircle, PlayCircle } from "lucide-react";
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
    setForm(loaded);
    setBaselineJson(JSON.stringify(loaded));
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

  const toggleDay = (v: number) => {
    const set = new Set(form.scheduleWeekdays);
    if (set.has(v)) set.delete(v);
    else set.add(v);
    update({ scheduleWeekdays: [...set].sort((a, b) => a - b) });
  };

  const handleSave = () => {
    if (clientId == null) return;
    saveClientIntegration(clientId, form);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Slack className="h-5 w-5 text-[#E01E5A]" />
            Settings — {client.name}
          </DialogTitle>
          <DialogDescription>
            Webhook do Slack, contactos e agendamento automático do relatório de performance (ou use{" "}
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
                  onClick={() => update({ scheduleEnabled: true })}
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
                    <span className="text-foreground/90 font-medium">Envio ativo:</span> o relatório é enviado nas datas e
                    horário configurados (com a app aberta).
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
              Com a app aberta, o envio corre no minuto indicado (máx. 1 envio por dia por cliente). Mantém o separador
              com o horário local do navegador.
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
