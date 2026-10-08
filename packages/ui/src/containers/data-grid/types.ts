import type { ReactNode } from "react";
import type { ChipTone } from "../../atoms/chip/chip.js";
import type { PinSide } from "../table/pin.js";

export type { PinSide };

export type CellValue = string | number | boolean | Date | null | undefined;

export type ColumnType = "text" | "number" | "currency" | "date" | "status" | "boolean";
export type ColumnAlign = "start" | "center" | "end";
export type AggregateKind = "sum" | "avg" | "count" | "min" | "max";
/** `set` is `select` with a searchable checkbox list and a select-all control. */
export type FilterKind = "text" | "range" | "dateRange" | "select" | "set";
export type EditorKind = "text" | "number" | "select";
export type SortDirection = "asc" | "desc";
export type Density = "compact" | "normal" | "comfortable";

export interface SortRule {
  id: string;
  direction: SortDirection;
}

/** One filter per column. Empty values (blank query, open range, no values) match everything. */
export type FilterValue =
  | { kind: "text"; query: string }
  | { kind: "range"; min?: number | null; max?: number | null }
  /** ISO dates (`yyyy-mm-dd`), both ends inclusive. */
  | { kind: "dateRange"; from?: string | null; to?: string | null }
  | { kind: "select"; values: readonly string[] };

export type Filters = Readonly<Record<string, FilterValue>>;

export interface CellContext<T> {
  row: T;
  rowId: string;
  value: CellValue;
  /** The value as text, with the column's formatter applied. */
  formatted: string;
}

export interface DataGridColumn<T> {
  id: string;
  header: string;
  /** Property name or function that reads the cell value from a row. */
  accessor: keyof T | ((row: T) => CellValue);
  /** Custom cell content; the formatted text is used otherwise. */
  cell?: (context: CellContext<T>) => ReactNode;
  /** Drives formatting, alignment, the default filter and the default editor. `text` by default. */
  type?: ColumnType;
  /** Text shown for a value (cells, filters, group rows, CSV keeps raw numbers). */
  format?: (value: CellValue) => string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  /**
   * Weight of the leftover width this column takes when the grid is wider than its columns.
   * Text columns default to `1`, the rest to `0` (fixed); a user-resized column never grows.
   */
  grow?: number;
  align?: ColumnAlign;
  sortable?: boolean;
  filterable?: boolean;
  /** Overrides the filter picked from `type`. */
  filter?: FilterKind;
  pinnable?: boolean;
  hideable?: boolean;
  resizable?: boolean;
  reorderable?: boolean;
  groupable?: boolean;
  /** Shown in group rows and in the footer totals. */
  aggregate?: AggregateKind;
  /** Chip tone per status value (`status` columns). */
  statusTones?: Readonly<Record<string, ChipTone>>;
  editable?: boolean | ((row: T) => boolean);
  /** Editor kind; `number` for numeric types, `select` when `options` exist, `text` otherwise. */
  editor?: EditorKind;
  /** Values offered by the `select` editor. */
  options?: readonly string[];
  /**
   * Returns an error message when `value` is not acceptable, nothing otherwise. A failing edit stays
   * open with the message instead of being committed; already invalid cells are flagged.
   */
  validate?: (value: CellValue, row: T) => string | null | undefined;
  /** Header group path from the outermost level down; adjacent columns sharing it share a header. */
  group?: string | readonly string[];
}

export interface GroupDisplayRow {
  kind: "group";
  key: string;
  depth: number;
  columnId: string;
  label: string;
  count: number;
  collapsed: boolean;
  aggregates: Record<string, number | null>;
}

/** Tree metadata of a data row (`tree` mode). */
export interface TreeInfo {
  hasChildren: boolean;
  expanded: boolean;
  /** Aggregates over all descendant leaves; only for rows with children. */
  aggregates: Record<string, number | null>;
}

export interface DataDisplayRow<T> {
  kind: "data";
  key: string;
  depth: number;
  row: T;
  tree?: TreeInfo;
}

/** Detail panel shown under an expanded data row (master / detail). */
export interface DetailDisplayRow<T> {
  kind: "detail";
  key: string;
  depth: number;
  row: T;
  rowKey: string;
  height: number;
}

/** A row of a remote data source whose block is not loaded yet. */
export interface PlaceholderDisplayRow {
  kind: "placeholder";
  key: string;
  index: number;
}

export type DisplayRow<T> =
  | GroupDisplayRow
  | DataDisplayRow<T>
  | DetailDisplayRow<T>
  | PlaceholderDisplayRow;

/** Column layout the user can change; it is what `storageKey` persists. */
export interface GridLayout {
  order: string[];
  hidden: string[];
  widths: Record<string, number>;
  pinned: { left: string[]; right: string[] };
  density?: Density;
}
