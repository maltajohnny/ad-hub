import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  clearPlatformModulesConfig,
  getPlatformModulesConfig,
  setPlatformModulesConfig,
  type PlatformModulesConfig,
} from "@/lib/apiModulesConfigStore";

const SECRET_KEYS: Array<keyof PlatformModulesConfig> = [
  "metaAppSecret",
  "tiktokAppSecret",
  "googleOauthClientSecret",
  "instagramGraphApiToken",
  "serpApiKey",
  "dataForSeoPassword",
  "metaAdsLibraryToken",
  "hunterApiKey",
  "googlePlacesApiKey",
  "sendgridApiKey",
  "twilioAuthToken",
  "whatsappMetaAccessToken",
];

type Field = {
  key: keyof PlatformModulesConfig;
  label: string;
  placeholder?: string;
};

const GROUPS: Array<{ title: string; fields: Field[] }> = [
  {
    title: "Mídias pagas (OAuth / Ads)",
    fields: [
      { key: "metaAppId", label: "Meta App ID" },
      { key: "metaAppSecret", label: "Meta App Secret" },
      { key: "tiktokAppId", label: "TikTok App ID" },
      { key: "tiktokClientKey", label: "TikTok Client Key" },
      { key: "tiktokAppSecret", label: "TikTok App Secret" },
      { key: "googleOauthClientId", label: "Google OAuth Client ID" },
      { key: "googleOauthClientSecret", label: "Google OAuth Client Secret" },
      { key: "instagramGraphApiToken", label: "Instagram Graph API Token" },
    ],
  },
  {
    title: "IntelliSearch e inteligência",
    fields: [
      { key: "serpApiKey", label: "SERPAPI_KEY" },
      { key: "dataForSeoLogin", label: "DATAFORSEO_LOGIN" },
      { key: "dataForSeoPassword", label: "DATAFORSEO_PASSWORD" },
      { key: "metaAdsLibraryToken", label: "META_ADS_LIBRARY_TOKEN" },
    ],
  },
  {
    title: "Prospecção e extração",
    fields: [
      { key: "hunterApiKey", label: "HUNTER_API_KEY" },
      { key: "googlePlacesApiKey", label: "GOOGLE_PLACES_API_KEY" },
    ],
  },
  {
    title: "Mensageria e notificações",
    fields: [
      { key: "sendgridApiKey", label: "SENDGRID_API_KEY" },
      { key: "twilioAccountSid", label: "TWILIO_ACCOUNT_SID" },
      { key: "twilioAuthToken", label: "TWILIO_AUTH_TOKEN" },
      { key: "whatsappMetaAccessToken", label: "WHATSAPP_META_ACCESS_TOKEN" },
    ],
  },
];

export function ModulesSettingsPanel({ canEdit }: { canEdit: boolean }) {
  const [cfg, setCfg] = useState<PlatformModulesConfig>(() => getPlatformModulesConfig());
  const completeness = useMemo(() => {
    const total = GROUPS.flatMap((g) => g.fields).length;
    const filled = GROUPS.flatMap((g) => g.fields).filter((f) => cfg[f.key].trim().length > 0).length;
    return { total, filled };
  }, [cfg]);

  return (
    <Card className="glass-card p-5 border-border/60 space-y-5">
      <div>
        <h3 className="font-display font-semibold">Módulos · Configuração central de APIs</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Estes campos centralizam os tokens/configs do `API-ADS.md`. Social Pulse já consome o token central daqui
          neste browser. Os demais módulos podem usar esta base nas próximas integrações.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Preenchimento: {completeness.filled}/{completeness.total}
        </p>
      </div>

      {!canEdit ? (
        <p className="text-sm text-muted-foreground">
          Apenas o administrador da plataforma pode editar esta configuração central. Administradores/owners de
          organização podem visualizar, mas não alterar.
        </p>
      ) : null}

      {GROUPS.map((group) => (
        <div key={group.title} className="space-y-3 rounded-lg border border-border/50 p-4">
          <h4 className="text-sm font-medium">{group.title}</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <Input
                  type={SECRET_KEYS.includes(f.key) ? "password" : "text"}
                  disabled={!canEdit}
                  value={cfg[f.key]}
                  placeholder={f.placeholder}
                  onChange={(e) => setCfg((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  className="h-9 bg-secondary/50 border-border/50"
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              setPlatformModulesConfig(cfg);
              toast.success("Configuração de módulos salva.");
            }}
          >
            Salvar configuração
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              clearPlatformModulesConfig();
              setCfg(getPlatformModulesConfig());
              toast.success("Configuração central limpa.");
            }}
          >
            Limpar tudo
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

