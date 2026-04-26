import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { UserResolverService } from "@/social-analytics/services/UserResolverService";
import { DataCollectorService } from "@/social-analytics/services/DataCollectorService";
import { socialAnalyticsStore } from "@/social-analytics/storage/socialAnalyticsStore";
import { SchedulerService } from "@/social-analytics/services/SchedulerService";
import type { SocialAnalyticsProfile } from "@/social-analytics/types";

export function SocialAnalyticsPanel({
  tenantId,
  instagramGraphToken,
}: {
  tenantId: string;
  instagramGraphToken?: string;
}) {
  const [query, setQuery] = useState("");
  const [version, setVersion] = useState(0);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  void version;
  const profiles = socialAnalyticsStore.listProfiles(tenantId);
  const selected = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) ?? profiles[0] ?? null,
    [profiles, selectedProfileId],
  );
  const history = useMemo(() => (selected ? socialAnalyticsStore.history(selected.id) : []), [selected]);
  const metric = useMemo(
    () => (selected ? socialAnalyticsStore.metrics(selected.id) : null),
    [selected],
  );
  const rankingTenant = socialAnalyticsStore.rankByTenant(tenantId).slice(0, 10);
  const rankingGlobal = socialAnalyticsStore.rankGlobal().slice(0, 10);

  const createAndCollect = async () => {
    const r = UserResolverService.resolve(query);
    if (!r) {
      toast.error("Não foi possível resolver a entrada. Use @usuario ou URL.");
      return;
    }
    const profile: SocialAnalyticsProfile = {
      id: crypto.randomUUID(),
      tenantId,
      platform: r.platform,
      username: r.username,
      displayName: `@${r.username}`,
      bio: null,
      avatarUrl: null,
      createdAt: new Date().toISOString(),
    };
    socialAnalyticsStore.createProfile(profile);
    const existing = socialAnalyticsStore.listProfiles(tenantId).find((p) => p.platform === r.platform && p.username === r.username) ?? profile;
    const snap = await DataCollectorService.collect(existing.id, r, { instagramGraphToken });
    socialAnalyticsStore.addSnapshot(snap);
    setSelectedProfileId(existing.id);
    setVersion((v) => v + 1);
    toast.success("Perfil monitorado e snapshot coletado.");
  };

  const collectNow = async () => {
    if (!selected) return;
    const r = { platform: selected.platform, username: selected.username };
    const snap = await DataCollectorService.collect(selected.id, r, { instagramGraphToken });
    socialAnalyticsStore.addSnapshot(snap);
    setVersion((v) => v + 1);
    toast.success("Snapshot atualizado.");
  };

  const forecast = useMemo(() => {
    if (!history.length) return null;
    const current = history[history.length - 1]!.followers;
    const avgGrowth = metric ? (metric.dailyGrowth || Math.round(metric.weeklyGrowth / 7)) : 0;
    const in30 = current + avgGrowth * 30;
    return { current, avgGrowth, in30 };
  }, [history, metric]);

  return (
    <div className="space-y-4">
      <Card className="glass-card p-4 border-border/60 space-y-3">
        <h3 className="font-display font-semibold text-sm">Social Analytics (estilo SocialBlade)</h3>
        <p className="text-xs text-muted-foreground">
          Busca de perfil, coleta automática, histórico de snapshots, métricas, ranking e previsão.
        </p>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1.5">
            <Label className="text-xs">Perfil (@username, URL ou nome)</Label>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="@cristiano ou instagram.com/cristiano" />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={() => void createAndCollect()}>
              Monitorar perfil
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="glass-card p-4 border-border/60 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-sm font-medium">Evolução de seguidores</div>
            <div className="flex items-center gap-2">
              <select
                className="h-8 rounded border border-border/60 bg-background px-2 text-xs"
                value={selected?.id ?? ""}
                onChange={(e) => setSelectedProfileId(e.target.value)}
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.platform} · @{p.username}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="secondary" onClick={() => void collectNow()} disabled={!selected}>
                Coletar agora
              </Button>
            </div>
          </div>
          {history.length ? (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={history.map((h) => ({
                    at: h.collectedAt.slice(5, 16).replace("T", " "),
                    followers: h.followers,
                    views: h.views,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="at" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="followers" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Sem histórico ainda.</p>
          )}
        </Card>

        <Card className="glass-card p-4 border-border/60 space-y-2">
          <h4 className="text-sm font-medium">Métricas</h4>
          <div className="text-xs text-muted-foreground">Crescimento diário</div>
          <div className="text-lg font-semibold">{metric?.dailyGrowth ?? 0}</div>
          <div className="text-xs text-muted-foreground">Crescimento semanal</div>
          <div className="text-lg font-semibold">{metric?.weeklyGrowth ?? 0}</div>
          <div className="text-xs text-muted-foreground">Crescimento mensal</div>
          <div className="text-lg font-semibold">{metric?.monthlyGrowth ?? 0}</div>
          <div className="text-xs text-muted-foreground">Engajamento</div>
          <div className="text-lg font-semibold">{metric?.engagementRate?.toFixed(2) ?? "0.00"}%</div>
          {history.length ? (
            <p className="text-[11px] text-muted-foreground pt-1">
              Scheduler sugerido: {SchedulerService.nextIntervalMs(history[history.length - 1]!.followers) / (60 * 60 * 1000)}h
            </p>
          ) : null}
        </Card>
      </div>

      {forecast ? (
        <Card className="glass-card p-4 border-border/60">
          <h4 className="text-sm font-medium mb-2">Previsão (30 dias)</h4>
          <p className="text-sm text-muted-foreground">
            Atual: <strong>{forecast.current.toLocaleString("pt-BR")}</strong> · Média diária:{" "}
            <strong>{forecast.avgGrowth.toLocaleString("pt-BR")}</strong> · Projeção:{" "}
            <strong>{Math.round(forecast.in30).toLocaleString("pt-BR")}</strong>
          </p>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass-card p-4 border-border/60">
          <h4 className="text-sm font-medium mb-2">Ranking do tenant</h4>
          <ol className="space-y-1 text-sm">
            {rankingTenant.map((r, i) => (
              <li key={r.profile.id} className="flex justify-between">
                <span>{i + 1}. {r.profile.platform} @{r.profile.username}</span>
                <span>{r.followers.toLocaleString("pt-BR")}</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card className="glass-card p-4 border-border/60">
          <h4 className="text-sm font-medium mb-2">Ranking global</h4>
          <ol className="space-y-1 text-sm">
            {rankingGlobal.map((r, i) => (
              <li key={r.profile.id} className="flex justify-between">
                <span>{i + 1}. {r.profile.platform} @{r.profile.username}</span>
                <span>{r.followers.toLocaleString("pt-BR")}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

