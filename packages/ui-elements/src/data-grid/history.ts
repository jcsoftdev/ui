import { sameValue } from "@jcsoftdev/ui-core/grid/edit";
import {
  commandSize,
  createHistory,
  DEFAULT_HISTORY_DEPTH,
  type HistoryCommand,
  pushCommand,
  redoCommand,
  setHistoryDepth,
  summarizeHistory,
  undoCommand,
} from "@jcsoftdev/ui-core/grid/history";
import { type CellValue, getCellValue } from "@jcsoftdev/ui-core/grid/model";
import { emit } from "../internal/base.js";
import { changeCells } from "./batch.js";
import type { ChangeSource, UiDataGrid } from "./data-grid.js";
import { announce, cellTarget, type Row } from "./shared.js";

// Undo and redo, loaded by the grid when the `history` attribute is set. Every `cellschange` that
// is not itself an undo or redo becomes one step, so a paste or a fill undoes as one.
//
// Emit mode: the grid never applies a change there, so the history records what it EMITTED, not
// what the consumer did with it. Undo emits the inverse as a normal `cellschange` (source `undo`)
// and the consumer applies it like any other. History is only meaningful when the consumer
// applies the changes it receives; one that ignores or rewrites them gets inverses of changes
// that never happened.

const installed = new WeakSet<UiDataGrid>();
/** Most steps a history keeps, whatever `history-depth` asks for. */
const MAX_DEPTH = 1000;
/** Most cells the steps together may hold; the oldest steps go first. */
const CELL_BUDGET = 100_000;

/** Installs the history on a grid; called once per grid by the grid. */
export function install(grid: UiDataGrid): void {
  if (installed.has(grid)) return;
  installed.add(grid);
  // `history-depth="0"` turns the history off; no value keeps the default.
  const depth = () => {
    const n = Number.parseInt(grid.getAttribute("history-depth") ?? "", 10);
    return Number.isNaN(n) ? DEFAULT_HISTORY_DEPTH : Math.min(Math.max(n, 0), MAX_DEPTH);
  };
  const enabled = () => grid.hasAttribute("history") && depth() > 0;
  let state = createHistory<Row>(depth() || 1);
  // The rows the history describes: replacing them from outside makes its steps meaningless.
  let known = grid.rows;

  const changed = () => emit(grid, "historychange", summarizeHistory(state));

  const reset = () => {
    const had = state.past.length > 0 || state.future.length > 0;
    state = createHistory<Row>(depth() || 1);
    if (had) changed();
  };

  /** Drops the history when `rows` was replaced by something other than the grid itself. */
  const sync = () => {
    if (grid.rows !== known && grid.getAttribute("edit-mode") !== "emit") reset();
    known = grid.rows;
  };

  const total = (past: readonly HistoryCommand<Row>[]) =>
    past.reduce((n, command) => n + commandSize(command), 0);

  const record = (command: HistoryCommand<Row>) => {
    if (!enabled()) {
      reset();
      return;
    }
    sync();
    if (state.depth !== depth()) state = setHistoryDepth(state, depth());
    let next = pushCommand(state, command);
    if (next === state) return;
    while (next.past.length > 1 && total(next.past) > CELL_BUDGET)
      next = { ...next, past: next.past.slice(1) };
    state = next;
    changed();
  };

  grid.addEventListener("cellschange", (event) => {
    if (event.target !== grid) return;
    const { changes, source } = (event as CustomEvent).detail as {
      changes: { rowKey: string; columnId: string; oldValue: never; value: never }[];
      source: ChangeSource;
    };
    if (source === "undo" || source === "redo") return;
    // Writes from code are only steps when the grid opts in with `history-api`.
    if (source === "api" && !grid.hasAttribute("history-api")) return;
    record({
      kind: "cells",
      source,
      changes: changes.map((change) => ({
        rowId: change.rowKey,
        columnId: change.columnId,
        before: change.oldValue,
        after: change.value,
      })),
    });
  });

  /** The value a cell holds now, `undefined` when it is gone. */
  const held = (rowKey: string, columnId: string): { value: CellValue } | undefined => {
    const { view } = grid._i();
    const v = view.indexOfKey(rowKey);
    const column = grid.columns.find((c) => c.id === columnId);
    const row = v < 0 ? undefined : grid.rows[view.sourceAt(v)];
    return row && column ? { value: getCellValue(row, column) } : undefined;
  };

  /**
   * Applies a command through the grid. A cell that no longer holds the value the step expects
   * (rows were replaced or edited by other means) is left alone, and the step is `partial`.
   * `cancelled` when a listener refused the write.
   */
  const apply = (
    command: HistoryCommand<Row>,
    source: "undo" | "redo",
  ): "done" | "partial" | "cancelled" => {
    if (command.kind !== "cells") return "done";
    const current = command.changes.filter((change) => {
      const now = held(change.rowId, change.columnId);
      return now && sameValue(now.value, change.before);
    });
    if (current.length === 0) return "partial";
    const result = changeCells(
      grid,
      current.map((change) => ({
        rowKey: change.rowId,
        columnId: change.columnId,
        value: change.after,
      })),
      source,
    );
    if (result.cancelled) return "cancelled";
    return current.length === command.changes.length && result.rejected.length === 0
      ? "done"
      : "partial";
  };

  const move = (direction: "undo" | "redo"): boolean => {
    if (!enabled()) return false;
    sync();
    const step = direction === "undo" ? undoCommand(state) : redoCommand(state);
    if (!step) return false;
    const outcome = apply(step.apply, direction);
    if (outcome === "cancelled") return false;
    state = step.state;
    changed();
    const cells = commandSize(step.apply);
    announce(
      grid,
      (direction === "undo" ? grid.labels.undone : grid.labels.redone)?.(cells) ??
        `${direction === "undo" ? "Undid" : "Redid"} ${cells} ${cells === 1 ? "cell" : "cells"}`,
    );
    return outcome === "done";
  };

  Object.defineProperties(grid, {
    undo: { value: () => move("undo"), configurable: true },
    redo: { value: () => move("redo"), configurable: true },
    canUndo: { get: () => state.past.length > 0, configurable: true },
    canRedo: { get: () => state.future.length > 0, configurable: true },
  });

  grid.addEventListener(
    "keydown",
    (event) => {
      if (!enabled() || event.defaultPrevented || !cellTarget(event) || event.isComposing) return;
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      const redo = (key === "z" && event.shiftKey) || (key === "y" && !event.shiftKey);
      if (!redo && !(key === "z" && !event.shiftKey)) return;
      event.preventDefault();
      event.stopPropagation();
      move(redo ? "redo" : "undo");
    },
    { capture: true },
  );
}
