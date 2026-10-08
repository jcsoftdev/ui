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
    curve: { control: "inline-radio", options: ["smooth", "linear"] },
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

export const Loading: Story = { args: { loading: true } };
