import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Link2, Loader2, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { leadsGet, leadsPost } from "@/services/growthHubApi";

type Lead = {
  id: string;
  name: string;
  email: string;
  source: string;
  createdAt: string;
};

export default function LeadsCenterPage() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<{
    buckets?: { organic: number; paid: number; prospecting: number };
    bySource?: Record<string, number>;
  }>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("organic");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await leadsGet()) as {
        leads?: Lead[];
        stats?: { buckets: { organic: number; paid: number; prospecting: number }; bySource: Record<string, number> };
      };
      setLeads(data.leads ?? []);
      setStats(data.stats ?? {});
    } catch {
      toast.error("Erro ao carregar leads.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ingest = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Preencha nome e e-mail.");
      return;
    }
    try {
      await leadsPost({ action: "ingest", name: name.trim(), email: email.trim(), source });
      toast.success("Lead registado.");
      setName("");
      setEmail("");
      void load();
    } catch {
      toast.error("Erro ao registar.");
    }
  };

  const seed = async () => {
    try {
      await leadsPost({ action: "seedDemo" });
      void load();
    } catch {
      toast.error("Erro.");
    }
  };

  const b = stats.buckets ?? { organic: 0, paid: 0, prospecting: 0 };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Users className="h-7 w-7 text-primary" />
          Centro de leads
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Agrega leads de agendamento, automação, prospecção e formulários — ligado aos restantes módulos.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Card className="p-4 border-border/60">
          <p className="text-xs text-muted-foreground">Orgânico + formulários</p>
          <p className="text-2xl font-bold">{b.organic}</p>
        </Card>
        <Card className="p-4 border-border/60">
          <p className="text-xs text-muted-foreground">Pago + campanhas</p>
          <p className="text-2xl font-bold">{b.paid}</p>
        </Card>
        <Card className="p-4 border-border/60">
          <p className="text-xs text-muted-foreground">Prospecção + agendamento + automação</p>
          <p className="text-2xl font-bold">{b.prospecting}</p>
        </Card>
      </div>

      <Card className="p-5 border-border/60 space-y-3">
        <h3 className="font-medium">Registar lead manualmente</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Origem</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="organic">Orgânico</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="prospecting">Prospecção</SelectItem>
                <SelectItem value="scheduling">Agendamento</SelectItem>
                <SelectItem value="form">Formulário</SelectItem>
                <SelectItem value="campaign">Campanha</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void ingest()}>
            Guardar
          </Button>
          <Button type="button" variant="secondary" onClick={() => void seed()}>
            Carregar demo
          </Button>
        </div>
      </Card>

      <Card className="p-5 border-border/60">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="font-medium">Últimos leads</h3>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link className="text-primary underline-offset-4 hover:underline inline-flex items-center gap-1" to="/campanhas/leads">
              <Link2 className="h-3 w-3" />
              Campanhas · formulários
            </Link>
            <Link className="text-primary underline-offset-4 hover:underline" to="/scheduling">
              Agendamento
            </Link>
            <Link className="text-primary underline-offset-4 hover:underline" to="/automation">
              Automação
            </Link>
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2">Quando</th>
                  <th className="py-2">Nome</th>
                  <th className="py-2">E-mail</th>
                  <th className="py-2">Origem</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-border/30">
                    <td className="py-2 whitespace-nowrap">{new Date(l.createdAt).toLocaleString("pt-BR")}</td>
                    <td className="py-2">{l.name}</td>
                    <td className="py-2 font-mono text-xs">{l.email}</td>
                    <td className="py-2">{l.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {leads.length === 0 ? <p className="text-sm text-muted-foreground py-4">Sem leads ainda.</p> : null}
          </div>
        )}
      </Card>
    </div>
  );
}
