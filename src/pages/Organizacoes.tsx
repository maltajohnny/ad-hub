import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { APP_MODULES, APP_MODULE_LABELS, type AppModule } from "@/lib/saasTypes";
import { createTenant, deleteTenant, listTenants, tenantLoginPath, type TenantRecord } from "@/lib/tenantsStore";
import { Building2, Copy, Trash2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Organizacoes() {
  const { user } = useAuth();
  const [rows, setRows] = useState<TenantRecord[]>(() => listTenants());
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [mod, setMod] = useState<Record<AppModule, boolean>>(() =>
    Object.fromEntries(APP_MODULES.map((m) => [m, true])) as Record<AppModule, boolean>,
  );

  const refresh = () => setRows(listTenants());

  const enabledModulesList = useMemo(
    () => APP_MODULES.filter((m) => mod[m]),
    [mod],
  );

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

  const handleCreate = () => {
    const res = createTenant({
      slug,
      displayName,
      logoDataUrl,
      enabledModules: enabledModulesList.length === APP_MODULES.length ? [] : enabledModulesList,
    });
    if (!res.ok) {
      toast.error("error" in res ? res.error : "Erro");
      return;
    }
    toast.success("Organização criada.");
    setSlug("");
    setDisplayName("");
    setLogoDataUrl(null);
    setMod(Object.fromEntries(APP_MODULES.map((m) => [m, true])) as Record<AppModule, boolean>);
    refresh();
  };

  const copyLink = (slug: string) => {
    const path = `${window.location.origin}${tenantLoginPath(slug)}`;
    void navigator.clipboard.writeText(path);
    toast.success("Link copiado.");
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
          <Label className="text-xs">Logo</Label>
          <Input type="file" accept="image/*" onChange={onFile} className="cursor-pointer" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Módulos permitidos na organização (vazio = todos)</Label>
          <div className="grid sm:grid-cols-2 gap-2 rounded-lg border border-border/50 p-3">
            {APP_MODULES.map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={mod[m]} onCheckedChange={(c) => setMod((prev) => ({ ...prev, [m]: c === true }))} />
                {APP_MODULE_LABELS[m]}
              </label>
            ))}
          </div>
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
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={tenantLoginPath(t.slug)} target="_blank" rel="noreferrer" className="gap-1">
                      <Link2 className="h-3.5 w-3.5" />
                      Abrir
                    </a>
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
    </div>
  );
}
