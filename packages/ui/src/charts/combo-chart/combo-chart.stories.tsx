import type { Meta, StoryObj } from "@storybook/react-vite";
import { ComboChart } from "./combo-chart.js";

const days = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const revenue = [1240, 1180, 1395, 1310, 1720, 2280, 760];
const appointments = [24, 22, 27, 25, 33, 44, 14];
const ticket = revenue.map(
  (value, i) => Math.round((value / (appointments[i] as number)) * 100) / 100,
);

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
  title: "Charts/ComboChart",
  component: ComboChart,
  tags: ["autodocs"],
  args: {
    title: "Ventas y citas de la semana",
    categories: days,
    series: [
      { id: "ventas", name: "Ventas", type: "column", data: revenue, format: "currency" },
      {
        id: "citas",
        name: "Citas",
        type: "line",
        axis: "right",
        data: appointments,
        format: "integer",
      },
    ],
    yAxis: { format: "currency", title: "S/" },
    rightAxis: { title: "Citas" },
    height: 320,
    curve: "smooth",
    markers: true,
    dataLabels: false,
    loading: false,
    animate: true,
    labels: spanishLabels,
  },
  argTypes: {
    curve: { control: "inline-radio", options: ["smooth", "linear"] },
    stack: { control: "inline-radio", options: ["none", "normal", "percent"] },
    legend: { control: "select", options: [true, false, "top", "bottom"] },
    height: { control: { type: "range", min: 180, max: 520, step: 10 } },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ComboChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ColumnsAndArea: Story = {
  args: {
    title: "Ventas y ticket promedio",
    series: [
      { id: "ventas", name: "Ventas", type: "column", data: revenue, format: "currency" },
      {
        id: "ticket",
        name: "Ticket promedio",
        type: "area",
        axis: "right",
        data: ticket,
        format: "currency",
      },
    ],
    rightAxis: { format: "currency", title: "Ticket" },
    markers: false,
  },
};

export const StackedColumnsWithTotalLine: Story = {
  args: {
    title: "Ventas por sede y citas totales",
    series: [
      {
        id: "centro",
        name: "Sede Centro",
        type: "column",
        data: revenue.map((value) => Math.round(value * 0.58)),
        format: "currency",
      },
      {
        id: "real",
        name: "Sede Real",
        type: "column",
        data: revenue.map((value) => Math.round(value * 0.42)),
        format: "currency",
      },
      {
        id: "citas",
        name: "Citas",
        type: "line",
        axis: "right",
        data: appointments,
        format: "integer",
      },
    ],
    stack: "normal",
  },
};

export const Loading: Story = { args: { loading: true } };
