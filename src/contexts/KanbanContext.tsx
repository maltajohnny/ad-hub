import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { clientsData } from "@/pages/Clientes";

const LEGACY_STORAGE_KEY = "norter_kanban_state_v1";

export type WorkItemType = "epic" | "feature" | "user_story" | "task";

export type KanbanColumn = {
  id: string;
  title: string;
  order: number;
  /** Limite WIP (máx. de cards na coluna). `null` ou omitido = sem limite. */
  wipLimit?: number | null;
};

/** Anexo persistido (base64) — adequado a demonstração/localStorage; volumes grandes exigiriam backend. */
export type KanbanAttachment = {
  id: string;
  name: string;
  mime: string;
  /** data URL (ex.: data:image/png;base64,...) */
  dataUrl: string;
};

export type KanbanCard = {
  id: string;
  /** Número exibido no board (único por cliente; sequencial tipo Azure). */
  workItemNumber: number;
  columnId: string;
  type: WorkItemType;
  title: string;
  parentId: string | null;
  tags: string[];
  /** Descrição (Markdown). */
  description: string;
  /** Critérios de aceite (Markdown). */
  acceptanceCriteria: string;
  /** Discussão / comentários (Markdown). */
  discussion: string;
  /** Ficheiros e imagens anexados ao card. */
  attachments: KanbanAttachment[];
  /** Username do responsável (registo de utilizadores). */
  assigneeUsername: string | null;
  order: number;
};

export type KanbanState = { columns: KanbanColumn[]; cards: KanbanCard[] };

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: "col_backlog", title: "Backlog", order: 0, wipLimit: null },
  { id: "col_progress", title: "Em progresso", order: 1, wipLimit: null },
  { id: "col_done", title: "Concluído", order: 2, wipLimit: null },
];

function normalizeColumn(c: KanbanColumn): KanbanColumn {
  const w = c.wipLimit;
  const wipLimit = w != null && w > 0 ? Math.floor(w) : null;
  return { ...c, wipLimit };
}

function storageKey(clientId: number) {
  return `norter_kanban_v2_client_${clientId}`;
}

function seqKey(clientId: number) {
  return `norter_wi_seq_${clientId}`;
}

function migrateLegacyIfNeeded(clientId: number): KanbanState | null {
  if (clientId !== 1) return null;
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as KanbanState;
    if (!p.columns?.length) return null;
    const cards = (p.cards ?? []).map((c, i) => {
      const k = c as KanbanCard & {
        workItemNumber?: number;
        description?: string;
        acceptanceCriteria?: string;
        discussion?: string;
        attachments?: KanbanAttachment[];
      };
      return {
        ...c,
        workItemNumber: k.workItemNumber ?? 20001 + i,
        description: k.description ?? "",
        acceptanceCriteria: k.acceptanceCriteria ?? "",
        discussion: k.discussion ?? "",
        attachments: k.attachments ?? [],
        assigneeUsername: k.assigneeUsername ?? null,
      } as KanbanCard;
    });
    const next: KanbanState = {
      columns: p.columns.map((col: KanbanColumn) => normalizeColumn(col)),
      cards,
    };
    localStorage.setItem(storageKey(1), JSON.stringify(next));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    const maxN = cards.reduce((m, c) => Math.max(m, c.workItemNumber), 20000);
    localStorage.setItem(seqKey(1), String(maxN + 1));
    return next;
  } catch {
    return null;
  }
}

function load(clientId: number): KanbanState {
  try {
    const migrated = migrateLegacyIfNeeded(clientId);
    if (migrated) return migrated;

    const raw = localStorage.getItem(storageKey(clientId));
    if (!raw) return { columns: [...DEFAULT_COLUMNS], cards: [] };
    const p = JSON.parse(raw) as KanbanState;
    if (!p.columns?.length) return { columns: [...DEFAULT_COLUMNS], cards: p.cards ?? [] };
    const columns = (p.columns as KanbanColumn[]).map((col) => normalizeColumn(col));
    const cards = (p.cards ?? []).map((c, i) => {
      const k = c as KanbanCard & {
        workItemNumber?: number;
        description?: string;
        acceptanceCriteria?: string;
        discussion?: string;
        attachments?: KanbanAttachment[];
      };
      return {
        ...c,
        workItemNumber: k.workItemNumber ?? 20001 + i,
        description: k.description ?? "",
        acceptanceCriteria: k.acceptanceCriteria ?? "",
        discussion: k.discussion ?? "",
        attachments: k.attachments ?? [],
        assigneeUsername: k.assigneeUsername ?? null,
      } as KanbanCard;
    });
    return { columns, cards };
  } catch {
    return { columns: [...DEFAULT_COLUMNS], cards: [] };
  }
}

function persist(clientId: number, state: KanbanState) {
  localStorage.setItem(storageKey(clientId), JSON.stringify(state));
}

function nextWorkItemNumber(clientId: number, cards: KanbanCard[]): number {
  const key = seqKey(clientId);
  const stored = parseInt(localStorage.getItem(key) || "20001", 10);
  const maxFromCards = cards.length ? Math.max(...cards.map((c) => c.workItemNumber ?? 0)) : 0;
  const n = Math.max(stored, maxFromCards + 1);
  localStorage.setItem(key, String(n + 1));
  return n;
}

function uid() {
  return `k_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeOrders(cards: KanbanCard[]): KanbanCard[] {
  const colIds = [...new Set(cards.map((c) => c.columnId))];
  const out: KanbanCard[] = [];
  for (const colId of colIds) {
    const list = cards
      .filter((c) => c.columnId === colId)
      .sort((a, b) => a.order - b.order);
    list.forEach((c, i) => out.push({ ...c, order: i }));
  }
  return out;
}

export function validateParent(type: WorkItemType, parentId: string | null, cards: KanbanCard[]): string | null {
  if (type === "epic") return parentId ? "Épico não possui pai." : null;
  if (!parentId) return "Selecione um item pai na hierarquia.";
  const parent = cards.find((c) => c.id === parentId);
  if (!parent) return "Pai não encontrado.";
  if (type === "feature" && parent.type !== "epic") return "Feature deve estar sob um Épico.";
  if (type === "user_story" && parent.type !== "feature") return "User Story deve estar sob uma Feature.";
  if (type === "task" && parent.type !== "user_story") return "Task deve estar sob uma User Story.";
  return null;
}

type KanbanContextType = {
  boardClientId: number;
  setBoardClientId: (clientId: number) => void;
  state: KanbanState;
  addColumn: (title: string) => void;
  removeColumn: (columnId: string) => void;
  updateColumnWip: (columnId: string, wipLimit: number | null) => void;
  addCard: (input: {
    columnId: string;
    type: WorkItemType;
    title: string;
    parentId: string | null;
    tags: string[];
    assigneeUsername?: string | null;
    description?: string;
  }) => { ok: boolean; error?: string };
  updateCardTitle: (cardId: string, title: string) => { ok: boolean; error?: string };
  updateCardDescription: (cardId: string, description: string) => void;
  updateCardAcceptanceCriteria: (cardId: string, acceptanceCriteria: string) => void;
  updateCardDiscussion: (cardId: string, discussion: string) => void;
  updateCardAttachments: (cardId: string, attachments: KanbanAttachment[]) => void;
  updateCardAssignee: (cardId: string, assigneeUsername: string | null) => void;
  updateCardTags: (cardId: string, tags: string[]) => void;
  moveCard: (cardId: string, newColumnId: string, newIndex: number) => void;
  reorderInColumn: (columnId: string, orderedIds: string[]) => void;
  applyBoardLayout: (layout: Record<string, string[]>) => void;
  cardById: (id: string) => KanbanCard | undefined;
};

const KanbanContext = createContext<KanbanContextType | null>(null);

const SESSION_CLIENT_KEY = "norter_board_client_id";

function parseRoiString(roi: string): number {
  const n = parseFloat(roi.replace(/x/gi, "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
}

/** Cliente com maior ROI (dados demo) — usado como predefinição quando não há sessão. */
function bestClientIdByPerformance(): number {
  if (!clientsData.length) return 1;
  const sorted = [...clientsData].sort((a, b) => parseRoiString(b.roi) - parseRoiString(a.roi));
  return sorted[0].id;
}

function readInitialClientId(): number {
  try {
    const s = sessionStorage.getItem(SESSION_CLIENT_KEY);
    if (s) {
      const n = parseInt(s, 10);
      if (!Number.isNaN(n) && n > 0) return n;
    }
  } catch {
    /* ignore */
  }
  return bestClientIdByPerformance();
}

export const KanbanProvider = ({ children }: { children: ReactNode }) => {
  const [boardClientId, setBoardClientIdState] = useState<number>(readInitialClientId);
  const [state, setState] = useState<KanbanState>(() => load(boardClientId));

  useEffect(() => {
    setState(load(boardClientId));
  }, [boardClientId]);

  const setBoardClientId = useCallback((clientId: number) => {
    if (clientId <= 0) return;
    sessionStorage.setItem(SESSION_CLIENT_KEY, String(clientId));
    setBoardClientIdState(clientId);
  }, []);

  const sync = useCallback(
    (next: KanbanState) => {
      setState(next);
      persist(boardClientId, next);
    },
    [boardClientId],
  );

  const addColumn = useCallback(
    (title: string) => {
      const t = title.trim();
      if (!t) return;
      setState((s) => {
        const maxOrder = Math.max(0, ...s.columns.map((c) => c.order));
        const next: KanbanState = {
          ...s,
          columns: [...s.columns, { id: uid(), title: t, order: maxOrder + 1, wipLimit: null }].sort(
            (a, b) => a.order - b.order,
          ),
        };
        persist(boardClientId, next);
        return next;
      });
    },
    [boardClientId],
  );

  const updateColumnWip = useCallback(
    (columnId: string, wipLimit: number | null) => {
      setState((s) => {
        const next: KanbanState = {
          ...s,
          columns: s.columns.map((c) =>
            c.id === columnId ? normalizeColumn({ ...c, wipLimit }) : c,
          ),
        };
        persist(boardClientId, next);
        return next;
      });
    },
    [boardClientId],
  );

  const removeColumn = useCallback(
    (columnId: string) => {
      setState((s) => {
        if (s.columns.length <= 1) return s;
        const fallback = s.columns.find((c) => c.id !== columnId)?.id;
        if (!fallback) return s;
        const next: KanbanState = {
          columns: s.columns.filter((c) => c.id !== columnId),
          cards: s.cards.map((c) => (c.columnId === columnId ? { ...c, columnId: fallback } : c)),
        };
        persist(boardClientId, next);
        return next;
      });
    },
    [boardClientId],
  );

  const addCard = useCallback(
    (input: {
      columnId: string;
      type: WorkItemType;
      title: string;
      parentId: string | null;
      tags: string[];
      assigneeUsername?: string | null;
      description?: string;
    }): { ok: boolean; error?: string } => {
      const title = input.title.trim();
      if (!title) return { ok: false, error: "Informe o título." };
      let out: { ok: boolean; error?: string } = { ok: true };
      setState((s) => {
        const err = validateParent(input.type, input.parentId, s.cards);
        if (err) {
          out = { ok: false, error: err };
          return s;
        }
        const inCol = s.cards.filter((c) => c.columnId === input.columnId);
        const order = inCol.length ? Math.max(...inCol.map((c) => c.order)) + 1 : 0;
        const wi = nextWorkItemNumber(boardClientId, s.cards);
        const card: KanbanCard = {
          id: uid(),
          workItemNumber: wi,
          columnId: input.columnId,
          type: input.type,
          title,
          parentId: input.parentId,
          tags: input.tags.map((t) => t.trim()).filter(Boolean),
          description: (input.description ?? "").trim(),
          acceptanceCriteria: "",
          discussion: "",
          attachments: [],
          assigneeUsername: input.assigneeUsername?.trim() || null,
          order,
        };
        const next = { ...s, cards: [...s.cards, card] };
        persist(boardClientId, next);
        out = { ok: true };
        return next;
      });
      return out;
    },
    [boardClientId],
  );

  const updateCardTitle = useCallback(
    (cardId: string, title: string): { ok: boolean; error?: string } => {
      const t = title.trim();
      if (!t) return { ok: false, error: "O título não pode ficar vazio." };
      setState((s) => {
        const next = {
          ...s,
          cards: s.cards.map((c) => (c.id === cardId ? { ...c, title: t } : c)),
        };
        persist(boardClientId, next);
        return next;
      });
      return { ok: true };
    },
    [boardClientId],
  );

  const updateCardDescription = useCallback(
    (cardId: string, description: string) => {
      setState((s) => {
        const next = {
          ...s,
          cards: s.cards.map((c) => (c.id === cardId ? { ...c, description } : c)),
        };
        persist(boardClientId, next);
        return next;
      });
    },
    [boardClientId],
  );

  const updateCardAcceptanceCriteria = useCallback(
    (cardId: string, acceptanceCriteria: string) => {
      setState((s) => {
        const next = {
          ...s,
          cards: s.cards.map((c) => (c.id === cardId ? { ...c, acceptanceCriteria } : c)),
        };
        persist(boardClientId, next);
        return next;
      });
    },
    [boardClientId],
  );

  const updateCardDiscussion = useCallback(
    (cardId: string, discussion: string) => {
      setState((s) => {
        const next = {
          ...s,
          cards: s.cards.map((c) => (c.id === cardId ? { ...c, discussion } : c)),
        };
        persist(boardClientId, next);
        return next;
      });
    },
    [boardClientId],
  );

  const updateCardAttachments = useCallback(
    (cardId: string, attachments: KanbanAttachment[]) => {
      setState((s) => {
        const next = {
          ...s,
          cards: s.cards.map((c) => (c.id === cardId ? { ...c, attachments } : c)),
        };
        persist(boardClientId, next);
        return next;
      });
    },
    [boardClientId],
  );

  const updateCardAssignee = useCallback(
    (cardId: string, assigneeUsername: string | null) => {
      setState((s) => {
        const next = {
          ...s,
          cards: s.cards.map((c) => (c.id === cardId ? { ...c, assigneeUsername } : c)),
        };
        persist(boardClientId, next);
        return next;
      });
    },
    [boardClientId],
  );

  const updateCardTags = useCallback(
    (cardId: string, tags: string[]) => {
      setState((s) => {
        const next = {
          ...s,
          cards: s.cards.map((c) => (c.id === cardId ? { ...c, tags } : c)),
        };
        persist(boardClientId, next);
        return next;
      });
    },
    [boardClientId],
  );

  const moveCard = useCallback(
    (cardId: string, newColumnId: string, newIndex: number) => {
      setState((s) => {
        const card = s.cards.find((c) => c.id === cardId);
        if (!card) return s;
        const rest = s.cards.filter((c) => c.id !== cardId);
        const inTarget = rest.filter((c) => c.columnId === newColumnId).sort((a, b) => a.order - b.order);
        const inserted = [
          ...inTarget.slice(0, newIndex),
          { ...card, columnId: newColumnId },
          ...inTarget.slice(newIndex),
        ].map((c, i) => ({ ...c, order: i }));
        const others = rest.filter((c) => c.columnId !== newColumnId);
        const merged = [...others, ...inserted];
        const nextCards = normalizeOrders(merged);
        const next = { ...s, cards: nextCards };
        persist(boardClientId, next);
        return next;
      });
    },
    [boardClientId],
  );

  const reorderInColumn = useCallback(
    (columnId: string, orderedIds: string[]) => {
      setState((s) => {
        const map = new Map(orderedIds.map((id, i) => [id, i] as const));
        const nextCards = normalizeOrders(
          s.cards.map((c) => {
            if (c.columnId !== columnId) return c;
            const idx = map.get(c.id);
            if (idx === undefined) return c;
            return { ...c, order: idx };
          }),
        );
        const next = { ...s, cards: nextCards };
        persist(boardClientId, next);
        return next;
      });
    },
    [boardClientId],
  );

  const applyBoardLayout = useCallback(
    (layout: Record<string, string[]>) => {
      setState((s) => {
        const allIds = new Set(s.cards.map((c) => c.id));
        const flat = Object.values(layout).flat();
        if (flat.length !== allIds.size || new Set(flat).size !== flat.length) return s;
        for (const id of flat) {
          if (!allIds.has(id)) return s;
        }
        const colIds = new Set(s.columns.map((c) => c.id));
        const nextCards = s.cards.map((c) => {
          for (const [colId, ids] of Object.entries(layout)) {
            if (!colIds.has(colId)) continue;
            const idx = ids.indexOf(c.id);
            if (idx >= 0) return { ...c, columnId: colId, order: idx };
          }
          return c;
        });
        const normalized = normalizeOrders(nextCards);
        const next = { ...s, cards: normalized };
        persist(boardClientId, next);
        return next;
      });
    },
    [boardClientId],
  );

  const cardById = useCallback(
    (id: string) => state.cards.find((c) => c.id === id),
    [state.cards],
  );

  const value = useMemo(
    () => ({
      boardClientId,
      setBoardClientId,
      state,
      addColumn,
      removeColumn,
      updateColumnWip,
      addCard,
      updateCardTitle,
      updateCardDescription,
      updateCardAcceptanceCriteria,
      updateCardDiscussion,
      updateCardAttachments,
      updateCardAssignee,
      updateCardTags,
      moveCard,
      reorderInColumn,
      applyBoardLayout,
      cardById,
    }),
    [
      boardClientId,
      setBoardClientId,
      state,
      addColumn,
      removeColumn,
      updateColumnWip,
      addCard,
      updateCardTitle,
      updateCardDescription,
      updateCardAcceptanceCriteria,
      updateCardDiscussion,
      updateCardAttachments,
      updateCardAssignee,
      updateCardTags,
      moveCard,
      reorderInColumn,
      applyBoardLayout,
      cardById,
    ],
  );

  return <KanbanContext.Provider value={value}>{children}</KanbanContext.Provider>;
};

export const useKanban = () => {
  const ctx = useContext(KanbanContext);
  if (!ctx) throw new Error("useKanban must be used within KanbanProvider");
  return ctx;
};
