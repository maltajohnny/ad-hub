import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendJson } from "./sendJson";

/**
 * Evita `FUNCTION_INVOCATION_FAILED` por exceção não tratada — alinhado a
 * https://vercel.com/docs/errors/FUNCTION_INVOCATION_FAILED (try/catch + logs).
 */
export function withApiErrorBoundary(
  handler: (req: VercelRequest, res: VercelResponse) => void | Promise<void>,
): (req: VercelRequest, res: VercelResponse) => Promise<void> {
  return async function wrapped(req: VercelRequest, res: VercelResponse): Promise<void> {
    try {
      await Promise.resolve(handler(req, res));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[api] unhandled", err);
      try {
        const r = res as { headersSent?: boolean; writableEnded?: boolean };
        if (!r.headersSent && !r.writableEnded) {
          sendJson(res, 500, {
            error: msg,
            doc: "https://vercel.com/docs/errors/FUNCTION_INVOCATION_FAILED",
            hint: "Veja também os Application Logs do projeto na Vercel.",
          });
        }
      } catch {
        /* não relançar — evita segundo crash */
      }
    }
  };
}
