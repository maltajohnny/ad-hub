import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { createInsightHubBrand, fetchInsightHubBrands, fetchInsightHubBootstrap } from "@/lib/insightHubApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "react-router-dom";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { InsightHubBrandConnectionsGrid } from "@/pages/insight-hub/InsightHubBrandConnectionsGrid";

export default function InsightHubMarcas() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const boot = useQuery({ queryKey: ["insight-hub", "bootstrap"], queryFn: fetchInsightHubBootstrap });
  const list = useQuery({
    queryKey: ["insight-hub", "brands"],
    queryFn: fetchInsightHubBrands,
    enabled: boot.data != null && (boot.data as { active?: boolean }).active === true,
  });

  const createMut = useMutation({
    mutationFn: () => createInsightHubBrand({ name: name.trim(), email: email.trim() || undefined }),
    onSuccess: async () => {
      toast.success("Marca criada.");
      setOpen(false);
      setName("");
      setEmail("");
      await qc.invalidateQueries({ queryKey: ["insight-hub", "brands"] });
      await qc.invalidateQueries({ queryKey: ["insight-hub", "bootstrap"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (boot.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" />
        A carregar…
      </div>
    );
  }

  if (boot.data && (boot.data as { active?: boolean }).active === false) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Marca indisponível</CardTitle>
          <CardDescription>Ative o módulo Insight Hub para gerir marcas.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/clientes/insight-hub/planos">Ver planos</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Marcas</h1>
          <p className="text-sm text-muted-foreground">Cada marca concentra relatórios, dashboards e conexões (multi-tenant por organização).</p>
        </div>
        <Button className="gap-2" onClick={() => setOpen(true)} disabled={list.isError}>
          <Plus className="h-4 w-4" aria-hidden />
          Nova marca
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {list.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">A carregar marcas…</p>
          ) : list.isError ? (
            <p className="p-6 text-sm text-destructive">{(list.error as Error).message}</p>
          ) : !list.data?.length ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhuma marca ainda. Crie a primeira para começar.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden sm:table-cell">E-mail</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{b.email || "—"}</TableCell>
                    <TableCell className="text-xs uppercase text-muted-foreground">{b.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {list.data?.length ? <InsightHubBrandConnectionsGrid brands={list.data} /> : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova marca</DialogTitle>
            <DialogDescription>Informações visíveis nos relatórios e no portal do cliente (quando ativo).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="ih-brand-name">Nome</Label>
              <Input id="ih-brand-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Marca ACME" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ih-brand-email">E-mail (opcional)</Label>
              <Input
                id="ih-brand-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@marca.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => createMut.mutate()} disabled={!name.trim() || createMut.isPending}>
              {createMut.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
