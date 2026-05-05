import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInsightHubScheduledReport,
  fetchInsightHubReports,
  fetchInsightHubScheduledReports,
} from "@/lib/insightHubApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock, Plus, Mail } from "lucide-react";
import { toast } from "sonner";

const CRON_PRESETS = [
  { value: "weekly_mon_8", label: "Semanal · segunda 08:00", expr: "0 8 * * 1" },
  { value: "monthly_1_8", label: "Mensal · dia 1, 08:00", expr: "0 8 1 * *" },
  { value: "daily_18", label: "Diário · 18:00", expr: "0 18 * * *" },
];

export default function InsightHubAgendamentos() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState(CRON_PRESETS[0].value);
  const [reportId, setReportId] = useState<string>("");
  const [recipients, setRecipients] = useState("");
  const [enabled, setEnabled] = useState(true);

  const schedQ = useQuery({
    queryKey: ["insight-hub", "schedules"],
    queryFn: fetchInsightHubScheduledReports,
  });
  const reportsQ = useQuery({ queryKey: ["insight-hub", "reports"], queryFn: () => fetchInsightHubReports() });

  const createMut = useMutation({
    mutationFn: () => {
      const cron = CRON_PRESETS.find((p) => p.value === preset)?.expr ?? "0 8 * * 1";
      const list = recipients
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!list.length) return Promise.reject(new Error("Inclua ao menos um e-mail."));
      return createInsightHubScheduledReport({
        reportId: reportId || undefined,
        cronExpr: cron,
        recipients: list,
        enabled,
      });
    },
    onSuccess: async () => {
      toast.success("Agendamento criado.");
      setOpen(false);
      setRecipients("");
      await qc.invalidateQueries({ queryKey: ["insight-hub", "schedules"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Agendamentos</h1>
          <p className="text-sm text-muted-foreground">Envie relatórios automáticos por e-mail.</p>
        </div>
        <Button className="gap-2" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Novo agendamento
        </Button>
      </header>

      {!schedQ.data?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhum agendamento ainda</CardTitle>
            <CardDescription>Configure o primeiro envio recorrente.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {schedQ.data.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{s.cronExpr}</p>
                    <p className="text-xs text-muted-foreground">
                      Próx: {s.nextRunAt ? new Date(s.nextRunAt).toLocaleString() : "—"}
                      {s.lastRunAt ? ` · último: ${new Date(s.lastRunAt).toLocaleString()}` : ""}
                    </p>
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Mail className="h-3 w-3" /> {s.recipients.join(", ") || "sem destinatários"}
                    </p>
                  </div>
                </div>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {s.enabled ? "Ativo" : "Pausado"}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo agendamento</DialogTitle>
            <DialogDescription>O scheduler envia o PDF/HTML do relatório no horário configurado.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>Frequência</Label>
              <Select value={preset} onValueChange={setPreset}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CRON_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Relatório (opcional)</Label>
              <Select value={reportId} onValueChange={setReportId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar relatório" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum (resumo padrão)</SelectItem>
                  {(reportsQ.data ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="recipients">Destinatários (separados por vírgula)</Label>
              <Input
                id="recipients"
                placeholder="cliente@exemplo.com, gestor@agencia.com"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Ativar agora</p>
                <p className="text-xs text-muted-foreground">Pode pausar a qualquer momento.</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending ? "A guardar…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
