import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { type CellChange, DataGrid, type DataGridProps } from "./data-grid.js";
import type { DataGridColumn } from "./types.js";

// ---- sample data (deterministic) ------------------------------------------------------------

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const CLIENTES = [
  "Álvaro Quispe",
  "Bruno Mendoza",
  "César Huamán",
  "Diego Rojas",
  "Eduardo Flores",
  "Fernando Torres",
  "Gonzalo Vargas",
  "Héctor Chávez",
  "Iván Castillo",
  "Jorge Ramírez",
  "Kevin Salazar",
  "Luis Paredes",
  "Martín Gutiérrez",
  "Nicolás Silva",
  "Óscar Delgado",
  "Pablo Navarro",
  "Renato Cárdenas",
  "Sebastián Ríos",
];
const BARBEROS = ["Luis", "Ana", "Marco", "Rosa", "Julio"];
const SERVICIOS: { name: string; price: number; minutes: number }[] = [
  { name: "Corte clásico", price: 35, minutes: 30 },
  { name: "Corte + barba", price: 55, minutes: 50 },
  { name: "Perfilado de barba", price: 25, minutes: 20 },
  { name: "Fade degradado", price: 40, minutes: 40 },
  { name: "Afeitado con navaja", price: 30, minutes: 30 },
  { name: "Corte niño", price: 25, minutes: 25 },
  { name: "Tinte de barba", price: 45, minutes: 35 },
];
const METODOS = ["Efectivo", "Yape", "Plin", "Tarjeta"];
const SEDES = ["Miraflores", "San Isidro", "Surco", "Barranco"];

export interface Venta {
  id: string;
  fecha: Date;
  cliente: string;
  barbero: string;
  servicio: string;
  metodo: string;
  total: number;
  propina: number;
  estado: "Pagado" | "Pendiente" | "Anulado";
}

function makeVentas(count: number): Venta[] {
  const random = seeded(7);
  return Array.from({ length: count }, (_, index) => {
    const servicio = SERVICIOS[Math.floor(random() * SERVICIOS.length)] ?? SERVICIOS[0];
    const roll = random();
    return {
      id: `V-${String(1001 + index)}`,
      fecha: new Date(2026, 9, 1 + Math.floor(random() * 8), 9 + Math.floor(random() * 11)),
      cliente: CLIENTES[Math.floor(random() * CLIENTES.length)] ?? "",
      barbero: BARBEROS[Math.floor(random() * BARBEROS.length)] ?? "",
      servicio: servicio?.name ?? "",
      metodo: METODOS[Math.floor(random() * METODOS.length)] ?? "",
      total: servicio?.price ?? 0,
      propina: random() > 0.6 ? Math.round(random() * 10) : 0,
      estado: roll > 0.9 ? "Anulado" : roll > 0.75 ? "Pendiente" : "Pagado",
    };
  });
}

const ventas = makeVentas(64);

const ventaColumns: DataGridColumn<Venta>[] = [
  { id: "id", header: "N.º", accessor: "id", width: 92, hideable: false },
  { id: "fecha", header: "Fecha", accessor: "fecha", type: "date", width: 120 },
  { id: "cliente", header: "Cliente", accessor: "cliente", width: 180 },
  {
    id: "barbero",
    header: "Barbero",
    accessor: "barbero",
    width: 120,
    groupable: true,
    filter: "select",
  },
  {
    id: "servicio",
    header: "Servicio",
    accessor: "servicio",
    width: 180,
    groupable: true,
    filter: "select",
  },
  {
    id: "metodo",
    header: "Método",
    accessor: "metodo",
    width: 116,
    groupable: true,
    filter: "select",
  },
  {
    id: "total",
    header: "Total",
    accessor: "total",
    type: "currency",
    aggregate: "sum",
    width: 116,
  },
  {
    id: "propina",
    header: "Propina",
    accessor: "propina",
    type: "currency",
    aggregate: "avg",
    width: 112,
  },
  {
    id: "estado",
    header: "Estado",
    accessor: "estado",
    type: "status",
    width: 124,
    groupable: true,
    statusTones: { Pagado: "success", Pendiente: "warning", Anulado: "danger" },
  },
];

export interface Producto {
  sku: string;
  producto: string;
  categoria: string;
  marca: string;
  proveedor: string;
  stock: number;
  minimo: number;
  costo: number;
  precio: number;
  ubicacion: string;
  actualizado: Date;
}

const PRODUCTOS: [string, string, string][] = [
  ["Pomada mate Hombre Fuerte", "Styling", "Hombre Fuerte"],
  ["Cera brillo clásica", "Styling", "Old Lima"],
  ["Aceite para barba sándalo", "Barba", "Barba Andina"],
  ["Bálsamo para barba", "Barba", "Barba Andina"],
  ["Shampoo para barba", "Barba", "Old Lima"],
  ["Navajas desechables (caja)", "Insumos", "Filo Pro"],
  ["Talco mentolado", "Insumos", "Filo Pro"],
  ["Loción after shave", "Afeitado", "Hombre Fuerte"],
  ["Gel de afeitar transparente", "Afeitado", "Filo Pro"],
  ["Capas de corte", "Insumos", "Taller Norte"],
  ["Spray fijador", "Styling", "Old Lima"],
  ["Tinte de barba castaño", "Color", "Barba Andina"],
];

const inventario: Producto[] = PRODUCTOS.map(([producto, categoria, marca], index) => {
  const random = seeded(31 + index);
  const costo = Math.round(8 + random() * 30);
  return {
    sku: `${categoria.slice(0, 3).toUpperCase()}-${String(index + 1).padStart(3, "0")}`,
    producto,
    categoria,
    marca,
    proveedor:
      index % 3 === 0
        ? "Distribuidora Lima"
        : index % 3 === 1
          ? "Importadora Sur"
          : "Bazar Central",
    stock: Math.floor(random() * 40),
    minimo: 6,
    costo,
    precio: Math.round(costo * (1.6 + random() * 0.6)),
    ubicacion: `Estante ${String.fromCharCode(65 + (index % 4))}${1 + (index % 3)}`,
    actualizado: new Date(2026, 8, 10 + index * 2),
  };
});

const CATEGORIAS = ["Styling", "Barba", "Insumos", "Afeitado", "Color"];

const productoColumns: DataGridColumn<Producto>[] = [
  { id: "sku", header: "SKU", accessor: "sku", width: 104 },
  { id: "producto", header: "Producto", accessor: "producto", width: 220, editable: true },
  {
    id: "categoria",
    header: "Categoría",
    accessor: "categoria",
    width: 130,
    filter: "select",
    groupable: true,
    editable: true,
    options: CATEGORIAS,
  },
  { id: "marca", header: "Marca", accessor: "marca", width: 140, filter: "select" },
  { id: "proveedor", header: "Proveedor", accessor: "proveedor", width: 170 },
  {
    id: "stock",
    header: "Stock",
    accessor: "stock",
    type: "number",
    width: 96,
    aggregate: "sum",
    editable: true,
    cell: ({ row, formatted }) => (
      <span className={row.stock < row.minimo ? "font-[650] text-danger" : undefined}>
        {formatted}
      </span>
    ),
  },
  { id: "minimo", header: "Mínimo", accessor: "minimo", type: "number", width: 96 },
  { id: "costo", header: "Costo", accessor: "costo", type: "currency", width: 110, editable: true },
  {
    id: "precio",
    header: "Precio",
    accessor: "precio",
    type: "currency",
    width: 110,
    editable: true,
    aggregate: "avg",
  },
  {
    id: "valor",
    header: "Valor stock",
    accessor: (row) => row.stock * row.costo,
    type: "currency",
    width: 128,
    aggregate: "sum",
  },
  { id: "ubicacion", header: "Ubicación", accessor: "ubicacion", width: 120 },
  { id: "actualizado", header: "Actualizado", accessor: "actualizado", type: "date", width: 128 },
];

export interface Cita {
  id: string;
  fecha: Date;
  cliente: string;
  telefono: string;
  barbero: string;
  servicio: string;
  duracion: number;
  precio: number;
  sede: string;
  estado: "Confirmada" | "Pendiente" | "Atendida" | "Cancelada" | "No asistió";
}

const ESTADOS_CITA: Cita["estado"][] = [
  "Confirmada",
  "Pendiente",
  "Atendida",
  "Cancelada",
  "No asistió",
];

function makeCitas(count: number): Cita[] {
  const random = seeded(99);
  return Array.from({ length: count }, (_, index) => {
    const servicio = SERVICIOS[Math.floor(random() * SERVICIOS.length)] ?? SERVICIOS[0];
    const day = Math.floor(index / 40);
    return {
      id: `C-${String(index + 1).padStart(5, "0")}`,
      fecha: new Date(2026, 0, 1 + day, 9 + Math.floor(random() * 11), random() > 0.5 ? 30 : 0),
      cliente: CLIENTES[Math.floor(random() * CLIENTES.length)] ?? "",
      telefono: `9${String(Math.floor(random() * 1e8)).padStart(8, "0")}`,
      barbero: BARBEROS[Math.floor(random() * BARBEROS.length)] ?? "",
      servicio: servicio?.name ?? "",
      duracion: servicio?.minutes ?? 30,
      precio: servicio?.price ?? 0,
      sede: SEDES[Math.floor(random() * SEDES.length)] ?? "",
      estado: ESTADOS_CITA[Math.floor(random() * ESTADOS_CITA.length)] ?? "Pendiente",
    };
  });
}

const citas10k = makeCitas(10_000);
const citas240 = citas10k.slice(0, 240);

const timeFormat = new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("es-PE", {
  weekday: "short",
  day: "2-digit",
  month: "short",
});

const citaColumns: DataGridColumn<Cita>[] = [
  { id: "id", header: "Cita", accessor: "id", width: 100 },
  {
    id: "fecha",
    header: "Fecha",
    accessor: "fecha",
    type: "date",
    width: 132,
    format: (value) => (value instanceof Date ? dayFormat.format(value) : ""),
  },
  {
    id: "hora",
    header: "Hora",
    accessor: (row) => timeFormat.format(row.fecha),
    width: 104,
    filterable: false,
  },
  { id: "cliente", header: "Cliente", accessor: "cliente", width: 180 },
  { id: "telefono", header: "Teléfono", accessor: "telefono", width: 120 },
  {
    id: "barbero",
    header: "Barbero",
    accessor: "barbero",
    width: 110,
    filter: "select",
    groupable: true,
  },
  {
    id: "servicio",
    header: "Servicio",
    accessor: "servicio",
    width: 180,
    filter: "select",
    groupable: true,
  },
  {
    id: "duracion",
    header: "Duración",
    accessor: "duracion",
    type: "number",
    width: 112,
    format: (value) => (typeof value === "number" ? `${value} min` : ""),
  },
  {
    id: "precio",
    header: "Precio",
    accessor: "precio",
    type: "currency",
    width: 136,
    aggregate: "sum",
  },
  { id: "sede", header: "Sede", accessor: "sede", width: 120, filter: "select", groupable: true },
  {
    id: "estado",
    header: "Estado",
    accessor: "estado",
    type: "status",
    width: 128,
    groupable: true,
    statusTones: {
      Confirmada: "accent",
      Pendiente: "warning",
      Atendida: "success",
      Cancelada: "neutral",
      "No asistió": "danger",
    },
  },
];

// ---- meta --------------------------------------------------------------------------------

type ControlArgs = Pick<
  DataGridProps<Venta>,
  "density" | "selectable" | "loading" | "hideToolbar" | "height"
>;

function controls(args: ControlArgs): ControlArgs {
  const { density, selectable, loading, hideToolbar, height } = args;
  return { density, selectable, loading, hideToolbar, height };
}

const meta = {
  title: "Containers/DataGrid",
  component: DataGrid<Venta>,
  tags: ["autodocs"],
  args: {
    "aria-label": "Ventas de octubre",
    data: ventas,
    columns: ventaColumns,
    getRowId: (row) => row.id,
    selectable: true,
    loading: false,
    hideToolbar: false,
    height: 440,
    defaultPinned: { left: ["id"] },
  },
  argTypes: {
    data: { control: false },
    columns: { control: false },
    getRowId: { control: false },
    density: { control: "inline-radio", options: ["compact", "normal", "comfortable"] },
    selectable: { control: "boolean" },
    loading: { control: "boolean" },
    hideToolbar: { control: "boolean" },
    height: { control: { type: "number", min: 160, step: 40 } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Tabla de datos con orden múltiple (Mayús + clic), filtros por columna y búsqueda rápida, columnas fijables, redimensionables, reordenables y ocultables (persistidas con `storageKey`), selección de filas, agrupación con agregados, edición en línea, filas virtualizadas o paginación y exportación CSV. Navegación con teclado según el patrón ARIA grid.",
      },
    },
  },
} satisfies Meta<typeof DataGrid<Venta>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SortingFiltering: Story = {
  name: "Sorting / Filtering",
  args: {
    defaultSort: [
      { id: "barbero", direction: "asc" },
      { id: "total", direction: "desc" },
    ],
    defaultFilters: {
      estado: { kind: "select", values: ["Pagado", "Pendiente"] },
      total: { kind: "range", min: 30, max: null },
    },
  },
};

export const Pinning: Story = {
  render: (args) => (
    <DataGrid
      {...controls(args)}
      aria-label="Inventario de productos"
      data={inventario}
      columns={productoColumns}
      getRowId={(row) => row.sku}
      defaultPinned={{ left: ["producto"], right: ["valor"] }}
      storageKey="storybook:data-grid:inventario"
    />
  ),
};

export const Grouping: Story = {
  args: {
    defaultGroupBy: ["barbero"],
    defaultSort: [{ id: "fecha", direction: "desc" }],
  },
};

function EditingDemo(args: ControlArgs) {
  const [rows, setRows] = useState(inventario);
  const [last, setLast] = useState<CellChange<Producto> | null>(null);
  return (
    <div className="grid gap-2">
      <DataGrid
        {...controls(args)}
        aria-label="Inventario editable"
        data={rows}
        columns={productoColumns}
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
      <p className="text-[12.5px] text-ink-3" aria-live="polite">
        {last
          ? `Último cambio: ${last.rowId} · ${last.columnId}: ${String(last.previous)} → ${String(last.value)}`
          : "Doble clic, Enter o F2 para editar Producto, Categoría, Stock, Costo o Precio. Enter guarda, Escape cancela, Tab pasa a la siguiente celda editable."}
      </p>
    </div>
  );
}

export const Editing: Story = {
  args: { selectable: false },
  render: (args) => <EditingDemo {...controls(args)} />,
};

export const Virtualized10k: Story = {
  name: "Virtualized 10k",
  render: (args) => (
    <DataGrid
      {...controls(args)}
      aria-label="Citas del año"
      data={citas10k}
      columns={citaColumns}
      getRowId={(row) => row.id}
      defaultPinned={{ left: ["id"] }}
    />
  ),
};

export const Pagination: Story = {
  render: (args) => (
    <DataGrid
      {...controls(args)}
      aria-label="Citas de enero"
      data={citas240}
      columns={citaColumns}
      getRowId={(row) => row.id}
      pageSize={25}
      defaultPinned={{ left: ["id"] }}
    />
  ),
};

export const Narrow: Story = {
  name: "Narrow (320 px)",
  args: { defaultPinned: { left: ["id"], right: ["total"] } },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export const Dark: Story = {
  globals: { theme: "dark" },
  args: { defaultGroupBy: ["estado"] },
};

export const Loading: Story = {
  args: { loading: true },
};

export const Empty: Story = {
  args: { data: [] },
};
