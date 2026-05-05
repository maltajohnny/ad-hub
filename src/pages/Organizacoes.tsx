import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { APP_MODULE_LABELS, APP_MODULES, type AppModule } from "@/lib/saasTypes";
import {
  createTenant,
  deleteTenant,
  listTenants,
  tenantLoginPath,
  type TenantRecord,
  updateTenant,
  BUILTIN_NORTER_ID,
  BUILTIN_QTRAFFIC_ID,
} from "@/lib/tenantsStore";
import { Building2, Copy, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ModuleCheckboxLabel } from "@/components/ModuleCheckboxLabel";
import { calcModuleAddonMonthly, formatBRL } from "@/lib/moduleBilling";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function moduleMapFromTenant(t: TenantRecord): Record<AppModule, boolean> {
  const set = t.enabledModules.length ? new Set(t.enabledModules) : null;
  return Object.fromEntries(APP_MODULES.map((m) => [m, set ? set.has(m) : true])) as Record<AppModule, boolean>;
}

function normalizeOrgModules(mods: AppModule[]): AppModule[] {
  // Em tenantsStore, [] = todos os módulos.
  return mods.length === 0 ? [...APP_MODULES] : [...mods];
}

function diffModules(before: AppModule[], after: AppModule[]): { added: AppModule[]; removed: AppModule[] } {
  const b = new Set(normalizeOrgModules(before));
  const a = new Set(normalizeOrgModules(after));
  const added = APP_MODULES.filter((m) => a.has(m) && !b.has(m));
  const removed = APP_MODULES.filter((m) => b.has(m) && !a.has(m));
  return { added, removed };
}

export default function Organizacoes() {
  const { user } = useAuth();
  const [rows, setRows] = useState<TenantRecord[]>(() => listTenants());
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [browserTabTitle, setBrowserTabTitle] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [faviconDataUrl, setFaviconDataUrl] = useState<string | null>(null);
  const [mod, setMod] = useState<Record<AppModule, boolean>>(() =>
    Object.fromEntries(APP_MODULES.map((m) => [m, true])) as Record<AppModule, boolean>,
  );
  const [editOpen, setEditOpen] = useState(false);
  const [editTenantId, setEditTenantId] = useState<string | null>(null);
  const [editSlug, setEditSlug] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBrowserTabTitle, setEditBrowserTabTitle] = useState("");
  const [editLogoDataUrl, setEditLogoDataUrl] = useState<string | null>(null);
  const [editFaviconDataUrl, setEditFaviconDataUrl] = useState<string | null>(null);
  const [editMod, setEditMod] = useState<Record<AppModule, boolean>>(() =>
    Object.fromEntries(APP_MODULES.map((m) => [m, true])) as Record<AppModule, boolean>,
  );

  const refresh = () => setRows(listTenants());

  const enabledModulesList = useMemo(
    () => APP_MODULES.filter((m) => mod[m]),
    [mod],
  );
  const selectedAddon = useMemo(() => calcModuleAddonMonthly(enabledModulesList), [enabledModulesList]);
  const editEnabledModulesList = useMemo(() => APP_MODULES.filter((m) => editMod[m]), [editMod]);
  const editAddon = useMemo(() => calcModuleAddonMonthly(editEnabledModulesList), [editEnabledModulesList]);
  const editingBuiltIn = editTenantId === BUILTIN_NORTER_ID || editTenantId === BUILTIN_QTRAFFIC_ID;

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 1.5 * 1024 * 1024) {
      toast.error("Logo até 1,5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(f);
  };

  const onFaviconFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 512 * 1024) {
      toast.error("Favicon até 512 KB (PNG ou ICO recomendado).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setFaviconDataUrl(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(f);
  };

  const onEditFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 1.5 * 1024 * 1024) {
      toast.error("Logo até 1,5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setEditLogoDataUrl(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(f);
  };

  const onEditFaviconFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 512 * 1024) {
      toast.error("Favicon até 512 KB (PNG ou ICO recomendado).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setEditFaviconDataUrl(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(f);
  };

  const handleCreate = () => {
    const res = createTenant({
      slug,
      displayName,
      logoDataUrl,
      browserTabTitle: browserTabTitle.trim() || undefined,
      faviconDataUrl,
      enabledModules: enabledModulesList.length === APP_MODULES.length ? [] : enabledModulesList,
    });
    if (!res.ok) {
      toast.error("error" in res ? res.error : "Erro");
      return;
    }
    toast.success("Organização criada.");
    setSlug("");
    setDisplayName("");
    setBrowserTabTitle("");
    setLogoDataUrl(null);
    setFaviconDataUrl(null);
    setMod(Object.fromEntries(APP_MODULES.map((m) => [m, true])) as Record<AppModule, boolean>);
    refresh();
  };

  const copyLink = (slug: string) => {
    const path = `${window.location.origin}${tenantLoginPath(slug)}`;
    void navigator.clipboard.writeText(path);
    toast.success("Link copiado.");
  };

  const openEdit = (t: TenantRecord) => {
    setEditTenantId(t.id);
    setEditSlug(t.slug);
    setEditDisplayName(t.displayName);
    setEditBrowserTabTitle(t.browserTabTitle ?? "");
    setEditLogoDataUrl(t.logoDataUrl ?? null);
    setEditFaviconDataUrl(t.faviconDataUrl ?? null);
    setEditMod(moduleMapFromTenant(t));
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!editTenantId) return;
    const before = rows.find((r) => r.id === editTenantId);
    if (!before) {
      toast.error("Organização não encontrada para edição.");
      return;
    }
    const afterEnabled = editEnabledModulesList.length === APP_MODULES.length ? [] : editEnabledModulesList;
    const res = updateTenant(editTenantId, {
      slug: editSlug.trim().toLowerCase(),
      displayName: editDisplayName.trim(),
      browserTabTitle: editBrowserTabTitle.trim() || undefined,
      logoDataUrl: editLogoDataUrl,
      faviconDataUrl: editFaviconDataUrl,
      enabledModules: afterEnabled,
    });
    if (!res.ok) {
      toast.error(res.error ?? "Erro ao atualizar organização.");
      return;
    }
    const { added, removed } = diffModules(before.enabledModules, afterEnabled);
    const chunks: string[] = [];
    if (added.length > 0) chunks.push(`+ ${added.map((m) => APP_MODULE_LABELS[m]).join(", ")}`);
    if (removed.length > 0) chunks.push(`- ${removed.map((m) => APP_MODULE_LABELS[m]).join(", ")}`);
    toast.success("Organização atualizada.", {
      description: chunks.length > 0 ? `Módulos alterados: ${chunks.join(" · ")}` : "Sem alterações em módulos.",
    });
    setEditOpen(false);
    refresh();
  };

  if (user?.role !== "admin") {
    return null;
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Building2 className="h-7 w-7 text-primary" />
          Organizações (multi-tenant)
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Cada organização tem um link de login próprio. A identidade Norter da conta administrador e do utilizador{" "}
          <strong className="text-foreground">norter</strong> permanece inalterada no login principal (
          <code className="text-xs">/login</code>). Para domínio próprio, configure DNS (CNAME) para o mesmo host da
          aplicação.
        </p>
      </div>

      <Card className="glass-card p-5 border-border/60 space-y-4">
        <h3 className="font-display font-semibold">Nova organização</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Slug (URL)</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="ex.: acme-corp" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nome exibido</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nome no login" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Título da aba do navegador</Label>
          <Input
            value={browserTabTitle}
            onChange={(e) => setBrowserTabTitle(e.target.value)}
            placeholder='Ex.: "ACME — Portal" ou "ACME - MOVE FASTER"'
          />
          <p className="text-[11px] text-muted-foreground">
            Aparece no separador do browser após login com <code className="text-xs">utilizador.slug</code>. AD-Hub e
            Norter já têm títulos predefinidos.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Logo</Label>
            <Input type="file" accept="image/*" onChange={onFile} className="cursor-pointer" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Favicon (opcional)</Label>
            <Input type="file" accept="image/png,image/x-icon,image/svg+xml" onChange={onFaviconFile} className="cursor-pointer" />
            <p className="text-[11px] text-muted-foreground">Se não enviar, usa a logo ou ícone por defeito.</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Módulos permitidos na organização (vazio = todos)</Label>
          <div className="grid sm:grid-cols-2 gap-2 rounded-lg border border-border/50 p-3">
            {APP_MODULES.map((m) => (
              <label key={m} className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  className="mt-0.5"
                  checked={mod[m]}
                  onCheckedChange={(c) => setMod((prev) => ({ ...prev, [m]: c === true }))}
                />
                <ModuleCheckboxLabel appModule={m} />
              </label>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Estimativa de extras de módulos premium para esta org:{" "}
            <strong className="text-foreground">{formatBRL(selectedAddon.total)}/mês</strong>. Quando um módulo já estiver
            incluído no pacote contratado, não há custo adicional.
          </p>
        </div>
        <Button type="button" onClick={handleCreate} className="gradient-brand text-primary-foreground">
          Criar organização
        </Button>
      </Card>

      <div className="space-y-3">
        <h3 className="font-display font-semibold text-sm">Organizações registadas</h3>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma ainda.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((t) => (
              <li
                key={t.id}
                className={cn(
                  "flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-border/60 bg-secondary/15 px-4 py-3",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{t.displayName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{tenantLoginPath(t.slug)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => copyLink(t.slug)}>
                    <Copy className="h-3.5 w-3.5" />
                    Copiar link
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => openEdit(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (!confirm(`Remover organização «${t.displayName}»?`)) return;
                      deleteTenant(t.id);
                      refresh();
                      toast.message("Organização removida.");
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar organização</DialogTitle>
            <DialogDescription>
              Ajuste tudo que a organização já possui e o que poderá acessar: identidade visual, módulos e permissões.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Slug (URL)</Label>
                <Input
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value.toLowerCase())}
                  placeholder="ex.: acme-corp"
                  disabled={editingBuiltIn}
                />
                {editingBuiltIn ? (
                  <p className="text-[11px] text-muted-foreground">Slug das organizações padrão não pode ser alterado.</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nome exibido</Label>
                <Input value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} placeholder="Nome no login" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Título da aba do navegador</Label>
              <Input
                value={editBrowserTabTitle}
                onChange={(e) => setEditBrowserTabTitle(e.target.value)}
                placeholder='Ex.: "ACME — Portal"'
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Logo</Label>
                <Input type="file" accept="image/*" onChange={onEditFile} className="cursor-pointer" />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditLogoDataUrl(null)}>
                    Remover logo
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Favicon (opcional)</Label>
                <Input
                  type="file"
                  accept="image/png,image/x-icon,image/svg+xml"
                  onChange={onEditFaviconFile}
                  className="cursor-pointer"
                />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditFaviconDataUrl(null)}>
                    Remover favicon
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Módulos permitidos na organização (vazio = todos)</Label>
              <div className="grid sm:grid-cols-2 gap-2 rounded-lg border border-border/50 p-3">
                {APP_MODULES.map((m) => (
                  <label key={m} className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox
                      className="mt-0.5"
                      checked={editMod[m]}
                      onCheckedChange={(c) => setEditMod((prev) => ({ ...prev, [m]: c === true }))}
                    />
                    <ModuleCheckboxLabel appModule={m} />
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Estimativa de extras de módulos premium para esta org:{" "}
                <strong className="text-foreground">{formatBRL(editAddon.total)}/mês</strong>. Quando um módulo já estiver
                incluído no pacote contratado, não há custo adicional.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" className="gradient-brand text-primary-foreground" onClick={saveEdit}>
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
