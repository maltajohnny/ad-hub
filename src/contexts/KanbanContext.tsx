import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

const STORAGE_KEY = "norter_kanban_state_v1";

export type WorkItemType = "epic" | "feature" | "user_story" | "task";

export type KanbanColumn = { id: string; title: string; order: number };

export type KanbanCard = {
  id: string;
  columnId: string;
  type: WorkItemType;
  title: string;
  parentId: string | null;
  tags: string[];
  /** Username do responsável (registo de utilizadores). */
  assigneeUsername: string | null;
  order: number;
};

export type KanbanState = { columns: KanbanColumn[]; cards: KanbanCard[] };

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: "col_backlog", title: "Backlog", order: 0 },
  { id: "col_progress", title: "Em progresso", order: 1 },
  { id: "col_done", title: "Concluído", order: 2 },
];

function load(): KanbanState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { columns: [...DEFAULT_COLUMNS], cards: [] };
    const p = JSON.parse(raw) as KanbanState;
    if (!p.columns?.length) return { columns: [...DEFAULT_COLUMNS], cards: p.cards ?? [] };
    const cards = (p.cards ?? []).map((c) => ({
      ...c,
      assigneeUsername: (c as KanbanCard).assigneeUsername ?? null,
    })) as KanbanCard[];
    return { columns: p.columns, cards };
  } catch {
    return { columns: [...DEFAULT_COLUMNS], cards: [] };
  }
}

function persist(state: KanbanState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  state: KanbanState;
  addColumn: (title: string) => void;
  removeColumn: (columnId: string) => void;
  addCard: (input: {
    columnId: string;
    type: WorkItemType;
    title: string;
    parentId: string | null;
    tags: string[];
    assigneeUsername?: string | null;
  }) => { ok: boolean; error?: string };
  updateCardTitle: (cardId: string, title: string) => { ok: boolean; error?: string };
  updateCardAssignee: (cardId: string, assigneeUsername: string | null) => void;
  updateCardTags: (cardId: string, tags: string[]) => void;
  moveCard: (cardId: string, newColumnId: string, newIndex: number) => void;
  reorderInColumn: (columnId: string, orderedIds: string[]) => void;
  /** Mapa coluna → ids ordenados; deve incluir todos os cards exatamente uma vez. */
  applyBoardLayout: (layout: Record<string, string[]>) => void;
  cardById: (id: string) => KanbanCard | undefined;
};

const KanbanContext = createContext<KanbanContextType | null>(null);

export const KanbanProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<KanbanState>(() => load());

  const sync = useCallback((next: KanbanState) => {
    setState(next);
    persist(next);
  }, []);

  const addColumn = useCallback(
    (title: string) => {
      const t = title.trim();
      if (!t) return;
      setState((s) => {
        const maxOrder = Math.max(0, ...s.columns.map((c) => c.order));
        const next: KanbanState = {
          ...s,
          columns: [...s.columns, { id: uid(), title: t, order: maxOrder + 1 }].sort((a, b) => a.order - b.order),
        };
        persist(next);
        return next;
      });
    },
    [],
  );

  const removeColumn = useCallback((columnId: string) => {
    setState((s) => {
      if (s.columns.length <= 1) return s;
      const fallback = s.columns.find((c) => c.id !== columnId)?.id;
      if (!fallback) return s;
      const next: KanbanState = {
        columns: s.columns.filter((c) => c.id !== columnId),
        cards: s.cards.map((c) => (c.columnId === columnId ? { ...c, columnId: fallback } : c)),
      };
      persist(next);
      return next;
    });
  }, []);

  const addCard = useCallback(
    (input: {
      columnId: string;
      type: WorkItemType;
      title: string;
      parentId: string | null;
      tags: string[];
      assigneeUsername?: string | null;
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
        const card: KanbanCard = {
          id: uid(),
          columnId: input.columnId,
          type: input.type,
          title,
          parentId: input.parentId,
          tags: input.tags.map((t) => t.trim()).filter(Boolean),
          assigneeUsername: input.assigneeUsername?.trim() || null,
          order,
        };
        const next = { ...s, cards: [...s.cards, card] };
        persist(next);
        out = { ok: true };
        return next;
      });
      return out;
    },
    [],
  );

  const updateCardTitle = useCallback((cardId: string, title: string): { ok: boolean; error?: string } => {
    const t = title.trim();
    if (!t) return { ok: false, error: "O título não pode ficar vazio." };
    setState((s) => {
      const next = {
        ...s,
        cards: s.cards.map((c) => (c.id === cardId ? { ...c, title: t } : c)),
      };
      persist(next);
      return next;
    });
    return { ok: true };
  }, []);

  const updateCardAssignee = useCallback((cardId: string, assigneeUsername: string | null) => {
    setState((s) => {
      const next = {
        ...s,
        cards: s.cards.map((c) => (c.id === cardId ? { ...c, assigneeUsername } : c)),
      };
      persist(next);
      return next;
    });
  }, []);

  const updateCardTags = useCallback((cardId: string, tags: string[]) => {
    setState((s) => {
      const next = {
        ...s,
        cards: s.cards.map((c) => (c.id === cardId ? { ...c, tags } : c)),
      };
      persist(next);
      return next;
    });
  }, []);

  const moveCard = useCallback((cardId: string, newColumnId: string, newIndex: number) => {
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
      persist(next);
      return next;
    });
  }, []);

  const reorderInColumn = useCallback((columnId: string, orderedIds: string[]) => {
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
      persist(next);
      return next;
    });
  }, []);

  const applyBoardLayout = useCallback((layout: Record<string, string[]>) => {
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
      persist(next);
      return next;
    });
  }, []);

  const cardById = useCallback(
    (id: string) => state.cards.find((c) => c.id === id),
    [state.cards],
  );

  const value = useMemo(
    () => ({
      state,
      addColumn,
      removeColumn,
      addCard,
      updateCardTitle,
      updateCardAssignee,
      updateCardTags,
      moveCard,
      reorderInColumn,
      applyBoardLayout,
      cardById,
    }),
    [
      state,
      addColumn,
      removeColumn,
      addCard,
      updateCardTitle,
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
