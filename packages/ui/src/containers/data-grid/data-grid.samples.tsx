// Sample data and a simulated server for the feature stories of DataGrid.
import {
  BARBEROS,
  CLIENTES,
  citas10k,
  inventario,
  makeVentas,
  type Producto,
  productoColumns,
  SEDES,
  SERVICIOS,
  seeded,
  type Venta,
  ventaColumns,
} from "./data-grid.fixtures.js";
import type { DataSource } from "./data-source.js";
import { filterRows, sortRows } from "./model.js";
import type { DataGridColumn } from "./types.js";

// ---- column types ---------------------------------------------------------------------------

export interface ServicioCatalogo {
  id: string;
  nombre: string;
  categoria: string;
  duracion: number;
  precio: number;
  activo: boolean;
  creado: Date;
  estado: "Disponible" | "Pausado" | "Descontinuado";
  popularidad: number;
}

export const catalogo: ServicioCatalogo[] = SERVICIOS.map((servicio, index) => {
  const random = seeded(500 + index);
  return {
    id: `S-${String(index + 1).padStart(2, "0")}`,
    nombre: servicio.name,
    categoria: index % 3 === 0 ? "Cabello" : index % 3 === 1 ? "Barba" : "Combo",
    duracion: servicio.minutes,
    precio: servicio.price,
    activo: index !== 4,
    creado: new Date(2025, index, 4 + index),
    estado: index === 4 ? "Pausado" : index === 6 ? "Descontinuado" : "Disponible",
    popularidad: Math.round(35 + random() * 65),
  };
});

export const catalogoColumns: DataGridColumn<ServicioCatalogo>[] = [
  { id: "id", header: "Código", accessor: "id", type: "text", width: 96 },
  { id: "nombre", header: "Servicio", accessor: "nombre", type: "text", width: 200 },
  {
    id: "duracion",
    header: "Duración",
    accessor: "duracion",
    type: "number",
    width: 112,
    format: (v) => (typeof v === "number" ? `${v} min` : ""),
  },
  {
    id: "precio",
    header: "Precio",
    accessor: "precio",
    type: "currency",
    width: 112,
    aggregate: "avg",
  },
  { id: "creado", header: "Creado", accessor: "creado", type: "date", width: 130 },
  { id: "activo", header: "Activo", accessor: "activo", type: "boolean", width: 104 },
  {
    id: "estado",
    header: "Estado",
    accessor: "estado",
    type: "status",
    width: 148,
    statusTones: { Disponible: "success", Pausado: "warning", Descontinuado: "neutral" },
  },
  {
    id: "popularidad",
    header: "Popularidad",
    accessor: "popularidad",
    type: "number",
    width: 168,
    align: "start",
    cell: ({ value }) => {
      const percent = typeof value === "number" ? value : 0;
      return (
        <span className="flex items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-pill bg-surface-2">
            <span
              className="block h-full rounded-pill bg-accent"
              style={{ width: `${percent}%` }}
            />
          </span>
          <span className="w-8 text-right text-fs-120 text-ink-2 tabular-nums">{percent}%</span>
        </span>
      );
    },
  },
];

// ---- validation -----------------------------------------------------------------------------

export const inventarioConErrores: Producto[] = inventario.map((producto, index) =>
  index === 2
    ? { ...producto, stock: -3 }
    : index === 5
      ? { ...producto, precio: producto.costo - 2 }
      : producto,
);

export const productoValidatedColumns: DataGridColumn<Producto>[] = productoColumns.map(
  (column) => {
    switch (column.id) {
      case "producto":
        return {
          ...column,
          validate: (value) => {
            const text = String(value ?? "").trim();
            if (text === "") return "El nombre es obligatorio.";
            return text.length > 32 ? "Máximo 32 caracteres." : null;
          },
        };
      case "stock":
        return {
          ...column,
          validate: (value) => {
            if (typeof value !== "number") return "Ingresa un número.";
            if (!Number.isInteger(value)) return "El stock debe ser un número entero.";
            if (value < 0) return "El stock no puede ser negativo.";
            return value > 500 ? "El almacén admite hasta 500 unidades." : null;
          },
        };
      case "costo":
        return {
          ...column,
          validate: (value) =>
            typeof value === "number" && value <= 0 ? "El costo debe ser mayor que S/ 0." : null,
        };
      case "precio":
        return {
          ...column,
          validate: (value, row) =>
            typeof value === "number" && value < row.costo
              ? `El precio no puede ser menor al costo (S/ ${row.costo}).`
              : null,
        };
      default:
        return column;
    }
  },
);

// ---- column groups --------------------------------------------------------------------------

export const ventas240 = makeVentas(240);

const groupOf: Record<string, string | string[]> = {
  fecha: "Atención",
  cliente: "Atención",
  barbero: "Atención",
  servicio: ["Cobro", "Servicio"],
  metodo: ["Cobro", "Pago"],
  total: ["Cobro", "Pago"],
  propina: ["Cobro", "Pago"],
};

export const ventaGroupedColumns: DataGridColumn<Venta>[] = ventaColumns.map((column) => ({
  ...column,
  group: groupOf[column.id],
}));

/** Sales columns with the set filter on the text-like ones. */
export const ventaSetColumns: DataGridColumn<Venta>[] = ventaColumns.map((column) =>
  ["cliente", "barbero", "servicio", "metodo"].includes(column.id)
    ? { ...column, filter: "set" }
    : column,
);

// ---- row reorder ----------------------------------------------------------------------------

export interface Turno {
  id: string;
  cliente: string;
  servicio: string;
  barbero: string;
  minutos: number;
}

export const turnos: Turno[] = CLIENTES.slice(0, 9).map((cliente, index) => {
  const servicio = SERVICIOS[index % SERVICIOS.length] ?? SERVICIOS[0];
  return {
    id: `T-${index + 1}`,
    cliente,
    servicio: servicio?.name ?? "",
    barbero: BARBEROS[index % BARBEROS.length] ?? "",
    minutos: servicio?.minutes ?? 30,
  };
});

export const turnoColumns: DataGridColumn<Turno>[] = [
  { id: "cliente", header: "Cliente", accessor: "cliente", width: 200, sortable: false },
  { id: "servicio", header: "Servicio", accessor: "servicio", width: 180, sortable: false },
  { id: "barbero", header: "Barbero", accessor: "barbero", width: 120, sortable: false },
  {
    id: "minutos",
    header: "Duración",
    accessor: "minutos",
    type: "number",
    width: 112,
    sortable: false,
    format: (v) => (typeof v === "number" ? `${v} min` : ""),
  },
];

// ---- tree data ------------------------------------------------------------------------------

export interface NodoVentas {
  id: string;
  parentId: string | null;
  nombre: string;
  tipo: "Sede" | "Barbero" | "Servicio";
  citas: number | null;
  ventas: number | null;
}

export const arbolVentas: NodoVentas[] = (() => {
  const nodes: NodoVentas[] = [];
  const random = seeded(77);
  SEDES.slice(0, 3).forEach((sede, s) => {
    const sedeId = `sede-${s}`;
    nodes.push({
      id: sedeId,
      parentId: null,
      nombre: sede,
      tipo: "Sede",
      citas: null,
      ventas: null,
    });
    BARBEROS.slice(s, s + 3).forEach((barbero, b) => {
      const barberoId = `${sedeId}-b${b}`;
      nodes.push({
        id: barberoId,
        parentId: sedeId,
        nombre: barbero,
        tipo: "Barbero",
        citas: null,
        ventas: null,
      });
      SERVICIOS.slice(b, b + 3).forEach((servicio, v) => {
        const citas = 8 + Math.floor(random() * 30);
        nodes.push({
          id: `${barberoId}-s${v}`,
          parentId: barberoId,
          nombre: servicio.name,
          tipo: "Servicio",
          citas,
          ventas: citas * servicio.price,
        });
      });
    });
  });
  return nodes;
})();

export const arbolColumns: DataGridColumn<NodoVentas>[] = [
  {
    id: "nombre",
    header: "Sede / barbero / servicio",
    accessor: "nombre",
    width: 280,
    filter: "text",
  },
  { id: "tipo", header: "Nivel", accessor: "tipo", width: 120, filter: "select" },
  { id: "citas", header: "Citas", accessor: "citas", type: "number", width: 110, aggregate: "sum" },
  {
    id: "ventas",
    header: "Ventas",
    accessor: "ventas",
    type: "currency",
    width: 140,
    aggregate: "sum",
  },
];

// ---- master / detail ------------------------------------------------------------------------

export interface ClienteResumen {
  id: string;
  cliente: string;
  telefono: string;
  nivel: "Nuevo" | "Frecuente" | "VIP";
  visitas: number;
  gastado: number;
  ultima: Date;
}

export interface Visita {
  id: string;
  fecha: Date;
  servicio: string;
  barbero: string;
  total: number;
}

export const visitasPorCliente = new Map<string, Visita[]>();

export const clientesResumen: ClienteResumen[] = CLIENTES.slice(0, 12).map((cliente, index) => {
  const random = seeded(900 + index);
  const count = 2 + Math.floor(random() * 6);
  const visitas: Visita[] = Array.from({ length: count }, (_, visit) => {
    const servicio = SERVICIOS[Math.floor(random() * SERVICIOS.length)] ?? SERVICIOS[0];
    return {
      id: `C${index}-${visit}`,
      fecha: new Date(2026, 9 - Math.floor(visit / 2), 28 - visit * 3),
      servicio: servicio?.name ?? "",
      barbero: BARBEROS[Math.floor(random() * BARBEROS.length)] ?? "",
      total: servicio?.price ?? 0,
    };
  });
  const id = `CL-${String(index + 1).padStart(3, "0")}`;
  visitasPorCliente.set(id, visitas);
  return {
    id,
    cliente,
    telefono: `9${String(Math.floor(random() * 1e8)).padStart(8, "0")}`,
    nivel: count > 5 ? "VIP" : count > 3 ? "Frecuente" : "Nuevo",
    visitas: count,
    gastado: visitas.reduce((sum, visita) => sum + visita.total, 0),
    ultima: visitas[0]?.fecha ?? new Date(2026, 9, 1),
  };
});

export const clienteColumns: DataGridColumn<ClienteResumen>[] = [
  { id: "cliente", header: "Cliente", accessor: "cliente", width: 200 },
  { id: "telefono", header: "Teléfono", accessor: "telefono", width: 128 },
  {
    id: "nivel",
    header: "Nivel",
    accessor: "nivel",
    type: "status",
    width: 128,
    statusTones: { Nuevo: "neutral", Frecuente: "accent", VIP: "success" },
  },
  {
    id: "visitas",
    header: "Visitas",
    accessor: "visitas",
    type: "number",
    width: 100,
    aggregate: "sum",
  },
  {
    id: "gastado",
    header: "Gastado",
    accessor: "gastado",
    type: "currency",
    width: 124,
    aggregate: "sum",
  },
  { id: "ultima", header: "Última visita", accessor: "ultima", type: "date", width: 140 },
];

export const visitaColumns: DataGridColumn<Visita>[] = [
  { id: "fecha", header: "Fecha", accessor: "fecha", type: "date", width: 130 },
  { id: "servicio", header: "Servicio", accessor: "servicio", width: 190 },
  { id: "barbero", header: "Barbero", accessor: "barbero", width: 120 },
  {
    id: "total",
    header: "Total",
    accessor: "total",
    type: "currency",
    width: 110,
    aggregate: "sum",
  },
];

// ---- simulated server -----------------------------------------------------------------------

export interface ServerLogEntry {
  id: number;
  startRow: number;
  endRow: number;
  sort: string;
  filters: string;
  search: string;
}

/**
 * A data source that answers from `rows` after a delay, applying the request's sort, filters and
 * search with the same pure model the grid uses locally. `fail()` returns true while errors are
 * being simulated.
 */
export function createFakeServer<T>(
  rows: readonly T[],
  columns: readonly DataGridColumn<T>[],
  options: {
    latency?: number;
    blockSize?: number;
    onRequest?: (entry: ServerLogEntry) => void;
    fail?: () => boolean;
  } = {},
): DataSource<T> {
  const { latency = 500, blockSize, onRequest, fail } = options;
  let counter = 0;
  return {
    blockSize,
    getRows(request, { signal }) {
      counter += 1;
      const id = counter;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          onRequest?.({
            id,
            startRow: request.startRow,
            endRow: request.endRow,
            sort: request.sort.map((rule) => `${rule.id} ${rule.direction}`).join(", ") || "—",
            filters: Object.keys(request.filters).join(", ") || "—",
            search: request.search || "—",
          });
          if (fail?.()) {
            reject(new Error("offline"));
            return;
          }
          const sorted = sortRows(
            filterRows(rows, columns, request.filters, request.search),
            columns,
            request.sort,
          );
          resolve({ rows: sorted.slice(request.startRow, request.endRow), total: sorted.length });
        }, latency);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    },
  };
}

export const citas5k = citas10k.slice(0, 5000);
