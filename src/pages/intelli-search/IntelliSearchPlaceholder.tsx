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
          Secção preparada para integração com a API (Places / SerpAPI / backend). Os dados reais substituirão qualquer
          demonstração aqui.
        </p>
      </CardContent>
    </Card>
  );
}
