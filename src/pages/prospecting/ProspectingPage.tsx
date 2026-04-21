import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Building2, Instagram, Loader2, MapPin, Search } from "lucide-react";
import { prospectingPost } from "@/services/growthHubApi";

type Prospect = { id: string; name: string; title: string; email: string };

export default function ProspectingPage() {
  const [domain, setDomain] = useState("");
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapsQ, setMapsQ] = useState("agência performance");
  const [mapsLoc, setMapsLoc] = useState("São Paulo, BR");
  const [places, setPlaces] = useState<{ name: string; address: string; phone: string }[]>([]);
  const [ig, setIg] = useState("");
  const [followers, setFollowers] = useState<{ handle: string; name: string }[]>([]);
  const [lists, setLists] = useState<{ id: string; name: string }[]>([]);

  const loadLists = useCallback(async () => {
    try {
      const data = (await prospectingPost({ action: "lists" })) as {
        lists?: { id: string; name: string }[];
      };
      setLists(data.lists ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  const searchDomain = async () => {
    setLoading(true);
    try {
      const data = (await prospectingPost({ action: "domainEmails", domain })) as {
        ok?: boolean;
        prospects?: Prospect[];
        message?: string;
      };
      setProspects(data.prospects ?? []);
      if (data.message) toast.message(data.message);
    } catch {
      toast.error("Erro na pesquisa.");
    } finally {
      setLoading(false);
    }
  };

  const searchMaps = async () => {
    setLoading(true);
    try {
      const data = (await prospectingPost({
        action: "mapsPlaces",
        query: mapsQ,
        location: mapsLoc,
      })) as { results?: { name: string; address: string; phone: string }[]; message?: string };
      setPlaces(data.results ?? []);
      if (data.message) toast.message(data.message);
    } catch {
      toast.error("Erro Maps.");
    } finally {
      setLoading(false);
    }
  };

  const searchIg = async () => {
    setLoading(true);
    try {
      const data = (await prospectingPost({ action: "instagramFollowers", profile: ig })) as {
        followers?: { handle: string; name: string }[];
        message?: string;
      };
      setFollowers(data.followers ?? []);
      if (data.message) toast.message(data.message);
    } catch {
      toast.error("Erro Instagram.");
    } finally {
      setLoading(false);
    }
  };

  const saveLead = async (name: string, email: string) => {
    try {
      await prospectingPost({ action: "saveToLeads", name, email });
      toast.success("Lead enviado ao centro de leads.");
    } catch {
      toast.error("Erro ao guardar.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Search className="h-7 w-7 text-primary" />
          Prospecção
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          E-mails por domínio (Hunter/Clearbit), empresas via Google Places e lista demo de seguidores Instagram.
        </p>
      </div>

      <Tabs defaultValue="email" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="email">E-mails</TabsTrigger>
          <TabsTrigger value="maps">Google Maps</TabsTrigger>
          <TabsTrigger value="instagram">Instagram</TabsTrigger>
          <TabsTrigger value="lists">Listas</TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-4 space-y-4">
          <Card className="p-5 border-border/60 space-y-3">
            <Label>Dominio (ex.: empresa.com)</Label>
            <div className="flex gap-2">
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="empresa.com" />
              <Button type="button" onClick={() => void searchDomain()} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2">Nome</th>
                    <th className="py-2">Cargo</th>
                    <th className="py-2">E-mail</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {prospects.map((p) => (
                    <tr key={p.id} className="border-b border-border/30">
                      <td className="py-2">{p.name}</td>
                      <td className="py-2">{p.title}</td>
                      <td className="py-2 font-mono text-xs">{p.email}</td>
                      <td className="py-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => void saveLead(p.name, p.email)}>
                          → Leads
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="maps" className="mt-4">
          <Card className="p-5 border-border/60 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-4 w-4" />
              Empresas por nicho e localização
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Nicho / termo</Label>
                <Input value={mapsQ} onChange={(e) => setMapsQ(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Localização</Label>
                <Input value={mapsLoc} onChange={(e) => setMapsLoc(e.target.value)} className="mt-1" />
              </div>
            </div>
            <Button type="button" onClick={() => void searchMaps()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pesquisar"}
            </Button>
            <ul className="space-y-2 text-sm">
              {places.map((p) => (
                <li key={p.name + p.address} className="border-b border-border/40 pb-2">
                  <Building2 className="inline h-4 w-4 mr-1 text-muted-foreground" />
                  <span className="font-medium">{p.name}</span>
                  <div className="text-muted-foreground text-xs">{p.address}</div>
                  <div className="text-xs">{p.phone}</div>
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="instagram" className="mt-4">
          <Card className="p-5 border-border/60 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Instagram className="h-4 w-4" />
              Seguidores (demo)
            </div>
            <div className="flex gap-2">
              <Input value={ig} onChange={(e) => setIg(e.target.value)} placeholder="@perfil ou handle" />
              <Button type="button" onClick={() => void searchIg()} disabled={loading}>
                Carregar
              </Button>
            </div>
            <ul className="grid sm:grid-cols-2 gap-2 text-sm">
              {followers.map((f) => (
                <li key={f.handle} className="rounded-md border border-border/50 px-3 py-2">
                  <span className="font-medium">{f.handle}</span>
                  <div className="text-xs text-muted-foreground">{f.name}</div>
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="lists" className="mt-4">
          <Card className="p-5 border-border/60 space-y-3">
            <p className="text-sm text-muted-foreground">
              Listas guardadas no armazenamento da função (substituir por Postgres em produção).
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                try {
                  await prospectingPost({ action: "createList", name: `Lista ${new Date().toLocaleDateString("pt-BR")}` });
                  toast.success("Lista criada.");
                  void loadLists();
                } catch {
                  toast.error("Erro.");
                }
              }}
            >
              Nova lista
            </Button>
            <ul className="text-sm space-y-1">
              {lists.map((l) => (
                <li key={l.id}>{l.name}</li>
              ))}
            </ul>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
