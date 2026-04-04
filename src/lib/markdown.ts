import { marked } from "marked";
import TurndownService from "turndown";

marked.setOptions({ gfm: true, breaks: true });

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

/** Converte Markdown armazenado em HTML para o TipTap. */
export function markdownToHtml(md: string): string {
  const s = (md ?? "").trim();
  if (!s) return "<p></p>";
  const out = marked.parse(s) as string;
  return out || "<p></p>";
}

/** Converte HTML do editor para Markdown ao salvar. */
export function htmlToMarkdown(html: string): string {
  const h = (html ?? "").trim();
  if (!h || h === "<p></p>") return "";
  return turndown.turndown(h).trim();
}

/** Heurística simples para colar texto como Markdown. */
export function looksLikeMarkdown(text: string): boolean {
  const t = text.trim();
  if (t.length < 2) return false;
  if (/^#{1,6}\s/m.test(t)) return true;
  if (/^\s*[-*+]\s/m.test(t)) return true;
  if (/^\s*\d+\.\s/m.test(t)) return true;
  if (t.includes("```")) return true;
  if (/\[.+\]\(.+\)/.test(t)) return true;
  if (/\*\*.+\*\*/.test(t) || /__[^_]+__/.test(t)) return true;
  if (/\n\n/.test(t) && /[#>*`-]/.test(t)) return true;
  return false;
}
