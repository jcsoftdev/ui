import type { Meta, StoryObj } from "@storybook/react-vite";
import { seededRandom } from "../core/distribution/stats.js";
import { formatNumber, type ValueFormat } from "../core/format.js";
import { BoxPlot } from "./box-plot.js";

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

const barbers = ["Kevin", "Renzo", "Abel", "Diego", "Luis"];
const haircutMinutes = [
  [...samples(1, 46, 32, 5), 58, 61],
  [...samples(2, 52, 28, 4), 12],
  samples(3, 39, 36, 7),
  [...samples(4, 44, 30, 3), 49, 52, 18],
  samples(5, 31, 41, 8),
];
const beardMinutes = [
  samples(11, 30, 18, 3),
  samples(12, 26, 15, 2),
  samples(13, 22, 21, 4),
  samples(14, 28, 17, 3),
  samples(15, 18, 24, 5),
];

const spanishLabels = {
  empty: "Sin servicios registrados",
  loading: "Cargando gráfico",
  explore: "Cajas del gráfico. Usa las flechas para recorrerlas.",
  category: "Barbero",
  count: "Servicios",
  min: "Mínimo",
  max: "Máximo",
  median: "Mediana",
  mean: "Promedio",
  outliers: "Atípicos",
};

const meta = {
  title: "Charts/BoxPlot",
  component: BoxPlot,
  tags: ["autodocs"],
  args: {
    title: "Duración del corte por barbero",
    categories: barbers,
    series: [{ id: "corte", name: "Corte", data: haircutMinutes }],
    valueFormat: minutes as ValueFormat,
    valueAxis: { title: "min" },
    orientation: "vertical",
    whisker: 1.5,
    showMean: true,
    showOutliers: true,
    height: 320,
    grid: true,
    tooltip: true,
    loading: false,
    animate: true,
    labels: spanishLabels,
  },
  argTypes: {
    orientation: { control: "inline-radio", options: ["vertical", "horizontal"] },
    whisker: { control: { type: "range", min: 0.5, max: 3, step: 0.5 } },
    legend: { control: "select", options: [true, false, "top", "bottom"] },
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
} satisfies Meta<typeof BoxPlot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Horizontal: Story = {
  args: { orientation: "horizontal", height: 300 },
};

export const GroupedBySeries: Story = {
  args: {
    title: "Duración de corte y barba por barbero",
    series: [
      { id: "corte", name: "Corte", data: haircutMinutes },
      { id: "barba", name: "Perfilado de barba", data: beardMinutes },
    ],
  },
};

export const AverageTicket: Story = {
  args: {
    title: "Ticket promedio por día de la semana",
    categories: ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"],
    series: [
      {
        id: "ticket",
        name: "Ticket",
        data: [
          samples(21, 30, 38, 8, 15),
          samples(22, 34, 40, 9, 15),
          samples(23, 33, 41, 9, 15),
          samples(24, 40, 44, 10, 15),
          [...samples(25, 52, 52, 12, 15), 120],
          [...samples(26, 64, 58, 14, 15), 135, 140],
          samples(27, 22, 47, 11, 15),
        ],
      },
    ],
    valueFormat: "currency",
    valueAxis: { title: "S/" },
    labels: { ...spanishLabels, category: "Día", count: "Ventas" },
  },
};

export const WhiskersToExtremes: Story = {
  args: { whisker: Number.POSITIVE_INFINITY, showOutliers: false, showMean: false },
};

export const Narrow: Story = {
  args: {
    series: [
      { id: "corte", name: "Corte", data: haircutMinutes },
      { id: "barba", name: "Perfilado de barba", data: beardMinutes },
    ],
  },
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
  args: { series: [{ id: "corte", name: "Corte", data: [[], [], [], [], []] }] },
};
