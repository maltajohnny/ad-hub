import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function DataDeletion() {
  return (
    <div className="min-h-[100dvh] bg-muted/20 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <Card className="border-border/60 p-5 sm:p-7">
          <div className="mb-4 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl font-bold">Exclusao de Dados</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Ultima atualizacao: 05/05/2026. Esta pagina descreve como solicitar a exclusao de dados no AD-Hub.
          </p>
        </Card>

        <Card className="border-border/60 p-5 sm:p-7">
          <h2 className="mb-2 font-semibold">Como solicitar</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              Envie um email para{" "}
              <a className="text-primary underline-offset-4 hover:underline" href="mailto:contato@ad-hub.digital">
                contato@ad-hub.digital
              </a>
              .
            </li>
            <li>No assunto, use: &quot;Solicitacao de exclusao de dados&quot;.</li>
            <li>No corpo, informe o email da conta e a organizacao/tenant vinculada.</li>
          </ol>

          <h2 className="mb-2 mt-5 font-semibold">Prazos e escopo</h2>
          <p className="text-sm text-muted-foreground">
            Processamos pedidos em ate 30 dias corridos, salvo obrigacoes legais de retencao. Tokens de integracoes,
            dados de perfil e metadados operacionais serao removidos ou anonimizados conforme a legislacao aplicavel.
          </p>

          <h2 className="mb-2 mt-5 font-semibold">Confirmacao</h2>
          <p className="text-sm text-muted-foreground">
            Apos concluir o processamento, enviamos confirmacao no mesmo email da solicitacao.
          </p>
        </Card>

        <div className="pb-8 text-center text-xs text-muted-foreground">
          <Link to="/" className="text-primary underline-offset-4 hover:underline">
            Voltar para o site
          </Link>
        </div>
      </div>
    </div>
  );
}

