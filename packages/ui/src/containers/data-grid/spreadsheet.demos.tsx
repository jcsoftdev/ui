// Stateful demos behind the spreadsheet stories of DataGrid: history, formulas, XLSX and charts.
import { type ReactNode, useCallback, useState } from "react";
import { BARBEROS, seeded, type Venta, ventaColumns, ventas } from "./data-grid.fixtures.js";
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

// ---- integrated charts ----------------------------------------------------------------------

const MESES = ["ene", "feb", "mar", "abr", "may", "jun"] as const;

export interface Ingreso {
  id: string;
  barbero: string;
  ene: number;
  feb: number;
  mar: number;
  abr: number;
  may: number;
  jun: number;
}

const randomIngreso = seeded(11);
export const ingresos: Ingreso[] = BARBEROS.map((barbero, index) => {
  const base = 1100 + index * 140;
  const [ene, feb, mar, abr, may, jun] = MESES.map((_, month) =>
    Math.round(base + month * (40 + index * 15) + (randomIngreso() - 0.5) * 360),
  ) as [number, number, number, number, number, number];
  return { id: `B-${index + 1}`, barbero, ene, feb, mar, abr, may, jun };
});

const mes = (id: (typeof MESES)[number], header: string): DataGridColumn<Ingreso> => ({
  id,
  header,
  accessor: id,
  type: "currency",
  width: 104,
  aggregate: "sum",
});

export const ingresoColumns: DataGridColumn<Ingreso>[] = [
  { id: "barbero", header: "Barbero", accessor: "barbero", width: 140 },
  mes("ene", "Ene"),
  mes("feb", "Feb"),
  mes("mar", "Mar"),
  mes("abr", "Abr"),
  mes("may", "May"),
  mes("jun", "Jun"),
  {
    id: "tendencia",
    header: "Tendencia",
    accessor: "jun",
    type: "sparkline",
    width: 160,
    filterable: false,
    sparkline: {
      values: (row) => MESES.map((month) => row[month]),
      kind: "area",
      label: (row) => `Ingresos de ${row.barbero} de enero a junio`,
    },
  },
];

export function ChartsDemo({ density, height }: SheetControls) {
  return (
    <Stack>
      <DataGrid
        density={density}
        height={height}
        aria-label="Ingresos por barbero y mes"
        data={ingresos}
        columns={ingresoColumns}
        getRowId={(row) => row.id}
        charts
        showFooter
      />
      <p className={note}>
        Arrastra sobre las celdas (por ejemplo Barbero hasta Jun) o usa Mayús + flechas y pulsa
        Graficar: la columna de texto da las categorías y cada columna numérica es una serie.
      </p>
    </Stack>
  );
}

export function SparklineDemo({ density, height }: SheetControls) {
  return (
    <DataGrid
      density={density}
      height={height}
      aria-label="Ingresos con minigráficos"
      data={ingresos}
      columns={ingresoColumns}
      getRowId={(row) => row.id}
    />
  );
}

// ---- fill handle -----------------------------------------------------------------------------

export interface Reserva {
  id: string;
  silla: CellValue;
  turno: CellValue;
  dia: CellValue;
  precio: CellValue;
  doble: CellValue;
}

const reservaSeeds: Array<Omit<Reserva, "id" | "doble">> = [
  { silla: "Silla 1", turno: 10, dia: new Date(2026, 9, 1, 12), precio: 25 },
  { silla: null, turno: 20, dia: new Date(2026, 10, 1, 12), precio: 25 },
  { silla: null, turno: 30, dia: new Date(2026, 11, 1, 12), precio: 30 },
];

export const reservas: Reserva[] = Array.from({ length: 14 }, (_unused, index) => {
  const seed = reservaSeeds[index];
  const row = index + 1;
  return {
    id: `R-${row}`,
    silla: seed?.silla ?? null,
    turno: seed?.turno ?? null,
    dia: seed?.dia ?? null,
    precio: seed?.precio ?? null,
    doble: index === 0 ? `=D${row}*2` : null,
  };
});

export const reservaColumns: DataGridColumn<Reserva>[] = [
  { id: "silla", header: "Silla", accessor: "silla", width: 130, ...editable },
  { id: "turno", header: "Turno", accessor: "turno", type: "number", width: 96, ...editable },
  { id: "dia", header: "Día", accessor: "dia", type: "date", width: 130, ...editable },
  { id: "precio", header: "Precio", accessor: "precio", type: "currency", width: 112, ...editable },
  { id: "doble", header: "Doble", accessor: "doble", type: "currency", width: 112, ...editable },
];

/** Range selection with the fill handle: series, dates, text with a number and formulas. */
export function FillHandleDemo({ density, height }: SheetControls) {
  const [rows, setRows] = useState<Reserva[]>(reservas);
  const [last, setLast] = useState("");
  const idOf = useCallback((row: Reserva) => row.id, []);
  const apply = useCallback(
    (changes: readonly CellChange<Reserva>[]) => {
      setRows((previous) => applyCellChanges(previous, changes, idOf));
      const sources = new Set(changes.map((change) => change.source));
      setLast(
        `${changes.length} ${changes.length === 1 ? "cambio" : "cambios"} (${[...sources].join(", ")})`,
      );
    },
    [idOf],
  );
  return (
    <Stack>
      <DataGrid
        density={density}
        height={height}
        aria-label="Reservas por silla"
        data={rows}
        columns={reservaColumns}
        getRowId={idOf}
        formulas
        history
        rangeSelection
        hideToolbar={false}
        onCellChange={(change) => apply([change])}
        onCellsChange={apply}
      />
      <p className={note}>
        Selecciona celdas con datos y arrastra el cuadro del borde inferior derecho hacia abajo o a
        la derecha: 10, 20 sigue 30, 40; «Silla 1» sigue «Silla 2»; las fechas mensuales siguen mes
        a mes y las fórmulas ajustan sus referencias. Ctrl al soltar solo copia. Una sola operación
        en el historial: Ctrl + Z la deshace.
      </p>
      <p className={note} aria-live="polite">
        Último relleno: {last || "ninguno"}
      </p>
    </Stack>
  );
}

// ---- fill up and left, auto-scroll -------------------------------------------------------------

const reservasBackwards: Reserva[] = Array.from({ length: 40 }, (_unused, index) => {
  const row = index + 1;
  const seed = index === 30 ? reservaSeeds[0] : index === 31 ? reservaSeeds[1] : undefined;
  const last = index === 32 ? reservaSeeds[2] : undefined;
  const filled = seed ?? last;
  return {
    id: `R-${row}`,
    silla: index === 32 ? "Silla 3" : null,
    turno: filled?.turno ?? null,
    dia: filled?.dia ?? null,
    precio: filled?.precio ?? null,
    doble: null,
  };
});

const DATE_STEPS = ["auto", "day", "month"] as const;

/**
 * Fill handle going up and left on a tall grid: the data sits at the bottom, so dragging up has to
 * scroll. Dates can be forced to count days or months with the `fillSeries.dateStep` option.
 */
export function FillBackwardsDemo({ density, height }: SheetControls) {
  const [rows, setRows] = useState<Reserva[]>(reservasBackwards);
  const [dateStep, setDateStep] = useState<(typeof DATE_STEPS)[number]>("auto");
  const idOf = useCallback((row: Reserva) => row.id, []);
  const apply = useCallback(
    (changes: readonly CellChange<Reserva>[]) =>
      setRows((previous) => applyCellChanges(previous, changes, idOf)),
    [idOf],
  );
  return (
    <Stack>
      <label className={note}>
        Paso de fechas{" "}
        <select
          value={dateStep}
          onChange={(event) => setDateStep(event.target.value as (typeof DATE_STEPS)[number])}
        >
          {DATE_STEPS.map((step) => (
            <option key={step} value={step}>
              {step}
            </option>
          ))}
        </select>
      </label>
      <DataGrid
        density={density}
        height={height}
        aria-label="Reservas por silla, relleno hacia arriba"
        data={rows}
        columns={reservaColumns}
        getRowId={idOf}
        history
        rangeSelection
        fillSeries={{ dateStep }}
        hideToolbar={false}
        onCellChange={(change) => apply([change])}
        onCellsChange={apply}
      />
      <p className={note}>
        Los datos están al final. Selecciona «Turno» (10, 20) o «Silla 3» y arrastra el cuadro del
        borde inferior derecho hacia arriba o a la izquierda: la serie retrocede (0, -10; «Silla 2»)
        y la tabla se desplaza sola cuando el puntero se acerca al borde. Suelta o pulsa Escape para
        parar.
      </p>
    </Stack>
  );
}
