import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { GripVertical, Plus, Webhook } from "lucide-react";

const TEMPLATES = [
  { id: "local", name: "Negócios locais", fields: ["Nome", "Telefone", "Cidade"] },
  { id: "serv", name: "Serviços", fields: ["Nome", "E-mail", "Serviço de interesse"] },
  { id: "info", name: "Infoprodutos", fields: ["Nome", "E-mail", "Instagram"] },
];

const POOL = ["Nome completo", "E-mail", "Telefone", "Empresa", "Mensagem", "CEP"];

export default function CampanhasLeadsFormularios() {
  const [selected, setSelected] = useState<string | null>("local");
  const [formFields, setFormFields] = useState<string[]>(["Nome", "Telefone", "Cidade"]);

  const applyTemplate = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setSelected(id);
    setFormFields([...t.fields]);
    toast.success(`Template "${t.name}" aplicado.`);
  };

  const addField = (f: string) => {
    if (formFields.includes(f)) return;
    setFormFields((prev) => [...prev, f]);
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h2 className="text-lg font-semibold">Builder de formulários nativos</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Monte campos dinâmicos e publique em Lead Ads, webhooks ou CRM (estrutura pronta para integração REST).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {TEMPLATES.map((t) => (
          <Card
            key={t.id}
            className={`p-4 cursor-pointer border-2 transition-colors ${
              selected === t.id ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/30"
            }`}
            onClick={() => applyTemplate(t.id)}
          >
            <p className="font-medium text-sm">{t.name}</p>
            <p className="text-xs text-muted-foreground mt-1">{t.fields.join(" · ")}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 border-border/60 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Campos disponíveis</p>
          <div className="flex flex-wrap gap-2">
            {POOL.map((f) => (
              <Button key={f} type="button" size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => addField(f)}>
                <Plus className="h-3 w-3" />
                {f}
              </Button>
            ))}
          </div>
        </Card>

        <Card className="p-4 border-border/60 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Formulário (ordem do funil)</p>
          <p className="text-[11px] text-muted-foreground">
            Arrastar-e-soltar completo pode ser ligado a <code className="text-xs">@dnd-kit</code>; aqui a ordem é editável por clique.
          </p>
          <ul className="space-y-2">
            {formFields.map((f, i) => (
              <li
                key={`${f}-${i}`}
                className="flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/30 px-3 py-2 text-sm"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1">{f}</span>
                <Badge variant="secondary" className="text-[10px]">
                  obrigatório
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-4 border-border/60 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-2">
          <Webhook className="h-4 w-4" />
          Integrações
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Webhook (URL)</Label>
            <Input placeholder="https://api.seucrm.com/webhooks/lead" readOnly className="bg-muted/40" />
          </div>
          <div className="space-y-1.5">
            <Label>CRM / destino</Label>
            <Input placeholder="HubSpot, RD Station, planilha..." readOnly className="bg-muted/40" />
          </div>
        </div>
        <Button type="button" size="sm" onClick={() => toast.success("Payload de exemplo enviado para webhook (simulação).")}>
          Testar envio
        </Button>
      </Card>
    </div>
  );
}
