import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, AlertCircle } from "lucide-react";
import { fetchOrganicRank } from "@/lib/intellisearchApi";

export default function IntelliSearchRankingPage() {
  const [keyword, setKeyword] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof fetchOrganicRank>> | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await fetchOrganicRank(keyword.trim(), domain.trim());
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Análise de ranking</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Posição aproximada do seu domínio nos resultados orgânicos Google para uma palavra-chave (SerpAPI, até 100
          resultados).
        </p>
      </div>

      <Card className="border-border/60 max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Consulta</CardTitle>
          <CardDescription>Palavra-chave de pesquisa e domínio do site (sem https://)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="rank-kw">
              Palavra-chave
            </label>
            <Input
              id="rank-kw"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Ex.: marketing digital curitiba"
              className="h-10"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void run())}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="rank-dom">
              Domínio
            </label>
            <Input
              id="rank-dom"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="exemplo.com.br"
              className="h-10"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void run())}
            />
          </div>
          <Button type="button" className="gap-2" disabled={loading || !keyword.trim() || !domain.trim()} onClick={() => void run()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Ver posição
          </Button>
        </CardContent>
      </Card>

      {error ? (
        <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive max-w-xl">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      {result ? (
        <Card className="border-border/60 max-w-xl">
          <CardHeader>
            <CardTitle className="text-base">Resultado</CardTitle>
            <CardDescription>
              {result.keyword} · {result.domain}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {result.demo && result.message ? (
              <p className="text-amber-600 dark:text-amber-400">{result.message}</p>
            ) : null}
            <p>
              <strong>Posição orgânica:</strong>{" "}
              {result.position != null ? (
                <span className="font-display text-2xl font-bold tabular-nums">{result.position}</span>
              ) : (
                <span className="text-muted-foreground">Não encontrado nos primeiros {result.checked} resultados.</span>
              )}
            </p>
            <p className="text-muted-foreground">Resultados analisados: {result.checked}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
