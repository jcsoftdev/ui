import type { Meta, StoryObj } from "@storybook/react-vite";
import { seededRandom } from "../core/distribution/stats.js";
import { formatNumber, type ValueFormat } from "../core/format.js";
import { BeeswarmChart, type BeeswarmPoint } from "./beeswarm-chart.js";

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
const clients = ["Jorge", "Mateo", "Luis", "Andrés", "Piero", "Bruno", "César", "Iván", "Rafael"];

const barbers = ["Kevin", "Renzo", "Abel", "Diego"];
const means = [30, 26, 37, 33];
const haircut = (seed: number): BeeswarmPoint[] =>
  barbers.flatMap((barber, row) =>
    samples(seed + row, 34, means[row] as number, 5).map((value, index) => ({
      value,
      category: barber,
      label: `${clients[index % clients.length]} (${barber})`,
    })),
  );

const spanishLabels = {
  empty: "Sin servicios registrados",
  loading: "Cargando gráfico",
  explore: "Puntos del gráfico. Usa las flechas para recorrerlos.",
  category: "Barbero",
  value: "Duración",
  size: "Ticket",
  series: "Servicio",
  point: "Cliente",
};

const meta = {
  title: "Charts/BeeswarmChart",
  component: BeeswarmChart,
  tags: ["autodocs"],
  args: {
    title: "Duración de cada corte por barbero",
    series: [{ id: "corte", name: "Corte", points: haircut(201) }],
    valueFormat: minutes as ValueFormat,
    valueAxis: { title: "min" },
    orientation: "horizontal",
    radius: 4.5,
    gap: 1.25,
    grid: true,
    tooltip: true,
    loading: false,
    animate: true,
    labels: spanishLabels,
  },
  argTypes: {
    orientation: { control: "inline-radio", options: ["horizontal", "vertical"] },
    radius: { control: { type: "range", min: 2, max: 9, step: 0.5 } },
    gap: { control: { type: "range", min: 0, max: 4, step: 0.25 } },
    legend: { control: "select", options: [true, false, "top", "bottom"] },
    height: { control: { type: "range", min: 160, max: 640, step: 10 } },
    valueFormat: { control: false },
    sizeFormat: { control: false },
    series: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BeeswarmChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Vertical: Story = { args: { orientation: "vertical", height: 360 } };

const random = seededRandom(301);
const sizedVisits: BeeswarmPoint[] = samples(302, 70, 24, 7).map((value, index) => ({
  value,
  size: Math.round(25 + random() * 95),
  label: clients[index % clients.length],
}));

export const SizedByTicket: Story = {
  args: {
    title: "Tiempo de espera de cada cliente (tamaño = ticket)",
    series: [{ id: "espera", name: "Espera", points: sizedVisits }],
    sizeFormat: "currency",
    sizeRange: [3, 12],
    valueAxis: { title: "min de espera" },
    labels: { ...spanishLabels, value: "Espera" },
  },
};

export const ColoredBySeries: Story = {
  args: {
    title: "Corte vs. corte + barba por barbero",
    series: [
      { id: "corte", name: "Corte", points: haircut(211) },
      {
        id: "barba",
        name: "Corte + barba",
        points: haircut(221).map((point) => ({ ...point, value: point.value + 15 })),
      },
    ],
  },
};

export const Narrow: Story = {
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
