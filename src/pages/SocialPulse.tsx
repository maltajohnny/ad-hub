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
  DollarSign,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
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
import {
  buildFollowerSeries,
  estimateMonthlyEarningsUsd,
  platformLabel,
  projectFollowers30d,
} from "@/lib/socialPulseMetrics";
import { cn } from "@/lib/utils";

const PLATFORMS: SocialPulsePlatform[] = ["youtube", "instagram", "twitter", "tiktok"];

export default function SocialPulse() {
  const { user, listUsers } = useAuth();
  const { tenant } = useTenant();
  const orgId = user?.organizationId ?? tenant?.id ?? null;
  const isOrgAdmin = user?.role === "admin";

  const [liveTick, setLiveTick] = useState(0);
  const [platformFilter, setPlatformFilter] = useState<SocialPulsePlatform | "all">("all");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("__all__");
  const [urlInput, setUrlInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [addPlatform, setAddPlatform] = useState<SocialPulsePlatform>("instagram");
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setLiveTick((t) => t + 1);
    }, 22000);
    return () => window.clearInterval(id);
  }, []);

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

  const kpis = useMemo(() => {
    if (!chartAccounts.length) {
      return { followers: 0, views: 0, engagement: 0, earnings: 0 };
    }
    let followers = 0;
    let views = 0;
    let engSum = 0;
    let earnings = 0;
    for (const a of chartAccounts) {
      const s = buildFollowerSeries(a, 1, liveTick);
      const last = s[s.length - 1];
      followers += last.followers;
      views += last.views;
      engSum += last.engagementPct;
      earnings += estimateMonthlyEarningsUsd(a, liveTick);
    }
    return {
      followers,
      views,
      engagement: chartAccounts.length ? engSum / chartAccounts.length : 0,
      earnings,
    };
  }, [chartAccounts, liveTick]);

  const mergedSeries = useMemo(() => {
    if (!chartAccounts.length) return [];
    const days = 30;
    const seriesPerAccount = chartAccounts.map((a) => buildFollowerSeries(a, days, liveTick));
    const len = seriesPerAccount[0]?.length ?? 0;
    const out: { day: string; followers: number; views: number }[] = [];
    for (let i = 0; i < len; i++) {
      let f = 0;
      let v = 0;
      let day = "";
      for (const sp of seriesPerAccount) {
        const row = sp[i];
        if (!row) continue;
        day = row.day;
        f += row.followers;
        v += row.views;
      }
      out.push({ day, followers: f, views: v });
    }
    return out;
  }, [chartAccounts, liveTick]);

  const engagementByPlatform = useMemo(() => {
    const map = new Map<SocialPulsePlatform, { sum: number; n: number }>();
    for (const p of PLATFORMS) map.set(p, { sum: 0, n: 0 });
    for (const a of filteredByPlatform) {
      const s = buildFollowerSeries(a, 1, liveTick);
      const last = s[s.length - 1];
      const cur = map.get(a.platform)!;
      cur.sum += last.engagementPct;
      cur.n += 1;
    }
    return PLATFORMS.map((p) => {
      const c = map.get(p)!;
      const avg = c.n ? c.sum / c.n : 0;
      return { platform: platformLabel(p), engagement: Number(avg.toFixed(2)) };
    }).filter((row) => row.engagement > 0);
  }, [filteredByPlatform, liveTick]);

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
            Crescimento e métricas de redes sociais — painel centralizado por organização. Dados de demonstração com
            atualização periódica; integrações oficiais por API podem ser ligadas no backend.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => setLiveTick((t) => t + 1)}
        >
          <RefreshCw className="h-3.5 w-3.5" />
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
                    nome opcional. As métricas do painel são estimativas de demonstração até existir API oficial no
                    backend (estilo métricas públicas agregadas).
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

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                  icon={<TrendingUp className="h-4 w-4" />}
                  label="Seguidores (est.)"
                  value={kpis.followers.toLocaleString("pt-BR")}
                  sub="Soma das contas filtradas"
                />
                <KpiCard
                  icon={<Eye className="h-4 w-4" />}
                  label="Visualizações (24h)"
                  value={kpis.views.toLocaleString("pt-BR")}
                  sub="Estimativa agregada"
                />
                <KpiCard
                  icon={<Radio className="h-4 w-4" />}
                  label="Engajamento médio"
                  value={`${kpis.engagement.toFixed(2)}%`}
                  sub="Interação / alcance"
                />
                <KpiCard
                  icon={<DollarSign className="h-4 w-4" />}
                  label="Ganhos mensais (est.)"
                  value={`US$ ${kpis.earnings.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                  sub="Modelo simplificado"
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="glass-card p-4 lg:col-span-2 border-border/60">
                  <h3 className="font-display font-semibold text-sm mb-3">Crescimento de seguidores (30 dias)</h3>
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
                </Card>

                <Card className="glass-card p-4 border-border/60">
                  <h3 className="font-display font-semibold text-sm mb-3">Projeção 30 dias (agregado)</h3>
                  <ProjectionBlock accounts={chartAccounts} liveTick={liveTick} />
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="glass-card p-4 border-border/60">
                  <h3 className="font-display font-semibold text-sm mb-3">Visualizações (30 dias)</h3>
                  <div className="h-[240px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={mergedSeries}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="views"
                          stroke="hsl(var(--chart-2))"
                          fill="hsl(var(--chart-2) / 0.25)"
                          name="Views"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card className="glass-card p-4 border-border/60">
                  <h3 className="font-display font-semibold text-sm mb-3">Engajamento por plataforma</h3>
                  <div className="h-[240px] w-full min-w-0">
                    {engagementByPlatform.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-8 text-center">Sem dados no filtro atual.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={engagementByPlatform} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                          <XAxis type="number" tick={{ fontSize: 10 }} />
                          <YAxis dataKey="platform" type="category" width={88} tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar dataKey="engagement" fill="hsl(var(--primary))" name="%" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </Card>
              </div>

              <Card className="glass-card p-4 border-border/60">
                <h3 className="font-display font-semibold text-sm mb-3">Contas monitoradas</h3>
                <ScrollArea className="max-h-[220px] pr-3">
                  <div className="space-y-2">
                    {visibleAccounts.map((a) => (
                      <AccountRow key={a.id} account={a} liveTick={liveTick} />
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

function ProjectionBlock({ accounts, liveTick }: { accounts: MonitoredAccount[]; liveTick: number }) {
  if (!accounts.length) return <p className="text-sm text-muted-foreground">Sem contas para projetar.</p>;
  let low = 0;
  let mid = 0;
  let high = 0;
  for (const a of accounts) {
    const p = projectFollowers30d(a, liveTick);
    low += p.low;
    mid += p.mid;
    high += p.high;
  }
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-lg bg-muted/50 p-3">
        <div className="text-xs text-muted-foreground mb-1">Cenário conservador</div>
        <div className="font-semibold">{low.toLocaleString("pt-BR")} seguidores</div>
      </div>
      <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
        <div className="text-xs text-muted-foreground mb-1">Tendência central</div>
        <div className="font-semibold text-lg">{mid.toLocaleString("pt-BR")}</div>
      </div>
      <div className="rounded-lg bg-muted/50 p-3">
        <div className="text-xs text-muted-foreground mb-1">Cenário otimista</div>
        <div className="font-semibold">{high.toLocaleString("pt-BR")} seguidores</div>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Projeções baseadas na série sintética dos últimos 30 dias; substituível por modelo treinado com dados reais das
        APIs.
      </p>
    </div>
  );
}

function AccountRow({ account, liveTick }: { account: MonitoredAccount; liveTick: number }) {
  const s = buildFollowerSeries(account, 1, liveTick);
  const last = s[s.length - 1];
  const earn = estimateMonthlyEarningsUsd(account, liveTick);
  const proj = projectFollowers30d(account, liveTick);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border/40 px-3 py-2">
      <div className="min-w-0">
        <div className="font-medium truncate">{account.label}</div>
        <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-[10px]">
            {platformLabel(account.platform)}
          </Badge>
          <span>Eng. {last.engagementPct.toFixed(2)}%</span>
        </div>
      </div>
      <div className="text-xs sm:text-right shrink-0 space-y-0.5">
        <div>
          <span className="text-muted-foreground">Seguidores: </span>
          {last.followers.toLocaleString("pt-BR")}
        </div>
        <div>
          <span className="text-muted-foreground">Ganhos est.: </span>US${" "}
          {earn.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </div>
        <div className="text-[10px] text-muted-foreground">
          Projeção 30d: {proj.low.toLocaleString("pt-BR")} – {proj.high.toLocaleString("pt-BR")}
        </div>
      </div>
    </div>
  );
}
