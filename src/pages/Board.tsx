import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuth } from "@/contexts/AuthContext";
import { KanbanCard, useKanban, WorkItemType } from "@/contexts/KanbanContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Columns3, GripVertical, Plus, Tag, Trash2 } from "lucide-react";

const TYPE_LABEL: Record<WorkItemType, string> = {
  epic: "Épico",
  feature: "Feature",
  user_story: "User Story",
  task: "Task",
};

function buildItemsMap(cards: KanbanCard[], columnIds: string[]): Record<string, string[]> {
  const m: Record<string, string[]> = {};
  for (const id of columnIds) m[id] = [];
  for (const colId of columnIds) {
    m[colId] = cards
      .filter((c) => c.columnId === colId)
      .sort((a, b) => a.order - b.order)
      .map((c) => c.id);
  }
  return m;
}

function findContainer(id: string, items: Record<string, string[]>): string | undefined {
  if (id in items) return id;
  return Object.keys(items).find((key) => items[key].includes(id));
}

function SortableKanbanCard({
  card,
  parentTitle,
  filterActive,
  dimmed,
  onEditTags,
}: {
  card: KanbanCard;
  parentTitle: string | null;
  filterActive: boolean;
  dimmed: boolean;
  onEditTags: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: filterActive,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "z-50 opacity-90")}>
      <Card
        className={cn(
          "glass-card p-3 text-sm shadow-sm border-border/60",
          dimmed && "opacity-35 pointer-events-none",
        )}
      >
        <div className="flex gap-2">
          <button
            type="button"
            className={cn(
              "mt-0.5 text-muted-foreground hover:text-foreground shrink-0 touch-none",
              (filterActive || dimmed) && "pointer-events-none opacity-40",
            )}
            aria-label="Arrastar"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={16} />
          </button>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <Badge variant="outline" className="text-[10px] shrink-0">
                {TYPE_LABEL[card.type]}
              </Badge>
            </div>
            <p className="font-medium text-foreground leading-snug break-words">{card.title}</p>
            {parentTitle && (
              <p className="text-xs text-muted-foreground">
                Pai: <span className="text-foreground/90">{parentTitle}</span>
              </p>
            )}
            {card.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {card.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onEditTags}
              disabled={dimmed}
            >
              <Tag size={12} className="mr-1" />
              Tags
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ColumnBody({ columnId, children }: { columnId: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: columnId });
  return (
    <div
      ref={setNodeRef}
      className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] min-h-[120px]"
    >
      {children}
    </div>
  );
}

const Board = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { state, addColumn, removeColumn, addCard, applyBoardLayout, updateCardTags, cardById } = useKanban();

  const sortedColumns = useMemo(
    () => [...state.columns].sort((a, b) => a.order - b.order),
    [state.columns],
  );
  const columnIds = useMemo(() => sortedColumns.map((c) => c.id), [sortedColumns]);

  const [items, setItems] = useState<Record<string, string[]>>(() => buildItemsMap(state.cards, columnIds));
  const [activeId, setActiveId] = useState<string | null>(null);

  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState<WorkItemType | "all">("all");
  const [tagFilter, setTagFilter] = useState<string[]>([]);

  const [colOpen, setColOpen] = useState(false);
  const [colTitle, setColTitle] = useState("");
  const [cardOpen, setCardOpen] = useState(false);
  const [cardColumnId, setCardColumnId] = useState<string>("");
  const [cardType, setCardType] = useState<WorkItemType>("user_story");
  const [cardTitle, setCardTitle] = useState("");
  const [cardParentId, setCardParentId] = useState<string | null>(null);
  const [cardTagsInput, setCardTagsInput] = useState("");
  const [tagsEditOpen, setTagsEditOpen] = useState(false);
  const [tagsEditId, setTagsEditId] = useState<string | null>(null);
  const [tagsEditValue, setTagsEditValue] = useState("");

  const allTags = useMemo(() => {
    const s = new Set<string>();
    state.cards.forEach((c) => c.tags.forEach((t) => s.add(t)));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [state.cards]);

  const filterActive = keyword.trim().length > 0 || typeFilter !== "all" || tagFilter.length > 0;

  const matchesFilters = useCallback(
    (card: KanbanCard) => {
      if (keyword.trim() && !card.title.toLowerCase().includes(keyword.trim().toLowerCase())) return false;
      if (typeFilter !== "all" && card.type !== typeFilter) return false;
      if (tagFilter.length && !tagFilter.every((t) => card.tags.includes(t))) return false;
      return true;
    },
    [keyword, typeFilter, tagFilter],
  );

  useEffect(() => {
    if (activeId === null) {
      setItems(buildItemsMap(state.cards, columnIds));
    }
  }, [state.cards, columnIds, activeId]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    const overId = over?.id != null ? String(over.id) : null;
    if (!overId) return;

    setItems((prev) => {
      const overContainer = findContainer(overId, prev);
      const activeContainer = findContainer(String(active.id), prev);
      if (!overContainer || !activeContainer || activeContainer === overContainer) return prev;

      const activeItems = [...prev[activeContainer]];
      const overItems = [...prev[overContainer]];
      const activeIndex = activeItems.indexOf(String(active.id));
      const overIndex = overItems.indexOf(overId);

      let newIndex: number;
      if (overId in prev) {
        newIndex = overItems.length;
      } else {
        const isBelowOverItem =
          over &&
          active.rect.current.translated &&
          active.rect.current.translated.top > over.rect.top + over.rect.height;
        const modifier = isBelowOverItem ? 1 : 0;
        newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length;
      }

      const moving = activeItems[activeIndex];
      if (moving === undefined) return prev;

      return {
        ...prev,
        [activeContainer]: activeItems.filter((id) => id !== String(active.id)),
        [overContainer]: [
          ...overItems.slice(0, newIndex),
          moving,
          ...overItems.slice(newIndex, overItems.length),
        ],
      };
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    setItems((current) => {
      let next = { ...current };

      if (over && String(active.id) !== String(over.id)) {
        const activeContainer = findContainer(String(active.id), next);
        const overContainer = findContainer(String(over.id), next);
        if (activeContainer && overContainer && activeContainer === overContainer) {
          const ai = next[activeContainer].indexOf(String(active.id));
          const oi = next[overContainer].indexOf(String(over.id));
          if (ai >= 0 && oi >= 0 && ai !== oi) {
            next = {
              ...next,
              [overContainer]: arrayMove(next[overContainer], ai, oi),
            };
          }
        }
      }

      applyBoardLayout(next);
      return next;
    });
  };

  const onDragCancel = () => {
    setActiveId(null);
    setItems(buildItemsMap(state.cards, columnIds));
  };

  const openTagsEdit = (card: KanbanCard) => {
    setTagsEditId(card.id);
    setTagsEditValue(card.tags.join(", "));
    setTagsEditOpen(true);
  };

  const parentOptions = useMemo(() => {
    const t = cardType;
    if (t === "epic") return [] as KanbanCard[];
    if (t === "feature") return state.cards.filter((c) => c.type === "epic");
    if (t === "user_story") return state.cards.filter((c) => c.type === "feature");
    return state.cards.filter((c) => c.type === "user_story");
  }, [cardType, state.cards]);

  const openNewCard = (columnId: string) => {
    setCardColumnId(columnId);
    setCardType("user_story");
    setCardTitle("");
    setCardParentId(null);
    setCardTagsInput("");
    setCardOpen(true);
  };

  const submitCard = () => {
    const tags = cardTagsInput
      .split(/[,;]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const res = addCard({
      columnId: cardColumnId,
      type: cardType,
      title: cardTitle,
      parentId: cardType === "epic" ? null : cardParentId,
      tags,
    });
    if (!res.ok) {
      toast.error(res.error ?? "Não foi possível criar o card.");
      return;
    }
    toast.success("Card criado.");
    setCardOpen(false);
  };

  const submitColumn = () => {
    addColumn(colTitle);
    setColTitle("");
    setColOpen(false);
    toast.success("Coluna adicionada.");
  };

  const activeCard = activeId ? cardById(activeId) : undefined;

  const toggleTagFilter = (tag: string) => {
    setTagFilter((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-none w-full">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Board</h1>
          <p className="text-muted-foreground text-sm">
            Kanban com hierarquia Scrum (Épico → Feature → User Story → Task). Arraste os cards entre as colunas.
          </p>
        </div>
        {isAdmin && (
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setColOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nova coluna
          </Button>
        )}
      </div>

      {filterActive && (
        <p className="text-xs text-amber-600 dark:text-amber-400/90">
          Filtros ativos: arrastar cards está desativado até limpar os filtros.
        </p>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="board-keyword" className="text-xs text-muted-foreground">
            Filtrar por palavra
          </Label>
          <Input
            id="board-keyword"
            placeholder="Título…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="mt-1"
          />
        </div>
        <div className="w-full sm:w-48">
          <Label className="text-xs text-muted-foreground">Tipo</Label>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as WorkItemType | "all")}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="epic">{TYPE_LABEL.epic}</SelectItem>
              <SelectItem value="feature">{TYPE_LABEL.feature}</SelectItem>
              <SelectItem value="user_story">{TYPE_LABEL.user_story}</SelectItem>
              <SelectItem value="task">{TYPE_LABEL.task}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {allTags.length > 0 && (
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs text-muted-foreground">Tags</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {allTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTagFilter(t)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                    tagFilter.includes(t)
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
        {(keyword || typeFilter !== "all" || tagFilter.length > 0) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => {
              setKeyword("");
              setTypeFilter("all");
              setTagFilter([]);
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      <div className="overflow-x-auto pb-2 -mx-6 lg:-mx-8 px-6 lg:px-8">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={filterActive ? undefined : onDragOver}
          onDragEnd={filterActive ? undefined : onDragEnd}
          onDragCancel={onDragCancel}
        >
          <div className="flex gap-4 min-w-max items-start">
            {sortedColumns.map((col) => {
              const ids = items[col.id] ?? [];
              const visibleIds = ids.filter((id) => {
                const c = cardById(id);
                return c && matchesFilters(c);
              });

              return (
                <div
                  key={col.id}
                  className="w-[300px] shrink-0 flex flex-col rounded-xl border border-border/60 bg-card/30 min-h-[280px]"
                >
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <Columns3 size={16} className="text-primary shrink-0" />
                      <h2 className="font-semibold text-sm truncate">{col.title}</h2>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {visibleIds.length}/{ids.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openNewCard(col.id)}>
                        <Plus size={16} />
                      </Button>
                      {isAdmin && sortedColumns.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("Remover esta coluna? Os cards serão movidos para outra coluna.")) {
                              removeColumn(col.id);
                              toast.success("Coluna removida.");
                            }
                          }}
                        >
                          <Trash2 size={16} />
                        </Button>
                      )}
                    </div>
                  </div>

                  <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                    <ColumnBody columnId={col.id}>
                      {ids.map((id) => {
                        const c = cardById(id);
                        if (!c) return null;
                        const parent = c.parentId ? cardById(c.parentId) : null;
                        const dimmed = filterActive && !matchesFilters(c);
                        return (
                          <SortableKanbanCard
                            key={id}
                            card={c}
                            parentTitle={parent?.title ?? null}
                            filterActive={filterActive}
                            dimmed={dimmed}
                            onEditTags={() => openTagsEdit(c)}
                          />
                        );
                      })}
                      {visibleIds.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-8 px-2">
                          {ids.length === 0 ? "Nenhum card." : "Nenhum card corresponde ao filtro."}
                        </p>
                      )}
                    </ColumnBody>
                  </SortableContext>
                </div>
              );
            })}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeCard ? (
              <Card className="glass-card p-3 w-[280px] shadow-lg border-primary/30">
                <Badge variant="outline" className="text-[10px] mb-2">
                  {TYPE_LABEL[activeCard.type]}
                </Badge>
                <p className="text-sm font-medium">{activeCard.title}</p>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <Dialog open={colOpen} onOpenChange={setColOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova coluna</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="col-title">Nome</Label>
            <Input id="col-title" value={colTitle} onChange={(e) => setColTitle(e.target.value)} placeholder="Ex.: Em revisão" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setColOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submitColumn} disabled={!colTitle.trim()}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cardOpen} onOpenChange={setCardOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo card</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select
                value={cardType}
                onValueChange={(v) => {
                  setCardType(v as WorkItemType);
                  setCardParentId(null);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="epic">{TYPE_LABEL.epic}</SelectItem>
                  <SelectItem value="feature">{TYPE_LABEL.feature}</SelectItem>
                  <SelectItem value="user_story">{TYPE_LABEL.user_story}</SelectItem>
                  <SelectItem value="task">{TYPE_LABEL.task}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {cardType !== "epic" && (
              <div>
                <Label>Item pai</Label>
                <Select
                  value={cardParentId ?? "__none"}
                  onValueChange={(v) => setCardParentId(v === "__none" ? null : v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Selecione —</SelectItem>
                    {parentOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        [{TYPE_LABEL[p.type]}] {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="card-title">Título</Label>
              <Input id="card-title" className="mt-1" value={cardTitle} onChange={(e) => setCardTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="card-tags">Tags (separadas por vírgula)</Label>
              <Input
                id="card-tags"
                className="mt-1"
                value={cardTagsInput}
                onChange={(e) => setCardTagsInput(e.target.value)}
                placeholder="ex.: backend, sprint-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCardOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submitCard} disabled={!cardTitle.trim()}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={tagsEditOpen}
        onOpenChange={(o) => {
          setTagsEditOpen(o);
          if (!o) setTagsEditId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar tags</DialogTitle>
          </DialogHeader>
          <Input
            value={tagsEditValue}
            onChange={(e) => setTagsEditValue(e.target.value)}
            placeholder="tag1, tag2"
          />
          <DialogFooter>
            <Button
              onClick={() => {
                if (tagsEditId) {
                  const tags = tagsEditValue
                    .split(/[,;]/)
                    .map((t) => t.trim())
                    .filter(Boolean);
                  updateCardTags(tagsEditId, tags);
                  toast.success("Tags atualizadas.");
                }
                setTagsEditOpen(false);
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Board;
