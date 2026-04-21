import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { GitBranch, Loader2, Play, Zap } from "lucide-react";
import { automationGet, automationPost } from "@/services/growthHubApi";

type AutoRow = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: string;
  action: string;
};

export default function AutomationPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AutoRow[]>([]);
  const [logs, setLogs] = useState<{ id: string; message: string; createdAt: string; ok: boolean }[]>([]);
  const [name, setName] = useState("Nova automação");
  const [trigger, setTrigger] = useState("lead_created");
  const [actionType, setActionType] = useState("webhook");
  const [webhookUrl, setWebhookUrl] = useState("https://example.com/webhook");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await automationGet()) as {
        ok?: boolean;
        automations?: AutoRow[];
        logs?: { id: string; message: string; createdAt: string; ok: boolean }[];
      };
      setRows(data.automations ?? []);
      setLogs(data.logs ?? []);
    } catch {
      toast.error("Erro ao carregar automações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    try {
      const config =
        actionType === "webhook"
          ? { url: webhookUrl }
          : actionType === "google_sheets"
            ? { spreadsheetId: "demo-sheet" }
            : actionType === "crm"
              ? { provider: "hubspot" }
              : { template: "lead_notification" };
      const data = (await automationPost({
        action: "create",
        name,
        trigger,
        actionType,
        config,
      })) as { ok?: boolean };
      if (data.ok) {
        toast.success("Automação criada.");
        void load();
      }
    } catch {
      toast.error("Erro ao criar.");
    }
  };

  const run = async (id: string) => {
    try {
      await automationPost({ action: "run", id });
      toast.success("Execução registada.");
      void load();
    } catch {
      toast.error("Erro ao executar.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Zap className="h-7 w-7 text-primary" />
          Automação
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gatilho → ação (webhook, e-mail, Google Sheets, CRM). Logs locais até fila persistente em produção.
        </p>
      </div>

      <Card className="p-5 border-border/60 border-dashed">
        <div className="flex items-center gap-2 mb-4 text-sm font-medium">
          <GitBranch className="h-4 w-4" />
          Fluxo (criador visual simplificado)
        </div>
        <div className="rounded-lg bg-muted/40 p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-sm">
          <div className="rounded-md bg-primary/15 px-3 py-2 text-center sm:text-left flex-1">Trigger</div>
          <span className="hidden sm:inline text-muted-foreground">→</span>
          <div className="rounded-md bg-secondary px-3 py-2 text-center sm:text-left flex-1">Action</div>
          <span className="hidden sm:inline text-muted-foreground">→</span>
          <div className="rounded-md bg-muted px-3 py-2 text-center sm:text-left flex-1">Log / CRM</div>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card className="p-5 border-border/60 space-y-4">
            <h3 className="font-medium">Nova automação</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Gatilho</Label>
                <Select value={trigger} onValueChange={setTrigger}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead_created">Novo lead criado</SelectItem>
                    <SelectItem value="form_submitted">Formulário preenchido</SelectItem>
                    <SelectItem value="campaign_created">Nova campanha criada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ação</Label>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="webhook">Webhook</SelectItem>
                    <SelectItem value="google_sheets">Google Sheets</SelectItem>
                    <SelectItem value="crm">CRM</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {actionType === "webhook" ? (
                <div className="sm:col-span-2">
                  <Label>URL do webhook</Label>
                  <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="mt-1 font-mono text-xs" />
                </div>
              ) : null}
            </div>
            <Button type="button" onClick={() => void create()}>
              Criar automação
            </Button>
          </Card>

          <Card className="p-5 border-border/60">
            <h3 className="font-medium mb-3">Automações</h3>
            <ul className="space-y-2">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{r.name}</span>
                    <span className="text-muted-foreground ml-2">
                      {r.trigger} → {r.action}
                    </span>
                  </div>
                  <Button type="button" size="sm" variant="secondary" onClick={() => void run(r.id)}>
                    <Play className="h-3.5 w-3.5 mr-1" />
                    Testar
                  </Button>
                </li>
              ))}
              {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma automação ainda.</p> : null}
            </ul>
          </Card>

          <Card className="p-5 border-border/60">
            <h3 className="font-medium mb-3">Logs recentes</h3>
            <ul className="space-y-1 text-xs font-mono text-muted-foreground max-h-48 overflow-y-auto">
              {logs.map((l) => (
                <li key={l.id}>
                  {new Date(l.createdAt).toLocaleString("pt-BR")} — {l.ok ? "ok" : "erro"} — {l.message}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
