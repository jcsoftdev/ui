import type { Meta, StoryObj } from "@storybook/react-vite";
import { WaffleChart } from "./waffle-chart.js";

const paymentMethods = [
  { id: "yape", name: "Yape", value: 412 },
  { id: "efectivo", name: "Efectivo", value: 268 },
  { id: "tarjeta", name: "Tarjeta", value: 187 },
  { id: "plin", name: "Plin", value: 96 },
];

const spanishLabels = {
  empty: "Sin datos para mostrar",
  loading: "Cargando gráfico",
  resetZoom: "Ver todo",
  total: "Total",
  explore: "Categorías del gráfico. Usa las flechas para recorrerlas.",
  brush: "Rango visible",
  category: "Medio de pago",
};

const meta = {
  title: "Charts/WaffleChart",
  component: WaffleChart,
  tags: ["autodocs"],
  args: {
    title: "Pagos del mes por medio",
    data: paymentMethods,
    rows: 10,
    columns: 10,
    cellShape: "rounded",
    order: "row",
    gap: 0.14,
    height: 260,
    valueFormat: "integer",
    legend: true,
    tooltip: true,
    animate: true,
    loading: false,
    labels: spanishLabels,
  },
  argTypes: {
    cellShape: { control: "inline-radio", options: ["square", "rounded", "circle"] },
    order: { control: "inline-radio", options: ["row", "column"] },
    legend: { control: "select", options: [true, false, "top", "bottom"] },
    rows: { control: { type: "range", min: 2, max: 20, step: 1 } },
    columns: { control: { type: "range", min: 2, max: 30, step: 1 } },
    gap: { control: { type: "range", min: 0, max: 0.5, step: 0.02 } },
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
} satisfies Meta<typeof WaffleChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Squares: Story = { args: { cellShape: "square", order: "column" } };

export const Circles: Story = { args: { cellShape: "circle", gap: 0.2 } };

export const PartOfTotal: Story = {
  name: "Part of a total (occupancy)",
  args: {
    title: "Turnos ocupados esta semana",
    data: [
      { id: "reservados", name: "Reservados", value: 58 },
      { id: "sin-cita", name: "Sin cita", value: 17 },
    ],
    total: 120,
    labels: { ...spanishLabels, category: "Tipo de turno" },
  },
};

export const Wide: Story = {
  name: "Wide grid (5 x 20)",
  args: { rows: 5, columns: 20, height: 140, legend: "bottom" },
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
};
