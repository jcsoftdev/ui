import type { Meta, StoryObj } from "@storybook/react-vite";
import { CartesianChart } from "./cartesian/cartesian-chart.js";

const spanishLabels = {
  empty: "Sin ventas registradas en este periodo",
  loading: "Cargando gráfico",
  resetZoom: "Ver todo",
  total: "Total",
  explore: "Puntos del gráfico. Usa las flechas para recorrerlos.",
  brush: "Rango visible",
  category: "Día",
};

const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const cuts = [420, 380, 450, 510, 690, 840, 260];
const beard = [150, 120, 180, 210, 260, 390, 90];
const clients = [14, 12, 15, 17, 22, 28, 9];

const meta = {
  title: "Charts/Primitives/CartesianChart",
  component: CartesianChart,
  tags: ["autodocs"],
  args: {
    title: "Ventas por servicio",
    categories: weekdays,
    series: [
      { id: "cortes", name: "Cortes", kind: "column", data: cuts },
      { id: "barba", name: "Barba", kind: "column", data: beard },
    ],
    valueFormat: "currency",
    height: 300,
    labels: spanishLabels,
  },
  argTypes: {
    categories: { control: "object" },
    series: { control: "object" },
    orientation: { control: "inline-radio", options: ["vertical", "horizontal"] },
    stack: { control: "inline-radio", options: ["none", "normal", "percent"] },
    curve: { control: "inline-radio", options: ["linear", "smooth", "step"] },
    legend: { control: "inline-radio", options: [true, false, "top", "bottom"] },
    markers: { control: "boolean" },
    dataLabels: { control: "boolean" },
    gradient: { control: "boolean" },
    grid: { control: "boolean" },
    tooltip: { control: "boolean" },
    brush: { control: "boolean" },
    loading: { control: "boolean" },
    animate: { control: "boolean" },
    height: { control: "number" },
    labels: { control: "object" },
    valueFormat: { control: false },
    xFormat: { control: false },
    annotations: { control: "object" },
  },
} satisfies Meta<typeof CartesianChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Stacked: Story = { args: { stack: "normal" } };

export const Horizontal: Story = { args: { orientation: "horizontal" } };

/** Columns and a line on a second axis: sales in soles against clients served. */
export const ColumnsAndLineOnRightAxis: Story = {
  args: {
    series: [
      {
        id: "ventas",
        name: "Ventas",
        kind: "column",
        data: cuts.map((cut, i) => cut + (beard[i] ?? 0)),
      },
      { id: "clientes", name: "Clientes", kind: "line", axis: "right", data: clients },
    ],
    rightAxis: { title: "Clientes" },
    yAxis: { title: "Ventas" },
    markers: true,
  },
};

export const AreaWithGoal: Story = {
  args: {
    series: [{ id: "ventas", name: "Ventas", kind: "area", data: cuts }],
    curve: "smooth",
    annotations: [
      { type: "line", axis: "y", value: 600, label: "Meta diaria S/ 600", tone: "success" },
    ],
  },
};

export const WithBrush: Story = {
  args: {
    categories: Array.from({ length: 60 }, (_, i) => new Date(2026, 7, 10 + i)),
    series: [
      {
        id: "ventas",
        name: "Ventas",
        kind: "line",
        data: Array.from({ length: 60 }, (_, i) =>
          Math.round(1150 + 220 * Math.sin(i / 3) + (i % 7 === 5 ? 520 : 0) + i * 5),
        ),
      },
    ],
    brush: true,
  },
};

/** Appends a row and a footer to the shared tooltip. */
export const CustomTooltipRows: Story = {
  args: {
    series: [{ id: "cortes", name: "Cortes", kind: "line", data: cuts }],
    tooltipRows: ({ index, rows }) => {
      const previous = cuts[index - 1];
      const change = previous ? Math.round((((cuts[index] ?? 0) - previous) / previous) * 100) : 0;
      return {
        rows: [
          ...rows,
          {
            id: "change",
            name: "Vs día anterior",
            value: `${change > 0 ? "+" : ""}${change} %`,
            color: "transparent",
            emphasis: true,
          },
        ],
        footer: "Solo días laborables",
      };
    },
  },
};

/** Every second label, and a value axis rounded up to a multiple of 200. */
export const TickEveryAndAxisMax: Story = {
  args: {
    categories: Array.from({ length: 31 }, (_, i) => `${i + 1}`),
    series: [
      {
        id: "ventas",
        name: "Ventas",
        kind: "column",
        data: Array.from({ length: 31 }, (_, i) => 300 + ((i * 53) % 260)),
      },
    ],
    categoryTickEvery: (index) => index % 5 === 0 || index === 30,
    yAxis: { max: (dataMax) => Math.ceil(dataMax / 200) * 200 },
  },
};

/** Dots only on the chosen points. */
export const HighlightedMarkers: Story = {
  args: {
    series: [{ id: "cortes", name: "Cortes", kind: "line", data: cuts }],
    markers: [3, 5],
  },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { categories: [], series: [] } };
