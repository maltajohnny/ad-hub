import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { FlaskConical, Lightbulb, BarChart3, Shuffle } from "lucide-react";

const SUGGESTIONS = [
  "Testar headline A (benefício) vs B (urgência) na mesma imagem.",
  "Duplicar conjunto com público lookalike 1% vs interesse amplo.",
  "Oferta: frete grátis vs desconto percentual — medir CPL.",
];

const REPORTS = [
  { test: "Criativo — vídeo UGC vs estático", winner: "Vídeo UGC", lift: "+18% CTR", learning: "Priorizar prova social nos primeiros 3s." },
  { test: "Público — remarketing 30d vs 90d", winner: "30 dias", lift: "-12% CPA", learning: "Janela curta converte mais rápido neste nicho." },
];

export default function Experimentacao() {
  const [variant, setVariant] = useState<"creative" | "audience" | "offer">("creative");

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <FlaskConical className="h-7 w-7 text-primary" />
          Laboratório de experimentação
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          A/B tests, sugestões automáticas e relatórios de aprendizado — tudo no mesmo fluxo de tráfego pago.
        </p>
      </div>

      <Tabs defaultValue="ab" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="ab" className="gap-1.5">
            <Shuffle className="h-3.5 w-3.5" />
            A/B test
          </TabsTrigger>
          <TabsTrigger value="sugestoes" className="gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" />
            Sugestões
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Aprendizados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ab" className="space-y-4">
          <Card className="p-5 border-border/60 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>O que testar</Label>
                <Select value={variant} onValueChange={(v) => setVariant(v as typeof variant)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="creative">Criativos</SelectItem>
                    <SelectItem value="audience">Públicos</SelectItem>
                    <SelectItem value="offer">Ofertas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Campanha base (demo)</Label>
                <Select defaultValue="1">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Black Friday - Conversão</SelectItem>
                    <SelectItem value="2">Brand Awareness Q2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground">
              Variante A e B serão criadas como duplicatas com etiqueta de teste; métricas unificadas no painel quando a API
              das redes estiver ligada.
            </div>
            <Button type="button" onClick={() => toast.success("Experimento registado na fila (estrutura front-end).")}>
              Iniciar teste
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="sugestoes" className="space-y-3">
          <Card className="p-5 border-border/60">
            <p className="text-sm font-medium mb-3">Sugestões automáticas com base no histórico (demo)</p>
            <ul className="space-y-2">
              {SUGGESTIONS.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline" className="shrink-0 h-6">
                    {i + 1}
                  </Badge>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
            <Button type="button" variant="secondary" className="mt-4" size="sm" onClick={() => toast.message("Novas sugestões geradas (simulação).")}>
              Gerar mais ideias
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="relatorios" className="space-y-3">
          {REPORTS.map((r, i) => (
            <Card key={i} className="p-4 border-border/60">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="font-medium text-sm">{r.test}</p>
                <Badge variant="secondary">Vencedor: {r.winner}</Badge>
              </div>
              <p className="text-xs text-primary font-medium">{r.lift}</p>
              <p className="text-sm text-muted-foreground mt-2">{r.learning}</p>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
