import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Globe, Search, Swords, Megaphone } from "lucide-react";

const KEYWORDS = ["marca + cidade", "serviço + perto de mim", "melhor + categoria", "preço + produto"];

export default function IntelliSearchBusinessOverview() {
  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-display font-bold">Visão do negócio (avançado)</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Consolida presença no Google, concorrência e palavras-chave para orientar campanhas de busca e performance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5 border-border/60 space-y-2">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Presença no Google</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Perfil de empresa, avaliações e consistência NAP — base para anúncios locais e Performance Max com local.
          </p>
          <Badge variant="outline">Score estimado: 82/100 (demo)</Badge>
        </Card>
        <Card className="p-5 border-border/60 space-y-2">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-amber-500" />
            <h2 className="font-semibold">Concorrência</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Identifique sobreposição de leilão e mensagens fortes no SERP para diferenciar ofertas e criativos.
          </p>
          <Badge variant="secondary">3 competidores diretos mapeados (demo)</Badge>
        </Card>
      </div>

      <Card className="p-5 border-border/60">
        <div className="flex items-center gap-2 mb-3">
          <Search className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Palavras-chave estratégicas</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {KEYWORDS.map((k) => (
            <Badge key={k} variant="secondary">
              {k}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Em produção, cruze com o módulo de keywords e relatórios do IntelliSearch para priorizar investimento.
        </p>
      </Card>

      <Card className="p-5 border-primary/25 bg-primary/[0.03]">
        <div className="flex items-center gap-2 mb-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Sugestões de campanha por nicho</h2>
        </div>
        <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
          <li>Search: capturar intenção alta com anúncios RSA alinhados às páginas de destino.</li>
          <li>PMax: alimentar criativos e sinais de público a partir desta visão unificada.</li>
          <li>Remarketing: mensagens de prova social para quem visitou o site mas não converteu.</li>
        </ul>
        <Button type="button" className="mt-4" size="sm" asChild>
          <Link to="/campanhas/nova-campanha">Abrir assistente de campanha</Link>
        </Button>
      </Card>
    </div>
  );
}
