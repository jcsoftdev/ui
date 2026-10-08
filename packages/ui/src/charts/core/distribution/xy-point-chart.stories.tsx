import type { Meta, StoryObj } from "@storybook/react-vite";
import { seededRandom } from "./stats.js";
import { type XYPoint, XYPointChart } from "./xy-points.js";

/** Service duration (x) vs. ticket (y): longer services cost more, with noise. */
function visits(seed: number, count: number, base: number, perMinute: number): XYPoint[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => {
    const duration = Math.round(15 + random() * 55);
    const noise = (random() - 0.5) * 22;
    return { x: duration, y: Math.round(base + duration * perMinute + noise) };
  });
}

const branches: XYPoint[] = [
  { x: 42, y: 61, size: 380, label: "Miraflores" },
  { x: 35, y: 48, size: 240, label: "Barranco" },
  { x: 51, y: 72, size: 310, label: "San Isidro" },
  { x: 28, y: 39, size: 150, label: "Surco" },
];

const labels = {
  empty: "Sin atenciones en este periodo",
  loading: "Cargando gráfico",
  explore: "Puntos del gráfico. Usa las flechas para recorrerlos.",
  series: "Servicio",
  point: "Atención",
};

const meta = {
  title: "Charts/Primitives/XYPointChart",
  component: XYPointChart,
  tags: ["autodocs"],
  args: {
    title: "Duración del servicio vs. ticket",
    series: [
      { id: "corte", name: "Corte", points: visits(401, 40, 10, 0.75) },
      { id: "combo", name: "Corte + barba", points: visits(402, 30, 22, 0.9) },
    ],
    yFormat: "currency",
    xAxis: { title: "Duración (min)" },
    yAxis: { title: "Ticket (S/)" },
    trendLine: false,
    sized: false,
    radius: 5,
    height: 320,
    grid: true,
    tooltip: true,
    loading: false,
    animate: true,
    labels,
  },
  argTypes: {
    radius: { control: { type: "range", min: 2, max: 9, step: 0.5 } },
    height: { control: { type: "range", min: 200, max: 520, step: 10 } },
    legend: { control: "select", options: [true, false, "top", "bottom"] },
    trendLine: { control: "boolean" },
    sized: { control: "boolean" },
    series: { control: false },
    xFormat: { control: false },
    yFormat: { control: false },
    sizeFormat: { control: false },
    quadrants: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="@container w-[640px] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof XYPointChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The engine behind `ScatterChart` and `BubbleChart`, used directly. */
export const Default: Story = {};

export const WithTrendLine: Story = { args: { trendLine: true } };

/** `sized` turns the points into bubbles whose area follows `size`. */
export const Bubbles: Story = {
  args: {
    title: "Sedes: duración, ticket y atenciones",
    series: [{ id: "sedes", name: "Sedes", points: branches }],
    sized: true,
    showLabels: true,
    xAxis: { title: "Duración (min)", min: 20, max: 60 },
    yAxis: { title: "Ticket (S/)", min: 30, max: 80 },
  },
};

export const Quadrants: Story = {
  args: {
    quadrants: {
      labels: { topLeft: "Rápidos y caros", bottomRight: "Lentos y baratos" },
      tones: { topLeft: "success", bottomRight: "warning" },
    },
  },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = {
  args: { series: [{ id: "corte", name: "Corte", points: [] }] },
};
