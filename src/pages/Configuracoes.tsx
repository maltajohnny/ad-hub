import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Link2, Webhook } from "lucide-react";

const integrations = [
  { name: "Meta Ads", connected: true, desc: "Facebook & Instagram Ads Manager" },
  { name: "Google Ads", connected: true, desc: "Search, Display & YouTube Ads" },
  { name: "Instagram", connected: false, desc: "Instagram Business API" },
];

const Configuracoes = () => (
  <div className="space-y-6 animate-fade-in max-w-2xl">
    <div>
      <h1 className="text-2xl font-display font-bold">Configurações</h1>
      <p className="text-muted-foreground text-sm mt-1">Integrações e preferências</p>
    </div>

    <Card className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Webhook size={18} className="text-primary" />
        <h3 className="font-display font-semibold">Integrações de Plataformas</h3>
      </div>
      <div className="space-y-3">
        {integrations.map((int) => (
          <div key={int.name} className="flex items-center justify-between bg-secondary/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Link2 size={16} className={int.connected ? "text-primary" : "text-muted-foreground"} />
              <div>
                <p className="text-sm font-medium">{int.name}</p>
                <p className="text-xs text-muted-foreground">{int.desc}</p>
              </div>
            </div>
            <Switch checked={int.connected} />
          </div>
        ))}
      </div>
    </Card>
  </div>
);

export default Configuracoes;
