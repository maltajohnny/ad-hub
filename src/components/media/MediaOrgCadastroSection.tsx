import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { isPlatformOperator } from "@/lib/saasTypes";
import {
  addMediaClient,
  appendAudit,
  MEDIA_PLATFORMS,
  upsertManager,
  type MediaPlatformId,
} from "@/lib/mediaManagementStore";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Building2, Users } from "lucide-react";

function normalize(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

/**
 * Cadastro de clientes de mídia, convites de gestor e texto de papéis — destinado ao módulo Clientes
 * (subsecção administrativa), alinhado ao que antes estava só em Gestão de Mídias.
 */
export function MediaOrgCadastroSection() {
  const { user, listUsers } = useAuth();
  const { tenant } = useTenant();
  const orgId = user?.organizationId ?? tenant?.id ?? null;
  const isOrgAdmin = user?.role === "admin";

  const [dialogCliente, setDialogCliente] = useState(false);
  const [dialogGestor, setDialogGestor] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState("");
  const [novoClienteEmail, setNovoClienteEmail] = useState("");
  const [novoClientePlats, setNovoClientePlats] = useState<Record<MediaPlatformId, boolean>>({
    "meta-ads": true,
    "instagram-ads": false,
    "google-ads": false,
    "tiktok-ads": false,
  });
  const [novoGestorNome, setNovoGestorNome] = useState("");
  const [novoGestorEmail, setNovoGestorEmail] = useState("");
  const [novoGestorPhone, setNovoGestorPhone] = useState("");

  const orgUsers = useMemo(() => {
    if (!orgId) return [];
    return listUsers().filter((u) => u.organizationId === orgId && !isPlatformOperator(u.username));
  }, [listUsers, orgId]);

  if (!orgId || !isOrgAdmin || !user) return null;

  const handleNovoCliente = () => {
    if (!novoClienteNome.trim() || !novoClienteEmail.trim()) {
      toast.error("Nome e e-mail do cliente são obrigatórios.");
      return;
    }
    const platformIds = (Object.keys(novoClientePlats) as MediaPlatformId[]).filter((k) => novoClientePlats[k]);
    if (platformIds.length === 0) {
      toast.error("Selecione pelo menos uma plataforma.");
      return;
    }
    addMediaClient(orgId, {
      name: novoClienteNome.trim(),
      email: novoClienteEmail.trim(),
      platformIds,
    });
    appendAudit(orgId, user.username, "Cliente cadastrado", novoClienteNome.trim());
    setDialogCliente(false);
    setNovoClienteNome("");
    setNovoClienteEmail("");
    setNovoClientePlats({
      "meta-ads": true,
      "instagram-ads": false,
      "google-ads": false,
      "tiktok-ads": false,
    });
    toast.success("Cliente registado. Configure permissões em Gestão de Mídias → Gestores, se necessário.");
  };

  const handleInviteGestor = () => {
    if (!novoGestorNome.trim() || !novoGestorEmail.trim()) {
      toast.error("Preencha nome e e-mail do gestor.");
      return;
    }
    upsertManager(orgId, {
      id: crypto.randomUUID(),
      username: null,
      name: novoGestorNome.trim(),
      email: novoGestorEmail.trim(),
      phone: novoGestorPhone.trim() || undefined,
      active: true,
      permissions: [],
      invitedAt: new Date().toISOString(),
    });
    appendAudit(orgId, user.username, "Convite de gestor", `E-mail ${novoGestorEmail.trim()}`);
    setDialogGestor(false);
    setNovoGestorNome("");
    setNovoGestorEmail("");
    setNovoGestorPhone("");
    toast.success("Convite registado. Atribua clientes e redes em Gestão de Mídias → Gestores.");
  };

  const orgLabel =
    orgUsers.length > 0
      ? `${orgUsers.length} utilizador(es) nesta organização`
      : "Utilizadores da organização aparecem aqui após convite";

  return (
    <div className="space-y-5">
      <Card className="glass-card border-border/60 p-4 sm:p-5">
        <p className="text-xs text-muted-foreground mb-2">{orgLabel}</p>
        <h3 className="font-semibold text-sm mb-2">Papéis nesta organização</h3>
        <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1.5 leading-relaxed">
          <li>
            <strong className="text-foreground font-medium">Administrador:</strong> convite por e-mail; define utilizadores e quais módulos
            cada um pode usar (ex.: Gestão de Mídias).
          </li>
          <li>
            <strong className="text-foreground font-medium">Cliente (marca):</strong> convida o e-mail do teu administrador ou gestor nas
            contas de anúncios (ex.: Meta Business). Esse é o e-mail a usar no login Facebook/TikTok/Google ao abrir cada rede no módulo de
            mídias.
          </li>
          <li>
            <strong className="text-foreground font-medium">Utilizadores:</strong> permissões por módulo definidas pelo admin; dentro de
            Gestão de Mídias, o acesso por cliente e rede segue a matriz de permissões naquele módulo.
          </li>
        </ol>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button type="button" className="gap-2 w-full sm:w-auto" onClick={() => setDialogCliente(true)}>
            <Building2 className="h-4 w-4" />
            Cadastrar cliente (mídia)
          </Button>
          <Button type="button" variant="secondary" className="gap-2 w-full sm:w-auto" onClick={() => setDialogGestor(true)}>
            <Users className="h-4 w-4" />
            Convidar gestor
          </Button>
        </div>
      </Card>

      <Dialog open={dialogCliente} onOpenChange={setDialogCliente}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cadastrar cliente</DialogTitle>
            <DialogDescription>
              Nome, e-mail e redes em que opera. O cliente deve convidar o teu e-mail nas contas de anúncios; depois, em Gestão de Mídias,
              usas o login oficial dessa rede com esse mesmo e-mail.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label>Nome do cliente</Label>
              <Input value={novoClienteNome} onChange={(e) => setNovoClienteNome(e.target.value)} placeholder="Empresa XYZ" />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail de contato</Label>
              <Input type="email" value={novoClienteEmail} onChange={(e) => setNovoClienteEmail(e.target.value)} placeholder="contato@empresa.com" />
            </div>
            <div className="space-y-2">
              <Label>Plataformas utilizadas</Label>
              {MEDIA_PLATFORMS.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={novoClientePlats[p.id]}
                    onCheckedChange={(c) => setNovoClientePlats((prev) => ({ ...prev, [p.id]: c === true }))}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogCliente(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleNovoCliente}>
              Salvar cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogGestor} onOpenChange={setDialogGestor}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar gestor</DialogTitle>
            <DialogDescription>
              Nome, e-mail e telefone. Após aceitar o convite na AD-Hub, atribua clientes e plataformas em{" "}
              <strong className="text-foreground">Gestão de Mídias → Gestores</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={novoGestorNome} onChange={(e) => setNovoGestorNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={novoGestorEmail} onChange={(e) => setNovoGestorEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone (opcional)</Label>
              <Input value={novoGestorPhone} onChange={(e) => setNovoGestorPhone(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogGestor(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleInviteGestor}>
              Registar convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
