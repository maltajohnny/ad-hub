import { loadIntelliSearchHistory } from "@/lib/intellisearchHistory";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function IntelliSearchHistoryPage() {
  const rows = loadIntelliSearchHistory();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Histórico de análises</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Pesquisas IntelliSearch neste navegador (armazenamento local). Limpe o histórico do site para apagar.
        </p>
      </div>

      <Card className="border-border/60 max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">Registos</CardTitle>
          <CardDescription>Mais recentes primeiro</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há análises. Execute uma pesquisa em Análise completa ou noutras secções.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Data</th>
                    <th className="pb-2 pr-4 font-medium">Pesquisa</th>
                    <th className="pb-2 pr-4 font-medium">Nome</th>
                    <th className="pb-2 font-medium">Pontuação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.at}-${i}`} className="border-b border-border/40">
                      <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                        {new Date(r.at).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-2 pr-4 max-w-[200px] truncate" title={r.query}>
                        {r.query}
                      </td>
                      <td className="py-2 pr-4 max-w-[180px] truncate">{r.name ?? "—"}</td>
                      <td className="py-2 tabular-nums font-medium">{r.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
