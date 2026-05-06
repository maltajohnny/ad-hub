/**
 * Cloudflare Worker - Google Ads OAuth callback bridge.
 *
 * Routes:
 * - GET /google-ads/callback
 *
 * Required Worker env vars:
 * - APP_URL (e.g. https://ad-hub.digital)
 * - API_FINISH_URL (e.g. https://ad-hub.digital/api/ad-hub/insight-hub/oauth/google-ads/finish)
 * - CALLBACK_SHARED_SECRET (must match backend INSIGHT_HUB_OAUTH_CALLBACK_SHARED_SECRET)
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/google-ads/callback") {
      return new Response("Not found", { status: 404 });
    }

    const error = (url.searchParams.get("error") || "").trim();
    const state = (url.searchParams.get("state") || "").trim();
    const code = (url.searchParams.get("code") || "").trim();
    const appUrl = String(env.APP_URL || "").trim();
    const finishUrl = String(env.API_FINISH_URL || "").trim();
    const sharedSecret = String(env.CALLBACK_SHARED_SECRET || "").trim();

    if (!appUrl || !finishUrl || !sharedSecret) {
      return new Response("Worker env vars missing", { status: 500 });
    }

    if (error) {
      const target = new URL("/clientes/insight-hub/marcas", appUrl);
      target.searchParams.set("ih_error", error);
      return Response.redirect(target.toString(), 302);
    }

    if (!state || !code) {
      const target = new URL("/clientes/insight-hub/marcas", appUrl);
      target.searchParams.set("ih_error", "missing_state");
      return Response.redirect(target.toString(), 302);
    }

    let response;
    try {
      response = await fetch(finishUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-callback-secret": sharedSecret,
        },
        body: JSON.stringify({ state, code }),
      });
    } catch (_err) {
      const target = new URL("/clientes/insight-hub/marcas", appUrl);
      target.searchParams.set("ih_error", "bridge_request_failed");
      return Response.redirect(target.toString(), 302);
    }

    let payload = {};
    try {
      payload = await response.json();
    } catch (_err) {
      payload = {};
    }

    if (!response.ok) {
      const target = new URL("/clientes/insight-hub/marcas", appUrl);
      const reason = typeof payload.error === "string" && payload.error ? payload.error : "bridge_finish_failed";
      target.searchParams.set("ih_error", reason);
      return Response.redirect(target.toString(), 302);
    }

    const connection = typeof payload.connection === "string" ? payload.connection.trim() : "";
    const returnPath = typeof payload.returnPath === "string" ? payload.returnPath.trim() : "";

    const target = new URL(returnPath || "/clientes/insight-hub/marcas", appUrl);
    if (connection) {
      target.searchParams.set("ih_connected", connection);
    }
    return Response.redirect(target.toString(), 302);
  },
};
