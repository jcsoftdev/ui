// Stateful demos behind the feature stories of DataGrid.
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { formatCurrency } from "../../charts/core/format.js";
import { citaColumns, inventario, type Venta, ventaColumns, ventas } from "./data-grid.fixtures.js";
import { type CellChange, DataGrid, type DataGridProps, type ExportPayload } from "./data-grid.js";
import {
  arbolColumns,
  arbolVentas,
  citas5k,
  clienteColumns,
  clientesResumen,
  createFakeServer,
  inventarioConErrores,
  productoValidatedColumns,
  type ServerLogEntry,
  turnoColumns,
  turnos,
  visitaColumns,
  visitasPorCliente,
} from "./data-grid.samples.js";
import { describeFilter, emptyGroup, type FilterGroup } from "./filter-builder.js";
import { FilterBuilder } from "./filter-builder-editor.js";
import { DEFAULT_DATA_GRID_LABELS } from "./labels.js";
import { distinctValues } from "./model.js";
import type { PinnedRows } from "./rows.js";
import type { Filters, SortRule } from "./types.js";

export type DemoControls = Pick<
  DataGridProps<Venta>,
  "density" | "selectable" | "loading" | "hideToolbar" | "height"
>;

const note = "text-fs-120 text-ink-3";

function Stack({ children }: { children: ReactNode }) {
  return <div className="grid gap-2">{children}</div>;
}

export function ValidationDemo({ density, height }: DemoControls) {
  const [rows, setRows] = useState(inventarioConErrores);
  const [last, setLast] = useState<CellChange<(typeof rows)[number]> | null>(null);
  return (
    <Stack>
      <DataGrid
        density={density}
        height={height}
        aria-label="Inventario con validación"
        data={rows}
        columns={productoValidatedColumns}
        getRowId={(row) => row.sku}
        defaultPinned={{ left: ["sku"] }}
        onCellChange={(change) => {
          setLast(change);
          setRows((previous) =>
            previous.map((row) =>
              row.sku === change.rowId ? { ...row, [change.columnId]: change.value } : row,
            ),
          );
        }}
      />
      <p className={note} aria-live="polite">
        {last
          ? `Guardado: ${last.rowId} · ${last.columnId} → ${String(last.value)}`
          : "Las celdas en rojo ya son inválidas. Edita Stock o Precio con un valor no permitido y pulsa Enter: el editor se queda abierto con el mensaje; Escape cancela."}
      </p>
    </Stack>
  );
}

export function RowPinningDemo({ density, height }: DemoControls) {
  const [pinned, setPinned] = useState<PinnedRows>({ top: ["V-1003"], bottom: ["V-1010"] });
  return (
    <Stack>
      <DataGrid
        density={density}
        height={height}
        aria-label="Ventas con filas fijas"
        data={ventas}
        columns={ventaColumns}
        getRowId={(row) => row.id}
        rowPinning
        pinnedRows={pinned}
        onPinnedRowsChange={setPinned}
        defaultPinned={{ left: ["id"] }}
      />
      <p className={note}>
        Arriba: {pinned.top.join(", ") || "—"} · Abajo: {pinned.bottom.join(", ") || "—"}. Usa los
        botones de la primera columna o Alt + Mayús + Flecha arriba / abajo sobre una fila.
      </p>
    </Stack>
  );
}

export function RowReorderDemo({ density }: DemoControls) {
  const [rows, setRows] = useState(turnos);
  return (
    <Stack>
      <DataGrid
        density={density}
        height={420}
        aria-label="Cola de turnos"
        data={rows}
        columns={turnoColumns}
        getRowId={(row) => row.id}
        rowReorder
        hideToolbar
        onRowReorder={({ order }) =>
          setRows((previous) =>
            order.map((id) => previous.find((row) => row.id === id)).filter((row) => !!row),
          )
        }
      />
      <p className={note} aria-live="polite">
        Orden de atención: {rows.map((row) => row.cliente.split(" ")[0]).join(" → ")}. Arrastra el
        asa o usa Alt + Flecha arriba / abajo.
      </p>
    </Stack>
  );
}

export function ExpansionDemo({ density, height }: DemoControls) {
  return (
    <DataGrid
      density={density}
      height={height}
      aria-label="Ventas con detalle"
      data={ventas}
      columns={ventaColumns}
      getRowId={(row) => row.id}
      defaultPinned={{ left: ["id"] }}
      detailHeight={116}
      defaultExpandedRowIds={["V-1002"]}
      renderDetail={(row) => (
        <dl className="grid gap-x-6 gap-y-2 text-fs-130 @sm/grid:grid-cols-3">
          {(
            [
              ["Cliente", row.cliente],
              ["Barbero", row.barbero],
              ["Servicio", row.servicio],
              ["Método de pago", row.metodo],
              ["Total", formatCurrency(row.total)],
              ["Propina", row.propina ? formatCurrency(row.propina) : "Sin propina"],
            ] as const
          ).map(([term, value]) => (
            <div key={term} className="min-w-0">
              <dt className="text-fs-110 text-ink-3 uppercase tracking-[.07em]">{term}</dt>
              <dd className="truncate font-[600] text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    />
  );
}

function readJson<V>(key: string, fallback: V): V {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as V) : fallback;
  } catch {
    return fallback;
  }
}

function usePersisted<V>(key: string, fallback: V): [V, (next: V) => void] {
  const [value, setValue] = useState<V>(() =>
    typeof window === "undefined" ? fallback : readJson(key, fallback),
  );
  const set = useCallback(
    (next: V) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage can be blocked; the state then lasts for the session only.
      }
    },
    [key],
  );
  return [value, set];
}

const PERSIST_PREFIX = "storybook:data-grid:estado";

export function PersistenceDemo({ density, height }: DemoControls) {
  const [generation, setGeneration] = useState(0);
  return (
    <PersistenceGrid
      key={generation}
      density={density}
      height={height}
      onReset={() => setGeneration(generation + 1)}
    />
  );
}

function PersistenceGrid({ density, height, onReset }: DemoControls & { onReset: () => void }) {
  const [sort, setSort] = usePersisted<SortRule[]>(`${PERSIST_PREFIX}:sort`, [
    { id: "total", direction: "desc" },
  ]);
  const [filters, setFilters] = usePersisted<Filters>(`${PERSIST_PREFIX}:filters`, {});
  const [groupBy, setGroupBy] = usePersisted<string[]>(`${PERSIST_PREFIX}:group`, []);
  const reset = () => {
    try {
      for (const key of ["sort", "filters", "group"]) {
        window.localStorage.removeItem(`${PERSIST_PREFIX}:${key}`);
      }
      window.localStorage.removeItem(`${PERSIST_PREFIX}:layout`);
    } catch {
      // Nothing stored.
    }
    onReset();
  };
  return (
    <Stack>
      <DataGrid
        density={density}
        height={height}
        aria-label="Ventas con estado guardado"
        data={ventas}
        columns={ventaColumns}
        getRowId={(row) => row.id}
        storageKey={`${PERSIST_PREFIX}:layout`}
        sort={sort}
        onSortChange={setSort}
        filters={filters}
        onFiltersChange={setFilters}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        toolbarActions={
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-control-sm items-center rounded-control border-divider bg-surface-control px-2.5 font-[600] text-fs-120 text-ink-2 hover:border-line-strong hover:text-ink"
          >
            Restablecer todo
          </button>
        }
      />
      <p className={note}>
        Orden, filtros y agrupación se guardan en localStorage; el ancho, orden, visibilidad y
        fijado de columnas con <code>storageKey</code>. Cambia algo y recarga la página.
      </p>
    </Stack>
  );
}

const SHORTCUTS: [string, string][] = [
  ["Flechas", "Mover entre celdas"],
  ["Inicio / Fin", "Primera / última celda de la fila (con Ctrl: de la tabla)"],
  ["Re Pág / Av Pág", "Saltar una página de filas"],
  ["Enter / Espacio en encabezado", "Ordenar (con Mayús: orden adicional)"],
  ["Alt + Flecha abajo en encabezado", "Abrir opciones de la columna"],
  ["Mayús + Flechas en encabezado", "Cambiar el ancho de la columna"],
  ["Ctrl + Mayús + Flechas en encabezado", "Mover la columna"],
  ["Espacio", "Seleccionar la fila (con Mayús: rango)"],
  ["Enter / F2", "Editar la celda"],
  ["Alt + Flecha derecha / izquierda", "Expandir / contraer la fila"],
  ["Alt + Flecha arriba / abajo", "Reordenar la fila"],
  ["Alt + Mayús + Flecha arriba / abajo", "Fijar la fila arriba / abajo"],
  ["Mayús + Flechas", "Ampliar el rango de celdas"],
  ["Ctrl + C", "Copiar el rango como TSV"],
];

export function KeyboardDemo({ density }: DemoControls) {
  const [where, setWhere] = useState("Ninguna");
  const [rows, setRows] = useState(inventario);
  return (
    <div className="grid gap-3 @container/demo">
      <div
        onFocusCapture={(event) => {
          const cell = (event.target as HTMLElement).closest<HTMLElement>("[data-r]");
          if (cell) setWhere(`fila ${cell.dataset.r}, columna ${Number(cell.dataset.c) + 1}`);
        }}
      >
        <DataGrid
          density={density}
          height={320}
          aria-label="Inventario con atajos"
          data={rows}
          columns={productoValidatedColumns}
          getRowId={(row) => row.sku}
          selectable
          rowPinning
          rowReorder
          rangeSelection
          defaultPinned={{ left: ["producto"] }}
          detailHeight={72}
          renderDetail={(row) => (
            <p className="text-fs-130 text-ink-2">
              {row.producto}: {row.stock} en {row.ubicacion}, proveedor {row.proveedor}.
            </p>
          )}
          onRowReorder={({ order }) =>
            setRows((previous) =>
              order.map((id) => previous.find((row) => row.sku === id)).filter((row) => !!row),
            )
          }
          onCellChange={(change) =>
            setRows((previous) =>
              previous.map((row) =>
                row.sku === change.rowId ? { ...row, [change.columnId]: change.value } : row,
              ),
            )
          }
        />
      </div>
      <p className="text-fs-130 text-ink" aria-live="polite">
        Celda activa: <b className="font-[650]">{where}</b>
      </p>
      <table className="w-full border-collapse text-left text-fs-120">
        <caption className="sr-only">Atajos de teclado</caption>
        <tbody>
          {SHORTCUTS.map(([keys, action]) => (
            <tr key={keys} className="border-t-divider">
              <th scope="row" className="w-1/2 py-1.5 pr-3 font-[600] text-ink">
                <kbd className="font-mono text-fs-120">{keys}</kbd>
              </th>
              <td className="py-1.5 text-ink-2">{action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TreeDemo({ density, height }: DemoControls) {
  return (
    <DataGrid
      density={density}
      height={height}
      aria-label="Ventas por sede, barbero y servicio"
      data={arbolVentas}
      columns={arbolColumns}
      getRowId={(row) => row.id}
      tree={{ getParentId: (row) => row.parentId }}
      defaultExpandedRowIds={["sede-0", "sede-0-b0"]}
      exportFilename="ventas-por-sede.csv"
    />
  );
}

function RequestLog({ entries, label }: { entries: ServerLogEntry[]; label: string }) {
  return (
    <div className="rounded-card border-card shadow-card p-2 text-fs-120 text-ink-2">
      <p className="font-[650] text-ink">
        {label}: {entries.length}
      </p>
      <ol className="mt-1 grid max-h-24 gap-0.5 overflow-auto font-mono">
        {entries
          .slice(-6)
          .reverse()
          .map((entry) => (
            <li key={entry.id}>
              #{entry.id} filas {entry.startRow}–{entry.endRow} · orden {entry.sort} · filtros{" "}
              {entry.filters} · búsqueda {entry.search}
            </li>
          ))}
      </ol>
    </div>
  );
}

export function RemotePaginationDemo({ density, height }: DemoControls) {
  const [log, setLog] = useState<ServerLogEntry[]>([]);
  const [offline, setOffline] = useState(false);
  const offlineRef = useRef(false);
  offlineRef.current = offline;
  const source = useMemo(
    () =>
      createFakeServer(citas5k, citaColumns, {
        latency: 650,
        onRequest: (entry) => setLog((previous) => [...previous, entry]),
        fail: () => offlineRef.current,
      }),
    [],
  );
  return (
    <Stack>
      <DataGrid
        density={density}
        height={height}
        aria-label="Citas (paginación en el servidor)"
        columns={citaColumns}
        getRowId={(row) => row.id}
        dataSource={source}
        pageSize={20}
        defaultPinned={{ left: ["id"] }}
      />
      <label className="flex items-center gap-2 text-fs-130 text-ink">
        <input
          type="checkbox"
          className="size-4 accent-accent"
          checked={offline}
          onChange={(event) => setOffline(event.target.checked)}
        />
        Simular servidor caído (las páginas nuevas fallan y se pueden reintentar)
      </label>
      <RequestLog entries={log} label="Solicitudes al servidor simulado (650 ms)" />
    </Stack>
  );
}

export function InfiniteScrollDemo({ density, height }: DemoControls) {
  const [log, setLog] = useState<ServerLogEntry[]>([]);
  const [offline, setOffline] = useState(false);
  const offlineRef = useRef(false);
  offlineRef.current = offline;
  const source = useMemo(
    () =>
      createFakeServer(citas5k, citaColumns, {
        latency: 500,
        blockSize: 40,
        onRequest: (entry) => setLog((previous) => [...previous, entry]),
        fail: () => offlineRef.current,
      }),
    [],
  );
  return (
    <Stack>
      <DataGrid
        density={density}
        height={height}
        aria-label="Citas (desplazamiento infinito)"
        columns={citaColumns}
        getRowId={(row) => row.id}
        dataSource={source}
        maxBlocks={12}
        defaultPinned={{ left: ["id"] }}
      />
      <label className="flex items-center gap-2 text-fs-130 text-ink">
        <input
          type="checkbox"
          className="size-4 accent-accent"
          checked={offline}
          onChange={(event) => setOffline(event.target.checked)}
        />
        Simular servidor caído (los bloques nuevos fallan y se pueden reintentar)
      </label>
      <RequestLog entries={log} label="Bloques pedidos (40 filas, máximo 12 en memoria)" />
    </Stack>
  );
}

const INITIAL_FILTER: FilterGroup = {
  type: "group",
  id: "root",
  logic: "and",
  children: [
    { type: "condition", id: "c-estado", columnId: "estado", operator: "equals", value: "Pagado" },
    {
      type: "group",
      id: "g-or",
      logic: "or",
      children: [
        {
          type: "condition",
          id: "c-barbero",
          columnId: "barbero",
          operator: "equals",
          value: "Ana",
        },
        { type: "condition", id: "c-total", columnId: "total", operator: "gte", value: "50" },
      ],
    },
  ],
};

export function FilterBuilderDemo({ density, height }: DemoControls) {
  const [filter, setFilter] = useState<FilterGroup>(INITIAL_FILTER);
  const words = {
    and: DEFAULT_DATA_GRID_LABELS.filterAnd,
    or: DEFAULT_DATA_GRID_LABELS.filterOr,
    operators: DEFAULT_DATA_GRID_LABELS.operators,
  };
  const text = describeFilter(filter, ventaColumns, words);
  return (
    <Stack>
      <div className="rounded-card border-card shadow-card p-3">
        <FilterBuilder
          columns={ventaColumns}
          value={filter}
          onChange={setFilter}
          valuesOf={(id) => {
            const column = ventaColumns.find((c) => c.id === id);
            return column ? distinctValues(ventas, column) : [];
          }}
        />
        <p className="mt-3 border-t-divider pt-2 text-fs-120 text-ink-3">
          {text ? `Filtro: ${text}` : "Sin filtro activo."}{" "}
          <button
            type="button"
            className="font-[600] text-accent-ink underline"
            onClick={() => setFilter(emptyGroup("and", "root"))}
          >
            Limpiar
          </button>
        </p>
      </div>
      <DataGrid
        density={density}
        height={height}
        aria-label="Ventas filtradas"
        data={ventas}
        columns={ventaColumns}
        getRowId={(row) => row.id}
        advancedFilter={filter}
        onAdvancedFilterChange={setFilter}
        defaultPinned={{ left: ["id"] }}
      />
    </Stack>
  );
}

export function MasterDetailDemo({ density, height }: DemoControls) {
  return (
    <DataGrid
      density={density}
      height={height}
      aria-label="Clientes con historial"
      data={clientesResumen}
      columns={clienteColumns}
      getRowId={(row) => row.id}
      detailHeight={252}
      defaultExpandedRowIds={["CL-002"]}
      exportFilename="clientes.csv"
      renderDetail={(row) => (
        <DataGrid
          aria-label={`Visitas de ${row.cliente}`}
          data={visitasPorCliente.get(row.id) ?? []}
          columns={visitaColumns}
          getRowId={(visit) => visit.id}
          height={196}
          hideToolbar
        />
      )}
    />
  );
}

export function ExportDemo({ density, height }: DemoControls) {
  const [last, setLast] = useState<ExportPayload | null>(null);
  return (
    <Stack>
      <DataGrid
        density={density}
        height={height}
        aria-label="Ventas para exportar"
        data={ventas}
        columns={ventaColumns}
        getRowId={(row) => row.id}
        selectable
        exportFilename="ventas-octubre.csv"
        onExport={setLast}
        defaultPinned={{ left: ["id"] }}
      />
      <div
        className="rounded-card border-card shadow-card p-2 text-fs-120 text-ink-2"
        aria-live="polite"
      >
        {last ? (
          <>
            <p className="font-[650] text-ink">
              {last.filename}: {last.rowCount} filas, {last.csv.length} caracteres
            </p>
            <pre className="mt-1 max-h-28 overflow-auto font-mono">
              {last.csv.replace("﻿", "").split("\r\n").slice(0, 5).join("\n")}
            </pre>
          </>
        ) : (
          "Exportar CSV usa las filas filtradas y ordenadas y las columnas visibles. Con filas seleccionadas el botón exporta solo la selección."
        )}
      </div>
    </Stack>
  );
}
