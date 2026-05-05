import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchInsightHubPosts, type RangeLabel, type InsightHubPost } from "@/lib/insightHubApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { InsightHubBrandSelector, RangePicker } from "@/pages/insight-hub/InsightHubBrandSelector";
import { ImageIcon, ExternalLink, RefreshCw } from "lucide-react";

const SORT_OPTIONS = [
  { value: "published_at", label: "Data publicada" },
  { value: "engagement", label: "Engajamento" },
  { value: "reach", label: "Alcance" },
  { value: "impressions", label: "Impressões" },
  { value: "likes", label: "Reações" },
];

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return Math.round(n).toString();
}

export default function InsightHubPosts() {
  const [brandId, setBrandId] = useState<string | null>(null);
  const [range, setRange] = useState<RangeLabel>("30d");
  const [sortBy, setSortBy] = useState<string>("published_at");
  const [page, setPage] = useState(0);
  const limit = 12;

  const q = useQuery({
    queryKey: ["insight-hub", "posts", brandId, range, sortBy, page],
    queryFn: () =>
      fetchInsightHubPosts(brandId as string, {
        range,
        sortBy,
        sortDir: sortBy === "published_at" ? "desc" : "desc",
        limit,
        offset: page * limit,
      }),
    enabled: !!brandId,
  });

  const total = q.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Posts</h1>
          <p className="text-sm text-muted-foreground">Conteúdos sincronizados com métricas por publicação.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <InsightHubBrandSelector value={brandId} onChange={setBrandId} />
          <RangePicker value={range} onChange={setRange} />
          <div className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">Ordenar por</span>
            <Select value={sortBy} onValueChange={(v) => { setPage(0); setSortBy(v); }}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {!brandId ? null : q.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" /> A carregar posts…
        </div>
      ) : q.isError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base">Erro ao listar posts</CardTitle>
            <CardDescription>{(q.error as Error)?.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : !q.data?.posts.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nenhum post sincronizado</CardTitle>
            <CardDescription>
              Verifique se há conexão Facebook/Instagram ativa e aguarde o próximo ciclo do scheduler (1–10 min).
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {q.data.posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {total} posts · página {page + 1}/{pages}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Anterior
              </Button>
              <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PostCard({ post }: { post: InsightHubPost }) {
  const date = post.publishedAt ? new Date(post.publishedAt).toLocaleString() : "—";
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-video w-full bg-muted">
        {post.thumbnailUrl || post.mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.thumbnailUrl || post.mediaUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-8 w-8" aria-hidden />
          </div>
        )}
        {post.permalink ? (
          <a
            href={post.permalink}
            target="_blank"
            rel="noreferrer"
            className="absolute right-2 top-2 rounded-md bg-background/80 p-1 text-xs hover:bg-background"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : null}
      </div>
      <CardContent className="space-y-2 pt-3">
        <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
          <Badge variant="secondary" className="text-[10px]">
            {post.provider}
          </Badge>
          {post.mediaType ? <span>· {post.mediaType}</span> : null}
          <span>· {date}</span>
        </div>
        {post.message ? (
          <p className="line-clamp-3 text-xs text-foreground/90">{post.message}</p>
        ) : (
          <p className="text-xs italic text-muted-foreground">Sem texto</p>
        )}
        <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
          <Metric label="Alcance" value={post.reach} />
          <Metric label="Engaj." value={post.engagement} />
          <Metric label="Impr." value={post.impressions} />
          <Metric label="Reações" value={post.likes} />
          <Metric label="Coment." value={post.comments} />
          <Metric label="Vídeos" value={post.videoViews} />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/40 bg-card/40 p-1.5 text-center">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{fmt(value)}</p>
    </div>
  );
}
