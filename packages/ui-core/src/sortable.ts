export interface SortableList<T = unknown> {
  id: string;
  items: readonly T[];
  /** Work-in-progress limit: a different list at the limit refuses drops when `enforceLimit`. */
  limit?: number;
}

export interface SortableMove {
  itemId: string;
  fromListId: string;
  fromIndex: number;
  toListId: string;
  toIndex: number;
}

export interface SortableLocation {
  listId: string;
  index: number;
}

type Identify<T> = (item: T) => string;

export function locateItem<T>(
  lists: readonly SortableList<T>[],
  itemId: string,
  getId: Identify<T>,
): SortableLocation | null {
  for (const list of lists) {
    const index = list.items.findIndex((item) => getId(item) === itemId);
    if (index !== -1) return { listId: list.id, index };
  }
  return null;
}

export interface MoveOptions {
  /** Refuse drops into a different list that is already at its limit. */
  enforceLimit?: boolean;
}

/**
 * Moves an item. `toIndex` is the position in the target list AFTER the item left its origin,
 * clamped to the list. Returns `null` when nothing changes (unknown ids, same spot, blocked drop).
 */
export function moveItem<T>(
  lists: readonly SortableList<T>[],
  itemId: string,
  toListId: string,
  toIndex: number,
  getId: Identify<T>,
  options: MoveOptions = {},
): { lists: SortableList<T>[]; move: SortableMove } | null {
  const from = locateItem(lists, itemId, getId);
  const target = lists.find((list) => list.id === toListId);
  if (!from || !target) return null;

  const sameList = from.listId === toListId;
  if (
    !sameList &&
    options.enforceLimit &&
    target.limit !== undefined &&
    target.items.length >= target.limit
  ) {
    return null;
  }

  const remaining = sameList ? target.items.length - 1 : target.items.length;
  const index = Math.min(Math.max(0, Math.trunc(toIndex)), remaining);
  if (sameList && index === from.index) return null;

  const item = lists.find((list) => list.id === from.listId)?.items[from.index];
  if (item === undefined) return null;

  const next = lists.map((list) => {
    if (list.id === from.listId && !sameList) {
      return { ...list, items: list.items.filter((x) => getId(x) !== itemId) };
    }
    if (list.id === toListId) {
      const items = list.items.filter((x) => getId(x) !== itemId);
      items.splice(index, 0, item);
      return { ...list, items };
    }
    return list;
  });

  return {
    lists: next,
    move: { itemId, fromListId: from.listId, fromIndex: from.index, toListId, toIndex: index },
  };
}

export type SortableKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

/** Where a grabbed item goes for an arrow key: sideways keeps the row, vertical reorders. */
export function keyboardTarget<T>(
  lists: readonly SortableList<T>[],
  itemId: string,
  key: SortableKey,
  getId: Identify<T>,
): SortableLocation | null {
  const at = locateItem(lists, itemId, getId);
  if (!at) return null;
  const listIndex = lists.findIndex((list) => list.id === at.listId);
  const list = lists[listIndex];
  if (!list) return null;
  if (key === "ArrowUp") return at.index > 0 ? { listId: at.listId, index: at.index - 1 } : null;
  if (key === "ArrowDown") {
    return at.index < list.items.length - 1 ? { listId: at.listId, index: at.index + 1 } : null;
  }
  const neighbour = lists[listIndex + (key === "ArrowRight" ? 1 : -1)];
  if (!neighbour) return null;
  return { listId: neighbour.id, index: Math.min(at.index, neighbour.items.length) };
}

/** Insert index for a pointer at `y`, from the vertical midpoints of the items left in a list. */
export function dropIndex(midpoints: readonly number[], y: number, reversed = false): number {
  let index = 0;
  for (const mid of midpoints) if (reversed ? y < mid : y > mid) index += 1;
  return index;
}

export interface SortableOptions<T> {
  /** Current lists. A single list is `[{ id, items }]`. */
  lists: () => readonly SortableList<T>[];
  getId: Identify<T>;
  /** Called after a drop (pointer release or keyboard drop). Apply the move to your data. */
  /**
   * Return `false` when the owner refused the move: the drop announcement is skipped and
   * "Move cancelled: X stays in Y." is announced instead.
   */
  onMove: (move: SortableMove, lists: SortableList<T>[]) => boolean | void;
  enforceLimit?: boolean;
  /** Pixels before a pointer press becomes a drag. Default 4. */
  threshold?: number;
  /** Called with a live-region message for each step (grab, move, drop, cancel). */
  announce?: (message: string) => void;
  /** Pointer: called while dragging with the drop target (or `null`), to draw an indicator. */
  onDragOver?: (target: SortableLocation | null, itemId: string) => void;
  onDragEnd?: () => void;
  /** Keyboard: called with the working copy each time a held item moves, so the owner re-renders. */
  onDraft?: (lists: SortableList<T>[] | null) => void;
  /** Right-to-left: ArrowLeft goes to the next list and ArrowRight to the previous one. */
  rtl?: () => boolean;
  /** Names used in announcements instead of ids. */
  itemLabel?: (item: T) => string;
  listLabel?: (list: SortableList<T>) => string;
  /** Restricts the pointer drag start (touch usually requires a handle). */
  canStartPointer?: (event: PointerEvent, item: HTMLElement) => boolean;
  /**
   * `"x"` for a horizontal list (column headers): the pointer drop index follows the horizontal
   * midpoints (mirrored in `rtl`) and the keyboard moves with ArrowLeft / ArrowRight inside the
   * list. Default `"y"`.
   */
  axis?: "x" | "y";
  /** Keys that pick an item up and drop it. Default `[" ", "Enter"]`; `[]` leaves the keyboard to the owner. */
  grabKeys?: readonly string[];
}

export interface Sortable<T> {
  /** Item grabbed with the keyboard, if any. */
  readonly grabbed: string | undefined;
  /** Working copy while an item is held with the keyboard, otherwise the real lists. */
  lists(): readonly SortableList<T>[];
  cancel(): void;
  destroy(): void;
}

const escapeId = (id: string) =>
  typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id.replace(/["\\]/g, "\\$&");

const KEYS: readonly string[] = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];

/**
 * Pointer and keyboard reordering over items marked `[data-sortable-item="<id>"]` inside lists
 * marked `[data-sortable-list="<id>"]`. Pointer: press and drag (a 4px threshold keeps clicks).
 * Keyboard: Space or Enter picks the focused item up, arrows move it (across lists too), Space or
 * Enter drops, Escape cancels. The owner renders; this reports moves and drop targets.
 */
export function createSortable<T>(root: HTMLElement, options: SortableOptions<T>): Sortable<T> {
  const threshold = options.threshold ?? 4;
  const horizontal = options.axis === "x";
  const grabKeys = options.grabKeys ?? [" ", "Enter"];
  const say = (message: string) => options.announce?.(message);
  const nameOf = (id: string) => {
    const at = locateItem(options.lists(), id, options.getId);
    const item = at ? options.lists().find((l) => l.id === at.listId)?.items[at.index] : undefined;
    return item !== undefined ? (options.itemLabel?.(item) ?? id) : id;
  };
  let grabbed: string | undefined;
  let draft: SortableList<T>[] | null = null;
  let stopPointer: (() => void) | undefined;

  const lists = () => draft ?? options.lists();
  const itemOf = (target: EventTarget | null) => {
    const el = (target as Element | null)?.closest?.<HTMLElement>("[data-sortable-item]");
    return el && root.contains(el) ? el : null;
  };
  const messageFor = (current: readonly SortableList<T>[], id: string, verb: string) => {
    const at = locateItem(current, id, options.getId);
    const list = current.find((l) => l.id === at?.listId);
    const item = list?.items[at?.index ?? 0];
    if (!at || !list || item === undefined) return undefined;
    const name = options.itemLabel?.(item) ?? id;
    return `${verb} ${name}: ${options.listLabel?.(list) ?? list.id}, ${at.index + 1} / ${list.items.length}.`;
  };
  const describe = (current: readonly SortableList<T>[], id: string, verb: string) => {
    const message = messageFor(current, id, verb);
    if (message) say(message);
  };
  /** Reports a drop to the owner, then announces it, or the refusal when the owner returns false. */
  const commit = (move: SortableMove, next: SortableList<T>[], id: string) => {
    const dropped = messageFor(next, id, "Dropped");
    if (options.onMove(move, next) === false) {
      const at = locateItem(options.lists(), id, options.getId);
      const list = options.lists().find((l) => l.id === at?.listId);
      say(
        `Move cancelled: ${nameOf(id)} stays in ${list ? (options.listLabel?.(list) ?? list.id) : "its list"}.`,
      );
    } else if (dropped) say(dropped);
  };
  const refocus = (id: string) =>
    root.querySelector<HTMLElement>(`[data-sortable-item="${escapeId(id)}"]`)?.focus();

  const moveFromDraft = (id: string): SortableMove | null => {
    if (!draft) return null;
    const from = locateItem(options.lists(), id, options.getId);
    const to = locateItem(draft, id, options.getId);
    if (!from || !to || (from.listId === to.listId && from.index === to.index)) return null;
    return {
      itemId: id,
      fromListId: from.listId,
      fromIndex: from.index,
      toListId: to.listId,
      toIndex: to.index,
    };
  };

  const cancel = () => {
    if (grabbed === undefined) return;
    const id = grabbed;
    grabbed = undefined;
    draft = null;
    options.onDraft?.(null);
    refocus(id);
    say(`Cancelled: ${nameOf(id)} returns to its place.`);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const el = itemOf(event.target);
    if (!el || event.target !== el) return;
    const id = el.dataset.sortableItem as string;
    const { key } = event;
    if (grabKeys.includes(key)) {
      event.preventDefault();
      if (grabbed === id) {
        const move = moveFromDraft(id);
        const final = draft;
        grabbed = undefined;
        draft = null;
        if (move && final) commit(move, final, id);
        else {
          describe(options.lists(), id, "Dropped");
          options.onDraft?.(null);
        }
      } else if (grabbed === undefined) {
        grabbed = id;
        draft = [...options.lists()];
        describe(draft, id, "Picked up");
      }
      return;
    }
    if (grabbed !== id) return;
    if (key === "Escape") {
      event.preventDefault();
      cancel();
      return;
    }
    if (KEYS.includes(key)) {
      event.preventDefault();
      const base = lists();
      const flip = options.rtl?.() === true;
      const arrow =
        flip && key === "ArrowLeft"
          ? "ArrowRight"
          : flip && key === "ArrowRight"
            ? "ArrowLeft"
            : key;
      const axisKey = horizontal
        ? arrow === "ArrowLeft"
          ? "ArrowUp"
          : arrow === "ArrowRight"
            ? "ArrowDown"
            : undefined
        : arrow;
      if (!axisKey) return;
      const target = keyboardTarget(base, id, axisKey as SortableKey, options.getId);
      if (!target) return;
      const moveOptions = { enforceLimit: options.enforceLimit };
      let result = moveItem(base, id, target.listId, target.index, options.getId, moveOptions);
      if (!result && !horizontal && (arrow === "ArrowLeft" || arrow === "ArrowRight")) {
        // A full list is skipped: the item goes to the next list in that direction with room.
        const step = arrow === "ArrowRight" ? 1 : -1;
        for (let at = base.findIndex((l) => l.id === target.listId) + step; !result; at += step) {
          const next = base[at];
          if (!next) break;
          result = moveItem(base, id, next.id, target.index, options.getId, moveOptions);
        }
      }
      if (!result) {
        say("That list reached its limit.");
        return;
      }
      draft = result.lists;
      options.onDraft?.(draft);
      refocus(id);
      describe(draft, id, "Moved");
    }
  };

  const onFocusOut = (event: FocusEvent) => {
    const next = event.relatedTarget as Node | null;
    if (grabbed !== undefined && next && !root.contains(next)) cancel();
  };

  const onPointerDown = (event: PointerEvent) => {
    const el = itemOf(event.target);
    if (!el || event.button !== 0 || grabbed !== undefined || stopPointer) return;
    if (options.canStartPointer && !options.canStartPointer(event, el)) return;
    const id = el.dataset.sortableItem as string;
    const startX = event.clientX;
    const startY = event.clientY;
    let active = false;
    let latest: SortableLocation | null = null;

    const locate = (x: number, y: number): SortableLocation | null => {
      const list = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-sortable-list]");
      const listId = list?.dataset.sortableList;
      if (!list || listId === undefined) return null;
      const mids = Array.from(list.querySelectorAll<HTMLElement>("[data-sortable-item]"))
        .filter((node) => node.dataset.sortableItem !== id)
        .map((node) => {
          const r = node.getBoundingClientRect();
          return horizontal ? r.left + r.width / 2 : r.top + r.height / 2;
        });
      return {
        listId,
        index: horizontal ? dropIndex(mids, x, options.rtl?.() === true) : dropIndex(mids, y),
      };
    };
    const onMove = (e: PointerEvent) => {
      if (!active) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < threshold) return;
        active = true;
        say(`Dragging ${nameOf(id)}.`);
      }
      latest = locate(e.clientX, e.clientY);
      options.onDragOver?.(latest, id);
    };
    const finish = (apply: boolean) => {
      stop();
      if (!active) return;
      options.onDragOver?.(null, id);
      options.onDragEnd?.();
      if (apply && latest) {
        const result = moveItem(options.lists(), id, latest.listId, latest.index, options.getId, {
          enforceLimit: options.enforceLimit,
        });
        if (result) {
          commit(result.move, result.lists, id);
          return;
        }
      }
      say(`Cancelled: ${nameOf(id)} returns to its place.`);
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
    };
    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onEscape);
      stopPointer = undefined;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onEscape);
    stopPointer = stop;
  };

  root.addEventListener("keydown", onKeyDown);
  root.addEventListener("focusout", onFocusOut);
  root.addEventListener("pointerdown", onPointerDown);
  return {
    get grabbed() {
      return grabbed;
    },
    lists,
    cancel,
    destroy() {
      stopPointer?.();
      root.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("focusout", onFocusOut);
      root.removeEventListener("pointerdown", onPointerDown);
    },
  };
}
