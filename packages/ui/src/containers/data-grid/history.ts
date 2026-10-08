// Undo / redo command stack for grid edits. Pure and immutable: the grid keeps the state in a ref.
import type { CellValue } from "./types.js";

/** What produced a change; also tells a controlled parent that a change is an undo or a redo. */
export type ChangeSource = "edit" | "paste" | "fill" | "undo" | "redo";

export interface CellDelta {
  rowId: string;
  columnId: string;
  before: CellValue;
  after: CellValue;
}

export interface RowRef<R> {
  row: R;
  rowId: string;
  /** Position of the row in the source data when it was added or removed. */
  index: number;
}

export type HistoryCommand<R = unknown> =
  | { kind: "cells"; source: "edit" | "paste" | "fill"; changes: readonly CellDelta[] }
  | { kind: "rows-add"; rows: readonly RowRef<R>[] }
  | { kind: "rows-remove"; rows: readonly RowRef<R>[] };

export interface HistoryState<R = unknown> {
  past: readonly HistoryCommand<R>[];
  future: readonly HistoryCommand<R>[];
  depth: number;
}

export const DEFAULT_HISTORY_DEPTH = 100;

export function createHistory<R = unknown>(depth = DEFAULT_HISTORY_DEPTH): HistoryState<R> {
  return { past: [], future: [], depth: Math.max(1, Math.floor(depth)) };
}

export function canUndo(state: HistoryState<unknown>): boolean {
  return state.past.length > 0;
}

export function canRedo(state: HistoryState<unknown>): boolean {
  return state.future.length > 0;
}

/** A command that changes nothing is not worth an undo step. */
export function isNoop<R>(command: HistoryCommand<R>): boolean {
  if (command.kind === "cells") {
    return command.changes.every((change) => Object.is(change.before, change.after));
  }
  return command.rows.length === 0;
}

/** Records a command; the redo branch is dropped and the oldest commands past `depth` fall off. */
export function pushCommand<R>(
  state: HistoryState<R>,
  command: HistoryCommand<R>,
): HistoryState<R> {
  if (isNoop(command)) return state;
  const past = [...state.past, command];
  return { ...state, past: past.slice(Math.max(0, past.length - state.depth)), future: [] };
}

/** The command that cancels `command`. */
export function invertCommand<R>(command: HistoryCommand<R>): HistoryCommand<R> {
  if (command.kind === "cells") {
    return {
      ...command,
      changes: command.changes.map((change) => ({
        ...change,
        before: change.after,
        after: change.before,
      })),
    };
  }
  return command.kind === "rows-add"
    ? { kind: "rows-remove", rows: command.rows }
    : { kind: "rows-add", rows: command.rows };
}

export interface HistoryStep<R> {
  state: HistoryState<R>;
  /** What the caller has to apply: the inverse for an undo, the original for a redo. */
  apply: HistoryCommand<R>;
}

/** Moves the last command to the redo branch; null when there is nothing to undo. */
export function undoCommand<R>(state: HistoryState<R>): HistoryStep<R> | null {
  const command = state.past[state.past.length - 1];
  if (!command) return null;
  return {
    state: { ...state, past: state.past.slice(0, -1), future: [...state.future, command] },
    apply: invertCommand(command),
  };
}

/** Moves the last undone command back to the past; null when there is nothing to redo. */
export function redoCommand<R>(state: HistoryState<R>): HistoryStep<R> | null {
  const command = state.future[state.future.length - 1];
  if (!command) return null;
  return {
    state: { ...state, past: [...state.past, command], future: state.future.slice(0, -1) },
    apply: command,
  };
}

/** Shrinks (or grows) the depth, trimming the oldest commands. */
export function setHistoryDepth<R>(state: HistoryState<R>, depth: number): HistoryState<R> {
  const next = Math.max(1, Math.floor(depth));
  if (next === state.depth) return state;
  return {
    depth: next,
    past: state.past.slice(Math.max(0, state.past.length - next)),
    future: state.future.slice(Math.max(0, state.future.length - next)),
  };
}

export interface HistorySummary {
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
}

export function summarizeHistory(state: HistoryState<unknown>): HistorySummary {
  return {
    canUndo: canUndo(state),
    canRedo: canRedo(state),
    undoCount: state.past.length,
    redoCount: state.future.length,
  };
}

/** Number of cells or rows a command touches (for announcements). */
export function commandSize<R>(command: HistoryCommand<R>): number {
  return command.kind === "cells" ? command.changes.length : command.rows.length;
}
