import type { DataGridColumn } from "./types.js";

// ---- sample data (deterministic) ------------------------------------------------------------

export function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export const CLIENTES = [
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
export const BARBEROS = ["Luis", "Ana", "Marco", "Rosa", "Julio"];
export const SERVICIOS: { name: string; price: number; minutes: number }[] = [
  { name: "Corte clásico", price: 35, minutes: 30 },
  { name: "Corte + barba", price: 55, minutes: 50 },
  { name: "Perfilado de barba", price: 25, minutes: 20 },
  { name: "Fade degradado", price: 40, minutes: 40 },
  { name: "Afeitado con navaja", price: 30, minutes: 30 },
  { name: "Corte niño", price: 25, minutes: 25 },
  { name: "Tinte de barba", price: 45, minutes: 35 },
];
export const METODOS = ["Efectivo", "Yape", "Plin", "Tarjeta"];
export const SEDES = ["Miraflores", "San Isidro", "Surco", "Barranco"];

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

export function makeVentas(count: number): Venta[] {
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

export const ventas = makeVentas(64);

export const ventaColumns: DataGridColumn<Venta>[] = [
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

export const PRODUCTOS: [string, string, string][] = [
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

export const inventario: Producto[] = PRODUCTOS.map(([producto, categoria, marca], index) => {
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

export const CATEGORIAS = ["Styling", "Barba", "Insumos", "Afeitado", "Color"];

export const productoColumns: DataGridColumn<Producto>[] = [
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

export const ESTADOS_CITA: Cita["estado"][] = [
  "Confirmada",
  "Pendiente",
  "Atendida",
  "Cancelada",
  "No asistió",
];

export function makeCitas(count: number): Cita[] {
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

export const citas10k = makeCitas(10_000);
export const citas240 = citas10k.slice(0, 240);

export const timeFormat = new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit" });
export const dayFormat = new Intl.DateTimeFormat("es-PE", {
  weekday: "short",
  day: "2-digit",
  month: "short",
});

export const citaColumns: DataGridColumn<Cita>[] = [
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
