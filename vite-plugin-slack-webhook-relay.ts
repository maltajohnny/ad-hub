import type { Connect, Plugin } from "vite";

const SLACK_HOOK_PREFIX = "https://hooks.slack.com/services/";
const MAX_BYTES = 4 * 1024 * 1024;
const TTL_MS = 15 * 60 * 1000;

function isAllowedQuickChartUrl(u: string): boolean {
  try {
    const x = new URL(u);
    return x.protocol === "https:" && x.hostname === "quickchart.io" && x.pathname.startsWith("/chart");
  } catch {
    return false;
  }
}

type PngStore = Map<string, { png: Buffer; expires: number }>;

function cleanup(store: PngStore) {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.expires < now) store.delete(k);
  }
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok) throw new Error(`fetch ${r.status}`);
  const ab = await r.arrayBuffer();
  if (ab.byteLength > MAX_BYTES) throw new Error("too large");
  return Buffer.from(ab);
}

/** Mesma largura lógica do gráfico de linhas (900px) para alinhar no Slack. */
const COMPOSITE_TARGET_WIDTH = 900;

async function mergeBudgetPng(leftUrl: string, rightUrl: string): Promise<Buffer> {
  const Jimp = (await import("jimp")).default;
  const [leftBuf, rightBuf] = await Promise.all([fetchBuffer(leftUrl), fetchBuffer(rightUrl)]);
  const left = await Jimp.read(leftBuf);
  const right = await Jimp.read(rightBuf);
  const gap = 10;
  const padX = 6;
  const padY = 6;
  const h = Math.max(left.getHeight(), right.getHeight());
  const totalW = padX + left.getWidth() + gap + right.getWidth() + padX;
  const totalH = h + padY * 2;
  const canvas = new Jimp(totalW, totalH, "#1e293b");
  canvas.composite(left, padX, padY + Math.floor((h - left.getHeight()) / 2));
  canvas.composite(right, padX + left.getWidth() + gap, padY + Math.floor((h - right.getHeight()) / 2));
  if (canvas.getWidth() !== COMPOSITE_TARGET_WIDTH) {
    canvas.resize(COMPOSITE_TARGET_WIDTH, Jimp.AUTO);
  }
  return canvas.getBufferAsync(Jimp.MIME_PNG);
}

function getPublicBase(req: { headers: { host?: string; "x-forwarded-proto"?: string } }): string {
  const xf = req.headers["x-forwarded-proto"]?.split(",")[0]?.trim();
  const proto = xf || "http";
  const host = req.headers.host || "localhost";
  return `${proto}://${host}`;
}

/**
 * Base pública HTTPS para o Slack ir buscar `/api/slack-budget-composite/...png`.
 * Opcional: `SLACK_RELAY_PUBLIC_BASE_URL` no `.env` (ex.: URL ngrok HTTPS) quando o POST ainda vai para localhost.
 */
function getRelayPublicBase(req: { headers: { host?: string; "x-forwarded-proto"?: string } }): string {
  const fromEnv = process.env.SLACK_RELAY_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return getPublicBase(req);
}

function expandSingleBudgetImageToTwo(
  blocks: Array<Record<string, unknown>>,
  merge: { left: string; right: string },
): Array<Record<string, unknown>> {
  const i = blocks.findIndex((b) => b.type === "image" && b.image_url === merge.left);
  if (i < 0) return blocks;
  const out = [...blocks];
  out.splice(i + 1, 0, {
    type: "image",
    image_url: merge.right,
    alt_text: "Rosca: orçamento sugerido pela IA (Meta, Google, Instagram)",
  });
  return out;
}

function budgetCompositeGetMiddleware(store: PngStore): Connect.NextHandleFunction {
  return (req, res, next) => {
    const path = req.url?.split("?")[0] ?? "";
    const m = path.match(/^\/api\/slack-budget-composite\/([^/]+)\.png$/);
    if (req.method !== "GET" || !m) {
      next();
      return;
    }
    cleanup(store);
    const entry = store.get(m[1]);
    if (!entry) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, max-age=60");
    res.end(entry.png);
  };
}

function createRelayMiddleware(store: PngStore): Connect.NextHandleFunction {
  return (req, res, next) => {
    const path = req.url?.split("?")[0] ?? "";
    if (path !== "/api/slack-webhook" || req.method !== "POST") {
      next();
      return;
    }

    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      void (async () => {
        try {
          const raw = Buffer.concat(chunks).toString("utf8");
          const body = JSON.parse(raw) as {
            webhookUrl?: string;
            text?: string;
            blocks?: Array<Record<string, unknown>>;
            budgetMerge?: { left?: string; right?: string };
          };
          const wh = body.webhookUrl?.trim() ?? "";
          if (!wh.startsWith(SLACK_HOOK_PREFIX)) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: "URL de webhook inválida (só hooks.slack.com/services/…)." }));
            return;
          }

          let blocks = body.blocks;
          const merge = body.budgetMerge;
          if (merge?.left && merge?.right && blocks && isAllowedQuickChartUrl(merge.left) && isAllowedQuickChartUrl(merge.right)) {
            const publicBase = getRelayPublicBase(req);
            /** O Slack só aceita `image_url` HTTPS; `http://localhost/...` gera `invalid_blocks`. Defina `SLACK_RELAY_PUBLIC_BASE_URL` (ngrok) em dev. */
            const canUseComposite = publicBase.startsWith("https:");
            if (!canUseComposite) {
              blocks = expandSingleBudgetImageToTwo(blocks, merge as { left: string; right: string });
            } else {
              try {
                const png = await mergeBudgetPng(merge.left, merge.right);
                const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
                cleanup(store);
                store.set(id, { png, expires: Date.now() + TTL_MS });
                const compositeUrl = `${publicBase}/api/slack-budget-composite/${id}.png`;
                blocks = blocks.map((b) =>
                  b.type === "image" && b.image_url === merge.left ? { ...b, image_url: compositeUrl } : b,
                );
              } catch (e) {
                console.error("[slack-relay] budget merge failed", e);
                blocks = expandSingleBudgetImageToTwo(blocks, merge as { left: string; right: string });
              }
            }
          }

          const r = await fetch(wh, {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify({ text: body.text, blocks }),
          });
          const slackBody = await r.text();
          res.statusCode = r.status;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ ok: r.ok, slack: slackBody }));
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: msg }));
        }
      })();
    });
  };
}

/**
 * O Slack não permite CORS em Incoming Webhooks; o browser bloqueia `fetch` direto.
 * Este middleware reencaminha o POST a partir do próprio servidor (Node), sem CORS.
 * Opcionalmente junta as duas roscas QuickChart num PNG (~900px de largura) em `/api/slack-budget-composite/:id.png`.
 * Para o Slack carregar em HTTPS sem deploy: `SLACK_RELAY_PUBLIC_BASE_URL=https://…ngrok…` no `.env`.
 */
export function slackWebhookRelayPlugin(): Plugin {
  const store: PngStore = new Map();
  const getMw = budgetCompositeGetMiddleware(store);
  const relayMw = createRelayMiddleware(store);
  return {
    name: "slack-webhook-relay",
    configureServer(server) {
      server.middlewares.use(getMw);
      server.middlewares.use(relayMw);
    },
    configurePreviewServer(server) {
      server.middlewares.use(getMw);
      server.middlewares.use(relayMw);
    },
  };
}
