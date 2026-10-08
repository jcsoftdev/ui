import type { Meta, StoryObj } from "@storybook/react-vite";
import { BarChart } from "./bar-chart.js";

const barbers = ["Kevin", "Renzo", "Abel", "Diego", "Luis"];
const appointmentsThisWeek = [42, 38, 51, 29, 35];
const appointmentsLastWeek = [39, 41, 44, 31, 28];

const topServices = [
  "Corte clásico",
  "Degradado",
  "Corte + barba",
  "Perfilado de barba",
  "Tinte",
  "Lavado y peinado",
];
const topServicesSold = [186, 142, 97, 74, 31, 22];

const months = ["may", "jun", "jul", "ago", "set", "oct"];
const stock = [
  { id: "cera", name: "Cera", data: [34, 38, 41, 37, 44, 48] },
  { id: "shampoo", name: "Shampoo", data: [22, 25, 21, 27, 26, 30] },
  { id: "aftershave", name: "Aftershave", data: [12, 14, 13, 16, 15, 18] },
  { id: "navajas", name: "Navajas", data: [60, 58, 66, 70, 64, 72] },
];

const stockVariance = [
  { id: "variacion", name: "Variación de stock", data: [12, -8, 5, -14, 9, -3] },
];

const spanishLabels = {
  empty: "Sin datos para este periodo",
  loading: "Cargando gráfico",
  resetZoom: "Ver todo",
  total: "Total",
  explore: "Barras del gráfico. Usa las flechas para recorrerlas.",
  brush: "Rango visible",
  category: "Barbero",
};

const meta = {
  title: "Charts/BarChart",
  component: BarChart,
  tags: ["autodocs"],
  args: {
    title: "Citas por barbero esta semana",
    categories: barbers,
    series: [{ id: "citas", name: "Citas", data: appointmentsThisWeek }],
    valueFormat: "integer",
    orientation: "vertical",
    stack: "none",
    barRadius: 6,
    height: 300,
    dataLabels: false,
    grid: true,
    tooltip: true,
    loading: false,
    animate: true,
    labels: spanishLabels,
  },
  argTypes: {
    orientation: { control: "inline-radio", options: ["vertical", "horizontal"] },
    stack: { control: "inline-radio", options: ["none", "normal", "percent"] },
    barRadius: { control: { type: "range", min: 0, max: 16, step: 1 } },
    legend: { control: "select", options: [true, false, "top", "bottom"] },
    height: { control: { type: "range", min: 160, max: 520, step: 10 } },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Grouped: Story = {
  args: {
    title: "Citas por barbero: esta semana y la anterior",
    series: [
      { id: "actual", name: "Esta semana", data: appointmentsThisWeek },
      { id: "anterior", name: "Semana anterior", data: appointmentsLastWeek },
    ],
    dataLabels: true,
  },
};

export const Stacked: Story = {
  args: {
    title: "Stock consumido por mes (unidades)",
    categories: months,
    series: stock,
    stack: "normal",
    labels: { ...spanishLabels, category: "Mes" },
  },
};

export const StackedPercent: Story = {
  name: "Stacked 100%",
  args: {
    title: "Composición del stock consumido",
    categories: months,
    series: stock,
    stack: "percent",
    labels: { ...spanishLabels, category: "Mes" },
  },
};

export const Horizontal: Story = {
  name: "Horizontal (top services)",
  args: {
    title: "Servicios más vendidos en octubre",
    categories: topServices,
    series: [{ id: "vendidos", name: "Vendidos", data: topServicesSold }],
    orientation: "horizontal",
    dataLabels: true,
    height: 280,
    labels: { ...spanishLabels, category: "Servicio" },
  },
};

export const HorizontalStacked: Story = {
  args: {
    title: "Stock consumido por mes",
    categories: months,
    series: stock,
    orientation: "horizontal",
    stack: "normal",
    dataLabels: true,
    labels: { ...spanishLabels, category: "Mes" },
  },
};

export const NegativeValues: Story = {
  args: {
    title: "Variación mensual del stock de cera",
    categories: months,
    series: stockVariance,
    dataLabels: true,
    labels: { ...spanishLabels, category: "Mes" },
  },
};

export const WithGoal: Story = {
  name: "Annotation (weekly goal)",
  args: {
    annotations: [
      { type: "line", axis: "y", value: 40, label: "Meta: 40 citas", tone: "accent" },
      { type: "range", axis: "y", from: 0, to: 30, label: "Bajo", tone: "danger" },
    ],
  },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = {
  args: { categories: [], series: [{ id: "citas", name: "Citas", data: [] }] },
};

/** Drag the corner: the chart fills the box exactly, width and height. */
export const FillParent: Story = {
  args: { height: "fill" },
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 560,
          height: 360,
          resize: "both",
          overflow: "hidden",
          outline: "1px dashed var(--line-strong)",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};
