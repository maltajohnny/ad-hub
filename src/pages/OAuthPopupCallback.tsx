import { useEffect } from "react";

/**
 * Carregada apenas na janela popup após Meta/TikTok redirecionarem para este URI.
 * Envia o `code` à janela principal via postMessage e fecha o popup.
 */
const OAuthPopupCallback = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    const payload = {
      source: "adhub-oauth" as const,
      code,
      state,
      error,
      error_description: errorDescription,
    };

    const hasOpener = Boolean(window.opener && !window.opener.closed);
    if (hasOpener) {
      try {
        window.opener!.postMessage(payload, window.location.origin);
      } catch {
        /* ignore */
      }
    }

    window.setTimeout(() => {
      window.close();
      if (!hasOpener) {
        document.body.innerHTML =
          '<p style="font-family:system-ui;padding:2rem;text-align:center">Pode fechar esta janela e voltar à plataforma.</p>';
      }
    }, 80);
  }, []);

  return (
    <div className="min-h-[40vh] flex items-center justify-center p-8 text-sm text-muted-foreground">
      A concluir autorização…
    </div>
  );
};

export default OAuthPopupCallback;
