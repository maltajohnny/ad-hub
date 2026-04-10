import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SetStateAction,
} from "react";
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
  pointerWithin,
  type CollisionDetection,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { User } from "@/contexts/AuthContext";
import { canDeleteKanbanCards, canManageKanbanBoard, useAuth } from "@/contexts/AuthContext";
import { useAppHeaderSlot } from "@/contexts/AppHeaderSlotContext";
import type { DiscussionEntry, KanbanAttachment, KanbanCard, KanbanColumn } from "@/contexts/KanbanContext";
import { canLinkRelated, useKanban, WorkItemType } from "@/contexts/KanbanContext";
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
import { Textarea } from "@/components/ui/textarea";
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
import {
  formatCardMentionChunk,
  getCaretClientRect,
  getMentionRange,
  placeMentionPanel,
} from "@/lib/cardMention";
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

function nextChildWorkItemType(parent: WorkItemType): WorkItemType | null {
  if (parent === "epic") return "feature";
  if (parent === "feature") return "user_story";
  if (parent === "user_story") return "task";
  return null;
}

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

type DetailEditField = "title" | "description" | "acceptance" | "column" | "assignee" | null;

/** Referência a card guardada como `#n [título]` — usado para partir o Markdown e renderizar chips clicáveis. */
const CARD_MENTION_TOKEN_RE = /(#\d+(?:\s+\[[^\]]+\])?)/g;

function markdownPreviewSegments(
  markdown: string,
  cards: KanbanCard[],
  onOpenCard: (cardId: string) => void,
): ReactNode {
  const parts = markdown.split(CARD_MENTION_TOKEN_RE);
  return parts.map((part, i) => {
    const m = part.match(/^#(\d+)(\s+\[[^\]]+\])?$/);
    if (m) {
      const num = parseInt(m[1], 10);
      const card = cards.find((c) => c.workItemNumber === num);
      if (card) {
        return (
          <button
            key={i}
            type="button"
            data-card-mention-link
            onPointerDown={blockDragStart}
            onClick={(e) => {
              e.stopPropagation();
              onOpenCard(card.id);
            }}
            className="pointer-events-auto inline cursor-pointer border-0 bg-transparent p-0 align-baseline text-left font-inherit hover:opacity-90"
          >
            <span className="font-mono font-semibold text-primary tabular-nums">#{m[1]}</span>
            {m[2] ? <span className="text-foreground">{m[2]}</span> : null}
          </button>
        );
      }
      return (
        <span key={i} className="text-muted-foreground">
          {part}
        </span>
      );
    }
    if (part === "") return null;
    const fragmentHtml = markdownToHtml(part);
    return (
      <span
        key={i}
        className="inline [&_p]:m-0 [&_p]:inline [&_p]:after:inline-block [&_p]:after:content-['\00a0'] [&_ul]:my-1 [&_ol]:my-1"
        dangerouslySetInnerHTML={{ __html: fragmentHtml }}
      />
    );
  });
}

function MarkdownPreviewBlock({
  markdown,
  emptyLabel,
  onRequestEdit,
  cards,
  onOpenCard,
}: {
  markdown: string;
  emptyLabel: string;
  onRequestEdit: () => void;
  cards: KanbanCard[];
  onOpenCard: (cardId: string) => void;
}) {
  const has = (markdown ?? "").trim().length > 0;
  return (
    <div
      tabIndex={0}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-card-mention-link]")) return;
        onRequestEdit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if ((e.target as HTMLElement).closest("[data-card-mention-link]")) return;
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
        <div className="prose prose-sm dark:prose-invert max-w-none pointer-events-none text-left">
          {markdownPreviewSegments(markdown, cards, onOpenCard)}
        </div>
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

function MarkdownReadOnly({ markdown }: { markdown: string }) {
  const html = useMemo(() => markdownToHtml(markdown || ""), [markdown]);
  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none rounded-md border border-border/40 bg-muted/10 px-3 py-2 text-sm"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function DiscussionBodyWithCardLinks({
  body,
  cards,
  onOpenCard,
}: {
  body: string;
  cards: KanbanCard[];
  onOpenCard: (cardId: string) => void;
}) {
  const parts = (body || "").split(/(#\d+)/g);
  return (
    <div className="rounded-md border border-border/40 bg-muted/10 px-3 py-2 text-sm leading-relaxed">
      {parts.map((part, i) => {
        const m = part.match(/^#(\d+)$/);
        if (m) {
          const n = parseInt(m[1], 10);
          const card = cards.find((c) => c.workItemNumber === n);
          if (card) {
            return (
              <button
                key={i}
                type="button"
                onClick={() => onOpenCard(card.id)}
                className="my-0.5 inline-flex max-w-full flex-wrap items-baseline gap-x-1.5 gap-y-0 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-left align-middle text-sm font-medium text-primary transition-colors hover:bg-primary/20"
              >
                <span className="shrink-0 font-mono tabular-nums">#{card.workItemNumber}</span>
                <span className="min-w-0 break-words text-foreground">{card.title}</span>
              </button>
            );
          }
          return (
            <span key={i} className="text-muted-foreground">
              {part}
            </span>
          );
        }
        if (part === "") return null;
        const html = markdownToHtml(part);
        return (
          <span
            key={i}
            className="inline [&>p]:m-0 [&>p]:inline [&>p]:after:inline-block [&>p]:after:content-['\00a0']"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
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
  onRequestDelete,
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
  /** Abre fluxo de exclusão com confirmação (só se o utilizador tiver permissão). */
  onRequestDelete?: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: filterActive,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const currentColumnTitle = columns.find((c) => c.id === card.columnId)?.title ?? "—";

  const tags = card.tags ?? [];
  const hasTags = tags.length > 0;
  const hasParent = Boolean(parent);
  const showMetaSection = hasTags || hasParent;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "touch-none rounded-lg outline-none",
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
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...listeners}
            disabled={filterActive}
            className={cn(
              "mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground/45 transition-colors",
              "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              filterActive ? "cursor-default opacity-40" : "cursor-grab active:cursor-grabbing",
            )}
            aria-label={`Arrastar card #${card.workItemNumber}`}
          >
            <GripVertical size={16} aria-hidden />
          </button>
          <div className={cn("min-w-0 flex-1 space-y-2.5 pb-0 relative", onRequestDelete && "pr-8")}>
            {onRequestDelete && (
              <button
                type="button"
                onPointerDown={blockDragStart}
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestDelete();
                }}
                className="absolute right-0 top-0 z-[1] rounded p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                aria-label={`Excluir card #${card.workItemNumber}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onOpenDetail}
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
                {tags.map((t) => (
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

/** Coluna completa (título + toolbar opcional + lista) como único droppable — evita falha ao passar o rato sobre o cabeçalho. */
function KanbanColumnShell({
  columnId,
  colIndex,
  highlighted,
  header,
  toolbar,
  children,
}: {
  columnId: string;
  colIndex: number;
  highlighted: boolean;
  header: React.ReactNode;
  toolbar: React.ReactNode | null;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: columnId });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        COL_WIDTH_CLASS,
        "flex flex-col min-h-0 self-stretch border-t-2 border-t-border/70 bg-muted/20 transition-[box-shadow,background-color] duration-150 dark:bg-muted/10",
        colIndex > 0 && "border-l border-border/50",
        highlighted &&
          "bg-primary/[0.09] ring-2 ring-inset ring-primary/45 shadow-[inset_0_0_20px_-8px_hsl(var(--primary)/0.25)] dark:bg-primary/[0.12]",
      )}
    >
      <div className="shrink-0 border-b border-border/50 bg-background px-3 pt-3 pb-2 sm:px-4">{header}</div>
      {toolbar}
      {children}
    </div>
  );
}

const BOARD_TYPE_FILTER_STORAGE_KEY = (clientId: number) => `norter:boardTypeFilter:${clientId}`;

function readBoardTypeFilter(clientId: number): WorkItemType | "all" {
  try {
    const raw = localStorage.getItem(BOARD_TYPE_FILTER_STORAGE_KEY(clientId));
    if (raw === "all" || raw === "epic" || raw === "feature" || raw === "user_story" || raw === "task") {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return "all";
}

/** Prioriza a coluna sob o ponteiro (scroll horizontal + várias colunas). */
const boardCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  return closestCorners(args);
};

const Board = () => {
  const boardHeaderSlotEl = useAppHeaderSlot();
  const { user, listUsers, canUserSeeClient } = useAuth();
  const currentUsername = user?.username ?? "";
  const canBoardSettings = canManageKanbanBoard(user);
  const canDeleteCards = canDeleteKanbanCards(user);
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
    addDiscussionEntry,
    updateDiscussionEntry,
    deleteDiscussionEntry,
    addRelatedCard,
    removeRelatedCard,
    updateCardAttachments,
    updateCardAssignee,
    moveCard,
    cardById,
    deleteCard,
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

  useEffect(() => {
    if (detailCardId && !detailCard) setDetailCardId(null);
  }, [detailCardId, detailCard]);

  const [detailEditField, setDetailEditField] = useState<DetailEditField>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftAc, setDraftAc] = useState("");
  const [draftColumnId, setDraftColumnId] = useState("");
  const [draftAssignee, setDraftAssignee] = useState<string | null>(null);
  const [detailModalExpanded, setDetailModalExpanded] = useState(false);
  const [discussionSectionOpen, setDiscussionSectionOpen] = useState(true);
  const [tagAddOpen, setTagAddOpen] = useState(false);
  const [newTagDraft, setNewTagDraft] = useState("");
  const newTagInputRef = useRef<HTMLInputElement>(null);

  const [newDiscussionText, setNewDiscussionText] = useState("");
  const [editingDiscussionEntry, setEditingDiscussionEntry] = useState<{ id: string; body: string } | null>(null);
  /** Lista flutuante ao digitar `#` junto ao cursor (texto simples ou `apply` vindo do RichTextEditor). */
  const [mentionUi, setMentionUi] = useState<{
    target: string;
    query: string;
    range: { start: number; end: number };
    pos: { top: number; left: number };
    apply?: (workItemNumber: number, title: string) => void;
  } | null>(null);
  const mentionPopoverRef = useRef<HTMLDivElement>(null);
  /** Índice na lista do dropdown `#` (setas / Enter). */
  const [mentionHighlightIdx, setMentionHighlightIdx] = useState(0);
  const [relatedLinkOpen, setRelatedLinkOpen] = useState(false);
  const [relatedLinkQuery, setRelatedLinkQuery] = useState("");
  const discussionInputRef = useRef<HTMLTextAreaElement>(null);
  const discussionEditInputRef = useRef<HTMLTextAreaElement>(null);
  const detailTitleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!detailCardId) setDetailModalExpanded(false);
  }, [detailCardId]);

  useEffect(() => {
    setDetailEditField(null);
    setTagAddOpen(false);
    setNewTagDraft("");
    setNewDiscussionText("");
    setEditingDiscussionEntry(null);
    setMentionUi(null);
    setMentionHighlightIdx(0);
  }, [detailCardId]);

  useEffect(() => {
    setMentionHighlightIdx(0);
  }, [mentionUi?.query]);

  useEffect(() => {
    if (!mentionUi) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (discussionInputRef.current?.contains(t)) return;
      if (discussionEditInputRef.current?.contains(t)) return;
      if (detailTitleInputRef.current?.contains(t)) return;
      if (mentionPopoverRef.current?.contains(t)) return;
      if (t instanceof Element && t.closest("[data-card-mention-root]")) return;
      setMentionUi(null);
    };
    const onScroll = () => setMentionUi(null);
    document.addEventListener("mousedown", onDoc, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [mentionUi]);

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
  const [typeFilter, setTypeFilterState] = useState<WorkItemType | "all">(() =>
    typeof window !== "undefined" ? readBoardTypeFilter(boardClientId) : "all",
  );

  useEffect(() => {
    setTypeFilterState(readBoardTypeFilter(boardClientId));
  }, [boardClientId]);

  const setTypeFilter = useCallback(
    (action: SetStateAction<WorkItemType | "all">) => {
      setTypeFilterState((prev) => {
        const next = typeof action === "function" ? (action as (p: WorkItemType | "all") => WorkItemType | "all")(prev) : action;
        try {
          localStorage.setItem(BOARD_TYPE_FILTER_STORAGE_KEY(boardClientId), next);
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [boardClientId],
  );
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

  /** Modal de exclusão permanente (card #número). */
  const [deleteModalCard, setDeleteModalCard] = useState<KanbanCard | null>(null);
  /** Só dígitos — o # é mostrado fixo ao lado. */
  const [deleteConfirmDigits, setDeleteConfirmDigits] = useState("");

  const allTags = useMemo(() => {
    const s = new Set<string>();
    state.cards.forEach((c) => (c.tags ?? []).forEach((t) => s.add(t)));
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
        const cardTags = card.tags ?? [];
        if (tagFilterMode === "and") {
          if (!tagFilter.every((t) => cardTags.includes(t))) return false;
        } else {
          if (!tagFilter.some((t) => cardTags.includes(t))) return false;
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

  /** Só highlight: não mover o card entre colunas durante o arraste (evita o DOM saltar e o DragOverlay desalinar). */
  const onDragOver = (event: DragOverEvent) => {
    const { over } = event;
    const overId = over?.id != null ? String(over.id) : null;
    if (!overId) {
      setDragHighlightColumnId(null);
      return;
    }
    setDragHighlightColumnId(findContainer(overId, itemsRef.current) ?? null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setDragHighlightColumnId(null);

    if (!over) {
      setItems(buildItemsMap(state.cards, columnIds));
      return;
    }

    setItems((current) => {
      let next = { ...current };
      const activeIdStr = String(active.id);
      const overIdStr = String(over.id);
      const activeContainer = findContainer(activeIdStr, next);
      const overContainer = findContainer(overIdStr, next);
      if (!activeContainer || !overContainer) {
        applyBoardLayout(next);
        return next;
      }

      if (activeContainer === overContainer) {
        if (activeIdStr !== overIdStr) {
          const ai = next[activeContainer].indexOf(activeIdStr);
          const oi = next[overContainer].indexOf(overIdStr);
          if (ai >= 0 && oi >= 0 && ai !== oi) {
            next = {
              ...next,
              [overContainer]: arrayMove(next[overContainer], ai, oi),
            };
          }
        }
      } else {
        const moving = activeIdStr;
        next[activeContainer] = next[activeContainer].filter((id) => id !== moving);
        const overItems = [...next[overContainer]];
        let newIndex = overItems.length;
        if (!(overIdStr in next)) {
          const oi = overItems.indexOf(overIdStr);
          const isBelowOverItem =
            active.rect.current.translated &&
            over.rect &&
            active.rect.current.translated.top > over.rect.top + over.rect.height;
          const modifier = isBelowOverItem ? 1 : 0;
          newIndex = oi >= 0 ? oi + modifier : overItems.length;
        }
        next[overContainer] = [
          ...overItems.slice(0, newIndex),
          moving,
          ...overItems.slice(newIndex),
        ];
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
    if (t === "task") return state.cards.filter((c) => c.type === "user_story");
    return [] as KanbanCard[];
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

  const publishDiscussion = useCallback(() => {
    if (!detailCardId || !user?.username) return;
    const t = newDiscussionText.trim();
    if (!t) {
      toast.error("Escreva algo antes de publicar.");
      return;
    }
    addDiscussionEntry(detailCardId, t, user.username);
    setNewDiscussionText("");
    toast.success("Comentário publicado.");
  }, [detailCardId, newDiscussionText, user, addDiscussionEntry]);

  const syncPlainMention = useCallback((el: HTMLInputElement | HTMLTextAreaElement, target: string) => {
    const value = el.value;
    const caret = el.selectionStart ?? value.length;
    const range = getMentionRange(value, caret);
    if (!range) {
      setMentionUi((m) => (m?.target === target ? null : m));
      return;
    }
    const rect = getCaretClientRect(el, range.end);
    const pos = placeMentionPanel(rect, 288, 260, { placement: "inline-end" });
    setMentionUi({
      target,
      query: range.query,
      range: { start: range.start, end: range.end },
      pos,
    });
  }, []);

  const clearMentionOnFocus = useCallback((field: string) => {
    setMentionUi((m) => (m && m.target === field ? m : null));
  }, []);

  const cardMentionDesc = useMemo(
    () => ({
      mentionTargetId: "detail-desc",
      onFieldFocus: () => clearMentionOnFocus("detail-desc"),
      onMentionChange: (
        s: null | {
          query: string;
          pos: { top: number; left: number };
          apply: (workItemNumber: number, title: string) => void;
        },
      ) => {
        if (!s) {
          setMentionUi((m) => (m?.target === "detail-desc" ? null : m));
          return;
        }
        setMentionUi({
          target: "detail-desc",
          query: s.query,
          range: { start: 0, end: 0 },
          pos: s.pos,
          apply: s.apply,
        });
      },
    }),
    [clearMentionOnFocus],
  );

  const cardMentionAc = useMemo(
    () => ({
      mentionTargetId: "detail-ac",
      onFieldFocus: () => clearMentionOnFocus("detail-ac"),
      onMentionChange: (
        s: null | {
          query: string;
          pos: { top: number; left: number };
          apply: (workItemNumber: number, title: string) => void;
        },
      ) => {
        if (!s) {
          setMentionUi((m) => (m?.target === "detail-ac" ? null : m));
          return;
        }
        setMentionUi({
          target: "detail-ac",
          query: s.query,
          range: { start: 0, end: 0 },
          pos: s.pos,
          apply: s.apply,
        });
      },
    }),
    [clearMentionOnFocus],
  );

  const insertMentionPick = useCallback((workItemNumber: number) => {
    if (!mentionUi) return;
    const pickedCard = state.cards.find((c) => c.workItemNumber === workItemNumber);
    const title = pickedCard?.title ?? "—";
    if (mentionUi.apply) {
      mentionUi.apply(workItemNumber, title);
      setMentionUi(null);
      return;
    }
    const { target, range } = mentionUi;
    const chunk = formatCardMentionChunk(workItemNumber, title);
    if (target === "new") {
      setNewDiscussionText((prev) => prev.slice(0, range.start) + chunk + prev.slice(range.end));
      queueMicrotask(() => {
        const ta = discussionInputRef.current;
        if (ta) {
          const pos = range.start + chunk.length;
          ta.focus();
          ta.setSelectionRange(pos, pos);
        }
      });
    } else if (target === "title") {
      setDraftTitle((prev) => prev.slice(0, range.start) + chunk + prev.slice(range.end));
      queueMicrotask(() => {
        const el = detailTitleInputRef.current;
        if (el) {
          const pos = range.start + chunk.length;
          el.focus();
          el.setSelectionRange(pos, pos);
        }
      });
    } else {
      setEditingDiscussionEntry((prev) => {
        if (!prev || prev.id !== target) return prev;
        return { ...prev, body: prev.body.slice(0, range.start) + chunk + prev.body.slice(range.end) };
      });
      queueMicrotask(() => {
        const ta = discussionEditInputRef.current;
        if (ta) {
          const pos = range.start + chunk.length;
          ta.focus();
          ta.setSelectionRange(pos, pos);
        }
      });
    }
    setMentionUi(null);
  }, [mentionUi, state.cards]);

  const relatedCardsForCurrentDetail = useMemo(() => {
    if (!detailCard) return [];
    const byParent = state.cards.filter((c) => c.parentId === detailCard.id);
    const rel = (detailCard.relatedCardIds ?? [])
      .map((id) => state.cards.find((c) => c.id === id))
      .filter((c): c is KanbanCard => Boolean(c));
    const seen = new Set<string>();
    const out: KanbanCard[] = [];
    for (const c of [...byParent, ...rel]) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        out.push(c);
      }
    }
    return out.sort((a, b) => a.workItemNumber - b.workItemNumber);
  }, [detailCard, state.cards]);

  const openCreateChildCard = useCallback(() => {
    if (!detailCard) return;
    const nt = nextChildWorkItemType(detailCard.type);
    if (!nt) {
      toast.error("Este tipo de item não tem subnível no board.");
      return;
    }
    setCardType(nt);
    setCardParentId(detailCard.id);
    setCardTitle("");
    setCardTagsInput("");
    setCardAssignee(null);
    setCardOpen(true);
  }, [detailCard]);

  const mentionCardList = useMemo(() => {
    const q = (mentionUi?.query ?? "").replace(/\D/g, "");
    return state.cards
      .filter((c) => (q === "" ? true : String(c.workItemNumber).startsWith(q)))
      .slice(0, 80);
  }, [state.cards, mentionUi?.query]);

  useEffect(() => {
    setMentionHighlightIdx((i) => Math.min(i, Math.max(0, mentionCardList.length - 1)));
  }, [mentionCardList.length]);

  useEffect(() => {
    if (!mentionUi) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMentionUi(null);
        return;
      }
      if (mentionCardList.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setMentionHighlightIdx((i) => Math.min(mentionCardList.length - 1, i + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setMentionHighlightIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        const c = mentionCardList[mentionHighlightIdx];
        if (c) insertMentionPick(c.workItemNumber);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [mentionUi, mentionCardList, mentionHighlightIdx, insertMentionPick]);

  useEffect(() => {
    if (!mentionPopoverRef.current || !mentionUi) return;
    const el = mentionPopoverRef.current.querySelector(
      `[data-mention-item="${mentionHighlightIdx}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [mentionHighlightIdx, mentionUi, mentionCardList]);

  const relatedExistingCandidates = useMemo(() => {
    if (!detailCard) return [];
    return state.cards.filter(
      (c) => c.id !== detailCard.id && canLinkRelated(detailCard, c, state.cards),
    );
  }, [detailCard, state.cards]);

  const relatedLinkFiltered = useMemo(() => {
    const q = relatedLinkQuery.replace(/\D/g, "");
    return relatedExistingCandidates.filter((c) =>
      q === "" ? true : String(c.workItemNumber).includes(q),
    );
  }, [relatedExistingCandidates, relatedLinkQuery]);

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
      const existing = detailCard.tags ?? [];
      if (existing.includes(t)) {
        toast.message("Esta tag já existe.");
        return;
      }
      updateCardTags(detailCardId, [...existing, t]);
      toast.success("Tag adicionada.");
    },
    [detailCardId, detailCard, updateCardTags],
  );

  const removeCardTag = useCallback(
    (tag: string) => {
      if (!detailCardId || !detailCard) return;
      updateCardTags(
        detailCardId,
        (detailCard.tags ?? []).filter((x) => x !== tag),
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

  return (
    <>
      {boardHeaderSlotEl ? createPortal(boardHeaderChrome, boardHeaderSlotEl) : null}
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

      <Dialog
        open={deleteModalCard !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteModalCard(null);
            setDeleteConfirmDigits("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir card permanentemente?</DialogTitle>
            <DialogDescription className="text-left text-sm leading-relaxed">
              A exclusão é definitiva. Os dados e anexos deste card serão apagados e não poderão ser recuperados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-sm font-medium leading-snug text-foreground">
              Desejo excluir permanentemente o card #{deleteModalCard?.workItemNumber ?? "—"} e estou ciente das
              consequências.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="delete-card-confirm" className="text-xs text-muted-foreground">
                Confirme só com o <strong className="text-foreground">número</strong> do card (a cerquilha já está
                indicada).
              </Label>
              <div className="flex rounded-md border border-input shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring">
                <span className="flex items-center rounded-l-md border-r border-input bg-muted px-3 font-mono text-sm font-semibold text-muted-foreground">
                  #
                </span>
                <Input
                  id="delete-card-confirm"
                  value={deleteConfirmDigits}
                  onChange={(e) => setDeleteConfirmDigits(e.target.value.replace(/\D/g, ""))}
                  placeholder="20001"
                  className="border-0 font-mono tabular-nums focus-visible:ring-0 focus-visible:ring-offset-0"
                  autoComplete="off"
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteModalCard(null);
                setDeleteConfirmDigits("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!deleteModalCard || deleteConfirmDigits !== String(deleteModalCard.workItemNumber)}
              onClick={() => {
                if (!deleteModalCard) return;
                const n = deleteModalCard.workItemNumber;
                const id = deleteModalCard.id;
                deleteCard(id);
                if (detailCardId === id) setDetailCardId(null);
                setDeleteModalCard(null);
                setDeleteConfirmDigits("");
                toast.success(`Card #${n} excluído.`);
              }}
            >
              Excluir permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto pb-2 w-full">
        <DndContext
          sensors={sensors}
          collisionDetection={boardCollisionDetection}
          modifiers={[snapCenterToCursor]}
          onDragStart={onDragStart}
          onDragOver={filterActive ? undefined : onDragOver}
          onDragEnd={filterActive ? undefined : onDragEnd}
          onDragCancel={onDragCancel}
        >
          {/* Uma coluna = cabeçalho + lista no mesmo droppable (highlight e hit-test corretos ao arrastar). */}
          <div className="flex min-h-[calc(100vh-10rem)] min-w-max flex-1 flex-row rounded-md border border-border/60 bg-background shadow-sm">
            {sortedColumns.map((col, colIndex) => {
              const ids = items[col.id] ?? [];
              const visibleIds = ids.filter((id) => {
                const c = cardById(id);
                return c && matchesFilters(c);
              });

              const header = (
                <div className="flex min-w-0 items-center gap-1.5">
                  {colIndex === 0 && (
                    <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground opacity-80" aria-hidden />
                  )}
                  <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{col.title}</h2>
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {col.wipLimit != null && col.wipLimit > 0 ? `${ids.length} / ${col.wipLimit}` : ids.length}
                  </span>
                </div>
              );

              const toolbar =
                colIndex === 0 ? (
                  <div className="shrink-0 space-y-2 border-b border-border/50 bg-background/60 px-2 py-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0 gap-1 border-border bg-background px-2.5 text-xs font-normal text-foreground shadow-sm hover:bg-muted/70"
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
                          className="h-8 border-border bg-background pl-9 pr-8 text-xs leading-none"
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
                ) : null;

              return (
                <KanbanColumnShell
                  key={col.id}
                  columnId={col.id}
                  colIndex={colIndex}
                  highlighted={dragHighlightColumnId === col.id}
                  header={header}
                  toolbar={toolbar}
                >
                  <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
                    <div className="min-h-[10rem] flex-1 space-y-2 overflow-y-auto p-2">
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
                            onRequestDelete={
                              canDeleteCards
                                ? () => {
                                    setDeleteModalCard(c);
                                    setDeleteConfirmDigits("");
                                  }
                                : undefined
                            }
                          />
                        );
                      })}
                      {visibleIds.length === 0 && (
                        <p className="px-2 py-8 text-center text-xs text-muted-foreground">
                          {ids.length === 0 ? "Nenhum card." : "Nenhum card corresponde ao filtro."}
                        </p>
                      )}
                    </div>
                  </SortableContext>
                </KanbanColumnShell>
              );
            })}
          </div>

          <DragOverlay dropAnimation={null} zIndex={100}>
            {activeCard ? (
              <Card
                className={cn(
                  "pointer-events-none w-[302px] min-w-[302px] max-w-[302px] shrink-0 rounded-lg border-y border-r border-border/60 bg-card p-0 text-sm shadow-2xl ring-2 ring-primary/20",
                  cardTypeBorderClass(activeCard.type),
                )}
              >
                <div className="flex gap-2 items-start p-3 pl-2.5">
                  <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/45" aria-hidden />
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-sm leading-snug text-foreground [text-wrap:pretty]">
                      <span className="inline-flex h-[1.15em] w-[18px] shrink-0 align-middle mr-0.5 items-center justify-center" aria-hidden>
                        <BoardTypeFilterIcon type={activeCard.type} />
                      </span>
                      <span className="text-[11px] font-semibold tabular-nums text-primary">#{activeCard.workItemNumber}</span>
                      <span className="text-sm font-medium"> {activeCard.title}</span>
                    </p>
                    <div className="flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/20 px-2 py-1 text-xs text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                      Arrastar para outra coluna
                    </div>
                  </div>
                </div>
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
              : detailCard?.type === "feature"
                ? "max-w-5xl"
                : "max-w-2xl",
          )}
        >
          {detailCard && (
            <>
              <div className="absolute right-12 top-3 z-[60] flex items-center gap-1">
                {nextChildWorkItemType(detailCard.type) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mr-1 h-8 gap-1 px-2 text-xs"
                    onClick={openCreateChildCard}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Novo filho
                  </Button>
                ) : null}
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
                    title={TYPE_SINGULAR[detailCard.type] ?? detailCard.type}
                  >
                    <BoardTypeFilterIcon type={detailCard.type} />
                    {TYPE_SINGULAR[detailCard.type] ?? detailCard.type}
                  </span>
                </div>
                <DialogTitle className="sr-only">
                  Work item #{detailCard.workItemNumber} — {detailCard.title}
                </DialogTitle>
              </DialogHeader>

              <div
                className={cn(
                  "flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row",
                  detailCard.type === "feature" && "lg:divide-x lg:divide-border/50",
                )}
              >
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
                      {(detailCard.tags ?? []).map((tag) => (
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
                        ref={detailTitleInputRef}
                        id="detail-title"
                        value={draftTitle}
                        onFocus={() => clearMentionOnFocus("title")}
                        onChange={(e) => {
                          setDraftTitle(e.target.value);
                          queueMicrotask(() => syncPlainMention(e.target, "title"));
                        }}
                        onSelect={(e) => syncPlainMention(e.target as HTMLInputElement, "title")}
                        onKeyUp={(e) => syncPlainMention(e.target as HTMLInputElement, "title")}
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
                        cardMention={cardMentionDesc}
                      />
                      <InlineSaveCancel onSave={saveDetailDescription} onCancel={cancelDetailEdit} />
                    </>
                  ) : (
                    <MarkdownPreviewBlock
                      markdown={detailCard.description ?? ""}
                      emptyLabel="Clique para adicionar descrição…"
                      onRequestEdit={() => beginDetailEdit("description")}
                      cards={state.cards}
                      onOpenCard={(id) => setDetailCardId(id)}
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
                        cardMention={cardMentionAc}
                      />
                      <InlineSaveCancel onSave={saveDetailAcceptance} onCancel={cancelDetailEdit} />
                    </>
                  ) : (
                    <MarkdownPreviewBlock
                      markdown={detailCard.acceptanceCriteria ?? ""}
                      emptyLabel="Clique para adicionar critérios de aceite…"
                      onRequestEdit={() => beginDetailEdit("acceptance")}
                      cards={state.cards}
                      onOpenCard={(id) => setDetailCardId(id)}
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
                  <CollapsibleContent className="space-y-4 pt-1">
                    <div className="space-y-2 rounded-lg border border-dashed border-border/60 bg-muted/10 p-3">
                      <Label htmlFor="discussion-new" className="text-xs text-muted-foreground">
                        Novo comentário — digite <kbd className="rounded border border-border px-1 font-mono">#</kbd> e
                        escolha o card na lista ao lado do cursor; pode filtrar com números (ex.: #200).
                      </Label>
                      <div className="relative">
                        <Textarea
                          id="discussion-new"
                          ref={discussionInputRef}
                          value={newDiscussionText}
                          onFocus={() => clearMentionOnFocus("new")}
                          onChange={(e) => {
                            setNewDiscussionText(e.target.value);
                            queueMicrotask(() => syncPlainMention(e.target, "new"));
                          }}
                          onSelect={(e) => syncPlainMention(e.target as HTMLTextAreaElement, "new")}
                          onKeyUp={(e) => syncPlainMention(e.target as HTMLTextAreaElement, "new")}
                          placeholder="Escreva e clique em Publicar…"
                          className={cn("min-h-[100px] text-sm", detailModalExpanded && "min-h-[140px]")}
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          onClick={publishDiscussion}
                          disabled={!user?.username}
                        >
                          Publicar
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {[...(detailCard.discussionEntries ?? [])]
                        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                        .map((entry) => {
                          const isMine = Boolean(currentUsername && entry.authorUsername === currentUsername);
                          const authorLabel =
                            userByUsername(platformUsers, entry.authorUsername)?.name ??
                            entry.authorUsername;
                          const editing = editingDiscussionEntry?.id === entry.id;
                          if (editing && isMine) {
                            return (
                              <div
                                key={entry.id}
                                className="rounded-lg border border-border/50 bg-muted/15 p-3 space-y-2"
                              >
                                <Textarea
                                  ref={discussionEditInputRef}
                                  value={editingDiscussionEntry.body}
                                  onFocus={() => clearMentionOnFocus(entry.id)}
                                  onChange={(e) => {
                                    setEditingDiscussionEntry((prev) =>
                                      prev ? { ...prev, body: e.target.value } : prev,
                                    );
                                    queueMicrotask(() =>
                                      syncPlainMention(e.target as HTMLTextAreaElement, entry.id),
                                    );
                                  }}
                                  onSelect={(e) =>
                                    syncPlainMention(e.target as HTMLTextAreaElement, entry.id)
                                  }
                                  onKeyUp={(e) =>
                                    syncPlainMention(e.target as HTMLTextAreaElement, entry.id)
                                  }
                                  className="min-h-[100px] text-sm"
                                />
                                <InlineSaveCancel
                                  onSave={() => {
                                    if (!detailCardId || !user?.username || !editingDiscussionEntry) return;
                                    const t = editingDiscussionEntry.body.trim();
                                    if (!t) {
                                      toast.error("O comentário não pode ficar vazio.");
                                      return;
                                    }
                                    updateDiscussionEntry(
                                      detailCardId,
                                      editingDiscussionEntry.id,
                                      t,
                                      user.username,
                                    );
                                    setEditingDiscussionEntry(null);
                                    toast.success("Comentário atualizado.");
                                  }}
                                  onCancel={() => setEditingDiscussionEntry(null)}
                                />
                              </div>
                            );
                          }
                          return (
                            <div
                              key={entry.id}
                              className="rounded-lg border border-border/50 bg-muted/15 p-3 space-y-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">{authorLabel}</span>
                                <time dateTime={entry.createdAt} className="tabular-nums">
                                  {new Date(entry.createdAt).toLocaleString()}
                                </time>
                              </div>
                              <DiscussionBodyWithCardLinks
                                body={entry.body}
                                cards={state.cards}
                                onOpenCard={(id) => setDetailCardId(id)}
                              />
                              {isMine ? (
                                <div className="flex justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setEditingDiscussionEntry({ id: entry.id, body: entry.body })
                                    }
                                  >
                                    Editar
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => {
                                      if (!detailCardId || !user?.username) return;
                                      if (!confirm("Remover este comentário?")) return;
                                      deleteDiscussionEntry(detailCardId, entry.id, user.username);
                                      toast.success("Comentário removido.");
                                    }}
                                  >
                                    Excluir
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {detailCard.type !== "feature" && (
                  <div className="space-y-2 rounded-lg border border-border/50 bg-muted/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">Relacionados</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 gap-1">
                            <Plus className="h-3.5 w-3.5" />
                            Adicionar
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={openCreateChildCard}>Novo item</DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setRelatedLinkQuery("");
                              setRelatedLinkOpen(true);
                            }}
                          >
                            Item existente
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <ul className="space-y-2">
                      {relatedCardsForCurrentDetail.length === 0 ? (
                        <li className="text-xs text-muted-foreground">Nenhum item relacionado.</li>
                      ) : (
                        relatedCardsForCurrentDetail.map((c) => (
                          <li
                            key={c.id}
                            className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-background/80 px-2 py-1.5 text-sm"
                          >
                            <button
                              type="button"
                              className="min-w-0 flex-1 truncate text-left hover:text-primary"
                              onClick={() => setDetailCardId(c.id)}
                            >
                              <span className="font-mono font-semibold text-primary">#{c.workItemNumber}</span>{" "}
                              {c.title}
                            </button>
                            {(detailCard.relatedCardIds ?? []).includes(c.id) ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                aria-label="Remover vínculo"
                                onClick={() => removeRelatedCard(detailCard.id, c.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="shrink-0 text-[10px] text-muted-foreground">Filho</span>
                            )}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}

                {canDeleteCards && (
                  <div className="space-y-3 rounded-lg border border-destructive/25 bg-destructive/[0.06] p-4">
                    <p className="text-sm font-semibold text-destructive">Excluir card</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      A exclusão é permanente: descrição, anexos e histórico associados a este item serão removidos sem
                      possibilidade de recuperação.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (!detailCard) return;
                        setDeleteModalCard(detailCard);
                        setDeleteConfirmDigits("");
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir card…
                    </Button>
                  </div>
                )}

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
                {detailCard.type === "feature" && (
                  <aside className="flex w-full shrink-0 flex-col gap-3 border-t border-border/50 bg-muted/5 px-4 py-4 lg:w-80 lg:max-w-[min(100%,20rem)] lg:border-t-0 lg:border-l lg:px-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold tracking-wide text-foreground">Related</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 gap-1">
                            <Plus className="h-3.5 w-3.5" />
                            Adicionar
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={openCreateChildCard}>Novo item</DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setRelatedLinkQuery("");
                              setRelatedLinkOpen(true);
                            }}
                          >
                            Item existente
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <ul className="min-h-0 max-h-[min(50vh,24rem)] space-y-2 overflow-y-auto text-sm">
                      {relatedCardsForCurrentDetail.length === 0 ? (
                        <li className="text-xs text-muted-foreground">Nenhum item relacionado.</li>
                      ) : (
                        relatedCardsForCurrentDetail.map((c) => (
                          <li
                            key={c.id}
                            className="flex items-start justify-between gap-2 rounded-md border border-border/40 bg-background/80 px-2 py-1.5"
                          >
                            <button
                              type="button"
                              className="min-w-0 flex-1 text-left text-sm hover:text-primary"
                              onClick={() => setDetailCardId(c.id)}
                            >
                              <span className="font-mono font-semibold text-primary">#{c.workItemNumber}</span>{" "}
                              <span className="text-foreground">{c.title}</span>
                            </button>
                            {(detailCard.relatedCardIds ?? []).includes(c.id) ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                aria-label="Remover vínculo"
                                onClick={() => removeRelatedCard(detailCard.id, c.id)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <span className="shrink-0 text-[10px] text-muted-foreground">Filho</span>
                            )}
                          </li>
                        ))
                      )}
                    </ul>
                  </aside>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {mentionUi && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={mentionPopoverRef}
              role="listbox"
              aria-label="Cards para referenciar"
              onPointerDownCapture={(e) => e.stopPropagation()}
              className="fixed z-[10000] isolate w-72 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none pointer-events-auto touch-auto"
              style={{ top: mentionUi.pos.top, left: mentionUi.pos.left }}
            >
              <ul className="max-h-56 space-y-0.5 overflow-y-auto text-sm pointer-events-auto">
                {mentionCardList.length === 0 ? (
                  <li className="px-2 py-3 text-center text-xs text-muted-foreground">Nenhum card encontrado.</li>
                ) : (
                  mentionCardList.map((c, idx) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        data-mention-item={idx}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left pointer-events-auto",
                          idx === mentionHighlightIdx ? "bg-muted" : "hover:bg-muted/60",
                        )}
                        onMouseEnter={() => setMentionHighlightIdx(idx)}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          insertMentionPick(c.workItemNumber);
                        }}
                      >
                        <span className="font-mono font-semibold text-primary">#{c.workItemNumber}</span>
                        <span className="min-w-0 truncate">{c.title}</span>
                        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                          {TYPE_SINGULAR[c.type]}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
              {mentionCardList.length > 0 ? (
                <p className="border-t border-border/40 px-2 py-1 text-[10px] text-muted-foreground tabular-nums">
                  A mostrar {mentionCardList.length}{" "}
                  {mentionCardList.length === 1 ? "sugestão" : "sugestões"}
                </p>
              ) : null}
            </div>,
            document.body,
          )
        : null}

      <Dialog
        open={relatedLinkOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRelatedLinkOpen(false);
            setRelatedLinkQuery("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular item existente</DialogTitle>
            <DialogDescription className="text-left text-sm">
              Apenas itens compatíveis com a hierarquia do card atual são listados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Filtrar por número…"
              value={relatedLinkQuery}
              onChange={(e) => setRelatedLinkQuery(e.target.value)}
              className="font-mono tabular-nums"
            />
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border/50 p-1 text-sm">
              {relatedLinkFiltered.length === 0 ? (
                <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                  Nenhum card disponível para vincular.
                </li>
              ) : (
                relatedLinkFiltered.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-muted/60"
                      onClick={() => {
                        if (!detailCard) return;
                        const r = addRelatedCard(detailCard.id, c.id);
                        if (!r.ok) {
                          toast.error(r.error ?? "Não foi possível vincular.");
                          return;
                        }
                        toast.success(`Vinculado #${c.workItemNumber}.`);
                        setRelatedLinkOpen(false);
                        setRelatedLinkQuery("");
                      }}
                    >
                      <span className="font-mono font-semibold text-primary">#{c.workItemNumber}</span>
                      <span className="min-w-0 truncate">{c.title}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                        {TYPE_SINGULAR[c.type]}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRelatedLinkOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
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
                <Label>Item pai (opcional)</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  {cardType === "feature" && "Ao associar, escolha um Épico existente."}
                  {cardType === "user_story" && "Ao associar, escolha uma Feature existente."}
                  {cardType === "task" && "Ao associar, escolha uma User Story existente."}
                </p>
                <Select
                  value={cardParentId ?? "__none"}
                  onValueChange={(v) => setCardParentId(v === "__none" ? null : v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Sem pai ou selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sem item pai</SelectItem>
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
