import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  appendAudit,
  applyExternalPlatformLink,
  authorizeClientPlatformViaApp,
  type ManagedAdAccountRef,
  type MediaPlatformId,
} from "@/lib/mediaManagementStore";
import {
  buildFacebookOAuthUrl,
  buildTikTokOAuthUrl,
  encodeOAuthState,
  getOAuthPopupRedirectUri,
  isMetaOAuthConfigured,
  isTikTokOAuthConfigured,
} from "@/lib/platformLoginUrls";
import {
  exchangeMetaOAuthCode,
  exchangeTikTokOAuthCode,
  fetchMetaAdAccounts,
  fetchMetaInsightsSummary,
  fetchTikTokAdvertisers,
  fetchTikTokBasicReport,
  persistLinkAndSync,
  persistMetaOAuthFinish,
  persistTikTokOAuthFinish,
} from "@/services/adPlatformApi";

type OAuthPopupPayload = {
  source?: string;
  code?: string | null;
  state?: string | null;
  error?: string | null;
  error_description?: string | null;
};

type Props = {
  orgId: string;
  mediaClientId: string;
  platformId: MediaPlatformId;
  aliasLabel: string;
  actorUsername: string;
  onSuccess: () => void;
  onBack: () => void;
};

type Phase = "idle" | "accounts" | "linking";

export function PlatformOAuthConnectPanel({
  orgId,
  mediaClientId,
  platformId,
  aliasLabel,
  actorUsername,
  onSuccess,
  onBack,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState<ManagedAdAccountRef[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const accessTokenRef = useRef<string | null>(null);
  const expectedStateRef = useRef<string | null>(null);
  /** `server` = token na base MySQL (persist); `browser` = fluxo antigo só no cliente. */
  const storageModeRef = useRef<"server" | "browser" | null>(null);

  const isMetaFamily = platformId === "meta-ads" || platformId === "instagram-ads";
  const isTikTok = platformId === "tiktok-ads";
  const oauthAppReady = isMetaFamily ? isMetaOAuthConfigured() : isTikTok ? isTikTokOAuthConfigured() : false;

  const persistAccessToken = useCallback((token: string) => {
    accessTokenRef.current = token;
  }, []);

  const resetOAuthSession = useCallback(() => {
    storageModeRef.current = null;
    accessTokenRef.current = null;
  }, []);

  const openOAuthPopup = useCallback(() => {
    resetOAuthSession();
    const redirectUri = getOAuthPopupRedirectUri();
    const state = encodeOAuthState({ orgId, mediaClientId, platformId });
    expectedStateRef.current = state;

    let url: string | null = null;
    if (isMetaFamily) {
      url = buildFacebookOAuthUrl({
        redirectUri,
        state,
        scope:
          platformId === "instagram-ads"
            ? "ads_read,ads_management,business_management,instagram_basic,instagram_manage_insights,pages_read_engagement"
            : undefined,
      });
    } else if (isTikTok) {
      url = buildTikTokOAuthUrl({ redirectUri, state });
    }

    if (!url) {
      return;
    }

    const w = window.open(
      url,
      "adhub_oauth_popup",
      "popup=yes,width=560,height=720,left=120,top=80,scrollbars=yes,resizable=yes",
    );
    if (!w) {
      toast.error("O navegador bloqueou a janela popup. Permita popups para este site.");
      return;
    }
    toast.message("Conclua o login na janela que abriu. Esta página permanece aberta.");
  }, [isMetaFamily, isTikTok, orgId, mediaClientId, platformId, resetOAuthSession]);

  const loadAccountsMeta = useCallback(async (token: string) => {
    const list = await fetchMetaAdAccounts(token);
    if (!list.length) {
      throw new Error("Nenhuma conta de anúncios encontrada para este utilizador.");
    }
    setAccounts(list);
    setSelectedId(list[0]!.externalId);
    setPhase("accounts");
  }, []);

  const loadAccountsTikTok = useCallback(async (token: string) => {
    const list = await fetchTikTokAdvertisers(token);
    if (!list.length) {
      throw new Error("Nenhum anunciante TikTok encontrado para este token.");
    }
    setAccounts(list);
    setSelectedId(list[0]!.externalId);
    setPhase("accounts");
  }, []);

  const handlePopupMessage = useCallback(
    async (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const data = ev.data as OAuthPopupPayload;
      if (data?.source !== "adhub-oauth") return;
      if (expectedStateRef.current && data.state && data.state !== expectedStateRef.current) {
        toast.error("Estado OAuth inválido — tente novamente.");
        return;
      }
      if (data.error) {
        toast.error(data.error_description ?? data.error ?? "Autorização cancelada.");
        return;
      }
      if (!data.code) {
        toast.error("Resposta OAuth sem código.");
        return;
      }

      setBusy(true);
      try {
        const redirectUri = getOAuthPopupRedirectUri();
        if (isMetaFamily) {
          const persisted = await persistMetaOAuthFinish({
            code: data.code,
            redirect_uri: redirectUri,
            org_id: orgId,
            media_client_id: mediaClientId,
            platform: platformId,
          });
          if (persisted.storage === "server") {
            storageModeRef.current = "server";
            accessTokenRef.current = null;
            if (!persisted.accounts.length) {
              throw new Error("Nenhuma conta de anúncios retornada pelo servidor.");
            }
            setAccounts(persisted.accounts);
            setSelectedId(persisted.accounts[0]!.externalId);
            setPhase("accounts");
            toast.success("Token guardado no servidor — escolha a conta de anúncios.");
          } else {
            storageModeRef.current = "browser";
            const { access_token } = await exchangeMetaOAuthCode(data.code, redirectUri);
            persistAccessToken(access_token);
            await loadAccountsMeta(access_token);
            toast.success("Sessão no browser — escolha a conta.");
          }
        } else if (isTikTok) {
          const persisted = await persistTikTokOAuthFinish({
            auth_code: data.code,
            org_id: orgId,
            media_client_id: mediaClientId,
          });
          if (persisted.storage === "server") {
            storageModeRef.current = "server";
            accessTokenRef.current = null;
            if (!persisted.accounts.length) {
              throw new Error("Nenhum anunciante retornado pelo servidor.");
            }
            setAccounts(persisted.accounts);
            setSelectedId(persisted.accounts[0]!.externalId);
            setPhase("accounts");
            toast.success("Token TikTok guardado no servidor — escolha o anunciante.");
          } else {
            storageModeRef.current = "browser";
            const { access_token } = await exchangeTikTokOAuthCode(data.code);
            persistAccessToken(access_token);
            await loadAccountsTikTok(access_token);
            toast.success("Sessão no browser — escolha o anunciante.");
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(msg.length > 160 ? `${msg.slice(0, 157)}…` : msg);
      } finally {
        setBusy(false);
      }
    },
    [isMetaFamily, isTikTok, orgId, mediaClientId, platformId, loadAccountsMeta, loadAccountsTikTok, persistAccessToken],
  );

  useEffect(() => {
    window.addEventListener("message", handlePopupMessage);
    return () => window.removeEventListener("message", handlePopupMessage);
  }, [handlePopupMessage]);

  const confirmLink = async () => {
    if (!selectedId) {
      toast.error("Selecione uma conta.");
      return;
    }
    const picked = accounts.find((a) => a.externalId === selectedId);
    if (storageModeRef.current !== "server" && !accessTokenRef.current) {
      toast.error("Sessão em falta — refaça o login.");
      return;
    }

    setPhase("linking");
    setBusy(true);
    try {
      if (storageModeRef.current === "server") {
        const { metrics } = await persistLinkAndSync({
          org_id: orgId,
          media_client_id: mediaClientId,
          platform: platformId,
          external_account_id: selectedId,
          external_account_label: picked?.name ? `${aliasLabel} — ${picked.name}` : `${aliasLabel} — ${selectedId}`,
        });
        applyExternalPlatformLink(orgId, mediaClientId, platformId, {
          accounts,
          selectedExternalIds: [selectedId],
          metrics: {
            totalSpend: metrics.total_spend,
            roi: metrics.roi,
            cpa: metrics.cpa,
            currency: metrics.currency || "USD",
            syncedAt: metrics.synced_at,
          },
          connectionLabel: `${aliasLabel} — ${picked?.name ?? selectedId}`,
        });
      } else {
        const token = accessTokenRef.current!;
        if (isMetaFamily) {
          const ins = await fetchMetaInsightsSummary(token, selectedId);
          applyExternalPlatformLink(orgId, mediaClientId, platformId, {
            accounts,
            selectedExternalIds: [selectedId],
            metrics: {
              totalSpend: ins.total_spend,
              roi: ins.roi,
              cpa: ins.cpa,
              currency: ins.currency || "USD",
              syncedAt: ins.synced_at,
            },
            connectionLabel: `${aliasLabel} — ${picked?.name ?? selectedId}`,
          });
        } else if (isTikTok) {
          let spend = 0;
          let roi = 0;
          let cpa = 0;
          let currency = "USD";
          let syncedAt = new Date().toISOString();
          try {
            const rep = await fetchTikTokBasicReport(token, selectedId);
            spend = rep.total_spend;
            roi = rep.roi;
            cpa = rep.cpa;
            currency = rep.currency || "USD";
            syncedAt = rep.synced_at;
          } catch {
            toast.message(
              "Relatório TikTok indisponível — conta ligada com métricas a zero. Ajuste o relatório no backend se necessário.",
            );
          }
          applyExternalPlatformLink(orgId, mediaClientId, platformId, {
            accounts,
            selectedExternalIds: [selectedId],
            metrics: {
              totalSpend: spend,
              roi,
              cpa,
              currency,
              syncedAt,
            },
            connectionLabel: `${aliasLabel} — ${picked?.name ?? selectedId}`,
          });
        }
      }

      appendAudit(
        orgId,
        actorUsername,
        storageModeRef.current === "server" ? "OAuth API (persist DB) — vinculado" : "OAuth API — cliente vinculado",
        `${platformId} · ${aliasLabel} · conta ${selectedId}`,
      );
      toast.success(`Cliente «${aliasLabel}» ligado com dados da API.`);
      onSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg.length > 160 ? `${msg.slice(0, 157)}…` : msg);
      setPhase("accounts");
    } finally {
      setBusy(false);
    }
  };

  const runDemoSimulation = () => {
    setBusy(true);
    try {
      authorizeClientPlatformViaApp(orgId, mediaClientId, platformId, { deferAccountSelection: false });
      appendAudit(orgId, actorUsername, "OAuth simulado (demo)", `${platformId} · ${aliasLabel}`);
      toast.success("Ligação simulada — configure API e apps para dados reais.");
      onSuccess();
    } finally {
      setBusy(false);
    }
  };

  if (!isMetaFamily && !isTikTok) {
    return (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>Esta plataforma usa outro fluxo de OAuth. Volte e utilize o botão correspondente ou o redirect completo.</p>
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Alert className="border-border/80 bg-secondary/20">
        <ExternalLink className="h-4 w-4" />
        <AlertTitle className="text-sm font-semibold">Experiência embutida na plataforma</AlertTitle>
        <AlertDescription className="text-xs leading-relaxed text-muted-foreground">
          Por segurança, <strong>Meta e TikTok não permitem</strong> o ecrã de login dentro de um iframe da sua app. O fluxo abre uma{" "}
          <strong>janela popup</strong> controlada por si; a página principal não é redirecionada. Com <strong>MYSQL_DSN</strong> na API, o
          access token fica na base — pode atualizar métricas no card sem novo login.
        </AlertDescription>
      </Alert>

      {phase === "idle" && !oauthAppReady && (
        <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
          <AlertTitle className="text-sm font-semibold text-foreground">
            {isMetaFamily ? "Facebook / Meta" : "TikTok"} — integração não configurada
          </AlertTitle>
          <AlertDescription className="text-xs leading-relaxed text-muted-foreground">
            Neste ambiente ainda não há uma app {isMetaFamily ? "Meta" : "TikTok"} ligada. Peça ao{" "}
            <strong>administrador da plataforma</strong> para configurar as credenciais, ou use{" "}
            <strong>Simular ligação</strong> abaixo para testar o fluxo sem rede social.
          </AlertDescription>
        </Alert>
      )}

      {phase === "idle" && (
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Área reservada ao fluxo OAuth — o login abre ao lado, na popup oficial {isMetaFamily ? "Meta" : "TikTok"}.
          </p>
          <Button
            type="button"
            className="gap-2"
            onClick={openOAuthPopup}
            disabled={busy || !oauthAppReady}
            title={
              !oauthAppReady
                ? "A integração com esta rede ainda não foi configurada pelo administrador (app ID em falta)."
                : undefined
            }
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Abrir login {isMetaFamily ? "Meta / Facebook" : "TikTok"} (popup)
          </Button>
          <div className="pt-2">
            <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={runDemoSimulation} disabled={busy}>
              Simular ligação (sem API)
            </Button>
          </div>
        </div>
      )}

      {phase === "accounts" && (
        <div className="space-y-3">
          <Label className="text-sm">Conta de anúncios para o alias «{aliasLabel}»</Label>
          <RadioGroup value={selectedId} onValueChange={setSelectedId} className="gap-2">
            {accounts.map((a) => (
              <div
                key={a.externalId}
                className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
              >
                <RadioGroupItem value={a.externalId} id={`acct-${a.externalId}`} />
                <Label htmlFor={`acct-${a.externalId}`} className="flex-1 cursor-pointer text-sm font-normal leading-snug">
                  <span className="font-medium text-foreground">{a.name}</span>
                  <span className="block text-[11px] text-muted-foreground font-mono">{a.externalId}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" onClick={confirmLink} disabled={busy || !selectedId}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Vincular e carregar métricas
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetOAuthSession();
                setPhase("idle");
              }}
              disabled={busy}
            >
              Refazer login
            </Button>
          </div>
        </div>
      )}

      {phase === "linking" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          A sincronizar métricas e gravar vínculo…
        </div>
      )}

      <div className="flex justify-between gap-2 pt-2 border-t border-border/50">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} disabled={busy}>
          ← Voltar ao alias
        </Button>
        <p className="text-[10px] text-muted-foreground self-center max-w-[14rem] text-right leading-tight">
          Redirect registado: <span className="font-mono">{getOAuthPopupRedirectUri()}</span>
        </p>
      </div>
    </div>
  );
}
