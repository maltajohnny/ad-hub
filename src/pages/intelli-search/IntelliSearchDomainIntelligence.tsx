import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Globe2, Loader2, TrendingUp } from "lucide-react";
import { domainIntelligencePost } from "@/services/growthHubApi";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Report = {
  domain: string;
  estimatedMonthlyVisits: number;
  trafficShare: { organic: number; paid: number; social: number; referral: number };
  topKeywords: { keyword: string; volume: number }[];
  competitors: string[];
  monthlyHistory: { month: string; visits: number }[];
};

export default function IntelliSearchDomainIntelligence() {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async () => {
    const d = domain.trim();
    if (!d) {
      toast.error("Indique um domínio.");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const data = (await domainIntelligencePost(d)) as {
        ok?: boolean;
        report?: Report;
        message?: string;
        raw?: unknown;
        provider?: string;
      };
      if (data.raw && data.provider === "dataforseo") {
        toast.success("Dados DataForSEO recebidos (estrutura bruta no objeto).");
        setReport(null);
        setMsg("Resposta DataForSEO disponível em modo bruto — normalize no produto conforme docs.");
        return;
      }
      if (data.report) setReport(data.report);
      if (data.message) setMsg(data.message);
    } catch {
      toast.error("Erro na análise.");
    } finally {
      setLoading(false);
    }
  };

  const shareData = report
    ? [
        { name: "Orgânico", v: report.trafficShare.organic },
        { name: "Pago", v: report.trafficShare.paid },
        { name: "Social", v: report.trafficShare.social },
        { name: "Referral", v: report.trafficShare.referral },
      ]
    : [];

  return (
    <div className="space-y-6 animate-fade-in min-w-0 max-w-4xl">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Globe2 className="h-7 w-7 text-primary" />
          Inteligência de domínio
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Estimativa de tráfego, mix orgânico/pago/social, palavras-chave e concorrentes — DataForSEO ou SerpAPI quando
          configurados; caso contrário modo demonstração determinístico.
        </p>
      </div>

      <Card className="p-5 border-border/60 space-y-3">
        <Label>Domínio do cliente</Label>
        <div className="flex gap-2">
          <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="exemplo.com.br" />
          <Button type="button" onClick={() => void run()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analisar"}
          </Button>
        </div>
        {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
      </Card>

      {report ? (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <Card className="p-5 border-border/60">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                Visitas mensais (est.)
              </div>
              <p className="text-3xl font-bold tabular-nums">{report.estimatedMonthlyVisits.toLocaleString("pt-BR")}</p>
              <p className="text-xs text-muted-foreground mt-1">{report.domain}</p>
            </Card>
            <Card className="p-5 border-border/60">
              <p className="text-sm font-medium mb-2">Origem do tráfego (%)</p>
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={shareData}>
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="v" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-5 border-border/60">
            <h3 className="font-medium mb-3">Palavras-chave principais</h3>
            <ul className="space-y-2 text-sm">
              {report.topKeywords.map((k) => (
                <li key={k.keyword} className="flex justify-between border-b border-border/30 pb-2">
                  <span>{k.keyword}</span>
                  <span className="text-muted-foreground tabular-nums">vol. ~{k.volume}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5 border-border/60">
            <h3 className="font-medium mb-3">Concorrentes (referência)</h3>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {report.competitors.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </Card>

          <Card className="p-5 border-border/60">
            <h3 className="font-medium mb-3">Histórico mensal (demo)</h3>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.monthlyHistory}>
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="visits" fill="hsl(230, 60%, 55%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
