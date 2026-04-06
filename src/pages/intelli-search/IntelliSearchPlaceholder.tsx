import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function IntelliSearchPlaceholder({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <Card className="border-border/60 max-w-2xl">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Secção em desenvolvimento. A integração SerpAPI (Google Maps) já está ativa na <strong>Análise completa</strong> e
          em <strong>Buscar leads</strong>; as restantes áreas serão ligadas ao backend à medida que os fluxos forem
          finalizados.
        </p>
      </CardContent>
    </Card>
  );
}
