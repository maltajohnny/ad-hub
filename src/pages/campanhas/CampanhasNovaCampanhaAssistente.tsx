import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Brain, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

const STEPS = [
  { id: 1, title: "Objetivo" },
  { id: 2, title: "Tipo de campanha" },
  { id: 3, title: "Público" },
  { id: 4, title: "Criativo" },
  { id: 5, title: "Sugestões IA" },
];

export default function CampanhasNovaCampanhaAssistente() {
  const [step, setStep] = useState(1);
  const [objective, setObjective] = useState<"lead" | "sale" | "traffic">("lead");
  const [campaignType, setCampaignType] = useState("conversion");
  const [audience, setAudience] = useState("");
  const [creative, setCreative] = useState("");

  const nivel = useMemo(() => {
    const filled = [audience.length > 20, creative.length > 30].filter(Boolean).length;
    if (filled === 0) return { label: "Iniciante", variant: "secondary" as const };
    if (filled === 1) return { label: "Intermediário", variant: "outline" as const };
    return { label: "Avançado", variant: "default" as const };
  }, [audience, creative]);

  const progress = Math.round((step / STEPS.length) * 100);

  const runIa = () => {
    toast.success("Sugestões geradas: tipo de campanha recomendado, estrutura de conjuntos e faixa de orçamento diário (demo).");
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Criar nova campanha — assistente IA</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Fluxo guiado com diagnóstico do seu nível e recomendações proativas antes de publicar.
          </p>
        </div>
        <Badge variant={nivel.variant} className="shrink-0">
          <Brain className="h-3 w-3 mr-1" />
          {nivel.label}
        </Badge>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            Etapa {step} de {STEPS.length}: {STEPS[step - 1]?.title}
          </span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} />
      </div>

      <Card className="p-5 border-border/60 min-h-[240px]">
        {step === 1 && (
          <div className="space-y-3">
            <Label>Objetivo principal</Label>
            <Select value={objective} onValueChange={(v) => setObjective(v as typeof objective)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead (captação)</SelectItem>
                <SelectItem value="sale">Venda / conversão</SelectItem>
                <SelectItem value="traffic">Tráfego / reconhecimento</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              A IA ajusta tom, estrutura de anúncios e métricas sugeridas conforme o objetivo.
            </p>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-3">
            <Label>Tipo de campanha</Label>
            <Select value={campaignType} onValueChange={setCampaignType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conversion">Conversões (Meta / PMax)</SelectItem>
                <SelectItem value="traffic">Tráfego / cliques</SelectItem>
                <SelectItem value="leadgen">Lead Ads / formulário nativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-3">
            <Label htmlFor="aud">Público-alvo</Label>
            <Textarea
              id="aud"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="Idade, interesses, intenção de compra, regiões..."
              className="min-h-24"
            />
          </div>
        )}
        {step === 4 && (
          <div className="space-y-3">
            <Label htmlFor="cr">Criativo (resumo ou link)</Label>
            <Textarea
              id="cr"
              value={creative}
              onChange={(e) => setCreative(e.target.value)}
              placeholder="Vídeo UGC, carrossel, oferta, prova social..."
              className="min-h-24"
            />
          </div>
        )}
        {step === 5 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Sugestões da IA (exemplo)
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                <li>Melhor tipo agora: campanha de conversão com teste A/B de criativo.</li>
                <li>Estrutura: 1 campanha → 2 conjuntos (interesse + remarketing) → 3 anúncios cada.</li>
                <li>Orçamento inicial sugerido: R$ 80–150/dia com aprendizado de 7 dias.</li>
              </ul>
              <Button type="button" size="sm" className="gap-1.5" onClick={runIa}>
                <Sparkles className="h-3.5 w-3.5" />
                Atualizar sugestões com IA
              </Button>
            </div>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="outline" size="sm" disabled={step <= 1} onClick={() => setStep((s) => Math.max(1, s - 1))} className="gap-1">
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={step >= STEPS.length}
          onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}
          className="gap-1"
        >
          Avançar
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
