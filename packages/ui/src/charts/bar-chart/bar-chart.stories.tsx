import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ChartPattern } from "../core/patterns.js";
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

export const DataLabels: Story = {
  args: {
    title: "Citas por barbero con el valor sobre cada barra",
    dataLabels: true,
  },
};

export const CustomDataLabels: Story = {
  args: {
    title: "Ingresos por barbero esta semana",
    series: [
      {
        id: "ingresos",
        name: "Ingresos",
        data: [1480, 1260, 1710, 940, 1120],
        format: (value) => `S/ ${(value / 1000).toFixed(1)} mil`,
      },
    ],
    dataLabels: true,
    valueFormat: "currency",
  },
};

export const Distributed: Story = {
  name: "Distributed (a color per bar)",
  args: {
    title: "Citas por barbero, un color para cada uno",
    distributed: true,
    dataLabels: true,
    legend: false,
  },
};

export const RotatedLabels: Story = {
  args: {
    title: "Servicios más vendidos en octubre",
    categories: topServices,
    series: [{ id: "vendidos", name: "Vendidos", data: topServicesSold }],
    categoryLabelRotation: -45,
    dataLabels: true,
    labels: { ...spanishLabels, category: "Servicio" },
  },
};

const workDays = ["lun", "mar", "mié", "jue", "vie", "sáb"];
const hour = (value: number) => `${String(Math.round(value)).padStart(2, "0")}:00`;

export const RangeColumn: Story = {
  name: "Range column (shifts)",
  args: {
    title: "Turno de Kevin: hora de entrada y de salida",
    categories: workDays,
    series: [
      {
        id: "turno",
        name: "Turno",
        ranges: [
          [9, 17],
          [10, 18],
          [9, 14],
          [12, 20],
          [9, 19],
          [8, 15],
        ],
        format: hour,
      },
    ],
    yAxis: { min: 7, max: 21, tickCount: 7, format: hour },
    valueFormat: hour,
    labels: { ...spanishLabels, category: "Día" },
  },
};

export const RangeBar: Story = {
  name: "Range bar (service duration)",
  args: {
    title: "Duración de cada servicio en minutos (mínimo a máximo)",
    categories: ["Corte clásico", "Degradado", "Barba", "Tinte", "Limpieza facial"],
    orientation: "horizontal",
    series: [
      {
        id: "duracion",
        name: "Duración",
        ranges: [
          [25, 40],
          [35, 55],
          [15, 30],
          [60, 95],
          [30, 45],
        ],
        format: (value) => `${value} min`,
      },
    ],
    dataLabels: true,
    height: 280,
    labels: { ...spanishLabels, category: "Servicio" },
  },
};

export const GroupedStacked: Story = {
  name: "Grouped stacked (income vs costs)",
  args: {
    title: "Ingresos y costos por mes (S/)",
    categories: months,
    stack: "normal",
    valueFormat: "compact",
    series: [
      {
        id: "cortes",
        name: "Cortes",
        stackGroup: "ingresos",
        data: [3200, 3500, 3900, 3700, 4100, 4500],
      },
      {
        id: "barbas",
        name: "Barbas",
        stackGroup: "ingresos",
        data: [1400, 1500, 1350, 1700, 1650, 1900],
      },
      {
        id: "sueldos",
        name: "Sueldos",
        stackGroup: "costos",
        data: [3000, 3000, 3200, 3200, 3400, 3400],
      },
      {
        id: "insumos",
        name: "Insumos",
        stackGroup: "costos",
        data: [900, 1100, 1000, 1250, 1180, 1300],
      },
    ],
    labels: { ...spanishLabels, category: "Mes" },
  },
};

export const GroupLabels: Story = {
  name: "Group labels (quarters)",
  args: {
    title: "Citas por mes, agrupadas por trimestre",
    categories: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set"],
    categoryGroups: [
      { label: "1.er trimestre", count: 3 },
      { label: "2.º trimestre", count: 3 },
      { label: "3.er trimestre", count: 3 },
    ],
    series: [{ id: "citas", name: "Citas", data: [210, 190, 240, 260, 280, 255, 300, 310, 290] }],
    labels: { ...spanishLabels, category: "Mes" },
  },
};

export const Reversed: Story = {
  name: "Reversed value axis",
  args: {
    title: "Minutos de espera promedio por barbero (menos es mejor)",
    series: [{ id: "espera", name: "Espera", data: [12, 18, 9, 22, 15] }],
    yAxis: { reversed: true, title: "min" },
    dataLabels: true,
    labels: spanishLabels,
  },
};

export const Patterned: Story = {
  name: "Patterns (color-blind friendly)",
  args: {
    title: "Citas por barbero: esta semana y la anterior",
    series: [
      { id: "actual", name: "Esta semana", data: appointmentsThisWeek, pattern: "stripes" },
      { id: "anterior", name: "Semana anterior", data: appointmentsLastWeek, pattern: "dots" },
    ],
    dataLabels: true,
  },
};

const stockPatterns: ChartPattern[] = [
  "stripes",
  "crosshatch",
  "dots",
  {
    size: 10,
    shapes: [
      { type: "circle", cx: 5, cy: 5, r: 2.4 },
      { type: "line", x1: 0, y1: 10, x2: 10, y2: 10, width: 1 },
    ],
  },
];

export const PatternedStacked: Story = {
  args: {
    title: "Stock consumido por mes, cada insumo con su trama",
    categories: months,
    stack: "normal",
    series: stock.map((item, index) => ({ ...item, pattern: stockPatterns[index] })),
    labels: { ...spanishLabels, category: "Mes" },
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
