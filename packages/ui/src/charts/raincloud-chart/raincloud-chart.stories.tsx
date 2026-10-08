import type { Meta, StoryObj } from "@storybook/react-vite";
import { seededRandom } from "../core/distribution/stats.js";
import { formatNumber, type ValueFormat } from "../core/format.js";
import { RaincloudChart } from "./raincloud-chart.js";

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

const barbers = ["Kevin", "Renzo", "Abel", "Diego"];
const waitMinutes = [
  [...samples(71, 45, 9, 4), 31],
  samples(72, 60, 14, 6),
  [...samples(73, 30, 6, 2), ...samples(74, 12, 18, 3)],
  samples(75, 50, 11, 5),
];
const saturdayWait = [
  samples(81, 50, 16, 6),
  samples(82, 64, 22, 8),
  samples(83, 40, 12, 5),
  samples(84, 58, 19, 7),
];

const spanishLabels = {
  empty: "Sin esperas registradas",
  loading: "Cargando gráfico",
  explore: "Distribuciones del gráfico. Usa las flechas para recorrerlas.",
  category: "Barbero",
  count: "Clientes",
  min: "Mínimo",
  max: "Máximo",
  median: "Mediana",
  mean: "Promedio",
  outliers: "Atípicos",
};

const meta = {
  title: "Charts/RaincloudChart",
  component: RaincloudChart,
  tags: ["autodocs"],
  args: {
    title: "Tiempo de espera por barbero",
    categories: barbers,
    series: [{ id: "espera", name: "Espera", data: waitMinutes }],
    valueFormat: minutes as ValueFormat,
    valueAxis: { title: "minutos de espera", min: 0 },
    rain: true,
    pointRadius: 2.5,
    showMean: true,
    grid: true,
    tooltip: true,
    loading: false,
    animate: true,
    labels: spanishLabels,
  },
  argTypes: {
    pointRadius: { control: { type: "range", min: 1, max: 5, step: 0.5 } },
    seed: { control: { type: "number" } },
    legend: { control: "select", options: [true, false, "top", "bottom"] },
    height: { control: { type: "range", min: 200, max: 720, step: 10 } },
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
} satisfies Meta<typeof RaincloudChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutRain: Story = { args: { rain: false } };

const weekSeries = [
  { id: "semana", name: "Lunes a viernes", data: waitMinutes },
  { id: "sabado", name: "Sábado", data: saturdayWait },
];

export const WeekdayVsSaturday: Story = {
  args: { title: "Espera entre semana vs. sábado", series: weekSeries },
};

export const AverageTicket: Story = {
  args: {
    title: "Ticket por canal de reserva",
    categories: ["Presencial", "WhatsApp", "App"],
    series: [
      {
        id: "ticket",
        name: "Ticket",
        data: [
          samples(91, 70, 38, 9, 15),
          samples(92, 55, 45, 11, 15),
          samples(93, 80, 52, 13, 15),
        ],
      },
    ],
    valueFormat: "currency",
    valueAxis: { title: "S/" },
    labels: { ...spanishLabels, category: "Canal", count: "Ventas" },
  },
};

export const Narrow: Story = {
  args: { series: weekSeries },
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
  args: { series: [{ id: "espera", name: "Espera", data: [[], [], [], []] }] },
};
