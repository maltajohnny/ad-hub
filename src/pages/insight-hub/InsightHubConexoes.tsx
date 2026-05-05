import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import {
  deleteInsightHubConnection,
  fetchConnectionAvailable,
  fetchInsightHubBrands,
  fetchInsightHubConnections,
  selectConnectionAccount,
  startMetaAuthorize,
  type GoogleAdsAccountOption,
  type InsightHubConnection,
  type MetaAdAccountOption,
  type MetaPageOption,
} from "@/lib/insightHubApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plug, Plus, Trash2, RefreshCw } from "lucide-react";

const PROVIDER_LABELS: Record<string, string> = {
  facebook_insights: "Facebook (Página + Insights)",
  meta_ads: "Meta Ads (Ad Account)",
  instagram: "Instagram Business",
  google_ads: "Google Ads",
};

export default function InsightHubConexoes() {
  const qc = useQueryClient();
  const { search } = useLocation();
  const [open, setOpen] = useState(false);
  const [brandId, setBrandId] = useState<string>("");
  const [provider, setProvider] = useState<"facebook_insights" | "meta_ads" | "instagram">("facebook_insights");
  const [selectingId, setSelectingId] = useState<string | null>(null);

  const brandsQ = useQuery({ queryKey: ["insight-hub", "brands"], queryFn: fetchInsightHubBrands });
  const connsQ = useQuery({
    queryKey: ["insight-hub", "connections"],
    queryFn: () => fetchInsightHubConnections(),
  });

  useEffect(() => {
    if (!brandId && brandsQ.data && brandsQ.data.length) setBrandId(brandsQ.data[0].id);
  }, [brandsQ.data, brandId]);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const connected = params.get("ih_connected");
    const errMsg = params.get("ih_error");
    if (errMsg) toast.error(`Erro OAuth: ${errMsg}`);
    if (connected) {
      toast.success("Meta conectado — selecione a página/conta para ativar a sincronização.");
      setSelectingId(connected);
      void connsQ.refetch();
    }
  }, [search, connsQ]);

  const startAuthMut = useMutation({
    mutationFn: () =>
      startMetaAuthorize({
        brandId,
        provider,
        returnPath: "/clientes/insight-hub/conexoes",
      }),
    onSuccess: (resp) => {
      window.location.assign(resp.authorizeUrl);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteInsightHubConnection(id),
    onSuccess: async () => {
      toast.success("Conexão removida.");
      await qc.invalidateQueries({ queryKey: ["insight-hub", "connections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const conns = connsQ.data ?? [];
  const grouped = useMemo(() => {
    const map: Record<string, InsightHubConnection[]> = {};
    for (const c of conns) {
      const k = c.brandId;
      if (!map[k]) map[k] = [];
      map[k].push(c);
    }
    return map;
  }, [conns]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Conexões</h1>
          <p className="text-sm text-muted-foreground">
            Ligue contas Meta às marcas para iniciar a sincronização automática (Facebook, Instagram, Meta Ads).
          </p>
        </div>
        <Button className="gap-2" onClick={() => setOpen(true)} disabled={!brandsQ.data?.length}>
          <Plus className="h-4 w-4" aria-hidden />
          Nova conexão
        </Button>
      </header>

      {connsQ.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" /> A carregar conexões…
        </div>
      ) : !conns.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhuma conexão ainda</CardTitle>
            <CardDescription>
              Clique em <strong>Nova conexão</strong> para abrir o login Meta. Depois selecione a página/Ad Account.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4">
          {Object.entries(grouped).map(([bid, items]) => {
            const brand = brandsQ.data?.find((b) => b.id === bid);
            return (
              <Card key={bid}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{brand?.name ?? "Marca"}</CardTitle>
                  <CardDescription>{items.length} conexão(ões)</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {items.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-col gap-2 rounded-lg border border-border/40 bg-card/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Plug className="h-3.5 w-3.5 text-primary" aria-hidden />
                          {PROVIDER_LABELS[c.provider] ?? c.provider}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {c.displayLabel || c.externalAccountId || "Conta pendente seleção"} ·{" "}
                          <span className="uppercase tracking-wide">{c.status}</span>
                        </p>
                        {c.lastSyncedAt ? (
                          <p className="text-[11px] text-muted-foreground">
                            Última sincronização: {new Date(c.lastSyncedAt).toLocaleString()}
                          </p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">Aguardando primeira sincronização.</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!c.externalAccountId ? (
                          <Button size="sm" variant="secondary" onClick={() => setSelectingId(c.id)}>
                            Selecionar conta
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setSelectingId(c.id)}>
                            Trocar conta
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-destructive hover:text-destructive"
                          onClick={() => deleteMut.mutate(c.id)}
                          disabled={deleteMut.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remover
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova conexão Meta</DialogTitle>
            <DialogDescription>
              Vamos abrir o consentimento Meta. Após autorizar, você volta aqui para escolher a página/Ad Account.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>Marca</Label>
              <Select value={brandId} onValueChange={setBrandId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(brandsQ.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v as typeof provider)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="facebook_insights">Facebook (Página + Insights)</SelectItem>
                  <SelectItem value="instagram">Instagram Business</SelectItem>
                  <SelectItem value="meta_ads">Meta Ads</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => startAuthMut.mutate()}
              disabled={!brandId || startAuthMut.isPending}
            >
              {startAuthMut.isPending ? "A abrir Meta…" : "Abrir login Meta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SelectAccountDialog
        connectionId={selectingId}
        onClose={() => setSelectingId(null)}
        onDone={() => qc.invalidateQueries({ queryKey: ["insight-hub", "connections"] })}
      />
    </div>
  );
}

function SelectAccountDialog({
  connectionId,
  onClose,
  onDone,
}: {
  connectionId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const open = !!connectionId;
  const q = useQuery({
    queryKey: ["insight-hub", "connection-available", connectionId],
    queryFn: () => fetchConnectionAvailable(connectionId as string),
    enabled: !!connectionId,
  });
  const [chosen, setChosen] = useState<string>("");

  useEffect(() => {
    if (!open) setChosen("");
  }, [open]);

  const mut = useMutation({
    mutationFn: () => {
      const pages = q.data?.pages ?? [];
      const ads = q.data?.adAccounts ?? [];
      const gAds = q.data?.googleAdsAccounts ?? [];
      const page = pages.find((p) => p.id === chosen);
      const acc = ads.find((a) => a.id === chosen || a.account_id === chosen);
      const ga = gAds.find((a) => `${a.loginCustomerId}:${a.id}` === chosen);
      if (page) {
        return selectConnectionAccount(connectionId as string, {
          externalAccountId: page.id,
          displayLabel: page.name,
          pageAccessToken: page.access_token,
        });
      }
      if (acc) {
        return selectConnectionAccount(connectionId as string, {
          externalAccountId: `act_${acc.account_id}`,
          displayLabel: acc.name ?? acc.account_id,
        });
      }
      if (ga) {
        return selectConnectionAccount(connectionId as string, {
          externalAccountId: ga.id,
          displayLabel: ga.name + (ga.manager ? " · MCC" : "") + (ga.hint === "sub" ? " · via MCC" : ""),
          loginCustomerId: ga.loginCustomerId,
        });
      }
      return Promise.reject(new Error("Selecione uma conta"));
    },
    onSuccess: () => {
      toast.success("Conta selecionada — sincronização agendada.");
      onDone();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pages: MetaPageOption[] = q.data?.pages ?? [];
  const ads: MetaAdAccountOption[] = q.data?.adAccounts ?? [];
  const googleAds: GoogleAdsAccountOption[] = q.data?.googleAdsAccounts ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Selecionar conta</DialogTitle>
          <DialogDescription>
            Escolha a página, perfil Instagram ou Ad Account ligada à esta conexão.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">A consultar Meta…</p>
          ) : q.isError ? (
            <p className="text-sm text-destructive">{(q.error as Error).message}</p>
          ) : pages.length ? (
            <div className="grid gap-2">
              <Label>Páginas / Instagram</Label>
              <Select value={chosen} onValueChange={setChosen}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {pages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.instagramBusinessId ? " · IG ligado" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : ads.length ? (
            <div className="grid gap-2">
              <Label>Ad accounts</Label>
              <Select value={chosen} onValueChange={setChosen}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ads.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {(a.name ?? a.account_id) + (a.currency ? ` · ${a.currency}` : "")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : googleAds.length ? (
            <div className="grid gap-2">
              <Label>Contas Google Ads / MCC</Label>
              <Select value={chosen} onValueChange={setChosen}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {googleAds.map((a) => (
                    <SelectItem key={`${a.loginCustomerId}:${a.id}`} value={`${a.loginCustomerId}:${a.id}`}>
                      {a.name} ({a.id}){a.manager ? " · gestor" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem opções disponíveis para este token.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!chosen || mut.isPending}>
            {mut.isPending ? "A guardar…" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
