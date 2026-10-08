import type { Meta, StoryObj } from "@storybook/react-vite";
import { seededRandom } from "../core/distribution/stats.js";
import { formatNumber, type ValueFormat } from "../core/format.js";
import { ViolinChart } from "./violin-chart.js";

/** Deterministic, roughly normal samples (Box–Muller), rounded and clamped. */
function samples(seed: number, count: number, mean: number, sd: number, min = 0): number[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => {
    const u = Math.max(1e-9, random());
    const v = random();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return Math.max(min, Math.round(mean + z * sd));
  });
}

const minutes = (value: number) => `${formatNumber(value, { maximumFractionDigits: 0 })} min`;

const services = ["Corte clásico", "Degradado", "Corte + barba", "Barba"];
const durations = [
  samples(31, 80, 28, 4),
  [...samples(32, 60, 38, 5), ...samples(33, 25, 52, 4)],
  samples(34, 55, 50, 7),
  samples(35, 70, 18, 3),
];
const weekday = [
  samples(41, 40, 26, 4),
  samples(42, 40, 36, 5),
  samples(43, 30, 47, 6),
  samples(44, 35, 17, 3),
];
const weekend = [
  samples(51, 45, 31, 6),
  samples(52, 50, 42, 7),
  samples(53, 38, 55, 8),
  samples(54, 40, 20, 4),
];

const spanishLabels = {
  empty: "Sin servicios registrados",
  loading: "Cargando gráfico",
  explore: "Violines del gráfico. Usa las flechas para recorrerlos.",
  category: "Servicio",
  count: "Servicios",
  min: "Mínimo",
  max: "Máximo",
  median: "Mediana",
  mean: "Promedio",
  outliers: "Atípicos",
};

const meta = {
  title: "Charts/ViolinChart",
  component: ViolinChart,
  tags: ["autodocs"],
  args: {
    title: "Duración por tipo de servicio",
    categories: services,
    series: [{ id: "duracion", name: "Duración", data: durations }],
    valueFormat: minutes as ValueFormat,
    valueAxis: { title: "min" },
    orientation: "vertical",
    inner: "box",
    split: false,
    scale: "width",
    height: 340,
    grid: true,
    tooltip: true,
    loading: false,
    animate: true,
    labels: spanishLabels,
  },
  argTypes: {
    orientation: { control: "inline-radio", options: ["vertical", "horizontal"] },
    inner: { control: "inline-radio", options: ["box", "quartiles", "none"] },
    scale: { control: "inline-radio", options: ["width", "area"] },
    legend: { control: "select", options: [true, false, "top", "bottom"] },
    bandwidth: { control: { type: "number", min: 0.5, max: 10, step: 0.5 } },
    height: { control: { type: "range", min: 200, max: 520, step: 10 } },
    valueFormat: { control: false },
    series: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ViolinChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Quartiles: Story = { args: { inner: "quartiles" } };

export const Horizontal: Story = { args: { orientation: "horizontal", height: 320 } };

const weekSeries = [
  { id: "semana", name: "Lunes a viernes", data: weekday },
  { id: "finde", name: "Fin de semana", data: weekend },
];

export const Split: Story = {
  args: { title: "Duración entre semana vs. fin de semana", series: weekSeries, split: true },
};

export const GroupedSideBySide: Story = {
  args: { title: "Duración entre semana vs. fin de semana", series: weekSeries, scale: "area" },
};

export const WaitingTimes: Story = {
  args: {
    title: "Tiempo de espera por franja horaria",
    categories: ["9–12 h", "12–15 h", "15–18 h", "18–21 h"],
    series: [
      {
        id: "espera",
        name: "Espera",
        data: [
          samples(61, 50, 6, 3),
          samples(62, 60, 14, 6),
          samples(63, 55, 10, 4),
          samples(64, 70, 22, 8),
        ],
      },
    ],
    labels: { ...spanishLabels, category: "Franja" },
  },
};

export const Narrow: Story = {
  args: { series: weekSeries, split: true },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = {
  args: { series: [{ id: "duracion", name: "Duración", data: [[], [], [], []] }] },
};
