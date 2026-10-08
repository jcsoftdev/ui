// Stateful demos behind the spreadsheet stories of DataGrid: history, formulas, XLSX and charts.
import { type ReactNode, useCallback, useState } from "react";
import { type Venta, ventaColumns, ventas } from "./data-grid.fixtures.js";
import {
  type CellChange,
  DataGrid,
  type DataGridProps,
  type RowsChange,
  type XlsxExportPayload,
} from "./data-grid.js";
import type { HistorySummary } from "./history.js";
import type { CellValue, DataGridColumn } from "./types.js";

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

// ---- formulas -------------------------------------------------------------------------------

export interface Linea {
  id: string;
  concepto: string;
  cantidad: CellValue;
  precio: CellValue;
  subtotal: CellValue;
  igv: CellValue;
  total: CellValue;
  nota: CellValue;
}

const productos: Array<[string, number, number]> = [
  ["Corte clásico", 40, 35],
  ["Corte + barba", 22, 55],
  ["Perfilado de barba", 18, 25],
  ["Fade degradado", 15, 40],
  ["Afeitado con navaja", 9, 30],
  ["Tinte de barba", 6, 45],
  ["Cera para peinar", 12, 28],
];

export const lineas: Linea[] = [
  ...productos.map(([concepto, cantidad, precio], index) => {
    const row = index + 1;
    return {
      id: `L-${row}`,
      concepto,
      cantidad,
      precio,
      subtotal: `=B${row}*C${row}`,
      igv: `=ROUND(D${row}*0.18,2)`,
      total: `=D${row}+E${row}`,
      nota: `=IF(F${row}>1000,"Alto","Normal")`,
    };
  }),
  {
    id: "L-8",
    concepto: "Totales",
    cantidad: "=SUM(B1:B7)",
    precio: "=AVERAGE(C1:C7)",
    subtotal: "=SUM(D1:D7)",
    igv: "=SUM(E1:E7)",
    total: "=SUM(F1:F7)",
    nota: '=IF(F8>5000,"Meta superada","Bajo la meta")',
  },
];

const editable = { editable: true, resizable: true } as const;
export const lineaColumns: DataGridColumn<Linea>[] = [
  { id: "concepto", header: "Concepto", accessor: "concepto", width: 180, ...editable },
  { id: "cantidad", header: "Cant.", accessor: "cantidad", type: "number", width: 92, ...editable },
  { id: "precio", header: "Precio", accessor: "precio", type: "currency", width: 112, ...editable },
  {
    id: "subtotal",
    header: "Subtotal",
    accessor: "subtotal",
    type: "currency",
    width: 120,
    ...editable,
  },
  { id: "igv", header: "IGV", accessor: "igv", type: "currency", width: 108, ...editable },
  { id: "total", header: "Total", accessor: "total", type: "currency", width: 124, ...editable },
  { id: "nota", header: "Nota", accessor: "nota", width: 140, ...editable },
];

export interface Diagnostico {
  id: string;
  concepto: string;
  valor: CellValue;
  detalle: string;
}

export const diagnosticos: Diagnostico[] = [
  { id: "D-1", concepto: "División por cero", valor: "=1/0", detalle: "#DIV/0!" },
  { id: "D-2", concepto: "Función desconocida", valor: "=PROMEDIO(1,2)", detalle: "#NAME?" },
  { id: "D-3", concepto: "Referencia fuera de rango", valor: "=Z99", detalle: "#REF!" },
  { id: "D-4", concepto: "Texto en una cuenta", valor: '="a"*2', detalle: "#VALUE!" },
  { id: "D-5", concepto: "Ciclo (B6)", valor: "=B6", detalle: "#CYCLE!" },
  { id: "D-6", concepto: "Ciclo (B5)", valor: "=B5", detalle: "#CYCLE!" },
  { id: "D-7", concepto: "Suma con error", valor: "=SUM(B1:B4)", detalle: "El error se propaga" },
];

export const diagnosticoColumns: DataGridColumn<Diagnostico>[] = [
  { id: "concepto", header: "Caso", accessor: "concepto", width: 200, ...editable },
  { id: "valor", header: "Resultado", accessor: "valor", width: 150, ...editable },
  { id: "detalle", header: "Esperado", accessor: "detalle", width: 170, ...editable },
];

export function FormulasDemo<T extends { id: string }>({
  rows: initial,
  columns,
  label,
  density,
  height,
  hint,
}: SheetControls & {
  rows: readonly T[];
  columns: readonly DataGridColumn<T>[];
  label: string;
  hint: string;
}) {
  const [rows, setRows] = useState<T[]>([...initial]);
  const idOf = useCallback((row: T) => row.id, []);
  const apply = useCallback(
    (changes: readonly CellChange<T>[]) =>
      setRows((previous) => applyCellChanges(previous, changes, idOf)),
    [idOf],
  );
  return (
    <Stack>
      <DataGrid
        density={density}
        height={height}
        aria-label={label}
        data={rows}
        columns={columns}
        getRowId={idOf}
        formulas
        history
        hideToolbar={false}
        onCellChange={(change) => apply([change])}
        onCellsChange={apply}
      />
      <p className={note}>{hint}</p>
    </Stack>
  );
}

// ---- XLSX export ----------------------------------------------------------------------------

export function ExportXlsxDemo({ density, height }: SheetControls) {
  const [last, setLast] = useState<XlsxExportPayload | null>(null);
  return (
    <Stack>
      <DataGrid
        density={density}
        height={height}
        aria-label="Ventas para exportar a Excel"
        data={ventas}
        columns={ventaColumns}
        getRowId={(row) => row.id}
        selectable
        exportFilename={false}
        exportXlsx="ventas-octubre.xlsx"
        onExportXlsx={setLast}
        defaultPinned={{ left: ["id"] }}
      />
      <p className={note} aria-live="polite">
        {last
          ? `${last.filename}: ${last.rowCount} filas, ${last.bytes.length} bytes, firma ${String.fromCharCode(last.bytes[0] ?? 0, last.bytes[1] ?? 0)} (ZIP).`
          : "Exportar XLSX usa las filas filtradas y ordenadas y las columnas visibles; con filas seleccionadas exporta solo la selección. Números como números, fechas como fechas."}
      </p>
    </Stack>
  );
}
