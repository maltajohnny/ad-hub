import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Activity,
  Radio,
  RefreshCw,
  Shield,
  Trash2,
  TrendingUp,
  Eye,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { normalizeLoginKey } from "@/lib/loginUsername";
import {
  addMonitoredAccount,
  detectPlatformFromUrl,
  getAssignmentsMap,
  getVisibleAccountIdsForUser,
  listAccountsForOrg,
  listAuditForOrg,
  PROFILE_URL_PLACEHOLDERS,
  removeMonitoredAccount,
  setUserVisibleAccounts,
  suggestLabelFromProfileUrl,
  urlMatchesPlatform,
  type MonitoredAccount,
  type SocialPulsePlatform,
} from "@/lib/socialPulseStore";
import { platformLabel } from "@/lib/socialPulseMetrics";
import { getInstagramMetrics } from "@/social-pulse/services/instagram.service";
import type { SocialMetricsPayload } from "@/social-pulse/models/social-metrics.model";
import { getFollowerSnapshots } from "@/social-pulse/storage/metrics-snapshots";
import { cn } from "@/lib/utils";

const PLATFORMS: SocialPulsePlatform[] = ["youtube", "instagram", "twitter", "tiktok"];

const GRAPH_TOKEN_STORAGE_KEY = "social_pulse_graph_user_token";

function extractInstagramUsername(account: MonitoredAccount): string {
  return suggestLabelFromProfileUrl(account.profileUrl, "instagram").replace(/^@/, "") || account.label.replace(/^@/, "");
}

function buildAggregatedFollowerSeries(accounts: MonitoredAccount[]): { day: string; followers: number }[] {
  const ig = accounts.filter((a) => a.platform === "instagram");
  type Ev = { t: number; accountId: string; f: number };
  const events: Ev[] = [];
  for (const a of ig) {
    for (const s of getFollowerSnapshots(a.id)) {
      events.push({ t: new Date(s.at).getTime(), accountId: a.id, f: s.followers });
    }
  }
  if (!events.length) return [];
  events.sort((x, y) => x.t - y.t);
  const last: Record<string, number> = {};
  return events.map((e) => {
    last[e.accountId] = e.f;
    const sum = ig.reduce((acc, x) => acc + (last[x.id] ?? 0), 0);
    return { day: new Date(e.t).toISOString().slice(0, 10), followers: sum };
  });
}

function emptyPlatformPayload(account: MonitoredAccount): SocialMetricsPayload {
  return {
    username: account.label,
    followers: null,
    following: null,
    posts: null,
    engagementRate: null,
    source: "none",
    error: "PLATFORM_NOT_SUPPORTED_YET",
    lastUpdated: new Date().toISOString(),
  };
}

export default function SocialPulse() {
  const { user, listUsers } = useAuth();
  const { tenant } = useTenant();
  const orgId = user?.organizationId ?? tenant?.id ?? null;
  const isOrgAdmin = user?.role === "admin";

  const [platformFilter, setPlatformFilter] = useState<SocialPulsePlatform | "all">("all");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("__all__");
  const [urlInput, setUrlInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [addPlatform, setAddPlatform] = useState<SocialPulsePlatform>("instagram");
  const [version, setVersion] = useState(0);
  const [metricsByAccountId, setMetricsByAccountId] = useState<Record<string, SocialMetricsPayload>>({});
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [graphTokenInput, setGraphTokenInput] = useState(() => {
    try {
      return localStorage.getItem(GRAPH_TOKEN_STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [snapshotTick, setSnapshotTick] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    const d = detectPlatformFromUrl(urlInput);
    if (d) setAddPlatform(d);
  }, [urlInput]);

  const allOrgAccounts = useMemo(() => {
    if (!orgId) return [];
    return listAccountsForOrg(orgId);
  }, [orgId, version]);

  const visibleIds = useMemo(() => {
    if (!orgId || !user) return [];
    return getVisibleAccountIdsForUser(orgId, user.username, isOrgAdmin);
  }, [orgId, user, isOrgAdmin, version]);

  const visibleAccounts = useMemo(() => {
    return allOrgAccounts.filter((a) => visibleIds.includes(a.id));
  }, [allOrgAccounts, visibleIds]);

  const filteredByPlatform = useMemo(() => {
    if (platformFilter === "all") return visibleAccounts;
    return visibleAccounts.filter((a) => a.platform === platformFilter);
  }, [visibleAccounts, platformFilter]);

  const chartAccounts = useMemo(() => {
    if (selectedAccountId === "__all__") return filteredByPlatform;
    return filteredByPlatform.filter((a) => a.id === selectedAccountId);
  }, [filteredByPlatform, selectedAccountId]);

  const refreshMetrics = useCallback(async () => {
    if (!visibleAccounts.length) return;
    const token = graphTokenInput.trim() || localStorage.getItem(GRAPH_TOKEN_STORAGE_KEY) || "";
    setLoadingMetrics(true);
    try {
      const entries = await Promise.all(
        visibleAccounts.map(async (a) => {
          if (a.platform !== "instagram") {
            return [a.id, emptyPlatformPayload(a)] as const;
          }
          const handle = extractInstagramUsername(a);
          const m = await getInstagramMetrics(handle, {
            graphAccessToken: token || undefined,
            accountIdForSnapshot: a.id,
          });
          return [a.id, m] as const;
        }),
      );
      setMetricsByAccountId((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      setSnapshotTick((x) => x + 1);

      const igEntries = entries.filter(([id]) => {
        const acc = visibleAccounts.find((x) => x.id === id);
        return acc?.platform === "instagram";
      });
      if (igEntries.length > 0) {
        const ok = igEntries.filter(([, m]) => m.followers !== null).length;
        const fail = igEntries.length - ok;
        if (ok === igEntries.length) {
          toast.success(`Métricas Instagram atualizadas (${ok} conta(s)).`);
        } else if (ok > 0) {
          toast.warning(
            `${ok} conta(s) OK · ${fail} sem dados. Confira token Graph ou o proxy /api/social/ig-profile.php no servidor.`,
          );
        } else {
          toast.error(
            "Instagram: nenhuma métrica obtida. Token de acesso Graph (conta Business) ou proxy PHP no site; veja a consola [SocialPulse].",
          );
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erro ao atualizar métricas: ${msg}`);
    } finally {
      setLoadingMetrics(false);
    }
  }, [visibleAccounts, graphTokenInput]);

  useEffect(() => {
    if (visibleAccounts.length === 0) return;
    void refreshMetrics();
  }, [visibleAccounts.length, version, refreshMetrics]);

  const kpis = useMemo(() => {
    let followers: number | null = 0;
    let posts: number | null = 0;
    let igCount = 0;
    for (const a of chartAccounts) {
      if (a.platform !== "instagram") continue;
      igCount += 1;
      const m = metricsByAccountId[a.id];
      if (!m) {
        followers = null;
        posts = null;
        break;
      }
      if (m.followers === null) followers = null;
      else if (followers !== null) followers += m.followers;
      if (m.posts === null) posts = null;
      else if (posts !== null) posts += m.posts;
    }
    if (igCount === 0) {
      return { followers: null as number | null, posts: null as number | null };
    }
    return { followers, posts };
  }, [chartAccounts, metricsByAccountId]);

  const mergedSeries = useMemo(
    () => buildAggregatedFollowerSeries(chartAccounts),
    [chartAccounts, snapshotTick],
  );

  const orgUsersForAssign = useMemo(() => {
    if (!orgId) return [];
    return listUsers().filter((u) => u.organizationId === orgId && u.role === "user");
  }, [listUsers, orgId, version]);

  const assignments = useMemo(() => {
    if (!orgId) return {};
    return getAssignmentsMap(orgId);
  }, [orgId, version]);

  const auditRows = useMemo(() => {
    if (!orgId) return [];
    return listAuditForOrg(orgId, 80);
  }, [orgId, version]);

  const onAddAccount = () => {
    if (!orgId || !user) return;
    if (!urlMatchesPlatform(urlInput, addPlatform)) {
      toast.error(
        `O URL tem de ser um perfil em ${platformLabel(addPlatform)} (ex.: ${PROFILE_URL_PLACEHOLDERS[addPlatform]}).`,
      );
      return;
    }
    const friendly =
      labelInput.trim() || suggestLabelFromProfileUrl(urlInput, addPlatform) || urlInput.trim();
    const res = addMonitoredAccount({
      organizationId: orgId,
      profileUrl: urlInput,
      platform: addPlatform,
      label: friendly,
      actorUsername: user.username,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Conta adicionada ao monitoramento.");
    setUrlInput("");
    setLabelInput("");
    refresh();
  };

  const onRemoveAccount = (accountId: string) => {
    if (!orgId || !user) return;
    removeMonitoredAccount({ organizationId: orgId, accountId, actorUsername: user.username });
    toast.success("Conta removida.");
    refresh();
  };

  const toggleUserAccount = (targetUsername: string, accountId: string, checked: boolean) => {
    if (!orgId || !user) return;
    const key = normalizeLoginKey(targetUsername);
    const current = new Set(assignments[key] ?? []);
    if (checked) current.add(accountId);
    else current.delete(accountId);
    setUserVisibleAccounts({
      organizationId: orgId,
      targetUsername,
      accountIds: [...current],
      actorUsername: user.username,
    });
    toast.success("Permissões atualizadas.");
    refresh();
  };

  if (!orgId) {
    return (
      <div className="animate-fade-in max-w-lg">
        <Card className="glass-card border-border/60 p-6">
          <div className="flex items-center gap-2 text-lg font-display font-semibold">
            <Radio className="h-5 w-5 text-primary" />
            Social Pulse
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Este módulo está disponível para contas associadas a uma organização. Inicie sessão com um utilizador da
            sua organização.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Activity className="h-7 w-7 text-primary" />
            Social Pulse
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Métricas reais por conta: Instagram via Instagram Graph API (Meta) ou, em alternativa, leitura do HTML
            público através de proxy same-origin. Sem dados inventados — campos vazios quando a fonte não está
            disponível.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          disabled={loadingMetrics || !visibleAccounts.length}
          onClick={() => void refreshMetrics()}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loadingMetrics && "animate-spin")} />
          Atualizar métricas
        </Button>
      </div>

      <Tabs defaultValue="painel" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="painel" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Painel
          </TabsTrigger>
          {isOrgAdmin ? (
            <>
              <TabsTrigger value="contas" className="gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Contas e permissões
              </TabsTrigger>
              <TabsTrigger value="auditoria" className="gap-1.5">
                Auditoria
              </TabsTrigger>
            </>
          ) : null}
        </TabsList>

        <TabsContent value="painel" className="space-y-4 mt-2">
          {visibleAccounts.length === 0 ? (
            <div className="space-y-4">
              <Card className="glass-card border-dashed border-border/70 p-8 text-center">
                <p className="text-muted-foreground text-sm">
                  {isOrgAdmin
                    ? "Ainda não há contas monitoradas. Use o formulário abaixo ou o separador «Contas e permissões»."
                    : "O administrador ainda não associou contas ao seu acesso. Peça permissões em Social Pulse."}
                </p>
              </Card>
              {isOrgAdmin ? (
                <Card className="glass-card p-5 border-border/60 space-y-4">
                  <h3 className="font-display font-semibold">Adicionar perfil</h3>
                  <p className="text-xs text-muted-foreground">
                    Escolha a rede, cole o URL público do <strong>seu</strong> perfil (não a página inicial da rede) e um
                    nome opcional. Para Instagram, configure o token Graph API abaixo e/ou o proxy de perfil
                    (`VITE_SOCIAL_PULSE_IG_PROXY_URL` no build).
                  </p>
                  <AddProfileFields
                    addPlatform={addPlatform}
                    onPlatformChange={setAddPlatform}
                    urlInput={urlInput}
                    onUrlChange={setUrlInput}
                    labelInput={labelInput}
                    onLabelChange={setLabelInput}
                    onAdd={onAddAccount}
                  />
                </Card>
              ) : null}
            </div>
          ) : (
            <>
              <Card className="glass-card p-4 border-border/60 space-y-3">
                <h3 className="font-display font-semibold text-sm">Instagram — Instagram Graph API (Meta)</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Token de utilizador com permissões para <code className="text-[10px]">me/accounts</code> e conta
                  Instagram Business ligada à página. O token fica só neste browser (localStorage). Para produção,
                  prefira backend OAuth.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <Label className="text-xs">Token de acesso (Graph API)</Label>
                    <Input
                      type="password"
                      autoComplete="off"
                      value={graphTokenInput}
                      onChange={(e) => setGraphTokenInput(e.target.value)}
                      placeholder="EAAB… (não commite)"
                      className="bg-secondary/50 border-border/50 font-mono text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      try {
                        localStorage.setItem(GRAPH_TOKEN_STORAGE_KEY, graphTokenInput.trim());
                        toast.success("Token guardado neste dispositivo.");
                        void refreshMetrics();
                      } catch {
                        toast.error("Não foi possível guardar o token.");
                      }
                    }}
                  >
                    Guardar e atualizar
                  </Button>
                </div>
              </Card>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="space-y-1.5 min-w-[160px]">
                  <Label className="text-xs">Plataforma</Label>
                  <Select
                    value={platformFilter}
                    onValueChange={(v) => setPlatformFilter(v as SocialPulsePlatform | "all")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent className="z-[200]" position="popper">
                      <SelectItem value="all">Todas</SelectItem>
                      {PLATFORMS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {platformLabel(p)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 min-w-[200px] flex-1">
                  <Label className="text-xs">Conta no gráfico</Label>
                    <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[200]" position="popper">
                      <SelectItem value="__all__">Agregado (todas visíveis)</SelectItem>
                      {filteredByPlatform.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <KpiCard
                  icon={<TrendingUp className="h-4 w-4" />}
                  label="Seguidores (Instagram, real)"
                  value={
                    kpis.followers === null
                      ? "N/D"
                      : kpis.followers.toLocaleString("pt-BR")
                  }
                  sub="Soma das contas Instagram no filtro; Graph API ou scraper"
                />
                <KpiCard
                  icon={<Radio className="h-4 w-4" />}
                  label="Publicações (Instagram, real)"
                  value={
                    kpis.posts === null
                      ? "N/D"
                      : kpis.posts.toLocaleString("pt-BR")
                  }
                  sub="media_count (Graph) ou parse do HTML"
                />
                <KpiCard
                  icon={<Eye className="h-4 w-4" />}
                  label="Taxa de engajamento"
                  value="N/D"
                  sub="Exige Insights com janela temporal na Graph API (não implementado)"
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="glass-card p-4 lg:col-span-2 border-border/60">
                  <h3 className="font-display font-semibold text-sm mb-3">
                    Seguidores — leituras reais guardadas (por atualização)
                  </h3>
                  {mergedSeries.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-12 text-center">
                      Ainda não há histórico. Use «Atualizar métricas» para gravar leituras reais (sem interpolação).
                    </p>
                  ) : (
                    <div className="h-[280px] w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={mergedSeries}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                          <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip
                            contentStyle={{ borderRadius: 8 }}
                            labelFormatter={(l) => String(l)}
                          />
                          <Area
                            type="monotone"
                            dataKey="followers"
                            stroke="hsl(var(--primary))"
                            fill="hsl(var(--primary) / 0.2)"
                            name="Seguidores"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>

                <Card className="glass-card p-4 border-border/60">
                  <h3 className="font-display font-semibold text-sm mb-3">Projeção / tendência</h3>
                  <ProjectionBlock accounts={chartAccounts} />
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-1">
                <Card className="glass-card p-4 border-border/60">
                  <h3 className="font-display font-semibold text-sm mb-3">Outras redes (YouTube, X, TikTok)</h3>
                  <p className="text-sm text-muted-foreground">
                    Integrações com dados oficiais por plataforma — a preparar (estrutura em{" "}
                    <code className="text-xs">src/social-pulse/</code>). Nada é exibido de forma inventada.
                  </p>
                </Card>
              </div>

              <Card className="glass-card p-4 border-border/60">
                <h3 className="font-display font-semibold text-sm mb-3">Contas monitoradas</h3>
                <ScrollArea className="max-h-[220px] pr-3">
                  <div className="space-y-2">
                    {visibleAccounts.map((a) => (
                      <AccountRow key={a.id} account={a} metrics={metricsByAccountId[a.id]} />
                    ))}
                  </div>
                </ScrollArea>
              </Card>
            </>
          )}
        </TabsContent>

        {isOrgAdmin ? (
          <>
            <TabsContent value="contas" className="space-y-4 mt-2">
              <Card className="glass-card p-5 border-border/60 space-y-4">
                <h3 className="font-display font-semibold">Adicionar perfil</h3>
                <p className="text-xs text-muted-foreground">
                  Escolha a rede e cole o URL completo do <strong>perfil</strong> a monitorizar (ex.: o seu Instagram,
                  não instagram.com sozinho). Se colar um link de outra rede, a seleção atualiza automaticamente.
                </p>
                <AddProfileFields
                  addPlatform={addPlatform}
                  onPlatformChange={setAddPlatform}
                  urlInput={urlInput}
                  onUrlChange={setUrlInput}
                  labelInput={labelInput}
                  onLabelChange={setLabelInput}
                  onAdd={onAddAccount}
                />
              </Card>

              <Card className="glass-card border-border/60 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conta</TableHead>
                      <TableHead>Plataforma</TableHead>
                      <TableHead className="w-[100px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allOrgAccounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-muted-foreground text-sm">
                          Nenhuma conta registada.
                        </TableCell>
                      </TableRow>
                    ) : (
                      allOrgAccounts.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>
                            <div className="font-medium">{a.label}</div>
                            <a
                              href={a.profileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline break-all"
                            >
                              {a.profileUrl}
                            </a>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{platformLabel(a.platform)}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => onRemoveAccount(a.id)}
                              aria-label="Remover"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>

              <Card className="glass-card p-5 border-border/60 space-y-4">
                <h3 className="font-display font-semibold">Permissões por gestor</h3>
                <p className="text-xs text-muted-foreground">
                  Marque quais contas cada utilizador pode ver no painel. Administradores da organização veem sempre
                  todas as contas.
                </p>
                {orgUsersForAssign.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Não há utilizadores (perfil user) nesta organização.</p>
                ) : allOrgAccounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Adicione contas antes de atribuir permissões.</p>
                ) : (
                  <div className="space-y-6">
                    {orgUsersForAssign.map((u) => {
                      const key = normalizeLoginKey(u.username);
                      const set = new Set(assignments[key] ?? []);
                      return (
                        <div key={u.username} className="rounded-lg border border-border/50 p-4 space-y-2">
                          <div className="font-medium text-sm">{u.name || u.username}</div>
                          <div className="text-xs text-muted-foreground mb-2">{u.username}</div>
                          <div className="grid sm:grid-cols-2 gap-2">
                            {allOrgAccounts.map((a) => (
                              <label
                                key={a.id}
                                className={cn(
                                  "flex items-center gap-2 rounded-md border border-border/40 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40",
                                )}
                              >
                                <Checkbox
                                  checked={set.has(a.id)}
                                  onCheckedChange={(c) =>
                                    toggleUserAccount(u.username, a.id, c === true)
                                  }
                                />
                                <span className="truncate">{a.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="auditoria" className="mt-2">
              <Card className="glass-card border-border/60 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Autor</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Detalhe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground text-sm">
                          Sem eventos registados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      auditRows.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {new Date(e.at).toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-xs">{e.actorUsername}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {e.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{e.detail}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
          </>
        ) : null}
      </Tabs>
    </div>
  );
}

function AddProfileFields({
  addPlatform,
  onPlatformChange,
  urlInput,
  onUrlChange,
  labelInput,
  onLabelChange,
  onAdd,
}: {
  addPlatform: SocialPulsePlatform;
  onPlatformChange: (p: SocialPulsePlatform) => void;
  urlInput: string;
  onUrlChange: (v: string) => void;
  labelInput: string;
  onLabelChange: (v: string) => void;
  onAdd: () => void;
}) {
  const ph = PROFILE_URL_PLACEHOLDERS[addPlatform];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label className="text-xs">Plataforma</Label>
        <Select value={addPlatform} onValueChange={(v) => onPlatformChange(v as SocialPulsePlatform)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[200]" position="popper">
            {PLATFORMS.map((p) => (
              <SelectItem key={p} value={p}>
                {platformLabel(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-xs">URL do perfil</Label>
        <Input value={urlInput} onChange={(e) => onUrlChange(e.target.value)} placeholder={ph} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Nome amigável (opcional)</Label>
        <Input
          value={labelInput}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder="Ex.: Perfil pessoal"
        />
      </div>
      <div className="flex items-end">
        <Button type="button" className="w-full sm:w-auto" onClick={onAdd}>
          Adicionar
        </Button>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card className="glass-card p-4 border-border/60">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        {icon}
        {label}
      </div>
      <div className="text-xl font-display font-bold tracking-tight">{value}</div>
      <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
    </Card>
  );
}

function ProjectionBlock({ accounts }: { accounts: MonitoredAccount[] }) {
  const ig = accounts.filter((a) => a.platform === "instagram");
  if (!ig.length) {
    return <p className="text-sm text-muted-foreground">Sem contas Instagram no filtro atual.</p>;
  }
  const series = buildAggregatedFollowerSeries(accounts);
  if (series.length < 2) {
    return (
      <p className="text-sm text-muted-foreground leading-relaxed">
        São necessárias pelo menos <strong>duas</strong> leituras reais guardadas (use «Atualizar métricas» em dias
        diferentes ou após novas contagens) para estimar tendência sem inventar dados.
      </p>
    );
  }
  const a0 = series[series.length - 2]!.followers;
  const a1 = series[series.length - 1]!.followers;
  const delta = a1 - a0;
  const projected = Math.max(0, Math.round(a1 + delta));
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-lg bg-muted/50 p-3">
        <div className="text-xs text-muted-foreground mb-1">Última soma (Instagram)</div>
        <div className="font-semibold">{a1.toLocaleString("pt-BR")} seguidores</div>
      </div>
      <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
        <div className="text-xs text-muted-foreground mb-1">Extrapolação linear (indicativa)</div>
        <div className="font-semibold text-lg">{projected.toLocaleString("pt-BR")}</div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Baseada só na diferença entre as duas últimas leituras reais agregadas; não é previsão garantida.
        </p>
      </div>
    </div>
  );
}

function AccountRow({ account, metrics }: { account: MonitoredAccount; metrics?: SocialMetricsPayload }) {
  if (account.platform !== "instagram") {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border/40 px-3 py-2">
        <div className="min-w-0">
          <div className="font-medium truncate">{account.label}</div>
          <Badge variant="secondary" className="text-[10px] mt-1">
            {platformLabel(account.platform)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">Integração real ainda não ligada para esta rede.</p>
      </div>
    );
  }
  const m = metrics;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border/40 px-3 py-2">
      <div className="min-w-0">
        <div className="font-medium truncate">{account.label}</div>
        <div className="text-xs text-muted-foreground flex flex-wrap gap-2 items-center">
          <Badge variant="secondary" className="text-[10px]">
            {platformLabel(account.platform)}
          </Badge>
          {m ? (
            <span className="text-[10px] uppercase tracking-wide">Fonte: {m.source}</span>
          ) : (
            <span className="text-[10px]">A carregar…</span>
          )}
        </div>
      </div>
      <div className="text-xs sm:text-right shrink-0 space-y-0.5">
        <div>
          <span className="text-muted-foreground">Seguidores: </span>
          {m?.followers != null ? m.followers.toLocaleString("pt-BR") : "N/D"}
        </div>
        <div>
          <span className="text-muted-foreground">Posts: </span>
          {m?.posts != null ? m.posts.toLocaleString("pt-BR") : "N/D"}
        </div>
        {m?.error ? (
          <div className="text-[10px] text-amber-600 dark:text-amber-400 max-w-[220px] sm:ml-auto">{m.error}</div>
        ) : null}
      </div>
    </div>
  );
}
