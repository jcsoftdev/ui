import {
  commandSize,
  createHistory,
  DEFAULT_HISTORY_DEPTH,
  type HistoryCommand,
  pushCommand,
  type RowRef,
  redoCommand,
  setHistoryDepth,
  summarizeHistory,
  undoCommand,
} from "@jcsoftdev/ui-core/grid/history";
import { emit } from "../internal/base.js";
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

/** Installs the history on a grid; called once per grid by the grid. */
export function install(grid: UiDataGrid): void {
  if (installed.has(grid)) return;
  installed.add(grid);
  const enabled = () => grid.hasAttribute("history");
  const depth = () => Number(grid.getAttribute("history-depth")) || DEFAULT_HISTORY_DEPTH;
  let state = createHistory<Row>(depth());

  const changed = () => {
    const summary = summarizeHistory(state);
    emit(grid, "historychange", summary);
  };

  const record = (command: HistoryCommand<Row>) => {
    if (!enabled()) {
      if (state.past.length || state.future.length) {
        state = createHistory<Row>(depth());
        changed();
      }
      return;
    }
    if (state.depth !== Math.max(1, Math.floor(depth()))) state = setHistoryDepth(state, depth());
    const next = pushCommand(state, command);
    if (next === state) return;
    state = next;
    changed();
  };

  grid.addEventListener("cellschange", (event) => {
    const { changes, source } = (event as CustomEvent).detail as {
      changes: { rowKey: string; columnId: string; oldValue: never; value: never }[];
      source: ChangeSource;
    };
    if (source === "undo" || source === "redo") return;
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

  grid.addEventListener("rowschange", (event) => {
    const { type, rows, source } = (event as CustomEvent).detail as {
      type: "add" | "remove";
      rows: RowRef<Row>[];
      source: ChangeSource;
    };
    if (source === "undo" || source === "redo") return;
    record({ kind: type === "add" ? "rows-add" : "rows-remove", rows });
  });

  /** Applies a command through the grid. `false` when a listener cancelled it. */
  const apply = (command: HistoryCommand<Row>, source: "undo" | "redo"): boolean => {
    if (command.kind !== "cells") {
      // Only a grid with `editable-rows` records these, so its chunk is loaded by now.
      void import("./rows.js").then((m) =>
        m.applyRows(grid, command.kind === "rows-add" ? "add" : "remove", command.rows, source),
      );
      return true;
    }
    return !grid.changeCells(
      command.changes.map((change) => ({
        rowKey: change.rowId,
        columnId: change.columnId,
        value: change.after,
      })),
      { source },
    ).cancelled;
  };

  const move = (direction: "undo" | "redo"): boolean => {
    if (!enabled()) return false;
    const step = direction === "undo" ? undoCommand(state) : redoCommand(state);
    if (!step || !apply(step.apply, direction)) return false;
    state = step.state;
    changed();
    const cells = commandSize(step.apply);
    announce(
      grid,
      (direction === "undo" ? grid.labels.undone : grid.labels.redone)?.(cells) ??
        `${direction === "undo" ? "Undid" : "Redid"} ${cells} ${cells === 1 ? "cell" : "cells"}`,
    );
    return true;
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
