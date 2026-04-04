import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
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
import type { KanbanAttachment, KanbanColumn } from "@/contexts/KanbanContext";
import { KanbanCard, useKanban, WorkItemType } from "@/contexts/KanbanContext";
import { RichTextEditor } from "@/components/RichTextEditor";
import { clientsData } from "@/pages/Clientes";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatarDisplay } from "@/components/UserAvatarDisplay";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { markdownToHtml } from "@/lib/markdown";
import { toast } from "sonner";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  GripVertical,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Paperclip,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";

/** Rótulos no filtro do topo (plural — vários cards). */
export const TYPE_DISPLAY: Record<WorkItemType, string> = {
  epic: "Épicos",
  feature: "Features",
  user_story: "Stories",
  task: "Tasks",
};

/** No card e em formulários, cada item é singular. */
const TYPE_SINGULAR: Record<WorkItemType, string> = {
  epic: "Épico",
  feature: "Feature",
  user_story: "User Story",
  task: "Task",
};

/** Filtros compactos à direita (pill, estilo coluna nos cards). */
const BOARD_FILTER_PILL = cn(
  "inline-flex h-7 w-[6.75rem] shrink-0 items-center justify-between gap-1 rounded-full border border-transparent bg-transparent px-1.5 text-[11px] font-medium leading-none text-foreground shadow-none",
  "transition-colors hover:border-border hover:bg-muted/25",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

/** Borda esquerda espessa alinhada à cor do tipo (ícone); `glass-card` unifica `border` e escondia o accent. */
function cardTypeBorderClass(type: WorkItemType): string {
  if (type === "epic") return "border-l-4 border-solid border-l-orange-500";
  if (type === "feature") return "border-l-4 border-solid border-l-purple-500";
  if (type === "user_story") return "border-l-4 border-solid border-l-cyan-400";
  return "border-l-4 border-solid border-l-emerald-500";
}

/** Valida layout após drag: nenhuma coluna pode ter mais cards que o WIP. */
function findWipViolation(
  columns: KanbanColumn[],
  layout: Record<string, string[]>,
): { column: KanbanColumn; count: number; limit: number } | null {
  for (const col of columns) {
    const lim = col.wipLimit;
    if (lim == null || lim <= 0) continue;
    const count = layout[col.id]?.length ?? 0;
    if (count > lim) return { column: col, count, limit: lim };
  }
  return null;
}

type DetailEditField = "title" | "description" | "acceptance" | "discussion" | "column" | "assignee" | null;

function MarkdownPreviewBlock({
  markdown,
  emptyLabel,
  onRequestEdit,
}: {
  markdown: string;
  emptyLabel: string;
  onRequestEdit: () => void;
}) {
  const html = useMemo(() => markdownToHtml(markdown || ""), [markdown]);
  const has = (markdown ?? "").trim().length > 0;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onRequestEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onRequestEdit();
        }
      }}
      className={cn(
        "w-full rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-left text-sm transition-colors",
        "hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !has && "border-dashed py-8 text-muted-foreground",
      )}
    >
      {has ? (
        <div
          className="prose prose-sm dark:prose-invert max-w-none pointer-events-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <span>{emptyLabel}</span>
      )}
    </div>
  );
}

function InlineSaveCancel({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button type="button" variant="outline" size="sm" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="button" size="sm" onClick={onSave}>
        Salvar
      </Button>
    </div>
  );
}

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

/** Impede que o arrasto do card comece a partir de botões/links (dnd-kit usa pointerdown no ancestral). */
function blockDragStart(e: { stopPropagation: () => void }) {
  e.stopPropagation();
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

/** Ícone estilo Azure: pilhas de “pills” (Épico laranja, Feature roxa, Task verde). Tamanho só via className (default 18px). */
function StackPillsTypeIcon({ type, className }: { type: "epic" | "feature" | "task"; className?: string }) {
  const fill =
    type === "epic"
      ? "#f97316"
      : type === "feature"
        ? "#a855f7"
        : "#34d399";
  return (
    <svg
      viewBox="0 0 20 20"
      className={cn("block h-[18px] w-[18px] shrink-0", className)}
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

/** Slot fixo 18×18 para alinhar ícones com texto (trigger, menu, badges). */
const TYPE_ICON_SLOT = "inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center";

/** Ícone do seletor de tipo no topo do board — sempre dentro do mesmo slot 18×18. */
function BoardTypeFilterIcon({ type, className }: { type: WorkItemType | "all"; className?: string }) {
  return (
    <span className={cn(TYPE_ICON_SLOT, className)} aria-hidden>
      {type === "all" ? (
        <LayoutGrid className="block h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
      ) : type === "user_story" ? (
        <BookOpen className="block h-4 w-4 shrink-0 text-cyan-400" strokeWidth={2} />
      ) : (
        <StackPillsTypeIcon type={type} />
      )}
    </span>
  );
}

/** Linha do menu de tipo: coluna fixa para ✓ + ícone alinhados (evita desvio do SelectItem do Radix). */
function TypeFilterMenuRow({
  selected,
  onPick,
  icon,
  label,
}: {
  selected: boolean;
  onPick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <DropdownMenuItem
      onSelect={() => onPick()}
      className="cursor-pointer px-2 py-2 focus:bg-accent"
    >
      <div className="flex w-full items-center gap-2">
        <span className="flex h-[18px] w-4 shrink-0 items-center justify-center text-primary">
          {selected ? (
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          ) : (
            <span className="inline-block w-3.5" aria-hidden />
          )}
        </span>
        {icon}
        <span className="min-w-0 flex-1 truncate leading-none">{label}</span>
      </div>
    </DropdownMenuItem>
  );
}

function SortableKanbanCard({
  card,
  parent,
  onOpenParent,
  columns,
  onColumnChange,
  filterActive,
  platformUsers,
  onAssignee,
  onOpenDetail,
}: {
  card: KanbanCard;
  parent: KanbanCard | null;
  onOpenParent?: () => void;
  columns: { id: string; title: string }[];
  onColumnChange: (columnId: string) => void;
  filterActive: boolean;
  platformUsers: User[];
  onAssignee: (username: string | null) => void;
  onOpenDetail: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: filterActive,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const currentColumnTitle = columns.find((c) => c.id === card.columnId)?.title ?? "—";

  const hasTags = card.tags.length > 0;
  const hasParent = Boolean(parent);
  const showMetaSection = hasTags || hasParent;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "touch-none rounded-lg outline-none",
        filterActive ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        isDragging && "z-50 opacity-0 pointer-events-none",
      )}
    >
      <Card
        className={cn(
          "pointer-events-auto flex flex-col overflow-hidden rounded-lg border-y border-r border-border/60 bg-card/70 p-0 text-sm shadow-sm backdrop-blur-xl",
          cardTypeBorderClass(card.type),
        )}
      >
        <div className="flex gap-2 items-start p-3 pl-2.5">
          <span
            className="mt-0.5 shrink-0 text-muted-foreground/45 pointer-events-none"
            aria-hidden
            title=""
          >
            <GripVertical size={16} />
          </span>
          <div className="min-w-0 flex-1 space-y-2.5 pb-0">
            <button
              type="button"
              onClick={onOpenDetail}
              onPointerDown={blockDragStart}
              className="group block w-full min-w-0 text-left"
            >
              <p className="text-sm leading-snug text-foreground [text-wrap:pretty]">
                <span
                  className="inline-flex h-[1.15em] w-[18px] shrink-0 align-middle mr-0.5 items-center justify-center"
                  aria-hidden
                >
                  <BoardTypeFilterIcon type={card.type} />
                </span>
                <span className="text-[11px] font-semibold tabular-nums text-primary group-hover:underline">
                  #{card.workItemNumber}
                </span>
                <span className="text-sm font-medium group-hover:underline"> {card.title}</span>
              </p>
            </button>

            {/* 1. Estado (coluna) — linha completa */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={filterActive}
                  onPointerDown={blockDragStart}
                  className={cn(
                    "inline-flex w-full max-w-full items-center gap-1.5 rounded-full border border-transparent bg-transparent px-2 py-1 text-left text-xs font-medium text-foreground transition-colors",
                    "hover:border-border hover:bg-muted/25",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    filterActive && "pointer-events-none opacity-50",
                  )}
                  aria-label={`Coluna: ${currentColumnTitle}. Clique para alterar.`}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/80" aria-hidden />
                  <span className="min-w-0 truncate">{currentColumnTitle}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[10rem] p-1">
                {columns.map((col) => (
                  <DropdownMenuItem
                    key={col.id}
                    className={cn(
                      "cursor-pointer text-xs",
                      col.id === card.columnId && "bg-accent/80",
                    )}
                    onSelect={() => onColumnChange(col.id)}
                  >
                    {col.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 2. Responsável — bloco destacado (Azure-like) */}
            <div
              className="rounded-lg border border-border/50 bg-muted/10 px-1.5 py-1 shadow-sm"
              onPointerDown={blockDragStart}
            >
              <AssigneePicker value={card.assigneeUsername} onChange={onAssignee} users={platformUsers} disabled={false} />
            </div>

          </div>
        </div>

        {/* Tags e Pai: divisórias sólidas de borda a borda do card; tags no “miolo”. */}
        {showMetaSection && (
          <div className="w-full border-t border-solid border-border/60">
            {hasTags && (
              <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
                {card.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border/55 bg-muted/35 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            {hasParent && parent && (
              <div
                className={cn(
                  "flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2.5 text-[11px] leading-tight",
                  hasTags && "border-t border-solid border-border/60",
                )}
              >
                <span className="shrink-0 font-semibold uppercase tracking-wide text-muted-foreground">Pai</span>
                <button
                  type="button"
                  onPointerDown={blockDragStart}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenParent?.();
                  }}
                  disabled={filterActive || !onOpenParent}
                  className={cn(
                    "inline-flex min-w-0 max-w-full items-center gap-1.5 text-left text-primary transition-colors hover:underline",
                    filterActive && "pointer-events-none opacity-50",
                    !onOpenParent && "cursor-default hover:no-underline opacity-80",
                  )}
                  aria-label={`Item pai: ${parent.title}. Abrir detalhe.`}
                >
                  <span className="inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center [&_svg]:h-3.5 [&_svg]:w-3.5">
                    <BoardTypeFilterIcon type={parent.type} />
                  </span>
                  <span className="min-w-0 truncate font-medium">{parent.title}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function ColumnBody({ columnId, children }: { columnId: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: columnId });
  return (
    <div
      ref={setNodeRef}
      className="flex-1 min-h-0 p-2 space-y-2 overflow-y-auto"
    >
      {children}
    </div>
  );
}

const Board = () => {
  const { user, listUsers, canUserSeeClient } = useAuth();
  const canBoardSettings = canManageKanbanBoard(user);
  /** `listUsers()` devolve um array novo a cada chamada — memoizar para não recriar o header do layout a cada render. */
  const platformUsers = useMemo(() => listUsers(), [listUsers]);

  const {
    boardClientId,
    setBoardClientId,
    state,
    addColumn,
    removeColumn,
    updateColumnWip,
    addCard,
    applyBoardLayout,
    updateCardTags,
    updateCardTitle,
    updateCardDescription,
    updateCardAcceptanceCriteria,
    updateCardDiscussion,
    updateCardAttachments,
    updateCardAssignee,
    moveCard,
    cardById,
  } = useKanban();

  const visibleClients = useMemo(
    () => clientsData.filter((c) => canUserSeeClient(c.id)),
    [canUserSeeClient],
  );

  useEffect(() => {
    if (visibleClients.length === 0) return;
    if (!visibleClients.some((c) => c.id === boardClientId)) {
      setBoardClientId(visibleClients[0].id);
    }
  }, [visibleClients, boardClientId, setBoardClientId]);

  const currentClient = visibleClients.find((c) => c.id === boardClientId) ?? visibleClients[0];

  const [detailCardId, setDetailCardId] = useState<string | null>(null);
  const detailCard = detailCardId ? cardById(detailCardId) : undefined;

  const [detailEditField, setDetailEditField] = useState<DetailEditField>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftAc, setDraftAc] = useState("");
  const [draftDisc, setDraftDisc] = useState("");
  const [draftColumnId, setDraftColumnId] = useState("");
  const [draftAssignee, setDraftAssignee] = useState<string | null>(null);
  const [detailModalExpanded, setDetailModalExpanded] = useState(false);
  const [discussionSectionOpen, setDiscussionSectionOpen] = useState(true);
  const [tagAddOpen, setTagAddOpen] = useState(false);
  const [newTagDraft, setNewTagDraft] = useState("");
  const newTagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!detailCardId) setDetailModalExpanded(false);
  }, [detailCardId]);

  useEffect(() => {
    setDetailEditField(null);
    setTagAddOpen(false);
    setNewTagDraft("");
  }, [detailCardId]);

  const cancelDetailEdit = useCallback(() => {
    setDetailEditField(null);
  }, []);

  const beginDetailEdit = useCallback((field: NonNullable<DetailEditField>) => {
    if (!detailCard) return;
    setDetailEditField(field);
    switch (field) {
      case "title":
        setDraftTitle(detailCard.title);
        break;
      case "description":
        setDraftDesc(detailCard.description ?? "");
        break;
      case "acceptance":
        setDraftAc(detailCard.acceptanceCriteria ?? "");
        break;
      case "discussion":
        setDraftDisc(detailCard.discussion ?? "");
        break;
      case "column":
        setDraftColumnId(detailCard.columnId);
        break;
      case "assignee":
        setDraftAssignee(detailCard.assigneeUsername);
        break;
      default:
        break;
    }
  }, [detailCard]);

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

  const changeCardColumn = useCallback(
    (cardId: string, newColumnId: string) => {
      const card = cardById(cardId);
      if (!card || card.columnId === newColumnId) return;
      const targetCol = state.columns.find((c) => c.id === newColumnId);
      const lim = targetCol?.wipLimit;
      if (lim != null && lim > 0) {
        const inTarget = state.cards.filter((c) => c.columnId === newColumnId && c.id !== cardId).length;
        if (inTarget >= lim) {
          setWipModal({ columnTitle: targetCol!.title, limit: lim });
          return;
        }
      }
      const targetCount = state.cards.filter((c) => c.columnId === newColumnId && c.id !== cardId).length;
      moveCard(cardId, newColumnId, targetCount);
    },
    [cardById, moveCard, state.cards, state.columns],
  );

  const [items, setItems] = useState<Record<string, string[]>>(() => buildItemsMap(state.cards, columnIds));
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [dragHighlightColumnId, setDragHighlightColumnId] = useState<string | null>(null);
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
  const [wipModal, setWipModal] = useState<{ columnTitle: string; limit: number } | null>(null);

  const [cardOpen, setCardOpen] = useState(false);
  const [cardType, setCardType] = useState<WorkItemType>("user_story");
  const [cardTitle, setCardTitle] = useState("");
  const [cardParentId, setCardParentId] = useState<string | null>(null);
  const [cardTagsInput, setCardTagsInput] = useState("");
  const [cardAssignee, setCardAssignee] = useState<string | null>(null);

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
      if (boardSearch.trim()) {
        const q = boardSearch.trim().toLowerCase();
        const inTitle = card.title.toLowerCase().includes(q);
        const inNum = String(card.workItemNumber).includes(q.replace(/^#/, ""));
        if (!inTitle && !inNum) return false;
      }
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
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    setDragHighlightColumnId(null);
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    const overId = over?.id != null ? String(over.id) : null;
    if (!overId) {
      setDragHighlightColumnId(null);
      return;
    }
    setDragHighlightColumnId(findContainer(overId, itemsRef.current) ?? null);

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
    setDragHighlightColumnId(null);

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

      const violation = findWipViolation(sortedColumns, next);
      if (violation) {
        queueMicrotask(() =>
          setWipModal({ columnTitle: violation.column.title, limit: violation.limit }),
        );
        return buildItemsMap(state.cards, columnIds);
      }
      applyBoardLayout(next);
      return next;
    });
  };

  const onDragCancel = () => {
    setActiveId(null);
    setDragHighlightColumnId(null);
    setItems(buildItemsMap(state.cards, columnIds));
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
    setCardType(typeFilter === "all" ? "user_story" : typeFilter);
    setCardTitle("");
    setCardParentId(null);
    setCardTagsInput("");
    setCardAssignee(null);
    setCardOpen(true);
  };

  const submitCard = () => {
    const backlogCol = state.columns.find((c) => c.id === backlogColumnId);
    const lim = backlogCol?.wipLimit;
    if (lim != null && lim > 0) {
      const n = state.cards.filter((c) => c.columnId === backlogColumnId).length;
      if (n >= lim) {
        setWipModal({ columnTitle: backlogCol!.title, limit: lim });
        return;
      }
    }
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

  const typeFilterLabel = typeFilter === "all" ? "Todos os tipos" : TYPE_DISPLAY[typeFilter];

  const columnOptions = useMemo(
    () => sortedColumns.map((c) => ({ id: c.id, title: c.title })),
    [sortedColumns],
  );

  const clearAllBoardFilters = useCallback(() => {
    setBoardSearch("");
    setTypeFilter("all");
    setAssigneeFilter("all");
    setTagFilter([]);
    setTagFilterMode("or");
    setTagsMenuQuery("");
  }, []);

  const addAttachmentFromFile = useCallback(
    (file: File) => {
      if (!detailCardId || !detailCard) return;
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Ficheiro demasiado grande (máx. 2 MB por ficheiro).");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const att: KanbanAttachment = {
          id: `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`,
          name: file.name,
          mime: file.type || "application/octet-stream",
          dataUrl,
        };
        updateCardAttachments(detailCardId, [...(detailCard.attachments ?? []), att]);
        toast.success("Anexo adicionado.");
      };
      reader.readAsDataURL(file);
    },
    [detailCardId, detailCard, updateCardAttachments],
  );

  const removeDetailAttachment = useCallback(
    (attId: string) => {
      if (!detailCardId || !detailCard) return;
      updateCardAttachments(
        detailCardId,
        (detailCard.attachments ?? []).filter((a) => a.id !== attId),
      );
      toast.success("Anexo removido.");
    },
    [detailCardId, detailCard, updateCardAttachments],
  );

  const saveDetailTitle = useCallback(() => {
    if (!detailCardId) return;
    const t = draftTitle.trim();
    if (!t) {
      toast.error("O título não pode ficar vazio.");
      return;
    }
    const r = updateCardTitle(detailCardId, t);
    if (!r.ok) {
      toast.error(r.error ?? "Erro ao guardar.");
      return;
    }
    setDetailEditField(null);
    toast.success("Título guardado.");
  }, [detailCardId, draftTitle, updateCardTitle]);

  const saveDetailDescription = useCallback(() => {
    if (!detailCardId) return;
    updateCardDescription(detailCardId, draftDesc);
    setDetailEditField(null);
    toast.success("Descrição guardada.");
  }, [detailCardId, draftDesc, updateCardDescription]);

  const saveDetailAcceptance = useCallback(() => {
    if (!detailCardId) return;
    updateCardAcceptanceCriteria(detailCardId, draftAc);
    setDetailEditField(null);
    toast.success("Critérios de aceite guardados.");
  }, [detailCardId, draftAc, updateCardAcceptanceCriteria]);

  const saveDetailDiscussion = useCallback(() => {
    if (!detailCardId) return;
    updateCardDiscussion(detailCardId, draftDisc);
    setDetailEditField(null);
    toast.success("Discussion guardada.");
  }, [detailCardId, draftDisc, updateCardDiscussion]);

  const saveDetailColumn = useCallback(() => {
    if (!detailCardId || !detailCard) return;
    if (draftColumnId !== detailCard.columnId) {
      changeCardColumn(detailCardId, draftColumnId);
    }
    setDetailEditField(null);
    toast.success("Coluna atualizada.");
  }, [detailCardId, detailCard, draftColumnId, changeCardColumn]);

  const saveDetailAssignee = useCallback(() => {
    if (!detailCardId) return;
    updateCardAssignee(detailCardId, draftAssignee);
    setDetailEditField(null);
    toast.success("Atribuição atualizada.");
  }, [detailCardId, draftAssignee, updateCardAssignee]);

  const commitNewTagValue = useCallback(
    (raw: string) => {
      if (!detailCardId || !detailCard) return;
      const t = raw.trim();
      setNewTagDraft("");
      setTagAddOpen(false);
      if (!t) return;
      if (detailCard.tags.includes(t)) {
        toast.message("Esta tag já existe.");
        return;
      }
      updateCardTags(detailCardId, [...detailCard.tags, t]);
      toast.success("Tag adicionada.");
    },
    [detailCardId, detailCard, updateCardTags],
  );

  const removeCardTag = useCallback(
    (tag: string) => {
      if (!detailCardId || !detailCard) return;
      updateCardTags(
        detailCardId,
        detailCard.tags.filter((x) => x !== tag),
      );
    },
    [detailCardId, detailCard, updateCardTags],
  );

  useEffect(() => {
    if (tagAddOpen) queueMicrotask(() => newTagInputRef.current?.focus());
  }, [tagAddOpen]);

  const boardHeaderChrome = useMemo(
    () => (
      <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3 md:gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="text-lg sm:text-xl font-display font-bold shrink-0 text-foreground">
            Quadro Kanban
          </h1>
          <span className="text-muted-foreground/80 hidden sm:inline" aria-hidden>
            —
          </span>
          {visibleClients.length > 0 && currentClient ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex max-w-[min(100%,18rem)] items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1 text-sm font-semibold text-foreground transition-colors",
                    "hover:border-border hover:bg-muted/25",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  )}
                  aria-label={`Cliente: ${currentClient.name}. Clique para trocar.`}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/80" aria-hidden />
                  <span className="truncate">{currentClient.name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[12rem] p-1">
                {visibleClients.map((cl) => (
                  <DropdownMenuItem
                    key={cl.id}
                    className={cn("cursor-pointer text-sm", cl.id === boardClientId && "bg-accent/80")}
                    onSelect={() => setBoardClientId(cl.id)}
                  >
                    {cl.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="text-sm text-muted-foreground">Nenhum cliente disponível</span>
          )}
        </div>

        <div className="flex w-full min-w-0 flex-wrap items-center justify-end justify-self-end gap-1.5 sm:w-auto sm:shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={BOARD_FILTER_PILL}
                aria-label={`Tipo de work item exibido no board: ${typeFilterLabel}`}
                aria-haspopup="menu"
              >
                <span className="flex min-w-0 flex-1 items-center gap-1">
                  <span className="scale-90 origin-left">
                    <BoardTypeFilterIcon type={typeFilter} />
                  </span>
                  <span className="min-w-0 truncate leading-none">{typeFilterLabel}</span>
                </span>
                <ChevronDown className="h-3 w-3 shrink-0 opacity-60" strokeWidth={2} aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[240px] p-1">
              <TypeFilterMenuRow
                selected={typeFilter === "all"}
                onPick={() => setTypeFilter("all")}
                icon={<BoardTypeFilterIcon type="all" />}
                label="Todos os tipos"
              />
              <TypeFilterMenuRow
                selected={typeFilter === "epic"}
                onPick={() => setTypeFilter("epic")}
                icon={<BoardTypeFilterIcon type="epic" />}
                label={TYPE_DISPLAY.epic}
              />
              <TypeFilterMenuRow
                selected={typeFilter === "feature"}
                onPick={() => setTypeFilter("feature")}
                icon={<BoardTypeFilterIcon type="feature" />}
                label={TYPE_DISPLAY.feature}
              />
              <TypeFilterMenuRow
                selected={typeFilter === "user_story"}
                onPick={() => setTypeFilter("user_story")}
                icon={<BoardTypeFilterIcon type="user_story" />}
                label={TYPE_DISPLAY.user_story}
              />
              <TypeFilterMenuRow
                selected={typeFilter === "task"}
                onPick={() => setTypeFilter("task")}
                icon={<BoardTypeFilterIcon type="task" />}
                label={TYPE_DISPLAY.task}
              />
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => clearAllBoardFilters()}
                className="gap-2 text-muted-foreground focus:text-foreground"
              >
                <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Limpar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {canBoardSettings && (
            <button
              type="button"
              className={cn(BOARD_FILTER_PILL, "w-[6.75rem] justify-center gap-1")}
              onClick={() => setSettingsOpen(true)}
              title="Settings do board"
            >
              <Settings className="h-3 w-3 shrink-0 opacity-90" />
              <span className="truncate text-[10px]">Settings</span>
            </button>
          )}

          <Select value={assigneeFilter} onValueChange={(v) => setAssigneeFilter(v as string | "all")}>
            <SelectTrigger
              className={cn(
                BOARD_FILTER_PILL,
                "h-7 border-0 py-0 ring-offset-0 [&>span]:truncate [&>span]:text-[11px] [&>svg]:h-3 [&>svg]:w-3 [&>svg]:shrink-0",
              )}
            >
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent align="end" className="max-h-72">
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

          <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className={BOARD_FILTER_PILL}>
                    <span className="flex min-w-0 flex-1 items-center gap-1">
                      <Check
                        className={cn(
                          "h-3 w-3 shrink-0",
                          tagFilter.length === 0 ? "opacity-25" : "text-primary",
                        )}
                      />
                      <span className="truncate">Tags</span>
                    </span>
                    <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
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
      </div>
    ),
    [
      visibleClients,
      currentClient,
      boardClientId,
      typeFilter,
      typeFilterLabel,
      assigneeFilter,
      tagFilter,
      tagFilterMode,
      tagsMenuQuery,
      tagsForMenu,
      canBoardSettings,
      platformUsers,
      clearAllBoardFilters,
    ],
  );

  const boardHeaderSlot =
    typeof document !== "undefined" ? document.getElementById("app-header-slot") : null;

  return (
    <>
      {boardHeaderSlot ? createPortal(boardHeaderChrome, boardHeaderSlot) : null}
      <div className="flex flex-1 flex-col min-h-0 gap-3 animate-fade-in w-full">
      <Dialog
        open={wipModal !== null}
        onOpenChange={(open) => {
          if (!open) setWipModal(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Limite WIP atingido</DialogTitle>
            <DialogDescription className="text-left text-sm leading-relaxed">
              A coluna «{wipModal?.columnTitle}» admite no máximo {wipModal?.limit} itens em simultâneo. Já está
              completa. Liberte uma vaga ao mover um item para outra coluna ou ao concluí-lo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setWipModal(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto pb-2 w-full">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={filterActive ? undefined : onDragOver}
          onDragEnd={filterActive ? undefined : onDragEnd}
          onDragCancel={onDragCancel}
        >
          {/* Estrutura tipo Azure: faixa única de títulos; divisórias só na área dos cards */}
          <div className="min-w-max min-h-[calc(100vh-10rem)] rounded-md border border-border/60 bg-background shadow-sm flex flex-col">
            <div className="sticky top-0 z-20 flex bg-background border-b border-border">
              {sortedColumns.map((col, colIndex) => {
                const ids = items[col.id] ?? [];
                const visibleIds = ids.filter((id) => {
                  const c = cardById(id);
                  return c && matchesFilters(c);
                });
                return (
                  <div key={`hdr-${col.id}`} className={cn(COL_WIDTH_CLASS, "px-3 pt-3 pb-2 sm:px-4")}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {colIndex === 0 && (
                        <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground opacity-80" aria-hidden />
                      )}
                      <h2 className="font-semibold text-sm truncate text-foreground flex-1 min-w-0">{col.title}</h2>
                      <span className="text-[11px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 shrink-0">
                        {col.wipLimit != null && col.wipLimit > 0
                          ? `${ids.length} / ${col.wipLimit}`
                          : ids.length}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-1 min-h-0">
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
                      "flex flex-col min-h-0 self-stretch border-t-2 border-t-border/70 bg-muted/20 transition-[box-shadow,background-color] duration-150 dark:bg-muted/10",
                      colIndex > 0 && "border-l border-border/50",
                      dragHighlightColumnId === col.id &&
                        "bg-primary/[0.09] ring-2 ring-inset ring-primary/45 shadow-[inset_0_0_20px_-8px_hsl(var(--primary)/0.25)] dark:bg-primary/[0.12]",
                    )}
                  >
                    {colIndex === 0 && (
                      <div className="shrink-0 space-y-2 border-b border-border/50 bg-background/60 px-2 py-2">
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
                            <span
                              className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 flex w-9 items-center justify-center text-muted-foreground"
                              aria-hidden
                            >
                              <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                            </span>
                            <Input
                              id="board-column-search"
                              value={boardSearch}
                              onChange={(e) => setBoardSearch(e.target.value)}
                              placeholder="Buscar cards…"
                              className="h-8 pl-9 pr-8 text-xs leading-none border-border bg-background"
                              aria-label="Buscar cards no board"
                            />
                            {boardSearch ? (
                              <button
                                type="button"
                                className="absolute right-0 top-0 bottom-0 z-10 flex w-8 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                                onClick={() => setBoardSearch("")}
                                aria-label="Limpar busca"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )}
                    <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
                      <ColumnBody columnId={col.id}>
                        {visibleIds.map((id) => {
                          const c = cardById(id);
                          if (!c) return null;
                          const parent = c.parentId ? cardById(c.parentId) : null;
                          return (
                            <SortableKanbanCard
                              key={id}
                              card={c}
                              parent={parent ?? null}
                              onOpenParent={parent ? () => setDetailCardId(parent.id) : undefined}
                              columns={columnOptions}
                              onColumnChange={(columnId) => changeCardColumn(c.id, columnId)}
                              filterActive={filterActive}
                              platformUsers={platformUsers}
                              onAssignee={(username) => updateCardAssignee(c.id, username)}
                              onOpenDetail={() => setDetailCardId(c.id)}
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
              <Card
                className={cn(
                  "w-[min(302px,calc(100vw-2rem))] min-w-[260px] max-w-[302px] shrink-0 scale-100 rounded-lg border-y border-r border-border/60 bg-card/95 p-3 pl-2.5 text-sm shadow-2xl backdrop-blur-xl",
                  cardTypeBorderClass(activeCard.type),
                )}
              >
                <p className="text-sm leading-snug text-foreground">
                  <span
                    className="inline-flex h-[1.15em] w-[18px] shrink-0 align-middle mr-0.5 items-center justify-center"
                    aria-hidden
                  >
                    <BoardTypeFilterIcon type={activeCard.type} />
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums text-primary">#{activeCard.workItemNumber}</span>
                  <span className="text-sm font-medium"> {activeCard.title}</span>
                </p>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <Dialog
        open={detailCardId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailCardId(null);
        }}
      >
        <DialogContent
          className={cn(
            "flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0",
            detailModalExpanded
              ? "fixed inset-3 h-[calc(100vh-1.5rem)] max-h-none w-auto max-w-none translate-x-0 translate-y-0 sm:rounded-lg"
              : "max-w-2xl",
          )}
        >
          {detailCard && (
            <>
              <div className="absolute right-12 top-3 z-[60] flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={detailModalExpanded ? "Restaurar janela" : "Expandir janela"}
                  onClick={() => setDetailModalExpanded((v) => !v)}
                >
                  {detailModalExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </div>
              <DialogHeader className="space-y-3 px-6 pb-3 pt-6 pr-14">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xl font-bold tabular-nums text-primary">#{detailCard.workItemNumber}</span>
                  <span
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 text-xs font-medium text-foreground"
                    title={TYPE_SINGULAR[detailCard.type]}
                  >
                    <BoardTypeFilterIcon type={detailCard.type} />
                    {TYPE_SINGULAR[detailCard.type]}
                  </span>
                </div>
                <DialogTitle className="sr-only">
                  Work item #{detailCard.workItemNumber} — {detailCard.title}
                </DialogTitle>
              </DialogHeader>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6">
                {/* Metadados superiores: coluna, atribuído, tags */}
                <div className="flex flex-wrap items-start gap-x-4 gap-y-3 border-b border-border/40 pb-4">
                  <div className="min-w-[min(100%,12rem)] space-y-1">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Coluna
                    </span>
                    {detailEditField === "column" ? (
                      <div className="space-y-2">
                        <Select value={draftColumnId} onValueChange={setDraftColumnId}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {sortedColumns.map((col) => (
                              <SelectItem key={col.id} value={col.id}>
                                {col.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <InlineSaveCancel onSave={saveDetailColumn} onCancel={cancelDetailEdit} />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => beginDetailEdit("column")}
                        className="flex w-full max-w-xs items-center gap-1.5 rounded-full border border-transparent px-2 py-1.5 text-left text-sm font-medium text-foreground transition-colors hover:border-border hover:bg-muted/25"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/80" aria-hidden />
                        <span className="truncate">{columnTitleById[detailCard.columnId] ?? "—"}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <div className="min-w-0 space-y-1">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Atribuído a
                      </span>
                      {detailEditField === "assignee" ? (
                        <div className="max-w-sm space-y-2">
                          <AssigneePicker
                            value={draftAssignee}
                            onChange={setDraftAssignee}
                            users={platformUsers}
                          />
                          <InlineSaveCancel onSave={saveDetailAssignee} onCancel={cancelDetailEdit} />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => beginDetailEdit("assignee")}
                          className="flex max-w-full items-center gap-2 rounded-md border border-transparent px-1 py-0.5 text-left transition-colors hover:border-border hover:bg-muted/20"
                        >
                          {(() => {
                            const u = userByUsername(platformUsers, detailCard.assigneeUsername);
                            return u ? (
                              <>
                                <UserAvatarDisplay user={u} className="h-7 w-7 shrink-0" iconSize={14} />
                                <span className="truncate text-sm font-medium">{u.name}</span>
                              </>
                            ) : detailCard.assigneeUsername ? (
                              <>
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                                  {detailCard.assigneeUsername.slice(0, 2).toUpperCase()}
                                </span>
                                <span className="truncate text-sm">@{detailCard.assigneeUsername}</span>
                              </>
                            ) : (
                              <span className="text-sm text-muted-foreground">Não atribuído</span>
                            );
                          })()}
                        </button>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                      <span className="sr-only">Tags</span>
                      {detailCard.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="h-6 gap-0.5 pr-0.5 pl-2 text-xs font-normal"
                        >
                          <span className="max-w-[140px] truncate">{tag}</span>
                          <button
                            type="button"
                            className="rounded p-0.5 hover:bg-muted-foreground/20"
                            aria-label={`Remover tag ${tag}`}
                            onClick={() => removeCardTag(tag)}
                          >
                            <X className="h-3 w-3 opacity-70" />
                          </button>
                        </Badge>
                      ))}
                      {tagAddOpen ? (
                        <Input
                          ref={newTagInputRef}
                          value={newTagDraft}
                          onChange={(e) => setNewTagDraft(e.target.value)}
                          onBlur={(e) => commitNewTagValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitNewTagValue(e.currentTarget.value);
                            }
                          }}
                          placeholder="Nova tag"
                          className="h-7 w-36 text-xs"
                        />
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          aria-label="Adicionar tag"
                          onClick={() => {
                            setTagAddOpen(true);
                            setNewTagDraft("");
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Título */}
                <div className="space-y-2">
                  <Label htmlFor="detail-title">Título</Label>
                  {detailEditField === "title" ? (
                    <>
                      <Input
                        id="detail-title"
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        className="text-base font-semibold"
                      />
                      <InlineSaveCancel onSave={saveDetailTitle} onCancel={cancelDetailEdit} />
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => beginDetailEdit("title")}
                      className="w-full rounded-md border border-transparent px-2 py-1.5 text-left text-lg font-semibold leading-snug hover:bg-muted/30"
                    >
                      {detailCard.title}
                    </button>
                  )}
                </div>

                {detailCard.parentId && (
                  <div className="rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Item pai: </span>
                    <span className="font-medium text-foreground">
                      {cardById(detailCard.parentId)?.title ?? "—"}
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  {detailEditField === "description" ? (
                    <>
                      <RichTextEditor
                        key={`${detailCard.id}-desc-edit`}
                        instanceKey={`${detailCard.id}-desc-edit`}
                        value={draftDesc}
                        onChange={setDraftDesc}
                        placeholder="Descreva o trabalho…"
                        minHeightClass={detailModalExpanded ? "min-h-[160px]" : "min-h-[120px]"}
                      />
                      <InlineSaveCancel onSave={saveDetailDescription} onCancel={cancelDetailEdit} />
                    </>
                  ) : (
                    <MarkdownPreviewBlock
                      markdown={detailCard.description ?? ""}
                      emptyLabel="Clique para adicionar descrição…"
                      onRequestEdit={() => beginDetailEdit("description")}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Critérios de aceite</Label>
                  {detailEditField === "acceptance" ? (
                    <>
                      <RichTextEditor
                        key={`${detailCard.id}-ac-edit`}
                        instanceKey={`${detailCard.id}-ac-edit`}
                        value={draftAc}
                        onChange={setDraftAc}
                        placeholder="Liste critérios testáveis…"
                        minHeightClass={detailModalExpanded ? "min-h-[140px]" : "min-h-[100px]"}
                      />
                      <InlineSaveCancel onSave={saveDetailAcceptance} onCancel={cancelDetailEdit} />
                    </>
                  ) : (
                    <MarkdownPreviewBlock
                      markdown={detailCard.acceptanceCriteria ?? ""}
                      emptyLabel="Clique para adicionar critérios de aceite…"
                      onRequestEdit={() => beginDetailEdit("acceptance")}
                    />
                  )}
                </div>

                <Collapsible open={discussionSectionOpen} onOpenChange={setDiscussionSectionOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 pb-2 text-left text-sm font-semibold text-foreground hover:text-primary"
                    >
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform",
                          !discussionSectionOpen && "-rotate-90",
                        )}
                      />
                      Discussion
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-1">
                    {detailEditField === "discussion" ? (
                      <>
                        <RichTextEditor
                          key={`${detailCard.id}-disc-edit`}
                          instanceKey={`${detailCard.id}-disc-edit`}
                          value={draftDisc}
                          onChange={setDraftDisc}
                          placeholder="Comentário… Use # @ ! conforme necessário."
                          minHeightClass={detailModalExpanded ? "min-h-[180px]" : "min-h-[140px]"}
                        />
                        <InlineSaveCancel onSave={saveDetailDiscussion} onCancel={cancelDetailEdit} />
                      </>
                    ) : (
                      <MarkdownPreviewBlock
                        markdown={detailCard.discussion ?? ""}
                        emptyLabel="Clique para adicionar à discussion…"
                        onRequestEdit={() => beginDetailEdit("discussion")}
                      />
                    )}
                  </CollapsibleContent>
                </Collapsible>

                <div className="space-y-2">
                  <Label>Anexos</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="file"
                      className="hidden"
                      id="detail-attach-input"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) addAttachmentFromFile(f);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => document.getElementById("detail-attach-input")?.click()}
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      Anexar ficheiro
                    </Button>
                  </div>
                  {(detailCard.attachments ?? []).length > 0 ? (
                    <ul className="space-y-2 rounded-md border border-border/50 bg-muted/15 p-2 text-sm">
                      {(detailCard.attachments ?? []).map((a) => (
                        <li
                          key={a.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-sm px-2 py-1.5 hover:bg-muted/40"
                        >
                          <a
                            href={a.dataUrl}
                            download={a.name}
                            className="min-w-0 flex-1 truncate text-primary underline-offset-2 hover:underline"
                          >
                            {a.name}
                          </a>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                            aria-label={`Remover ${a.name}`}
                            onClick={() => removeDetailAttachment(a.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sem anexos.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Settings do Board</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Adicione ou remova colunas. Os cards de uma coluna excluída são movidos para outra coluna. Em cada coluna,
            defina <strong className="text-foreground">WIP</strong> (máximo de cards permitidos); deixe vazio para
            ilimitado.
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
          <div className="border border-border/50 rounded-lg divide-y divide-border/40 max-h-72 overflow-y-auto">
            {sortedColumns.map((col) => (
              <div
                key={col.id}
                className="flex flex-col gap-2 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0 truncate font-medium">{col.title}</span>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor={`wip-${col.id}`} className="text-xs text-muted-foreground whitespace-nowrap">
                      WIP
                    </Label>
                    <Input
                      id={`wip-${col.id}`}
                      type="number"
                      min={1}
                      className="h-8 w-14 text-xs tabular-nums"
                      key={`${col.id}-${col.wipLimit ?? "none"}`}
                      defaultValue={col.wipLimit ?? ""}
                      placeholder="∞"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        updateColumnWip(col.id, v === "" ? null : Math.max(1, parseInt(v, 10) || 1));
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
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
                  <SelectItem value="epic">{TYPE_SINGULAR.epic}</SelectItem>
                  <SelectItem value="feature">{TYPE_SINGULAR.feature}</SelectItem>
                  <SelectItem value="user_story">{TYPE_SINGULAR.user_story}</SelectItem>
                  <SelectItem value="task">{TYPE_SINGULAR.task}</SelectItem>
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
                        [{TYPE_SINGULAR[p.type]}] {p.title}
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

    </div>
    </>
  );
};

export default Board;
