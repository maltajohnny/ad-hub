import { useState } from "react";
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
import { Bookmark, Loader2, Megaphone } from "lucide-react";
import { adsLibraryPost } from "@/services/growthHubApi";

type AdRow = {
  id: string;
  pageName: string;
  headline: string;
  body: string;
  creativeUrl: string | null;
  isActive: boolean;
};

export default function CampanhasBibliotecaAnuncios() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<"keyword" | "advertiser">("keyword");
  const [loading, setLoading] = useState(false);
  const [ads, setAds] = useState<AdRow[]>([]);
  const [saved, setSaved] = useState<AdRow[]>([]);
  const [hint, setHint] = useState<string | null>(null);

  const search = async () => {
    if (!query.trim()) {
      toast.error("Indique palavra-chave ou nome.");
      return;
    }
    setLoading(true);
    setHint(null);
    try {
      const data = (await adsLibraryPost(query.trim(), searchType)) as {
        ok?: boolean;
        ads?: AdRow[];
        message?: string;
      };
      setAds(data.ads ?? []);
      if (data.message) setHint(data.message);
    } catch {
      toast.error("Erro na pesquisa.");
    } finally {
      setLoading(false);
    }
  };

  const saveRef = (a: AdRow) => {
    setSaved((prev) => (prev.some((x) => x.id === a.id) ? prev : [...prev, a]));
    toast.success("Guardado como referência (sessão).");
  };

  return (
    <div className="space-y-6 animate-fade-in min-w-0">
      <div>
        <h2 className="text-xl font-display font-bold flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          Biblioteca de anúncios
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Pesquisa na Meta Ads Library (token Graph) ou modo demonstração. Use para inspiração criativa e referências.
        </p>
      </div>

      <Card className="p-5 border-border/60 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Buscar por</Label>
            <Select value={searchType} onValueChange={(v) => setSearchType(v as "keyword" | "advertiser")}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keyword">Palavra-chave</SelectItem>
                <SelectItem value="advertiser">Nome / página (quando API permitir)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Termo</Label>
            <div className="flex gap-2 mt-1">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="marca, oferta, nicho…" />
              <Button type="button" onClick={() => void search()} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
              </Button>
            </div>
          </div>
        </div>
        {hint ? <p className="text-xs text-amber-700 dark:text-amber-300">{hint}</p> : null}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {ads.map((a) => (
          <Card key={a.id} className="p-4 border-border/60 space-y-2">
            <div className="flex justify-between gap-2 items-start">
              <div>
                <p className="text-xs text-muted-foreground">{a.pageName}</p>
                <p className="font-medium">{a.headline}</p>
              </div>
              <span
                className={`text-[10px] uppercase px-2 py-0.5 rounded-full ${a.isActive ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted"}`}
              >
                {a.isActive ? "Ativo" : "Inativo"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-4">{a.body}</p>
            {a.creativeUrl ? (
              <a href={a.creativeUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                Ver criativo (snapshot)
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">Sem URL de criativo (demo)</p>
            )}
            <Button type="button" size="sm" variant="secondary" className="gap-1" onClick={() => saveRef(a)}>
              <Bookmark className="h-3.5 w-3.5" />
              Salvar referência
            </Button>
          </Card>
        ))}
      </div>

      {saved.length > 0 ? (
        <Card className="p-5 border-border/60 border-dashed">
          <h3 className="font-medium mb-2">Referências guardadas (sessão)</h3>
          <ul className="text-sm space-y-1">
            {saved.map((s) => (
              <li key={s.id}>
                {s.pageName} — {s.headline.slice(0, 60)}…
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
