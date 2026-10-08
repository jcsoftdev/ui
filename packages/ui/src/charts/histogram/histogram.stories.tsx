import type { Meta, StoryObj } from "@storybook/react-vite";
import { seededRandom } from "../core/distribution/stats.js";
import { formatNumber, type ValueFormat } from "../core/format.js";
import { Histogram } from "./histogram.js";

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

const tickets = [...samples(101, 260, 42, 9, 15), ...samples(102, 90, 78, 12, 15), 135, 150];
const waitWeekday = samples(111, 220, 12, 5);
const waitSaturday = samples(112, 180, 21, 7);

const spanishLabels = {
  empty: "Sin ventas en este periodo",
  loading: "Cargando gráfico",
  explore: "Barras del histograma. Usa las flechas para recorrerlas.",
  range: "Rango",
  frequency: "Ventas",
  density: "Densidad",
};

const meta = {
  title: "Charts/Histogram",
  component: Histogram,
  tags: ["autodocs"],
  args: {
    title: "Distribución del ticket de octubre",
    series: [{ id: "ticket", name: "Ticket", values: tickets }],
    bins: "auto",
    mode: "count",
    normalCurve: false,
    valueFormat: "currency",
    xAxis: { title: "Ticket (S/)" },
    height: 300,
    grid: true,
    tooltip: true,
    loading: false,
    animate: true,
    labels: spanishLabels,
  },
  argTypes: {
    bins: { control: "select", options: ["auto", "sturges", "freedman-diaconis", 5, 10, 20, 40] },
    binWidth: { control: { type: "number", min: 1, step: 1 } },
    mode: { control: "inline-radio", options: ["count", "density"] },
    legend: { control: "select", options: [true, false, "top", "bottom"] },
    height: { control: { type: "range", min: 180, max: 520, step: 10 } },
    valueFormat: { control: false },
    series: { control: false },
    exploded: { control: "boolean" },
    defaultExploded: { control: "boolean" },
    explodeToggle: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Histogram>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FixedBinWidth: Story = { args: { binWidth: 10, bins: undefined } };

export const DensityWithNormalCurve: Story = {
  args: { mode: "density", normalCurve: true },
};

export const Sturges: Story = { args: { bins: "sturges" } };

const waitSeries = [
  { id: "semana", name: "Lunes a viernes", values: waitWeekday },
  { id: "sabado", name: "Sábado", values: waitSaturday },
];

export const OverlaidSeries: Story = {
  args: {
    title: "Tiempo de espera: semana vs. sábado",
    series: waitSeries,
    binWidth: 3,
    normalCurve: true,
    valueFormat: minutes as ValueFormat,
    xAxis: { title: "Espera (min)" },
    labels: { ...spanishLabels, frequency: "Clientes", empty: "Sin esperas registradas" },
  },
};

/** Press the toggle to turn every bin into one dot per sale. */
export const Explode: Story = {
  args: {
    title: "Cada venta del turno de la tarde",
    series: [{ id: "tarde", name: "Ticket", values: [...samples(103, 70, 40, 9, 15), 95, 110] }],
    binWidth: 10,
    bins: undefined,
    explodeToggle: true,
    labels: { ...spanishLabels, explode: "Ver cada venta", bars: "Ver barras" },
  },
};

export const Narrow: Story = {
  args: { normalCurve: true },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { series: [{ id: "ticket", name: "Ticket", values: [] }] } };
