import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, TrendingUp, DollarSign, BarChart3 } from "lucide-react";
import { useState } from "react";

const clientsData = [
  { id: 1, name: "TechFlow Solutions", segment: "SaaS", spend: "R$ 18.500", roi: "4.2x", status: "Ativo", platforms: ["Meta", "Google"] },
  { id: 2, name: "Bella Cosmetics", segment: "E-commerce", spend: "R$ 12.300", roi: "3.8x", status: "Ativo", platforms: ["Instagram", "Meta"] },
  { id: 3, name: "AutoPrime Veículos", segment: "Automotivo", spend: "R$ 25.000", roi: "2.9x", status: "Ativo", platforms: ["Google", "Meta"] },
  { id: 4, name: "FitLife Academia", segment: "Fitness", spend: "R$ 5.800", roi: "5.1x", status: "Ativo", platforms: ["Instagram"] },
  { id: 5, name: "Gourmet Express", segment: "Food Delivery", spend: "R$ 8.200", roi: "3.5x", status: "Pausado", platforms: ["Meta", "Instagram"] },
  { id: 6, name: "EduSmart Cursos", segment: "Educação", spend: "R$ 15.700", roi: "4.6x", status: "Ativo", platforms: ["Google", "Meta", "Instagram"] },
  { id: 7, name: "Habitat Imóveis", segment: "Imobiliário", spend: "R$ 22.400", roi: "2.7x", status: "Ativo", platforms: ["Google", "Meta"] },
  { id: 8, name: "PetHappy Store", segment: "Pet Shop", spend: "R$ 6.900", roi: "4.0x", status: "Ativo", platforms: ["Instagram", "Meta"] },
];

const Clientes = () => {
  const [search, setSearch] = useState("");
  const filtered = clientsData.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-1">{clientsData.length} clientes cadastrados</p>
        </div>
        <div className="relative w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary/50 border-border/50"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((client) => (
          <Card key={client.id} className="glass-card p-5 hover:glow-primary transition-all cursor-pointer group">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-display font-semibold text-sm group-hover:gradient-brand-text transition-colors">
                  {client.name}
                </h3>
                <span className="text-xs text-muted-foreground">{client.segment}</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${client.status === "Ativo" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                {client.status}
              </span>
            </div>

            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2 text-sm">
                <DollarSign size={14} className="text-primary" />
                <span className="text-muted-foreground">Investimento:</span>
                <span className="font-medium ml-auto">{client.spend}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp size={14} className="text-success" />
                <span className="text-muted-foreground">ROI:</span>
                <span className="font-medium ml-auto">{client.roi}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <BarChart3 size={14} className="text-accent" />
                <span className="text-muted-foreground">Plataformas:</span>
              </div>
            </div>

            <div className="flex gap-1.5 flex-wrap">
              {client.platforms.map((p) => (
                <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  {p}
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Clientes;
