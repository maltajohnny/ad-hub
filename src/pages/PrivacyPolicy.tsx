import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-[100dvh] bg-muted/20 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <Card className="border-border/60 p-5 sm:p-7">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl font-bold">Politica de Privacidade</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Ultima atualizacao: 26/04/2026. Este documento cobre o uso de login social, detalhes do aplicativo e
            funcionalidades da plataforma AD-Hub.
          </p>
        </Card>

        <Card className="border-border/60 p-5 sm:p-7">
          <h2 className="mb-2 font-semibold">1. Dados coletados</h2>
          <p className="text-sm text-muted-foreground">
            Coletamos dados de autenticacao e operacao necessarios para funcionamento da plataforma, como nome, email,
            identificador de usuario, tenant/organizacao, permissoes de acesso e configuracoes de conta.
          </p>

          <h2 className="mb-2 mt-5 font-semibold">2. Login com plataformas externas</h2>
          <p className="text-sm text-muted-foreground">
            Quando voce conecta contas de terceiros (ex.: Meta Ads, TikTok Ads, Google Ads), recebemos tokens e
            identificadores estritamente para:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>autenticar a conexao entre sua conta e a plataforma externa;</li>
            <li>listar contas de anuncios e sincronizar metricas autorizadas;</li>
            <li>executar operacoes solicitadas por voce dentro do AD-Hub.</li>
          </ul>

          <h2 className="mb-2 mt-5 font-semibold">3. Uso dos dados</h2>
          <p className="text-sm text-muted-foreground">
            Os dados sao utilizados para prover funcionalidades de gestao de midias, analise, automacao, prospeccao e
            relatórios. Nao vendemos dados pessoais.
          </p>

          <h2 className="mb-2 mt-5 font-semibold">4. Compartilhamento</h2>
          <p className="text-sm text-muted-foreground">
            Compartilhamos dados apenas com provedores necessarios ao servico (ex.: APIs de anuncios, provedores de
            email/SMTP, infraestrutura cloud), sempre no contexto da prestacao do servico.
          </p>

          <h2 className="mb-2 mt-5 font-semibold">5. Seguranca e retencao</h2>
          <p className="text-sm text-muted-foreground">
            Aplicamos controles tecnicos e organizacionais para protecao das informacoes. Os dados sao mantidos apenas
            pelo periodo necessario para finalidades operacionais, legais e contratuais.
          </p>

          <h2 className="mb-2 mt-5 font-semibold">6. Direitos do titular</h2>
          <p className="text-sm text-muted-foreground">
            Voce pode solicitar acesso, correcao ou exclusao de dados pessoais, respeitadas as obrigacoes legais e de
            seguranca aplicaveis.
          </p>

          <h2 className="mb-2 mt-5 font-semibold">7. Contato</h2>
          <p className="text-sm text-muted-foreground">
            Para assuntos de privacidade e dados, entre em contato pelo email:{" "}
            <a className="text-primary underline-offset-4 hover:underline" href="mailto:contato@ad-hub.digital">
              contato@ad-hub.digital
            </a>
            .
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

