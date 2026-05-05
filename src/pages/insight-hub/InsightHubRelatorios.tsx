import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInsightHubReport,
  deleteInsightHubReport,
  fetchInsightHubBrands,
  fetchInsightHubReports,
} from "@/lib/insightHubApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Trash2, FileBarChart } from "lucide-react";
import { toast } from "sonner";

const TEMPLATES = [
  { key: "monthly_overview", label: "Resumo mensal · KPIs", widgets: ["overview", "top_posts", "ads_summary"] },
  { key: "social_engagement", label: "Engajamento social", widgets: ["page_kpis", "top_posts", "engagement_chart"] },
  { key: "ads_performance", label: "Performance Ads", widgets: ["ads_summary", "spend_chart", "ctr"] },
];

export default function InsightHubRelatorios() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [brandId, setBrandId] = useState<string>("");
  const [tplKey, setTplKey] = useState<string>(TEMPLATES[0].key);

  const reportsQ = useQuery({ queryKey: ["insight-hub", "reports"], queryFn: () => fetchInsightHubReports() });
  const brandsQ = useQuery({ queryKey: ["insight-hub", "brands"], queryFn: fetchInsightHubBrands });

  const createMut = useMutation({
    mutationFn: () => {
      const tpl = TEMPLATES.find((t) => t.key === tplKey) ?? TEMPLATES[0];
      return createInsightHubReport({
        brandId: brandId || undefined,
        title: title.trim(),
        templateKey: tpl.key,
        definition: { widgets: tpl.widgets.map((id) => ({ id })) },
      });
    },
    onSuccess: async () => {
      toast.success("Relatório criado.");
      setOpen(false);
      setTitle("");
      await qc.invalidateQueries({ queryKey: ["insight-hub", "reports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteInsightHubReport(id),
    onSuccess: async () => {
      toast.success("Relatório removido.");
      await qc.invalidateQueries({ queryKey: ["insight-hub", "reports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Crie relatórios a partir de templates. Personalização avançada (drag-and-drop) chega na próxima onda.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo relatório
        </Button>
      </header>

      {!reportsQ.data?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhum relatório ainda</CardTitle>
            <CardDescription>Comece a partir de um template e adapte para a marca.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {reportsQ.data.map((r) => {
            const brand = brandsQ.data?.find((b) => b.id === r.brandId);
            return (
              <Card key={r.id}>
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <FileBarChart className="h-4 w-4 text-primary" aria-hidden />
                    <div>
                      <p className="font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.templateKey ? `Template: ${r.templateKey}` : "Template livre"}
                        {brand ? ` · ${brand.name}` : ""}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-destructive hover:text-destructive"
                    onClick={() => deleteMut.mutate(r.id)}
                    disabled={deleteMut.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remover
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo relatório</DialogTitle>
            <DialogDescription>Escolha um template inicial — a edição visual aparece em breve.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="report-title">Título</Label>
              <Input
                id="report-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Resumo de Junho — Marca XYZ"
              />
            </div>
            <div className="grid gap-2">
              <Label>Marca (opcional)</Label>
              <Select value={brandId} onValueChange={setBrandId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem marca específica" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem marca específica</SelectItem>
                  {(brandsQ.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Template</Label>
              <Select value={tplKey} onValueChange={setTplKey}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => createMut.mutate()} disabled={!title.trim() || createMut.isPending}>
              {createMut.isPending ? "A guardar…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
