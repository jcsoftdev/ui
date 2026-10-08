import type { Meta, StoryObj } from "@storybook/react-vite";
import { AreaChart } from "./area-chart.js";

const weeks = ["1 sep", "8 sep", "15 sep", "22 sep", "29 sep", "6 oct", "13 oct", "20 oct"];

/** Services sold per week, by type. */
const services = [
  { id: "corte", name: "Corte clásico", data: [62, 58, 71, 66, 74, 80, 77, 85] },
  { id: "degradado", name: "Degradado", data: [41, 47, 45, 52, 55, 61, 66, 64] },
  { id: "barba", name: "Barba", data: [28, 25, 31, 30, 34, 33, 38, 41] },
  { id: "combo", name: "Corte + barba", data: [19, 22, 20, 26, 24, 29, 31, 35] },
];

const days = Array.from({ length: 120 }, (_, i) => new Date(2026, 5, 1 + i));
const dailyRevenue = days.map((date, i) => {
  const weekday = date.getDay();
  const bump = weekday === 6 ? 560 : weekday === 0 ? -480 : 0;
  return Math.round(1050 + 260 * Math.sin(i / 5.3) + 120 * Math.cos(i / 1.7) + bump + i * 3.2);
});

const spanishLabels = {
  empty: "Sin datos para este periodo",
  loading: "Cargando gráfico",
  resetZoom: "Ver todo",
  total: "Total",
  explore: "Puntos del gráfico. Usa las flechas para recorrerlos.",
  brush: "Rango visible",
  category: "Semana",
};

const meta = {
  title: "Charts/AreaChart",
  component: AreaChart,
  tags: ["autodocs"],
  args: {
    title: "Servicios vendidos por semana",
    categories: weeks,
    series: services.slice(0, 1),
    valueFormat: "integer",
    height: 300,
    curve: "smooth",
    stack: "none",
    gradient: true,
    markers: false,
    dataLabels: false,
    brush: false,
    loading: false,
    animate: true,
    labels: spanishLabels,
  },
  argTypes: {
    curve: {
      control: "inline-radio",
      options: ["smooth", "linear", "step", "step-before", "step-after"],
    },
    stack: { control: "inline-radio", options: ["none", "normal", "percent"] },
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
} satisfies Meta<typeof AreaChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const MultipleSeries: Story = {
  args: { series: services.slice(0, 3) },
};

export const Stacked: Story = {
  args: { series: services, stack: "normal", title: "Servicios por semana, apilados" },
};

export const StackedPercent: Story = {
  name: "Stacked 100%",
  args: { series: services, stack: "percent", title: "Participación de cada servicio" },
};

export const WithoutGradient: Story = {
  args: { series: services.slice(0, 2), gradient: false, curve: "linear", markers: true },
};

export const BrushZoom: Story = {
  name: "Brush and zoom (120 days)",
  args: {
    title: "Ingresos diarios",
    categories: days,
    series: [{ id: "ingresos", name: "Ingresos", data: dailyRevenue }],
    valueFormat: "currency",
    brush: true,
    labels: { ...spanishLabels, category: "Día" },
    annotations: [{ type: "line", axis: "y", value: 1200, label: "Promedio", tone: "accent" }],
  },
};

/** Stock on the shelf only changes when a delivery arrives or a sale happens: a step area tells that truthfully. */
export const Step: Story = {
  args: {
    title: "Unidades de pomada en inventario",
    categories: ["1 oct", "2 oct", "3 oct", "4 oct", "5 oct", "6 oct", "7 oct", "8 oct", "9 oct"],
    series: [{ id: "pomada", name: "Pomada mate", data: [48, 48, 41, 41, 96, 88, 88, 79, 79] }],
    curve: "step-after",
    valueFormat: "integer",
    annotations: [
      { type: "line", axis: "y", value: 30, label: "Punto de pedido", tone: "warning" },
    ],
  },
};

/** Weekly cash flow: income minus expenses dips below zero in slow weeks. */
export const NegativeValues: Story = {
  args: {
    title: "Flujo de caja semanal",
    description: "Ingresos menos gastos; las semanas con pérdida quedan bajo cero.",
    categories: weeks,
    series: [{ id: "flujo", name: "Flujo neto", data: [420, 150, -260, -90, 310, 540, -120, 680] }],
    valueFormat: "currency",
    annotations: [
      { type: "range", axis: "y", from: -400, to: 0, label: "Pérdida", tone: "danger" },
    ],
  },
};

/** Weeks without a closing report leave the area open instead of inventing a value. */
export const WithGaps: Story = {
  args: {
    title: "Servicios por semana (cierres faltantes)",
    series: [
      {
        id: "corte",
        name: "Corte clásico",
        data: [62, 58, null, null, 74, 80, 77, null],
      },
    ],
    markers: true,
  },
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

export const Loading: Story = { args: { loading: true } };
