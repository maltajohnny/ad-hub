/**
 * GET /api/intellisearch/ping
 * JavaScript puro (sem TypeScript/bundling @vercel/node) — evita falhas de invocação.
 * @see https://vercel.com/docs/errors/FUNCTION_INVOCATION_FAILED
 */
export default function handler(req, res) {
  try {
    const body = JSON.stringify({
      ok: true,
      route: "intellisearch/ping",
      t: Date.now(),
      fmt: "js",
    });
    if (!res.headersSent) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    res.end(body);
  } catch (err) {
    try {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      }
      res.end(
        JSON.stringify({
          error: err && err.message ? err.message : String(err),
          doc: "https://vercel.com/docs/errors/FUNCTION_INVOCATION_FAILED",
        }),
      );
    } catch (_) {
      /* ignorar */
    }
  }
}
