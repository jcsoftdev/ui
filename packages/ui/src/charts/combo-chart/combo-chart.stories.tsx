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
    barRadius: {
      control: "number",
      description: "Corner radius at the value end of bars, 6 by default.",
    },
    description: {
      control: "text",
      description: "Extra sentence for the hidden data table caption.",
    },
    aspectRatio: {
      control: "number",
      description:
        "Width / height ratio; sizes the plot from the container width (wins over a pixel `height`).",
    },
    lineGradient: {
      control: "boolean",
      description:
        "Strokes lines with a gradient from each series color to the next palette color.",
    },
    transition: {
      control: "boolean",
      description: "Eases lines and areas between data updates (live data); off by default.",
    },
    maxPoints: {
      control: "number",
      description:
        "Series with more points than this are reduced with LTTB, 2000 by default; `false` draws every point.",
    },
    syncId: {
      control: "text",
      description:
        "Charts with the same id share hover (crosshair and tooltip) and the zoom window.",
    },
    onPointClick: {
      control: false,
      description:
        "Called with the category (and nearest series) under the pointer when the plot is clicked or Enter is pressed.",
    },
    gradient: { control: "boolean", description: "Gradient fill under areas (default true)." },
    valueFormat: {
      control: "select",
      options: ["number", "percent", "integer", "currency", "compact"],
      description: "Format of values in tooltips, labels and the data table.",
    },
    xFormat: {
      control: false,
      description:
        "Label of a category on the axis and in the tooltip (dates get Spanish defaults).",
    },
    axes: { control: "object", description: "Any number of value axes." },
    grid: { control: "boolean", description: "Background gridlines (default true)." },
    tooltip: { control: "boolean", description: "Shared tooltip (default true)." },
    dock: {
      control: "inline-radio",
      options: ["auto", "always", "never"],
      description:
        "Where the tooltip's details go: `auto` (default) docks them in a panel under the chart on containers 480px wide or less and on coarse pointers, `always` / `never` force it.",
    },
    tooltipRows: {
      control: false,
      description:
        "Customises the tooltip content of a category: replace the title or rows, or add a footer.",
    },
    annotations: { control: "object" },
    categoryLabelRotation: {
      control: "number",
      description:
        "Tilts the category labels (degrees, e.g. -45) so long names fit; vertical charts only.",
    },
    categoryTickEvery: {
      control: "number",
      description:
        "Shows every n-th category label, or those the predicate accepts; replaces the automatic thinning.",
    },
    categoryGroups: {
      control: "object",
      description:
        "Second tier of labels under the category axis (vertical charts); counts must add up to the categories.",
    },
    onCategoryClick: {
      control: false,
      description:
        "Click (or Enter on the focused plot) on a category; receives its index in `categories`.",
    },
    overlay: {
      control: false,
      description: "Extra layers over the plot, e.g. the ruler and ink tools of `useChartInk`.",
    },
    rangeSelect: { control: false },
    initialHidden: {
      control: "object",
      description: "Series hidden at first; the legend can show them.",
    },
    className: { control: "text" },
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

/** Three measures, three units: sales (S/) on the left, customers and average ticket stacked on the right. */
export const MultiAxis: Story = {
  args: {
    title: "Ventas, clientes y ticket promedio",
    series: [
      {
        id: "ventas",
        name: "Ventas",
        type: "column",
        data: revenue,
        format: "currency",
        color: "var(--accent-word)",
      },
      {
        id: "clientes",
        name: "Clientes",
        type: "line",
        axis: "right",
        data: appointments,
        format: "integer",
        color: "var(--chart-cat-1)",
      },
      {
        id: "ticket",
        name: "Ticket promedio",
        type: "line",
        axis: "ticket",
        data: ticket,
        format: "currency",
        color: "var(--chart-cat-3)",
      },
    ],
    yAxis: { title: "Ventas", format: "compact" },
    rightAxis: { title: "Clientes" },
    axes: [
      { id: "left", color: "var(--accent-word)" },
      { id: "right", color: "var(--chart-cat-1)" },
      {
        id: "ticket",
        title: "Ticket",
        side: "right",
        color: "var(--chart-cat-3)",
        min: 30,
        max: 60,
      },
    ],
  },
};

export const MultiAxisNarrow: Story = {
  ...MultiAxis,
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export const Loading: Story = { args: { loading: true } };
