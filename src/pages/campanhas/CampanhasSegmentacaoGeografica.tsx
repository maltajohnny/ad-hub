import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MapPin, Pencil, Radio, Layers } from "lucide-react";

/** UI para segmentação geográfica avançada. Mapa real: configure VITE_GOOGLE_MAPS_API_KEY e carregue @react-google-maps/api. */
export default function CampanhasSegmentacaoGeografica() {
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [brushActive, setBrushActive] = useState(false);
  const [mockRadii, setMockRadii] = useState<{ id: string; km: number; lat: number; lng: number }[]>([
    { id: "1", km: 5, lat: -23.55, lng: -46.63 },
    { id: "2", km: 3, lat: -23.56, lng: -46.64 },
  ]);

  const handleGerarRaios = () => {
    toast.success("Polígono convertido em clusters de raio compatíveis com Meta / Google / TikTok (simulação).");
    setMockRadii((prev) => [
      ...prev,
      { id: crypto.randomUUID(), km: 2 + Math.round(Math.random() * 8), lat: -23.55, lng: -46.63 },
    ]);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Segmentação geográfica avançada</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Desenhe áreas personalizadas; o sistema converte automaticamente em raios ou clusters aceitos pelas APIs de anúncios.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden border-border/60 p-0">
          <div className="relative aspect-[16/10] min-h-[220px] bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-primary/20">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
              <MapPin className="h-10 w-10 text-primary/90" />
              <p className="text-sm font-medium text-white">Mapa interativo</p>
              <p className="text-xs text-white/70 max-w-md">
                Integração Google Maps: defina <code className="rounded bg-white/10 px-1">VITE_GOOGLE_MAPS_API_KEY</code> para
                carregar o mapa com overlay semi-transparente, hover em regiões e seleção por clique.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                <Badge variant="secondary" className="bg-white/15 text-white border-0">
                  Hover: destaque de região
                </Badge>
                <Badge variant="secondary" className="bg-white/15 text-white border-0">
                  Clique: estado / cidade / bairro
                </Badge>
              </div>
            </div>
            {brushActive ? (
              <div className="absolute bottom-3 left-3 right-3 rounded-lg border border-primary/40 bg-primary/20 px-3 py-2 text-xs text-white">
                Modo desenho livre ativo — ao soltar, o polígono será convertido em raios.
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border/50 p-3 bg-secondary/20">
            <Button
              type="button"
              size="sm"
              variant={brushActive ? "default" : "outline"}
              className="gap-1.5"
              onClick={() => setBrushActive((v) => !v)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Desenho livre (brush)
            </Button>
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={handleGerarRaios}>
              <Radio className="h-3.5 w-3.5" />
              Converter polígono → raios
            </Button>
          </div>
        </Card>

        <Card className="p-4 space-y-3 border-border/60 h-fit">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seleção rápida</p>
          <Tabs defaultValue="cep">
            <TabsList className="grid w-full grid-cols-3 h-auto gap-1">
              <TabsTrigger value="admin" className="text-xs">
                Região
              </TabsTrigger>
              <TabsTrigger value="cep" className="text-xs">
                CEP
              </TabsTrigger>
              <TabsTrigger value="addr" className="text-xs">
                Endereço
              </TabsTrigger>
            </TabsList>
            <TabsContent value="admin" className="mt-3 space-y-2">
              <Label>Estado / cidade / bairro</Label>
              <Input placeholder="Ex.: SP — São Paulo — Pinheiros" />
              <Button type="button" size="sm" className="w-full" onClick={() => toast.message("Região adicionada ao alvo (demo).")}>
                Adicionar região
              </Button>
            </TabsContent>
            <TabsContent value="cep" className="mt-3 space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <Input id="cep" value={cep} onChange={(e) => setCep(e.target.value)} placeholder="01310-100" />
              <Button type="button" size="sm" className="w-full" onClick={() => toast.message(`CEP ${cep || "—"} mapeado para raio (demo).`)}>
                Incluir por CEP
              </Button>
            </TabsContent>
            <TabsContent value="addr" className="mt-3 space-y-2">
              <Label htmlFor="addr">Endereço completo</Label>
              <Input id="addr" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Av. Paulista, 1000" />
              <Button type="button" size="sm" className="w-full" onClick={() => toast.message("Geocodificado — raio sugerido 5 km (demo).")}>
                Geocodificar
              </Button>
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      <Card className="p-4 border-border/60">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Compatibilidade com plataformas</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Polígonos personalizados são decompostos em múltiplos pontos com raio (ex.: 3–15 km) ou clusters, alinhados ao que Meta Ads,
          Google Ads e TikTok aceitam na API.
        </p>
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-secondary/40">
              <tr>
                <th className="text-left p-2 font-medium">Raio (km)</th>
                <th className="text-left p-2 font-medium">Lat</th>
                <th className="text-left p-2 font-medium">Lng</th>
                <th className="text-left p-2 font-medium">Destino API</th>
              </tr>
            </thead>
            <tbody>
              {mockRadii.map((r) => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="p-2 tabular-nums">{r.km}</td>
                  <td className="p-2 tabular-nums">{r.lat.toFixed(2)}</td>
                  <td className="p-2 tabular-nums">{r.lng.toFixed(2)}</td>
                  <td className="p-2 text-muted-foreground">Location targeting</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
