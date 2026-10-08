import type { Meta, StoryObj } from "@storybook/react-vite";
import { PictogramChart } from "./pictogram-chart.js";

const visitsBySegment = [
  { id: "nuevos", name: "Clientes nuevos", value: 18 },
  { id: "frecuentes", name: "Frecuentes", value: 42 },
  { id: "vip", name: "Membresía VIP", value: 11 },
];

const servicesSold = [
  { id: "cortes", name: "Cortes", value: 186, icon: "scissors" as const },
  { id: "barbas", name: "Barbas", value: 97, icon: "person" as const },
  { id: "productos", name: "Productos", value: 64, icon: "bottle" as const },
];

/** A comb drawn as a custom path: any SVG path works ("bring your own shape"). */
const comb = {
  path: "M3 4h18a1 1 0 0 1 1 1v4H2V5a1 1 0 0 1 1-1zM3 10h1.6v10H3zM6.2 10h1.6v10H6.2zM9.4 10h1.6v10H9.4zM12.6 10h1.6v10h-1.6zM15.8 10h1.6v10h-1.6zM19 10h1.6v10H19z",
};

const spanishLabels = {
  empty: "Sin datos para mostrar",
  loading: "Cargando gráfico",
  resetZoom: "Ver todo",
  total: "Total",
  explore: "Categorías del gráfico. Usa las flechas para recorrerlas.",
  brush: "Rango visible",
  category: "Segmento",
};

const meta = {
  title: "Charts/PictogramChart",
  component: PictogramChart,
  tags: ["autodocs"],
  args: {
    title: "Clientes atendidos hoy",
    data: visitsBySegment,
    perUnit: 1,
    icon: "person",
    layout: "grid",
    unitSize: 28,
    gap: 0.25,
    height: 200,
    unitLabel: "clientes",
    valueFormat: "integer",
    legend: true,
    tooltip: true,
    animate: true,
    loading: false,
    labels: spanishLabels,
  },
  argTypes: {
    icon: {
      control: "select",
      options: ["person", "scissors", "chair", "star", "calendar", "bottle"],
    },
    layout: { control: "inline-radio", options: ["grid", "rows"] },
    legend: { control: "select", options: [true, false, "top", "bottom"] },
    perUnit: { control: { type: "number", min: 0.5, step: 0.5 } },
    unitSize: { control: { type: "range", min: 12, max: 56, step: 1 } },
    gap: { control: { type: "range", min: 0, max: 0.8, step: 0.05 } },
    height: { control: { type: "range", min: 120, max: 420, step: 10 } },
    data: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PictogramChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PartialUnits: Story = {
  name: "Partial units (1 icon = 5)",
  args: {
    title: "Servicios vendidos en la semana",
    data: servicesSold.map(({ icon: _icon, ...item }) => item),
    perUnit: 5,
    icon: "scissors",
    unitLabel: "servicios",
    labels: { ...spanishLabels, category: "Servicio" },
  },
};

export const Rows: Story = {
  name: "Rows layout, icon per category",
  args: {
    title: "Ventas por tipo (1 ícono = 10)",
    data: servicesSold,
    perUnit: 10,
    layout: "rows",
    unitLabel: "ventas",
    height: 150,
  },
};

export const Capacity: Story = {
  name: "Capacity (empty units)",
  args: {
    title: "Sillas ocupadas el sábado",
    data: [
      { id: "reservas", name: "Con reserva", value: 9 },
      { id: "sin-cita", name: "Sin cita", value: 4 },
    ],
    total: 16,
    icon: "chair",
    unitSize: 40,
    unitLabel: "sillas",
    height: 110,
  },
};

export const CustomShape: Story = {
  name: "Custom SVG shape",
  args: {
    title: "Peines vendidos por sede",
    data: [
      { id: "miraflores", name: "Miraflores", value: 23 },
      { id: "surco", name: "Surco", value: 15 },
    ],
    icon: comb,
    unitLabel: "peines",
    labels: { ...spanishLabels, category: "Sede" },
  },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { data: [] } };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
  args: { title: "Servicios vendidos", data: servicesSold, perUnit: 10, unitLabel: "ventas" },
};
