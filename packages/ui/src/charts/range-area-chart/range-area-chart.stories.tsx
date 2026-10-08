import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ValueFormat } from "../core/format.js";
import { RangeAreaChart, type RangeBand } from "./range-area-chart.js";

const days = Array.from({ length: 30 }, (_, i) => new Date(2026, 8, 9 + i));

const wave = (i: number, base: number, amp: number, phase: number) =>
  Math.max(
    2,
    Math.round(
      base + amp * Math.sin(i / 3.1 + phase) + (new Date(2026, 8, 9 + i).getDay() === 6 ? 7 : 0),
    ),
  );

const average = days.map((_, i) => wave(i, 17, 4, 0));
const waitTime: RangeBand = {
  id: "espera",
  name: "Tiempo de espera",
  min: average.map((v, i) => Math.max(2, v - 8 - (i % 4))),
  max: average.map((v, i) => v + 9 + (i % 5)),
  mean: average,
};

const walkIns = days.map((_, i) => wave(i, 12, 3, 1.4));
const bandsPair: RangeBand[] = [
  waitTime,
  {
    id: "sin-cita",
    name: "Sin cita previa",
    min: walkIns.map((v) => Math.max(1, v - 5)),
    max: walkIns.map((v, i) => v + 6 + (i % 3)),
    mean: walkIns,
  },
];

const spanishLabels = {
  empty: "Sin datos para este periodo",
  loading: "Cargando gráfico",
  resetZoom: "Ver todo",
  total: "Total",
  explore: "Puntos del gráfico. Usa las flechas para recorrerlos.",
  brush: "Rango visible",
  category: "Día",
};

const meta = {
  title: "Charts/RangeAreaChart",
  component: RangeAreaChart,
  tags: ["autodocs"],
  args: {
    title: "Tiempo de espera mínimo y máximo por día",
    categories: days,
    bands: [waitTime],
    valueFormat: ((value: number) => `${Math.round(value)} min`) as ValueFormat,
    height: 300,
    curve: "smooth",
    showMean: true,
    grid: true,
    tooltip: true,
    loading: false,
    animate: true,
    minLabel: "Mín",
    maxLabel: "Máx",
    meanLabel: "Prom.",
    labels: spanishLabels,
  },
  argTypes: {
    curve: { control: "inline-radio", options: ["smooth", "linear"] },
    xScale: { control: "inline-radio", options: ["auto", "point", "time"] },
    legend: { control: "select", options: [true, false, "top", "bottom"] },
    valueFormat: { control: false },
    categories: { control: false },
    bands: { control: false },
    height: { control: { type: "range", min: 160, max: 520, step: 10 } },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RangeAreaChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const MultipleBands: Story = {
  args: { bands: bandsPair, title: "Espera con cita y sin cita previa" },
};

export const WithoutMean: Story = {
  args: { showMean: false, curve: "linear" },
};

export const FixedAxis: Story = {
  args: { yAxis: { min: 0, max: 40, title: "min" } },
};

export const ByCategory: Story = {
  args: {
    title: "Precio de insumos por proveedor",
    categories: [
      "Barbería Lima",
      "Insumos Pro",
      "Distribuidora Sur",
      "Importados SAC",
      "Mayorista Norte",
    ],
    bands: [
      {
        id: "pomada",
        name: "Pomada",
        min: [18, 22, 16, 25, 17],
        max: [32, 30, 28, 41, 26],
        mean: [24, 26, 21, 33, 21],
      },
    ],
    valueFormat: "currency",
    labels: { ...spanishLabels, category: "Proveedor" },
  },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { bands: [{ id: "x", name: "Sin datos", min: [], max: [] }] } };

export const Narrow: Story = {
  args: { bands: bandsPair },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};
