// Stateful demos behind the spreadsheet stories of DataGrid: history, formulas, XLSX and charts.
import { type ReactNode, useCallback, useState } from "react";
import { type Venta, ventaColumns, ventas } from "./data-grid.fixtures.js";
import { type CellChange, DataGrid, type DataGridProps, type RowsChange } from "./data-grid.js";
import type { HistorySummary } from "./history.js";
import type { DataGridColumn } from "./types.js";

export type SheetControls = Pick<DataGridProps<Venta>, "density" | "height">;

export const note = "text-[12.5px] text-ink-3";

export function Stack({ children }: { children: ReactNode }) {
  return <div className="grid gap-2">{children}</div>;
}

/** Applies grid changes to a row list: what a parent that owns the data does. */
export function applyCellChanges<T extends object>(
  rows: readonly T[],
  changes: readonly CellChange<T>[],
  idOf: (row: T) => string,
): T[] {
  const byRow = new Map<string, Record<string, unknown>>();
  for (const change of changes) {
    byRow.set(change.rowId, { ...byRow.get(change.rowId), [change.columnId]: change.value });
  }
  return rows.map((row) => {
    const patch = byRow.get(idOf(row));
    return patch ? { ...row, ...patch } : row;
  });
}

export function applyRowsChange<T extends object>(
  rows: readonly T[],
  change: RowsChange<T>,
  idOf: (row: T) => string,
): T[] {
  if (change.type === "remove") {
    const gone = new Set(change.rows.map((entry) => entry.rowId));
    return rows.filter((row) => !gone.has(idOf(row)));
  }
  const next = [...rows];
  for (const entry of change.rows) next.splice(entry.index, 0, entry.row);
  return next;
}

export const editableVentaColumns: DataGridColumn<Venta>[] = ventaColumns.map((column) =>
  ["cliente", "total", "propina", "metodo"].includes(column.id)
    ? { ...column, editable: true }
    : column,
);

let created = 0;
export function newVenta(): Venta {
  created += 1;
  return {
    id: `V-N${String(created).padStart(3, "0")}`,
    fecha: new Date(2026, 9, 8, 12),
    cliente: "Cliente nuevo",
    barbero: "Luis",
    servicio: "Corte clásico",
    metodo: "Efectivo",
    total: 35,
    propina: 0,
    estado: "Pendiente",
  };
}

export function UndoRedoDemo({ density, height }: SheetControls) {
  const [rows, setRows] = useState<Venta[]>(() => ventas.slice(0, 24));
  const [summary, setSummary] = useState<HistorySummary | null>(null);
  const [last, setLast] = useState("");
  const idOf = useCallback((row: Venta) => row.id, []);
  return (
    <Stack>
      <DataGrid
        density={density}
        height={height}
        aria-label="Ventas con historial de cambios"
        data={rows}
        columns={editableVentaColumns}
        getRowId={idOf}
        selectable
        rangeSelection
        history
        historyDepth={50}
        createRow={newVenta}
        defaultPinned={{ left: ["id"] }}
        onHistoryChange={setSummary}
        onCellChange={(change) => {
          setLast(
            `${change.source}: ${change.columnId} ${String(change.previous)} → ${String(change.value)}`,
          );
          setRows((previous) => applyCellChanges(previous, [change], idOf));
        }}
        onCellsChange={(changes) => {
          setLast(`${changes[0]?.source}: ${changes.length} celdas`);
          setRows((previous) => applyCellChanges(previous, changes, idOf));
        }}
        onRowsChange={(change) => {
          setLast(
            `${change.source}: ${change.type === "add" ? "agregó" : "quitó"} ${change.rows.length} fila(s)`,
          );
          setRows((previous) => applyRowsChange(previous, change, idOf));
        }}
      />
      <p className={note} aria-live="polite">
        {summary
          ? `Historial: ${summary.undoCount} para deshacer, ${summary.redoCount} para rehacer. Último: ${last || "—"}`
          : "Edita Cliente, Total, Propina o Método (doble clic o Enter), pega con Ctrl + V, rellena con Ctrl + D o Ctrl + R, agrega o elimina filas. Ctrl + Z deshace; Mayús + Ctrl + Z o Ctrl + Y rehace."}
      </p>
    </Stack>
  );
}
