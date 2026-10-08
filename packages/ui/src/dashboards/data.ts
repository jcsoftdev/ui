/** Deterministic pseudo-random generator so every render shows the same sample data. */
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
  "Martín Gutiérrez",
  "Óscar Delgado",
];
