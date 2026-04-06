/** Normaliza o título para o segmento guardado `#[n] [título]` (evita quebrar HTML/Markdown). */
export function sanitizeCardMentionTitle(title: string): string {
  return (title ?? "")
    .replace(/[\[\]]/g, "")
    .replace(/[<>]/g, "")
    .trim() || "—";
}

/** Texto persistido ao escolher um card na lista (Markdown / texto plano). */
export function formatCardMentionChunk(workItemNumber: number, title: string): string {
  return `#${workItemNumber} [${sanitizeCardMentionTitle(title)}] `;
}

/** Trecho `#` + dígitos opcionais antes do cursor (referência a card). */
export function getMentionRange(
  value: string,
  caret: number,
): { start: number; end: number; query: string } | null {
  const before = value.slice(0, caret);
  const hashIdx = before.lastIndexOf("#");
  if (hashIdx === -1) return null;
  if (hashIdx > 0) {
    const prev = value[hashIdx - 1];
    if (prev !== " " && prev !== "\n" && prev !== "\t") return null;
  }
  const afterHash = before.slice(hashIdx + 1);
  if (!/^\d*$/.test(afterHash)) return null;
  return { start: hashIdx, end: caret, query: afterHash };
}

/** Posição do caret em `input` ou `textarea` (viewport), para ancorar o painel. */
export function getCaretClientRect(
  el: HTMLInputElement | HTMLTextAreaElement,
  position: number,
): DOMRect {
  const div = document.createElement("div");
  const taRect = el.getBoundingClientRect();
  const cs = window.getComputedStyle(el);
  div.style.position = "fixed";
  div.style.left = `${taRect.left}px`;
  div.style.top = `${taRect.top}px`;
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  div.style.overflow = "hidden";
  div.style.width = `${el.clientWidth}px`;
  div.style.font = cs.font;
  div.style.padding = cs.padding;
  div.style.border = cs.border;
  div.style.boxSizing = cs.boxSizing;
  div.style.lineHeight = cs.lineHeight;
  div.style.letterSpacing = cs.letterSpacing;
  const text = el.value.substring(0, position);
  const marker = document.createElement("span");
  marker.textContent = el.value.substring(position) || "\u200b";
  div.appendChild(document.createTextNode(text));
  div.appendChild(marker);
  document.body.appendChild(div);
  const r = marker.getBoundingClientRect();
  document.body.removeChild(div);
  return r;
}

export type PlaceMentionPanelOptions = {
  /**
   * `below`: abaixo do caret (inputs simples).
   * `inline-end`: à direita do cursor, na mesma linha (editores ricos / completamento tipo Azure DevOps).
   */
  placement?: "below" | "inline-end";
};

export function placeMentionPanel(
  near: DOMRect,
  panelW: number,
  panelH: number,
  opts?: PlaceMentionPanelOptions,
): { top: number; left: number } {
  const pad = 8;
  const placement = opts?.placement ?? "below";

  if (placement === "inline-end") {
    /** Logo a seguir ao texto (bordo direito do caret); se não couber, abre à esquerda do caret. */
    let left = near.right + 4;
    let top = near.top;
    if (left + panelW > window.innerWidth - pad) {
      left = near.left - panelW - 4;
    }
    if (left < pad) left = pad;
    if (top + panelH > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - panelH - pad);
    }
    if (top < pad) top = pad;
    return { top, left };
  }

  let left = near.left;
  /** Preferir abaixo do caret; se não couber, abrir por cima. */
  let top = near.bottom + 4;
  if (left + panelW > window.innerWidth - pad) left = window.innerWidth - panelW - pad;
  if (left < pad) left = pad;
  if (top + panelH > window.innerHeight - pad) {
    top = near.top - panelH - 4;
  }
  if (top < pad) top = pad;
  return { top, left };
}

/** Vista mínima do ProseMirror (evita dependência de tipo explícita no resto da app). */
export type MinimalProseMirrorView = {
  coordsAtPos: (pos: number, side?: number) => { left: number; top: number; right: number; bottom: number };
  domAtPos: (pos: number) => { node: Node; offset: number };
  dom: HTMLElement;
};

type PmRect = { left: number; right: number; top: number; bottom: number };

function rectCenterInEditor(r: PmRect, eb: DOMRect, margin: number): boolean {
  const cx = (r.left + r.right) / 2;
  const cy = (r.top + r.bottom) / 2;
  return (
    cx >= eb.left - margin &&
    cx <= eb.right + margin &&
    cy >= eb.top - margin &&
    cy <= eb.bottom + margin
  );
}

function pmRectToDomRect(r: PmRect): DOMRect {
  const left = Math.min(r.left, r.right);
  const top = Math.min(r.top, r.bottom);
  const w = Math.max(Math.abs(r.right - r.left), 2);
  const h = Math.max(Math.abs(r.bottom - r.top), 12);
  return new DOMRect(left, top, w, h);
}

function firstTextDescendant(n: Node): Text | null {
  if (n.nodeType === Node.TEXT_NODE) return n as Text;
  for (let c = n.firstChild; c; c = c.nextSibling) {
    const t = firstTextDescendant(c);
    if (t) return t;
  }
  return null;
}

function lastTextDescendant(n: Node): Text | null {
  if (n.nodeType === Node.TEXT_NODE) return n as Text;
  for (let c = n.lastChild; c; c = c.previousSibling) {
    const t = lastTextDescendant(c);
    if (t) return t;
  }
  return null;
}

/** Range no DOM para `pos` (texto ou filho de bloco), para quando coordsAtPos falha. */
function caretRectFromDomAtPos(view: MinimalProseMirrorView, pos: number): DOMRect | null {
  try {
    const { node, offset } = view.domAtPos(pos);

    const fromText = (n: Text, o: number): DOMRect | null => {
      const len = n.length;
      const o2 = Math.min(Math.max(0, o), len);
      const range = document.createRange();
      range.setStart(n, o2);
      range.setEnd(n, o2);
      const rects = range.getClientRects();
      if (rects.length > 0) {
        const r = rects[0];
        return new DOMRect(r.left, r.top, Math.max(r.width, 2), Math.max(r.height, 12));
      }
      return null;
    };

    if (node.nodeType === Node.TEXT_NODE) {
      return fromText(node as Text, offset);
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const kids = el.childNodes;
      if (offset < kids.length) {
        const child = kids[offset];
        if (child.nodeType === Node.TEXT_NODE) {
          return fromText(child as Text, 0);
        }
        const t0 = firstTextDescendant(child);
        if (t0) return fromText(t0, 0);
      } else if (kids.length > 0) {
        const last = kids[kids.length - 1];
        if (last.nodeType === Node.TEXT_NODE) {
          const t = last as Text;
          return fromText(t, t.length);
        }
        const t1 = lastTextDescendant(last);
        if (t1) return fromText(t1, t1.length);
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Retângulo do caret colapsado em `pos` (viewport), para ancorar menções.
 * Usa primeiro o lado **depois** do cursor (`coordsAtPos(pos, 1)`) para o painel ficar
 * logo à direita de `#`, `#2`, etc. — não faz união com o lado -1 (isso puxava o âncora
 * para o início do `#` e impedia o painel de seguir o texto).
 */
export function getProseMirrorMentionAnchorRect(view: MinimalProseMirrorView, pos: number): DOMRect {
  const eb = view.dom.getBoundingClientRect();
  const margin = 48;
  const editorOk = eb.width > 2 && eb.height > 2;

  const trySide = (side: -1 | 1): DOMRect | null => {
    try {
      const c = view.coordsAtPos(pos, side);
      if (!Number.isFinite(c.left) || !Number.isFinite(c.top)) return null;
      if (editorOk && !rectCenterInEditor(c, eb, margin)) return null;
      return pmRectToDomRect(c);
    } catch {
      return null;
    }
  };

  const fromDom = (): DOMRect | null => {
    const r = caretRectFromDomAtPos(view, pos);
    if (!r) return null;
    if (editorOk) {
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (
        cx < eb.left - margin ||
        cx > eb.right + margin ||
        cy < eb.top - margin ||
        cy > eb.bottom + margin
      ) {
        return null;
      }
    }
    return r;
  };

  return (
    trySide(1) ??
    trySide(-1) ??
    fromDom() ??
    new DOMRect(eb.left + 16, eb.top + 24, 2, 18)
  );
}
