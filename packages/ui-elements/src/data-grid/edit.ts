import {
  datePlaceholder,
  draftText,
  type EditorKind,
  type EditTrigger,
  editorKind,
  normalizeOptions,
  parseDraft,
  sameValue,
  validateValue,
} from "@jcsoftdev/ui-core/grid/edit";
import {
  type CellEditor,
  type CellValue,
  type EditContext,
  type GridColumn,
  getCellValue,
} from "@jcsoftdev/ui-core/grid/model";
import { adoptStyles, emit, ensureId, rootOf } from "../internal/base.js";
import type { UiDataGrid } from "./data-grid.js";

/** The cell element, with the row it was filled for (an expando the grid sets). */
interface CellEl extends HTMLElement {
  _row?: unknown;
}

import css from "./edit.css.js";

// The inline editor, loaded by the grid when an `editable` grid renders or an edit starts, so a
// read-only grid never downloads it. One session per grid at a time.

// biome-ignore lint/suspicious/noExplicitAny: rows are whatever the consumer passes.
type Row = any;
type Col = GridColumn<Row>;
type Move = "none" | "down" | "up" | "next" | "prev";
type Read = { ok: true; value: CellValue } | { ok: false; message: string };

interface Editor {
  element: HTMLElement;
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

function field<K extends "input" | "select">(tag: K, header: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.dataset.uiPart = "editor";
  element.setAttribute("aria-label", header);
  return element;
}

function textEditor(ctx: Ctx, kind: EditorKind | "custom", seed: string | undefined): Editor {
  const { column, row, locale, labels } = ctx;
  const input = field("input", column.header);
  input.type = "text";
  input.autocomplete = "off";
  input.spellcheck = false;
  if (kind === "number") input.inputMode = "decimal";
  if (kind === "date") input.placeholder = datePlaceholder(locale);
  input.value = seed ?? draftText(kind, ctx.value, locale);
  return {
    element: input,
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
  const select = field("select", ctx.column.header);
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
  if (seed) {
    const found = entries.findIndex(
      (entry) => entry.label !== "" && entry.label.toLowerCase().startsWith(seed.toLowerCase()),
    );
    if (found >= 0) select.selectedIndex = found;
  }
  return {
    element: select,
    focus: () => select.focus(),
    read: () => ({ ok: true, value: entries[select.selectedIndex]?.value ?? null }),
    mark: (message, describedBy) => mark(select, message, describedBy),
  };
}

function booleanEditor(ctx: Ctx): Editor {
  const box = field("input", ctx.column.header);
  box.type = "checkbox";
  box.checked = ctx.value === true;
  return {
    element: box,
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
}

function isEditable(grid: UiDataGrid, column: Col, row: Row): boolean {
  const editable = column.editable;
  return (
    row != null &&
    (typeof editable === "function" ? editable(row) : (editable ?? grid.hasAttribute("editable")))
  );
}

/** What starts an edit on a focused cell: Enter, F2 or a printable key. */
function triggerOf(event: KeyboardEvent): EditTrigger | null {
  const { key } = event;
  if (key === "Enter") return "enter";
  if (key === "F2") return "f2";
  const printable =
    key.length === 1 && key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey;
  return printable ? "type" : null;
}

const installed = new WeakSet<UiDataGrid>();

/**
 * Hooks the grid's keyboard and double click, before its own handlers, so an editable cell opens
 * its editor instead of the default Enter / F2 behaviour. Called once per grid by the grid.
 */
export function install(grid: UiDataGrid): void {
  if (installed.has(grid)) return;
  installed.add(grid);
  const start = (event: Event, cell: HTMLElement, trigger: EditTrigger, seed?: string) => {
    const rowKey = cell.closest<HTMLElement>("[role=row]")?.dataset.key;
    const columnId = cell.dataset.col;
    const column = grid.columns.find((candidate) => candidate.id === columnId);
    if (rowKey === undefined || !columnId || !column) return;
    if (!isEditable(grid, column, (cell as CellEl)._row)) return;
    event.preventDefault();
    event.stopPropagation();
    void grid.editCell(rowKey, columnId, { trigger, seed });
  };
  grid.addEventListener(
    "keydown",
    (event) => {
      const cell = event.target;
      if (event.defaultPrevented || !(cell instanceof HTMLElement)) return;
      if (cell.getAttribute("role") !== "gridcell") return;
      const trigger = triggerOf(event);
      if (trigger) start(event, cell, trigger, trigger === "type" ? event.key : undefined);
    },
    { capture: true },
  );
  grid.addEventListener(
    "dblclick",
    (event) => {
      const target = event.target as HTMLElement;
      const cell = target.closest<HTMLElement>("[role=gridcell]");
      if (cell && !target.closest(INTERACTIVE)) start(event, cell, "dblclick");
    },
    { capture: true },
  );
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
  if (!cell) {
    grid.focusCell(rowKey, columnId);
    for (let tries = 0; tries < 3 && !cell; tries += 1) {
      await frame();
      cell = grid.getCellElement(rowKey, columnId);
    }
  }
  if (!cell) return false;
  const row = (cell as CellEl)._row;
  if (!isEditable(grid, column, row)) return false;
  const { seed } = options;
  const open = sessions.get(grid);
  if (open?.cell === cell) {
    open.focus();
    return true;
  }
  if (
    !emit(
      grid,
      "beforecelledit",
      { rowKey, columnId, row, trigger: options.trigger ?? "api" },
      true,
    )
  )
    return false;
  sessions.get(grid)?.cancel();

  const ctx: Ctx = {
    column,
    row,
    rowKey,
    value: getCellValue(row, column),
    locale: grid.locale,
    labels: grid.labels,
    grid,
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

  adoptStyles(rootOf(grid), css);
  const abort = new AbortController();
  const { signal } = abort;
  let closed = false;
  let busy = false;
  let epoch = 0;
  let tip: HTMLElement | undefined;
  const viewport = grid.querySelector<HTMLElement>("[data-ui-part=viewport]");

  const place = () => {
    if (!tip) return;
    const box = target.getBoundingClientRect();
    tip.style.insetBlockStart = `${box.bottom + 2}px`;
    const rtl = getComputedStyle(target).direction === "rtl";
    tip.style.insetInlineStart = `${rtl ? document.documentElement.clientWidth - box.right : box.left}px`;
  };
  const clear = () => {
    if (!tip) return;
    try {
      tip.hidePopover();
    } catch {}
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
      tip.setAttribute("role", "alert");
      tip.popover = "manual";
      target.append(tip);
      tip.showPopover();
      viewport?.addEventListener("scroll", place, { passive: true });
    }
    place();
    const shown = tip;
    shown.textContent = "";
    // A live region announces text that arrives after it is in the page.
    queueMicrotask(() => {
      shown.textContent = message;
    });
    editor.mark(message, ensureId(shown, "grid-edit-error"));
  };

  /** Opens the next editable cell in Tab order, if there is one. */
  const advance = async (fromKey: string, fromId: string, step: 1 | -1) => {
    let at = { rowKey: fromKey, columnId: fromId };
    for (let reach = 0; reach < TAB_REACH; reach += 1) {
      const next = grid.stepCell(at.rowKey, at.columnId, 0, step);
      if (!next) return;
      at = next;
      if (await grid.editCell(next.rowKey, next.columnId, { trigger: "tab" })) return;
    }
  };

  const finish = (move: Move) => {
    if (closed) return;
    closed = true;
    epoch += 1;
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
    if (!(hadFocus || free)) return;
    if (move === "down" || move === "up") {
      const next = grid.stepCell(rowKey, columnId, move === "down" ? 1 : -1, 0);
      grid.focusCell(next?.rowKey ?? rowKey, next?.columnId ?? columnId);
      return;
    }
    grid.focusCell(rowKey, columnId);
    if (move === "next" || move === "prev")
      void advance(rowKey, columnId, move === "next" ? 1 : -1);
  };

  const commit = async (move: Move): Promise<boolean> => {
    if (closed || busy) return false;
    busy = true;
    target.setAttribute("aria-busy", "true");
    const token = epoch;
    try {
      const read = editor.read();
      let message = read.ok ? null : read.message;
      const value = read.ok ? read.value : null;
      const changed = read.ok && !sameValue(value, ctx.value);
      if (changed) message = await validateValue(column, value, row);
      if (closed || token !== epoch) return false;
      if (message) {
        fail(message);
        return false;
      }
      if (changed) grid.changeCell(rowKey, columnId, value);
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
    "focusout",
    (event) => {
      const to = event.relatedTarget;
      if (to instanceof Node && target.contains(to)) return;
      void commit("none");
    },
    { signal },
  );
  for (const type of ["input", "change"]) target.addEventListener(type, clear, { signal });
  editor.element.addEventListener("commit", () => void commit("none"), { signal });
  editor.element.addEventListener("cancel", cancel, { signal });

  grid.setEditingCell(rowKey, columnId);
  target.dataset.editing = "";
  target.replaceChildren(editor.element);
  editor.focus();
  return true;
}
