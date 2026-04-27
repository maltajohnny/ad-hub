import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Pause, Play, Eye } from "lucide-react";

const campaigns = [
  { id: 1, name: "Black Friday - Conversão", platform: "Meta Ads", status: "Ativa", budget: "R$ 5.000/dia", spent: "R$ 82.400", impressions: "1.2M", clicks: "34.200", conversions: 892, cpa: "R$ 92,38", roi: "3.8x" },
  { id: 2, name: "Brand Awareness Q2", platform: "Google Ads", status: "Ativa", budget: "R$ 3.200/dia", spent: "R$ 54.100", impressions: "890K", clicks: "21.800", conversions: 456, cpa: "R$ 118,64", roi: "2.9x" },
  { id: 3, name: "Reels Engajamento", platform: "Instagram", status: "Ativa", budget: "R$ 1.800/dia", spent: "R$ 28.600", impressions: "650K", clicks: "18.900", conversions: 312, cpa: "R$ 91,67", roi: "4.1x" },
  { id: 4, name: "Remarketing Carrinho", platform: "Meta Ads", status: "Pausada", budget: "R$ 2.500/dia", spent: "R$ 41.200", impressions: "520K", clicks: "15.600", conversions: 234, cpa: "R$ 176,07", roi: "1.8x" },
  { id: 5, name: "Search - Produto Principal", platform: "Google Ads", status: "Ativa", budget: "R$ 4.100/dia", spent: "R$ 67.800", impressions: "340K", clicks: "28.400", conversions: 678, cpa: "R$ 100,00", roi: "3.4x" },
];

const Campanhas = () => (
  <div className="space-y-6 animate-fade-in">
    <div>
      <h1 className="text-2xl font-display font-bold">Campanhas</h1>
      <p className="text-muted-foreground text-sm mt-1">Gerenciamento e performance de campanhas</p>
    </div>

    <div className="space-y-3">
      {campaigns.map((c) => (
        <Card key={c.id} className="glass-card p-5 hover:glow-primary transition-shadow">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-display font-semibold text-sm truncate">{c.name}</h3>
                <Badge variant={c.status === "Ativa" ? "default" : "secondary"} className={c.status === "Ativa" ? "gradient-brand text-primary-foreground text-[10px]" : "text-[10px]"}>
                  {c.status}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">{c.platform} • {c.budget}</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Gasto</p>
                <p className="text-sm font-semibold">{c.spent}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cliques</p>
                <p className="text-sm font-semibold">{c.clicks}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Conversões</p>
                <p className="text-sm font-semibold">{c.conversions}</p>
              </div>
              <div className="hidden sm:block">
                <p className="text-xs text-muted-foreground">CPA</p>
                <p className="text-sm font-semibold">{c.cpa}</p>
              </div>
              <div className="hidden sm:block">
                <p className="text-xs text-muted-foreground">ROI</p>
                <p className="text-sm font-semibold text-primary">{c.roi}</p>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  </div>
);

export default Campanhas;
