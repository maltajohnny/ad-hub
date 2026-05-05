import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchInsightHubBrands, type InsightHubBrandRow } from "@/lib/insightHubApi";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function useInsightHubBrandsQuery() {
  return useQuery({
    queryKey: ["insight-hub", "brands"],
    queryFn: fetchInsightHubBrands,
  });
}

export function InsightHubBrandSelector({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const q = useInsightHubBrandsQuery();
  const brands = useMemo<InsightHubBrandRow[]>(() => q.data ?? [], [q.data]);

  useEffect(() => {
    if (!value && brands.length) {
      onChange(brands[0].id);
    }
  }, [brands, value, onChange]);

  if (q.isLoading) {
    return <p className="text-xs text-muted-foreground">A carregar marcas…</p>;
  }
  if (!brands.length) {
    return (
      <p className="text-xs text-muted-foreground">
        Crie uma marca primeiro em <strong>Marcas</strong> para visualizar dados.
      </p>
    );
  }

  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">Marca</Label>
      <Select value={value ?? undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full sm:w-72">
          <SelectValue placeholder="Selecione a marca" />
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
  );
}

export function RangePicker({
  value,
  onChange,
}: {
  value: "7d" | "14d" | "30d" | "90d" | "mtd" | "ytd";
  onChange: (v: "7d" | "14d" | "30d" | "90d" | "mtd" | "ytd") => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">Período</Label>
      <Select value={value} onValueChange={(v) => onChange(v as typeof value)}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">7 dias</SelectItem>
          <SelectItem value="14d">14 dias</SelectItem>
          <SelectItem value="30d">30 dias</SelectItem>
          <SelectItem value="90d">90 dias</SelectItem>
          <SelectItem value="mtd">Mês atual</SelectItem>
          <SelectItem value="ytd">Ano atual</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
