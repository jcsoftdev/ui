"use client";

import {
  type KeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Avatar } from "../../atoms/avatar/avatar.js";
import { Chip } from "../../atoms/chip/chip.js";
import { GripVertical } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import {
  dropIndex,
  type KanbanCardData,
  type KanbanColumnData,
  type KanbanKey,
  type KanbanMove,
  keyboardTarget,
  locateCard,
  moveCard,
  wipStatus,
} from "./model.js";

export type KanbanPart =
  | "root"
  | "board"
  | "column"
  | "columnHeader"
  | "columnTitle"
  | "count"
  | "cards"
  | "card"
  | "grip"
  | "empty"
  | "indicator"
  | "ghost";

export interface KanbanProps {
  /** Controlled board. Pair with `onColumnsChange`. */
  columns?: KanbanColumnData[];
  defaultColumns?: KanbanColumnData[];
  /** Called after a drop (pointer release or keyboard drop) with the new board and the move. */
  onColumnsChange?: (columns: KanbanColumnData[], move: KanbanMove) => void;
  /** Refuse drops into another column that already reached its WIP limit. */
  enforceLimit?: boolean;
  /** Replaces the default card body. */
  renderCard?: (card: KanbanCardData) => ReactNode;
  emptyLabel?: string;
  "aria-label"?: string;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<KanbanPart>;
}

const KEYS: readonly string[] = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
const DRAG_THRESHOLD = 4;

interface DragState {
  cardId: string;
  x: number;
  y: number;
  width: number;
  offsetX: number;
  offsetY: number;
  target: { columnId: string; index: number } | null;
}

function DefaultCard({ card }: { card: KanbanCardData }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="break-words text-row-title text-ink">{card.title}</span>
      {card.description ? (
        <span className="line-clamp-2 break-words text-ink-3 text-meta">{card.description}</span>
      ) : null}
      {card.tag || card.assignee || card.meta ? (
        <div className="flex min-w-0 flex-wrap items-center gap-density-sm">
          {card.tag ? <Chip tone="accent">{card.tag}</Chip> : null}
          {card.meta ? <span className="text-ink-3 text-meta">{card.meta}</span> : null}
          {card.assignee ? (
            <span className="ml-auto">
              <Avatar name={card.assignee} />
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Board of columns with draggable cards and WIP limits. Pointer: drag a card (touch: use the
 * grip). Keyboard: Space or Enter picks a card up, arrows move it, Space or Enter drops it,
 * Escape cancels. Moves are announced in a live region.
 */
export function Kanban({
  columns: controlled,
  defaultColumns = [],
  onColumnsChange,
  enforceLimit = false,
  renderCard,
  emptyLabel = "Sin tarjetas",
  className,
  classNames,
  "aria-label": ariaLabel = "Tablero",
}: KanbanProps) {
  const [internal, setInternal] = useState(defaultColumns);
  const columns = controlled ?? internal;

  /** Working copy while a card is held with the keyboard; committed on drop. */
  const [draft, setDraft] = useState<KanbanColumnData[] | null>(null);
  const [grabbedId, setGrabbedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [status, setStatus] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const focusId = useRef<string | null>(null);
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const instructionsId = useId();

  const shown = draft ?? columns;

  const commit = useCallback(
    (next: KanbanColumnData[], move: KanbanMove) => {
      if (controlled === undefined) setInternal(next);
      onColumnsChange?.(next, move);
    },
    [controlled, onColumnsChange],
  );

  useLayoutEffect(() => {
    const id = focusId.current;
    if (!id) return;
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(id)}"]`);
    if (el && document.activeElement !== el) el.focus();
    if (!grabbedId) focusId.current = null;
  });

  const describe = (cols: KanbanColumnData[], cardId: string, verb: string) => {
    const at = locateCard(cols, cardId);
    const column = cols.find((c) => c.id === at?.columnId);
    const card = column?.cards[at?.index ?? 0];
    if (!at || !column || !card) return;
    setStatus(
      `${verb} ${card.title}: columna ${column.title}, posición ${at.index + 1} de ${column.cards.length}.`,
    );
  };

  const onCardKeyDown = (event: KeyboardEvent<HTMLElement>, card: KanbanCardData) => {
    const { key } = event;
    if (key === " " || key === "Enter") {
      event.preventDefault();
      if (grabbedId === card.id) {
        const move = draft ? moveFromDraft(columns, draft, card.id) : null;
        if (draft && move) commit(draft, move);
        describe(draft ?? columns, card.id, "Soltada");
        setDraft(null);
        setGrabbedId(null);
      } else if (!grabbedId) {
        setGrabbedId(card.id);
        setDraft(columns);
        focusId.current = card.id;
        describe(columns, card.id, "Tomada");
      }
      return;
    }
    if (grabbedId !== card.id) return;
    if (key === "Escape") {
      event.preventDefault();
      setDraft(null);
      setGrabbedId(null);
      setStatus(`Movimiento cancelado: ${card.title} vuelve a su lugar.`);
      return;
    }
    if (KEYS.includes(key)) {
      event.preventDefault();
      const base = draft ?? columns;
      const target = keyboardTarget(base, card.id, key as KanbanKey);
      if (!target) return;
      const result = moveCard(base, card.id, target.columnId, target.index, { enforceLimit });
      if (!result) {
        setStatus("Esa columna llegó a su límite.");
        return;
      }
      focusId.current = card.id;
      setDraft(result.columns);
      describe(result.columns, card.id, "Movida");
    }
  };

  const startPointerDrag = (event: ReactPointerEvent<HTMLElement>, card: KanbanCardData) => {
    if (event.button !== 0 || grabbedId) return;
    if (event.pointerType === "touch" && !(event.target as HTMLElement).closest("[data-grip]")) {
      return;
    }
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    let active = false;
    let latest: DragState["target"] = null;

    const locate = (x: number, y: number): DragState["target"] => {
      const column = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-column-id]");
      const columnId = column?.dataset.columnId;
      if (!column || !columnId) return null;
      const mids = Array.from(column.querySelectorAll<HTMLElement>("[data-card-id]"))
        .filter((el) => el.dataset.cardId !== card.id)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return r.top + r.height / 2;
        });
      return { columnId, index: dropIndex(mids, y) };
    };

    const onMove = (e: PointerEvent) => {
      if (!active) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD) return;
        active = true;
        setStatus(`Arrastrando ${card.title}.`);
      }
      latest = locate(e.clientX, e.clientY);
      setDrag({
        cardId: card.id,
        x: e.clientX,
        y: e.clientY,
        width: rect.width,
        offsetX: startX - rect.left,
        offsetY: startY - rect.top,
        target: latest,
      });
    };
    const finish = (apply: boolean) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onEscape);
      if (!active) return;
      setDrag(null);
      if (apply && latest) {
        const result = moveCard(columnsRef.current, card.id, latest.columnId, latest.index, {
          enforceLimit,
        });
        if (result) {
          commit(result.columns, result.move);
          describe(result.columns, card.id, "Soltada");
          return;
        }
      }
      setStatus(`Movimiento cancelado: ${card.title} vuelve a su lugar.`);
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onEscape);
  };

  const dragged = drag
    ? shown.flatMap((c) => c.cards).find((c) => c.id === drag.cardId)
    : undefined;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: focus leaving the board cancels a held card
    <div
      ref={rootRef}
      className={cn("@container/kanban min-w-0", classNames?.root, className)}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (grabbedId && next && !rootRef.current?.contains(next)) {
          setDraft(null);
          setGrabbedId(null);
          setStatus("Movimiento cancelado.");
        }
      }}
    >
      <p id={instructionsId} className="sr-only">
        Presiona Espacio para tomar una tarjeta, las flechas para moverla y Espacio para soltarla.
        Escape cancela.
      </p>
      <div role="status" aria-live="assertive" className="sr-only">
        {status}
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: board of columns, not a form group */}
      <div
        role="group"
        aria-label={ariaLabel}
        className={cn(
          "flex snap-x snap-mandatory items-start gap-density overflow-x-auto pb-2",
          classNames?.board,
        )}
      >
        {shown.map((column) => {
          const state = wipStatus(column.cards.length, column.wipLimit);
          const targetHere = drag?.target?.columnId === column.id ? drag.target.index : null;
          let seen = 0;
          const items: ReactNode[] = [];
          const indicator = (key: string) => (
            <li
              key={key}
              aria-hidden="true"
              className={cn("h-1 shrink-0 rounded-badge bg-accent", classNames?.indicator)}
              data-drop-indicator=""
            />
          );
          for (const card of column.cards) {
            const isDragged = drag?.cardId === card.id;
            if (!isDragged) {
              if (targetHere === seen) items.push(indicator(`ind-${seen}`));
              seen += 1;
            }
            const grabbed = grabbedId === card.id;
            items.push(
              <li key={card.id} className="min-w-0">
                {/* biome-ignore lint/a11y/useSemanticElements: draggable card is a custom widget */}
                <div
                  role="button"
                  tabIndex={0}
                  data-card-id={card.id}
                  aria-pressed={grabbed}
                  aria-roledescription="tarjeta arrastrable"
                  aria-describedby={instructionsId}
                  onKeyDown={(e) => onCardKeyDown(e, card)}
                  onPointerDown={(e) => startPointerDrag(e, card)}
                  className={cn(
                    "pressable relative flex cursor-grab select-none gap-1 rounded-input border-card surface-card p-density shadow-card focus-visible:focus-ring",
                    isDragged && "opacity-40",
                    grabbed && "shadow-selected",
                    classNames?.card,
                  )}
                >
                  <span
                    data-grip=""
                    aria-hidden="true"
                    className={cn(
                      "-ml-1 flex w-4 shrink-0 touch-none items-start pt-0.5 text-ink-3",
                      classNames?.grip,
                    )}
                  >
                    <GripVertical className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    {renderCard ? renderCard(card) : <DefaultCard card={card} />}
                  </div>
                </div>
              </li>,
            );
          }
          if (targetHere !== null && targetHere >= seen) items.push(indicator("ind-end"));

          return (
            <section
              key={column.id}
              data-column-id={column.id}
              aria-label={column.title}
              className={cn(
                "flex w-[min(18rem,85cqw)] shrink-0 snap-start flex-col gap-density-sm rounded-card bg-surface-sunken p-density-sm @4xl/kanban:w-auto @4xl/kanban:min-w-56 @4xl/kanban:flex-1",
                classNames?.column,
              )}
            >
              <header
                className={cn(
                  "flex min-w-0 items-center justify-between gap-density-sm px-1 pt-1",
                  classNames?.columnHeader,
                )}
              >
                <h3
                  className={cn(
                    "min-w-0 truncate text-card-title text-ink",
                    classNames?.columnTitle,
                  )}
                >
                  {column.title}
                </h3>
                <Chip
                  className={classNames?.count}
                  tone={state === "over" ? "danger" : state === "at-limit" ? "warning" : "neutral"}
                  aria-label={
                    column.wipLimit === undefined
                      ? `${column.cards.length} tarjetas`
                      : `${column.cards.length} de ${column.wipLimit} tarjetas, límite de trabajo en curso`
                  }
                >
                  {column.wipLimit === undefined
                    ? column.cards.length
                    : `${column.cards.length}/${column.wipLimit}`}
                </Chip>
              </header>
              <ul
                className={cn(
                  "m-0 flex min-h-16 list-none flex-col gap-density-sm p-0",
                  classNames?.cards,
                )}
              >
                {items}
                {column.cards.length === 0 && targetHere === null ? (
                  <li
                    className={cn(
                      "px-1 py-density text-center text-ink-3 text-meta",
                      classNames?.empty,
                    )}
                  >
                    {emptyLabel}
                  </li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>
      {drag && dragged ? (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none fixed z-90 rotate-1 rounded-input border-card surface-card p-density shadow-overlay",
            classNames?.ghost,
          )}
          style={{
            left: drag.x - drag.offsetX,
            top: drag.y - drag.offsetY,
            width: drag.width,
          }}
        >
          {renderCard ? renderCard(dragged) : <DefaultCard card={dragged} />}
        </div>
      ) : null}
    </div>
  );
}

/** The move implied by a keyboard-held card: from the committed board to the draft. */
function moveFromDraft(
  original: KanbanColumnData[],
  draft: KanbanColumnData[],
  cardId: string,
): KanbanMove | null {
  const from = locateCard(original, cardId);
  const to = locateCard(draft, cardId);
  if (!from || !to) return null;
  if (from.columnId === to.columnId && from.index === to.index) return null;
  return {
    cardId,
    fromColumnId: from.columnId,
    fromIndex: from.index,
    toColumnId: to.columnId,
    toIndex: to.index,
  };
}
