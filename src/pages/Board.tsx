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
import type { User } from "@/contexts/AuthContext";
import { canManageKanbanBoard, useAuth } from "@/contexts/AuthContext";
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
import { UserAvatarDisplay } from "@/components/UserAvatarDisplay";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  GripVertical,
  Plus,
  Search,
  Settings,
  Tag,
  X,
} from "lucide-react";

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

function userByUsername(users: User[], username: string | null | undefined): User | undefined {
  if (!username) return undefined;
  return users.find((u) => u.username === username);
}

/** Largura de coluna alinhada ao Kanban Azure (~220–350px). */
const COL_WIDTH_CLASS = "w-[302px] min-w-[220px] max-w-[350px] shrink-0 box-border";

/**
 * Atribuição estilo Azure: na lista mostra nome + e-mail; fechado mostra só avatar + nome.
 */
function AssigneePicker({
  value,
  onChange,
  users,
  disabled,
  placeholder = "Não atribuído",
}: {
  value: string | null;
  onChange: (username: string | null) => void;
  users: User[];
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = userByUsername(users, value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="w-full justify-start h-auto min-h-9 py-1.5 px-2 font-normal border-border bg-background hover:bg-muted/50"
        >
          <div className="flex items-center gap-2 min-w-0 w-full text-left">
            {selected ? (
              <>
                <UserAvatarDisplay user={selected} className="h-6 w-6 shrink-0" iconSize={14} />
                <span className="truncate text-sm">{selected.name}</span>
              </>
            ) : value ? (
              <>
                <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                  {value.slice(0, 2).toUpperCase()}
                </span>
                <span className="truncate text-sm">@{value}</span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">{placeholder}</span>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(calc(100vw-2rem),320px)] p-0" align="start">
        <div className="max-h-72 overflow-y-auto p-1">
          <button
            type="button"
            className={cn(
              "w-full rounded-sm px-2 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            {placeholder}
          </button>
          {users.map((u) => (
            <button
              key={u.username}
              type="button"
              className="w-full flex items-start gap-2 rounded-sm px-2 py-2 text-left hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                onChange(u.username);
                setOpen(false);
              }}
            >
              <UserAvatarDisplay user={u} className="h-8 w-8 shrink-0 mt-0.5" iconSize={18} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium leading-tight text-foreground">{u.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{u.email}</div>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Ícone estilo Azure: pilhas de “pills” (Épico laranja, Feature roxa, Task verde). */
function StackPillsTypeIcon({ type, className }: { type: "epic" | "feature" | "task"; className?: string }) {
  const fill =
    type === "epic"
      ? "#f97316"
      : type === "feature"
        ? "#a855f7"
        : "#34d399";
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <rect x="1" y="1" width="7" height="3.2" rx="0.9" fill={fill} />
      <rect x="1" y="5.5" width="7" height="3.2" rx="0.9" fill={fill} />
      <rect x="1" y="10" width="7" height="3.2" rx="0.9" fill={fill} />
      <rect x="10" y="5.5" width="7" height="3.2" rx="0.9" fill={fill} />
      <rect x="10" y="10" width="7" height="3.2" rx="0.9" fill={fill} />
    </svg>
  );
}

/** Ícone por tipo de work item — só nos cards, não nos títulos das colunas. */
function WorkItemTypeIcon({ type, className }: { type: WorkItemType; className?: string }) {
  if (type === "user_story") {
    return (
      <BookOpen
        className={cn("h-[18px] w-[18px] shrink-0 text-cyan-400", className)}
        strokeWidth={2}
        aria-hidden
      />
    );
  }
  return <StackPillsTypeIcon type={type} className={className} />;
}

function CardTitleField({
  cardId,
  title,
  onSave,
  disabled,
}: {
  cardId: string;
  title: string;
  onSave: (next: string) => void;
  disabled: boolean;
}) {
  const [local, setLocal] = useState(title);
  useEffect(() => setLocal(title), [title, cardId]);

  return (
    <Input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const t = local.trim();
        if (t && t !== title) onSave(t);
        if (!t) setLocal(title);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="font-medium text-foreground leading-snug h-auto min-h-0 py-1.5 px-2 border border-transparent bg-transparent hover:border-input/60 focus:border-input"
      disabled={disabled}
    />
  );
}

function SortableKanbanCard({
  card,
  parentTitle,
  columnTitle,
  filterActive,
  dimmed,
  onEditTags,
  platformUsers,
  onSaveTitle,
  onAssignee,
}: {
  card: KanbanCard;
  parentTitle: string | null;
  columnTitle: string;
  filterActive: boolean;
  dimmed: boolean;
  onEditTags: () => void;
  platformUsers: User[];
  onSaveTitle: (title: string) => void;
  onAssignee: (username: string | null) => void;
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
          "glass-card p-3 text-sm shadow-sm border-border/60 border-l-4 border-l-primary pl-2.5",
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
            <div className="flex items-center gap-2 flex-wrap">
              <WorkItemTypeIcon type={card.type} />
              <Badge variant="outline" className="text-[10px] shrink-0 border-border/60">
                {TYPE_LABEL[card.type]}
              </Badge>
            </div>
            <CardTitleField
              cardId={card.id}
              title={card.title}
              onSave={onSaveTitle}
              disabled={dimmed}
            />
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 shrink-0" />
              <span>{columnTitle}</span>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Atribuído a</Label>
              <div className="mt-1">
                <AssigneePicker
                  value={card.assigneeUsername}
                  onChange={onAssignee}
                  users={platformUsers}
                  disabled={!!dimmed}
                />
              </div>
            </div>
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
      className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-380px)] min-h-[120px]"
    >
      {children}
    </div>
  );
}

const Board = () => {
  const { user, listUsers } = useAuth();
  const canBoardSettings = canManageKanbanBoard(user);
  const platformUsers = listUsers();

  const {
    state,
    addColumn,
    removeColumn,
    addCard,
    applyBoardLayout,
    updateCardTags,
    updateCardTitle,
    updateCardAssignee,
    cardById,
  } = useKanban();

  const sortedColumns = useMemo(
    () => [...state.columns].sort((a, b) => a.order - b.order),
    [state.columns],
  );
  const columnIds = useMemo(() => sortedColumns.map((c) => c.id), [sortedColumns]);
  const firstColumnId = sortedColumns[0]?.id ?? "";
  const backlogColumnId = useMemo(() => {
    const named = sortedColumns.find((c) => c.title.trim().toLowerCase() === "backlog");
    return named?.id ?? firstColumnId;
  }, [sortedColumns, firstColumnId]);

  const columnTitleById = useMemo(() => {
    const m: Record<string, string> = {};
    sortedColumns.forEach((c) => {
      m[c.id] = c.title;
    });
    return m;
  }, [sortedColumns]);

  const [items, setItems] = useState<Record<string, string[]>>(() => buildItemsMap(state.cards, columnIds));
  const [activeId, setActiveId] = useState<string | null>(null);

  /** Busca rápida na coluna (não é o mesmo que filtros do topo). */
  const [boardSearch, setBoardSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<WorkItemType | "all">("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string | "all">("all");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<"or" | "and">("or");
  const [tagsMenuQuery, setTagsMenuQuery] = useState("");

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newColTitle, setNewColTitle] = useState("");

  const [cardOpen, setCardOpen] = useState(false);
  const [cardType, setCardType] = useState<WorkItemType>("user_story");
  const [cardTitle, setCardTitle] = useState("");
  const [cardParentId, setCardParentId] = useState<string | null>(null);
  const [cardTagsInput, setCardTagsInput] = useState("");
  const [cardAssignee, setCardAssignee] = useState<string | null>(null);

  const [tagsEditOpen, setTagsEditOpen] = useState(false);
  const [tagsEditId, setTagsEditId] = useState<string | null>(null);
  const [tagsEditValue, setTagsEditValue] = useState("");

  const allTags = useMemo(() => {
    const s = new Set<string>();
    state.cards.forEach((c) => c.tags.forEach((t) => s.add(t)));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [state.cards]);

  const filterActive =
    boardSearch.trim().length > 0 ||
    typeFilter !== "all" ||
    assigneeFilter !== "all" ||
    tagFilter.length > 0;

  const matchesFilters = useCallback(
    (card: KanbanCard) => {
      if (boardSearch.trim() && !card.title.toLowerCase().includes(boardSearch.trim().toLowerCase())) return false;
      if (typeFilter !== "all" && card.type !== typeFilter) return false;
      if (assigneeFilter !== "all") {
        if (assigneeFilter === "__unassigned" && card.assigneeUsername) return false;
        if (assigneeFilter !== "__unassigned" && card.assigneeUsername !== assigneeFilter) return false;
      }
      if (tagFilter.length) {
        if (tagFilterMode === "and") {
          if (!tagFilter.every((t) => card.tags.includes(t))) return false;
        } else {
          if (!tagFilter.some((t) => card.tags.includes(t))) return false;
        }
      }
      return true;
    },
    [boardSearch, typeFilter, assigneeFilter, tagFilter, tagFilterMode],
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

  const openNewCard = () => {
    if (!backlogColumnId) {
      toast.error("Não há coluna para adicionar o card.");
      return;
    }
    setCardType("user_story");
    setCardTitle("");
    setCardParentId(null);
    setCardTagsInput("");
    setCardAssignee(null);
    setCardOpen(true);
  };

  const submitCard = () => {
    const tags = cardTagsInput
      .split(/[,;]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const res = addCard({
      columnId: backlogColumnId,
      type: cardType,
      title: cardTitle,
      parentId: cardType === "epic" ? null : cardParentId,
      tags,
      assigneeUsername: cardAssignee,
    });
    if (!res.ok) {
      toast.error(res.error ?? "Não foi possível criar o card.");
      return;
    }
    toast.success("Card criado.");
    setCardOpen(false);
  };

  const submitNewColumnFromSettings = () => {
    const t = newColTitle.trim();
    if (!t) return;
    addColumn(t);
    setNewColTitle("");
    toast.success("Coluna adicionada.");
  };

  const activeCard = activeId ? cardById(activeId) : undefined;

  const toggleTagFilter = (tag: string) => {
    setTagFilter((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const tagsForMenu = useMemo(() => {
    const q = tagsMenuQuery.trim().toLowerCase();
    if (!q) return allTags;
    return allTags.filter((t) => t.toLowerCase().includes(q));
  }, [allTags, tagsMenuQuery]);

  return (
    <div className="space-y-4 animate-fade-in max-w-none w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Board</h1>
          <p className="text-muted-foreground text-sm">
            Kanban com hierarquia Scrum (Épico → Feature → User Story → Task). Arraste os cards entre as colunas.
          </p>
        </div>
        {canBoardSettings && (
          <Button type="button" variant="outline" size="sm" className="shrink-0 gap-2" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        )}
      </div>

      {filterActive && (
        <p className="text-xs text-amber-600 dark:text-amber-400/90">
          Com busca na coluna ou filtros ativos, arrastar cards fica desativado até limpar.
        </p>
      )}

      <Card className="glass-card border-border/60 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end">
          <div className="w-full sm:w-44">
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
          <div className="w-full sm:w-56">
            <Label className="text-xs text-muted-foreground">Atribuído a</Label>
            <Select value={assigneeFilter} onValueChange={(v) => setAssigneeFilter(v as string | "all")}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="__unassigned">Não atribuído</SelectItem>
                {platformUsers.map((u) => (
                  <SelectItem key={u.username} value={u.username}>
                    <span className="block truncate">{u.name}</span>
                    <span className="block text-[11px] text-muted-foreground font-normal truncate">{u.email}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-auto">
            <Label className="text-xs text-muted-foreground">Tags</Label>
            <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1 h-9 w-full sm:w-[140px] justify-between gap-2 font-normal border-border bg-muted/20 hover:bg-muted/40"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Check
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          tagFilter.length === 0 ? "opacity-25" : "text-primary",
                        )}
                      />
                      <span className="truncate">Tags</span>
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <div className="p-2 border-b border-border/60">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        value={tagsMenuQuery}
                        onChange={(e) => setTagsMenuQuery(e.target.value)}
                        placeholder="Pesquisar tags"
                        className="h-8 pl-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="px-3 py-2 border-b border-border/60">
                    <RadioGroup
                      value={tagFilterMode}
                      onValueChange={(v) => setTagFilterMode(v as "or" | "and")}
                      className="flex flex-row gap-6"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="or" id="board-tag-or" />
                        <Label htmlFor="board-tag-or" className="text-xs font-normal cursor-pointer">
                          Ou (Or)
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="and" id="board-tag-and" />
                        <Label htmlFor="board-tag-and" className="text-xs font-normal cursor-pointer">
                          E (And)
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="max-h-52 overflow-y-auto px-2 py-1">
                    {tagsForMenu.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-2 py-3 text-center">Nenhuma tag.</p>
                    ) : (
                      tagsForMenu.map((t) => (
                        <label
                          key={t}
                          className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent"
                        >
                          <Checkbox
                            checked={tagFilter.includes(t)}
                            onCheckedChange={() => toggleTagFilter(t)}
                          />
                          <span className="truncate">{t}</span>
                        </label>
                      ))
                    )}
                  </div>
                  <div className="flex justify-end border-t border-border/60 p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs gap-1"
                      onClick={() => {
                        setTagFilter([]);
                        setTagsMenuQuery("");
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                      Limpar
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
          </div>
          {(typeFilter !== "all" || assigneeFilter !== "all" || tagFilter.length > 0 || boardSearch.trim()) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => {
                setBoardSearch("");
                setTypeFilter("all");
                setAssigneeFilter("all");
                setTagFilter([]);
                setTagFilterMode("or");
                setTagsMenuQuery("");
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </Card>

      <div className="overflow-x-auto pb-2 -mx-6 lg:-mx-8 px-6 lg:px-8">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={filterActive ? undefined : onDragOver}
          onDragEnd={filterActive ? undefined : onDragEnd}
          onDragCancel={onDragCancel}
        >
          {/* Estrutura tipo Azure: faixa única de títulos; divisórias só na área dos cards */}
          <div className="min-w-max rounded-md border border-border/60 bg-background shadow-sm">
            <div className="sticky top-0 z-20 flex bg-background border-b border-border">
              {sortedColumns.map((col, colIndex) => {
                const ids = items[col.id] ?? [];
                const visibleIds = ids.filter((id) => {
                  const c = cardById(id);
                  return c && matchesFilters(c);
                });
                return (
                  <div key={`hdr-${col.id}`} className={cn(COL_WIDTH_CLASS, "px-4 pt-4 pb-2")}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {colIndex === 0 && (
                        <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground opacity-80" aria-hidden />
                      )}
                      <h2 className="font-semibold text-sm truncate text-foreground flex-1 min-w-0">{col.title}</h2>
                      <span className="text-[11px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 shrink-0">
                        {visibleIds.length}/{ids.length}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex bg-background border-b border-border">
              {sortedColumns.map((col, colIndex) => (
                <div key={`tb-${col.id}`} className={cn(COL_WIDTH_CLASS, "px-2 py-1.5")}>
                  {colIndex === 0 && (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0 px-2.5 text-xs gap-1 border-border bg-background text-foreground hover:bg-muted/70 font-normal shadow-sm"
                        onClick={openNewCard}
                      >
                        <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                        Novo item
                      </Button>
                      <div className="relative min-w-0 flex-1">
                        <Search
                          className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                          aria-hidden
                        />
                        <Input
                          id="board-column-search"
                          value={boardSearch}
                          onChange={(e) => setBoardSearch(e.target.value)}
                          placeholder="Buscar cards…"
                          className="h-8 pl-8 pr-8 text-xs border-border bg-background"
                          aria-label="Buscar cards no board"
                        />
                        {boardSearch ? (
                          <button
                            type="button"
                            className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={() => setBoardSearch("")}
                            aria-label="Limpar busca"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex">
              {sortedColumns.map((col, colIndex) => {
                const ids = items[col.id] ?? [];
                const visibleIds = ids.filter((id) => {
                  const c = cardById(id);
                  return c && matchesFilters(c);
                });

                return (
                  <div
                    key={col.id}
                    className={cn(
                      COL_WIDTH_CLASS,
                      "flex flex-col min-h-[240px] border-t-2 border-t-border/70 bg-muted/20 dark:bg-muted/10",
                      colIndex > 0 && "border-l border-border/50",
                    )}
                  >
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
                              columnTitle={columnTitleById[c.columnId] ?? "—"}
                              filterActive={filterActive}
                              dimmed={dimmed}
                              onEditTags={() => openTagsEdit(c)}
                              platformUsers={platformUsers}
                              onSaveTitle={(t) => {
                                const r = updateCardTitle(c.id, t);
                                if (!r.ok) toast.error(r.error ?? "Título inválido.");
                              }}
                              onAssignee={(username) => updateCardAssignee(c.id, username)}
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
          </div>

          <DragOverlay dropAnimation={null}>
            {activeCard ? (
              <Card className="glass-card p-3 w-[280px] shadow-lg border-primary/30 border-l-4 border-l-primary pl-2.5">
                <div className="flex items-center gap-2 mb-2">
                  <WorkItemTypeIcon type={activeCard.type} />
                  <Badge variant="outline" className="text-[10px] border-border/60">
                    {TYPE_LABEL[activeCard.type]}
                  </Badge>
                </div>
                <p className="text-sm font-medium">{activeCard.title}</p>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Settings do Board</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Adicione ou remova colunas. Os cards de uma coluna excluída são movidos para outra coluna.
          </p>
          <div className="space-y-2">
            <Label htmlFor="settings-new-col">Nova coluna</Label>
            <div className="flex gap-2">
              <Input
                id="settings-new-col"
                value={newColTitle}
                onChange={(e) => setNewColTitle(e.target.value)}
                placeholder="Nome da coluna"
                onKeyDown={(e) => e.key === "Enter" && submitNewColumnFromSettings()}
              />
              <Button type="button" onClick={submitNewColumnFromSettings} disabled={!newColTitle.trim()}>
                Adicionar
              </Button>
            </div>
          </div>
          <div className="border border-border/50 rounded-lg divide-y divide-border/40 max-h-56 overflow-y-auto">
            {sortedColumns.map((col) => (
              <div key={col.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="truncate">{col.title}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive shrink-0"
                  disabled={sortedColumns.length <= 1}
                  onClick={() => {
                    if (sortedColumns.length <= 1) return;
                    if (confirm(`Remover a coluna "${col.title}"? Os cards serão movidos para outra coluna.`)) {
                      removeColumn(col.id);
                      toast.success("Coluna removida.");
                    }
                  }}
                >
                  Excluir
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cardOpen} onOpenChange={setCardOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo item</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            O card será criado na coluna <strong className="text-foreground">{columnTitleById[backlogColumnId] ?? "Backlog"}</strong>.
          </p>
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
              <Label>Atribuído a</Label>
              <div className="mt-1">
                <AssigneePicker value={cardAssignee} onChange={setCardAssignee} users={platformUsers} />
              </div>
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
