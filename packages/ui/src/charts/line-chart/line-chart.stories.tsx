import type { Meta, StoryObj } from "@storybook/react-vite";
import { LineChart } from "./line-chart.js";

/** Daily sales (S/) for a barbershop: Saturdays peak, Sundays only open half a day. */
function dailySales(days: number, from: Date, seed = 0) {
  const dates = Array.from(
    { length: days },
    (_, i) => new Date(from.getFullYear(), from.getMonth(), from.getDate() + i),
  );
  const values = dates.map((date, i) => {
    const weekday = date.getDay();
    const bump = weekday === 6 ? 620 : weekday === 5 ? 280 : weekday === 0 ? -540 : 0;
    return Math.round(1180 + 210 * Math.sin((i + seed) / 2.6) + bump + i * 6 + seed * 35);
  });
  return { dates, values };
}

const twoWeeks = dailySales(14, new Date(2026, 8, 28));
const lastPeriod = dailySales(14, new Date(2026, 8, 14), 3);
const quarter = dailySales(92, new Date(2026, 6, 1));

const spanishLabels = {
  empty: "Sin ventas registradas en este periodo",
  loading: "Cargando gráfico",
  resetZoom: "Ver todo",
  total: "Total",
  explore: "Puntos del gráfico. Usa las flechas para recorrerlos.",
  brush: "Rango visible",
  category: "Día",
};

const meta = {
  title: "Charts/LineChart",
  component: LineChart,
  tags: ["autodocs"],
  args: {
    title: "Ventas por día",
    categories: twoWeeks.dates,
    series: [{ id: "ventas", name: "Ventas", data: twoWeeks.values }],
    valueFormat: "currency",
    height: 300,
    curve: "smooth",
    markers: false,
    dataLabels: false,
    grid: true,
    tooltip: true,
    brush: false,
    loading: false,
    animate: true,
    labels: spanishLabels,
  },
  argTypes: {
    curve: { control: "inline-radio", options: ["smooth", "linear"] },
    valueFormat: {
      control: "select",
      options: ["number", "integer", "currency", "percent", "compact"],
    },
    xScale: { control: "inline-radio", options: ["auto", "band", "time"] },
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
} satisfies Meta<typeof LineChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Straight: Story = {
  args: { curve: "linear", markers: true },
};

export const ComparedWithLastPeriod: Story = {
  name: "Compared with last period (dashed)",
  args: {
    title: "Ventas: estas dos semanas frente a las anteriores",
    series: [
      { id: "actual", name: "Estas 2 semanas", data: twoWeeks.values },
      { id: "anterior", name: "2 semanas antes", data: lastPeriod.values, dashed: true },
    ],
  },
};

export const DataLabels: Story = {
  args: {
    title: "Ventas de la semana",
    categories: twoWeeks.dates.slice(0, 7),
    series: [{ id: "ventas", name: "Ventas", data: twoWeeks.values.slice(0, 7) }],
    markers: true,
    dataLabels: true,
    valueFormat: "currency",
    yAxis: { format: "compact" },
  },
};

export const GoalAndHoliday: Story = {
  name: "Annotations (goal and holiday)",
  args: {
    annotations: [
      { type: "line", axis: "y", value: 1500, label: "Meta diaria S/ 1 500", tone: "success" },
      {
        type: "range",
        axis: "x",
        from: new Date(2026, 9, 8),
        to: new Date(2026, 9, 8),
        label: "Feriado",
        tone: "warning",
      },
    ],
  },
};

export const BrushZoom: Story = {
  name: "Brush and zoom (92 days)",
  args: {
    title: "Ventas por día, tercer trimestre",
    categories: quarter.dates,
    series: [{ id: "ventas", name: "Ventas", data: quarter.values }],
    brush: true,
  },
};

export const WithGaps: Story = {
  args: {
    title: "Ventas con días sin registro",
    series: [
      {
        id: "ventas",
        name: "Ventas",
        data: twoWeeks.values.map((value, i) => (i === 5 || i === 6 ? null : value)),
      },
    ],
    markers: true,
  },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = {
  args: { series: [{ id: "ventas", name: "Ventas", data: [] }], categories: [] },
};
