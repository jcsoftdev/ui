import type { Meta, StoryObj } from "@storybook/react-vite";
import { DumbbellChart } from "./dumbbell-chart.js";

const citas = [
  { label: "Corte clásico", from: 182, to: 214 },
  { label: "Degradado", from: 140, to: 171 },
  { label: "Barba", from: 96, to: 88 },
  { label: "Corte + barba", from: 74, to: 112 },
  { label: "Tinte", from: 31, to: 29 },
  { label: "Limpieza facial", from: 22, to: 35 },
  { label: "Corte infantil", from: 58, to: 63 },
];

const spanishLabels = {
  empty: "Sin datos para este periodo",
  loading: "Cargando gráfico",
  resetZoom: "Ver todo",
  total: "Total",
  explore: "Servicios. Usa las flechas arriba y abajo para recorrerlos.",
  brush: "Rango visible",
  category: "Servicio",
};

const meta = {
  title: "Charts/DumbbellChart",
  component: DumbbellChart,
  tags: ["autodocs"],
  args: {
    title: "Citas por servicio: mes pasado contra este mes",
    items: citas,
    fromLabel: "Mes pasado",
    toLabel: "Este mes",
    valueFormat: "integer",
    sort: "none",
    rowHeight: 38,
    delta: "absolute",
    valueLabels: true,
    lowerIsBetter: false,
    grid: true,
    legend: true,
    tooltip: true,
    loading: false,
    animate: true,
    deltaLabel: "Cambio",
    labels: spanishLabels,
  },
  argTypes: {
    sort: { control: "inline-radio", options: ["none", "delta", "abs-delta", "to"] },
    delta: { control: "inline-radio", options: ["absolute", "percent", false] },
    valueFormat: { control: "select", options: ["number", "integer", "currency", "compact"] },
    items: { control: false },
    rowHeight: { control: { type: "range", min: 28, max: 64, step: 2 } },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DumbbellChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const RankedByChange: Story = { args: { sort: "delta", delta: "percent" } };

export const Revenue: Story = {
  args: {
    title: "Ingresos por barbero",
    items: [
      { label: "Mateo", from: 4200, to: 4880 },
      { label: "Valeria", from: 5100, to: 4650 },
      { label: "Diego", from: 3300, to: 3920 },
      { label: "Camila", from: 2800, to: 2790 },
    ],
    valueFormat: "currency",
    fromLabel: "Septiembre",
    toLabel: "Octubre",
  },
};

export const LowerIsBetter: Story = {
  args: {
    title: "Cancelaciones por barbero",
    items: [
      { label: "Mateo", from: 14, to: 9 },
      { label: "Valeria", from: 6, to: 11 },
      { label: "Diego", from: 10, to: 10 },
      { label: "Camila", from: 8, to: 5 },
    ],
    lowerIsBetter: true,
    sort: "abs-delta",
  },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { items: [] } };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};
