import type { Meta, StoryObj } from "@storybook/react-vite";
import { seededRandom } from "../core/distribution/stats.js";
import type { XYPoint } from "../core/distribution/xy-points.js";
import { formatNumber, type ValueFormat } from "../core/format.js";
import { ScatterChart } from "./scatter-chart.js";

const minutes = (value: number) => `${formatNumber(value, { maximumFractionDigits: 0 })} min`;

/** Service duration (x) vs. ticket (y): longer services cost more, with noise. */
function visits(seed: number, count: number, base: number, perMinute: number): XYPoint[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => {
    const duration = Math.round(15 + random() * 55);
    const noise = (random() - 0.5) * 22;
    return { x: duration, y: Math.round(base + duration * perMinute + noise) };
  });
}

const spanishLabels = {
  empty: "Sin atenciones en este periodo",
  loading: "Cargando gráfico",
  explore: "Puntos del gráfico. Usa las flechas para recorrerlos.",
  series: "Servicio",
  point: "Atención",
};

const meta = {
  title: "Charts/ScatterChart",
  component: ScatterChart,
  tags: ["autodocs"],
  args: {
    title: "Duración del servicio vs. ticket",
    series: [
      { id: "corte", name: "Corte", points: visits(401, 60, 10, 0.75) },
      { id: "combo", name: "Corte + barba", points: visits(402, 45, 22, 0.9) },
    ],
    xFormat: minutes as ValueFormat,
    yFormat: "currency",
    xAxis: { title: "Duración (min)" },
    yAxis: { title: "Ticket (S/)" },
    trendLine: false,
    radius: 5,
    height: 340,
    grid: true,
    tooltip: true,
    loading: false,
    animate: true,
    labels: spanishLabels,
  },
  argTypes: {
    radius: { control: { type: "range", min: 2, max: 9, step: 0.5 } },
    legend: { control: "select", options: [true, false, "top", "bottom"] },
    height: { control: { type: "range", min: 200, max: 560, step: 10 } },
    xFormat: { control: false },
    yFormat: { control: false },
    series: { control: false },
    quadrants: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ScatterChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithTrendLines: Story = { args: { trendLine: true } };

const barberPoints: XYPoint[] = [
  { label: "Kevin", x: 28, y: 4.8 },
  { label: "Renzo", x: 24, y: 4.3 },
  { label: "Abel", x: 37, y: 4.9 },
  { label: "Diego", x: 31, y: 3.9 },
  { label: "Luis", x: 42, y: 4.6 },
  { label: "Marco", x: 22, y: 3.6 },
  { label: "Jhon", x: 35, y: 4.1 },
];

export const Quadrants: Story = {
  args: {
    title: "Rapidez vs. satisfacción por barbero",
    series: [{ id: "barberos", name: "Barberos", points: barberPoints }],
    xFormat: minutes as ValueFormat,
    yFormat: (value: number) => formatNumber(value, { maximumFractionDigits: 1 }),
    xAxis: { title: "Duración media (min)" },
    yAxis: { title: "Calificación", min: 3, max: 5 },
    radius: 7,
    quadrants: {
      x: 30,
      y: 4.3,
      labels: {
        topLeft: "Rápidos y bien valorados",
        topRight: "Detallistas",
        bottomLeft: "Rápidos, revisar calidad",
        bottomRight: "A capacitar",
      },
      tones: { topLeft: "success", bottomRight: "danger" },
    },
  },
};

export const Narrow: Story = {
  args: { trendLine: true },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { series: [{ id: "corte", name: "Corte", points: [] }] } };
