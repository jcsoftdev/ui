// Deterministic sample data for the landing demos (a barbershop in Lima). Spanish on purpose.

export function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export const BARBEROS = [
  "Diego Quispe",
  "Ana Torres",
  "Marco Rojas",
  "Rosa Salazar",
  "Julio Paredes",
];

export const SERVICIOS = [
  { id: "corte", name: "Corte clásico", price: 35 },
  { id: "fade", name: "Fade degradado", price: 40 },
  { id: "combo", name: "Corte + barba", price: 55 },
  { id: "barba", name: "Perfilado de barba", price: 25 },
  { id: "navaja", name: "Afeitado con navaja", price: 30 },
  { id: "tinte", name: "Tinte de barba", price: 45 },
] as const;

export const CLIENTES = [
  "Álvaro Quispe",
  "Bruno Mendoza",
  "César Huamán",
  "Eduardo Flores",
  "Fernando Torres",
  "Gonzalo Vargas",
  "Héctor Chávez",
  "Iván Castillo",
  "Jorge Ramírez",
  "Luis Paredes",
];

export const PEN = { style: "currency", currency: "PEN", maximumFractionDigits: 0 } as const;

const random = seeded(2026);

/** Thirty days of revenue ending on 8 October 2026; Fridays and Saturdays are the busy ones. */
export const ingresos = Array.from({ length: 30 }, (_, index) => {
  const fecha = new Date(2026, 8, 9 + index);
  const finDeSemana = fecha.getDay() === 5 || fecha.getDay() === 6;
  const base = finDeSemana ? 1450 : 980;
  return { fecha, ingresos: Math.round(base + index * 9 + random() * 380) };
});

export const meta = ingresos.map((item) => Math.round(item.ingresos * 0.9));

export const serviciosIngreso = [
  { id: "corte", name: "Corte clásico", value: 9800 },
  { id: "combo", name: "Corte + barba", value: 8450 },
  { id: "fade", name: "Fade degradado", value: 6200 },
  { id: "barba", name: "Perfilado de barba", value: 3100 },
  { id: "navaja", name: "Afeitado con navaja", value: 2400 },
];

export const ventasSemana = [
  980, 1120, 1045, 1230, 1580, 2140, 690, 1010, 1185, 1260, 1210, 1690, 2290,
];
export const ticketSemana = [41, 43, 42, 44, 45, 44, 46, 47, 46, 48, 47, 49];
export const nuevosSemana = [8, 11, 9, 14, 12, 16, 15, 19, 17, 21, 20, 24];

export const kpis = [
  { id: "citas", label: "Citas atendidas", value: 214, trend: 4.1, trendLabel: "vs. septiembre" },
  {
    id: "ticket",
    label: "Ticket promedio",
    value: 47,
    format: PEN,
    trend: 6.8,
    trendLabel: "vs. septiembre",
  },
  {
    id: "ocupacion",
    label: "Ocupación",
    value: 0.78,
    format: { style: "percent" } as const,
    trend: -2.4,
    trendLabel: "vs. septiembre",
  },
  {
    id: "cancelaciones",
    label: "Cancelaciones",
    value: 9,
    trend: -18,
    invertTrend: true,
    trendLabel: "vs. septiembre",
  },
];
