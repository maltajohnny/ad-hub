/**
 * Relay POST /api/slack-webhook (Vercel Serverless).
 * Espelha o comportamento do `vite-plugin-slack-webhook-relay` sem Jimp: junta as duas roscas
 * QuickChart em dois blocos `image` (fallback seguro para Slack em HTTPS).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const SLACK_HOOK_PREFIX = "https://hooks.slack.com/services/";

function isAllowedQuickChartUrl(u: string): boolean {
  try {
    const x = new URL(u);
    return x.protocol === "https:" && x.hostname === "quickchart.io" && x.pathname.startsWith("/chart");
  } catch {
    return false;
  }
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body =
      typeof req.body === "string"
        ? (JSON.parse(req.body) as {
            webhookUrl?: string;
            text?: string;
            blocks?: Array<Record<string, unknown>>;
            budgetMerge?: { left?: string; right?: string };
          })
        : (req.body as {
            webhookUrl?: string;
            text?: string;
            blocks?: Array<Record<string, unknown>>;
            budgetMerge?: { left?: string; right?: string };
          });

    const wh = body.webhookUrl?.trim() ?? "";
    if (!wh.startsWith(SLACK_HOOK_PREFIX)) {
      res.status(400).json({ error: "URL de webhook inválida (só hooks.slack.com/services/…)." });
      return;
    }

    let blocks = body.blocks;
    const merge = body.budgetMerge;
    if (
      merge?.left &&
      merge?.right &&
      blocks &&
      isAllowedQuickChartUrl(merge.left) &&
      isAllowedQuickChartUrl(merge.right)
    ) {
      blocks = expandSingleBudgetImageToTwo(blocks, merge as { left: string; right: string });
    }

    const r = await fetch(wh, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ text: body.text, blocks }),
    });
    const slackBody = await r.text();
    res.status(r.status).json({ ok: r.ok, slack: slackBody });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
}
