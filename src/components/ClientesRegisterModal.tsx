import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  addMediaClient,
  appendAudit,
  removeMediaClient,
  type MediaPlatformId,
} from "@/lib/mediaManagementStore";
import {
  buildGoogleAdsOAuthUrl,
  encodeOAuthState,
  getClientesOAuthRedirectUri,
  getOAuthPopupRedirectUri,
} from "@/lib/platformLoginUrls";
import { PlatformOAuthConnectPanel } from "@/components/PlatformOAuthConnectPanel";

const PLATFORM_ROWS: {
  id: MediaPlatformId;
  label: string;
  short: string;
  className: string;
}[] = [
  { id: "meta-ads", label: "Facebook / Meta Ads", short: "Facebook", className: "bg-[#1877F2] hover:bg-[#1877F2]/90 text-white border-0" },
  {
    id: "instagram-ads",
    label: "Instagram (Meta)",
    short: "Instagram",
    className: "bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888] hover:opacity-95 text-white border-0",
  },
  { id: "tiktok-ads", label: "TikTok Ads", short: "TikTok", className: "bg-[#000000] hover:bg-black/90 text-white border-0" },
  { id: "google-ads", label: "Google Ads", short: "Google", className: "bg-[#4285F4] hover:bg-[#4285F4]/90 text-white border-0" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  actorUsername: string;
  /** Após ligação OAuth (API ou simulação). */
  onLinked?: () => void;
};

export function ClientesRegisterModal({ open, onOpenChange, orgId, actorUsername, onLinked }: Props) {
  const [alias, setAlias] = useState("");
  const [step, setStep] = useState<"alias" | "oauth">("alias");
  const [pendingPlatform, setPendingPlatform] = useState<MediaPlatformId | null>(null);
  const [pendingMediaClientId, setPendingMediaClientId] = useState<string | null>(null);
  const oauthCompletedRef = useRef(false);

  const handleDialogOpenChange = (next: boolean) => {
    if (!next && step === "oauth" && pendingMediaClientId && !oauthCompletedRef.current) {
      removeMediaClient(orgId, pendingMediaClientId);
      setPendingMediaClientId(null);
      setPendingPlatform(null);
      setStep("alias");
    }
    if (!next) {
      oauthCompletedRef.current = false;
      setStep("alias");
      setPendingPlatform(null);
      setPendingMediaClientId(null);
      setAlias("");
    }
    onOpenChange(next);
  };

  useEffect(() => {
    if (open) {
      oauthCompletedRef.current = false;
    }
  }, [open]);

  const startGoogleRedirect = (platformId: MediaPlatformId, createdId: string) => {
    const redirectUri = getClientesOAuthRedirectUri();
    const state = encodeOAuthState({ orgId, mediaClientId: createdId, platformId });
    const gUrl = buildGoogleAdsOAuthUrl({ redirectUri, state });
    if (gUrl) {
      handleDialogOpenChange(false);
      window.location.href = gUrl;
      return;
    }
    window.open("https://accounts.google.com/signin", "_blank", "noopener,noreferrer");
    toast.message("Defina VITE_GOOGLE_OAUTH_CLIENT_ID e redirect URI no Google Cloud.");
  };

  const onChoosePlatform = (platformId: MediaPlatformId) => {
    const name = alias.trim();
    if (name.length < 2) {
      toast.error("Indique um alias com pelo menos 2 caracteres (ex.: Hotel Ibis).");
      return;
    }

    const next = addMediaClient(
      orgId,
      {
        name,
        email: "cadastro@clientes.ad-hub.local",
        platformIds: [platformId],
      },
      { registrationSource: "clientes" },
    );
    const created = next.mediaClients[next.mediaClients.length - 1];
    if (!created) {
      toast.error("Não foi possível criar o registo do cliente.");
      return;
    }

    appendAudit(
      orgId,
      actorUsername,
      "Cadastro Clientes — início OAuth",
      `${platformId} · ${name} (${created.id})`,
    );

    if (platformId === "google-ads") {
      startGoogleRedirect(platformId, created.id);
      onLinked?.();
      return;
    }

    setPendingMediaClientId(created.id);
    setPendingPlatform(platformId);
    setStep("oauth");
  };

  const aliasOk = alias.trim().length >= 2;

  const handleOAuthSuccess = () => {
    oauthCompletedRef.current = true;
    onLinked?.();
    handleDialogOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-lg border-border/60 sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {step === "alias" ? "Cadastrar cliente" : "Ligar plataforma ao alias"}
          </DialogTitle>
          <DialogDescription className="text-left text-sm leading-relaxed">
            {step === "alias" ? (
              <>
                Defina um <strong>alias</strong> interno (ex.: Hotel Ibis). Para <strong>Meta</strong> e <strong>TikTok</strong>, o login
                abre numa <strong>popup</strong> (as redes não permitem iframe); depois escolhe a conta de anúncios e as métricas aparecem no
                card. <strong>Google Ads</strong> continua com redirect para a página de consentimento Google.
              </>
            ) : (
              <>
                Alias: <strong>{alias.trim()}</strong>. Conclua o login na popup e selecione a conta correspondente a este cliente.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {step === "alias" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="client-alias">Alias do cliente</Label>
              <Input
                id="client-alias"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="Ex.: Hotel Ibis"
                className="bg-secondary/50 border-border/50"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Conectar com</p>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORM_ROWS.map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    className={`h-10 w-full font-medium ${p.className}`}
                    disabled={!aliasOk}
                    title={!aliasOk ? "Indique um alias com pelo menos 2 caracteres" : undefined}
                    onClick={() => onChoosePlatform(p.id)}
                  >
                    {p.short}
                  </Button>
                ))}
              </div>
              <details className="mt-2 rounded-lg border border-border/50 bg-muted/15 text-left text-[11px] text-muted-foreground">
                <summary className="cursor-pointer select-none list-none px-3 py-2 font-medium text-foreground/85 [&::-webkit-details-marker]:hidden">
                  Para administradores · configurar Meta / TikTok / API
                </summary>
                <div className="space-y-2 border-t border-border/40 px-3 pb-3 pt-2 leading-relaxed">
                  <p>
                    <span className="font-medium text-foreground/90">Frontend:</span> defina{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[10px]">VITE_META_APP_ID</code> e/ou{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[10px]">VITE_TIKTOK_APP_ID</code> no ficheiro{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[10px]">.env</code> e reinicie o Vite.
                  </p>
                  <p>
                    <span className="font-medium text-foreground/90">Redirect do popup:</span>{" "}
                    <code className="break-all rounded bg-muted px-1 py-0.5 text-[10px]">{getOAuthPopupRedirectUri()}</code> — registe este
                    URL exato nas consolas Meta Developers e TikTok for Business.
                  </p>
                  <p>
                    <span className="font-medium text-foreground/90">API (tokens na base):</span> na raiz do projeto,{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[10px]">npm run intellisearch-api</code> com{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[10px]">MYSQL_DSN</code>,{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[10px]">META_APP_SECRET</code> e{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[10px]">TIKTOK_APP_SECRET</code> no{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[10px]">.env</code> da API. Migração SQL em{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[10px]">backend/intellisearch/migrations/</code>.
                  </p>
                </div>
              </details>
            </div>
          </>
        )}

        {step === "oauth" && pendingPlatform && pendingMediaClientId && (
          <PlatformOAuthConnectPanel
            orgId={orgId}
            mediaClientId={pendingMediaClientId}
            platformId={pendingPlatform}
            aliasLabel={alias.trim()}
            actorUsername={actorUsername}
            onSuccess={handleOAuthSuccess}
            onBack={() => {
              if (pendingMediaClientId) {
                removeMediaClient(orgId, pendingMediaClientId);
              }
              setPendingMediaClientId(null);
              setPendingPlatform(null);
              setStep("alias");
            }}
          />
        )}

        <DialogFooter className="sm:justify-between gap-2">
          <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
