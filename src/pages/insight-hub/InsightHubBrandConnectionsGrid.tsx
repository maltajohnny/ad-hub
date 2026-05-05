import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import {
  deleteInsightHubConnection,
  fetchConnectionAvailable,
  fetchInsightHubConnections,
  selectConnectionAccount,
  startGoogleAdsAuthorize,
  type GoogleAdsAccountOption,
  type InsightHubBrandRow,
} from "@/lib/insightHubApi";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plug, Trash2, Info } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type PlatformCard = {
  id: string;
  title: string;
  subtitle?: string;
  accent: string;
  logo: ReactNode;
  soon?: boolean;
};

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

const PLATFORMS: PlatformCard[] = [
  {
    id: "meta_bundle",
    title: "Meta (Facebook / Instagram / Ads)",
    subtitle: "OAuth Meta — páginas e Ad Accounts.",
    accent: "from-blue-600 to-blue-800",
    logo: <span className="text-lg font-bold text-white">∞</span>,
    soon: false,
  },
  {
    id: "google_ads",
    title: "Google Ads",
    subtitle: "OAuth Google — contas e MCC (Minha central de clientes).",
    accent: "from-sky-500 to-blue-600",
    logo: <GoogleLogo className="h-8 w-8" />,
    soon: false,
  },
  {
    id: "ga4",
    title: "Google Analytics 4",
    accent: "from-orange-500 to-amber-600",
    logo: <span className="text-xs font-bold text-white">GA4</span>,
    soon: true,
  },
  {
    id: "gmb",
    title: "Google Meu Negócio",
    accent: "from-emerald-500 to-teal-700",
    logo: <span className="text-lg text-white">🏪</span>,
    soon: true,
  },
  {
    id: "youtube",
    title: "YouTube",
    accent: "from-red-600 to-red-800",
    logo: <span className="text-lg text-white">▶</span>,
    soon: true,
  },
  {
    id: "linkedin_ads",
    title: "LinkedIn Ads",
    accent: "from-blue-800 to-slate-900",
    logo: <span className="text-xs font-bold text-white">in</span>,
    soon: true,
  },
];

export function InsightHubBrandConnectionsGrid({ brands }: { brands: InsightHubBrandRow[] }) {
  const qc = useQueryClient();
  const { search } = useLocation();
  const [brandId, setBrandId] = useState("");
  const [pickConnId, setPickConnId] = useState<string | null>(null);

  useEffect(() => {
    if (!brandId && brands.length) setBrandId(brands[0].id);
  }, [brands, brandId]);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const cid = params.get("ih_connected");
    const err = params.get("ih_error");
    if (err) toast.error(`OAuth: ${err}`);
    if (cid) {
      toast.success("Google Ads — escolha a conta de anúncios ou cliente MCC.");
      setPickConnId(cid);
    }
  }, [search]);

  const connsQ = useQuery({
    queryKey: ["insight-hub", "connections", brandId],
    queryFn: () => fetchInsightHubConnections(brandId),
    enabled: !!brandId,
  });

  const googleConn = useMemo(
    () => connsQ.data?.find((c) => c.provider === "google_ads"),
    [connsQ.data],
  );

  const adsMut = useMutation({
    mutationFn: () =>
      startGoogleAdsAuthorize({
        brandId,
        returnPath: "/clientes/insight-hub/marcas",
      }),
    onSuccess: (r) => window.location.assign(r.authorizeUrl),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteInsightHubConnection(id),
    onSuccess: async () => {
      toast.success("Conexão removida.");
      await qc.invalidateQueries({ queryKey: ["insight-hub", "connections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <TooltipProvider>
      <Card className="border-border/60">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Plug className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <h2 className="font-display text-lg font-semibold">Conexões da marca</h2>
                  <p className="text-sm text-muted-foreground">
                    Conecte as contas associadas à marca para criar relatórios e dashboards.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-1 sm:w-64">
              <Label className="text-xs">Marca</Label>
              <Select value={brandId} onValueChange={setBrandId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha a marca" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {PLATFORMS.map((p) => {
              if (p.id === "meta_bundle") {
                return (
                  <div
                    key={p.id}
                    className={`relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br ${p.accent} p-4 text-white shadow-sm`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15">{p.logo}</span>
                        <div>
                          <p className="font-semibold leading-tight">{p.title}</p>
                          {p.subtitle ? <p className="mt-1 text-xs text-white/85">{p.subtitle}</p> : null}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-4 w-full gap-1.5 bg-white/95 text-slate-900 hover:bg-white [&_svg]:text-slate-900"
                      asChild
                    >
                      <Link to="/clientes/insight-hub/conexoes">
                        <Plug className="h-3.5 w-3.5" />
                        Abrir conexões Meta
                      </Link>
                    </Button>
                  </div>
                );
              }

              if (p.id === "google_ads") {
                const connected = !!googleConn?.externalAccountId;
                return (
                  <div
                    key={p.id}
                    className={`relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br ${p.accent} p-4 text-white shadow-sm`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15">{p.logo}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="font-semibold leading-tight truncate">{p.title}</p>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button type="button" className="shrink-0 rounded p-0.5 hover:bg-white/10" aria-label="Ajuda MCC">
                                  <Info className="h-3.5 w-3.5 opacity-90" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs">
                                Utilize uma conta Google com acesso à MCC. Depois escolha a conta cliente ou a própria MCC na lista.
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          {p.subtitle ? <p className="mt-1 text-xs text-white/85">{p.subtitle}</p> : null}
                          {connected ? (
                            <p className="mt-2 truncate text-xs font-medium text-white/95">
                              {googleConn?.displayLabel ?? googleConn?.externalAccountId}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {googleConn ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="shrink-0 h-8 w-8 text-white hover:bg-white/15"
                          onClick={() => googleConn && deleteMut.mutate(googleConn.id)}
                          disabled={deleteMut.isPending}
                          aria-label="Remover conexão Google Ads"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                    <div className="mt-4 flex flex-col gap-2">
                      {!connected && googleConn ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full gap-1.5 bg-white/95 text-slate-900 hover:bg-white [&_svg]:text-slate-900"
                          onClick={() => setPickConnId(googleConn.id)}
                        >
                          <Plug className="h-3.5 w-3.5" />
                          Selecionar conta / cliente MCC
                        </Button>
                      ) : null}
                      {!googleConn ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full gap-1.5 bg-white/95 text-slate-900 hover:bg-white [&_svg]:text-slate-900"
                          disabled={!brandId || adsMut.isPending}
                          onClick={() => adsMut.mutate()}
                        >
                          <Plug className="h-3.5 w-3.5" />
                          {adsMut.isPending ? "A redirecionar…" : "Conectar"}
                        </Button>
                      ) : null}
                      {connected ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full border-white/40 bg-white/10 text-white hover:bg-white/20"
                          onClick={() => setPickConnId(googleConn!.id)}
                        >
                          Trocar conta
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={p.id}
                  className={`relative overflow-hidden rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 opacity-80`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${p.accent} text-white`}
                    >
                      {p.logo}
                    </span>
                    <div>
                      <p className="font-medium leading-tight">{p.title}</p>
                      <p className="text-xs text-muted-foreground">Em breve</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="mt-4 w-full" disabled>
                    Conectar
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <GoogleAdsPickDialog
        connectionId={pickConnId}
        onClose={() => setPickConnId(null)}
        onDone={() => {
          void qc.invalidateQueries({ queryKey: ["insight-hub", "connections"] });
        }}
      />
    </TooltipProvider>
  );
}

function GoogleAdsPickDialog({
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
  const [chosen, setChosen] = useState("");

  useEffect(() => {
    if (!open) setChosen("");
  }, [open]);

  const accounts: GoogleAdsAccountOption[] = q.data?.googleAdsAccounts ?? [];

  const mut = useMutation({
    mutationFn: () => {
      const opt = accounts.find((a) => `${a.loginCustomerId}:${a.id}` === chosen);
      if (!opt || !connectionId) return Promise.reject(new Error("Selecione uma conta"));
      const label =
        opt.name +
        (opt.manager ? " · MCC" : "") +
        (opt.hint === "sub" ? " · via MCC" : "");
      return selectConnectionAccount(connectionId, {
        externalAccountId: opt.id,
        displayLabel: label,
        loginCustomerId: opt.loginCustomerId,
      });
    },
    onSuccess: () => {
      toast.success("Conta Google Ads guardada.");
      onDone();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conta Google Ads</DialogTitle>
          <DialogDescription>
            Escolha a conta de anúncios ou um cliente sob a sua MCC. O AD-Hub guarda o ID da conta e o ID da MCC para chamadas à API.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">A consultar contas acessíveis…</p>
          ) : q.isError ? (
            <p className="text-sm text-destructive">{(q.error as Error).message}</p>
          ) : accounts.length ? (
            <div className="grid gap-2">
              <Label>Contas</Label>
              <Select value={chosen} onValueChange={setChosen}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={`${a.loginCustomerId}:${a.id}`} value={`${a.loginCustomerId}:${a.id}`}>
                      {a.name} ({a.id}){a.manager ? " · gestor" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma conta devolvida pela API — confirme developer token e permissões Google Ads.</p>
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
