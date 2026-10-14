import {
  datePlaceholder,
  draftText,
  type EditorKind,
  type EditTrigger,
  editorKind,
  likeOriginal,
  normalizeOptions,
  parseDraft,
  sameValue,
  validateValue,
} from "@jcsoftdev/ui-core/grid/edit";
import type { CellEditor, CellValue, EditContext, GridColumn } from "@jcsoftdev/ui-core/grid/model";
import type { UiDataGrid } from "./data-grid.js";
import css from "./edit.css.js";
import { announce, isEditable } from "./shared.js";

/** What the grid hands over so this chunk shares no module with the grid's eager graph. */
export interface EditDeps {
  emit: typeof import("../internal/base.js").emit;
  getCellValue: typeof import("@jcsoftdev/ui-core/grid/model").getCellValue;
}

let deps: EditDeps;

/** The cell element, with the row it was filled for (an expando the grid sets). */
interface CellEl extends HTMLElement {
  _row?: unknown;
}

// The inline editor, loaded by the grid when an `editable` grid renders or an edit starts, so a
// read-only grid never downloads it. One session per grid at a time.

// biome-ignore lint/suspicious/noExplicitAny: rows are whatever the consumer passes.
type Row = any;
type Col = GridColumn<Row>;
type Move = "none" | "down" | "up" | "next" | "prev";
type Read = { ok: true; value: CellValue } | { ok: false; message: string };

interface Editor {
  element: HTMLElement;
  /** Whether the editor already differs from the stored value (a seed); custom editors always do. */
  dirty: boolean;
  read(): Read;
  focus(): void;
  mark(message: string | null, describedBy?: string): void;
}

interface Session {
  cell: HTMLElement;
  cancel(): void;
  focus(): void;
}

const sessions = new WeakMap<UiDataGrid, Session>();
const TAG = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;
/** How many cells Tab looks through for the next editable one. */
const TAB_REACH = 5000;

const INTERACTIVE =
  "a[href],button,input:not([data-ui-part=check]),select,textarea,[data-no-select]";

const sheets = new WeakSet<Node>();
let editSheet: CSSStyleSheet | undefined;
let ids = 0;

/** Adds the editor CSS to the root the grid lives in, once. */
function adopt(grid: UiDataGrid): void {
  const root = grid.getRootNode() as Document | ShadowRoot;
  if (sheets.has(root)) return;
  sheets.add(root);
  if (!editSheet) {
    editSheet = new CSSStyleSheet();
    editSheet.replaceSync(css);
  }
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, editSheet];
}

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function mark(element: HTMLElement, message: string | null, describedBy?: string): void {
  if (message === null) {
    element.removeAttribute("aria-invalid");
    element.removeAttribute("aria-describedby");
    return;
  }
  element.setAttribute("aria-invalid", "true");
  if (describedBy) element.setAttribute("aria-describedby", describedBy);
}

function field<K extends "input" | "select">(tag: K, label: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.dataset.uiPart = "editor";
  element.setAttribute("aria-label", label);
  return element;
}

function textEditor(ctx: Ctx, kind: EditorKind | "custom", seed: string | undefined): Editor {
  const { column, row, locale, labels } = ctx;
  const input = field("input", ctx.label);
  input.type = "text";
  input.autocomplete = "off";
  input.spellcheck = false;
  if (kind === "number") input.inputMode = "decimal";
  if (kind === "date") input.placeholder = datePlaceholder(locale);
  input.value = seed ?? draftText(kind, ctx.value, locale);
  return {
    element: input,
    dirty: seed !== undefined,
    focus() {
      input.focus();
      if (seed === undefined) input.select();
      else input.setSelectionRange(input.value.length, input.value.length);
    },
    read() {
      const result = parseDraft(column, kind, input.value, row, locale);
      if ("value" in result) return { ok: true, value: result.value };
      const message =
        result.message ??
        (result.error === "number"
          ? (labels.invalidNumber ?? "Enter a valid number")
          : result.error === "date"
            ? (labels.invalidDate ?? `Enter a valid date (${datePlaceholder(locale)})`)
            : (labels.invalidValue ?? "Invalid value"));
      return { ok: false, message };
    },
    mark: (message, describedBy) => mark(input, message, describedBy),
  };
}

function selectEditor(ctx: Ctx, seed: string | undefined): Editor {
  const select = field("select", ctx.label);
  const choices = normalizeOptions(ctx.column.options ?? []);
  const known = choices.some((choice) => String(choice.value) === String(ctx.value));
  // A value outside the options (or empty) gets a blank entry so it is not replaced silently.
  const entries: { value: CellValue; label: string }[] = known
    ? choices
    : [{ value: null, label: "" }, ...choices];
  for (const [index, entry] of entries.entries()) {
    const option = new Option(entry.label, String(index));
    option.selected = known ? String(entry.value) === String(ctx.value) : index === 0;
    select.append(option);
  }
  let dirty = false;
  if (seed) {
    const found = entries.findIndex(
      (entry) => entry.label !== "" && entry.label.toLowerCase().startsWith(seed.toLowerCase()),
    );
    if (found >= 0) {
      select.selectedIndex = found;
      dirty = true;
    }
  }
  return {
    element: select,
    dirty,
    focus: () => select.focus(),
    read: () => ({ ok: true, value: entries[select.selectedIndex]?.value ?? null }),
    mark: (message, describedBy) => mark(select, message, describedBy),
  };
}

function booleanEditor(ctx: Ctx): Editor {
  const box = field("input", ctx.label);
  box.type = "checkbox";
  box.checked = ctx.value === true;
  return {
    element: box,
    dirty: false,
    focus: () => box.focus(),
    read: () => ({ ok: true, value: box.checked }),
    mark: (message, describedBy) => mark(box, message, describedBy),
  };
}

function customEditor(ctx: Ctx, seed: string | undefined): Editor | null {
  const { column } = ctx;
  const context: EditContext<Row> = {
    row: ctx.row,
    rowId: ctx.rowKey,
    value: ctx.value,
    column,
    locale: ctx.locale,
    seed,
  };
  let made: CellEditor;
  if (typeof column.editor === "function") made = column.editor(context);
  else if (typeof column.editor === "string" && TAG.test(column.editor)) {
    const element = document.createElement(column.editor);
    customElements.upgrade(element);
    Object.assign(element, { ...context, rowId: ctx.rowKey });
    made = { element, value: () => (element as unknown as { value: CellValue }).value };
  } else return null;
  return {
    element: made.element,
    dirty: true,
    focus: () => (made.focus ? made.focus() : made.element.focus()),
    read: () => ({ ok: true, value: made.value() }),
    mark: (message, describedBy) => {
      if (made.setError) made.setError(message);
      else mark(made.element, message, describedBy);
    },
  };
}

interface Ctx {
  column: Col;
  row: Row;
  rowKey: string;
  value: CellValue;
  locale: string;
  labels: UiDataGrid["labels"];
  grid: UiDataGrid;
  /** Accessible name of the editor: the column and the row. */
  label: string;
}

/** The row object for a key, for a cell that is not mounted. */
function rowByKey(grid: UiDataGrid, key: string): Row {
  const keyOf = grid.rowKey;
  return grid.rows.find(
    (row, index) =>
      String(typeof keyOf === "function" ? keyOf(row, index) : keyOf ? row?.[keyOf] : index) ===
      key,
  );
}

interface Start {
  trigger: EditTrigger;
  seed?: string;
  /** Leave the key to the editor (an IME or dead key): no default prevented, no seed. */
  native?: boolean;
}

/**
 * What starts an edit on a focused cell: Enter, F2, a printable key (a single code point, AltGr
 * characters included) or an IME / dead key, which opens the editor and lets it receive the rest.
 */
function startOf(event: KeyboardEvent): Start | null {
  const { key } = event;
  if (key === "Enter") return { trigger: "enter" };
  if (key === "F2") return { trigger: "f2" };
  if (key === "Process" || key === "Dead") return { trigger: "type", native: true };
  const altGr = event.getModifierState?.("AltGraph") || (event.ctrlKey && event.altKey);
  const plain = !event.ctrlKey && !event.altKey;
  if ([...key].length !== 1 || key === " " || event.metaKey || !(altGr || plain)) return null;
  return { trigger: "type", seed: key };
}

const installed = new WeakSet<UiDataGrid>();

/**
 * Hooks the grid's keyboard and double click, before its own handlers, so an editable cell opens
 * its editor instead of the default Enter / F2 behaviour. Called once per grid by the grid, with
 * the helpers it shares with this chunk.
 */
export function install(grid: UiDataGrid, shared: EditDeps): void {
  deps = shared;
  if (installed.has(grid)) return;
  installed.add(grid);
  const start = (event: Event, cell: HTMLElement, how: Start) => {
    const rowKey = cell.closest<HTMLElement>("[role=row]")?.dataset.key;
    const columnId = cell.dataset.col;
    const column = grid.columns.find((candidate) => candidate.id === columnId);
    if (rowKey === undefined || !columnId || !column) return;
    if (!isEditable(grid, column, (cell as CellEl)._row)) return;
    if (!how.native) event.preventDefault();
    event.stopPropagation();
    void grid.editCell(rowKey, columnId, { trigger: how.trigger, seed: how.seed });
  };
  grid.addEventListener(
    "keydown",
    (event) => {
      const cell = event.target;
      if (event.defaultPrevented || !(cell instanceof HTMLElement)) return;
      if (cell.getAttribute("role") !== "gridcell") return;
      const how = startOf(event);
      if (how) start(event, cell, how);
    },
    { capture: true },
  );
  grid.addEventListener(
    "dblclick",
    (event) => {
      const target = event.target as HTMLElement;
      const cell = target.closest<HTMLElement>("[role=gridcell]");
      if (cell && !target.closest(INTERACTIVE)) start(event, cell, { trigger: "dblclick" });
    },
    { capture: true },
  );
}

const TABBABLE = "a[href],button,input,select,textarea,[tabindex]";

/** Moves focus to the next (or previous) tab stop outside the grid, as Tab would. */
function leave(grid: UiDataGrid, step: 1 | -1): void {
  const stops = [...document.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (el) =>
      !grid.contains(el) &&
      el.tabIndex >= 0 &&
      !(el as HTMLInputElement).disabled &&
      !el.closest("[inert]") &&
      el.getClientRects().length > 0,
  );
  const after = (el: HTMLElement) =>
    !!(grid.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
  const next = step > 0 ? stops.find(after) : stops.filter((el) => !after(el)).pop();
  next?.focus();
}

/** Opens the editor of a cell, after the cancelable `beforecelledit`. */
export async function beginEdit(
  grid: UiDataGrid,
  rowKey: string,
  columnId: string,
  options: { trigger?: EditTrigger; seed?: string },
): Promise<boolean> {
  const column = grid.columns.find((candidate) => candidate.id === columnId);
  if (!column) return false;
  let cell = grid.getCellElement(rowKey, columnId);
  // A refused edit must not move focus or scroll, so decide before the cell is brought into view.
  const row = cell ? (cell as CellEl)._row : rowByKey(grid, rowKey);
  if (!isEditable(grid, column, row)) return false;
  const { seed } = options;
  const open = sessions.get(grid);
  if (cell && open?.cell === cell) {
    open.focus();
    return true;
  }
  const trigger = options.trigger ?? "api";
  if (!deps.emit(grid, "beforecelledit", { rowKey, columnId, row, trigger }, true)) return false;
  if (!cell) {
    grid.focusCell(rowKey, columnId);
    for (let tries = 0; tries < 3 && !cell; tries += 1) {
      await frame();
      cell = grid.getCellElement(rowKey, columnId);
    }
  }
  if (!cell) return false;
  sessions.get(grid)?.cancel();

  const rowCells = cell.closest("[role=row]")?.querySelectorAll<HTMLElement>("[role=gridcell]");
  const rowLabel = [...(rowCells ?? [])]
    .find((candidate) => candidate.dataset.col !== "__select")
    ?.textContent?.trim();
  const ctx: Ctx = {
    column,
    row,
    rowKey,
    value: deps.getCellValue(row, column),
    locale: grid.locale,
    labels: grid.labels,
    grid,
    label: rowLabel ? `${column.header}, ${rowLabel}` : column.header,
  };
  const kind = editorKind(column);
  const editor =
    kind === "custom"
      ? customEditor(ctx, seed)
      : kind === "select"
        ? selectEditor(ctx, seed)
        : kind === "boolean"
          ? booleanEditor(ctx)
          : textEditor(ctx, kind, seed);
  if (!editor) return false;
  const target = cell;

  adopt(grid);
  const abort = new AbortController();
  const { signal } = abort;
  let closed = false;
  let busy = false;
  let dirty = editor.dirty;
  let epoch = 0;
  let validation: AbortController | undefined;
  let tip: HTMLElement | undefined;
  const viewport = grid.querySelector<HTMLElement>("[data-ui-part=viewport]");
  const focusInside = () => target.contains(document.activeElement);

  const place = () => {
    if (!tip) return;
    const box = target.getBoundingClientRect();
    tip.style.insetBlockStart = `${box.bottom + 2}px`;
    const rtl = getComputedStyle(target).direction === "rtl";
    tip.style.insetInlineStart = `${rtl ? document.documentElement.clientWidth - box.right : box.left}px`;
  };
  const reveal = () => {
    if (!tip || tip.matches(":popover-open")) return;
    tip.showPopover();
    place();
  };
  const hide = () => {
    try {
      tip?.hidePopover();
    } catch {}
  };
  const clear = () => {
    if (!tip) return;
    hide();
    tip.remove();
    tip = undefined;
    editor.mark(null);
    viewport?.removeEventListener("scroll", place);
  };
  const fail = (message: string) => {
    if (!target.isConnected) return;
    if (!tip) {
      tip = document.createElement("div");
      tip.dataset.uiPart = "edit-error";
      tip.popover = "manual";
      tip.id = `ui-grid-edit-error-${++ids}`;
      target.append(tip);
      viewport?.addEventListener("scroll", place, { passive: true });
    }
    tip.textContent = message;
    editor.mark(message, tip.id);
    // The message shows while the editor has focus; a click elsewhere hides it until focus returns.
    if (focusInside()) reveal();
    announce(grid, message);
  };

  /** Opens the next editable cell in Tab order. Resolves to whether there was one. */
  const advance = async (fromKey: string, fromId: string, step: 1 | -1): Promise<boolean> => {
    let at = { rowKey: fromKey, columnId: fromId };
    for (let reach = 0; reach < TAB_REACH; reach += 1) {
      const next = grid.stepCell(at.rowKey, at.columnId, 0, step);
      if (!next) return false;
      at = next;
      if (await grid.editCell(next.rowKey, next.columnId, { trigger: "tab" })) return true;
    }
    return false;
  };

  const finish = (move: Move) => {
    if (closed) return;
    closed = true;
    epoch += 1;
    validation?.abort();
    sessions.delete(grid);
    abort.abort();
    const active = document.activeElement;
    const hadFocus = target.contains(active);
    const free = !active || active === document.body;
    clear();
    target.removeAttribute("data-editing");
    target.removeAttribute("aria-busy");
    target.replaceChildren();
    grid.setEditingCell(null);
    if (!(hadFocus || free) || !grid.isConnected) return;
    if (move === "down" || move === "up") {
      const next = grid.stepCell(rowKey, columnId, move === "down" ? 1 : -1, 0);
      grid.focusCell(next?.rowKey ?? rowKey, next?.columnId ?? columnId);
      return;
    }
    grid.focusCell(rowKey, columnId);
    if (move === "next" || move === "prev") {
      const step = move === "next" ? 1 : -1;
      // Nothing left to edit in that direction: Tab leaves the grid, in the same key press.
      void advance(rowKey, columnId, step).then((found) => {
        if (!found) leave(grid, step);
      });
    }
  };

  const same = (a: Read, b: Read) => (a.ok && b.ok ? sameValue(a.value, b.value) : false);

  const commit = async (move: Move): Promise<boolean> => {
    if (closed || busy) return false;
    if (!target.isConnected || !grid.isConnected) {
      // The grid went away mid-edit: a half-typed value is not a decision.
      finish("none");
      return false;
    }
    if (!dirty) {
      finish(move);
      return true;
    }
    busy = true;
    target.setAttribute("aria-busy", "true");
    const token = epoch;
    try {
      const read = editor.read();
      let message = read.ok ? null : read.message;
      const typed = (kind === "number" || kind === "date") && !column.parse;
      const value = read.ok ? (typed ? likeOriginal(read.value, ctx.value) : read.value) : null;
      const changed = read.ok && !sameValue(value, ctx.value);
      if (changed) {
        validation = new AbortController();
        message = await validateValue(column, value, row, validation.signal);
      }
      // Anything typed meanwhile makes this verdict about a value that is gone.
      if (closed || token !== epoch || (changed && !same(read, editor.read()))) return false;
      if (message) {
        fail(message);
        return false;
      }
      if (changed) {
        let cancelled = false;
        const watch = (event: Event) => {
          cancelled = event.defaultPrevented;
        };
        window.addEventListener("beforecellchange", watch);
        const stored = grid.changeCell(rowKey, columnId, value);
        window.removeEventListener("beforecellchange", watch);
        if (!stored && !cancelled) {
          fail(ctx.labels.unwritable ?? "This value could not be saved");
          return false;
        }
        if (stored) announce(grid, `${column.header} ${ctx.labels.cellUpdated ?? "updated"}`);
      }
      finish(move);
      return true;
    } finally {
      busy = false;
      if (!closed) target.removeAttribute("aria-busy");
    }
  };

  const cancel = () => finish("none");
  sessions.set(grid, { cell: target, cancel, focus: () => editor.focus() });

  target.addEventListener(
    "keydown",
    (event) => {
      if (event.target === target || event.isComposing) return;
      // The keys belong to the editor, not to the grid's navigation. An editor that wants one
      // (a multi-line field's Enter) stops it before it gets here.
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      } else if (event.key === "Enter") {
        event.preventDefault();
        void commit(event.shiftKey ? "up" : "down");
      } else if (event.key === "Tab") {
        event.preventDefault();
        void commit(event.shiftKey ? "prev" : "next");
      }
    },
    { signal },
  );
  for (const type of ["click", "dblclick"])
    target.addEventListener(
      type,
      (event) => {
        if (event.target !== target) event.stopPropagation();
      },
      { signal },
    );
  target.addEventListener(
    "focusin",
    () => {
      if (tip) reveal();
    },
    { signal },
  );
  target.addEventListener(
    "focusout",
    (event) => {
      const to = event.relatedTarget;
      if (to instanceof Node && target.contains(to)) return;
      hide();
      // After the event: a grid that is being removed is not connected yet while this one fires.
      queueMicrotask(() => void commit("none"));
    },
    { signal },
  );
  for (const type of ["input", "change"])
    target.addEventListener(
      type,
      () => {
        dirty = true;
        epoch += 1;
        validation?.abort();
        clear();
      },
      { signal },
    );
  editor.element.addEventListener("commit", () => void commit("none"), { signal });
  editor.element.addEventListener("cancel", cancel, { signal });

  grid.setEditingCell(rowKey, columnId);
  target.dataset.editing = "";
  target.replaceChildren(editor.element);
  editor.focus();
  return true;
}
